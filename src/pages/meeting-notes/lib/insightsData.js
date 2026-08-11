import { mergeTurns, fuseSpans, segmentSpeakerId } from './playerData';

/**
 * Pure derivations for the meeting Insights panel — no DOM, fully testable.
 *
 * Everything here is computed from data the detail endpoint already returns
 * (segments / speakers / duration / normalized chapters); nothing is persisted
 * and nothing needs the pipeline. Per-person numbers are shown under the
 * "own stats first + org toggle" model — the ordering helpers live here so the
 * panel and any future surface rank identically.
 */

/** Turns shorter than this are conversational back-channel, not a monologue. */
const MONOLOGUE_FLAG_SECONDS = 90;

/** Speaker changes per minute that count as a fully interactive dialogue (score 10). */
const SWITCHES_PER_MINUTE_LIVELY = 3;

/**
 * Per-speaker talk statistics plus the meeting-level balance numbers.
 *
 * Speaking seconds prefer the stored `speakers[].speakingSeconds` (the same
 * source the legend shows) and fall back to summed merged turns for a speaker
 * missing from the roster, mirroring buildSpeakerRows.
 *
 * @param {Array<{speaker?: string, speakerId?: string, start: number, end: number}>} segments
 * @param {Array<{id: string, speakingSeconds?: number, summary?: string}>} speakers
 * @param {number} durationSeconds
 * @returns {null | {
 *   speakers: Array<{speakerId: string, speakingSeconds: number, share: number,
 *                    turnCount: number, summary?: string,
 *                    longestMonologue: null | {start: number, end: number, seconds: number, flagged: boolean}}>,
 *   totalSpeakingSeconds: number,
 *   silenceSeconds: number,
 *   topShare: number,
 *   balance: number,
 * }}
 */
export function buildTalkStats(segments, speakers, durationSeconds) {
    const duration = Number(durationSeconds) || 0;
    const turns = mergeTurns(segments);
    if (!duration || !turns.length) return null;

    const spansById = new Map();
    for (const t of turns) {
        if (!spansById.has(t.speakerId)) spansById.set(t.speakerId, []);
        spansById.get(t.speakerId).push({ start: t.start, end: t.end });
    }

    const roster = new Map();
    for (const s of speakers || []) {
        if (s && s.id != null) roster.set(s.id, s);
    }

    const perSpeaker = Array.from(spansById.entries()).map(([speakerId, spans]) => {
        const fused = fuseSpans(spans);
        const summed = Math.round(fused.reduce((acc, s) => acc + (s.end - s.start), 0));
        // Compare raw lengths, not raw-against-rounded: a 95.6s incumbent
        // rounds to 96 and would beat a genuinely longer 95.8s span.
        const longestSpan = fused.reduce(
            (best, s) => ((s.end - s.start) > (best ? best.end - best.start : 0) ? s : best),
            null,
        );
        const longest = longestSpan
            ? { start: longestSpan.start, end: longestSpan.end, seconds: Math.round(longestSpan.end - longestSpan.start) }
            : null;
        const rosterRow = roster.get(speakerId);
        const stat = {
            speakerId,
            speakingSeconds: rosterRow ? (Number(rosterRow.speakingSeconds) || 0) : summed,
            turnCount: fused.length,
            longestMonologue: longest
                ? { ...longest, flagged: longest.seconds >= MONOLOGUE_FLAG_SECONDS }
                : null,
        };
        // The AI-written "what this person contributed" prose, when the note has
        // one (generated in the pipeline, absent on older notes until Regenerate).
        const summary = String(rosterRow?.summary || '').trim();
        if (summary) stat.summary = summary;
        return stat;
    });

    const totalSpeakingSeconds = perSpeaker.reduce((acc, s) => acc + s.speakingSeconds, 0);
    const ranked = perSpeaker
        .map((s) => ({ ...s, share: totalSpeakingSeconds > 0 ? s.speakingSeconds / totalSpeakingSeconds : 0 }))
        .sort((a, b) => b.speakingSeconds - a.speakingSeconds);

    // Silence = recording time not covered by ANY speech span (spans can
    // overlap between speakers, so union — not duration minus the sum).
    const union = fuseSpans(turns.map((t) => ({ start: t.start, end: t.end })).sort((a, b) => a.start - b.start));
    // Clamp BOTH ends: a span lying entirely past `duration` (a stored duration
    // shorter than the segments claim) would otherwise contribute a negative
    // amount and inflate silence beyond the meeting length.
    const covered = union.reduce(
        (acc, s) => acc + Math.max(0, Math.min(s.end, duration) - Math.min(s.start, duration)),
        0,
    );
    const silenceSeconds = Math.max(0, Math.round(duration - covered));

    return {
        speakers: ranked,
        totalSpeakingSeconds,
        silenceSeconds,
        topShare: ranked[0].share,
        balance: balanceScore(ranked.map((s) => s.share)),
    };
}

/**
 * Normalized Shannon entropy of the talk-share distribution: 1 = perfectly
 * even, 0 = a single voice. Defined as 1 for a solo recording (a monologue
 * can't be "unbalanced" — there was nobody to crowd out).
 */
function balanceScore(shares) {
    const active = shares.filter((p) => p > 0);
    if (active.length <= 1) return 1;
    const entropy = -active.reduce((acc, p) => acc + p * Math.log(p), 0);
    return entropy / Math.log(active.length);
}

/**
 * Meeting-level interactivity: how often the speaking turn changed hands.
 * Deliberately has NO per-person attribution, so it is shown even when the
 * org disables per-person stats.
 *
 * Score is 0–10 against a "lively dialogue" benchmark of
 * {@link SWITCHES_PER_MINUTE_LIVELY} speaker changes per minute; `windows`
 * gives switch counts per interval for the sparkline.
 *
 * @param {Array} segments
 * @param {number} durationSeconds
 * @param {{windowSeconds?: number}} [opts]
 * @returns {null | {score: number, switches: number, switchesPerMinute: number,
 *                   windows: Array<{start: number, switches: number}>}}
 */
export function buildInteractivity(segments, durationSeconds, { windowSeconds = 300 } = {}) {
    const duration = Number(durationSeconds) || 0;
    const turns = mergeTurns(segments);
    if (!duration || turns.length < 2) return null;

    const windows = [];
    for (let start = 0; start < duration; start += windowSeconds) {
        windows.push({ start, switches: 0 });
    }

    let switches = 0;
    for (let i = 1; i < turns.length; i++) {
        if (turns[i].speakerId === turns[i - 1].speakerId) continue;
        switches += 1;
        const w = windows[Math.min(windows.length - 1, Math.floor(turns[i].start / windowSeconds))];
        if (w) w.switches += 1;
    }

    const switchesPerMinute = switches / (duration / 60);
    return {
        score: Math.min(10, Math.round((switchesPerMinute / SWITCHES_PER_MINUTE_LIVELY) * 10)),
        switches,
        switchesPerMinute,
        windows,
    };
}

/**
 * Chapters ranked by how much of the meeting they took — the "top topics by
 * time" list next to the stacked bar (the bar itself renders the chronological
 * normalizeChapters output directly; widthFraction IS the time share).
 *
 * @param {Array<{title: string, seconds: number, widthFraction: number}>} normalizedChapters
 * @param {number} [count]
 */
export function topTopics(normalizedChapters, count = 3) {
    return (Array.isArray(normalizedChapters) ? normalizedChapters : [])
        .slice()
        .sort((a, b) => b.widthFraction - a.widthFraction)
        .slice(0, count)
        .map((c) => ({ title: c.title, seconds: c.seconds, share: c.widthFraction }));
}

/**
 * The speaker id (display name) that most plausibly IS the viewing user, or
 * null. Exact full-name match wins over a first-name match; ties resolve to
 * null rather than guessing between two "Tom"s. Used to float the viewer's
 * own stats to the top — a wrong match would silently show someone ELSE's
 * numbers as "you", hence the conservative rules.
 *
 * @param {Array<{id: string}>} speakers
 * @param {string} viewerName
 * @returns {string|null}
 */
export function matchViewerSpeaker(speakers, viewerName) {
    const viewer = normalizeName(viewerName);
    if (!viewer) return null;
    const ids = (Array.isArray(speakers) ? speakers : [])
        .filter((s) => s && s.id != null)
        .map((s) => String(s.id));

    const exact = ids.filter((id) => normalizeName(id) === viewer);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return null;

    const viewerFirst = viewer.split(' ')[0];
    if (viewerFirst.length < 2) return null;
    const byFirst = ids.filter((id) => normalizeName(id).split(' ')[0] === viewerFirst);
    return byFirst.length === 1 ? byFirst[0] : null;
}

function normalizeName(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Moments where the viewer's name was spoken by someone else — the private
 * "my mentions" markers. Matches the full display name and the first name
 * (≥3 chars, so initials and particles don't light up every segment) on
 * Unicode word boundaries. The viewer's own segments are skipped: "ik ben Tom"
 * is an introduction, not a mention worth jumping to.
 *
 * Computed per viewer at render time and never persisted or shared — keep it
 * that way; a persisted variant becomes a colleague-mention index.
 *
 * @param {Array} segments
 * @param {string} viewerName
 * @returns {Array<{seconds: number, speakerId: string, text: string}>}
 */
export function findNameMentions(segments, viewerName) {
    const full = String(viewerName || '').trim();
    if (!full || !Array.isArray(segments)) return [];

    const first = full.split(/\s+/)[0];
    // The full name is distinctive enough to match case-insensitively. A bare
    // first name is not: "Wil", "Mark", "Roos" and "Will" are ordinary words in
    // Dutch and English, and a case-insensitive match lights up the rail on
    // every "ik wil dat even oppakken". Requiring the transcript's own
    // capitalisation keeps the name and the word apart.
    const patterns = [new RegExp(`(^|[^\\p{L}])(${escapeRegExp(full)})([^\\p{L}]|$)`, 'iu')];
    if (first.length >= 3 && first.toLowerCase() !== full.toLowerCase()) {
        patterns.push(new RegExp(`(^|[^\\p{L}])(${escapeRegExp(capitalize(first))})([^\\p{L}]|$)`, 'u'));
    }

    const viewerNorm = normalizeName(full);
    const viewerFirst = normalizeName(first);
    const mentions = [];
    for (const seg of segments) {
        if (!seg || typeof seg.text !== 'string') continue;
        const speaker = normalizeName(segmentSpeakerId(seg));
        if (speaker === viewerNorm || speaker.split(' ')[0] === viewerFirst) continue;
        if (!patterns.some((p) => p.test(seg.text))) continue;
        const seconds = Number(seg.start);
        if (!Number.isFinite(seconds) || seconds < 0) continue;
        mentions.push({ seconds, speakerId: segmentSpeakerId(seg), text: String(seg.text) });
    }
    return mentions;
}

function capitalize(value) {
    const s = String(value);
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
