import { EDGE_COLOR_KEYS, PII_GROUP_COLORS, resolveEdgeColor } from './edgeColors';

/**
 * Colour RULES — the definition-level operations behind the Lines panel.
 *
 * Two kinds of rule, two homes:
 *
 *   - A CASE colour ("pdf is red") lives on the case's edges (`edge.color`),
 *     the same key the hover picker writes — one storage mechanism, and the
 *     graph-surgery helpers already preserve it. The panel just applies it to
 *     every edge of that case at once.
 *
 *   - A PII GROUP colour ("Contact is green") has no edge to live on — it is
 *     a mapping over whatever flows anywhere — so it lives on the definition
 *     as `definition.piiLineColors: { <group>: <paletteKey> }`. Absent keys
 *     fall back to the fixed defaults (edgeColors.PII_GROUP_COLORS).
 *
 * Pure, framework-free; definitions are never mutated in place.
 */

/** Does this edge belong to `caseName` out of `stepId`? Tolerates the two
 * legacy case-edge shapes (label-only / caseName-only). */
function isCaseEdge(e, stepId, caseName) {
    if (e.from !== stepId) return false;
    const c = e.caseName ?? (typeof e.label === 'string' && e.label.startsWith('case:') ? e.label.slice(5) : null);
    return c === caseName;
}

/**
 * Set (or clear, color = null) the colour of EVERY edge of one case.
 * Returns the same definition object when nothing matched.
 */
export function applyCaseColor(definition, stepId, caseName, color) {
    let touched = false;
    const edges = (definition?.edges || []).map((e) => {
        if (!isCaseEdge(e, stepId, caseName)) return e;
        if (!color) {
            if (!('color' in e)) return e;
            touched = true;
            const { color: _dropped, ...rest } = e;
            return rest;
        }
        if (e.color === color) return e;
        touched = true;
        return { ...e, color };
    });
    return touched ? { ...definition, edges } : definition;
}

/**
 * The explicit colour of a case, when its edges agree on one; null when the
 * case has no edges yet, carries no colour, or its edges disagree (each keeps
 * its own — the hover picker can still address them individually).
 */
export function caseColorOf(definition, stepId, caseName) {
    const matching = (definition?.edges || []).filter(e => isCaseEdge(e, stepId, caseName));
    if (!matching.length) return null;
    const first = matching[0].color ?? null;
    if (!first || !EDGE_COLOR_KEYS.includes(first)) return null;
    return matching.every(e => (e.color ?? null) === first) ? first : null;
}

/**
 * Set (or clear, color = null) one PII group's line colour. Clearing the last
 * override removes the map entirely so untouched definitions stay untouched.
 */
export function applyPiiGroupColor(definition, group, color) {
    const current = { ...(definition?.piiLineColors || {}) };
    if (!color) delete current[group];
    else current[group] = color;
    if (!Object.keys(current).length) {
        if (!definition?.piiLineColors) return definition;
        const { piiLineColors: _dropped, ...rest } = definition;
        return rest;
    }
    return { ...definition, piiLineColors: current };
}

/**
 * The effective PII group → HEX map for a definition: fixed defaults with
 * the definition's palette-key overrides folded in. Unknown groups and
 * non-palette values are ignored (the validator warns, the canvas never
 * paints an unapproved colour).
 */
export function resolvePiiGroupColors(definition) {
    const out = { ...PII_GROUP_COLORS };
    const overrides = definition?.piiLineColors;
    if (overrides && typeof overrides === 'object') {
        for (const [group, key] of Object.entries(overrides)) {
            if (!(group in PII_GROUP_COLORS)) continue;
            const hex = resolveEdgeColor(key);
            if (hex) out[group] = hex;
        }
    }
    return out;
}
