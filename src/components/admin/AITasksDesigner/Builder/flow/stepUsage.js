import { getJSON, setJSON } from '../../../../../utils/scopedStorage';

/**
 * Pure-logic engine for the routines builder's "smart Add-step" menu.
 *
 * Two jobs:
 *   1. Persist per-user step-usage telemetry (how often each addable thing is
 *      used + what step it was added *after*) in user-scoped localStorage.
 *   2. Rank context-aware suggestions for "what step usually comes next" by
 *      blending static heuristics, the user's own transition history, and the
 *      user's recency-weighted overall frequency.
 *
 * Presentation-free and side-effect-light: the scoring half (scoreSuggestions /
 * topFrequentKeys) is *pure* — callers pass in the stored objects so the UI can
 * read storage once and re-rank cheaply. Only recordStep touches storage.
 *
 * Storage keys (user-scoped via scopedStorage):
 *   routinesStepUsage       { [usageKey]: { n: count, t: lastUsedMs } }
 *   routinesStepTransitions { [fromKind]: { [usageKey]: count } }
 */

const USAGE_KEY = 'routinesStepUsage';
const TRANSITIONS_KEY = 'routinesStepTransitions';

const DAY_MS = 86400000;
const HALF_LIFE_DAYS = 14;

/**
 * Stable identity for an addable palette payload. Same shape regardless of the
 * surface it came from (ribbon, edge-drop, search), so usage aggregates cleanly.
 * Returns null for an empty/kind-less payload (nothing worth recording).
 */
export function getUsageKey(payload) {
    if (!payload || !payload.kind) return null;
    switch (payload.kind) {
        case 'trigger':
            return `trigger:${payload.triggerKind || 'manual'}`;
        case 'integration_action':
            return payload.tool ? `action:${payload.tool}` : null;
        case 'call_layer':
            return payload.layerKey ? `flowlet:${payload.layerKey}` : null;
        case 'call_block':
            return payload.blockId != null ? `block:${payload.blockId}` : null;
        case 'create_layer':
            return 'layer:create';
        default:
            return `step:${payload.kind}`;
    }
}

/** Read the stored usage map (or {} on miss / storage failure). */
export function readUsage() {
    try {
        return getJSON(USAGE_KEY, {}) || {};
    } catch {
        return {};
    }
}

/** Read the stored transition map (or {} on miss / storage failure). */
export function readTransitions() {
    try {
        return getJSON(TRANSITIONS_KEY, {}) || {};
    } catch {
        return {};
    }
}

/**
 * Record one "step added" event for the current user. No-op when the payload
 * has no usage key. Bumps both the overall frequency count and the
 * sourceStep→step transition count. Storage failures are swallowed so a
 * telemetry hiccup never breaks the add-step flow.
 *
 * @param {object} payload     palette payload that was added
 * @param {object} [sourceStep] the step it was added after ({kind|type})
 * @param {number} [now]        timestamp override (defaults to Date.now())
 */
export function recordStep(payload, sourceStep, now = Date.now()) {
    const key = getUsageKey(payload);
    if (!key) return;

    try {
        const usage = readUsage();
        const prev = usage[key] || { n: 0, t: 0 };
        usage[key] = { n: (prev.n || 0) + 1, t: now };
        setJSON(USAGE_KEY, usage);
    } catch {
        /* ignore storage failure */
    }

    try {
        const fromKind = (sourceStep && (sourceStep.kind || sourceStep.type)) || '__none';
        const transitions = readTransitions();
        const bucket = transitions[fromKind] || {};
        bucket[key] = (bucket[key] || 0) + 1;
        transitions[fromKind] = bucket;
        setJSON(TRANSITIONS_KEY, transitions);
    } catch {
        /* ignore storage failure */
    }
}

/**
 * Top-N usage keys ranked by recency-weighted frequency. Pure — takes the usage
 * map as an argument. Score = count * decay, decay = 0.5 ** (ageDays/14), so a
 * 14-day-old item is worth half its raw count and a recently-used low-count
 * item can outrank a stale high-count one. Tiebreak: raw count, then key.
 */
export function topFrequentKeys(usage, n = 6, now = Date.now()) {
    const entries = Object.entries(usage || {}).map(([key, v]) => {
        const count = (v && v.n) || 0;
        const t = (v && v.t) || 0;
        const ageDays = Math.max(0, (now - t) / DAY_MS);
        const decay = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
        return { key, count, score: count * decay };
    });
    entries.sort((a, b) =>
        b.score - a.score ||
        b.count - a.count ||
        a.key.localeCompare(b.key),
    );
    return entries.slice(0, n).map(e => e.key);
}

/**
 * Static "what usually comes next" heuristics, keyed by a source signal.
 * Values are weighted candidate usage-keys. Special signals:
 *   __trigger  after any trigger / as the first real step
 *   __array    the source step's output is a list/array
 *   __default  fallback when the source kind has no specific rule
 * Concrete kinds (ai_step, loop, …) are matched against the immediate source.
 */
export const TRANSITION_RULES = {
    __trigger: [
        { key: 'step:ai_step', w: 1.0 },
        { key: 'step:set', w: 0.5 },
        { key: 'step:condition', w: 0.4 },
    ],
    __array: [
        { key: 'step:loop', w: 1.0 },
        { key: 'step:filter', w: 0.9 },
        { key: 'step:aggregate', w: 0.7 },
        { key: 'step:summarize', w: 0.6 },
    ],
    ai_step: [
        { key: 'step:set', w: 0.9 },
        { key: 'step:notification', w: 0.8 },
        { key: 'step:condition', w: 0.6 },
        { key: 'step:loop', w: 0.5 },
    ],
    integration_action: [
        { key: 'step:ai_step', w: 1.0 },
        { key: 'step:set', w: 0.7 },
        { key: 'step:notification', w: 0.6 },
        { key: 'step:condition', w: 0.5 },
    ],
    loop: [
        { key: 'step:notification', w: 0.8 },
        { key: 'step:ai_step', w: 0.7 },
    ],
    condition: [
        { key: 'step:ai_step', w: 0.8 },
        { key: 'step:notification', w: 0.7 },
    ],
    switch: [
        { key: 'step:ai_step', w: 0.8 },
        { key: 'step:notification', w: 0.7 },
    ],
    aggregate: [
        { key: 'step:notification', w: 0.8 },
        { key: 'step:set', w: 0.6 },
        { key: 'step:ai_step', w: 0.5 },
    ],
    summarize: [
        { key: 'step:notification', w: 0.8 },
        { key: 'step:set', w: 0.6 },
        { key: 'step:ai_step', w: 0.5 },
    ],
    set: [
        { key: 'step:ai_step', w: 0.7 },
        { key: 'step:notification', w: 0.6 },
        { key: 'step:condition', w: 0.5 },
    ],
    filter: [
        { key: 'step:loop', w: 0.8 },
        { key: 'step:aggregate', w: 0.7 },
        { key: 'step:notification', w: 0.5 },
    ],
    __default: [
        { key: 'step:ai_step', w: 0.9 },
        { key: 'step:set', w: 0.6 },
        { key: 'step:notification', w: 0.5 },
    ],
};

// Blend weights for the three signals. The personal-transition weight is set
// above the top static rule weight on purpose: a strong, repeated personal
// habit ("you always add X after Y") should outrank the generic heuristic.
const W_STATIC = 1.0;
const W_TRANSITION = 1.2;
const W_FREQUENCY = 0.4;

// When the source output is a list, the list-fitting steps (loop/filter/…)
// should clearly lead, so the __array overlay is weighted above the per-kind
// rules (which otherwise tie at the top, e.g. integration_action → ai_step).
const W_ARRAY_OVERLAY = 1.4;

// Personal-transition counts are log-scaled then capped so one heavily-used
// path can't completely drown out the static heuristics.
const TRANSITION_CAP = 3;

const REASON = {
    list: 'fits a list',
    frequent: 'you use this a lot',
    common: 'common next step',
    personal: 'you usually do this next',
};

/**
 * Rank context-aware "next step" suggestions. PURE — no storage access; the
 * caller passes in the usage + transitions maps (read once, re-rank cheaply).
 *
 * Blends three signals into a single score per candidate usage-key:
 *   • static rules   — TRANSITION_RULES for the source (+ __array overlay)
 *   • personal transitions — how often *this user* did X after this source kind
 *   • personal frequency   — the user's recency-weighted overall favourites
 *
 * Triggers are never suggested as a next step. Result is deduped, ranked desc,
 * and capped at `limit`. Each entry: { key, score, reason }.
 */
export function scoreSuggestions({
    sourceKind = null,
    sourceOutputIsArray = false,
    usage = {},
    transitions = {},
    now = Date.now(),
    limit = 5,
} = {}) {
    const scores = new Map(); // key -> { score, reason }

    const bump = (key, amount, reason) => {
        if (!key || key.startsWith('trigger:')) return; // never suggest a trigger
        const cur = scores.get(key);
        if (cur) {
            cur.score += amount;
            // Keep the reason from the strongest *single* contribution so the
            // surfaced explanation matches why it actually ranks where it does.
            if (amount > cur._top) { cur._top = amount; cur.reason = reason; }
        } else {
            scores.set(key, { score: amount, reason, _top: amount });
        }
    };

    // 1) Static rules. __array (list source) folds in the array overlay at a
    //    higher weight so list-fitting steps lead; otherwise the kind's own
    //    rules or the default ruleset apply at the normal static weight.
    const ruleSets = [];
    if (sourceOutputIsArray) {
        ruleSets.push({ rules: TRANSITION_RULES.__array, reason: REASON.list, weight: W_ARRAY_OVERLAY });
    }
    const baseKey = sourceKind && TRANSITION_RULES[sourceKind] ? sourceKind : '__default';
    // When the output is an array we already have the array overlay; only add
    // the per-kind/default rules if they differ (avoid double-counting __array).
    if (!sourceOutputIsArray || baseKey !== '__array') {
        ruleSets.push({ rules: TRANSITION_RULES[baseKey], reason: REASON.common, weight: W_STATIC });
    }
    for (const { rules, reason, weight } of ruleSets) {
        for (const r of rules || []) bump(r.key, weight * r.w, reason);
    }

    // 2) Personal transitions: what this user did after this source kind.
    const fromKind = sourceKind || '__none';
    const bucket = transitions[fromKind] || {};
    for (const [key, count] of Object.entries(bucket)) {
        const scaled = Math.log1p(Math.min(count, TRANSITION_CAP)) / Math.log1p(TRANSITION_CAP);
        if (scaled > 0) bump(key, W_TRANSITION * scaled, REASON.personal);
    }

    // 3) Personal frequency: the user's recency-weighted favourites, decayed by
    //    rank so the #1 favourite contributes most.
    const freq = topFrequentKeys(usage, 6, now);
    freq.forEach((key, i) => {
        const decay = Math.pow(0.6, i); // 1, .6, .36, …
        bump(key, W_FREQUENCY * decay, REASON.frequent);
    });

    return [...scores.entries()]
        .map(([key, v]) => ({ key, score: v.score, reason: v.reason }))
        .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
        .slice(0, limit);
}

export default {
    getUsageKey,
    recordStep,
    readUsage,
    readTransitions,
    topFrequentKeys,
    scoreSuggestions,
    TRANSITION_RULES,
};
