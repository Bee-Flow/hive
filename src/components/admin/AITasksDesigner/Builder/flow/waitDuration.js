/**
 * The Wait step's one duration vocabulary.
 *
 * The editor has offered seconds / minutes / hours for a while, but the canvas
 * card printed the stored value raw — so a Wait the user set to "2 hours" read
 * "7200s" on the node. Two surfaces describing the same field in two different
 * units, one of them in a unit the user never chose.
 *
 * `seconds` stays the stored form; everything here is display and parsing.
 */

export const WAIT_MIN_SECONDS = 1;
export const WAIT_MAX_SECONDS = 86400; // 24h — see engine.js execWait
export const WAIT_UNIT_FACTOR = { seconds: 1, minutes: 60, hours: 3600 };

export const clampWaitSeconds = (n) => Math.max(WAIT_MIN_SECONDS, Math.min(WAIT_MAX_SECONDS, Math.round(n)));

/** The largest unit that divides `seconds` exactly — how the editor opens. */
export function waitUnitFor(seconds) {
    if (seconds >= 3600 && seconds % 3600 === 0) return 'hours';
    if (seconds >= 60 && seconds % 60 === 0) return 'minutes';
    return 'seconds';
}

const PLURAL = { seconds: 'second', minutes: 'minute', hours: 'hour' };

/**
 * "2 hours", "90 seconds", "1 minute" — the phrase the canvas shows, in the
 * same unit the editor would open on, so the two never disagree.
 */
export function formatWaitDuration(seconds) {
    const s = Number(seconds);
    if (!Number.isFinite(s) || s <= 0) return null;
    const unit = waitUnitFor(s);
    const n = s / WAIT_UNIT_FACTOR[unit];
    // A value that divides exactly is shown whole; anything else (a hand-edited
    // 5400) falls back to seconds rather than inventing "1.5 hours".
    if (!Number.isInteger(n)) return `${s} second${s === 1 ? '' : 's'}`;
    return `${n} ${PLURAL[unit]}${n === 1 ? '' : 's'}`;
}
