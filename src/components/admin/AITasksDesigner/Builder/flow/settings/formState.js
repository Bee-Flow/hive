// §WS5 — pure form <-> step-shape helpers extracted verbatim from
// SettingsForm.jsx. No JSX/React; schemaToFields/fieldsToSchema keep their
// public export (re-exported by SettingsForm for ToolInputForm + tests).
import { paramsToSchema, schemaToParams } from '../triggerSchemaUtils';

/** Move the previous binding's value into the new shape so the user
 *  doesn't lose what they typed when toggling kind. */
export function convertValue(binding, fromKind, toKind) {
    if (!binding) return {};
    if (fromKind === toKind) return {};
    const carry = binding.value ?? binding.path ?? '';
    if (toKind === 'literal')  return { value: typeof carry === 'string' ? carry : String(carry), path: undefined };
    if (toKind === 'ref')      return { path: typeof carry === 'string' ? carry : '', value: undefined };
    if (toKind === 'template') return { value: typeof carry === 'string' ? carry : '', path: undefined };
    if (toKind === 'expr')     return { value: typeof carry === 'string' ? carry : '', path: undefined };
    return {};
}

// ── Form ↔ step shape helpers ──────────────────────────────────────────

export function defaultLabelPlaceholder(step) {
    if (step.type === 'integration_action') return step.tool || step.type;
    if (step.type === 'trigger') return 'Trigger';
    return step.type;
}

export function extractFormState(step) {
    if (!step) return {};
    const base = { label: step.label || '', icon: step.icon || '' };
    if (step.type === 'trigger') {
        const kind = step.kind || 'manual';
        return {
            ...base,
            kind,
            scheduleCron: step.schedule?.cron || '',
            scheduleTz:   step.schedule?.tz || 'Europe/Amsterdam',
            appProvider:  step.appEvent?.provider || 'gmail',
            appEventName: step.appEvent?.event || 'mail.new',
            filter:       step.appEvent?.filter || {},
            // Agent trigger (kind === 'agent_call').
            toolName:     step.toolName || '',
            description:  step.description || '',
            // params is shared between layer_input (declared inline) and
            // agent_call (derived from the persisted JSON Schema).
            params:       kind === 'agent_call'
                ? schemaToParams(step.parametersSchema)
                : (Array.isArray(step.params) ? step.params : []),
        };
    }
    if (step.type === 'ai_step') {
        return {
            ...base,
            prompt: step.prompt || '',
            systemPrompt: step.systemPrompt || '',
            modelTier: step.modelTier || 'auto',
            allowTools: !!step.allowTools,
            // Explicit per-tool allowlist (function names). `null` = not set:
            // combined with allowTools it means the legacy "all permitted tools".
            tools: Array.isArray(step.tools) ? step.tools : null,
            inputs: step.inputs || {},
            outputFields: schemaToFields(step.outputSchema),
        };
    }
    if (step.type === 'integration_action') {
        return {
            ...base,
            tool: step.tool || '',
            appId: step.appId || null,
            sideEffect: step.sideEffect ?? null,
            inputs: step.inputs || {},
            forEach: step.forEach || null,
        };
    }
    if (step.type === 'condition')    return { ...base, expr: step.expr || '' };
    if (step.type === 'loop')         return { ...base, overRef: step.overRef || '', itemVar: step.itemVar || '', maxIterations: step.maxIterations ?? 100 };
    if (step.type === 'code')         return { ...base, code: step.code || '' };
    if (step.type === 'notification') return { ...base, title: step.title || '', body: step.body || '' };
    // Flowlets (inline — contract derives from rootDefinition, not the step)
    if (step.type === 'call_layer')   return { ...base, inputs: step.inputs || {} };
    // Steps (external — contract derives from the catalog, not the step)
    if (step.type === 'call_block')   return { ...base, inputs: step.inputs || {} };
    if (step.type === 'layer_output') return { ...base, fields: step.fields || {} };
    // n8n-style utility nodes
    if (step.type === 'set')          return { ...base, fields: step.fields || {} };
    if (step.type === 'datetime')     return {
        ...base,
        op: step.op || 'now',
        input: step.input || '',
        input2: step.input2 || '',
        amount: typeof step.amount === 'number' ? step.amount : 0,
        format: step.format || 'yyyy-MM-dd HH:mm',
        part: step.part || 'year',
        unit: step.unit || 'days',
    };
    if (step.type === 'wait')         return { ...base, seconds: typeof step.seconds === 'number' ? step.seconds : 5 };
    if (step.type === 'stop_error')   return { ...base, message: step.message || '' };
    if (step.type === 'switch')       return {
        ...base,
        expr: step.expr || '',
        cases: Array.isArray(step.cases) ? step.cases : [],
        defaultBranch: step.defaultBranch || '',
    };
    if (step.type === 'filter')       return { ...base, arrayRef: step.arrayRef || '', expr: step.expr || '' };
    if (step.type === 'limit')        return { ...base, arrayRef: step.arrayRef || '', count: typeof step.count === 'number' ? step.count : 10, mode: step.mode || 'first' };
    if (step.type === 'dedupe')       return { ...base, arrayRef: step.arrayRef || '', keyField: step.keyField || '' };
    if (step.type === 'aggregate')    return { ...base, arrayRef: step.arrayRef || '', field: step.field || '' };
    if (step.type === 'summarize')    return { ...base, arrayRef: step.arrayRef || '', field: step.field || '', op: step.op || 'sum' };
    return base;
}

/**
 * Translate the form draft back into the persisted-step shape. We only
 * include keys that this form actually edits — everything else (id,
 * outputSchema, side-effect flag, etc.) is preserved by the inspector's
 * patch-merge.
 */
export function buildPatch(step, draft) {
    const patch = { label: draft.label || null, icon: draft.icon || null };
    // Lock a field against AI auto-naming once the user sets it by hand. Only
    // touch the flag when the value actually changed in this edit, so re-saving
    // an AI-suggested value doesn't silently lock it. Clearing a field (empty)
    // unlocks it so the auto-namer can fill it again.
    if ((draft.label || '') !== (step.label || '')) patch.labelManual = draft.label ? true : null;
    if ((draft.icon || '') !== (step.icon || '')) patch.iconManual = draft.icon ? true : null;

    if (step.type === 'trigger') {
        patch.kind = draft.kind || 'manual';
        // Preserve any existing schedule/appEvent objects so we don't
        // wipe sibling fields the form doesn't know about.
        if (draft.kind === 'schedule') {
            patch.schedule = { ...(step.schedule || {}), cron: draft.scheduleCron || '', tz: draft.scheduleTz || 'Europe/Amsterdam' };
            patch.appEvent = null;
        } else if (draft.kind === 'app_event') {
            const cleanedFilter = stripUndefined(draft.filter || {});
            patch.appEvent = {
                ...(step.appEvent || {}),
                provider: draft.appProvider || 'gmail',
                event: draft.appEventName || 'mail.new',
                filter: Object.keys(cleanedFilter).length ? cleanedFilter : null,
            };
            patch.schedule = null;
        } else if (draft.kind === 'agent_call') {
            // Exposed as a function tool; the params-list becomes a JSON Schema.
            patch.toolName = (draft.toolName || '').trim() || null;
            patch.description = (draft.description || '').trim() || null;
            patch.parametersSchema = paramsToSchema(draft.params);
            patch.schedule = null;
            patch.appEvent = null;
        } else if (draft.kind === 'layer_input') {
            // Flowlet input contract — declared params become trigger.output.<name>.
            patch.params = Array.isArray(draft.params)
                ? draft.params.filter(p => p && p.name).map(p => ({
                    name: p.name, type: p.type || 'string', required: !!p.required,
                    ...(p.description ? { description: p.description } : {}),
                }))
                : [];
            patch.schedule = null;
            patch.appEvent = null;
        } else {
            patch.schedule = null;
            patch.appEvent = null;
        }
    }

    if (step.type === 'ai_step') {
        patch.prompt = draft.prompt || '';
        patch.systemPrompt = draft.systemPrompt?.trim() ? draft.systemPrompt.trim() : null;
        patch.modelTier = draft.modelTier || 'auto';
        // When the user has made an explicit tool selection, persist the
        // allowlist and derive allowTools from it (the runner only loads tools
        // when allowTools is on). Untouched legacy steps keep `tools` absent and
        // their original allowTools, so "all permitted tools" behaviour stays.
        if (Array.isArray(draft.tools)) {
            patch.tools = draft.tools;
            patch.allowTools = draft.tools.length > 0;
        } else {
            patch.allowTools = !!draft.allowTools;
        }
        patch.inputs = sanitizeInputs(draft.inputs || {});
        patch.outputSchema = fieldsToSchema(draft.outputFields || []);
    }
    if (step.type === 'integration_action') {
        patch.inputs = sanitizeInputs(draft.inputs || {});
        // Operation switcher (single-node, n8n-style): the node's tool can
        // change in place. Persist tool + appId + the authoritative sideEffect
        // flag so the badge, dry-run handling, and downstream schema stay
        // correct after a switch. Always send tool (unchanged on normal edits).
        patch.tool = draft.tool || step.tool || '';
        if (draft.appId || step.appId) patch.appId = draft.appId || step.appId;
        if (draft.sideEffect != null) patch.sideEffect = draft.sideEffect;
        // Per-step iteration ("run once per item"). Persist when enabled;
        // send null to clear an existing one when the user toggles it off.
        if (draft.forEach) {
            patch.forEach = {
                overRef: draft.forEach.overRef || '',
                itemVar: draft.forEach.itemVar || 'item',
                maxIterations: clamp(Number(draft.forEach.maxIterations) || 100, 1, 1000),
            };
        } else if (step.forEach) {
            patch.forEach = null;
        }
    }
    if (step.type === 'condition')    patch.expr = draft.expr || '';
    if (step.type === 'loop') {
        patch.overRef = draft.overRef || '';
        patch.itemVar = draft.itemVar || '';
        patch.maxIterations = clamp(Number(draft.maxIterations) || 100, 1, 1000);
    }
    if (step.type === 'code')         patch.code = draft.code || '';
    if (step.type === 'notification') {
        patch.title = draft.title || '';
        patch.body = draft.body || '';
    }
    // Flowlets
    if (step.type === 'call_layer') {
        patch.inputs = sanitizeInputs(draft.inputs || {});
    }
    if (step.type === 'call_block') {
        patch.inputs = sanitizeInputs(draft.inputs || {});
    }
    if (step.type === 'layer_output') {
        patch.fields = sanitizeFieldMap(draft.fields || {});
    }
    // n8n-style utility nodes
    if (step.type === 'set') {
        patch.fields = sanitizeFieldMap(draft.fields || {});
    }
    if (step.type === 'datetime') {
        patch.op = draft.op || 'now';
        patch.input = draft.input || undefined;
        patch.input2 = draft.input2 || undefined;
        patch.amount = typeof draft.amount === 'number' ? draft.amount : undefined;
        patch.format = draft.format || undefined;
        patch.part = draft.part || undefined;
        patch.unit = draft.unit || undefined;
    }
    if (step.type === 'wait')       patch.seconds = clamp(Number(draft.seconds) || 1, 1, 86400);
    if (step.type === 'stop_error') patch.message = draft.message || '';
    if (step.type === 'switch') {
        patch.expr = draft.expr || '';
        patch.cases = Array.isArray(draft.cases) ? draft.cases.filter(c => c && c.name) : [];
        patch.defaultBranch = draft.defaultBranch?.trim() ? draft.defaultBranch.trim() : null;
    }
    if (step.type === 'filter') {
        patch.arrayRef = draft.arrayRef || '';
        patch.expr = draft.expr || '';
    }
    if (step.type === 'limit') {
        patch.arrayRef = draft.arrayRef || '';
        patch.count = Math.max(0, Math.floor(Number(draft.count) || 0));
        patch.mode = draft.mode === 'last' ? 'last' : 'first';
    }
    if (step.type === 'dedupe') {
        patch.arrayRef = draft.arrayRef || '';
        patch.keyField = draft.keyField?.trim() ? draft.keyField.trim() : undefined;
    }
    if (step.type === 'aggregate') {
        patch.arrayRef = draft.arrayRef || '';
        patch.field = draft.field || '';
    }
    if (step.type === 'summarize') {
        patch.arrayRef = draft.arrayRef || '';
        patch.field = draft.field || '';
        patch.op = draft.op || 'sum';
    }
    return patch;
}

/** Drop bindings that have neither a value nor a path so we don't
 *  persist a half-edited row that fails validation. */
function sanitizeInputs(inputs) {
    const out = {};
    for (const [k, v] of Object.entries(inputs || {})) {
        if (!v || typeof v !== 'object') continue;
        if (v.kind === 'literal' && (v.value === '' || v.value == null)) continue;
        if (v.kind === 'ref' && !v.path) continue;
        if ((v.kind === 'template' || v.kind === 'expr') && !v.value) continue;
        out[k] = v;
    }
    return out;
}

/**
 * Sanitize a USER-DEFINED field map (Set / layer_output return). Unlike
 * sanitizeInputs — which is for tool PARAMS, where an empty value means
 * "omit this param" — the keys here are the user's OWN named fields. A field
 * the user just added but hasn't given a value yet MUST survive the save
 * round-trip; otherwise the autosave strips it and the form re-hydrates
 * without the row, so it vanishes mid-edit. We therefore keep every entry
 * with a non-empty key and a binding object, regardless of an empty value;
 * only blank-key / non-object entries are dropped.
 */
function sanitizeFieldMap(fields) {
    const out = {};
    for (const [k, v] of Object.entries(fields || {})) {
        if (!k || !k.trim()) continue;
        if (!v || typeof v !== 'object') continue;
        out[k] = v;
    }
    return out;
}

function stripUndefined(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) {
        if (v !== undefined && v !== null && v !== '') out[k] = v;
    }
    return out;
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

/**
 * Structural deep-equal for plain JSON values. Replaces JSON.stringify
 * comparisons whose key-order instability could either claim dirty=false
 * for real changes (Save button greys out) or dirty=true after a no-op
 * baseline update (autosave loop).
 */
export function deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
        return true;
    }
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
    return true;
}

// ── AI step structured-output helpers ──────────────────────────────────
//
// We support two shapes the runtime accepts (server/core/automationRunner.js
// stringifies `effectiveSchema` verbatim and tells the model "match this"):
//   1. JSON Schema:   { type:'object', properties:{ name:{type:'string'} } }
//   2. Flat:          { name:'string' }
// On read we accept both; on write we always emit shape #1 so the AI builder
// and templates (templates.js uses JSON Schema) round-trip cleanly.

export const OUTPUT_FIELD_TYPES = ['string', 'number', 'boolean', 'datetime', 'object', 'array'];
// Column types for a table (array-of-objects) field — flat scalars only.
export const COLUMN_TYPES = ['string', 'number', 'boolean', 'datetime'];

// `datetime` isn't a native JSON-schema type — it's a string with an ISO 8601
// date-time format, which is what we tell the model to emit. These two helpers
// translate between our friendly type names and the schema fragment so the
// round-trip (save → schema → reload) stays lossless.
function scalarSpec(type, allowed) {
    if (type === 'datetime') return { type: 'string', format: 'date-time' };
    return { type: allowed.includes(type) ? type : 'string' };
}
function scalarType(spec, allowed) {
    if (spec && spec.type === 'string' && (spec.format === 'date-time' || spec.format === 'date')) return 'datetime';
    return allowed.includes(spec?.type) ? spec.type : 'string';
}

export function schemaToFields(schema) {
    if (!schema || typeof schema !== 'object') return [];
    const props = schema.properties && typeof schema.properties === 'object'
        ? schema.properties
        : schema;
    const out = [];
    for (const [key, spec] of Object.entries(props || {})) {
        if (!key) continue;
        if (typeof spec === 'string') {
            out.push({ key, type: OUTPUT_FIELD_TYPES.includes(spec) ? spec : 'string', description: '' });
        } else if (spec && typeof spec === 'object') {
            const field = {
                key,
                type: scalarType(spec, OUTPUT_FIELD_TYPES),
                description: typeof spec.description === 'string' ? spec.description : '',
            };
            // Table columns: an array whose items are an object with properties.
            // Object.entries preserves insertion order, so column order survives.
            const itemProps = spec.items && typeof spec.items === 'object' ? spec.items.properties : null;
            if (field.type === 'array' && itemProps && typeof itemProps === 'object') {
                field.columns = Object.entries(itemProps)
                    .filter(([ck]) => ck)
                    .map(([ck, cs]) => ({ key: ck, type: scalarType(cs, COLUMN_TYPES) }));
            }
            out.push(field);
        }
    }
    return out;
}

export function fieldsToSchema(fields) {
    const valid = (fields || []).filter(f => f && typeof f.key === 'string' && f.key.trim());
    if (valid.length === 0) return null;
    const properties = {};
    for (const f of valid) {
        const spec = scalarSpec(f.type, OUTPUT_FIELD_TYPES);
        if (f.description && f.description.trim()) spec.description = f.description.trim();
        // A table (array) with declared columns → array of objects with those
        // typed properties IN THE DECLARED ORDER, so the model returns rows the
        // Output panel renders as a real table with those headers in that order.
        // Empty/unnamed columns are skipped; if none remain the array stays
        // untyped (model infers the columns).
        if (f.type === 'array' && Array.isArray(f.columns)) {
            const colProps = {};
            for (const c of f.columns) {
                if (!c || typeof c.key !== 'string' || !c.key.trim()) continue;
                colProps[c.key.trim()] = scalarSpec(c.type, COLUMN_TYPES);
            }
            if (Object.keys(colProps).length) spec.items = { type: 'object', properties: colProps };
        }
        properties[f.key.trim()] = spec;
    }
    return { type: 'object', properties };
}
