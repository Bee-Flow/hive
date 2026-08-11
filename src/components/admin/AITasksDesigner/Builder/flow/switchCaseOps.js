/**
 * Switch-case graph surgery (node-audit C1/B1/B2).
 *
 * A switch's cases and its edges live in different places — `step.cases[]`
 * holds the names, `definition.edges[]` carries `case:<name>` labels — and the
 * case editor only ever wrote the FIRST side. Renaming or deleting a case
 * therefore orphaned its edges, and `switch.case_edge_unknown` is a blocking
 * (integrity) validation error, so every subsequent save of the WHOLE routine
 * 400'd until the user hand-repaired the JSON. These transforms keep both
 * sides in one atomic definition update: rename follows the edge, delete drops
 * it ("heal, don't block" — same philosophy as applyDeleteNodes).
 *
 * Everything here is pure; inputs are never mutated.
 */

import { edgeKey } from './branchEdges';
import { reconcileRouteEdges } from './routeEdges';

/**
 * Mint a case name that doesn't collide with any existing case.
 *
 * Extracted from the "Add case for <sample>" button, which already did this
 * right, while the plain "Add case" button minted `case${cases.length + 1}` —
 * a name that collides as soon as a case is removed from the middle
 * (add/add/remove-first/add ⇒ two `case2`s ⇒ blocking
 * `switch.case_name_duplicate` + two React Flow ports with the same handle
 * id, of which only the first is reachable).
 */
export function uniqueCaseName(cases, base) {
    const names = new Set((Array.isArray(cases) ? cases : []).map(c => c?.name).filter(Boolean));
    const stem = base || 'case';
    if (!names.has(stem)) return stem;
    let i = 1;
    let name = stem;
    while (names.has(name)) name = `${stem}_${++i}`;
    return name;
}

/**
 * Re-point a switch's outgoing edges (and its defaultBranch) after its cases
 * changed.
 *
 * - Renames are positional pairs (same index, different name), applied as ONE
 *   old→new map in a single pass so an A↔B swap can't chain.
 * - Removed cases (name present before, absent after) take their edges with
 *   them.
 * - `case:default` edges are never touched — the default port is independent
 *   of the declared cases.
 * - Legacy edge shapes (label-only `case:x`, caseName-only `x`) are healed to
 *   the canonical both-fields form when renamed.
 * - `defaultBranch` follows a rename and is cleared when its case is removed.
 *
 * @param {object} definition  whole (scoped) graph
 * @param {string} stepId      the switch step id
 * @param {Array}  prevCases   cases BEFORE the edit ([{name, value}])
 * @param {Array}  nextCases   cases AFTER the edit
 * @returns {object} next definition (same object when nothing had to change)
 */
export function reconcileSwitchEdges(definition, stepId, prevCases, nextCases) {
    if (!definition || !stepId) return definition;
    const prev = (Array.isArray(prevCases) ? prevCases : []).map(c => c?.name).filter(Boolean);
    const next = (Array.isArray(nextCases) ? nextCases : []).map(c => c?.name).filter(Boolean);

    // Positional renames. Only meaningful while the list keeps its length —
    // the editor mutates one row at a time, so a rename never coincides with
    // an add/remove in the same patch. Every differing pair goes into ONE map
    // applied in a single pass, so an A↔B swap re-points both sides without
    // chaining (A→B then B→A on the same edge).
    const renames = new Map();
    if (prev.length === next.length) {
        for (let i = 0; i < prev.length; i += 1) {
            if (prev[i] !== next[i]) renames.set(prev[i], next[i]);
        }
    }
    const nextNames = new Set(next);
    const removed = new Set(prev.filter(n => !nextNames.has(n) && !renames.has(n)));

    if (renames.size === 0 && removed.size === 0) return definition;

    const caseOf = (e) => {
        if (e.caseName != null) return e.caseName;
        if (typeof e.label === 'string' && e.label.startsWith('case:')) return e.label.slice(5);
        return null;
    };

    const seen = new Set();
    const edges = [];
    for (const e of (definition.edges || [])) {
        let out = e;
        const name = e.from === stepId ? caseOf(e) : null;
        if (name != null && name !== 'default') {
            if (removed.has(name)) continue; // case gone → edge gone
            const renamed = renames.get(name);
            if (renamed) out = { ...e, label: `case:${renamed}`, caseName: renamed };
        }
        // Dedupe (rename onto a name whose identical edge already exists).
        const key = edgeKey(out);
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push(out);
    }

    const result = { ...definition, edges };

    // defaultBranch lives on the STEP — heal it wherever the step sits.
    const healStep = (s) => {
        if (!s || s.id !== stepId || !s.defaultBranch) return s;
        if (renames.has(s.defaultBranch)) return { ...s, defaultBranch: renames.get(s.defaultBranch) };
        if (removed.has(s.defaultBranch)) return { ...s, defaultBranch: null };
        return s;
    };
    result.steps = (definition.steps || []).map(healStep);

    return result;
}

/**
 * Merge one node's patch into the whole (scoped) definition — the single
 * shared implementation behind NodeDetailView's save path AND its
 * unmount-flush, which used to duplicate this logic.
 *
 * When the patched step is a switch whose `cases` changed, the edge/default
 * reconcile above rides along IN THE SAME definition object, so the PUT is
 * atomic: `switch.case_edge_unknown` can never fire on a rename, and undo
 * restores the rename and the healed edges together.
 */
export function mergeStepPatchIntoDefinition(definition, step, patch) {
    const merged = { ...step, ...patch, id: step.id };
    let next = { ...definition };
    if (definition.trigger?.id === step.id) next.trigger = merged;
    // Secondary triggers (definition.triggers[]) must patch back into THAT
    // array, not steps[] — a trigger-shaped object has no `type` the step
    // validator accepts.
    else if ((definition.triggers || []).some(t => t.id === step.id)) {
        next.triggers = definition.triggers.map(t => (t.id === step.id ? merged : t));
    } else {
        next.steps = (definition.steps || []).map(s => (s.id === step.id ? merged : s));
    }

    // The unified Condition editor can change the step's TYPE (adding a
    // second rule to an If makes it a Switch; "work through a list" makes it a
    // Filter). That renames every output port, so the edges are re-pointed in
    // the SAME commit — otherwise the very next save would 400 on
    // `switch.case_edge_unknown`, exactly like the case-rename bug did (C1).
    if (patch && patch.type && patch.type !== step.type) {
        next = reconcileRouteEdges(next, step.id, step, merged);
    } else if (step.type === 'switch' && patch && Array.isArray(patch.cases)) {
        next = reconcileSwitchEdges(next, step.id, step.cases || [], patch.cases);
    }
    return next;
}
