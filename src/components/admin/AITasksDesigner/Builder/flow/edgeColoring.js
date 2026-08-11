import { autoCaseColor, dominantPiiGroup, PII_GROUP_COLORS, resolveEdgeColor } from './edgeColors';

/**
 * The two stages that decide what a connection LOOKS like:
 *
 *   1. identityColorForEdge — what the line MEANS. A manually picked colour
 *      always wins, in every mode; the "Colour lines by" mode then adds
 *      automatic colours (per switch/route case, or per dominant PII group of
 *      the source's last output). Null = the neutral base look.
 *
 *   2. decorateRunEdges — what the line is DOING right now. Extracted from
 *      DiagramPane so it's unit-testable. Precedence (decided with the user):
 *      a custom colour is the line's identity and survives runs — run state
 *      shows as dash-animation (in-flight) and a width bump (traversed);
 *      error red is the one thing that beats a custom colour, because a
 *      failure must be findable at a glance.
 *
 * Pure, framework-free.
 */

export const EDGE_COLOR_MODES = ['off', 'branches', 'pii'];

/**
 * @param {object} data           the rendered edge's `data` (layout.js)
 * @param {string} mode           'off' | 'branches' | 'pii'
 * @param {object} sourceRunStep  the source node's run row (may carry piiSummary)
 * @param {object} piiGroupColors optional group → HEX map (defaults + the
 *                                definition's overrides — edgeColorOps
 *                                resolvePiiGroupColors); falls back to the
 *                                fixed defaults when omitted
 * @returns {string|null} hex, or null for the neutral default
 */
export function identityColorForEdge(data, mode, sourceRunStep = null, piiGroupColors = null) {
    const manual = resolveEdgeColor(data?.defColor);
    if (manual) return manual;
    if (mode === 'branches') {
        if (data?.caseIndex != null) return autoCaseColor(data.caseIndex);
        return null; // then/else/on_error/default keep their semantic look
    }
    if (mode === 'pii') {
        const groups = sourceRunStep?.piiSummary?.groups;
        const dominant = dominantPiiGroup(groups);
        return dominant ? (piiGroupColors || PII_GROUP_COLORS)[dominant] || null : null;
    }
    return null;
}

/**
 * Layer run-state decoration over identity-coloured edges.
 *
 * @param {Array} edges       rendered edges; each may carry data.identityColor
 * @param {object} opts       { runByStep: Map, runInFlight: boolean }
 */
export function decorateRunEdges(edges, { runByStep, runInFlight = false }) {
    if (!runInFlight && (!runByStep || runByStep.size === 0)) return edges;
    return edges.map((e) => {
        const idColor = e.data?.identityColor || null;
        const src = runByStep?.get(e.source);
        const tgt = runByStep?.get(e.target);
        const srcDone = src?.status === 'success' || src?.status === 'pinned';
        const tgtDone = tgt?.status === 'success' || tgt?.status === 'pinned';
        const isInFlight = runInFlight && srcDone && (tgt?.status === 'running' || !tgt);
        const wasTraversed = srcDone && tgtDone;
        if (tgt?.status === 'error') {
            // Failure beats identity — red must be findable at a glance.
            return { ...e, animated: false, style: { ...(e.style || {}), stroke: '#ef4444' } };
        }
        if (isInFlight) {
            return { ...e, animated: true, style: { ...(e.style || {}), stroke: idColor || 'var(--accent)' } };
        }
        if (wasTraversed) {
            // Uncoloured edges keep the classic green; a coloured edge keeps
            // its meaning and signals traversal by width instead.
            return idColor
                ? { ...e, animated: false, style: { ...(e.style || {}), stroke: idColor, strokeWidth: 2.5 } }
                : { ...e, animated: false, style: { ...(e.style || {}), stroke: '#10b981' } };
        }
        return e;
    });
}
