/**
 * Inline containers — draw a step's sub-flow INSIDE the parent canvas instead
 * of only behind a drill-in or a nested list.
 *
 * TWO kinds of step contain a sub-flow, and both expand here:
 *
 *   call_layer — a flowlet, a full mini-definition living in
 *                `definition.layers[<key>]` (see flowletScope.js), reusable
 *                from several call sites.
 *   loop       — "Repeat for each". Its `body[]` is a bare step ARRAY with no
 *                edges of its own; the runtime chains it linearly per iteration
 *                (engine.js `buildLinearEdges`), which flow/loopBodyEdges.js
 *                mirrors so the drawing matches the run.
 *
 * The trick that keeps this cheap: rather than teaching every edit handler in
 * DiagramPane about scopes, we build a FLAT pseudo-definition where the inline
 * steps are ordinary steps carrying a prefixed id:
 *
 *      cl1                     the call_layer step (becomes a container node)
 *      cl1/trg, cl1/s3         its flowlet's nodes
 *      cl1/cl2/s7              a flowlet expanded inside that flowlet
 *      lp1/__item__, lp1/s4    a loop's entry pill and its body steps
 *
 * That is shape-compatible with a real definition, so applyDeleteNodes,
 * applyAddNode, spliceStepIntoEdge, applyDuplicateNode, createsCycle and
 * friends all run on it UNCHANGED. `decomposeInlineGraph` then splits the
 * edited flat graph back into the scope graph plus one patch per flowlet —
 * a loop's body is written straight back onto its own step, since it isn't
 * shared with anything.
 *
 * The prefix scheme is the runtime's own: automationRunner records a flowlet's
 * sub-steps as `<callStepId>/<subStepId>`, so an expanded flowlet's nodes line
 * up with their run rows for free. (A loop's body steps are deliberately not
 * recorded at all — see execLoop — so their ids buy layout, not run data.)
 *
 * Everything here is pure and framework-free except `useExpandedFlowlets`.
 * Colocated tests in inlineFlowlets.test.js.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { graphPositions, graphNodes, isFinitePos } from './dagreLayout';
import { LOOP_ENTRY_ID, loopBodyEdges, orderLoopBody } from './loopBodyEdges';
import scopedStorage from '../../../../../utils/scopedStorage';

export const INLINE_SEP = '/';

/** Mirrors the server's MAX_LAYER_DEPTH (automation/validate/layerGraph.js). */
export const MAX_INLINE_DEPTH = 8;

/** Container chrome: padding around the contents, and the header strip. */
export const CONTAINER_PAD = 20;
export const CONTAINER_HEADER = 46;

/** A container never shrinks below the footprint of the card it replaces. */
const MIN_CONTAINER_W = 240;
const MIN_CONTAINER_H = CONTAINER_HEADER + 80;

export function makeInlineId(prefix, localId) {
    return prefix ? `${prefix}${INLINE_SEP}${localId}` : String(localId);
}

export function isInlineId(id) {
    return typeof id === 'string' && id.includes(INLINE_SEP);
}

/**
 * Split a flat id into the container prefix and the id the step has inside
 * its flowlet. `cl1/cl2/s7` → `{ prefix: 'cl1/cl2', localId: 's7' }`.
 * A top-level id yields `{ prefix: '', localId: id }`.
 */
export function parseInlineId(id) {
    const s = String(id || '');
    const cut = s.lastIndexOf(INLINE_SEP);
    if (cut < 0) return { prefix: '', localId: s };
    return { prefix: s.slice(0, cut), localId: s.slice(cut + 1) };
}

// ── bindings ───────────────────────────────────────────────────────────────
//
// A flowlet's steps address each other by LOCAL id (`steps.s1.output.x`) and
// address the flowlet's own input as `trigger.…`. Dropped into the flat graph
// verbatim, both would resolve to the wrong node — `s1` might be a different
// step of the parent flow, and `trigger` certainly is. So the ids inside
// bindings are rewritten exactly like the step ids are, which is what lets
// auto-map, the upstream picker and the inspector work on an expanded flowlet
// without knowing flowlets exist. `decomposeInlineGraph` reverses it.
//
// Only real binding shapes are touched — a `{kind:'ref'}` path, the inside of
// a `{{…}}` placeholder, and `expr` strings — so prose that happens to contain
// the word "trigger" is left alone.

const REF_STRING_KEYS = new Set(['expr', 'path']);

function rewriteBindings(value, rewrite, key = null) {
    if (typeof value === 'string') {
        if (REF_STRING_KEYS.has(key)) return rewrite(value);
        // Elsewhere (prompts, templates, labels) only placeholder innards are
        // references; the surrounding text is prose.
        return value.includes('{{')
            ? value.replace(/\{\{([^}]*)\}\}/g, (_m, inner) => `{{${rewrite(inner)}}}`)
            : value;
    }
    if (Array.isArray(value)) return value.map(v => rewriteBindings(v, rewrite, key));
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = rewriteBindings(v, rewrite, k);
        return out;
    }
    return value;
}

/** local ids → prefixed ids (compose direction). */
function localToFlatRewriter(prefix, localIds, triggerLocalId) {
    return (text) => {
        let out = String(text).replace(/\bsteps\.([A-Za-z0-9_]+)/g,
            (m, id) => (localIds.has(id) ? `steps.${prefix}${INLINE_SEP}${id}` : m));
        if (triggerLocalId) {
            out = out.replace(/\btrigger(?=\.)/g, `steps.${prefix}${INLINE_SEP}${triggerLocalId}`);
        }
        return out;
    };
}

/** prefixed ids → local ids (decompose direction). Exact inverse. */
function flatToLocalRewriter(prefix, triggerLocalId) {
    const head = `steps.${prefix}${INLINE_SEP}`;
    return (text) => {
        let out = String(text);
        if (triggerLocalId) {
            // Longest match first: the trigger's own prefixed id must not be
            // reduced to `steps.<triggerId>` by the general rule below.
            out = out.split(`${head}${triggerLocalId}`).join('trigger');
        }
        return out.split(head).join('steps.');
    };
}

// ── what a step contains ───────────────────────────────────────────────────

/**
 * Which kind of container a step is, or null if it holds no sub-flow.
 * Exported so node components and canvas guards can ask without duplicating
 * the type list.
 */
export function containerKind(step) {
    if (step?.type === 'call_layer' && step.layerKey) return 'layer';
    if (step?.type === 'loop') return 'loop';
    return null;
}

/**
 * The synthetic node a loop container starts from: "Each item". It stands where
 * a flowlet's `layer_input` trigger stands — the graph's root, not deletable —
 * but it is never persisted. `decomposeInlineGraph` drops it, and the runtime
 * has its own (`__loop_root__`).
 *
 * It carries the loop's own binding facts so the variable picker can offer
 * `loop.<itemVar>` with a real sample without reaching back up the tree.
 *
 * Its POSITION is derived, never stored: a body step keeps the coordinates the
 * user dragged it to, but there is nowhere to persist a position for a node
 * that does not exist in the document. Deriving it (one card's width left of
 * the leftmost body step) is deterministic, so the pill does not wander between
 * renders — and leaving it unset would make `graphPositions` fall back to dagre
 * and throw the user's whole arrangement away on every compose.
 */
function loopEntryNode(step, body, dims) {
    const positioned = body.filter(s => isFinitePos(s?.position));
    let position = { x: 0, y: 0 };
    if (body.length > 0 && positioned.length === body.length) {
        const leftmost = positioned.reduce((a, s) => (s.position.x < a.position.x ? s : a));
        position = { x: leftmost.position.x - (dims.width + 40), y: leftmost.position.y };
    }
    return {
        id: LOOP_ENTRY_ID,
        type: 'loop_item',
        label: 'Each item',
        itemVar: step.itemVar || 'item',
        overRef: step.overRef || '',
        batchSize: Math.max(1, Number(step.batchSize) || 1),
        position,
    };
}

/**
 * The graph a container step contributes, in the shape composeInlineGraph
 * folds in. Returns null when the step contains nothing expandable.
 *
 * `triggerLocalId` is what the binding rewriters treat as the graph's own
 * input. For a flowlet that is its `layer_input`, so `trigger.…` inside it
 * becomes a reference to that node. For a loop it is deliberately NULL: a body
 * step's `trigger.output.x` still means the AUTOMATION's trigger at run time,
 * and rewriting it would silently repoint every such binding at the loop.
 */
function virtualContainerFor(step, rootDef, dims) {
    const kind = containerKind(step);
    if (kind === 'layer') {
        const layer = rootDef?.layers?.[step.layerKey];
        if (!layer) return null;
        return { kind, graph: layer, layerKey: step.layerKey, triggerLocalId: layer.trigger?.id || null };
    }
    if (kind === 'loop') {
        const body = (Array.isArray(step.body) ? step.body : []).filter(s => s?.id);
        return {
            kind,
            graph: { trigger: loopEntryNode(step, body, dims), steps: body, edges: loopBodyEdges(body) },
            layerKey: null,
            triggerLocalId: null,
        };
    }
    return null;
}

// ── compose ────────────────────────────────────────────────────────────────

/**
 * Fold every expanded flowlet into `scopeGraph`.
 *
 * @param {object|null} scopeGraph  the graph currently on canvas (root document
 *                                  or one flowlet's mini-definition)
 * @param {object|null} rootDef     the whole document — `layers` is root-only
 * @param {Set<string>|Array<string>} expanded  container prefixes to expand
 * @param {{dims?: {width:number,height:number}, scopeLayerKey?: string|null}} [opts]
 *        `scopeLayerKey` — the flowlet the canvas is ALREADY showing (the
 *        drill-in scope). Expanding a call to it inside itself would make one
 *        graph both the scope and a patch; it is declined like any other cycle.
 * @returns {{graph: object, sidecar: Map<string, object>, expanded: Set<string>}}
 *          `graph` is the flat pseudo-definition (=== scopeGraph when nothing
 *          is expanded, so the ordinary canvas path is untouched), `expanded`
 *          is the subset that was actually applied (guards may drop some).
 */
export function composeInlineGraph(scopeGraph, rootDef, expanded, { dims = { width: 240, height: 96 }, scopeLayerKey = null } = {}) {
    const want = expanded instanceof Set ? expanded : new Set(expanded || []);
    const sidecar = new Map();
    if (!scopeGraph || want.size === 0) {
        return { graph: scopeGraph, sidecar, expanded: new Set() };
    }

    const steps = [...(scopeGraph.steps || [])];
    const edges = [...(scopeGraph.edges || [])];
    const applied = new Set();

    const inline = (containerSteps, prefix, layerPath, depth) => {
        for (const step of containerSteps) {
            const flatId = makeInlineId(prefix, step?.id);
            if (!step?.id || !want.has(flatId)) continue;
            if (depth >= MAX_INLINE_DEPTH) continue;
            // A flowlet already on the expansion path would nest forever. The
            // server rejects such a call graph outright; here we just decline
            // to draw it. (A loop can't recurse into itself — its body is
            // inline data, not a reference — so the path only tracks layers.)
            if (step.type === 'call_layer' && layerPath.has(step.layerKey)) continue;
            const container = virtualContainerFor(step, rootDef, dims);
            if (!container) continue;
            const { graph: sub, kind, layerKey, triggerLocalId } = container;

            const nodes = graphNodes(sub);
            if (nodes.length === 0) continue;
            // A local id containing the separator would make the flat id
            // ambiguous. Ids are machine-generated without one; refuse rather
            // than corrupt if that ever changes.
            if (nodes.some(n => isInlineId(n.id))) continue;

            const positions = graphPositions(sub, dims);
            // Normally {0,0}: sub-graphs are dagre-seeded into positive space.
            // Only a node dragged into negative coordinates inside the
            // container moves the origin, and then it moves by exactly enough
            // to keep every child inside it.
            let minX = 0;
            let minY = 0;
            for (const n of nodes) {
                const p = positions.get(n.id);
                if (!p) continue;
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
            }
            const origin = { x: minX, y: minY };

            const localIds = new Set(nodes.map(n => n.id));
            const rewrite = localToFlatRewriter(flatId, localIds, triggerLocalId);
            const childIds = [];
            for (const n of nodes) {
                const id = makeInlineId(flatId, n.id);
                childIds.push(id);
                steps.push({ ...rewriteBindings(n, rewrite), id, position: positions.get(n.id) || { x: 0, y: 0 } });
            }
            for (const e of (sub.edges || [])) {
                if (!e?.from || !e?.to) continue;
                edges.push({ ...e, from: makeInlineId(flatId, e.from), to: makeInlineId(flatId, e.to) });
            }
            // The container's own node feeds its entry node, so a step inside
            // sees everything that runs before the container. For a flowlet
            // that would be a lie — a flowlet only ever sees its declared
            // inputs — so this edge is a LOOP thing: a body step really can
            // read any earlier step's output at run time.
            if (kind === 'loop' && sub.trigger?.id) {
                edges.push({ from: flatId, to: makeInlineId(flatId, sub.trigger.id), __containerEntry: true });
            }

            sidecar.set(flatId, {
                prefix: flatId,
                kind,
                layerKey,
                callStepId: step.id,
                parentPrefix: prefix,
                depth,
                origin,
                childIds,
                triggerId: sub.trigger?.id ? makeInlineId(flatId, sub.trigger.id) : null,
                layerRef: kind === 'layer' ? sub : null,
                size: { width: MIN_CONTAINER_W, height: MIN_CONTAINER_H },
            });
            applied.add(flatId);

            inline(sub.steps || [], flatId, kind === 'layer' ? new Set([...layerPath, layerKey]) : layerPath, depth + 1);
        }
    };

    inline(scopeGraph.steps || [], '', new Set(scopeLayerKey ? [scopeLayerKey] : []), 0);

    if (applied.size === 0) return { graph: scopeGraph, sidecar, expanded: applied };

    measureContainers(sidecar, steps, dims);
    return { graph: { ...scopeGraph, steps, edges }, sidecar, expanded: applied };
}

/**
 * Size every container from its contents, innermost first so a nested
 * expansion grows its ancestors too. Mutates `entry.size`.
 */
function measureContainers(sidecar, steps, dims) {
    const posById = new Map(steps.map(s => [s.id, s.position || { x: 0, y: 0 }]));
    const byDepth = [...sidecar.values()].sort((a, b) => b.depth - a.depth);
    for (const entry of byDepth) {
        let maxRight = 0;
        let maxBottom = 0;
        for (const childId of entry.childIds) {
            const child = sidecar.get(childId);
            const w = child ? child.size.width : dims.width;
            const h = child ? child.size.height : dims.height;
            const p = toDisplayPosition(childId, posById.get(childId), sidecar);
            if (p.x + w > maxRight) maxRight = p.x + w;
            if (p.y + h > maxBottom) maxBottom = p.y + h;
        }
        entry.size = {
            width: Math.max(MIN_CONTAINER_W, Math.round(maxRight + CONTAINER_PAD)),
            height: Math.max(MIN_CONTAINER_H, Math.round(maxBottom + CONTAINER_PAD)),
        };
    }
}

// ── geometry ───────────────────────────────────────────────────────────────

/**
 * Stored coordinates → canvas coordinates.
 *
 * An inline node's position is relative to its container (React Flow's own
 * `parentId` convention), offset by the container chrome and the flowlet's
 * origin. A top-level node is offset by the neighbour shift, if any.
 */
export function toDisplayPosition(id, pos, sidecar, shiftById = null) {
    const p = pos || { x: 0, y: 0 };
    const { prefix } = parseInlineId(id);
    const parent = prefix ? sidecar?.get?.(prefix) : null;
    if (parent) {
        const o = containerOffset(parent);
        return { x: p.x + o.x, y: p.y + o.y };
    }
    const shift = shiftById?.get?.(id);
    return shift ? { x: p.x + shift.dx, y: p.y + shift.dy } : { x: p.x, y: p.y };
}

/** Canvas coordinates → stored coordinates. Exact inverse of the above. */
export function fromDisplayPosition(id, pos, sidecar, shiftById = null) {
    const p = pos || { x: 0, y: 0 };
    const { prefix } = parseInlineId(id);
    const parent = prefix ? sidecar?.get?.(prefix) : null;
    if (parent) {
        const o = containerOffset(parent);
        return { x: p.x - o.x, y: p.y - o.y };
    }
    const shift = shiftById?.get?.(id);
    return shift ? { x: p.x - shift.dx, y: p.y - shift.dy } : { x: p.x, y: p.y };
}

/** Where a container's contents start, relative to the container's own box. */
function containerOffset(entry) {
    return {
        x: CONTAINER_PAD - entry.origin.x,
        y: CONTAINER_HEADER + CONTAINER_PAD - entry.origin.y,
    };
}

/**
 * A container's position in absolute canvas coordinates — its own display
 * position plus every ancestor's, since React Flow positions a child relative
 * to its parent.
 */
export function containerAbsolutePosition(prefix, graph, sidecar, shiftById = null) {
    const entry = sidecar?.get?.(prefix);
    if (!entry) return { x: 0, y: 0 };
    const node = graphNodes(graph).find(s => s.id === prefix);
    const own = toDisplayPosition(prefix, node?.position, sidecar, shiftById);
    if (!entry.parentPrefix) return own;
    const parent = containerAbsolutePosition(entry.parentPrefix, graph, sidecar, shiftById);
    return { x: parent.x + own.x, y: parent.y + own.y };
}

/**
 * A point the user clicked/dropped on the canvas, expressed in the coordinate
 * space of the graph it landed in — so a step dropped inside an expanded
 * flowlet is stored where it was dropped, not 400px away.
 */
export function flowToScopePosition(prefix, absPos, graph, sidecar, shiftById = null) {
    const entry = prefix ? sidecar?.get?.(prefix) : null;
    if (!entry) return absPos;
    const base = containerAbsolutePosition(prefix, graph, sidecar, shiftById);
    const o = containerOffset(entry);
    return { x: absPos.x - base.x - o.x, y: absPos.y - base.y - o.y };
}

/**
 * Move a step that was just added to the flat graph into a flowlet: give it
 * the prefixed id, and repoint the edges the add created. Its position is
 * expected to already be in the flowlet's coordinate space
 * (see flowToScopePosition).
 */
export function prefixAddedStep(graph, stepId, prefix) {
    if (!graph || !stepId || !prefix) return graph;
    const newId = makeInlineId(prefix, stepId);
    return {
        ...graph,
        steps: (graph.steps || []).map(s => (s.id === stepId ? { ...s, id: newId } : s)),
        edges: (graph.edges || []).map(e => ({
            ...e,
            from: e.from === stepId ? newId : e.from,
            to: e.to === stepId ? newId : e.to,
        })),
    };
}

/**
 * How far each top-level node moves to make room for the expanded containers.
 *
 * An expanded container is much larger than the 240×96 card it replaces, and
 * every position on this canvas is one the user chose — so instead of
 * re-laying-out (which would throw their arrangement away) we push the nodes
 * that the container grew INTO out of its way, by exactly how much it grew.
 * Collapsing removes the shift and every node is back where it was.
 *
 * Comparisons use the STORED positions of both sides, so the result doesn't
 * depend on the order the containers are processed in.
 *
 * @returns {Map<string, {dx:number, dy:number}>} — only nodes that move
 */
export function shiftForExpansion(graph, sidecar, dims = { width: 240, height: 96 }) {
    const out = new Map();
    if (!sidecar || sidecar.size === 0) return out;
    const topLevel = graphNodes(graph).filter(s => !isInlineId(s.id));
    const containers = [...sidecar.values()].filter(e => !e.parentPrefix);
    if (containers.length === 0) return out;

    for (const entry of containers) {
        const box = topLevel.find(s => s.id === entry.prefix);
        if (!box?.position) continue;
        const dw = entry.size.width - dims.width;
        const dh = entry.size.height - dims.height;
        if (dw <= 0 && dh <= 0) continue;
        for (const node of topLevel) {
            if (node.id === entry.prefix || !node.position) continue;
            const cur = out.get(node.id) || { dx: 0, dy: 0 };
            let changed = false;
            if (dw > 0 && node.position.x >= box.position.x + dims.width) { cur.dx += dw; changed = true; }
            if (dh > 0 && node.position.y >= box.position.y + dims.height) { cur.dy += dh; changed = true; }
            if (changed) out.set(node.id, cur);
        }
    }
    return out;
}

// ── decompose ──────────────────────────────────────────────────────────────

/**
 * Split an edited flat graph back into the scope graph plus one patch per
 * still-present flowlet.
 *
 * A flowlet is shared, so its contents go out as a `layerPatches` entry the
 * caller merges into `definition.layers`. A LOOP's body belongs to one step and
 * nothing else, so it is written straight back onto that step — wherever it
 * lives, including inside another container's patch. Hence the two passes: the
 * innermost containers are folded into their parents first, so a loop expanded
 * inside an expanded flowlet lands in that flowlet's patch rather than being
 * dropped on the floor.
 *
 * @param {object} flatGraph  the edited flat pseudo-definition
 * @param {Map<string, object>} sidecar  from composeInlineGraph
 * @returns {{graph: object, layerPatches: Object<string, object>}}
 */
export function decomposeInlineGraph(flatGraph, sidecar) {
    if (!flatGraph || !sidecar || sidecar.size === 0) {
        return { graph: flatGraph, layerPatches: {} };
    }
    // Longest-first so `cl1/cl2/s7` resolves to `cl1/cl2`, not `cl1`.
    const prefixes = [...sidecar.keys()].sort((a, b) => b.length - a.length);
    const ownerOf = (id) => prefixes.find(p => String(id).startsWith(p + INLINE_SEP)) || '';

    // A container whose step was deleted takes its whole subtree with it: the
    // CALL SITE is gone, but the flowlet itself must survive untouched (that
    // deletion belongs to the Flowlets panel, via deleteLayerAndCalls).
    const stepIds = new Set((flatGraph.steps || []).map(s => s?.id).filter(Boolean));
    const alive = new Set();
    for (const prefix of [...sidecar.keys()].sort((a, b) => a.length - b.length)) {
        const entry = sidecar.get(prefix);
        if (!stepIds.has(prefix)) continue;                       // the call_layer step is gone
        if (entry.parentPrefix && !alive.has(entry.parentPrefix)) continue; // ancestor is gone
        alive.add(prefix);
    }

    const scopeSteps = [];
    const byPrefix = new Map();
    for (const step of (flatGraph.steps || [])) {
        if (!step?.id) continue;
        const owner = ownerOf(step.id);
        if (!owner) { scopeSteps.push(step); continue; }
        if (!alive.has(owner)) continue;                          // orphan of a deleted call site
        if (!byPrefix.has(owner)) byPrefix.set(owner, { steps: [], edges: [] });
        byPrefix.get(owner).steps.push(step);
    }
    const scopeEdges = [];
    for (const edge of (flatGraph.edges || [])) {
        if (!edge?.from || !edge?.to) continue;
        const a = ownerOf(edge.from);
        const b = ownerOf(edge.to);
        if (a !== b) continue;                                    // cross-boundary: never valid
        if (!a) { scopeEdges.push(edge); continue; }
        if (!alive.has(a)) continue;
        if (!byPrefix.has(a)) byPrefix.set(a, { steps: [], edges: [] });
        byPrefix.get(a).edges.push(edge);
    }

    /**
     * Put a loop's rebuilt body back on its own step, wherever that step lives:
     * the scope graph, or another container's not-yet-processed step list. The
     * bindings inside it are still expressed in the ENCLOSING graph's terms, so
     * this must happen before that graph is unrewritten — which is why the
     * caller walks deepest-first.
     */
    const writeBodyToContainer = (prefix, parentPrefix, body) => {
        const list = parentPrefix ? byPrefix.get(parentPrefix)?.steps : scopeSteps;
        if (!list) return;
        const i = list.findIndex(s => s?.id === prefix);
        if (i === -1) return;
        list[i] = { ...list[i], body };
    };

    const layerPatches = {};
    // Deepest containers first: a loop expanded inside a flowlet has to be
    // folded into that flowlet's step list before the flowlet itself is turned
    // into a patch.
    const deepestFirst = [...alive].sort((a, b) => (sidecar.get(b)?.depth ?? 0) - (sidecar.get(a)?.depth ?? 0));
    for (const prefix of deepestFirst) {
        const entry = sidecar.get(prefix);
        const part = byPrefix.get(prefix) || { steps: [], edges: [] };
        const strip = (id) => id.slice(prefix.length + 1);
        // The flowlet's layer_input trigger lives in `trigger`, not `steps`.
        // If it somehow went missing, keep the previous one rather than emit a
        // triggerless graph the validator would reject. A loop's entry pill
        // uses the same slot and is simply dropped.
        const triggerLocalId = entry.triggerId ? strip(entry.triggerId) : null;
        const unrewrite = flatToLocalRewriter(prefix, entry.kind === 'loop' ? null : triggerLocalId);
        const local = part.steps.map(s => ({ ...rewriteBindings(s, unrewrite), id: strip(s.id) }));
        const localEdges = part.edges.map(e => ({ ...e, from: strip(e.from), to: strip(e.to) }));

        if (entry.kind === 'loop') {
            // The body is an ordered ARRAY with no edges of its own: the drawn
            // chain is the order, so read it back off the chain. Positions ride
            // along on each step so the layout survives a collapse.
            const body = orderLoopBody(local.filter(s => s.id !== triggerLocalId), localEdges);
            writeBodyToContainer(prefix, entry.parentPrefix, body);
            continue;
        }

        const trigger = local.find(s => s.id === triggerLocalId && s.type === 'trigger')
            || local.find(s => s.type === 'trigger')
            || entry.layerRef?.trigger
            || null;
        layerPatches[entry.layerKey] = {
            ...entry.layerRef,
            trigger,
            steps: local.filter(s => s.id !== trigger?.id),
            edges: localEdges,
        };
    }

    return { graph: { ...flatGraph, steps: scopeSteps, edges: scopeEdges }, layerPatches };
}

/**
 * The flowlet key a flat node belongs to, or null for a node of the scope
 * graph itself. Used to route an edit (auto-map, drill-in) to the right graph.
 */
export function layerKeyForNode(id, sidecar) {
    const { prefix } = parseInlineId(id);
    if (!prefix) return null;
    return sidecar?.get?.(prefix)?.layerKey || null;
}

/** True when both ids live in the same graph — the rule `onConnect` enforces. */
export function sameInlineScope(a, b) {
    return parseInlineId(a).prefix === parseInlineId(b).prefix;
}

// ── expanded-state (per-user lens, never the definition) ────────────────────

const STORAGE_KEY = 'builderExpandedFlowlets';

/**
 * Which containers are expanded, remembered per user + per automation.
 *
 * Deliberately NOT part of the definition: like the edge-colour lens in
 * DiagramPane it is presentation, and putting it in the document would
 * pollute every version diff for zero shared value.
 *
 * Only ONE call site of a given flowlet may be expanded at a time — two
 * expansions of the same `layers[key]` would produce two competing patches for
 * one graph on every edit. Expanding a second call site collapses the first.
 */
export function useExpandedFlowlets(automationId, scopeKey = null) {
    const key = `${STORAGE_KEY}:${automationId || 'draft'}:${scopeKey || 'root'}`;
    const [expanded, setExpanded] = useState(() => {
        const stored = scopedStorage.getJSON(key, null);
        return new Set(Array.isArray(stored) ? stored.filter(v => typeof v === 'string') : []);
    });

    // Persist as an effect rather than inside the updater: React may invoke a
    // state updater twice (StrictMode) and a writer in there runs twice too.
    useEffect(() => { scopedStorage.setJSON(key, [...expanded]); }, [key, expanded]);

    /**
     * @param {string} prefix    the container's flat node id
     * @param {string} layerKey  which flowlet it calls — used to collapse a
     *                           competing expansion of the same flowlet
     * @param {Map} sidecar      current sidecar, to find that competitor
     */
    const toggle = useCallback((prefix, layerKey = null, sidecar = null) => {
        setExpanded(prev => nextExpanded(prev, prefix, layerKey, sidecar));
    }, []);

    const collapseAll = useCallback(() => setExpanded(new Set()), []);

    return useMemo(() => ({ expanded, toggle, collapseAll }), [expanded, toggle, collapseAll]);
}

/**
 * Pure toggle rule behind `useExpandedFlowlets` — exported so it can be tested
 * without a renderer.
 */
export function nextExpanded(prev, prefix, layerKey = null, sidecar = null) {
    const next = new Set(prev);
    const dropSubtree = (root) => {
        for (const p of [...next]) if (p === root || p.startsWith(`${root}${INLINE_SEP}`)) next.delete(p);
    };
    if (next.has(prefix)) {
        // Collapsing takes any nested expansions with it — they have no
        // meaning once their container is a small card again.
        dropSubtree(prefix);
        return next;
    }
    if (layerKey && sidecar) {
        for (const [p, entry] of sidecar) {
            if (entry.layerKey !== layerKey || p === prefix) continue;
            dropSubtree(p);
        }
    }
    next.add(prefix);
    return next;
}
