import { STATUS_COLORS, CHART_SERIES } from '../../../../../constants/palette';

/**
 * Edge colour vocabulary for the canvas.
 *
 * A connection's persisted `color` is a PALETTE KEY ('blue' | 'red' | …),
 * never a raw hex: the picker offers exactly these eight swatches, the
 * validator can warn on typos with a tiny enum, and the no-purple project
 * rule (constants/palette.js) holds by construction — a key can only ever
 * resolve to an approved hex.
 *
 * Pure, framework-free. The stroke pipeline lives in edgeColoring.js; this
 * module only owns "which colours exist and what they mean".
 */

/** The eight pickable keys, in swatch-row order. */
export const EDGE_COLOR_KEYS = Object.keys(STATUS_COLORS);

/** Palette key -> hex; anything else (typos, legacy junk, null) -> null. */
export function resolveEdgeColor(key) {
    if (typeof key !== 'string') return null;
    return STATUS_COLORS[key] ?? null;
}

/**
 * Stable automatic colour for a switch/route case, by its index in the
 * step's `cases` array — the line and the node's port chip agree because
 * both key on the same index. Wraps and tolerates negatives, mirroring
 * AppStudio's chartColorAt.
 */
export function autoCaseColor(caseIndex) {
    const n = CHART_SERIES.length;
    const i = Number.isInteger(caseIndex) ? caseIndex : 0;
    return CHART_SERIES[((i % n) + n) % n];
}

/**
 * PII category-GROUP -> colour, for the "colour lines by PII" mode. The seven
 * groups come from the server's PII_CATEGORIES metadata
 * (server/core/piiDetection.js — each category carries a `group`). Fixed
 * mapping, documented here so the legend, the stroke and the tooltip all
 * agree; deliberately hexes from STATUS_COLORS only.
 */
export const PII_GROUP_COLORS = {
    Personal: STATUS_COLORS.blue,
    Contact: STATUS_COLORS.green,
    Financial: STATUS_COLORS.orange,
    Identity: STATUS_COLORS.amber,
    Digital: STATUS_COLORS.cyan,
    Organization: STATUS_COLORS.slate,
    'EU / Netherlands': STATUS_COLORS.red,
};

/**
 * The dominant group of a `{group: count}` summary — highest count wins;
 * ties break by PII_GROUP_COLORS declaration order so the same summary
 * always paints the same colour.
 */
export function dominantPiiGroup(groups) {
    if (!groups || typeof groups !== 'object') return null;
    let best = null;
    let bestCount = 0;
    for (const name of Object.keys(PII_GROUP_COLORS)) {
        const count = Number(groups[name]) || 0;
        if (count > bestCount) { best = name; bestCount = count; }
    }
    return best;
}
