/**
 * The edges a loop body ACTUALLY runs along — the canvas mirror of the
 * runtime's `buildLinearEdges` (server/core/automationRunner/engine.js).
 *
 * A loop body is persisted as a bare step ARRAY with no edges. `execLoop`
 * synthesizes a sub-DAG per iteration, chaining the body linearly, and it does
 * so BRANCHER-AWARE: runDag routes a condition/switch by the label its executor
 * returns, so an unlabelled edge after one would never match and every step
 * after an If silently dead-ended (node-audit C3). Its semantics, which this
 * file reproduces exactly:
 *
 *   - condition → GUARD: `then` continues the body; `else` ends this iteration.
 *   - switch    → pass-through: a linear body can't branch, so every declared
 *                 case plus the default port continues to the next step.
 *   - anything else → one plain edge.
 *
 * This lives in its own module rather than inside inlineFlowlets because it is
 * a CONTRACT WITH THE SERVER: if the runtime's chaining rule changes and this
 * doesn't, the canvas draws a flow that isn't the one that runs. The colocated
 * loopBodyEdges.test.js pins both halves — the pure behaviour here, and a
 * source scan of engine.js's own function.
 *
 * The entry id is the caller's to choose: composeInlineGraph feeds it the
 * synthetic "Each item" node's local id, where the runtime uses
 * `__loop_root__`. Neither id is ever persisted.
 */

/** The synthetic entry node's local id inside a loop container. */
export const LOOP_ENTRY_ID = '__item__';

/**
 * @param {Array<object>} body  the loop's `body[]` (may be empty/absent)
 * @param {string} [entryId]    id of the node the chain starts from
 * @returns {Array<{from:string,to:string,label?:string,caseName?:string}>}
 */
export function loopBodyEdges(body, entryId = LOOP_ENTRY_ID) {
    const steps = (Array.isArray(body) ? body : []).filter(s => s && s.id);
    if (steps.length === 0) return [];
    const edges = [{ from: entryId, to: steps[0].id }];
    for (let i = 1; i < steps.length; i++) {
        const prev = steps[i - 1];
        const to = steps[i].id;
        if (prev.type === 'condition') {
            edges.push({ from: prev.id, to, label: 'then' });
        } else if (prev.type === 'switch') {
            // caseName as well as label: the canvas identifies a branch edge by
            // its definition-row identity (flow/branchEdges.js), and an edge
            // carrying only `label` would not match its own port.
            for (const c of (Array.isArray(prev.cases) ? prev.cases : [])) {
                if (c?.name) edges.push({ from: prev.id, to, label: `case:${c.name}`, caseName: c.name });
            }
            edges.push({ from: prev.id, to, label: 'case:default', caseName: 'default' });
        } else {
            edges.push({ from: prev.id, to });
        }
    }
    return edges;
}

/**
 * Put a loop container's children back in body order after the canvas has
 * rewired them — the inverse of `loopBodyEdges`.
 *
 * Kahn's algorithm, but STABLE: candidates are always taken in their previous
 * relative order, so a node that lost its edges (detached, or a body the user
 * has not touched) stays where it was instead of jumping to the front. That
 * matters because a run reads the array, not the drawing: an unstable sort
 * would silently reorder a working routine on an unrelated edit.
 *
 * Cycles cannot be authored inside a container (DiagramPane refuses free-hand
 * connections there), but a hand-edited or AI-written definition could still
 * produce one; anything left over is appended in its previous order rather than
 * dropped, because losing a user's step is worse than running it late.
 *
 * @param {Array<object>} steps  the container's children, in their PREVIOUS order
 * @param {Array<{from:string,to:string}>} edges  edges among those children
 * @returns {Array<object>} the same steps, ordered
 */
export function orderLoopBody(steps, edges) {
    const list = (Array.isArray(steps) ? steps : []).filter(s => s && s.id);
    if (list.length < 2) return list;
    const { indegree, out } = adjacency(list, edges);

    const ordered = [];
    const placed = new Set();
    const remaining = [...list];
    while (remaining.length) {
        const idx = remaining.findIndex(s => indegree.get(s.id) === 0);
        if (idx === -1) break;                       // cycle — bail to the tail
        const [step] = remaining.splice(idx, 1);
        ordered.push(step);
        placed.add(step.id);
        for (const next of out.get(step.id)) indegree.set(next, indegree.get(next) - 1);
    }
    for (const step of list) if (!placed.has(step.id)) ordered.push(step);
    return ordered;
}

/**
 * Successor lists + indegrees over `list`, counting only edges whose both ends
 * are in it.
 *
 * A switch's parallel case edges are counted ONCE: three edges between the same
 * pair would leave the target's indegree permanently above zero, so the sort
 * would place nothing and the whole body would fall through to the leftover
 * append.
 */
function adjacency(list, edges) {
    const ids = new Set(list.map(s => s.id));
    const indegree = new Map(list.map(s => [s.id, 0]));
    const out = new Map(list.map(s => [s.id, []]));
    for (const e of (edges || [])) {
        if (!e?.from || !e?.to) continue;
        if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) continue;
        if (out.get(e.from).includes(e.to)) continue;
        out.get(e.from).push(e.to);
        indegree.set(e.to, indegree.get(e.to) + 1);
    }
    return { indegree, out };
}
