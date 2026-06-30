/**
 * Pure upstream-variable discovery for the automation builder.
 *
 * Walk an automation definition backward from `currentStepId` and compile
 * a list of "upstream" data sources the user can bind to. This is the
 * single source of truth shared by:
 *   - useUpstreamVariables (the VariableTree / picker in the inspector)
 *   - autoMapInputs (automatic input mapping on connect)
 *
 * Keeping it framework-free means the auto-mapper sees EXACTLY the same
 * candidate paths the user sees in the tree.
 *
 * Output shape: an array of variable groups, one per upstream node.
 *   [
 *     { id: 'trg_abc', label: 'Trigger (manual)', kind: 'trigger',
 *       basePath: 'trigger.output', sample: {...}, fields: [{key, path, sample, children}] },
 *     { id: 's_xxx',   label: 'Gmail search',     kind: 'integration_action',
 *       basePath: 'steps.s_xxx.output', sample: {...}, fields: [...] },
 *     { id: 'loop_y',  label: 'Loop (item)',      kind: 'loop',
 *       basePath: 'loop.item', sample: {...}, fields: [...] },
 *   ]
 *
 * Inputs:
 *   definition    — the full draft (trigger + steps + edges)
 *   currentStepId — the step we're editing (excluded; downstream would be a forward-ref)
 *   catalog       — { apps: [...], triggerOutputs: {...} } from getCatalog()
 *
 * Returns [] when definition / currentStepId is missing.
 */
export function computeUpstreamGroups(definition, currentStepId, catalog) {
    if (!definition || !currentStepId) return [];
    const upstream = collectUpstream(definition, currentStepId);
    if (upstream.length === 0) return [];
    const toolToOutput = buildToolOutputMap(catalog);
    const triggerOutputs = catalog?.triggerOutputs || {};
    const groups = upstream.map(node => {
        let g = describeNode(node, definition, toolToOutput, triggerOutputs);
        // A step that "runs once per item" (step.forEach) doesn't return its
        // flat tool output — the runner wraps it as
        //   { iterations, succeeded, failed, results: [{ index, item, output, status }] }
        // (see execForEachStep). Re-shape the group so downstream binding,
        // the loop picker and auto-map use the runtime-correct
        // `…output.results[*].output.<field>` paths instead of the flat ones.
        if (g && !node.__isTrigger && node.forEach && node.forEach.overRef) {
            g = wrapGroupForEach(g, node);
        }
        return g;
    }).filter(Boolean);
    // When the CURRENT step iterates (`step.forEach`), surface its per-item
    // loop variable (`loop.<itemVar>.*`) so the inspector's variable picker
    // can bind element fields. Appended last so it reads as the nearest
    // context. (Auto-map runs before forEach is set, so this never skews the
    // scalar auto-map pass.)
    const cur = (definition.steps || []).find(s => s.id === currentStepId);
    if (cur && cur.forEach && cur.forEach.overRef) {
        const itemGroup = describeForEachItem(cur, definition, toolToOutput);
        if (itemGroup) groups.push(itemGroup);
    }
    return groups;
}

/**
 * BFS backward through edges to find every node that can flow data into
 * `currentStepId`. Trigger is always included (it's the root of the DAG).
 * Returns nodes in topological order (trigger first, then steps in the
 * order they were visited) so the variable tree renders top-to-bottom
 * matching execution order, and so auto-map can prefer the NEAREST node
 * (last in the returned array).
 */
export function collectUpstream(definition, currentStepId) {
    const trigger = definition.trigger;
    const steps = definition.steps || [];
    const edges = definition.edges || [];
    const byId = new Map();
    if (trigger) byId.set(trigger.id, { ...trigger, __isTrigger: true });
    for (const s of steps) byId.set(s.id, s);

    // Build reverse adjacency (target -> [source]).
    const incoming = new Map();
    for (const e of edges) {
        if (!e.from || !e.to) continue;
        if (!incoming.has(e.to)) incoming.set(e.to, []);
        incoming.get(e.to).push(e.from);
    }

    // BFS from currentStepId backward.
    const visited = new Set();
    const order = [];
    const stack = [currentStepId];
    while (stack.length) {
        const cur = stack.pop();
        const sources = incoming.get(cur) || [];
        for (const src of sources) {
            if (visited.has(src)) continue;
            visited.add(src);
            order.push(src);
            stack.push(src);
        }
    }

    // Trigger is always implicitly upstream — include even if there's no
    // edge yet, so the user can wire from trigger.output.* before
    // connecting their first step manually.
    if (trigger && !visited.has(trigger.id)) {
        visited.add(trigger.id);
        order.push(trigger.id);
    }

    // Render in topological order: trigger first, then upstream steps in
    // execution order (reverse of BFS pop order = order of dependency). The
    // BFS pops nearest-first, so we iterate `order` in REVERSE to get
    // execution order — which puts the NEAREST upstream node last (highest
    // index). chooseNearest / nearestArrayRef rely on that: in a 3+ step
    // chain the immediate predecessor must win over a farther one (e.g.
    // gmail_read's attachments over gmail_search's results).
    const result = [];
    if (trigger && visited.has(trigger.id)) result.push(byId.get(trigger.id));
    for (let i = order.length - 1; i >= 0; i--) {
        const id = order[i];
        if (id === trigger?.id) continue;
        const n = byId.get(id);
        if (n) result.push(n);
    }
    return result;
}

/**
 * Map from tool name to its output sample (and shape) using the catalog
 * the client already fetched. Avoids walking the catalog tree on every
 * tree render.
 */
export function buildToolOutputMap(catalog) {
    const out = new Map();
    for (const app of (catalog?.apps || [])) {
        for (const action of (app.actions || [])) {
            if (!action?.name) continue;
            out.set(action.name, {
                sample: action.outputSample || null,
                schema: action.outputSchema || null,
            });
        }
    }
    return out;
}

/**
 * Translate one upstream node into the tree-display shape.
 */
export function describeNode(node, definition, toolToOutput, triggerOutputs) {
    if (!node) return null;
    if (node.__isTrigger) {
        return describeTrigger(node, triggerOutputs);
    }
    if (node.type === 'integration_action') {
        const meta = toolToOutput.get(node.tool) || {};
        return describeIntegration(node, meta);
    }
    if (node.type === 'ai_step') {
        return describeAiStep(node);
    }
    if (node.type === 'loop') {
        return describeLoop(node, toolToOutput, definition);
    }
    if (node.type === 'condition') {
        return describeCondition(node);
    }
    if (node.type === 'code') {
        return describeCode(node);
    }
    if (node.type === 'notification') {
        return describeNotification(node);
    }
    if (node.type === 'call_layer') {
        return describeCallLayer(node, definition);
    }
    // n8n-style utility nodes
    if (node.type === 'set')        return describeSet(node);
    if (node.type === 'datetime')   return describeDateTime(node);
    if (node.type === 'wait')       return describeWait(node);
    if (node.type === 'stop_error') return null; // stop_error halts the run — no downstream output to bind to
    if (node.type === 'switch')     return describeSwitch(node);
    if (node.type === 'filter')     return describeCollectionItems(node, 'Filter');
    if (node.type === 'limit')      return describeCollectionItems(node, 'Limit');
    if (node.type === 'dedupe')     return describeDedupe(node);
    if (node.type === 'aggregate')  return describeAggregate(node);
    if (node.type === 'summarize')  return describeSummarize(node);
    return null;
}

/**
 * Re-shape an upstream group whose node iterates (`step.forEach`). The
 * runtime output is the aggregated `{ iterations, succeeded, failed, results }`
 * envelope, so:
 *   - every per-iteration ARRAY field becomes a flattened iterable at
 *     `…output.results[*].output.<key>` (the `[*]` flatten is resolved by
 *     server/automation/bind.js walkPath), and
 *   - the run counters (iterations/succeeded/failed) are surfaced.
 * Per-iteration scalar fields are intentionally NOT surfaced flat — at
 * runtime they're arrays (one value per iteration), so auto-mapping a scalar
 * input to them would be wrong; bind them via the loop item instead.
 */
function wrapGroupForEach(group, node) {
    if (!group || !node?.forEach?.overRef) return group;
    const base = group.basePath; // steps.<id>.output
    const flat = group.sample || {};
    const arrayFields = (group.fields || []).filter(f => Array.isArray(f.sample));
    const flattened = arrayFields.map(f => ({
        key: f.key,
        path: `${base}.results[*].output.${f.key}`,
        sample: f.sample,
    }));
    const counters = [
        { key: 'iterations', path: `${base}.iterations`, sample: 0 },
        { key: 'succeeded', path: `${base}.succeeded`, sample: 0 },
        { key: 'failed', path: `${base}.failed`, sample: 0 },
    ];
    return {
        ...group,
        forEach: true,
        sample: { iterations: 0, succeeded: 0, failed: 0, results: [{ index: 0, item: {}, output: flat, status: 'success' }] },
        fields: [...counters, ...flattened],
    };
}

function describeTrigger(trigger, triggerOutputs) {
    const kind = trigger.kind || 'manual';
    // A flowlet's input trigger declares its params directly — surface those
    // as bindable fields rather than relying on the catalog's triggerOutputs.
    if (kind === 'layer_input') {
        const params = Array.isArray(trigger.params) ? trigger.params : [];
        const sample = Object.fromEntries(params.map(p => [p.name, samplePlaceholderFor(p.type)]));
        return {
            id: trigger.id,
            label: 'Flowlet input',
            kind: 'trigger',
            basePath: 'trigger.output',
            sample,
            fields: params.map(p => ({
                key: p.name,
                path: `trigger.output.${p.name}`,
                sample: samplePlaceholderFor(p.type),
            })),
        };
    }
    let key = `__${kind}`;
    if (kind === 'app_event' && trigger.appEvent) {
        key = `${trigger.appEvent.provider}.${trigger.appEvent.event}`;
    }
    const entry = triggerOutputs[key] || triggerOutputs['__manual'] || { fields: [], sample: {} };
    return {
        id: trigger.id,
        label: triggerLabel(trigger),
        kind: 'trigger',
        basePath: 'trigger.output',
        sample: entry.sample || {},
        fields: (entry.fields || []).map(f => ({
            key: f.key,
            path: `trigger.output.${f.key}`,
            sample: f.sample,
        })),
    };
}

function triggerLabel(t) {
    const k = t.kind || 'manual';
    if (k === 'manual') return 'Trigger (manual)';
    if (k === 'schedule') return 'Trigger (schedule)';
    if (k === 'webhook') return 'Trigger (webhook)';
    if (k === 'layer_input') return 'Flowlet input';
    if (k === 'app_event' && t.appEvent) return `Trigger (${t.appEvent.provider} · ${t.appEvent.event})`;
    return 'Trigger';
}

function describeIntegration(node, meta) {
    const sample = meta?.sample || {};
    return {
        id: node.id,
        label: node.label || node.tool || node.id,
        kind: 'integration_action',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

function describeAiStep(node) {
    // When the user (or AI builder) declared an outputSchema, surface its
    // fields so downstream steps can bind to them directly. Otherwise fall
    // back to the runtime convention (`text` + `toolCalls`). We accept
    // both JSON Schema shape and the flat `{field:'type'}` shape — same
    // tolerance as the runtime in server/core/automationRunner.js.
    const props = aiStepOutputProps(node.outputSchema);
    const sample = props
        ? Object.fromEntries(Object.entries(props).map(([k, t]) => [k, samplePlaceholderFor(t)]))
        : { text: '<AI response>', toolCalls: [] };
    return {
        id: node.id,
        label: node.label || 'AI step',
        kind: 'ai_step',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

function aiStepOutputProps(schema) {
    if (!schema || typeof schema !== 'object') return null;
    const raw = schema.properties && typeof schema.properties === 'object'
        ? schema.properties
        : schema;
    const out = {};
    for (const [k, v] of Object.entries(raw || {})) {
        if (!k) continue;
        if (typeof v === 'string') out[k] = v;
        else if (v && typeof v === 'object') out[k] = typeof v.type === 'string' ? v.type : 'string';
    }
    return Object.keys(out).length ? out : null;
}

function samplePlaceholderFor(type) {
    switch (type) {
        case 'number': return 0;
        case 'boolean': return false;
        case 'object': return {};
        case 'array': return [];
        default: return '<string>';
    }
}

function describeLoop(node, toolToOutput, definition) {
    const itemVar = node.itemVar || 'item';
    // Try to infer the loop item shape from the source array's element
    // sample. e.g. overRef = "steps.s1.output.results" → element of
    // toolToOutput[s1].sample.results.
    const elementSample = inferLoopItemSample(node.overRef, definition, toolToOutput);
    const sample = elementSample || {};
    return {
        id: node.id,
        label: node.label || `Loop (${itemVar})`,
        kind: 'loop',
        basePath: `loop.${itemVar}`,
        sample,
        fields: sampleToFields(sample, `loop.${itemVar}`),
    };
}

/**
 * Per-item loop variable for a step that iterates over an upstream array
 * (`step.forEach`). Mirrors describeLoop but reads the step's own forEach
 * config — surfaced for the iterating step itself, not a downstream node.
 */
function describeForEachItem(step, definition, toolToOutput) {
    const fe = step.forEach || {};
    const itemVar = fe.itemVar || 'item';
    const elementSample = inferLoopItemSample(fe.overRef, definition, toolToOutput);
    const sample = elementSample || {};
    return {
        id: `${step.id}__foreach`,
        label: `Current item (${itemVar})`,
        kind: 'loop',
        basePath: `loop.${itemVar}`,
        sample,
        fields: sampleToFields(sample, `loop.${itemVar}`),
    };
}

function describeCondition(node) {
    const sample = { branch: 'then' };
    return {
        id: node.id,
        label: node.label || 'Condition',
        kind: 'condition',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

function describeCode(node) {
    return {
        id: node.id,
        label: node.label || 'Code',
        kind: 'code',
        basePath: `steps.${node.id}.output`,
        sample: { result: '<code result>' },
        fields: [{ key: 'result', path: `steps.${node.id}.output.result`, sample: '<code result>' }],
    };
}

function describeNotification(node) {
    const sample = { sent: true };
    return {
        id: node.id,
        label: node.label || 'Notification',
        kind: 'notification',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

/**
 * A call_layer node's output is the referenced flowlet's layer_output
 * field set, derived live from `definition.layers[layerKey]` (inline
 * flowlets — no denormalised contracts on the step). When the definition
 * in hand carries no layers map (scoped inside a flowlet, where a sibling
 * call_layer can appear upstream) the field list is empty; the user can
 * still bind by typing a path manually.
 */
function describeCallLayer(node, definition) {
    const layer = definition?.layers?.[node.layerKey];
    const out = layer ? (layer.steps || []).find(s => s?.type === 'layer_output') : null;
    const fieldNames = out?.fields && typeof out.fields === 'object' ? Object.keys(out.fields) : [];
    const sample = Object.fromEntries(fieldNames.map(name => [name, samplePlaceholderFor('string')]));
    return {
        id: node.id,
        label: node.label || layer?.title || 'Flowlet',
        kind: 'call_layer',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

// ── n8n-style utility node describers ──────────────────

/**
 * Set step output = the assembled fields object. Each field name becomes
 * a top-level bindable path. We don't know the values at design time, so
 * placeholders are typed as <string> — runtime fills them in.
 */
function describeSet(node) {
    const fieldNames = node.fields && typeof node.fields === 'object' ? Object.keys(node.fields) : [];
    const sample = Object.fromEntries(fieldNames.map(k => [k, '<set>']));
    return {
        id: node.id,
        label: node.label || 'Edit fields',
        kind: 'set',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

function describeDateTime(node) {
    const op = node.op || 'now';
    const sample = op === 'diff' || op === 'extract'
        ? { value: 0, ...(op === 'diff' ? { unit: node.unit || 'days' } : { part: node.part || 'year' }) }
        : { iso: '2026-05-13T09:00:00.000Z', value: '2026-05-13T09:00:00.000Z' };
    return {
        id: node.id,
        label: node.label || 'Date & Time',
        kind: 'datetime',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

function describeWait(node) {
    const sample = { waitedSeconds: node.seconds || 0 };
    return {
        id: node.id,
        label: node.label || 'Wait',
        kind: 'wait',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

function describeSwitch(node) {
    const sample = { matched: 'case1', value: null, branch: 'case:case1' };
    return {
        id: node.id,
        label: node.label || 'Switch',
        kind: 'switch',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

/**
 * Filter / Limit output a subset of the source array. Items shape is the
 * source's element shape — we don't reach back to infer that here (would
 * require resolving arrayRef into a sample), so the tree shows the wrapper
 * `{ items, count }` keys and lets the user wire Loop downstream to
 * iterate.
 */
function describeCollectionItems(node, label) {
    const sample = { items: [], count: 0 };
    return {
        id: node.id,
        label: node.label || label,
        kind: 'collection',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

function describeDedupe(node) {
    const sample = { items: [], removed: 0 };
    return {
        id: node.id,
        label: node.label || 'Remove duplicates',
        kind: 'collection',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

function describeAggregate(node) {
    const sample = { values: [], count: 0 };
    return {
        id: node.id,
        label: node.label || 'Aggregate',
        kind: 'collection',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

function describeSummarize(node) {
    const sample = { result: 0, op: node.op || 'sum', count: 0 };
    return {
        id: node.id,
        label: node.label || 'Summarize',
        kind: 'collection',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

/**
 * Translate a sample object into a flat-ish field list. Top-level keys
 * become leaves; nested objects become groups with their own fields one
 * level deep. Arrays are summarised as `[N items]` and not expanded
 * (their element shape is exposed via Loop's loop.<itemVar> instead).
 */
/**
 * Loosely singularise an array key into a loop/item variable name
 * (`results` → `result`, `categories` → `category`). Shared by the Loop
 * picker, the forEach inspector section, and auto-map iteration detection.
 */
export function suggestItemVar(key) {
    const s = String(key || '').trim();
    if (!s) return 'item';
    if (/ies$/.test(s)) return s.slice(0, -3) + 'y'; // "categories" → "category"
    if (/(s|es)$/.test(s) && s.length > 2) return s.replace(/(es|s)$/, '');
    return s;
}

export function sampleToFields(sample, basePath) {
    if (sample == null || typeof sample !== 'object') return [];
    const out = [];
    for (const [k, v] of Object.entries(sample)) {
        const path = `${basePath}.${k}`;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            // One level of nesting: surface child keys too so users can
            // bind e.g. `trigger.output.organizer.email` without typing.
            const children = Object.entries(v).map(([ck, cv]) => ({
                key: ck,
                path: `${path}.${ck}`,
                sample: cv,
            }));
            out.push({ key: k, path, sample: v, children });
        } else {
            out.push({ key: k, path, sample: v });
        }
    }
    return out;
}

/**
 * Resolve an `overRef` like `steps.s1.output.results` to the element
 * shape — first item of that array in the source step's outputSample.
 * Returns null when the path can't be resolved (loop's item then has
 * no usable sample).
 */
export function inferLoopItemSample(overRef, definition, toolToOutput) {
    if (typeof overRef !== 'string' || !overRef) return null;
    const m = /^steps\.([^.]+)\.output(?:\.(.+))?$/.exec(overRef);
    if (!m) return null;
    const stepId = m[1];
    const rest = m[2] || '';
    const node = (definition.steps || []).find(s => s.id === stepId);
    if (!node) return null;
    const meta = toolToOutput.get(node.tool);
    if (meta?.sample == null) return null;
    // When the source step iterates, its real output is the forEach envelope
    // — resolve the path (incl. `[*]` flatten) against that wrapped shape so
    // `…results[*].output.<arr>` lands on the element, not undefined.
    const root = node?.forEach?.overRef
        ? { iterations: 0, succeeded: 0, failed: 0, results: [{ index: 0, item: {}, output: meta.sample, status: 'success' }] }
        : meta.sample;
    let cur = root;
    for (const seg of (rest ? rest.split('.') : [])) {
        if (cur == null) return null;
        const isWild = /\[\*\]$/.test(seg);
        const idxMatch = /\[(\d+)\]$/.exec(seg);
        const key = seg.replace(/\[(?:\*|\d+)\]$/, '');
        if (key) cur = (cur && typeof cur === 'object') ? cur[key] : undefined;
        if (cur == null) return null;
        if (isWild) cur = Array.isArray(cur) ? cur[0] : null;
        else if (idxMatch) cur = Array.isArray(cur) ? cur[Number(idxMatch[1])] : null;
    }
    if (Array.isArray(cur)) return cur.length > 0 ? cur[0] : null;
    return (cur && typeof cur === 'object') ? cur : null;
}
