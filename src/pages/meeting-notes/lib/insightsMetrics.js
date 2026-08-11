import { formatSpeakerLabel } from './format';
import { buildInteractivity, buildTalkStats, topTopics } from './insightsData';
import { fuseSpans, mergeTurns, normalizeChapters, segmentSpeakerId } from './playerData';
import { toSeconds } from './timelineMarkers';

/**
 * Derivations for the tabbed Insights panel — everything beyond the original
 * talk-time/balance math in ./insightsData.js. Pure functions over the detail
 * payload; no DOM, no network, nothing persisted.
 *
 * PRIVACY: builders whose output names an individual are marked "per-person"
 * below. Callers should not hand-pick them — use {@link buildInsightsModel},
 * which OMITS those keys entirely when the org disables per-person stats, so a
 * rendering mistake cannot leak attribution that the model never built.
 */

/** Turns at or above this length count as a monologue (mirrors insightsData). */
const MONOLOGUE_SECONDS = 90;
/** Gaps in the speech union at least this long are listed as dead air. */
const DEAD_AIR_SECONDS = 20;
/** Below this much speech a words-per-minute figure is noise, so we hide it. */
const MIN_WPM_SPEAKING_SECONDS = 30;
/** Handoff pairs mean nothing until the conversation actually changed hands. */
const MIN_HANDOFF_SWITCHES = 4;
/** Assignee placeholders the summariser writes when nobody was named. */
const UNASSIGNED_LABELS = new Set(['niet toegewezen', 'unassigned', 'nobody', 'niemand', '']);

/**
 * Window length for the over-time charts: aim for ~12 buckets so a 20-minute
 * stand-up and a 2-hour workshop both get a readable shape, clamped to
 * whole-minute steps between 1 and 10 minutes.
 */
export function insightsWindowSeconds(durationSeconds) {
    const duration = Number(durationSeconds) || 0;
    if (!duration) return 300;
    const target = Math.round(duration / 12 / 60) * 60;
    return Math.max(60, Math.min(600, target || 60));
}

function normalizeName(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Words in a transcript line: whitespace-split, tokens without a letter or digit dropped. */
export function countWords(text) {
    if (typeof text !== 'string' || !text.trim()) return 0;
    return text.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * Per-speaker delivery metrics: pace, turn shape, questions asked and how long
 * they spent listening. PER-PERSON.
 *
 * `speakingSeconds` is taken from the talk stats (the roster-backed number the
 * legend shows) so every surface reports the same seconds; words come from the
 * segments, which is why `wpm` is null for a speaker with almost no speech.
 *
 * @param {Array} segments
 * @param {Array<{speakerId: string, speakingSeconds: number, turnCount: number}>} talkSpeakers
 * @param {number} durationSeconds
 * @returns {Map<string, {words: number, wpm: number|null, questionCount: number,
 *                        avgTurnSeconds: number, listeningSeconds: number}>}
 */
export function buildSpeakerMetrics(segments, talkSpeakers, durationSeconds) {
    const duration = Number(durationSeconds) || 0;
    const words = new Map();
    const questions = new Map();
    for (const seg of segments || []) {
        if (!seg || typeof seg.text !== 'string') continue;
        const id = segmentSpeakerId(seg);
        words.set(id, (words.get(id) || 0) + countWords(seg.text));
        if (seg.text.includes('?')) questions.set(id, (questions.get(id) || 0) + 1);
    }

    const out = new Map();
    for (const s of talkSpeakers || []) {
        const spoken = Number(s.speakingSeconds) || 0;
        const w = words.get(s.speakerId) || 0;
        out.set(s.speakerId, {
            words: w,
            wpm: spoken >= MIN_WPM_SPEAKING_SECONDS ? Math.round(w / (spoken / 60)) : null,
            questionCount: questions.get(s.speakerId) || 0,
            avgTurnSeconds: s.turnCount > 0 ? Math.round(spoken / s.turnCount) : 0,
            listeningSeconds: Math.max(0, Math.round(duration - spoken)),
        });
    }
    return out;
}

/**
 * Attendees on the invite who never got a turn. PER-PERSON.
 *
 * Name matching reuses the conservative rules from matchViewerSpeaker: an
 * exact normalized match, else a unique first-name match. Anything ambiguous
 * counts as PRESENT — wrongly telling someone they said nothing is worse than
 * omitting a genuinely silent attendee.
 *
 * @param {Array<string>} attendees
 * @param {Array<{speakerId: string}>} talkSpeakers
 * @returns {Array<string>} attendee names, original casing
 */
export function buildSilentAttendees(attendees, talkSpeakers) {
    const list = (Array.isArray(attendees) ? attendees : []).map((a) => String(a || '').trim()).filter(Boolean);
    if (!list.length) return [];
    const ids = (talkSpeakers || []).map((s) => normalizeName(s.speakerId)).filter(Boolean);
    if (!ids.length) return list;

    return list.filter((name) => {
        const norm = normalizeName(name);
        if (!norm) return false;
        if (ids.some((id) => id === norm)) return false;
        const first = norm.split(' ')[0];
        if (first.length < 2) return false;
        // Ambiguity (two speakers sharing a first name) counts as present.
        return !ids.some((id) => id.split(' ')[0] === first);
    });
}

/**
 * Share of each window's speech per speaker — "who dominated when".
 * PER-PERSON.
 *
 * The value is the share of the speech IN THAT WINDOW, not of the meeting, so
 * a quiet stretch still shows who held it. Windows with no speech are kept
 * (with an empty `shares`) so the x-axis stays linear in time.
 *
 * @returns {Array<{start: number, end: number, speechSeconds: number,
 *                  shares: Array<{speakerId: string, seconds: number, share: number}>}>}
 */
export function buildAirtimeWindows(segments, durationSeconds, { windowSeconds } = {}) {
    const duration = Number(durationSeconds) || 0;
    const turns = mergeTurns(segments);
    if (!duration || !turns.length) return [];
    const size = windowSeconds || insightsWindowSeconds(duration);

    const windows = [];
    for (let start = 0; start < duration; start += size) {
        windows.push({ start, end: Math.min(duration, start + size), byId: new Map() });
    }
    if (!windows.length) return [];

    for (const turn of turns) {
        const from = Math.max(0, Math.min(turn.start, duration));
        const to = Math.max(0, Math.min(turn.end, duration));
        if (to <= from) continue;
        const firstIdx = Math.min(windows.length - 1, Math.floor(from / size));
        for (let i = firstIdx; i < windows.length && windows[i].start < to; i++) {
            const overlap = Math.min(to, windows[i].end) - Math.max(from, windows[i].start);
            if (overlap <= 0) continue;
            windows[i].byId.set(turn.speakerId, (windows[i].byId.get(turn.speakerId) || 0) + overlap);
        }
    }

    return windows.map((w) => {
        const total = Array.from(w.byId.values()).reduce((acc, v) => acc + v, 0);
        const shares = Array.from(w.byId.entries())
            .map(([speakerId, seconds]) => ({ speakerId, seconds: Math.round(seconds), share: total > 0 ? seconds / total : 0 }))
            .sort((a, b) => b.seconds - a.seconds);
        return { start: w.start, end: w.end, speechSeconds: Math.round(total), shares };
    });
}

/**
 * Who tends to speak right after whom. PER-PERSON.
 *
 * Directed pairs over consecutive turns; same-speaker transitions can't occur
 * (mergeTurns already fused them). Returns [] below MIN_HANDOFF_SWITCHES so a
 * three-switch meeting doesn't get a "conversation partners" ranking.
 *
 * @returns {Array<{from: string, to: string, count: number}>}
 */
export function buildHandoffPairs(segments, { limit = 5 } = {}) {
    const turns = mergeTurns(segments);
    if (turns.length < 2) return [];
    // Nested map, NOT a joined string key. Speaker ids here are DISPLAY NAMES,
    // and the default label is "Spreker 1" / "Speaker 1" — so joining on a space
    // and splitting on the first one mangled essentially every meeting:
    // "Tom Kooy → Ans" came back as "Tom → Kooy", and "Spreker 1 → Spreker 2"
    // and "Spreker 1 → Spreker 3" both collapsed to "Spreker → Speaker 1",
    // colliding into two identical rows.
    const counts = new Map();
    let switches = 0;
    for (let i = 1; i < turns.length; i++) {
        const from = turns[i - 1].speakerId;
        const to = turns[i].speakerId;
        if (from === to) continue;
        switches += 1;
        if (!counts.has(from)) counts.set(from, new Map());
        const inner = counts.get(from);
        inner.set(to, (inner.get(to) || 0) + 1);
    }
    if (switches < MIN_HANDOFF_SWITCHES) return [];
    const pairs = [];
    for (const [from, inner] of counts) {
        for (const [to, count] of inner) pairs.push({ from, to, count });
    }
    return pairs
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}

/**
 * Stretches where nobody spoke. Meeting-level (a gap belongs to no one).
 *
 * Gaps come from the fused UNION of speech, so overlapping speakers can't
 * manufacture one. Lead-in and lead-out are included but tagged, because
 * "the first 4 minutes were setup" is worth seeing yet is not the same as the
 * room falling quiet mid-discussion.
 *
 * @returns {Array<{start: number, end: number, seconds: number, kind: 'lead_in'|'gap'|'lead_out'}>}
 */
export function buildDeadAir(segments, durationSeconds, { minSeconds = DEAD_AIR_SECONDS, limit = 5 } = {}) {
    const duration = Number(durationSeconds) || 0;
    const turns = mergeTurns(segments);
    if (!duration || !turns.length) return [];
    const union = fuseSpans(
        turns.map((t) => ({ start: Math.max(0, t.start), end: Math.min(t.end, duration) }))
            .filter((s) => s.end > s.start)
            .sort((a, b) => a.start - b.start),
    );
    if (!union.length) return [];

    const gaps = [];
    if (union[0].start >= minSeconds) {
        gaps.push({ start: 0, end: union[0].start, kind: 'lead_in' });
    }
    for (let i = 1; i < union.length; i++) {
        if (union[i].start - union[i - 1].end >= minSeconds) {
            gaps.push({ start: union[i - 1].end, end: union[i].start, kind: 'gap' });
        }
    }
    const lastEnd = union[union.length - 1].end;
    if (duration - lastEnd >= minSeconds) {
        gaps.push({ start: lastEnd, end: duration, kind: 'lead_out' });
    }

    return gaps
        .map((g) => ({ ...g, start: Math.round(g.start), end: Math.round(g.end), seconds: Math.round(g.end - g.start) }))
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, limit);
}

/**
 * How much of the speaking time went into long uninterrupted stretches.
 * Meeting-level: a ratio over all turns, naming nobody.
 *
 * @returns {null | {seconds: number, totalSeconds: number, ratio: number, count: number}}
 */
export function buildMonologueRatio(segments) {
    const turns = mergeTurns(segments);
    if (!turns.length) return null;
    let total = 0;
    let mono = 0;
    let count = 0;
    for (const t of turns) {
        const len = t.end - t.start;
        if (len <= 0) continue;
        total += len;
        if (len >= MONOLOGUE_SECONDS) { mono += len; count += 1; }
    }
    if (total <= 0) return null;
    return { seconds: Math.round(mono), totalSeconds: Math.round(total), ratio: mono / total, count };
}

/**
 * Per chapter: how long it ran, who spoke most inside it and who opened it.
 * The speaker fields are PER-PERSON; `blocks` without them is meeting-level.
 *
 * A turn straddling a boundary is split by overlap, so its seconds land in
 * whichever chapters it actually covered rather than in the one it started in.
 *
 * @param {Array} segments
 * @param {Array} normalizedChapters output of normalizeChapters
 * @returns {Array<{title, seconds, endSeconds, widthFraction, topSpeakerId: string|null,
 *                  topSpeakerShare: number, openedBy: string|null}>}
 */
export function buildTopicOwnership(segments, normalizedChapters) {
    const blocks = Array.isArray(normalizedChapters) ? normalizedChapters : [];
    if (!blocks.length) return [];
    const turns = mergeTurns(segments);

    return blocks.map((block) => {
        const byId = new Map();
        let opener = null;
        let openerStart = Infinity;
        for (const turn of turns) {
            const overlap = Math.min(turn.end, block.endSeconds) - Math.max(turn.start, block.seconds);
            if (overlap <= 0) continue;
            byId.set(turn.speakerId, (byId.get(turn.speakerId) || 0) + overlap);
            if (turn.start < openerStart) { openerStart = turn.start; opener = turn.speakerId; }
        }
        const total = Array.from(byId.values()).reduce((acc, v) => acc + v, 0);
        let topSpeakerId = null;
        let topSeconds = 0;
        for (const [id, secs] of byId.entries()) {
            if (secs > topSeconds) { topSeconds = secs; topSpeakerId = id; }
        }
        return {
            ...block,
            topSpeakerId,
            topSpeakerShare: total > 0 ? topSeconds / total : 0,
            openedBy: opener,
        };
    });
}

/**
 * How often each auto-generated tag is actually said, and where it first came
 * up. Meeting-level. Multi-word tags tolerate any whitespace between words;
 * matching is case-insensitive on Unicode word boundaries so "AI" doesn't fire
 * inside "email".
 *
 * @returns {Array<{tag: string, count: number, firstSeconds: number|null}>}
 */
export function buildTagMentions(tags, segments) {
    const list = (Array.isArray(tags) ? tags : []).map((t) => String(t || '').trim()).filter(Boolean);
    if (!list.length || !Array.isArray(segments)) return [];

    const patterns = list.map((tag) => ({
        tag,
        re: new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegExp(tag).replace(/\\?\s+/g, '\\s+')})(?=[^\\p{L}\\p{N}]|$)`, 'giu'),
        count: 0,
        firstSeconds: null,
    }));

    for (const seg of segments) {
        if (!seg || typeof seg.text !== 'string' || !seg.text) continue;
        const seconds = Number(seg.start);
        for (const p of patterns) {
            p.re.lastIndex = 0;
            const hits = seg.text.match(p.re);
            if (!hits) continue;
            p.count += hits.length;
            if (p.firstSeconds === null && Number.isFinite(seconds)) p.firstSeconds = Math.max(0, Math.round(seconds));
        }
    }

    return patterns
        .filter((p) => p.count > 0)
        .map(({ tag, count, firstSeconds }) => ({ tag, count, firstSeconds }))
        .sort((a, b) => b.count - a.count);
}

function isUnassigned(assignee) {
    return UNASSIGNED_LABELS.has(normalizeName(assignee));
}

/** Local-calendar day key, so "overdue" follows the user's date, not UTC. */
function localDayKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Follow-up health: what came out of the meeting and how much of it is
 * actionable. `byAssignee` is PER-PERSON; every other field is meeting-level.
 *
 * Overdue compares the stored YYYY-MM-DD against the viewer's local date as a
 * plain string — no Date parsing, so a note dated "today" can never read as
 * overdue because of a timezone offset.
 *
 * @returns {{total, open, done, unassigned, withDue, overdue, decisions,
 *            decisionsPerHour, openQuestions: Array<{id, text, seconds: number|null}>,
 *            byAssignee: Array<{assignee, total, open, overdue}>}}
 */
export function buildFollowUpStats(meeting, { now = new Date() } = {}) {
    const items = Array.isArray(meeting?.actionItems) ? meeting.actionItems.filter(Boolean) : [];
    const decisions = Array.isArray(meeting?.decisions) ? meeting.decisions.filter(Boolean) : [];
    const questions = Array.isArray(meeting?.questions) ? meeting.questions.filter(Boolean) : [];
    const duration = Number(meeting?.durationSeconds) || 0;
    const today = localDayKey(now);

    let open = 0;
    let unassigned = 0;
    let withDue = 0;
    let overdue = 0;
    const byAssignee = new Map();
    for (const item of items) {
        const isOpen = !item.done;
        if (isOpen) open += 1;
        if (isUnassigned(item.assignee)) unassigned += 1;
        const due = typeof item.due === 'string' ? item.due.trim() : '';
        const isOverdue = isOpen && !!due && !!today && due < today;
        if (due) withDue += 1;
        if (isOverdue) overdue += 1;

        if (!isUnassigned(item.assignee)) {
            const key = String(item.assignee).trim();
            const row = byAssignee.get(key) || { assignee: key, total: 0, open: 0, overdue: 0 };
            row.total += 1;
            if (isOpen) row.open += 1;
            if (isOverdue) row.overdue += 1;
            byAssignee.set(key, row);
        }
    }

    return {
        total: items.length,
        open,
        done: items.length - open,
        unassigned,
        withDue,
        overdue,
        decisions: decisions.length,
        decisionsPerHour: duration > 0 ? decisions.length / (duration / 3600) : 0,
        openQuestions: questions
            .filter((q) => q.open !== false)
            .map((q) => ({ id: q.id, text: String(q.text || ''), seconds: toSeconds(q.timestamp) })),
        byAssignee: Array.from(byAssignee.values()).sort((a, b) => b.total - a.total),
    };
}

/**
 * Which chapter each action item was raised in — "we agreed this while talking
 * about X". Meeting-level (counts only, no names).
 *
 * @returns {Array<{title: string, seconds: number, count: number}>}
 */
export function buildActionsPerTopic(actionItems, normalizedChapters) {
    const blocks = Array.isArray(normalizedChapters) ? normalizedChapters : [];
    if (!blocks.length) return [];
    const counts = blocks.map((b) => ({ title: b.title, seconds: b.seconds, count: 0 }));
    for (const item of (Array.isArray(actionItems) ? actionItems : [])) {
        const at = toSeconds(item?.timestamp);
        if (at === null) continue;
        const idx = blocks.findIndex((b) => at >= b.seconds && at < b.endSeconds);
        if (idx >= 0) counts[idx].count += 1;
    }
    return counts.filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
}

/**
 * The whole Insights model in one pass, with the per-person gate applied at
 * BUILD time: when `perPersonEnabled` is false the individual rows are never
 * constructed, so no rendering mistake downstream can leak attribution.
 *
 * @param {object} meeting detail payload
 * @param {{perPersonEnabled?: boolean, now?: Date}} [opts]
 * @returns {null | object} null when there is not enough speech for any insight
 */
export function buildInsightsModel(meeting, { perPersonEnabled = true, now = new Date() } = {}) {
    const duration = Number(meeting?.durationSeconds) || 0;
    const segments = meeting?.segments;
    const talk = buildTalkStats(segments, meeting?.speakers, duration);
    if (!talk) return null;

    const windowSeconds = insightsWindowSeconds(duration);
    const interactivity = buildInteractivity(segments, duration, { windowSeconds });
    const chapters = normalizeChapters(meeting?.chapters, duration);
    const followUp = buildFollowUpStats(meeting, { now });
    const ownership = buildTopicOwnership(segments, chapters);

    const model = {
        duration,
        talk,
        interactivity,
        perPersonEnabled,
        flow: {
            windowSeconds,
            monologue: buildMonologueRatio(segments),
            deadAir: buildDeadAir(segments, duration),
            airtime: perPersonEnabled ? buildAirtimeWindows(segments, duration, { windowSeconds }) : null,
            handoffs: perPersonEnabled ? buildHandoffPairs(segments) : null,
        },
        topics: {
            blocks: perPersonEnabled
                ? ownership
                // Strip attribution but keep the durations: "time per topic" is
                // a meeting-level fact and stays visible with the gate off.
                : ownership.map(({ topSpeakerId, openedBy, topSpeakerShare, ...rest }) => rest),
            top: topTopics(chapters, 3),
            tags: buildTagMentions(meeting?.tags, segments),
        },
        followUp: perPersonEnabled ? followUp : { ...followUp, byAssignee: null },
        actionsPerTopic: buildActionsPerTopic(meeting?.actionItems, chapters),
        people: null,
    };

    if (perPersonEnabled) {
        const metrics = buildSpeakerMetrics(segments, talk.speakers, duration);
        model.people = {
            rows: talk.speakers.map((s) => ({ ...s, ...(metrics.get(s.speakerId) || {}) })),
            silentAttendees: buildSilentAttendees(meeting?.attendees, talk.speakers),
        };
    }

    model.overview = buildOverviewHighlights(model);
    return model;
}

/**
 * The handful of numbers worth seeing without opening a tab. Reads only the
 * model, so anything the gate removed simply doesn't produce a highlight.
 *
 * @returns {Array<{id, label, value, detail?: string, seconds?: number}>}
 */
export function buildOverviewHighlights(model) {
    const out = [];
    const people = model.people?.rows || [];

    const longest = people.reduce(
        (best, s) => (s.longestMonologue && (!best || s.longestMonologue.seconds > best.longestMonologue.seconds) ? s : best),
        null,
    );
    if (longest) {
        out.push({
            id: 'longest_monologue',
            label: 'Longest monologue',
            value: longest.longestMonologue.seconds,
            kind: 'duration',
            detail: formatSpeakerLabel(longest.speakerId),
            seconds: longest.longestMonologue.start,
        });
    }

    const asker = people.reduce((best, s) => ((s.questionCount || 0) > (best?.questionCount || 0) ? s : best), null);
    if (asker && asker.questionCount > 0) {
        out.push({
            id: 'most_questions',
            label: 'Most questions asked',
            value: asker.questionCount,
            kind: 'count',
            detail: formatSpeakerLabel(asker.speakerId),
        });
    }

    const biggest = model.topics.top[0];
    if (biggest) {
        out.push({
            id: 'biggest_topic',
            label: 'Biggest topic',
            value: Math.round(biggest.share * 100),
            kind: 'percent',
            detail: biggest.title,
            seconds: biggest.seconds,
        });
    }

    if (model.followUp.total > 0) {
        out.push({
            id: 'open_actions',
            label: 'Open action items',
            value: model.followUp.open,
            kind: 'count',
            detail: model.followUp.unassigned > 0 ? `${model.followUp.unassigned} unassigned` : undefined,
        });
    }

    const activeSpeakers = model.talk.speakers.length;
    out.push({
        id: 'participants',
        label: 'People who spoke',
        value: activeSpeakers,
        kind: 'count',
        detail: model.people?.silentAttendees?.length
            ? `${model.people.silentAttendees.length} silent`
            : undefined,
    });

    // Attention spent: everyone in the room was in it for the whole recording.
    out.push({
        id: 'attention',
        label: 'Attention spent',
        value: (model.duration * activeSpeakers) / 3600,
        kind: 'hours',
        detail: `${activeSpeakers} × ${Math.round(model.duration / 60)} min`,
    });

    return out;
}
