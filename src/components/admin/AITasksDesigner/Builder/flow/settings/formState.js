// §WS5 — pure form <-> step-shape helpers extracted verbatim from
// SettingsForm.jsx. No JSX/React; schemaToFields/fieldsToSchema keep their
// public export (re-exported by SettingsForm for ToolInputForm + tests).
import { ROUTE_STEP_TYPES, readRoute, writeRoute } from '../routeModel';
import { PRIVACY_STEP_TYPES, readPrivacy, writePrivacy } from '../privacyModel';
import { defaultTriggerLabel } from '../triggerLabels';
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
    if (step.type === 'trigger') return defaultTriggerLabel(step.kind || 'manual');
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
            // Empty defaults: a fresh app_event trigger has no provider until
            // AppEventFields auto-snaps to the first AVAILABLE one (dynamic,
            // catalog-driven — a hardcoded 'gmail' could be unavailable).
            appProvider:  step.appEvent?.provider || '',
            appEventName: step.appEvent?.event || '',
            filter:       step.appEvent?.filter || {},
            // Hosted form (kind === 'form'). Kept as ONE object so the editor
            // can patch title/fields/theme without five parallel draft keys.
            form:         step.form && typeof step.form === 'object' ? step.form : null,
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
            // "Run once per item" — the inspector rendered the tick, but the
            // round-trip dropped it in BOTH directions for ai_step (C12).
            forEach: step.forEach || null,
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
    // If / Switch / Filter are ONE node in the editor (see flow/routeModel.js):
    // the form edits a single `route` model and picks the runtime type that
    // expresses it, so all three share this branch.
    if (ROUTE_STEP_TYPES.has(step.type)) return { ...base, route: readRoute(step) };
    // Check / Hide / Check + Hide / Reveal are ONE node too (flow/privacyModel.js),
    // same shape of translation: one `privacy` model over three runtime types.
    if (PRIVACY_STEP_TYPES.has(step.type)) return { ...base, privacy: readPrivacy(step) };
    if (step.type === 'loop')         return {
        ...base,
        overRef: step.overRef || '',
        // Display truth == persisted truth (C9): the inspector always SHOWED
        // "item" while an absent itemVar persisted '' — activation stayed
        // blocked by loop.itemVar_missing on a value the user could see.
        itemVar: step.itemVar || 'item',
        maxIterations: step.maxIterations ?? 100,
        batchSize: step.batchSize ?? 1,
        body: Array.isArray(step.body) ? step.body : [],
    };
    if (step.type === 'code')         return { ...base, code: step.code || '', forEach: step.forEach || null };
    // `channels` rides along now that the form can edit it (BFSF-350) — it was
    // runner-honoured but form-invisible, so a step's delivery target could
    // only be set through the JSON tab.
    if (step.type === 'notification') return { ...base, title: step.title || '', body: step.body || '', channels: Array.isArray(step.channels) ? step.channels : null, forEach: step.forEach || null };
    if (step.type === 'http_request') return {
        ...base,
        url: step.url || '',
        method: step.method || 'GET',
        headers: step.headers && typeof step.headers === 'object' ? step.headers : {},
        body: step.body || '',
        timeoutMs: typeof step.timeoutMs === 'number' ? step.timeoutMs : 10_000,
        blockPrivateTargets: step.blockPrivateTargets !== false,
        // Saved HTTP credential reference — only the opaque connectionId lives
        // in the definition; the secret stays in the org vault.
        auth: (step.auth && typeof step.auth === 'object' && step.auth.connectionId)
            ? { connectionId: step.auth.connectionId }
            : null,
    };
    // Flowlets (inline — contract derives from rootDefinition, not the step)
    if (step.type === 'call_layer')   return { ...base, inputs: step.inputs || {} };
    // Steps (external — contract derives from the catalog, not the step)
    if (step.type === 'call_block')   return { ...base, inputs: step.inputs || {} };
    if (step.type === 'layer_output') return { ...base, fields: step.fields || {} };
    // n8n-style utility nodes
    if (step.type === 'set')          return {
        ...base,
        fields: step.fields || {},
        forEach: step.forEach || null,
        // null = single mode; a string ('' allowed = source not picked yet) =
        // list mode. Mirrors the switch presence convention (routeModel.js) —
        // the mode is never stored, only derived from the key being there.
        arrayRef: typeof step.arrayRef === 'string' ? step.arrayRef : null,
        maxItems: typeof step.maxItems === 'number' ? step.maxItems : '',
        operations: Array.isArray(step.operations) ? step.operations : [],
    };
    if (step.type === 'parse_json')   return {
        ...base,
        sourceRef: step.sourceRef || '',
        itemsRef: step.itemsRef || '',
        mode: step.mode === 'ai' ? 'ai' : 'paths',
        fields: Array.isArray(step.fields) ? step.fields : [],
    };
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
    // guard / tokenize / untokenize are handled by the unified `privacy` branch
    // above (flow/privacyModel.js). `categories` and `confidence` stay absent
    // when unset there too: undefined means "inherit the org's Privacy Shield",
    // and defaulting them would freeze today's policy into the step and
    // silently stop following the organisation.
    if (step.type === 'form_page') {
        return {
            ...base,
            mode: step.mode === 'ending' ? 'ending' : 'input',
            // `null` is meaningful inside the declaration (theme: null =
            // inherit the trigger's), so the whole object is passed through
            // rather than defaulted here.
            form: step.form && typeof step.form === 'object' ? step.form : null,
            waitSeconds: typeof step.waitSeconds === 'number' ? step.waitSeconds : 3600,
        };
    }
    // Collection ops all expose the optional input cap (C19 — `maxItems` was
    // read by the runner and validated by the server but editable only via
    // the raw JSON view). '' = unset.
    const maxItems = typeof step.maxItems === 'number' ? step.maxItems : '';
    if (step.type === 'limit')        return { ...base, arrayRef: step.arrayRef || '', count: typeof step.count === 'number' ? step.count : 10, mode: step.mode || 'first', maxItems };
    if (step.type === 'dedupe')       return { ...base, arrayRef: step.arrayRef || '', keyField: step.keyField || '', maxItems };
    if (step.type === 'aggregate')    return { ...base, arrayRef: step.arrayRef || '', field: step.field || '', maxItems };
    if (step.type === 'summarize')    return { ...base, arrayRef: step.arrayRef || '', field: step.field || '', op: step.op || 'sum', maxItems };
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
    // …but a trigger label that is exactly the kind's generated name never
    // counts as hand-picked: the kind switcher writes it (BFSF-339), and
    // locking it there would freeze the node at whatever kind it passed
    // through and take it away from the AI auto-namer too.
    if (step.type === 'trigger' && draft.label && draft.label === defaultTriggerLabel(draft.kind || 'manual')) {
        patch.labelManual = null;
    }

    if (step.type === 'trigger') {
        patch.kind = draft.kind || 'manual';
        // Sibling nulling for the form declaration is unconditional: switching
        // a trigger away from `form` must not leave a stale form behind that a
        // later switch back would silently resurrect with old fields.
        patch.form = draft.kind === 'form' ? (draft.form || null) : null;
        // Preserve any existing schedule/appEvent objects so we don't
        // wipe sibling fields the form doesn't know about.
        if (draft.kind === 'schedule') {
            patch.schedule = { ...(step.schedule || {}), cron: draft.scheduleCron || '', tz: draft.scheduleTz || 'Europe/Amsterdam' };
            patch.appEvent = null;
        } else if (draft.kind === 'app_event') {
            const cleanedFilter = stripUndefined(draft.filter || {});
            patch.appEvent = {
                ...(step.appEvent || {}),
                provider: draft.appProvider || '',
                event: draft.appEventName || '',
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
        } else if (draft.kind === 'form') {
            // patch.form is already set above; the URL token deliberately lives
            // in automation_form_pages, NOT here, so an export/import/duplicate
            // can never clone a live public URL.
            patch.schedule = null;
            patch.appEvent = null;
        } else if (draft.kind === 'layer_input' || draft.kind === 'app_trigger') {
            // Declared typed params become trigger.output.<name> — the flowlet
            // input contract, and the app trigger's Studio-App input contract
            // (server contract: automation/appTriggerContract.js).
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
        applyForEachPatch(patch, step, draft); // C12 — was dropped both ways
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
        applyForEachPatch(patch, step, draft);
    }
    // If / Switch / Filter — one model, one writer. writeRoute also decides
    // WHICH runtime type expresses the model, so `patch.type` can change here
    // (the inspector's merge re-points the node's edges — flow/routeEdges.js).
    if (ROUTE_STEP_TYPES.has(step.type)) Object.assign(patch, writeRoute(draft.route || readRoute(step)));
    // Privacy Shield — same contract as the route model above: writePrivacy
    // picks the runtime type (guard / tokenize / untokenize) that expresses the
    // chosen mode, so `patch.type` can change here too.
    if (PRIVACY_STEP_TYPES.has(step.type)) Object.assign(patch, writePrivacy(draft.privacy || readPrivacy(step)));
    if (step.type === 'loop') {
        patch.overRef = draft.overRef || '';
        // Never persist '' — the inspector displays 'item' as the effective
        // value, so persist exactly that (C9).
        patch.itemVar = String(draft.itemVar || '').trim() || 'item';
        patch.maxIterations = clamp(Number(draft.maxIterations) || 100, 1, 1000);
        patch.batchSize = clamp(Number(draft.batchSize) || 1, 1, 1000);
        patch.body = Array.isArray(draft.body) ? draft.body : [];
    }
    if (step.type === 'code') {
        patch.code = draft.code || '';
        applyForEachPatch(patch, step, draft); // C16/C18
    }
    if (step.type === 'notification') {
        patch.title = draft.title || '';
        patch.body = draft.body || '';
        // Omitted rather than defaulted when untouched: the runner already
        // treats a missing `channels` as the bell, and writing one in would
        // dirty every notification step the user merely opened.
        if (Array.isArray(draft.channels)) patch.channels = draft.channels;
        applyForEachPatch(patch, step, draft); // C18 — runner honours it, form never exposed it
    }
    if (step.type === 'http_request') {
        patch.url = draft.url || '';
        patch.method = (draft.method || 'GET').toUpperCase();
        patch.headers = draft.headers && typeof draft.headers === 'object' ? draft.headers : {};
        patch.body = draft.body || '';
        patch.timeoutMs = clamp(Number(draft.timeoutMs) || 10_000, 1000, 60_000);
        // Optional per-step security toggle (default true = blocked) — not
        // mandatory, but always persisted explicitly so the definition
        // never depends on the "defaults true" convention silently.
        patch.blockPrivateTargets = draft.blockPrivateTargets !== false;
        // Credential reference — explicit null clears it in the definition
        // (same "persist explicitly" style as blockPrivateTargets).
        patch.auth = draft.auth?.connectionId ? { connectionId: draft.auth.connectionId } : null;
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
        if (typeof draft.arrayRef === 'string') {
            // LIST MODE — the key's presence is the mode, so it's always sent.
            patch.arrayRef = draft.arrayRef;
            applyMaxItemsPatch(patch, draft);
            const ops = sanitizeOperations(draft.operations);
            patch.operations = ops.length ? ops : undefined;
            // Mutually exclusive with forEach (the validator errors on both);
            // an explicit null clears a legacy per-item setting on save.
            if (step.forEach) patch.forEach = null;
        } else {
            // SINGLE MODE — explicit undefined deletes the list-mode keys
            // after the patch-merge + JSON round-trip (the writeRoute idiom);
            // the changed-keys diff below drops the no-ops.
            patch.arrayRef = undefined;
            patch.operations = undefined;
            patch.maxItems = undefined;
            applyForEachPatch(patch, step, draft); // C16 — runner+validator allow it
        }
    }
    if (step.type === 'parse_json') {
        patch.sourceRef = draft.sourceRef || '';
        patch.itemsRef = draft.itemsRef || '';
        patch.mode = draft.mode === 'ai' ? 'ai' : 'paths';
        patch.fields = sanitizeParseJsonFields(draft.fields);
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
    // guard / tokenize / untokenize: written by writePrivacy above. Keeping a
    // second writer here would fight it — the old one rebuilt `onFound` from
    // stop/mask alone and would strip the `tokenize` action that makes a guard
    // a Check + Hide step.
    if (step.type === 'form_page') {
        const ending = draft.mode === 'ending';
        patch.mode = ending ? 'ending' : 'input';
        patch.form = draft.form || null;
        // Clamps must match the server's (validate.js FORM_PAGE_MIN/MAX_WAIT_S
        // and builderTools' normalizePatchField), or a UI-built step and an
        // AI-built one would disagree. An ending page never waits.
        patch.waitSeconds = ending ? null : clamp(Number(draft.waitSeconds) || 3600, 60, 7 * 24 * 3600);
    }
    if (step.type === 'limit') {
        patch.arrayRef = draft.arrayRef || '';
        patch.count = Math.max(0, Math.floor(Number(draft.count) || 0));
        patch.mode = draft.mode === 'last' ? 'last' : 'first';
        applyMaxItemsPatch(patch, draft);
    }
    if (step.type === 'dedupe') {
        patch.arrayRef = draft.arrayRef || '';
        patch.keyField = draft.keyField?.trim() ? draft.keyField.trim() : undefined;
        applyMaxItemsPatch(patch, draft);
    }
    if (step.type === 'aggregate') {
        patch.arrayRef = draft.arrayRef || '';
        patch.field = draft.field || '';
        applyMaxItemsPatch(patch, draft);
    }
    if (step.type === 'summarize') {
        patch.arrayRef = draft.arrayRef || '';
        patch.field = draft.field || '';
        patch.op = draft.op || 'sum';
        applyMaxItemsPatch(patch, draft);
    }
    // Send only the fields that ACTUALLY CHANGED vs the current step. The form
    // rebuilds every field for the step type on every save; sending all of
    // them would overwrite fields the user never touched — clobbering a
    // concurrent AI-builder edit to, say, the prompt while the user only
    // renamed the label. The *Manual flags are meta (not on the step) and are
    // only added when their value changed, so they're intentionally exempt.
    const META_KEYS = new Set(['labelManual', 'iconManual']);
    const changed = {};
    for (const k of Object.keys(patch)) {
        if (META_KEYS.has(k)) { changed[k] = patch[k]; continue; }
        if (!deepEqual(patch[k], step[k])) changed[k] = patch[k];
    }
    return changed;
}

/**
 * Step types whose "run once per item" (forEach) config the inspector edits.
 * Mirrors the runtime/validator allow-list (validate.js FOREACH_ALLOWED) —
 * the runner honoured forEach on all five, but the form only round-tripped
 * it for integration_action, silently dropping it everywhere else (C12/C16/
 * C18).
 */
export const FOREACH_FORM_TYPES = new Set(['integration_action', 'ai_step', 'code', 'notification', 'set']);

/**
 * One shared forEach persist rule: normalize when enabled, explicit null to
 * clear an existing one when the user toggles it off.
 */
function applyForEachPatch(patch, step, draft) {
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

/**
 * Optional collection-op input cap (C19). '' / invalid clears the key —
 * `undefined` drops out of the persisted step after the patch-merge + JSON
 * serialisation, same pattern as dedupe's keyField.
 */
function applyMaxItemsPatch(patch, draft) {
    const n = Number(draft.maxItems);
    patch.maxItems = Number.isFinite(n) && n >= 1 ? Math.floor(n) : undefined;
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
        if (v == null) continue;
        // Bare (non-object) literals are LEGAL — bind.js resolves them as
        // literal values, and API/import/legacy definitions carry them.
        // Dropping them here silently emptied `fields` on the first unrelated
        // edit (C15); normalise to the canonical wrapper instead so the UI
        // can edit them.
        if (typeof v !== 'object') { out[k] = { kind: 'literal', value: v }; continue; }
        out[k] = v;
    }
    return out;
}

/**
 * Sanitize the parse_json fields ARRAY. Same philosophy as sanitizeFieldMap:
 * these are the user's OWN named rows, so a named-but-incomplete row (path
 * still empty) MUST survive the 600ms autosave round-trip — dropping it would
 * make the row vanish mid-edit. Only blank-name / non-object rows are
 * dropped. `undefined` members are stripped so the persisted step never
 * carries them (JSON round-trips would drop them asymmetrically anyway).
 */
export function sanitizeParseJsonFields(fields) {
    const out = [];
    for (const f of (Array.isArray(fields) ? fields : [])) {
        if (!f || typeof f !== 'object') continue;
        const name = typeof f.name === 'string' ? f.name.trim() : '';
        if (!name) continue;
        const row = { name, path: typeof f.path === 'string' ? f.path : '' };
        if (typeof f.description === 'string' && f.description.trim()) row.description = f.description;
        if (f.fallback !== undefined) row.fallback = f.fallback;
        out.push(row);
    }
    return out;
}

/**
 * Sanitize the "Edit data" operations ARRAY. Same survival philosophy as
 * sanitizeParseJsonFields: these are the user's OWN rows, so a typed-but-
 * incomplete operation (target still empty, keys not picked yet) MUST survive
 * the autosave round-trip — the validator marks it as a completeness problem,
 * it must not vanish mid-edit. Only non-objects and unknown `op` values are
 * dropped (nothing in the editor can create those), and each op is normalised
 * to the exact key set the runtime reads.
 */
export function sanitizeOperations(raw) {
    const out = [];
    const t = (s) => (typeof s === 'string' ? s.trim() : '');
    const keysOf = (v) => (Array.isArray(v) ? v.map(t).filter(Boolean) : []);
    for (const o of (Array.isArray(raw) ? raw : [])) {
        if (!o || typeof o !== 'object' || Array.isArray(o)) continue;
        if (o.op === 'rowId') {
            // '' / null = "not set" — Number('') is 0, which would silently
            // persist a start of 0 the user never typed.
            const start = (o.start === '' || o.start == null) ? null : Number(o.start);
            out.push({ op: 'rowId', target: t(o.target), ...(Number.isInteger(start) && start !== 1 ? { start } : {}) });
        } else if (o.op === 'groupId') {
            out.push({ op: 'groupId', target: t(o.target), keys: keysOf(o.keys) });
        } else if (o.op === 'rename') {
            out.push({ op: 'rename', from: t(o.from), to: t(o.to) });
        } else if (o.op === 'keep' || o.op === 'remove') {
            out.push({ op: o.op, keys: keysOf(o.keys) });
        } else if (o.op === 'sort') {
            out.push({ op: 'sort', key: t(o.key), ...(o.direction === 'desc' ? { direction: 'desc' } : {}) });
        }
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
    const requiredKeys = new Set(Array.isArray(schema.required) ? schema.required : []);
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
            if (requiredKeys.has(key)) field.required = true;
            // Table columns: an array whose items are an object with properties.
            // Object.entries preserves insertion order, so column order survives.
            const itemProps = spec.items && typeof spec.items === 'object' ? spec.items.properties : null;
            if (field.type === 'array' && itemProps && typeof itemProps === 'object') {
                field.columns = Object.entries(itemProps)
                    .filter(([ck]) => ck)
                    .map(([ck, cs]) => ({ key: ck, type: scalarType(cs, COLUMN_TYPES) }));
            } else if (field.type === 'array' && spec.items && typeof spec.items === 'object') {
                // Scalar-item arrays (e.g. {type:'array', items:{type:'string'}}):
                // stash the items spec verbatim so the save round-trip doesn't
                // discard it (C13 — every save used to degrade these to an
                // untyped array).
                field.itemsSpec = spec.items;
            }
            // Nested object properties ride along OPAQUELY: the form can't
            // edit them (yet), but extract→rebuild must be the identity, not
            // a lossy downgrade to a bare {type:'object'} (C13).
            if (field.type === 'object' && spec.properties && typeof spec.properties === 'object') {
                field.objectSpec = spec.properties;
                if (Array.isArray(spec.required)) field.objectRequired = spec.required;
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
    const required = [];
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
        } else if (f.type === 'array' && f.itemsSpec && typeof f.itemsSpec === 'object') {
            spec.items = f.itemsSpec; // opaque passthrough (C13)
        }
        if (f.type === 'object' && f.objectSpec && typeof f.objectSpec === 'object') {
            spec.properties = f.objectSpec; // opaque passthrough (C13)
            if (Array.isArray(f.objectRequired) && f.objectRequired.length) spec.required = f.objectRequired;
        }
        if (f.required) required.push(f.key.trim());
        properties[f.key.trim()] = spec;
    }
    return { type: 'object', properties, ...(required.length ? { required } : {}) };
}
