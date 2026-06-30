/**
 * Automatic input mapping for the automation builder.
 *
 * When the user connects A → B (or drops B downstream of A), fill B's
 * still-empty inputs with `{kind:'ref'}` bindings to matching upstream
 * outputs. CONSERVATIVE by design (the user's explicit choice): only exact
 * and normalized name matches, gated by type, never overwriting a field the
 * user set. Every map is surfaced to the user (toast + per-field badge) and
 * is trivially reversible — so a wrong guess is cheap, but we avoid them.
 */

import { isEmptyBinding } from './partitionInputs';
import {
    computeUpstreamGroups,
    buildToolOutputMap,
    inferLoopItemSample,
    sampleToFields,
    suggestItemVar,
} from './upstream';
import { getLayerContract } from '../flow/flowletScope';

// ── small pure helpers (exported for tests) ───────────────────────────────

export function normalizeKey(name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function sampleType(v) {
    if (v === null || v === undefined) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v; // 'string' | 'number' | 'boolean' | 'object'
}

export function isSecretLikeKey(key) {
    return /(password|passwd|secret|token|apikey|api[_-]?key|credential|client[_-]?secret|private[_-]?key)/i
        .test(String(key || ''));
}

/** JSON-Schema property type vs an upstream sample's type. Permissive when unknown. */
function typeCompatible(propType, candType) {
    if (!propType || !candType || candType === 'null') return true;
    let pt = propType;
    if (Array.isArray(pt)) pt = pt.find(t => t !== 'null') || pt[0];
    if (pt === 'integer') pt = 'number';
    if (pt === 'string') return ['string', 'number', 'boolean'].includes(candType);
    return pt === candType;
}

/** Resolve a tool's inputSchema from the catalog. */
export function findInputSchemaForTool(catalog, tool) {
    for (const app of (catalog?.apps || [])) {
        for (const action of (app.actions || [])) {
            if (action?.name === tool) return action.inputSchema || null;
        }
    }
    return null;
}

/** Flatten upstream groups (and one nesting level) into candidate fields. */
function flattenCandidates(groups) {
    const out = [];
    (groups || []).forEach((g, gi) => {
        let fi = 0;
        for (const f of (g.fields || [])) {
            out.push({ key: f.key, path: f.path, type: sampleType(f.sample), groupIndex: gi, fieldIndex: fi++ });
            for (const c of (f.children || [])) {
                out.push({ key: c.key, path: c.path, type: sampleType(c.sample), groupIndex: gi, fieldIndex: fi++ });
            }
        }
    });
    return out;
}

/** Nearest = highest groupIndex (closest upstream node), then earliest field. */
function chooseNearest(list, used) {
    if (!list.length) return null;
    const unused = list.filter(c => !used.has(c.path));
    const pool = unused.length ? unused : list;
    return pool.slice().sort((a, b) => (b.groupIndex - a.groupIndex) || (a.fieldIndex - b.fieldIndex))[0];
}

function bestCandidate(key, propType, candidates, used) {
    const nkey = normalizeKey(key);
    // tier 1: exact key match
    const tier1 = candidates.filter(c => c.key === key && typeCompatible(propType, c.type));
    const pick1 = chooseNearest(tier1, used);
    if (pick1) return pick1;
    // tier 2: normalized match (snake/camel/case differences)
    const tier2 = candidates.filter(c => normalizeKey(c.key) === nkey && typeCompatible(propType, c.type));
    return chooseNearest(tier2, used) || null;
}

const ARRAY_NAME_RE = /items|results|rows|records|data|list|messages|emails|events|files|entries/i;

/** Nearest upstream array-typed field path (for loop/filter overRef/arrayRef). */
export function nearestArrayRef(groups) {
    for (let gi = (groups || []).length - 1; gi >= 0; gi--) {
        const fields = groups[gi].fields || [];
        const preferred = fields.find(f => sampleType(f.sample) === 'array' && ARRAY_NAME_RE.test(f.key));
        if (preferred) return preferred.path;
        const anyArr = fields.find(f => sampleType(f.sample) === 'array');
        if (anyArr) return anyArr.path;
    }
    return null;
}

// ── iteration ("run once per item") detection ─────────────────────────────

function lastSegmentKey(path) {
    const parts = String(path || '').split('.');
    return parts[parts.length - 1] || '';
}

/** `messageId` / `message_id` → 'message'; null when the key isn't id-suffixed. */
function idAffinityBase(key) {
    const m = /^(.+?)[_]?id$/i.exec(String(key || ''));
    return m && m[1] ? m[1] : null;
}

/**
 * When a step's REQUIRED inputs can't be filled from scalar upstream fields
 * but the nearest upstream is an ARRAY of objects whose element fields
 * match, set up per-item iteration: bind matching inputs to
 * `loop.<itemVar>.<field>` and return the `forEach` config the runtime
 * fans out over (see execForEachStep on the server).
 *
 * Conservative: only fires from a declared schema, only for inputs the
 * scalar pass left empty, only on exact / normalized name + type matches
 * (plus a single `<entity>Id` ↔ element `id` affinity for the primary
 * identifier — the dominant list→read pattern), and only when at least one
 * REQUIRED input is satisfied per item. Returns null otherwise.
 */
function tryIterationMapping(schema, existingInputs, groups, definition, catalog) {
    const properties = schema?.properties || null;
    if (!properties) return null;                  // need types + required to be safe
    const required = new Set(schema?.required || []);
    if (!required.size) return null;               // only auto-iterate to satisfy required inputs
    const overRef = nearestArrayRef(groups);
    if (!overRef) return null;
    const elementSample = inferLoopItemSample(overRef, definition, buildToolOutputMap(catalog));
    if (!elementSample || typeof elementSample !== 'object' || Array.isArray(elementSample)) return null;

    const itemVar = suggestItemVar(lastSegmentKey(overRef));
    const candidates = [];
    for (const f of sampleToFields(elementSample, `loop.${itemVar}`)) {
        candidates.push({ key: f.key, path: f.path, type: sampleType(f.sample) });
        for (const c of (f.children || [])) candidates.push({ key: c.key, path: c.path, type: sampleType(c.sample) });
    }
    if (!candidates.length) return null;
    const idField = candidates.find(c => c.key === 'id');

    const patch = {};
    const used = new Set();
    let matchedRequired = false;
    let idAffinityUsed = false;
    // Required first so they win the element's `id` field over optionals.
    const keys = Object.keys(properties).sort((a, b) => (required.has(b) ? 1 : 0) - (required.has(a) ? 1 : 0));
    for (const key of keys) {
        if (!isEmptyBinding((existingInputs || {})[key])) continue;
        if (isSecretLikeKey(key)) continue;
        const propType = properties[key]?.type;
        const nkey = normalizeKey(key);
        let match = candidates.find(c => !used.has(c.path) && c.key === key && typeCompatible(propType, c.type))
            || candidates.find(c => !used.has(c.path) && normalizeKey(c.key) === nkey && typeCompatible(propType, c.type));
        // id-affinity: `<entity>Id` ↔ element `id`, applied once to the
        // primary identifier (required keys sort first, so it wins it).
        if (!match && !idAffinityUsed && idField && !used.has(idField.path) && idAffinityBase(key) && typeCompatible(propType, idField.type)) {
            match = idField;
            idAffinityUsed = true;
        }
        if (!match) continue;
        patch[key] = { kind: 'ref', path: match.path };
        used.add(match.path);
        if (required.has(key)) matchedRequired = true;
    }
    if (!matchedRequired) return null;
    return { patch, forEach: { overRef, itemVar, maxIterations: 100 } };
}

// ── core ──────────────────────────────────────────────────────────────────

/**
 * @param {object|null} targetInputSchema  { properties, required } or null (generic)
 * @param {object} existingInputs          current inputs map (never overwritten)
 * @param {Array}  upstreamGroups          computeUpstreamGroups output (nearest last)
 * @param {object} opts                    { maxPerStep }
 * @returns {object}  partial inputs patch — only NEW {kind:'ref'} bindings
 */
export function autoMapInputs(targetInputSchema, existingInputs, upstreamGroups, opts = {}) {
    const { maxPerStep = 12 } = opts;
    const properties = targetInputSchema?.properties || null;
    const required = new Set(targetInputSchema?.required || []);
    const candidates = flattenCandidates(upstreamGroups);
    if (!candidates.length) return {};

    // Generic (no schema): only consider keys that already exist on the step
    // (never invent keys); schema mode: all declared properties.
    let keys = properties ? Object.keys(properties) : Object.keys(existingInputs || {});
    // Required first so the most important fields win the nearest candidate.
    keys = keys.slice().sort((a, b) => (required.has(b) ? 1 : 0) - (required.has(a) ? 1 : 0));

    const patch = {};
    const used = new Set();
    for (const key of keys) {
        if (Object.keys(patch).length >= maxPerStep) break;
        if (!isEmptyBinding((existingInputs || {})[key])) continue; // respect the user
        if (isSecretLikeKey(key)) continue;
        const propType = properties?.[key]?.type;
        const match = bestCandidate(key, propType, candidates, used);
        if (!match) continue;
        patch[key] = { kind: 'ref', path: match.path };
        used.add(match.path);
    }
    return patch;
}

/**
 * Build a pseudo input-schema for a call_layer node. The contract derives
 * live from `definition.layers[step.layerKey]` (inline flowlets). When the
 * definition in hand has no layers map (e.g. the canvas is scoped inside
 * a flowlet and a sibling call_layer is being mapped), fall back to the
 * step's existing input keys — generic mode, never inventing keys.
 */
function layerParamSchema(step, definition) {
    const { params } = getLayerContract(definition, step.layerKey);
    if (params.length) {
        return {
            properties: Object.fromEntries(params.map(p => [p.name, { type: p.type }])),
            required: params.filter(p => p.required).map(p => p.name),
        };
    }
    const keys = Object.keys(step.inputs || {});
    return { properties: Object.fromEntries(keys.map(k => [k, {}])), required: [] };
}

function isScaffoldOverRef(ref) {
    return !ref || ref === 'trigger.output.items';
}

/**
 * Auto-map a single step against its upstream context. Returns the
 * (possibly) updated step plus the list of keys/fields that were mapped.
 * `definition` must already contain `step` and its incoming edge so
 * upstream resolves correctly.
 */
export function autoMapStep(step, definition, catalog, opts = {}) {
    if (!step || !definition) return { step, mappedKeys: [] };
    const groups = computeUpstreamGroups(definition, step.id, catalog);
    if (!groups.length) return { step, mappedKeys: [] };

    const type = step.type;

    if (type === 'integration_action') {
        const schema = findInputSchemaForTool(catalog, step.tool);
        const patch = autoMapInputs(schema, step.inputs || {}, groups, opts);
        let nextInputs = { ...(step.inputs || {}), ...patch };
        let keys = Object.keys(patch);
        let forEach = null;
        // Iteration fallback: a required input is still empty AND the nearest
        // upstream is an array of objects whose elements match → fan out once
        // per item. Never override an existing forEach the user set.
        if (!step.forEach) {
            const iter = tryIterationMapping(schema, nextInputs, groups, definition, catalog);
            if (iter) {
                nextInputs = { ...nextInputs, ...iter.patch };
                keys = [...keys, ...Object.keys(iter.patch)];
                forEach = iter.forEach;
            }
        }
        if (!keys.length && !forEach) return { step, mappedKeys: [] };
        const nextStep = { ...step, inputs: nextInputs };
        if (forEach) nextStep.forEach = forEach;
        return { step: nextStep, mappedKeys: keys, forEachEnabled: !!forEach };
    }

    if (type === 'call_layer') {
        const schema = layerParamSchema(step, definition);
        const patch = autoMapInputs(schema, step.inputs || {}, groups, opts);
        const keys = Object.keys(patch);
        if (!keys.length) return { step, mappedKeys: [] };
        return { step: { ...step, inputs: { ...(step.inputs || {}), ...patch } }, mappedKeys: keys };
    }

    if (type === 'ai_step') {
        // Generic: only fill existing input keys (don't invent prompt inputs).
        const patch = autoMapInputs(null, step.inputs || {}, groups, opts);
        const keys = Object.keys(patch);
        if (!keys.length) return { step, mappedKeys: [] };
        return { step: { ...step, inputs: { ...(step.inputs || {}), ...patch } }, mappedKeys: keys };
    }

    if (type === 'set') {
        const patch = autoMapInputs(null, step.fields || {}, groups, opts);
        const keys = Object.keys(patch);
        if (!keys.length) return { step, mappedKeys: [] };
        return { step: { ...step, fields: { ...(step.fields || {}), ...patch } }, mappedKeys: keys };
    }

    if (type === 'loop') {
        if (!isScaffoldOverRef(step.overRef)) return { step, mappedKeys: [] };
        const ref = nearestArrayRef(groups);
        if (!ref) return { step, mappedKeys: [] };
        return { step: { ...step, overRef: ref }, mappedKeys: ['overRef'] };
    }

    if (['filter', 'limit', 'dedupe', 'aggregate', 'summarize'].includes(type)) {
        if (step.arrayRef) return { step, mappedKeys: [] };
        const ref = nearestArrayRef(groups);
        if (!ref) return { step, mappedKeys: [] };
        return { step: { ...step, arrayRef: ref }, mappedKeys: ['arrayRef'] };
    }

    // condition / switch / code / notification / datetime / wait / stop_error:
    // no safe automatic binding.
    return { step, mappedKeys: [] };
}

/**
 * Apply auto-mapping to one step inside a definition, returning a new
 * definition with the step updated plus the mapped key list. Records the
 * mapped *input* keys on `step.autoMapped` so the inspector can show the
 * "auto" pill (overRef/arrayRef aren't inputs, so they're excluded from
 * the marker but still counted in mappedKeys for the toast).
 */
export function applyAutoMapToStep(definition, stepId, catalog, opts = {}) {
    const steps = definition?.steps || [];
    const idx = steps.findIndex(s => s.id === stepId);
    if (idx === -1) return { definition, mappedKeys: [], forEachEnabled: false };
    const { step: mapped, mappedKeys, forEachEnabled } = autoMapStep(steps[idx], definition, catalog, opts);
    if (!mappedKeys.length && !forEachEnabled) return { definition, mappedKeys: [], forEachEnabled: false };
    const inputKeys = mappedKeys.filter(k => k !== 'overRef' && k !== 'arrayRef');
    const withMarker = inputKeys.length
        ? { ...mapped, autoMapped: Array.from(new Set([...(mapped.autoMapped || []), ...inputKeys])) }
        : mapped;
    const nextSteps = steps.slice();
    nextSteps[idx] = withMarker;
    return { definition: { ...definition, steps: nextSteps }, mappedKeys, forEachEnabled: !!forEachEnabled };
}
