/**
 * Pure helpers for inline flowlets (schemaVersion 2).
 *
 * `definition.layers` is a ROOT-ONLY map of full mini-definitions:
 *   {
 *     "<key>": {                       // key matches ^[a-z][a-z0-9_]*$
 *       title: 'Enrich contact',
 *       trigger: { id, type:'trigger', kind:'layer_input', params:[{name,type,required?}] },
 *       steps:   [ ..., { id, type:'layer_output', fields:{} } ],
 *       edges:   [...]
 *     }
 *   }
 *
 * A `call_layer` step references a flowlet by key:
 *   { id, type:'call_layer', layerKey, inputs, label }
 * (legacy layerId / version / inputContract / outputContract fields on old
 * steps are tolerated but ignored — contracts derive live from the map).
 *
 * Everything here is framework-free and immutable: callers get fresh
 * objects, the input definition is never mutated.
 */

import { applyDeleteNodes } from './nodeOps';

export const LAYER_KEY_RE = /^[a-z][a-z0-9_]*$/;

/**
 * Resolve the graph for a scope. `scopeKey == null` means the root
 * document itself; otherwise the flowlet's mini-definition (or null when
 * the key no longer exists — caller should snap back to root).
 *
 * @param {object|null} def      whole automation definition
 * @param {string|null} scopeKey flowlet key or null for root
 * @returns {object|null}
 */
export function getScopedGraph(def, scopeKey) {
    if (!def) return null;
    if (!scopeKey) return def;
    return def.layers?.[scopeKey] || null;
}

/**
 * Write a (possibly edited) scoped graph back into the whole document.
 * Root scope is a whole-document replacement; flowlet scope replaces just
 * that flowlet entry. Always returns a new object.
 *
 * @param {object|null} def       current whole definition
 * @param {string|null} scopeKey  flowlet key or null for root
 * @param {object} nextGraph      the edited graph for that scope
 * @returns {object} next whole definition
 */
export function setScopedGraph(def, scopeKey, nextGraph) {
    if (!scopeKey) return nextGraph;
    const base = def || {};
    return {
        ...base,
        layers: { ...(base.layers || {}), [scopeKey]: nextGraph },
    };
}

/**
 * Create a new empty flowlet inside the definition.
 * Skeleton = layer_input trigger ('trg', no params) → layer_output
 * ('out', empty fields, label 'Return'). Bumps schemaVersion to 2 —
 * the marker that this document uses the inline-flowlets map.
 *
 * @param {object|null} def   whole definition (may be null for a fresh doc)
 * @param {string} [title]    display title; also seeds the key slug
 * @returns {{definition: object, layerKey: string}}
 */
export function createLayerInDefinition(def, title = 'New flowlet') {
    const base = def || { trigger: null, steps: [], edges: [] };
    const layers = base.layers || {};
    const layerKey = uniqueLayerKey(title, layers);
    const skeleton = {
        title,
        trigger: { id: 'trg', type: 'trigger', kind: 'layer_input', label: 'Flowlet input', params: [], output: {} },
        steps: [{ id: 'out', type: 'layer_output', fields: {}, label: 'Return' }],
        edges: [{ from: 'trg', to: 'out' }],
    };
    return {
        definition: {
            ...base,
            schemaVersion: 2,
            layers: { ...layers, [layerKey]: skeleton },
        },
        layerKey,
    };
}

/**
 * Derive a flowlet's live contract from its mini-definition.
 * Params come from the layer_input trigger; output field names from the
 * layer_output step's `fields` map.
 *
 * @param {object|null} def       whole (root) definition
 * @param {string} layerKey
 * @returns {{params: Array<{name:string,type?:string,required?:boolean}>, outputFields: string[]}}
 */
export function getLayerContract(def, layerKey) {
    const layer = def?.layers?.[layerKey];
    if (!layer) return { params: [], outputFields: [] };
    const params = Array.isArray(layer.trigger?.params) ? layer.trigger.params : [];
    const out = (layer.steps || []).find(s => s?.type === 'layer_output');
    const outputFields = out?.fields && typeof out.fields === 'object' ? Object.keys(out.fields) : [];
    return { params, outputFields };
}

/**
 * List the flowlets declared in a definition (palette rows, pickers, the
 * Flowlets manager drawer).
 *
 * `description` is the optional human/AI-written one-liner; `stepCount`
 * excludes the terminal layer_output (it's plumbing, not a user step);
 * `outputFields` mirrors getLayerContract so the drawer can show an
 * at-a-glance "N steps · X in · Y out" line without a second pass.
 *
 * @param {object|null} def whole (root) definition
 * @returns {Array<{key:string, title:string, description:string, params:Array, outputFields:string[], stepCount:number}>}
 */
export function listLayers(def) {
    return Object.entries(def?.layers || {}).map(([key, layer]) => {
        const steps = Array.isArray(layer?.steps) ? layer.steps : [];
        const out = steps.find(s => s?.type === 'layer_output');
        const outputFields = out?.fields && typeof out.fields === 'object' ? Object.keys(out.fields) : [];
        return {
            key,
            title: layer?.title || key,
            description: typeof layer?.description === 'string' ? layer.description : '',
            params: Array.isArray(layer?.trigger?.params) ? layer.trigger.params : [],
            outputFields,
            stepCount: steps.filter(s => s?.type !== 'layer_output').length,
        };
    });
}

/**
 * Keys whose call_layer closure reaches `targetKey` (directly or
 * transitively), INCLUDING targetKey itself. Used by the palette to
 * filter out flowlets that would create a reference cycle when inserted
 * inside `targetKey`'s canvas.
 *
 * @param {object|null} def     whole (root) definition
 * @param {string} targetKey
 * @returns {Set<string>}
 */
export function layerKeysThatReach(def, targetKey) {
    const layers = def?.layers || {};
    // callers[X] = set of flowlet keys that call X directly.
    const callers = new Map();
    for (const [key, layer] of Object.entries(layers)) {
        for (const step of walkSteps(layer?.steps || [])) {
            if (step?.type === 'call_layer' && step.layerKey) {
                if (!callers.has(step.layerKey)) callers.set(step.layerKey, new Set());
                callers.get(step.layerKey).add(key);
            }
        }
    }
    // Reverse-BFS from targetKey: anything that (transitively) calls it.
    const reach = new Set([targetKey]);
    const queue = [targetKey];
    while (queue.length) {
        const cur = queue.pop();
        for (const caller of (callers.get(cur) || [])) {
            if (reach.has(caller)) continue;
            reach.add(caller);
            queue.push(caller);
        }
    }
    return reach;
}

/**
 * Count call_layer steps referencing `key` across the root graph and
 * every flowlet (walking loop bodies / parallel branches too). Used to
 * block deletion of a flowlet that's still in use.
 *
 * @param {object|null} def whole (root) definition
 * @param {string} key
 * @returns {number}
 */
export function countLayerRefs(def, key) {
    if (!def || !key) return 0;
    let count = 0;
    const graphs = [def, ...Object.values(def.layers || {})];
    for (const g of graphs) {
        for (const step of walkSteps(g?.steps || [])) {
            if (step?.type === 'call_layer' && step.layerKey === key) count++;
        }
    }
    return count;
}

/**
 * Remove a flowlet from the definition. Callers must check
 * `countLayerRefs(def, key) === 0` first — this helper does not guard.
 *
 * @param {object} def whole (root) definition
 * @param {string} key
 * @returns {object} new definition without the flowlet
 */
export function deleteLayerFromDefinition(def, key) {
    const { [key]: _removed, ...rest } = def?.layers || {};
    return { ...def, layers: rest };
}

/**
 * True when this flowlet has no steps of its own — nothing has been built in
 * it yet. The palette's "Create flowlet" drops a `call_layer` node as part of
 * creating one, so a brand-new flowlet is instantly "in use" and its delete
 * button greys out; the only way back was to hunt down that call node on the
 * canvas first (BFSF-340). An empty flowlet is safe to remove call sites and
 * all — there is nothing to lose.
 *
 * @param {object|null} def whole (root) definition
 * @param {string} key
 * @returns {boolean}
 */
export function isLayerEmpty(def, key) {
    const layer = def?.layers?.[key];
    if (!layer) return false;
    // layer_output is the flowlet skeleton's terminator, not a user step.
    return !(layer.steps || []).some(s => s && s.type !== 'layer_output');
}

/**
 * Remove a flowlet AND every `call_layer` step that references it, across the
 * root graph and every other flowlet, healing each graph around the removed
 * nodes so nothing downstream is stranded. Nested call sites (inside a loop
 * body or a parallel branch) are dropped from their body array — those arrays
 * carry no edges of their own.
 *
 * @param {object} def whole (root) definition
 * @param {string} key
 * @returns {object} next definition
 */
export function deleteLayerAndCalls(def, key) {
    if (!def || !key) return def;
    const isCall = (s) => s?.type === 'call_layer' && s.layerKey === key;

    const stripNested = (step) => {
        if (!step || typeof step !== 'object') return step;
        let next = step;
        if (Array.isArray(step.body)) {
            next = { ...next, body: step.body.filter(s => !isCall(s)).map(stripNested) };
        }
        if (Array.isArray(step.branches)) {
            next = {
                ...next,
                branches: step.branches.map(branch => (
                    Array.isArray(branch)
                        ? branch.filter(s => !isCall(s)).map(stripNested)
                        : (Array.isArray(branch?.steps)
                            ? { ...branch, steps: branch.steps.filter(s => !isCall(s)).map(stripNested) }
                            : branch)
                )),
            };
        }
        return next;
    };

    const strip = (graph) => {
        if (!graph) return graph;
        const topIds = (graph.steps || []).filter(isCall).map(s => s.id);
        const healed = topIds.length ? applyDeleteNodes(graph, topIds) : graph;
        return { ...healed, steps: (healed.steps || []).map(stripNested) };
    };

    const root = strip(def);
    const layers = Object.fromEntries(
        Object.entries(root.layers || {})
            .filter(([k]) => k !== key)
            .map(([k, layer]) => [k, strip(layer)]),
    );
    return { ...root, layers };
}

/**
 * Where a flowlet is called from, as scope keys ('root' or a flowlet key),
 * one entry per call site. `countLayerRefs` gives the raw total; this names
 * the places, which is what a confirmation prompt needs to be honest about.
 *
 * @param {object|null} def whole (root) definition
 * @param {string} key
 * @returns {string[]}
 */
export function layerCallScopes(def, key) {
    if (!def || !key) return [];
    const out = [];
    for (const step of walkSteps(def.steps || [])) {
        if (step?.type === 'call_layer' && step.layerKey === key) out.push('root');
    }
    for (const [k, layer] of Object.entries(def.layers || {})) {
        for (const step of walkSteps(layer?.steps || [])) {
            if (step?.type === 'call_layer' && step.layerKey === key) out.push(k);
        }
    }
    return out;
}

/**
 * Rename a flowlet's display title (the key is immutable — bindings and
 * call_layer references address flowlets by key, never by title).
 *
 * @param {object} def whole (root) definition
 * @param {string} key
 * @param {string} title
 * @returns {object} new definition
 */
export function renameLayer(def, key, title) {
    const layer = def?.layers?.[key];
    if (!layer) return def;
    return {
        ...def,
        layers: { ...def.layers, [key]: { ...layer, title } },
    };
}

/**
 * Set a flowlet's human/AI-written description (the one-line "what this flowlet
 * does" summary surfaced in the Flowlets drawer, palette, and on call_layer
 * nodes). Like renameLayer this is a pure metadata edit — it never touches
 * the flowlet's trigger/steps/edges, and the runtime ignores it.
 *
 * @param {object} def whole (root) definition
 * @param {string} key
 * @param {string} description
 * @returns {object} new definition
 */
export function setLayerDescription(def, key, description) {
    const layer = def?.layers?.[key];
    if (!layer) return def;
    return {
        ...def,
        layers: { ...def.layers, [key]: { ...layer, description: description || '' } },
    };
}

/**
 * Resolve a flowlet's dependency relationships in both directions, so the UI
 * can show what a flowlet relies on and who relies on it (and let the user
 * jump between them).
 *
 *   calls   — distinct flowlet keys this flowlet references via call_layer
 *             (its dependencies / children), walking loop+parallel bodies.
 *   callers — scopes that reference this flowlet: the literal `'root'` when
 *             the main flow calls it, plus any sibling flowlet keys.
 *
 * @param {object|null} def whole (root) definition
 * @param {string} key
 * @returns {{calls: string[], callers: string[]}}
 */
export function getLayerDependencies(def, key) {
    const layers = def?.layers || {};
    const calls = new Set();
    for (const step of walkSteps(layers[key]?.steps || [])) {
        if (step?.type === 'call_layer' && step.layerKey && step.layerKey !== key) calls.add(step.layerKey);
    }
    const callers = new Set();
    for (const step of walkSteps(def?.steps || [])) {
        if (step?.type === 'call_layer' && step.layerKey === key) { callers.add('root'); break; }
    }
    for (const [k, layer] of Object.entries(layers)) {
        if (k === key) continue;
        for (const step of walkSteps(layer?.steps || [])) {
            if (step?.type === 'call_layer' && step.layerKey === key) { callers.add(k); break; }
        }
    }
    return { calls: [...calls], callers: [...callers] };
}

// ── internals ──────────────────────────────────────────────────────────

/**
 * Depth-first walk over a steps array, descending into loop bodies
 * (`step.body`) and parallel branches (`step.branches` — either arrays
 * of steps or `{steps: []}` objects).
 */
function* walkSteps(steps) {
    for (const step of steps || []) {
        if (!step) continue;
        yield step;
        if (Array.isArray(step.body)) yield* walkSteps(step.body);
        if (Array.isArray(step.branches)) {
            for (const branch of step.branches) {
                if (Array.isArray(branch)) yield* walkSteps(branch);
                else if (Array.isArray(branch?.steps)) yield* walkSteps(branch.steps);
            }
        }
    }
}

/**
 * Slugify a title into a valid layer key and append a short random
 * suffix; retries until unique within `existing`.
 */
function uniqueLayerKey(title, existing) {
    let slug = String(title || 'layer')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_{2,}/g, '_')
        .slice(0, 40);
    if (!LAYER_KEY_RE.test(slug)) slug = `layer${slug ? `_${slug}` : ''}`;
    if (!LAYER_KEY_RE.test(slug)) slug = 'layer';
    let key = `${slug}_${randomSuffix()}`;
    while (existing[key]) key = `${slug}_${randomSuffix()}`;
    return key;
}

function randomSuffix() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID().replace(/-/g, '').slice(0, 4);
    }
    return Math.random().toString(36).slice(2, 6);
}
