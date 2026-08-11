import { toSeconds } from './timelineMarkers';
import { SPEAKER_COLORS, NEUTRAL_SPEAKER_COLOR } from '../../../config/meetingNotesConfig';

/**
 * Pure derivations for the layered meeting player — no DOM, fully testable.
 *
 * Four questions the timeline answers that the raw data doesn't directly:
 *   - buildSpeakerRows:     "who spoke when?" (one labeled row per speaker,
 *     ranked by speaking time; overflow speakers collapse into one grey row)
 *   - buildSpeakerColorMap: "which color is this person?" (rank-based — the
 *     ONE assignment every surface shares: rows, legend, transcript, tooltip)
 *   - segmentAtTime:        "what's being said right here?" (the hover preview)
 *   - normalizeChapters:    "what were the topics?" (the chapter strip), applied
 *     to raw LLM output that must be validated, never trusted
 */

/** Below this fraction of the timeline a block is sub-pixel noise. */
const MIN_LANE_FRACTION = 0.0015;

/** A rapid 1:40h exchange can merge into thousands of turns; past this many
 * blocks in one row everything is sub-pixel anyway (the waveform itself only
 * has 600 bins). Widest blocks win, order stays chronological. */
const MAX_ROW_BLOCKS = 200;

/**
 * The identity of a segment's speaker. Backend segments carry `speaker`
 * and/or `speakerId`, and the backend's no-speaker fallback is capital-U
 * 'Unknown' — this is the single place that answers the question, so the
 * transcript, rows and tooltip can never disagree again.
 */
export function segmentSpeakerId(seg) {
    return (seg && (seg.speaker || seg.speakerId)) || 'Unknown';
}

/**
 * Segments → chronological speaker turns, merging consecutive same-speaker
 * segments and bridging the diarizer's hairline gaps (≤1s) so one monologue
 * doesn't render as dozens of blocks. Junk segments are skipped.
 *
 * Exported as the ONE turn definition shared by the timeline rows and the
 * insights math (longest monologue, interactivity) — if these ever diverge,
 * the panel contradicts what the timeline shows.
 */
export function mergeTurns(segments) {
    const turns = [];
    for (const seg of segments || []) {
        if (!seg) continue;
        const speakerId = seg.speaker || seg.speakerId;
        const start = Number(seg.start);
        const end = Number(seg.end);
        if (!speakerId || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

        const last = turns[turns.length - 1];
        if (last && last.speakerId === speakerId && start <= last.end + 1) {
            last.end = Math.max(last.end, end);
        } else {
            turns.push({ speakerId, start: Math.max(0, start), end });
        }
    }
    return turns;
}

/** Merge chronological {start,end} spans whose gap is ≤1s. */
export function fuseSpans(spans) {
    const fused = [];
    for (const s of spans) {
        const last = fused[fused.length - 1];
        if (last && s.start <= last.end + 1) last.end = Math.max(last.end, s.end);
        else fused.push({ start: s.start, end: s.end });
    }
    return fused;
}

/**
 * Segments → per-speaker timeline rows (the Fireflies-style view).
 *
 * All speakers come back ranked by speaking time — the component slices
 * `rows.slice(0, maxRows)` for the collapsed view, so expand/collapse never
 * recomputes anything. Speakers past `maxRows` are ALSO aggregated into one
 * `others` pseudo-row (their turns fused chronologically, so adjacent
 * minor-speaker chatter reads as one grey stretch).
 *
 * Ranking uses `speakers[].speakingSeconds` when available (`speakers` is NOT
 * sorted by the backend), falling back to the summed block time for a speaker
 * missing from the roster. Ties break on first appearance in the recording —
 * stable across renames.
 *
 * @param {Array<{speaker?: string, speakerId?: string, start: number, end: number}>} segments
 * @param {Array<{id: string, speakingSeconds?: number}>} speakers
 * @param {number} durationSeconds
 * @param {{maxRows?: number}} [opts]
 * @returns {{
 *   rows: Array<{speakerId: string, rank: number, speakingSeconds: number,
 *                blocks: Array<{start: number, end: number, fraction: number, widthFraction: number}>}>,
 *   others: null | {count: number, speakerIds: string[], blocks: Array},
 * }}
 */
export function buildSpeakerRows(segments, speakers, durationSeconds, { maxRows = 6 } = {}) {
    const duration = Number(durationSeconds) || 0;
    if (!duration || !Array.isArray(segments) || !segments.length) return { rows: [], others: null };

    const turns = mergeTurns(segments);
    if (!turns.length) return { rows: [], others: null };

    // Per-speaker spans; a >1s interjection by someone else doesn't fuse the
    // interrupted speaker's turns because their own gap stays >1s.
    const bySpeaker = new Map();
    const firstAppearance = new Map();
    turns.forEach((t, i) => {
        if (!bySpeaker.has(t.speakerId)) {
            bySpeaker.set(t.speakerId, []);
            firstAppearance.set(t.speakerId, i);
        }
        bySpeaker.get(t.speakerId).push({ start: t.start, end: t.end });
    });

    const speakingSecondsById = new Map();
    for (const s of speakers || []) {
        if (s && s.id != null) speakingSecondsById.set(s.id, Number(s.speakingSeconds) || 0);
    }

    const toBlocks = (spans) => spans
        .map((b) => ({
            start: b.start,
            end: b.end,
            fraction: Math.min(1, b.start / duration),
            widthFraction: Math.min(1, (Math.min(b.end, duration) - b.start) / duration),
        }))
        .filter((b) => b.widthFraction >= MIN_LANE_FRACTION);

    const capBlocks = (blocks) => (blocks.length <= MAX_ROW_BLOCKS
        ? blocks
        : [...blocks]
            .sort((a, b) => b.widthFraction - a.widthFraction)
            .slice(0, MAX_ROW_BLOCKS)
            .sort((a, b) => a.start - b.start));

    const rows = Array.from(bySpeaker.entries())
        .map(([speakerId, spans]) => {
            const fused = fuseSpans(spans);
            return {
                speakerId,
                speakingSeconds: speakingSecondsById.has(speakerId)
                    ? speakingSecondsById.get(speakerId)
                    : Math.round(fused.reduce((acc, s) => acc + (s.end - s.start), 0)),
                blocks: capBlocks(toBlocks(fused)),
            };
        })
        .filter((r) => r.blocks.length > 0)
        .sort((a, b) => (b.speakingSeconds - a.speakingSeconds)
            || (firstAppearance.get(a.speakerId) - firstAppearance.get(b.speakerId)))
        .map((r, rank) => ({ ...r, rank }));

    if (rows.length <= maxRows) return { rows, others: null };

    const overflow = rows.slice(maxRows);
    const overflowIds = new Set(overflow.map((r) => r.speakerId));
    const overflowSpans = fuseSpans(turns.filter((t) => overflowIds.has(t.speakerId)));

    return {
        rows,
        others: {
            count: overflow.length,
            speakerIds: overflow.map((r) => r.speakerId),
            blocks: capBlocks(toBlocks(overflowSpans)),
        },
    };
}

/**
 * One color per speaker, assigned by speaking-time RANK — not by hashing the
 * name. Hashing guaranteed collisions from 11 speakers on (and could collide
 * with 2), and repainted a speaker whenever they were renamed. Rank-order is
 * collision-free for the top of the roster and survives renames (a rename
 * doesn't change how long someone spoke).
 *
 * Ranks past the palette share one NEUTRAL color on purpose: cycling the
 * palette would reintroduce exactly the ambiguity this map removes, and
 * "grey = minor speaker" matches the grey aggregate row on the timeline.
 *
 * @param {Array<{id: string, speakingSeconds?: number}>} speakers
 * @param {readonly string[]} [palette]
 * @returns {Record<string, string>}
 */
export function buildSpeakerColorMap(speakers, palette = SPEAKER_COLORS) {
    const map = {};
    (Array.isArray(speakers) ? speakers : [])
        .filter((s) => s && s.id != null)
        .map((s, order) => ({ id: s.id, speakingSeconds: Number(s.speakingSeconds) || 0, order }))
        .sort((a, b) => (b.speakingSeconds - a.speakingSeconds) || (a.order - b.order))
        .forEach((s, rank) => {
            map[s.id] = rank < palette.length ? palette[rank] : NEUTRAL_SPEAKER_COLOR;
        });
    return map;
}

/** Color for a speaker id; unknown ids (incl. 'Unknown') get the neutral. */
export function speakerColor(map, id) {
    return (map && id != null && map[id]) || NEUTRAL_SPEAKER_COLOR;
}

/**
 * The segment playing at `seconds`, or null in a silence/gap.
 *
 * Binary search — segments are chronological and this runs on every mousemove
 * while hovering the scrubber of a possibly multi-thousand-segment meeting.
 */
export function segmentAtTime(segments, seconds) {
    if (!Array.isArray(segments) || !segments.length || !Number.isFinite(seconds)) return null;

    let lo = 0;
    let hi = segments.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const seg = segments[mid];
        const start = Number(seg?.start) || 0;
        const end = Number(seg?.end) || 0;
        if (seconds < start) hi = mid - 1;
        else if (seconds >= end) lo = mid + 1;
        else return seg;
    }
    return null;
}

/**
 * Like segmentAtTime, but tolerant and optionally speaker-filtered — for the
 * hover previews. The timeline blocks bridge the diarizer's hairline gaps
 * (≤1s), so an exact containment lookup comes back empty exactly where the
 * cursor visually sits ON a block, and the chip loses its name/text. This
 * returns the nearest segment within `tolerance` seconds instead (containment
 * wins with distance 0); with `speakerId` set, only that speaker's segments
 * count — hovering Pim's row answers what PIM said there.
 *
 * @param {Array} segments  Chronological segments.
 * @param {number} seconds
 * @param {{speakerId?: string|null, tolerance?: number}} [opts]
 * @returns {object|null}
 */
export function segmentNearTime(segments, seconds, { speakerId = null, tolerance = 1.5 } = {}) {
    if (!Array.isArray(segments) || !segments.length || !Number.isFinite(seconds)) return null;

    // Lower bound: first segment whose end is past the left edge of the window.
    const windowStart = seconds - tolerance;
    let lo = 0;
    let hi = segments.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (segClock(segments[mid], 'end') <= windowStart) lo = mid + 1;
        else hi = mid;
    }

    return scanNearest(segments, lo, seconds, speakerId, tolerance);
}

function scanNearest(segments, from, seconds, speakerId, tolerance) {
    let best = null;
    let bestDist = tolerance + 1;
    for (let i = from; i < segments.length; i++) {
        const seg = segments[i];
        if (segClock(seg, 'start') >= seconds + tolerance) break; // later segments only get further away
        if (speakerId && segmentSpeakerId(seg) !== speakerId) continue;
        const dist = segDistance(seg, seconds);
        if (dist > tolerance || dist >= bestDist) continue;
        best = seg;
        bestDist = dist;
        if (dist === 0) break;
    }
    return best;
}

function segClock(seg, key) {
    return Number(seg ? seg[key] : 0) || 0;
}

/** 0 when `seconds` falls inside the segment, else distance to its nearest edge. */
function segDistance(seg, seconds) {
    const start = segClock(seg, 'start');
    const end = segClock(seg, 'end');
    if (seconds >= start && seconds < end) return 0;
    return Math.min(Math.abs(start - seconds), Math.abs(end - seconds));
}

/**
 * Raw stored chapters → renderable blocks. This is the validation boundary for
 * LLM output: unreadable or out-of-range timestamps are dropped, not pinned to
 * 0:00 (the phantom-marker rule), order is enforced, and each block's `end` is
 * the next one's start so the strip always tiles the full recording.
 *
 * @param {Array<{title?: string, start?: string, summary?: string}>} chapters
 * @param {number} durationSeconds
 * @returns {Array<{title: string, seconds: number, endSeconds: number, fraction: number, widthFraction: number, summary: string|null}>}
 */
export function normalizeChapters(chapters, durationSeconds) {
    const duration = Number(durationSeconds) || 0;
    if (!duration || !Array.isArray(chapters)) return [];

    const placed = chapters
        .map((c) => {
            if (!c) return null;
            const seconds = toSeconds(c.start);
            const title = String(c.title || '').trim();
            if (seconds === null || seconds >= duration || !title) return null;
            // `summary` is optional (older notes lack it) — carried through for
            // the chapter hover tooltip; null when absent.
            return { title, seconds, summary: String(c.summary || '').trim() || null };
        })
        .filter(Boolean)
        .sort((a, b) => a.seconds - b.seconds)
        // Two chapters claiming the same start would render a zero-width block.
        .filter((c, i, arr) => i === 0 || c.seconds > arr[i - 1].seconds);

    // A lone chapter covering everything tells the user nothing.
    if (placed.length < 2) return [];

    return placed.map((c, i) => {
        const endSeconds = i + 1 < placed.length ? placed[i + 1].seconds : duration;
        return {
            title: c.title,
            seconds: c.seconds,
            endSeconds,
            fraction: c.seconds / duration,
            widthFraction: (endSeconds - c.seconds) / duration,
            summary: c.summary,
        };
    });
}
