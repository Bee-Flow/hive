/**
 * Derive the clickable moments shown on the player timeline.
 *
 * The meeting already knows where its interesting bits are — every action item
 * carries the timestamp it was discussed at. This turns that latent data into
 * navigation: instead of scrubbing a 100-minute recording hunting for the bit
 * where someone committed to something, you click the mark.
 *
 * Pure and separate from the component so the awkward parts — bad timestamps,
 * markers past the end of the audio, two items landing on the same second —
 * are testable without a canvas or an <audio> element.
 */

/** Marks closer together than this would overlap into an unclickable smear. */
const MIN_SEPARATION_FRACTION = 0.006;

/**
 * `MM:SS` / `HH:MM:SS` → seconds, or null when it isn't a timestamp at all.
 *
 * Deliberately not `parseTimestampToSeconds` from ./format: that one answers 0
 * for junk, which is indistinguishable from a genuine moment at 0:00 and would
 * plant a phantom marker at the very start of the recording. Here the caller
 * needs to tell "couldn't read it" from "it's at the beginning", so unparseable
 * input has to be its own answer.
 *
 * Exported: playerData.js applies the same honesty rule to chapter timestamps.
 */
export function toSeconds(stamp) {
    if (typeof stamp === 'number') return Number.isFinite(stamp) ? stamp : null;
    if (typeof stamp !== 'string') return null;

    const parts = stamp.trim().split(':');
    if (parts.length < 2 || parts.length > 3) return null;

    const nums = parts.map((p) => (p.trim() === '' ? NaN : Number(p)));
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;

    return nums.length === 3
        ? nums[0] * 3600 + nums[1] * 60 + nums[2]
        : nums[0] * 60 + nums[1];
}

/**
 * @param {Array<{id?: string, text?: string, assignee?: string, timestamp?: string, done?: boolean}>} actionItems
 * @param {number} durationSeconds
 * @returns {Array<{id: string, seconds: number, fraction: number, label: string, assignee: string, done: boolean, count: number}>}
 *          Chronological, de-clustered markers. Empty when nothing is placeable.
 */
export function buildTimelineMarkers(actionItems, durationSeconds) {
    const duration = Number(durationSeconds) || 0;
    if (!duration || !Array.isArray(actionItems)) return [];

    const placed = actionItems
        .map((item) => toMarker(item, duration))
        .filter(Boolean)
        .sort((a, b) => a.seconds - b.seconds);

    return collapseNearby(placed);
}

/** One moment → a marker, or null when it can't be placed honestly. */
function toMarker(item, duration) {
    if (!item) return null;
    const seconds = toSeconds(item.timestamp);
    // Drop anything unreadable or past the end of the audio rather than pinning
    // it to 0:00, where it would masquerade as a real moment.
    if (seconds === null || seconds > duration) return null;

    return {
        id: item.id || `t-${seconds}`,
        seconds,
        fraction: seconds / duration,
        label: (item.text || '').trim() || 'Action item',
        assignee: item.assignee || '',
        done: !!item.done,
        // Decisions and questions have no notion of "done". Without this the
        // AND-rule below would read their implicit `false` as "not finished"
        // and un-complete a checked action item that happens to sit within
        // ~22s of one.
        completable: 'done' in item,
        count: 1,
    };
}

/**
 * The viewer's private "my mentions" pins — moments someone ELSE spoke their
 * name (lib/insightsData.js findNameMentions). Same marker contract as the
 * action-item rail, clustered only among themselves so a mention never merges
 * into an action-item pin. Computed per viewer at render time; never persisted.
 *
 * @param {Array<{seconds: number, speakerId: string, text: string}>} mentions
 * @param {number} durationSeconds
 */
export function buildMentionMarkers(mentions, durationSeconds) {
    const duration = Number(durationSeconds) || 0;
    if (!duration || !Array.isArray(mentions)) return [];

    const placed = mentions
        .filter((m) => m && Number.isFinite(m.seconds) && m.seconds >= 0 && m.seconds <= duration)
        .map((m) => ({
            id: `mention-${m.seconds}`,
            seconds: m.seconds,
            fraction: m.seconds / duration,
            label: (m.text || '').trim(),
            assignee: m.speakerId || '',
            done: false,
            count: 1,
        }))
        .sort((a, b) => a.seconds - b.seconds);

    return collapseNearby(placed);
}

/**
 * Merge marks that would land on top of each other.
 *
 * Several action items commonly come out of a single exchange. Drawn
 * separately they overlap into a blob that can't be clicked, and each one
 * seeks to the same second anyway.
 */
function collapseNearby(placed) {
    const merged = [];
    for (const marker of placed) {
        const last = merged[merged.length - 1];
        if (last && marker.fraction - last.fraction < MIN_SEPARATION_FRACTION) {
            last.count += 1;
            last.label = `${last.label} · ${marker.label}`;
            // A cluster is only "done" when every COMPLETABLE thing in it is;
            // decisions and questions ride along without a say.
            if (marker.completable) {
                last.done = last.completable ? (last.done && marker.done) : marker.done;
                last.completable = true;
            }
        } else {
            merged.push({ ...marker });
        }
    }
    return merged;
}
