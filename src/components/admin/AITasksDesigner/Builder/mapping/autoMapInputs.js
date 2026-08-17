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
import { buildSampleRoot } from './realOutputs';
import {
    computeUpstreamGroups,
    buildToolOutputMap,
    inferLoopItemSample,
    sampleToFields,
    suggestItemVar,
} from './upstream';
import { getLayerContract } from '../flow/flowletScope';
import { reconcileRouteEdges } from '../flow/routeEdges';

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
            // Same reason as the `[*]` children below: a per-iteration field
            // (upstream.js wrapGroupForEach) resolves to ONE VALUE PER
            // ITERATION, so auto-mapping it into a scalar param would be
            // wrong. It stays pickable by hand (BFSF-369).
            if (f.perIteration) { fi++; continue; }
            out.push({ key: f.key, path: f.path, type: sampleType(f.sample), groupIndex: gi, fieldIndex: fi++ });
            for (const c of (f.children || [])) {
                // Element children (`items[*].<key>`) carry a SCALAR sample but
                // resolve to an ARRAY at runtime ([*] flatten-maps) — auto-mapping
                // one into a scalar tool param would be wrong. Skip them here;
                // they stay pickable by hand in the tree/picker.
                if (/\[\*\]/.test(c.path)) continue;
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
        // A per-iteration column is an array only because it has one entry per
        // iteration — "loop over the counts an earlier loop produced" is never
        // what the author meant, so it is not a candidate source (BFSF-369).
        const fields = (groups[gi].fields || []).filter(f => !f.perIteration);
        const preferred = fields.find(f => sampleType(f.sample) === 'array' && ARRAY_NAME_RE.test(f.key));
        if (preferred) return preferred.path;
        const anyArr = fields.find(f => sampleType(f.sample) === 'array');
        if (anyArr) return anyArr.path;
    }
    return null;
}

// Field names that carry the free text a person actually wrote — where
// personal data lives, as opposed to an id or a status flag.
//
// ORDERED, not one alternation: a mail has both `subject` and `body`, and
// whichever came first in the field list would win. The long-form fields are
// where a name or an address actually turns up, so they are preferred over a
// one-line subject.
const SCANNABLE_NAME_RES = [
    /^(body|text|content|transcript|full_?text)$/i,
    /body|text|content|transcript|message|description|summary|notes?|comment|answer|html/i,
    /subject|title|name/i,
];

/**
 * The nearest upstream value worth handing a PII detector.
 *
 * Prefers a text field by name, then any string, and falls back to the whole
 * output of the nearest step — an object is scanned as its JSON, so "check
 * everything that step produced" is a real answer rather than a guess.
 */
export function nearestScannableRef(groups) {
    for (const re of SCANNABLE_NAME_RES) {
        for (let gi = (groups || []).length - 1; gi >= 0; gi--) {
            const fields = groups[gi].fields || [];
            const named = fields.find(f => sampleType(f.sample) === 'string' && re.test(f.key));
            if (named) return named.path;
        }
    }
    for (let gi = (groups || []).length - 1; gi >= 0; gi--) {
        const anyText = (groups[gi].fields || []).find(f => sampleType(f.sample) === 'string');
        if (anyText) return anyText.path;
    }
    const nearest = (groups || [])[(groups || []).length - 1];
    return nearest?.basePath || null;
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
    // Resolve the element against the groups' own sample tree — with real
    // run/pinned data in the groups, the element shape is a real row.
    const elementSample = inferLoopItemSample(overRef, definition, buildToolOutputMap(catalog), buildSampleRoot(groups));
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

/**
 * Is this over/arrayRef still the palette scaffold (never user-chosen)?
 * The literal 'trigger.output.items' is the legacy seed every Lists/Loop node
 * used to carry — treating it as scaffold lets auto-map heal already-saved
 * nodes on re-connect. New nodes seed '' (C20).
 */
function isScaffoldOverRef(ref) {
    return !ref || ref === 'trigger.output.items';
}

/**
 * Is this condition still the untouched palette scaffold? `buildStepFromPayload`
 * seeds `expr: 'true'` (the parser needs something valid); anything else means
 * the author has already said what the step decides, and auto-detection must
 * keep its hands off.
 */
function isScaffoldExpr(expr) {
    const src = String(expr || '').trim();
    return src === '' || src === 'true';
}

/**
 * Auto-map a single step against its upstream context. Returns the
 * (possibly) updated step plus the list of keys/fields that were mapped.
 * `definition` must already contain `step` and its incoming edge so
 * upstream resolves correctly.
 */
export function autoMapStep(step, definition, catalog, opts = {}) {
    if (!step || !definition) return { step, mappedKeys: [] };
    // opts.realOutputById (mapping/realOutputs.js) folds run/pinned outputs
    // into the groups — so a node added below a step that just produced 10
    // real records maps against those records, not against placeholders.
    const groups = computeUpstreamGroups(definition, step.id, catalog, opts.realOutputById || null);
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

    if (type === 'guard' || type === 'tokenize' || type === 'untokenize') {
        // A guard dropped below a step almost always means "check what that
        // step just produced". Binding it on arrival is the difference between
        // a node that works and one that greets you with a warning — and an
        // author who has already chosen a source is never overridden.
        if (typeof step.sourceRef === 'string' && step.sourceRef.trim()) return { step, mappedKeys: [] };
        const ref = nearestScannableRef(groups);
        if (!ref) return { step, mappedKeys: [] };
        return { step: { ...step, sourceRef: ref }, mappedKeys: ['sourceRef'] };
    }

    if (type === 'set') {
        // Auto-detect list input, mirroring the condition→filter detection
        // below: a PRISTINE scaffold (no fields, no forEach, no arrayRef, no
        // operations — i.e. the user hasn't said anything yet) wired below a
        // step that hands it a list almost always means "edit these rows", so
        // it becomes a list-mode Edit data with the source already bound. The
        // mode stays overridable under Advanced, and a step the user has
        // touched in ANY way is left alone.
        const pristine = !Object.keys(step.fields || {}).length
            && !step.forEach
            && typeof step.arrayRef !== 'string'
            && !(Array.isArray(step.operations) && step.operations.length);
        if (pristine) {
            const ref = nearestArrayRef(groups);
            if (ref) return { step: { ...step, arrayRef: ref }, mappedKeys: ['arrayRef'] };
        }
        // List mode with a blank source ('' — e.g. flipped on under Advanced)
        // binds like any collection op.
        if (typeof step.arrayRef === 'string' && isScaffoldOverRef(step.arrayRef)) {
            const ref = nearestArrayRef(groups);
            if (ref) return { step: { ...step, arrayRef: ref }, mappedKeys: ['arrayRef'] };
        }
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

    // The Condition node detects what it is deciding ABOUT instead of asking. A
    // freshly dropped one is a `condition` (the whole run); if the step it is
    // wired to hands it a list, working through that list is what the author
    // almost always means — so it becomes a list-mode Filter with the source
    // already bound, and the form has nothing left to fill in.
    //
    // Guarded three ways so it can never fight the user: only while the
    // condition still carries its scaffold expression, only when it has no
    // outgoing edges yet (nothing to re-point), and never for a switch that
    // already declares cases. The mode stays overridable under Advanced.
    if (type === 'condition') {
        if (!isScaffoldExpr(step.expr)) return { step, mappedKeys: [] };
        const ref = nearestArrayRef(groups);
        if (!ref) return { step, mappedKeys: [] };
        return { step: { ...step, type: 'filter', arrayRef: ref }, mappedKeys: ['arrayRef'] };
    }

    // A switch already IN list mode (the key is present but blank) gets its
    // source bound like any collection op; a branch-mode switch is left alone
    // — binding a source there would silently change what it decides about.
    if (type === 'switch') {
        if (typeof step.arrayRef !== 'string' || !isScaffoldOverRef(step.arrayRef)) return { step, mappedKeys: [] };
        const ref = nearestArrayRef(groups);
        if (!ref) return { step, mappedKeys: [] };
        return { step: { ...step, arrayRef: ref }, mappedKeys: ['arrayRef'] };
    }

    if (['filter', 'limit', 'dedupe', 'aggregate', 'summarize'].includes(type)) {
        // Scaffold-aware like the loop branch above: the old `if (step.arrayRef)`
        // guard bailed on ANY truthy value, and the palette always seeded the
        // 'trigger.output.items' literal — so auto-map NEVER bound a Lists
        // node's source list, and manual/schedule-triggered flows silently ran
        // the op over a non-existent array (C20).
        if (!isScaffoldOverRef(step.arrayRef)) return { step, mappedKeys: [] };
        const ref = nearestArrayRef(groups);
        if (!ref) return { step, mappedKeys: [] };
        return { step: { ...step, arrayRef: ref }, mappedKeys: ['arrayRef'] };
    }

    // switch / code / notification / datetime / wait / stop_error: no safe
    // automatic binding.
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
    let next = { ...definition, steps: nextSteps };
    // Detecting list mode changes the Condition node's TYPE, which renames its
    // output ports (then/else → one plain continuation). Re-point its edges in
    // the same commit — a step spliced onto an existing connection already has
    // an outgoing edge by the time auto-map runs.
    if (withMarker.type !== steps[idx].type) {
        next = reconcileRouteEdges(next, stepId, steps[idx], withMarker);
    }
    return { definition: next, mappedKeys, forEachEnabled: !!forEachEnabled };
}
