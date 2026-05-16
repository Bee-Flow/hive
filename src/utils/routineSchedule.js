// Compute the next-run ISO timestamp for an agent routine, anchored to a
// target IANA timezone. Used by the wizard chat (auto-create from chat),
// the new-routine modal, and the backend wizard/commit path so all three
// produce identical schedules — previously each had its own local-TZ math
// and disagreed when the user's browser TZ differed from the routine TZ.
//
// `routine` shape:
//   { repeatInterval: 'hourly'|'daily'|'weekdays'|'weekly'|'biweekly'|'monthly',
//     daysOfWeek: ['mon','tue',...] | null,
//     timeOfDay: 'HH:MM' | null,
//     dayOfMonth: number | null   // monthly mode; defaults to today's day
//   }

const DOW_TOKENS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function getTzParts(date, tz) {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, weekday: 'short',
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
    // Node ≤16 / older ICU builds occasionally returned hour='24' at midnight
    // when hourCycle wasn't pinned. We pin hour12:false above, so modern
    // runtimes return 00-23, but the normalization is cheap insurance.
    return {
        year: parseInt(parts.year, 10),
        month: parseInt(parts.month, 10),
        day: parseInt(parts.day, 10),
        hour: parts.hour === '24' ? 0 : parseInt(parts.hour, 10),
        minute: parseInt(parts.minute, 10),
        weekday: String(parts.weekday || '').toLowerCase().slice(0, 3),
    };
}

// Convert a wall-clock moment (year/month/day/hour/minute) IN the given tz to
// a real UTC Date. Two-step trick: construct as-if-UTC, read what that UTC
// instant looks like in the target tz, and shift by the resulting offset.
function wallClockToUtc(year, month, day, hour, minute, tz) {
    const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
    const inTz = getTzParts(new Date(utcGuess), tz);
    const inTzAsUtc = Date.UTC(inTz.year, inTz.month - 1, inTz.day, inTz.hour, inTz.minute, 0);
    const offsetMs = inTzAsUtc - utcGuess;
    return new Date(utcGuess - offsetMs);
}

// Parse 'HH:MM' into [hour, minute] clamped to valid ranges. Falls back to
// the supplied default when the input is missing or malformed (e.g. '9',
// 'noon', '25:99'). Default for daily/weekly/monthly is 08:00; hourly
// callers pass minute defaults explicitly.
function parseTimeOfDay(value, defaultHour, defaultMinute) {
    const [hStr, mStr] = String(value || '').split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const hour = Number.isFinite(h) && h >= 0 && h <= 23 ? h : defaultHour;
    const minute = Number.isFinite(m) && m >= 0 && m <= 59 ? m : defaultMinute;
    return [hour, minute];
}

// Build a wall-clock target for a given month, retrying the next month if
// the requested day doesn't exist (e.g. day 31 in Feb → skip to Mar 31).
// Caps at 12 forward steps so a corrupt input can never infinite-loop.
function targetForMonth(year, month, requestedDay, hh, mm, tz) {
    for (let i = 0; i < 12; i += 1) {
        const target = wallClockToUtc(year, month, requestedDay, hh, mm, tz);
        // If the requested day was rolled over by Date normalization (e.g.
        // Feb 30 → Mar 2), getTzParts(target).day !== requestedDay — try
        // the next month.
        const reflected = getTzParts(target, tz);
        if (reflected.day === requestedDay && reflected.month === month && reflected.year === year) {
            return target;
        }
        if (month === 12) { month = 1; year += 1; } else { month += 1; }
    }
    // Defensive: fall back to whatever month-1 wall clock produces.
    return wallClockToUtc(year, month, Math.min(requestedDay, 28), hh, mm, tz);
}

export function computeRoutineNextRun(routine, tz) {
    const now = new Date();
    const TZ = tz || routine?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    if (routine?.repeatInterval === 'hourly') {
        // Hourly cadence honors timeOfDay's MINUTES (the offset within the
        // hour), but ignores HOURS — the next fire is always the next time
        // the clock hits :MM. timeOfDay='09:30' fires at HH:30 every hour.
        const [, minute] = parseTimeOfDay(routine?.timeOfDay, 0, 0);
        const next = new Date(now);
        next.setSeconds(0, 0);
        next.setMinutes(minute);
        if (next <= now) next.setHours(next.getHours() + 1);
        return next.toISOString();
    }

    const [hh, mm] = parseTimeOfDay(routine?.timeOfDay, 8, 0);

    if (routine?.repeatInterval === 'monthly') {
        const parts = getTzParts(now, TZ);
        const requestedDay = Math.max(1, Math.min(31, Number(routine?.dayOfMonth) || parts.day));
        let target = targetForMonth(parts.year, parts.month, requestedDay, hh, mm, TZ);
        if (target <= now) {
            const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
            const nextYear = parts.month === 12 ? parts.year + 1 : parts.year;
            target = targetForMonth(nextYear, nextMonth, requestedDay, hh, mm, TZ);
        }
        return target.toISOString();
    }

    // Day-of-week modes (daily, weekly, biweekly, weekdays). The recurrence
    // length (every week vs. every two weeks) is enforced by aiTaskStore's
    // advanceNextRun on each fire — here we only need the FIRST upcoming
    // permitted day at HH:MM in the target TZ.
    let allowedDays = null;
    if (routine?.repeatInterval === 'weekdays') {
        allowedDays = new Set(['mon', 'tue', 'wed', 'thu', 'fri']);
    } else if (Array.isArray(routine?.daysOfWeek) && routine.daysOfWeek.length > 0) {
        allowedDays = new Set(routine.daysOfWeek);
    }

    // Start with today at HH:MM in the target TZ.
    const todayParts = getTzParts(now, TZ);
    let target = wallClockToUtc(todayParts.year, todayParts.month, todayParts.day, hh, mm, TZ);
    if (target <= now) {
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const tParts = getTzParts(tomorrow, TZ);
        target = wallClockToUtc(tParts.year, tParts.month, tParts.day, hh, mm, TZ);
    }
    if (allowedDays && allowedDays.size > 0) {
        let matched = false;
        for (let i = 0; i < 7; i += 1) {
            const tParts = getTzParts(target, TZ);
            if (allowedDays.has(tParts.weekday)) { matched = true; break; }
            target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
        }
        if (!matched && typeof console !== 'undefined') {
            // Corrupt daysOfWeek (e.g. ['xyz']) — log so it surfaces during dev.
            console.warn('[routineSchedule] No matching weekday found within 7 days', { allowedDays: [...allowedDays] });
        }
    }
    return target.toISOString();
}
