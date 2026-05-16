/**
 * Pure helpers for the visual schedule builder.
 *
 * The contract is the same 5-field cron grammar that
 * server/automation/cron.js accepts:
 *   minute hour day-of-month month day-of-week
 *   *    literal    N-M range    N,M list    * /STEP step
 *
 * We only generate strings the server's parser accepts. Anything else
 * the user types — including patterns we can't decompose into a preset —
 * is held in 'custom' mode and round-trips through unchanged.
 */

export const WEEKDAYS = Object.freeze([
    { id: 1, label: 'Mon' },
    { id: 2, label: 'Tue' },
    { id: 3, label: 'Wed' },
    { id: 4, label: 'Thu' },
    { id: 5, label: 'Fri' },
    { id: 6, label: 'Sat' },
    { id: 0, label: 'Sun' },
]);

/**
 * IANA timezone options. Modern browsers expose
 * Intl.supportedValuesOf('timeZone') which returns every TZ the engine
 * knows about. When that's unavailable we fall back to a curated short
 * list so the picker is never empty.
 */
export const TIMEZONE_OPTIONS = (() => {
    try {
        if (typeof Intl?.supportedValuesOf === 'function') {
            const list = Intl.supportedValuesOf('timeZone');
            if (Array.isArray(list) && list.length > 20) return list;
        }
    } catch (_) { /* fall through */ }
    return [
        'UTC',
        'Europe/Amsterdam', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
        'Europe/Rome', 'Europe/Warsaw', 'Europe/Athens', 'Europe/Istanbul',
        'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
        'America/Sao_Paulo',
        'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Kolkata', 'Asia/Dubai',
        'Australia/Sydney',
    ];
})();

const SCHEDULE_MODES = ['minute', 'hourly', 'daily', 'weekly', 'monthly', 'custom'];
export { SCHEDULE_MODES };

/**
 * Try to decompose a cron string into one of our preset modes. Anything
 * that doesn't match falls back to 'custom' so the user can keep
 * editing the raw expression without losing fidelity.
 */
export function presetFromCron(cron) {
    if (typeof cron !== 'string') return defaultPreset();
    const trimmed = cron.trim();
    if (!trimmed) return defaultPreset();
    const parts = trimmed.split(/\s+/);
    if (parts.length !== 5) return customPreset(trimmed);
    const [m, h, dom, mon, dow] = parts;

    // Every-N-minutes: */N * * * * (or every minute: * * * * *).
    if (mon === '*' && dom === '*' && dow === '*' && h === '*') {
        if (m === '*') return { mode: 'minute', everyN: 1 };
        const stepMatch = m.match(/^\*\/(\d+)$/);
        if (stepMatch) {
            const n = parseInt(stepMatch[1], 10);
            if (n >= 1 && n <= 59) return { mode: 'minute', everyN: n };
        }
    }

    // Hourly at minute M: M * * * *.
    if (mon === '*' && dom === '*' && dow === '*' && h === '*' && /^\d+$/.test(m)) {
        const mm = parseInt(m, 10);
        if (mm >= 0 && mm <= 59) return { mode: 'hourly', minute: mm };
    }

    // Daily at H:M — M H * * *.
    if (mon === '*' && dom === '*' && dow === '*' && /^\d+$/.test(m) && /^\d+$/.test(h)) {
        const mm = parseInt(m, 10);
        const hh = parseInt(h, 10);
        if (mm >= 0 && mm <= 59 && hh >= 0 && hh <= 23) {
            return { mode: 'daily', hour: hh, minute: mm };
        }
    }

    // Weekly: M H * * D[,D,...]  (DOM is *, DOW is restricted).
    if (mon === '*' && dom === '*' && /^\d+$/.test(m) && /^\d+$/.test(h) && /^[0-7](,[0-7])*$/.test(dow)) {
        const days = dow.split(',').map(d => parseInt(d, 10) === 7 ? 0 : parseInt(d, 10));
        return { mode: 'weekly', hour: parseInt(h, 10), minute: parseInt(m, 10), days };
    }

    // Monthly on day D: M H D * *.
    if (mon === '*' && dow === '*' && /^\d+$/.test(m) && /^\d+$/.test(h) && /^\d+$/.test(dom)) {
        const d = parseInt(dom, 10);
        if (d >= 1 && d <= 31) {
            return { mode: 'monthly', hour: parseInt(h, 10), minute: parseInt(m, 10), day: d };
        }
    }

    return customPreset(trimmed);
}

function defaultPreset() {
    return { mode: 'daily', hour: 9, minute: 0 };
}

function customPreset(cron) {
    return { mode: 'custom', cron };
}

/**
 * Inverse of presetFromCron. Always produces a 5-field cron string the
 * server parser will accept. Defensive defaults so a half-filled form
 * still generates a valid expression.
 */
export function cronFromPreset(preset) {
    if (!preset || typeof preset !== 'object') return '0 9 * * *';
    switch (preset.mode) {
        case 'minute': {
            const n = clampInt(preset.everyN, 1, 59, 1);
            return n === 1 ? '* * * * *' : `*/${n} * * * *`;
        }
        case 'hourly': {
            const m = clampInt(preset.minute, 0, 59, 0);
            return `${m} * * * *`;
        }
        case 'daily': {
            const m = clampInt(preset.minute, 0, 59, 0);
            const h = clampInt(preset.hour, 0, 23, 9);
            return `${m} ${h} * * *`;
        }
        case 'weekly': {
            const m = clampInt(preset.minute, 0, 59, 0);
            const h = clampInt(preset.hour, 0, 23, 9);
            const days = Array.isArray(preset.days) && preset.days.length
                ? Array.from(new Set(preset.days.map(d => clampInt(d, 0, 6, 1)))).sort((a, b) => a - b)
                : [1];
            return `${m} ${h} * * ${days.join(',')}`;
        }
        case 'monthly': {
            const m = clampInt(preset.minute, 0, 59, 0);
            const h = clampInt(preset.hour, 0, 23, 9);
            const d = clampInt(preset.day, 1, 31, 1);
            return `${m} ${h} ${d} * *`;
        }
        case 'custom':
            return typeof preset.cron === 'string' && preset.cron.trim() ? preset.cron.trim() : '0 9 * * *';
        default:
            return '0 9 * * *';
    }
}

/**
 * Short, friendly description of the chosen pattern. Falls back to
 * "Custom expression" for cron we couldn't decompose. The full
 * authoritative answer comes from the server preview endpoint — this
 * is for instant feedback while the user is still typing.
 */
export function describeCron(cron) {
    const preset = presetFromCron(cron);
    switch (preset.mode) {
        case 'minute':
            return preset.everyN === 1 ? 'Every minute' : `Every ${preset.everyN} minutes`;
        case 'hourly':
            return preset.minute === 0
                ? 'Every hour, on the hour'
                : `Every hour at :${pad2(preset.minute)}`;
        case 'daily':
            return `Every day at ${pad2(preset.hour)}:${pad2(preset.minute)}`;
        case 'weekly': {
            const labels = preset.days.map(d => WEEKDAYS.find(w => w.id === d)?.label || d).join(', ');
            return `Weekly on ${labels} at ${pad2(preset.hour)}:${pad2(preset.minute)}`;
        }
        case 'monthly':
            return `Monthly on day ${preset.day} at ${pad2(preset.hour)}:${pad2(preset.minute)}`;
        case 'custom':
        default:
            return 'Custom expression';
    }
}

function pad2(n) {
    const s = String(n);
    return s.length < 2 ? `0${s}` : s;
}

function clampInt(v, min, max, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    const i = Math.floor(n);
    if (i < min) return min;
    if (i > max) return max;
    return i;
}
