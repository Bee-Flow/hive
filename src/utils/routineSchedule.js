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

export function computeRoutineNextRun(routine, tz) {
    const now = new Date();
    const TZ = tz || routine?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    if (routine?.repeatInterval === 'hourly') {
        // Hourly cadence is TZ-independent — just the next round hour from now.
        const next = new Date(now);
        next.setHours(next.getHours() + 1, 0, 0, 0);
        return next.toISOString();
    }

    const [hh, mm] = String(routine?.timeOfDay || '08:00').split(':').map(n => parseInt(n, 10) || 0);

    if (routine?.repeatInterval === 'monthly') {
        const parts = getTzParts(now, TZ);
        const dayOfMonth = Math.max(1, Math.min(28, Number(routine?.dayOfMonth) || parts.day));
        let target = wallClockToUtc(parts.year, parts.month, dayOfMonth, hh, mm, TZ);
        if (target <= now) {
            const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
            const nextYear = parts.month === 12 ? parts.year + 1 : parts.year;
            target = wallClockToUtc(nextYear, nextMonth, dayOfMonth, hh, mm, TZ);
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
    if (allowedDays) {
        for (let i = 0; i < 7; i += 1) {
            const tParts = getTzParts(target, TZ);
            if (allowedDays.has(tParts.weekday)) break;
            target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
        }
    }
    return target.toISOString();
}
