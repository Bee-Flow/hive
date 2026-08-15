/**
 * The codec between an action's nested STEP TREE and the flat node+edge GRAPH a
 * canvas draws — and back again, losslessly.
 *
 * ── WHY A TREE AND NOT A DAG ────────────────────────────────────────
 * Automations are a genuine DAG: their runner gates fan-in, so a step with two
 * incoming edges waits for both. An App Studio action is a strict TREE — one
 * parent per step, no merges, no parallelism, no back-edges — and that is not
 * an accident of the editor. `stepIndex` is never stored: the browser
 * (useActionRunner.buildStepIndexMap) and the server
 * (routes/studioAppsRun.flattenSteps) each derive it by walking the saved tree
 * in the same pre-order, and the server resolves the step to run from that
 * index alone. A graph the tree cannot express would break that agreement
 * silently, on the server, at run time.
 *
 * So the canvas is allowed to draw a graph, and this module is what keeps the
 * graph a tree. The rules it enforces on connect (see canConnect):
 *   1. no edge crosses a container boundary,
 *   2. no node has more than one incoming edge inside its scope,
 *   3. no cycles.
 *
 * ── HOW BRANCHES MAP ────────────────────────────────────────────────
 * condition → `then` / `else`; switch → `case:<index>` / `case:default`; loop →
 * its body. Each is a CONTAINER node whose children live in their own scope,
 * addressed by a prefixed id (`s2/then/s5`) — the same trick the routine
 * builder's inline flowlets use, so the ids stay flat and unique while the
 * nesting stays real.
 *
 * ── ORDERING ────────────────────────────────────────────────────────
 * Reading a scope back is a STABLE topological sort: a step that lost its edges
 * stays where it was rather than jumping to the front, and anything left over
 * (a hand-written cycle) is appended in its previous order rather than dropped.
 * Losing someone's step is worse than running it late.
 */

export const SEP = '/';

/** Steps that hold other steps, and where. */
export const CONTAINER_KINDS = new Set(['condition', 'loop', 'switch']);

/** The entry pill each container scope hangs from. */
export const ENTRY_SUFFIX = '__entry__';

function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

/** "When it is Paid" — or the position, while nobody has said what it matches. */
function caseLabel(c, i) {
    const v = c?.value;
    if (v === '' || v === null || v === undefined) return `Case ${i + 1}`;
    return `When it is ${v}`;
}

/**
 * The scopes a container step owns, in a FIXED order — the same order
 * flattenSteps walks, so a reader can line the two up.
 * → [{ key, label, steps }]
 */
export function scopesOf(step) {
    if (!isObject(step)) return [];
    switch (step.kind) {
        case 'condition':
            return [
                { key: 'then', label: 'Yes', steps: step.then },
                { key: 'else', label: 'No', steps: step.else },
            ];
        case 'loop':
            return [{ key: 'body', label: 'For each', steps: step.steps }];
        case 'switch': {
            const cases = Array.isArray(step.cases) ? step.cases : [];
            // Keyed by POSITION, not by the case's value: canonicalize keeps
            // only { value, steps }, values are author-typed and may repeat or
            // be blank, and a scope key ends up inside a node id — so it has to
            // be unique and stable. The value is what the branch is LABELLED
            // with, which is the part a reader needs.
            return [
                ...cases.map((c, i) => ({
                    key: `case:${i}`,
                    label: caseLabel(c, i),
                    steps: c?.steps,
                })),
                { key: 'case:default', label: 'Otherwise', steps: step.default },
            ];
        }
        default:
            return [];
    }
}

/** Write a scope's steps back onto its container, leaving the rest untouched. */
function withScope(step, key, steps) {
    if (step.kind === 'condition') return { ...step, [key]: steps };
    if (step.kind === 'loop') return { ...step, steps };
    if (step.kind === 'switch') {
        if (key === 'case:default') return { ...step, default: steps };
        const at = Number(key.slice('case:'.length));
        const cases = (Array.isArray(step.cases) ? step.cases : []).map((c, i) => (
            i === at ? { ...c, steps } : c
        ));
        return { ...step, cases };
    }
    return step;
}

export const makeId = (prefix, localId) => (prefix ? `${prefix}${SEP}${localId}` : localId);

/** Split a graph id back into its container prefix and the step's own id. */
export function parseId(id) {
    const at = String(id).lastIndexOf(SEP);
    if (at === -1) return { prefix: '', localId: String(id) };
    return { prefix: String(id).slice(0, at), localId: String(id).slice(at + 1) };
}

/** Two ids are in the same scope when they share a container prefix. */
export function sameScope(a, b) {
    return parseId(a).prefix === parseId(b).prefix;
}

/**
 * stepsToGraph(action) → { nodes, edges }
 *
 *   node = { id, kind, step, prefix, parentId, scopeKey, scopeLabel, isEntry }
 *   edge = { id, from, to, label }
 *
 * `isEntry` marks a container scope's pill — a real node the canvas can draw
 * and connect from, but not a step: it never comes back out.
 */
export function stepsToGraph(action) {
    const nodes = [];
    const edges = [];

    const walk = (steps, prefix, parentId, scopeKey, scopeLabel) => {
        const list = (Array.isArray(steps) ? steps : []).filter(isObject);

        // A scope with a parent starts from that parent's pill, so an empty
        // branch is still somewhere you can drop a step.
        let previousId = null;
        if (parentId) {
            const entryId = makeId(prefix, ENTRY_SUFFIX);
            nodes.push({ id: entryId, kind: 'entry', step: null, prefix, parentId, scopeKey, scopeLabel, isEntry: true });
            previousId = entryId;
        }

        list.forEach((step, i) => {
            const id = makeId(prefix, step.id || `s${i}`);
            nodes.push({ id, kind: step.kind, step, prefix, parentId, scopeKey, scopeLabel, isEntry: false });
            if (previousId) edges.push({ id: `${previousId}->${id}`, from: previousId, to: id, label: null });
            previousId = id;

            for (const scope of scopesOf(step)) {
                walk(scope.steps, makeId(id, scope.key), id, scope.key, scope.label);
            }
        });
    };

    walk(action?.kind === 'sequence' ? action.steps : (action ? [action] : []), '', null, null, null);
    return { nodes, edges };
}

/**
 * Kahn's algorithm, but STABLE: candidates are taken in their previous relative
 * order, so a node that lost its edges stays where it was instead of jumping to
 * the front. A run reads the array, not the drawing — an unstable sort would
 * silently reorder a working action on an unrelated edit.
 */
export function orderScope(ids, edges, previousOrder) {
    const set = new Set(ids);
    const indegree = new Map(ids.map((id) => [id, 0]));
    const out = new Map(ids.map((id) => [id, []]));

    for (const e of edges) {
        if (!set.has(e.from) || !set.has(e.to) || e.from === e.to) continue;
        if (out.get(e.from).includes(e.to)) continue;   // a switch emits one edge per case
        out.get(e.from).push(e.to);
        indegree.set(e.to, indegree.get(e.to) + 1);
    }

    const remaining = [...previousOrder.filter((id) => set.has(id)), ...ids.filter((id) => !previousOrder.includes(id))];
    const ordered = [];
    const placed = new Set();
    while (remaining.length) {
        const at = remaining.findIndex((id) => indegree.get(id) === 0);
        if (at === -1) break;                            // a cycle — bail to the tail
        const [id] = remaining.splice(at, 1);
        ordered.push(id);
        placed.add(id);
        for (const next of out.get(id)) indegree.set(next, indegree.get(next) - 1);
    }
    // Anything left over is appended in its previous order rather than dropped.
    for (const id of previousOrder) if (set.has(id) && !placed.has(id)) ordered.push(id);
    for (const id of ids) if (!ordered.includes(id)) ordered.push(id);
    return ordered;
}

/**
 * graphToSteps(nodes, edges) → steps
 *
 * The inverse. Container children are read back from their own scope's edges,
 * so a step dragged from one branch to another lands in the right array.
 */
export function graphToSteps(nodes, edges) {
    const byPrefix = new Map();
    for (const node of nodes) {
        if (node.isEntry) continue;
        if (!byPrefix.has(node.prefix)) byPrefix.set(node.prefix, []);
        byPrefix.get(node.prefix).push(node);
    }

    const build = (prefix) => {
        const scoped = byPrefix.get(prefix) || [];
        if (!scoped.length) return [];
        const ids = scoped.map((n) => n.id);
        const scopeEdges = edges.filter((e) => sameScope(e.from, e.to) && parseId(e.from).prefix === prefix);
        const order = orderScope(ids, scopeEdges, ids);
        const nodeById = new Map(scoped.map((n) => [n.id, n]));

        return order.map((id) => {
            const node = nodeById.get(id);
            let step = node.step;
            for (const scope of scopesOf(step)) {
                step = withScope(step, scope.key, build(makeId(id, scope.key)));
            }
            return step;
        });
    };

    return build('');
}

/**
 * May these two be connected?
 *
 * Every refusal is what keeps the graph a tree, and therefore what keeps
 * `stepIndex` meaning the same thing on both sides of the wire.
 * → { ok: true } | { ok: false, reason }
 */
export function canConnect(from, to, edges, nodes) {
    if (from === to) return { ok: false, reason: 'A step cannot follow itself.' };
    if (!sameScope(from, to)) {
        return { ok: false, reason: 'Steps can only be connected inside the same branch.' };
    }
    const target = nodes.find((n) => n.id === to);
    if (target?.isEntry) return { ok: false, reason: 'A branch always starts at its own entry point.' };
    if (edges.some((e) => e.to === to)) {
        return { ok: false, reason: 'A step can only follow one other step — disconnect the existing one first.' };
    }
    if (edges.some((e) => e.from === from)) {
        return { ok: false, reason: 'This step already leads somewhere — disconnect that first.' };
    }
    if (createsCycle(from, to, edges)) {
        return { ok: false, reason: 'That would loop back on itself.' };
    }
    return { ok: true };
}

/** Would adding from→to close a loop? */
export function createsCycle(from, to, edges) {
    const next = new Map();
    for (const e of [...edges, { from, to }]) {
        if (!next.has(e.from)) next.set(e.from, []);
        next.get(e.from).push(e.to);
    }
    const seen = new Set();
    const stack = [to];
    while (stack.length) {
        const id = stack.pop();
        if (id === from) return true;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const n of next.get(id) || []) stack.push(n);
    }
    return false;
}

/**
 * Give every step in an action a stable id, so a graph node can point back at
 * exactly one step across a re-render. Steps carry no id in the schema — the
 * runtime addresses them by position — so ids are assigned here and never
 * persisted.
 */
export function withStepIds(action) {
    let counter = 0;
    const tag = (steps) => (Array.isArray(steps) ? steps : []).filter(isObject).map((step) => {
        counter += 1;
        let out = { ...step, id: step.id || `s${counter}` };
        for (const scope of scopesOf(out)) out = withScope(out, scope.key, tag(scope.steps));
        return out;
    });

    if (!action) return action;
    if (action.kind === 'sequence') return { ...action, steps: tag(action.steps) };
    return { ...action, id: action.id || 's1' };
}

/** Strip the editor-only ids back off before the action is saved. */
export function stripStepIds(steps) {
    return (Array.isArray(steps) ? steps : []).map((step) => {
        const { id: _dropped, ...rest } = step;
        let out = rest;
        for (const scope of scopesOf(out)) out = withScope(out, scope.key, stripStepIds(scope.steps));
        return out;
    });
}
