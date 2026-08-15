/**
 * Pure scheduling helpers for Cowork.
 *
 * Cowork's "When" picker is deliberately preset-first (Now / In an hour /
 * Tonight / Tomorrow / Next Monday / pick a moment) instead of the two bare
 * date+time inputs the old prompt-task editor had — the preset is what people
 * actually mean, and the raw inputs stay available behind "Pick a moment".
 *
 * `advanceByRepeat` mirrors aiTaskStore.advanceNextRun on the server so the
 * client can compute the *next* occurrence for a "start now + repeat" item
 * without a round-trip, and both sides agree on what "weekly" means.
 */

export const WHEN_PRESETS = [
    { id: 'now', label: 'Run now', hint: 'Starts the moment you send it' },
    { id: 'in_1h', label: 'In an hour', hint: null },
    { id: 'tonight', label: 'Tonight', hint: '18:00' },
    { id: 'tomorrow', label: 'Tomorrow morning', hint: '09:00' },
    { id: 'next_week', label: 'Next Monday', hint: '09:00' },
    { id: 'custom', label: 'Pick a moment…', hint: null },
];

// The full server VALID_REPEAT_INTERVALS set, in order. It has to be complete:
// the API, the `set_cowork` tool and the AI composer can all produce `hourly`
// or `yearly`, and a value missing from this list has no matching <option>, so
// the edit form's <select> falls back to the first entry and silently rewrites
// the schedule to "Once" the moment anything else is saved.
export const COWORK_REPEAT_OPTIONS = [
    { value: '', label: 'Once' },
    { value: 'hourly', label: 'Every hour' },
    { value: 'daily', label: 'Every day' },
    { value: 'weekdays', label: 'Every weekday' },
    { value: 'weekly', label: 'Every week' },
    { value: 'biweekly', label: 'Every 2 weeks' },
    { value: 'monthly', label: 'Every month' },
    { value: 'quarterly', label: 'Every quarter' },
    { value: 'yearly', label: 'Every year' },
];

export function repeatLabel(value) {
    const opt = COWORK_REPEAT_OPTIONS.find(o => o.value === (value || ''));
    return opt ? opt.label : value;
}

/** `YYYY-MM-DD` in local time — the value shape an <input type="date"> wants. */
export function toDateInput(d) {
    return d.toLocaleDateString('sv-SE');
}

/** `HH:MM` in local time — the value shape an <input type="time"> wants. */
export function toTimeInput(d) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function atLocalTime(base, hour, minute) {
    const d = new Date(base);
    d.setHours(hour, minute, 0, 0);
    return d;
}

/**
 * Resolve a preset (+ optional custom date/time) to a concrete Date.
 * Returns null when 'custom' is picked but the inputs aren't filled in yet.
 */
export function resolveWhen(presetId, { now = new Date(), date = '', time = '' } = {}) {
    switch (presetId) {
        case 'now':
            return new Date(now);
        case 'in_1h':
            return new Date(now.getTime() + 60 * 60 * 1000);
        case 'tonight': {
            const tonight = atLocalTime(now, 18, 0);
            // Already past 18:00 → the user means tomorrow evening.
            if (tonight <= now) tonight.setDate(tonight.getDate() + 1);
            return tonight;
        }
        case 'tomorrow': {
            const d = atLocalTime(now, 9, 0);
            d.setDate(d.getDate() + 1);
            return d;
        }
        case 'next_week': {
            const d = atLocalTime(now, 9, 0);
            // 1 = Monday. Always lands on the *coming* Monday, never today.
            const delta = ((1 - d.getDay()) + 7) % 7 || 7;
            d.setDate(d.getDate() + delta);
            return d;
        }
        case 'custom': {
            if (!date || !time) return null;
            const d = new Date(`${date}T${time}`);
            return Number.isNaN(d.getTime()) ? null : d;
        }
        default:
            return null;
    }
}

/**
 * Next occurrence after `from` for a repeat interval. Mirrors the server's
 * aiTaskStore.advanceNextRun. Returns null for a non-repeating interval.
 */
export function advanceByRepeat(from, interval) {
    const d = new Date(from);
    if (Number.isNaN(d.getTime())) return null;
    switch (interval) {
        case 'hourly': d.setHours(d.getHours() + 1); break;
        case 'daily': d.setDate(d.getDate() + 1); break;
        case 'weekdays':
            do { d.setDate(d.getDate() + 1); }
            while (d.getDay() === 0 || d.getDay() === 6);
            break;
        case 'weekly': d.setDate(d.getDate() + 7); break;
        case 'biweekly': d.setDate(d.getDate() + 14); break;
        case 'monthly': d.setMonth(d.getMonth() + 1); break;
        case 'quarterly': d.setMonth(d.getMonth() + 3); break;
        case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
        default: return null;
    }
    return d;
}

const DOW_TOKENS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * First moment matching an AI-composed schedule: a wall-clock time, optionally
 * restricted to certain weekdays.
 *
 * "Every morning" has to become an actual instant before it can be stored, and
 * the obvious reading is the next one that hasn't happened yet — asking for a
 * daily 08:00 job at 09:00 should start tomorrow, not fire immediately and
 * again in the morning. Computed in browser-local time, like the rest of this
 * module: that is the timezone the user is picking in.
 *
 * Returns null when there is no time to anchor to — the caller then falls back
 * to the normal "now" path.
 */
export function nextOccurrence(timeOfDay, daysOfWeek = null, { now = new Date() } = {}) {
    if (typeof timeOfDay !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(timeOfDay)) return null;
    const [hh, mm] = timeOfDay.split(':').map(Number);

    const allowed = Array.isArray(daysOfWeek) && daysOfWeek.length > 0
        ? new Set(daysOfWeek.map(d => String(d).toLowerCase().slice(0, 3)))
        : null;

    const candidate = new Date(now);
    candidate.setHours(hh, mm, 0, 0);
    // Look at today first, then the next seven days — enough to find any
    // weekday in the set, and to roll past a time that has already gone.
    for (let i = 0; i <= 7; i += 1) {
        const d = new Date(candidate);
        d.setDate(d.getDate() + i);
        if (d <= now) continue;
        if (allowed && !allowed.has(DOW_TOKENS[d.getDay()])) continue;
        return d;
    }
    return null;
}

/** "Today at 14:30" / "Tomorrow at 09:00" / "12 Sep at 09:00". */
export function describeMoment(value, { now = new Date() } = {}) {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === now.toDateString()) return `Today at ${time}`;
    if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${time}`;
    return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} at ${time}`;
}

/**
 * The one-line summary shown on the composer's When chip and in the confirm
 * toast: "Now", "Now, then every week", "Tomorrow at 09:00, every day".
 */
export function describeSchedule({ presetId, runAt, repeatInterval }, { now = new Date() } = {}) {
    const repeat = repeatInterval ? `, ${repeatLabel(repeatInterval).toLowerCase()}` : '';
    if (presetId === 'now') return `Now${repeat ? `, then ${repeatLabel(repeatInterval).toLowerCase()}` : ''}`;
    if (!runAt) return 'Pick a moment';
    return `${describeMoment(runAt, { now })}${repeat}`;
}

/**
 * Turn the composer state into the POST /api/cowork body.
 * Returns null when the schedule isn't resolvable yet (custom, no inputs).
 *
 * "Run now" on a repeating item schedules the *next* occurrence and asks the
 * server to fire the first run immediately (`startNow`), so the user gets a
 * result straight away without the series drifting an interval late.
 */
export function buildCoworkPayload({
    title, prompt, presetId, date, time, repeatInterval, modelTier, agentId,
    daysOfWeek = null, timeOfDay = null, enabledApps = null,
}, { now = new Date(), timezone } = {}) {
    const resolved = resolveWhen(presetId, { now, date, time });
    if (!resolved) return null;
    const startNow = presetId === 'now';
    const nextRun = startNow && repeatInterval
        ? advanceByRepeat(resolved, repeatInterval)
        : resolved;
    if (!nextRun) return null;
    const days = Array.isArray(daysOfWeek) && daysOfWeek.length > 0 ? daysOfWeek : null;
    return {
        title: String(title || '').trim(),
        prompt: String(prompt || '').trim(),
        nextRunAt: nextRun.toISOString(),
        repeatInterval: repeatInterval || null,
        modelTier: modelTier || 'auto',
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        ...(days ? { daysOfWeek: days } : {}),
        ...(timeOfDay ? { timeOfDay } : {}),
        ...(agentId ? { agentId } : {}),
        // Only sent once the user has actually touched the Apps picker. Absent
        // means "no per-item restriction" — the workspace-wide list decides,
        // which is what every cowork did before the picker existed.
        ...(Array.isArray(enabledApps) ? { enabledApps } : {}),
        ...(startNow ? { startNow: true } : {}),
    };
}

/**
 * Derive a title from the brief the user typed. The old editor made "Task
 * name" a separate required field, which is the main reason creating a prompt
 * task felt like paperwork — in Cowork the first line *is* the name.
 */
export function titleFromBrief(text, { maxLength = 60 } = {}) {
    const firstLine = String(text || '')
        .trim()
        .split('\n')
        .map(l => l.trim())
        .find(Boolean) || '';
    // Strip leading markdown/list noise so "- Send the weekly digest" reads well.
    const cleaned = firstLine.replace(/^[-*#>\s]+/, '').trim();
    if (!cleaned) return 'Untitled cowork';
    if (cleaned.length <= maxLength) return cleaned;
    const cut = cleaned.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}
