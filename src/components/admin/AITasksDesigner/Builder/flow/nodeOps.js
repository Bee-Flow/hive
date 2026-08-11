/**
 * Pure graph surgery for canvas node actions (BFSF-319).
 *
 * Two operations the builder was missing:
 *
 *   - **Duplicate** — didn't exist at all. A `flow/useDiagramClipboard.js`
 *     stub declared a Cmd+D binding but was never imported, and its `paste()`
 *     would have emitted colliding step ids; it was removed in favour of the
 *     real transform here.
 *   - **Delete that heals the graph** — deleting worked (the Delete key was
 *     wired), but `onNodesDelete` only PRUNED: removing a step from the middle
 *     of a flow dropped every edge touching it, silently severing the graph and
 *     stranding everything downstream as unreachable roots.
 *
 * `bridgeEdges` generalises the splice already used when inserting a node onto
 * an edge (BuildTab's `handleAddNode`), which was inline and not reusable.
 *
 * Everything here is pure: inputs are never mutated.
 */

import { copyExtraEdgeKeys, edgeKey } from './branchEdges';
import { normalizeDefinitionShape, emptyGraph } from './normalizeDefinition';

/** Step types whose per-type config is small enough to clone wholesale. */
const COPY_SUFFIX = ' (copy)';

/**
 * Fresh id for a duplicated step. Mirrors `newStepId` in DiagramPane (same
 * prefixes, same random tail) but takes the step TYPE rather than a palette
 * kind, and is guaranteed not to collide with anything already in `taken`.
 */
function duplicateStepId(type, taken) {
    const prefix = type === 'integration_action' ? 'act'
        : type === 'ai_step' ? 'ai'
        : type === 'condition' ? 'cond'
        : type === 'loop' ? 'loop'
        : type === 'notification' ? 'notif'
        : type === 'code' ? 'code'
        : type === 'trigger' ? 'trig'
        : 'step';
    for (let attempt = 0; attempt < 50; attempt += 1) {
        const rand = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID().split('-')[0]
            : Math.random().toString(36).slice(2, 10);
        const id = `${prefix}_${rand}`;
        if (!taken.has(id)) return id;
    }
    // Astronomically unlikely; keep it deterministic rather than looping forever.
    return `${prefix}_${taken.size}_${Date.now().toString(36)}`;
}

/** Every id already in use anywhere in the graph. */
function collectIds(def) {
    const ids = new Set();
    if (def.trigger?.id) ids.add(def.trigger.id);
    for (const t of (def.triggers || [])) if (t?.id) ids.add(t.id);
    for (const s of (def.steps || [])) if (s?.id) ids.add(s.id);
    return ids;
}

/**
 * Rewire edges around a step that is being removed, so its predecessors connect
 * straight to its successors instead of the flow dead-ending.
 *
 * Branch labels are preserved from the INCOMING edge: if a condition's `then`
 * branch fed the removed step, the bridged edge stays on `then`. Taking the
 * label from the incoming side is what keeps an If node's routing intact —
 * the outgoing edge of a plain step carries no label to inherit.
 *
 * Self-edges and duplicates are dropped.
 *
 * @param {object[]} edges    the graph's edges
 * @param {string}   removedId
 * @returns {object[]} the next edge list
 */
export function bridgeEdges(edges, removedId) {
    const list = Array.isArray(edges) ? edges : [];
    const incoming = list.filter(e => e.to === removedId && e.from !== removedId);
    const outgoing = list.filter(e => e.from === removedId && e.to !== removedId);
    const kept = list.filter(e => e.from !== removedId && e.to !== removedId);

    const seen = new Set(kept.map(e => edgeKey(e)));
    const bridged = [];
    for (const inEdge of incoming) {
        for (const outEdge of outgoing) {
            if (inEdge.from === outEdge.to) continue; // would create a self-loop
            const edge = { from: inEdge.from, to: outEdge.to };
            if (inEdge.label) edge.label = inEdge.label;
            if (inEdge.caseName != null) edge.caseName = inEdge.caseName;
            // Extra metadata (colour) follows the same donor as the branch
            // identity: the incoming edge.
            copyExtraEdgeKeys(inEdge, edge);
            const key = edgeKey(edge);
            if (seen.has(key)) continue;
            seen.add(key);
            bridged.push(edge);
        }
    }
    return [...kept, ...bridged];
}

// edgeKey moved to branchEdges.js — the shared edge-identity module — so the
// delete/duplicate transforms and the canvas handlers agree on what makes two
// edges "the same".

/**
 * Remove one or more steps, healing the graph around each.
 *
 * The primary trigger is never removable — the runtime requires exactly one, so
 * it is silently skipped (callers should also hide the affordance for it).
 * Additional triggers (`definition.triggers[]`) behave like any other node.
 *
 * @param {object} definition
 * @param {string|string[]} ids
 * @returns {object} the next definition
 */
export function applyDeleteNodes(definition, ids) {
    const base = normalizeDefinitionShape(definition) || emptyGraph();
    const remove = new Set(Array.isArray(ids) ? ids : [ids]);
    remove.delete(base.trigger?.id);
    if (remove.size === 0) return definition;

    let edges = base.edges;
    for (const id of remove) edges = bridgeEdges(edges, id);

    const next = {
        ...base,
        steps: base.steps.filter(s => !remove.has(s.id)),
        edges: edges.filter(e => !remove.has(e.from) && !remove.has(e.to)),
    };
    if (Array.isArray(base.triggers)) next.triggers = base.triggers.filter(t => !remove.has(t.id));
    return next;
}

/**
 * How far below its old spot a disconnected step is parked. Enough that it
 * clearly sits OFF the healed connection rather than on top of it — the whole
 * point of the gesture is to see that the step is no longer in the flow.
 */
const DETACH_OFFSET_Y = 160;

/**
 * Take a step OUT of the flow without deleting it.
 *
 * Same graph surgery as a delete — the neighbours are bridged so nothing is
 * stranded — except the step itself survives, parked just below where it was.
 * It becomes a loose node, which is exactly what `flow/nodeDropTarget.js`
 * accepts: drag it near another connection and it splices back in. So
 * "disconnect here, reconnect there" is a two-gesture move rather than a
 * delete-and-rebuild.
 *
 * Steps only (a trigger has nothing meaningful to be detached from), and a
 * step with no edges at all is already loose — both return the definition
 * unchanged so callers can hide the affordance instead of offering a no-op.
 *
 * @param {object} definition
 * @param {string} stepId
 * @returns {object} the next definition
 */
export function applyDetachNode(definition, stepId) {
    const base = normalizeDefinitionShape(definition) || emptyGraph();
    const step = base.steps.find(s => s.id === stepId);
    if (!step) return definition;
    if (!base.edges.some(e => e.from === stepId || e.to === stepId)) return definition;

    const parked = {
        ...step,
        position: {
            x: step.position?.x ?? 0,
            y: (step.position?.y ?? 0) + DETACH_OFFSET_Y,
        },
    };
    return {
        ...base,
        steps: base.steps.map(s => (s.id === stepId ? parked : s)),
        edges: bridgeEdges(base.edges, stepId),
    };
}

/**
 * Duplicate one step, keeping its configuration.
 *
 * The copy is placed below-right of the original and wired from the SAME
 * predecessors, so it sits as a sibling rather than being spliced into the
 * chain — duplicating an action to run a variant alongside it is the common
 * case, and a caller who wants it in series can drag the edge afterwards.
 * Outgoing edges are deliberately NOT copied: the duplicate would otherwise
 * double every downstream path.
 *
 * Triggers are not duplicable (the primary is unique; secondary triggers are
 * added via the ribbon's "add another trigger" affordance, which enforces the
 * webhook/app_event-only rule). Returns the definition unchanged for those.
 *
 * @param {object} definition
 * @param {string} stepId
 * @returns {{definition: object, newStepId: string|null}}
 */
export function applyDuplicateNode(definition, stepId) {
    const base = normalizeDefinitionShape(definition) || emptyGraph();
    const source = base.steps.find(s => s.id === stepId);
    if (!source) return { definition, newStepId: null };

    const taken = collectIds(base);
    const newId = duplicateStepId(source.type, taken);

    const clone = deepClone(source);
    clone.id = newId;
    clone.label = `${source.label || source.type || 'Step'}${COPY_SUFFIX}`;
    clone.position = {
        x: (source.position?.x ?? 0) + 40,
        y: (source.position?.y ?? 0) + 120,
    };
    // A pinned output belongs to the original's run history, not to a brand-new
    // node — carrying it over would make the copy silently skip execution.
    delete clone.pinnedOutput;
    delete clone.pinnedAt;

    const inherited = base.edges
        .filter(e => e.to === stepId && e.from !== stepId)
        .map(e => {
            const edge = { from: e.from, to: newId };
            if (e.label) edge.label = e.label;
            if (e.caseName != null) edge.caseName = e.caseName;
            return copyExtraEdgeKeys(e, edge);
        });

    return {
        definition: { ...base, steps: [...base.steps, clone], edges: [...base.edges, ...inherited] },
        newStepId: newId,
    };
}

function deepClone(v) {
    try {
        return structuredClone ? structuredClone(v) : JSON.parse(JSON.stringify(v));
    } catch {
        return JSON.parse(JSON.stringify(v));
    }
}

/**
 * Can this node be removed? False only for the primary trigger.
 * Used to hide/disable the affordance rather than let a click silently no-op.
 */
export function canDeleteNode(definition, stepId) {
    if (!definition || !stepId) return false;
    return definition.trigger?.id !== stepId;
}

/** Can this node be duplicated? Steps only — never any trigger. */
export function canDuplicateNode(definition, stepId) {
    if (!definition || !stepId) return false;
    return (definition.steps || []).some(s => s.id === stepId);
}

/**
 * Can this node be disconnected? A step that is actually wired to something.
 * An already-loose step would give a button that does nothing.
 */
export function canDetachNode(definition, stepId) {
    if (!definition || !stepId) return false;
    if (!(definition.steps || []).some(s => s.id === stepId)) return false;
    return (definition.edges || []).some(e => e.from === stepId || e.to === stepId);
}
