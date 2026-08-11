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
 *   realOutputById — optional Map<stepId, output> of real run/pinned outputs
 *                    (mapping/realOutputs.js buildRealOutputMap). When given,
 *                    each group's sample AND fields carry the real data, and
 *                    the accumulated sampleRoot resolves refs against it — so
 *                    a Filter added below a step with 10 real records sees
 *                    those records, in auto-map and in every picker alike.
 *
 * Returns [] when definition / currentStepId is missing.
 */
import { walkPath, walkRelativePath } from '../../../../../utils/bindingHelpers';
import { deepOverlay } from './realOutputs';
import { applyOpsToSampleRow } from '../flow/setOperations';
import { SET_STEP_NAME, ROUTE_STEP_NAME } from '../flow/stepDisplayName';

export function computeUpstreamGroups(definition, currentStepId, catalog, realOutputById = null) {
    if (!definition || !currentStepId) return [];
    const upstream = collectUpstream(definition, currentStepId);
    if (upstream.length === 0) return [];
    const toolToOutput = buildToolOutputMap(catalog);
    const triggerOutputs = catalog?.triggerOutputs || {};
    // Accumulated sample root, built up in topological order so each describer
    // can resolve refs into what EARLIER nodes produce (e.g. a Filter's
    // arrayRef into the source step's element shape). With realOutputById the
    // slots hold real data, so those refs resolve to real elements.
    const sampleRoot = { trigger: { output: {} }, steps: {} };
    let triggerHasRealData = false;
    const groups = [];
    for (const node of upstream) {
        let g = describeNode(node, definition, toolToOutput, triggerOutputs, sampleRoot);
        // A step that "runs once per item" (step.forEach) doesn't return its
        // flat tool output — the runner wraps it as
        //   { iterations, succeeded, failed, results: [{ index, item, output, status }] }
        // (see execForEachStep). Re-shape the group so downstream binding,
        // the loop picker and auto-map use the runtime-correct
        // `…output.results[*].output.<field>` paths instead of the flat ones.
        if (g && !node.__isTrigger && node.forEach && node.forEach.overRef) {
            g = wrapGroupForEach(g, node);
        }
        if (!g) continue;
        // Overlay what the node ACTUALLY produced (pinned > run) — after the
        // forEach reshape, so a real forEach envelope lands on the wrapped
        // group rather than on the flat tool shape.
        const real = realOutputById?.get(node.id);
        if (real !== undefined) g = overlayGroupWithReal(g, real);
        if (node.__isTrigger) {
            // All triggers share the one runtime trigger.output slot. A fired
            // trigger's real data must not be clobbered by the placeholder
            // sample of a sibling trigger later in the walk.
            if (!triggerHasRealData) sampleRoot.trigger.output = g.sample || {};
            if (g.hasRealData) triggerHasRealData = true;
        } else {
            recordSample(sampleRoot, node, g);
        }
        groups.push(g);
    }
    // When the CURRENT step iterates (`step.forEach`), surface its per-item
    // loop variable (`loop.<itemVar>.*`) so the inspector's variable picker
    // can bind element fields. Appended last so it reads as the nearest
    // context. (Auto-map runs before forEach is set, so this never skews the
    // scalar auto-map pass.)
    const cur = (definition.steps || []).find(s => s.id === currentStepId);
    if (cur && cur.forEach && cur.forEach.overRef) {
        const itemGroup = describeForEachItem(cur, definition, toolToOutput, sampleRoot);
        if (itemGroup) groups.push(itemGroup);
    }
    return groups.filter(g => !isOwnContainer(g.id, currentStepId));
}

/**
 * File a described node's sample under the path its own bindings use, so later
 * describers in the walk can resolve refs THROUGH it.
 *
 * Almost everything is `steps.<id>.output`. The exception is the "Each item"
 * pill of an expanded loop: it is not a step and has no output slot — it IS
 * `loop.<itemVar>`, and filing it there is what lets a body step resolve an
 * element shape out of `loop.item.<something>`.
 */
function recordSample(sampleRoot, node, group) {
    if (node.type === 'loop_item') {
        sampleRoot.loop = { ...(sampleRoot.loop || {}), [node.itemVar || 'item']: group.sample ?? {} };
        return;
    }
    sampleRoot.steps[node.id] = { output: group.sample || {} };
}

/**
 * True when `groupId` is a container the current step is INSIDE.
 *
 * On an expanded canvas a container's contents carry its id as a prefix
 * (`lp1/a` — flow/inlineFlowlets.js), and a loop's container node feeds its own
 * entry so body steps can see the flow before the loop. That edge also drags
 * the LOOP's own group into the walk — and `steps.lp1.output.results` does not
 * exist while its body is still running. Offering it would be a path that
 * always resolves to nothing, the exact trap describeLoop's own comment
 * describes from the other side.
 */
function isOwnContainer(groupId, currentStepId) {
    return typeof groupId === 'string'
        && typeof currentStepId === 'string'
        && currentStepId.startsWith(`${groupId}/`);
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
    // Additional triggers (definition.triggers[] — webhook/app_event only,
    // scoped multi-trigger slice). Every trigger — primary or additional —
    // writes into the SAME runtime `trigger.output` (only whichever one
    // actually fired populates it for a given run), so each surfaces as its
    // own upstream group sharing that one base path — "any of N possible
    // shapes, one path", no new ref-root needed.
    const additionalTriggers = Array.isArray(definition.triggers) ? definition.triggers : [];
    const steps = definition.steps || [];
    const edges = definition.edges || [];
    const byId = new Map();
    if (trigger) byId.set(trigger.id, { ...trigger, __isTrigger: true });
    for (const t of additionalTriggers) byId.set(t.id, { ...t, __isTrigger: true });
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

    // Every trigger is always implicitly upstream — include even if there's
    // no edge yet, so the user can wire from trigger.output.* before
    // connecting their first step manually.
    const allTriggerIds = [trigger?.id, ...additionalTriggers.map(t => t.id)].filter(Boolean);
    for (const id of allTriggerIds) {
        if (!visited.has(id)) { visited.add(id); order.push(id); }
    }

    // Render in topological order: triggers first, then upstream steps in
    // execution order (reverse of BFS pop order = order of dependency). The
    // BFS pops nearest-first, so we iterate `order` in REVERSE to get
    // execution order — which puts the NEAREST upstream node last (highest
    // index). chooseNearest / nearestArrayRef rely on that: in a 3+ step
    // chain the immediate predecessor must win over a farther one (e.g.
    // gmail_read's attachments over gmail_search's results).
    const result = [];
    for (const id of allTriggerIds) {
        if (visited.has(id) && byId.has(id)) result.push(byId.get(id));
    }
    for (let i = order.length - 1; i >= 0; i--) {
        const id = order[i];
        if (allTriggerIds.includes(id)) continue;
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
export function describeNode(node, definition, toolToOutput, triggerOutputs, sampleRoot = null) {
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
        return describeLoop(node, toolToOutput, definition, sampleRoot);
    }
    if (node.type === 'loop_item') {
        return describeLoopItem(node, definition, toolToOutput, sampleRoot);
    }
    if (node.type === 'condition') {
        return describeCondition(node);
    }
    // The privacy steps. Without these the picker offered NOTHING for them, so
    // a "Show real values again" placed straight after "Hide personal data"
    // could not be pointed at the very value it exists to restore.
    if (node.type === 'guard')      return describeGuard(node);
    if (node.type === 'tokenize')   return describeTokenize(node);
    if (node.type === 'untokenize') return describeUntokenize(node);
    if (node.type === 'code') {
        return describeCode(node);
    }
    if (node.type === 'notification') {
        return describeNotification(node);
    }
    if (node.type === 'http_request') {
        return describeHttpRequest(node);
    }
    if (node.type === 'call_layer') {
        return describeCallLayer(node, definition);
    }
    // n8n-style utility nodes
    if (node.type === 'set')        return describeSet(node, sampleRoot);
    if (node.type === 'parse_json') return describeParseJson(node, sampleRoot);
    if (node.type === 'datetime')   return describeDateTime(node);
    if (node.type === 'wait')       return describeWait(node);
    if (node.type === 'form_page')  return describeFormPage(node);
    if (node.type === 'stop_error') return null; // stop_error halts the run — no downstream output to bind to
    if (node.type === 'switch')     return describeSwitch(node);
    if (node.type === 'filter')     return describeCollectionItems(node, ROUTE_STEP_NAME, sampleRoot);
    if (node.type === 'limit')      return describeCollectionItems(node, 'Limit', sampleRoot);
    if (node.type === 'dedupe')     return describeDedupe(node, sampleRoot);
    if (node.type === 'aggregate')  return describeAggregate(node, sampleRoot);
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
    // Declared-params triggers (a flowlet's input contract, or an app
    // trigger's Studio-App inputs) surface their params directly as bindable
    // fields — no catalog round-trip; the author's declaration IS the shape.
    if (kind === 'layer_input' || kind === 'app_trigger') {
        const params = Array.isArray(trigger.params) ? trigger.params : [];
        const sample = Object.fromEntries(params.map(p => [p.name, samplePlaceholderFor(p.type)]));
        return {
            id: trigger.id,
            label: kind === 'app_trigger' ? 'Studio App inputs' : 'Flowlet input',
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
    // A hosted form's answers ARE its declared fields, so they are bindable
    // from the moment the author declares them — waiting for a first real
    // submission would leave every downstream step un-mappable.
    if (kind === 'form') {
        const fields = Array.isArray(trigger.form?.fields) ? trigger.form.fields.filter(f => f?.name) : [];
        const sampleFor = (f) => (f.type === 'checkbox' ? true
            : f.type === 'number' ? 42
            : f.type === 'date' ? '2026-01-31'
            : f.type === 'file' ? { kind: 'form_upload', filename: 'attachment.pdf' }
            : f.type === 'email' ? 'visitor@example.com'
            : f.label || 'answer');
        return {
            id: trigger.id,
            label: 'Form answers',
            kind: 'trigger',
            basePath: 'trigger.output',
            sample: Object.fromEntries(fields.map(f => [f.name, sampleFor(f)])),
            fields: fields.map(f => ({
                key: f.name,
                path: `trigger.output.${f.name}`,
                sample: sampleFor(f),
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
    if (k === 'form') return 'Trigger (form)';
    if (k === 'layer_input') return 'Flowlet input';
    if (k === 'app_trigger') return 'Trigger (Studio App)';
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
    // fields so downstream steps can bind to them directly. We accept both
    // JSON Schema shape and the flat `{field:'type'}` shape — same tolerance
    // as the runtime in server/core/automationRunner.js.
    //
    // WITHOUT a schema the runtime returns the RAW RESPONSE STRING as the
    // whole output — the old `{text, toolCalls}` promise here was pure
    // fiction (neither key has ever existed at run time; every binding built
    // from it resolved undefined — C21). One honest leaf: bind the whole
    // output.
    const props = aiStepOutputProps(node.outputSchema);
    if (!props) {
        return {
            id: node.id,
            label: node.label || 'AI step',
            kind: 'ai_step',
            basePath: `steps.${node.id}.output`,
            sample: '<AI response>',
            fields: [{ key: 'response', path: `steps.${node.id}.output`, sample: '<AI response>' }],
        };
    }
    const sample = Object.fromEntries(Object.entries(props).map(([k, t]) => [k, samplePlaceholderFor(t)]));
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
        // App-trigger file inputs arrive expanded (appStudio/actionExecutor);
        // the nested keys make trigger.output.<name>.url bindable in the tree.
        case 'file': return { fileId: '<file-id>', name: 'document.pdf', mime: 'application/pdf', size: 12345, url: '<signed download url>' };
        default: return '<string>';
    }
}

function describeLoop(node, toolToOutput, definition, sampleRoot = null) {
    const itemVar = node.itemVar || 'item';
    // DOWNSTREAM view (C23 + user report): after the loop finishes, the
    // `loop.<itemVar>` scope NO LONGER EXISTS — the runtime output is the
    // envelope { iterations, results: [{ index, item, output }] }. This
    // group used to offer `loop.<itemVar>.*` here, so a step wired AFTER the
    // loop could pick paths that always resolved undefined at run time (the
    // exact trap in the user's contains(loop.item.subject, …) screenshot).
    // The per-item `loop.<itemVar>` group still exists INSIDE the body
    // (computeLoopBodyGroups) and for forEach steps (describeForEachItem).
    //
    // Element fields are offered as `results[*].item.<key>` — the `[*]`
    // flatten resolves in bindings (bind.walkPath) and, since the wildcard
    // grammar fix, in expressions too.
    const elementSample = inferLoopItemSample(node.overRef, definition, toolToOutput, sampleRoot);
    const base = `steps.${node.id}.output`;
    const sample = {
        iterations: 0,
        results: [{ index: 0, item: elementSample || {}, output: {} }],
    };
    const itemFields = elementSample && typeof elementSample === 'object' && !Array.isArray(elementSample)
        ? Object.entries(elementSample).map(([k, v]) => ({
            key: k,
            path: `${base}.results[*].item.${k}`,
            sample: Array.isArray(v) ? v : [v],
        }))
        : [];
    return {
        id: node.id,
        label: node.label || `Loop (${itemVar})`,
        kind: 'loop',
        basePath: base,
        sample,
        fields: [
            { key: 'iterations', path: `${base}.iterations`, sample: 0 },
            { key: 'results', path: `${base}.results`, sample: sample.results },
            ...itemFields,
        ],
    };
}

/**
 * Per-item loop variable for a step that iterates over an upstream array
 * (`step.forEach`). Mirrors describeLoop but reads the step's own forEach
 * config — surfaced for the iterating step itself, not a downstream node.
 */
function describeForEachItem(step, definition, toolToOutput, sampleRoot = null) {
    const fe = step.forEach || {};
    const itemVar = fe.itemVar || 'item';
    const elementSample = inferLoopItemSample(fe.overRef, definition, toolToOutput, sampleRoot);
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

/**
 * The "Each item" pill at the head of an EXPANDED loop (canvas only — see
 * flow/inlineFlowlets.js). It is what the body's steps read from, so it has to
 * describe the same thing computeLoopBodyGroups offers the inspector's list
 * editor: `loop.<itemVar>`, resolved against the loop's own source.
 *
 * The two must agree — the same step is authorable from both surfaces, and a
 * path that works in one and not the other would be indistinguishable from a
 * broken binding. Hence the shared `inferLoopItemSample` / `sampleToFields`
 * pair, and hence the batch rule below.
 */
function describeLoopItem(node, definition, toolToOutput, sampleRoot = null) {
    const itemVar = node.itemVar || 'item';
    const batchSize = Math.max(1, Number(node.batchSize) || 1);
    const elementSample = inferLoopItemSample(node.overRef, definition, toolToOutput, sampleRoot) || {};
    const isPlainObject = elementSample && typeof elementSample === 'object' && !Array.isArray(elementSample);
    // execLoop binds a SLICE when batchSize > 1, not a single element, so there
    // is no single-item field list to offer — `loop.<var>.name` would resolve to
    // nothing. Same rule as computeLoopBodyGroups.
    const batched = batchSize > 1;
    return {
        id: node.id,
        label: batched ? `Current batch (loop.${itemVar})` : `Current item (loop.${itemVar})`,
        kind: 'loop',
        basePath: `loop.${itemVar}`,
        sample: batched ? [elementSample] : elementSample,
        fields: (batched || !isPlainObject) ? [] : sampleToFields(elementSample, `loop.${itemVar}`),
    };
}

function describeCondition(node) {
    // Mirrors execCondition's real output: { branch, value, expr } (C24) —
    // `value` (the boolean) and `expr` were real but invisible to the picker.
    const sample = { branch: 'then', value: true, expr: node.expr || '' };
    return {
        id: node.id,
        label: node.label || 'Condition',
        kind: 'condition',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

/** Mirrors execGuard's output — the branch plus what it found. */
function describeGuard(node) {
    const sample = {
        branch: 'then', hasPii: true, count: 2,
        categories: { Person: 1, Email: 1 },
        groups: { Personal: 1, Contact: 1 },
        scanned: 1200,
    };
    return {
        id: node.id,
        label: node.label || 'Check for personal data',
        kind: 'guard',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

/**
 * Mirrors execTokenize's output. `text` leads because it is the whole point of
 * the step — the value every downstream node should bind to.
 */
function describeTokenize(node) {
    const sample = {
        text: 'mail [person_1] at [email_1]',
        count: 2,
        categories: { Person: 1, Email: 1 },
        groups: { Personal: 1, Contact: 1 },
        vaultSize: 2,
    };
    return {
        id: node.id,
        label: node.label || 'Hide personal data',
        kind: 'tokenize',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

/** Mirrors execUntokenize's output, including what it could NOT resolve. */
function describeUntokenize(node) {
    const sample = {
        text: 'mail Jan de Vries at jan@acme.nl',
        value: 'mail Jan de Vries at jan@acme.nl',
        restored: 2,
        unresolved: 0,
        vaultSize: 2,
    };
    return {
        id: node.id,
        label: node.label || 'Show real values again',
        kind: 'untokenize',
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
    // Mirrors execNotification's real output — `{ delivered: { title, body,
    // channels } }`. The old `{ sent: true }` field has never existed at run
    // time (C22).
    const sample = { delivered: { title: node.title || '<title>', body: node.body || '<body>', channels: ['notification'] } };
    return {
        id: node.id,
        label: node.label || 'Notification',
        kind: 'notification',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

// Mirrors execHttpRequest's actual return shape (server/core/automationRunner/
// engine.js) — status/ok/headers/body/truncated, regardless of method.
function describeHttpRequest(node) {
    const sample = { status: 200, ok: true, headers: {}, body: '<response body>', truncated: false };
    return {
        id: node.id,
        label: node.label || 'HTTP Request',
        kind: 'http_request',
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
function describeSet(node, sampleRoot = null) {
    // Resolve each binding against the accumulated sample tree (C25): a Set
    // field bound to an upstream ARRAY used to preview as the opaque '<set>'
    // string, which made Set-assembled lists invisible to the Loop picker
    // (collectArrayPaths filters on Array.isArray) and every preview useless.
    const entries = node.fields && typeof node.fields === 'object' ? Object.entries(node.fields) : [];
    const resolveOne = (v, root = sampleRoot) => {
        if (v == null) return '<set>';
        if (typeof v !== 'object') return v; // bare literal — bind.js supports it
        if (v.kind === 'literal') return v.value ?? '<set>';
        if (v.kind === 'ref' && root) {
            const resolved = walkPath(String(v.path || ''), root);
            if (resolved !== undefined) return resolved;
        }
        if (v.kind === 'template' || v.kind === 'expr') return '<text>';
        return '<set>';
    };

    // LIST MODE — the runtime contract is `{items, count}` where every row is
    // the source element + the computed fields, reshaped by the operations
    // (server engine.js execSet). Mirror that fold on ONE sample row so
    // downstream pickers offer `items[*].<col>` with the POST-operations
    // column set — renamed/removed columns must disappear here, or a
    // downstream binding picker would offer paths the run never produces.
    if (typeof node.arrayRef === 'string') {
        const element = resolveElementSample(node.arrayRef, sampleRoot);
        const isObj = element != null && typeof element === 'object' && !Array.isArray(element);
        // Per-row scope: refs/previews resolve `item.*` (and `_index`).
        const rowRoot = { ...(sampleRoot || {}), item: element, _index: 0 };
        const added = Object.fromEntries(entries.map(([k, v]) => [k, resolveOne(v, rowRoot)]));
        const baseRow = isObj ? { ...element } : (element != null ? { value: element } : {});
        const row = applyOpsToSampleRow({ ...baseRow, ...added }, node.operations);
        const hasRow = Object.keys(row).length > 0;
        const sample = { items: hasRow ? [row] : [], count: 0 };
        return {
            id: node.id,
            label: node.label || SET_STEP_NAME,
            kind: 'set',
            basePath: `steps.${node.id}.output`,
            sample,
            fields: collectionItemsFields(node, hasRow ? row : null, sample),
        };
    }

    const sample = Object.fromEntries(entries.map(([k, v]) => [k, resolveOne(v)]));
    return {
        id: node.id,
        label: node.label || SET_STEP_NAME,
        kind: 'set',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: sampleToFields(sample, `steps.${node.id}.output`),
    };
}

/**
 * parse_json output = a FLAT object { <fieldName>: value } (the runtime
 * contract — see server execParseJson). Design-time execution: resolve each
 * field's relative path against the real sample when available (like
 * describeCollectionItems), so downstream previews show actual values;
 * otherwise fall back to '<extracted>' placeholders / declared fallbacks.
 */
function describeParseJson(node, sampleRoot = null) {
    const fields = Array.isArray(node.fields) ? node.fields.filter(f => f && f.name) : [];
    let src;
    if (sampleRoot && node.sourceRef) {
        src = walkPath(node.sourceRef, sampleRoot);
        if (typeof src === 'string') { try { src = JSON.parse(src); } catch { src = undefined; } }
    }
    // Grouped mode ("one row per entry") outputs { items, count } instead —
    // field paths then resolve inside a single entry.
    const itemsRef = typeof node.itemsRef === 'string' ? node.itemsRef.trim() : '';
    const rowFrom = (root) => Object.fromEntries(fields.map(f => {
        const v = root !== undefined ? walkRelativePath(f.path, root) : undefined;
        return [f.name, v !== undefined ? v : (f.fallback !== undefined ? f.fallback : '<extracted>')];
    }));
    if (itemsRef) {
        const arr = src !== undefined ? walkRelativePath(itemsRef, src) : undefined;
        const rows = Array.isArray(arr) ? arr.slice(0, 5).map(rowFrom) : [rowFrom(undefined)];
        const sample = { items: rows, count: Array.isArray(arr) ? arr.length : rows.length };
        return {
            id: node.id,
            label: node.label || 'Parse JSON',
            kind: 'parse_json',
            basePath: `steps.${node.id}.output`,
            sample,
            fields: sampleToFields(sample, `steps.${node.id}.output`),
        };
    }
    const sample = rowFrom(src);
    return {
        id: node.id,
        label: node.label || 'Parse JSON',
        kind: 'parse_json',
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

/**
 * A form page's output IS the visitor's answers, keyed by field name — the
 * same shape the trigger produces, one page later. Mirrors execFormPage's
 * return in server/core/automationRunner/engine.js: an 'input' page resolves
 * to the answers, an 'ending' page has nothing to bind.
 */
function describeFormPage(node) {
    if (node.mode === 'ending') return null;
    const fields = Array.isArray(node.form?.fields) ? node.form.fields.filter(f => f?.name) : [];
    const sampleFor = (f) => (f.type === 'checkbox' ? true
        : f.type === 'number' ? 42
        : f.type === 'date' ? '2026-01-31'
        : f.type === 'file' ? { kind: 'form_upload', filename: 'attachment.pdf' }
        : f.type === 'email' ? 'visitor@example.com'
        : f.label || 'answer');
    const base = `steps.${node.id}.output`;
    return {
        id: node.id,
        label: node.label || node.form?.title || 'Form page',
        kind: 'form_page',
        basePath: base,
        sample: Object.fromEntries(fields.map(f => [f.name, sampleFor(f)])),
        fields: fields.map(f => ({ key: f.name, path: `${base}.${f.name}`, sample: sampleFor(f) })),
    };
}

function describeSwitch(node) {
    const base = `steps.${node.id}.output`;
    const caseNames = (Array.isArray(node.cases) ? node.cases : []).map(c => c?.name).filter(Boolean);
    // Collection mode (switch on a table column, e.g. results[*].subject):
    // the matching ROWS land per case at output.matchesByCase.<name> — offer
    // those as bindable lists so a downstream Loop/Lists node can consume
    // exactly the rows that matched.
    const matchesByCase = Object.fromEntries([...caseNames, 'default'].map(n => [n, []]));
    const sample = { matched: caseNames[0] || 'case1', value: null, branch: `case:${caseNames[0] || 'case1'}`, matchesByCase };
    return {
        id: node.id,
        label: node.label || 'Switch',
        kind: 'switch',
        basePath: base,
        sample,
        fields: [
            { key: 'matched', path: `${base}.matched`, sample: sample.matched },
            { key: 'value', path: `${base}.value`, sample: null },
            { key: 'branch', path: `${base}.branch`, sample: sample.branch },
            ...[...caseNames, 'default'].map(n => ({
                key: `matchesByCase.${n}`,
                path: `${base}.matchesByCase.${n}`,
                sample: [],
            })),
        ],
    };
}

/**
 * Filter / Limit / Dedupe preserve the source array's ELEMENT shape inside
 * their `items` wrapper. Resolve the node's arrayRef against the accumulated
 * design-time sampleRoot so downstream pickers see the element fields as
 * `steps.<id>.output.items[*].<key>` children (the `[*]` flatten is resolved
 * identically by client walkPath and server bind.js). Falls back to the
 * bare `{ items: [] }` wrapper when the ref can't be resolved.
 */
function collectionItemsFields(node, elementSample, wrapperSample) {
    const base = `steps.${node.id}.output`;
    return Object.entries(wrapperSample).map(([k, v]) => {
        const field = { key: k, path: `${base}.${k}`, sample: v };
        if (k === 'items' && elementSample && typeof elementSample === 'object' && !Array.isArray(elementSample)) {
            field.children = Object.entries(elementSample).map(([ck, cv]) => ({
                key: ck,
                path: `${base}.items[*].${ck}`,
                sample: cv,
            }));
        }
        return field;
    });
}

function describeCollectionItems(node, label, sampleRoot = null) {
    const element = resolveElementSample(node.arrayRef, sampleRoot);
    const sample = { items: element != null ? [element] : [], count: 0 };
    return {
        id: node.id,
        label: node.label || label,
        kind: 'collection',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: collectionItemsFields(node, element, sample),
    };
}

function describeDedupe(node, sampleRoot = null) {
    const element = resolveElementSample(node.arrayRef, sampleRoot);
    const sample = { items: element != null ? [element] : [], removed: 0 };
    return {
        id: node.id,
        label: node.label || 'Remove duplicates',
        kind: 'collection',
        basePath: `steps.${node.id}.output`,
        sample,
        fields: collectionItemsFields(node, element, sample),
    };
}

function describeAggregate(node, sampleRoot = null) {
    const element = resolveElementSample(node.arrayRef, sampleRoot);
    const plucked = element && typeof element === 'object' && node.field ? element[node.field] : undefined;
    const sample = { values: plucked !== undefined ? [plucked] : [], count: 0 };
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

/**
 * Resolve an arrayRef path to the sample of ONE element of that array.
 * `sampleRoot` is either the accumulated design-time root (see
 * computeUpstreamGroups) or the NDV's previewSample (which overlays real
 * last-run / pinned outputs). Returns null when the path doesn't resolve
 * to a non-empty array.
 */
export function resolveElementSample(arrayRef, sampleRoot) {
    if (typeof arrayRef !== 'string' || !arrayRef.trim() || !sampleRoot) return null;
    const v = walkPath(arrayRef.trim(), sampleRoot);
    if (!Array.isArray(v) || v.length === 0) return null;
    return v[0] ?? null;
}

/**
 * Top-level field options of an array element — the ONLY level the server's
 * collection ops can address (engine.js reads `item?.[step.field]`, so
 * dotted paths silently fail there). Feeds FieldKeyCombobox.
 */
export function elementFieldOptions(elementSample) {
    if (!elementSample || typeof elementSample !== 'object' || Array.isArray(elementSample)) return [];
    return Object.entries(elementSample).map(([key, sample]) => ({ key, sample }));
}

/**
 * Append ONE object key to a ref path, quoting it when it isn't a bare JS
 * identifier.
 *
 * The builder used to concatenate `${base}.${key}` unconditionally. That is
 * fine for `results`, but a JSON key like "line-items" / "content-type" /
 * "2024 rows" produced `…output.line-items`, which the CLIENT walker happily
 * previews (bindingHelpers.walkPath deliberately skips the REF_RE check) while
 * the RUNTIME rejects it outright — server/automation/bind.js walkPath bails on
 * `!REF_RE.test(path)`, and REF_RE only accepts identifier segments after a
 * dot. Net effect: a Loop/Filter bound to such a list previewed perfectly at
 * design time and then failed every run with "arrayRef did not resolve to an
 * array". The bracket form `…output["line-items"]` IS accepted by REF_RE
 * (`\[(?:[0-9]+|\*|"[^"]*"|'[^']*')\]`) and by both tokenizers, so emit that.
 *
 * Keys containing a `"`, a backslash or a `]` stay unrepresentable in the
 * server's path grammar (REF_RE's `"[^"]*"` / tokenizePath's `indexOf(']')`) —
 * that is a pre-existing runtime limit, not something the builder can encode.
 */
const seg = (k) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? `.${k}` : `[${JSON.stringify(k)}]`);

/**
 * Every ARRAY-valued path reachable from the upstream groups — top-level
 * fields, one nesting level (children), plus arrays that only exist in the
 * real-run/pinned overlay (previewSample) and not in the schema sample.
 * Supersedes the top-level-only scans in LoopOverPicker and the old
 * CollectionArrayRefField. Returns [{ key, path, sample }].
 */
export function collectArrayPaths(groups, previewSample = null) {
    const out = [];
    const seen = new Set();
    const push = (key, path, sample) => {
        if (!path || seen.has(path)) return;
        seen.add(path);
        out.push({ key, path, sample });
    };
    for (const g of (groups || [])) {
        for (const f of (g.fields || [])) {
            if (Array.isArray(f.sample)) push(f.key, f.path, f.sample);
            for (const c of (f.children || [])) {
                if (Array.isArray(c.sample)) push(c.key, c.path, c.sample);
            }
        }
        // Real-run overlay: arrays present in actual output but absent from
        // the design-time sample (e.g. a tool with no curated outputSample).
        if (previewSample && g.basePath) {
            const actual = walkPath(g.basePath, previewSample);
            if (actual && typeof actual === 'object' && !Array.isArray(actual)) {
                for (const [k, v] of Object.entries(actual)) {
                    if (Array.isArray(v)) push(k, `${g.basePath}${seg(k)}`, v);
                }
            }
        }
    }
    return out;
}

export function sampleToFields(sample, basePath) {
    if (sample == null || typeof sample !== 'object') return [];
    const out = [];
    for (const [k, v] of Object.entries(sample)) {
        const path = `${basePath}${seg(k)}`;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            // One level of nesting: surface child keys too so users can
            // bind e.g. `trigger.output.organizer.email` without typing.
            const children = Object.entries(v).map(([ck, cv]) => ({
                key: ck,
                path: `${path}${seg(ck)}`,
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
 * sampleToFields for REAL data: same shape, plus `[*]` children for arrays of
 * objects (`…results[*].subject` — the collectionItemsFields convention), so a
 * real Gmail `results` array is expandable in the VariableTree and countable
 * by collectArrayPaths/nearestArrayRef. Design-time samples keep the plain
 * builder — placeholder arrays are `[]` and would only add noise.
 */
function sampleToFieldsReal(sample, basePath) {
    if (sample == null || typeof sample !== 'object') return [];
    const out = [];
    for (const [k, v] of Object.entries(sample)) {
        const path = `${basePath}${seg(k)}`;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            const children = Object.entries(v).map(([ck, cv]) => ({ key: ck, path: `${path}${seg(ck)}`, sample: cv }));
            out.push({ key: k, path, sample: v, children });
        } else if (Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object' && !Array.isArray(v[0])) {
            const children = Object.entries(v[0]).map(([ck, cv]) => ({ key: ck, path: `${path}[*]${seg(ck)}`, sample: cv }));
            out.push({ key: k, path, sample: v, children });
        } else {
            out.push({ key: k, path, sample: v });
        }
    }
    return out;
}

/**
 * Fold a node's REAL output (pinned or from the last run) into its group.
 *
 * sample: deepOverlay — real wins key-by-key, a real array/scalar replaces a
 * placeholder subtree wholesale (that is how an http_request's placeholder
 * string body becomes the real JSON array).
 *
 * fields: regenerated from the merged sample (with `[*]` children), then any
 * ORIGINAL field whose path isn't covered is appended — curated paths that
 * regeneration can't derive (forEach `results[*].item.*`, a switch's
 * `matchesByCase.<name>`, loop counters) must survive the overlay.
 *
 * Non-object real output (a schema-less ai_step returning a raw string) can't
 * produce a field list — keep the group's own fields but refresh the sample of
 * any field pointing at the base path itself.
 */
export function overlayGroupWithReal(group, realOutput) {
    if (realOutput === undefined) return group;
    const merged = deepOverlay(group.sample, realOutput);
    if (merged == null || typeof merged !== 'object' || Array.isArray(merged)) {
        const fields = (group.fields || []).map(f => (f.path === group.basePath ? { ...f, sample: merged } : f));
        return { ...group, sample: merged, fields, hasRealData: true };
    }
    const fields = sampleToFieldsReal(merged, group.basePath);
    const covered = new Set(fields.map(f => f.path));
    for (const f of (group.fields || [])) {
        if (!covered.has(f.path)) fields.push(f);
    }
    return { ...group, sample: merged, fields, hasRealData: true };
}

/**
 * Resolve an `overRef` like `steps.s1.output.results` to the element
 * shape — first item of that array in the source step's outputSample.
 * Returns null when the path can't be resolved (loop's item then has
 * no usable sample).
 */
export function inferLoopItemSample(overRef, definition, toolToOutput, sampleRoot = null) {
    if (typeof overRef !== 'string' || !overRef) return null;
    // Prefer the accumulated design-time sample root — it covers EVERY
    // upstream node type (collection ops, set, ai_step…), not just
    // integration actions. e.g. Loop over `steps.filter1.output.items`
    // finally shows the item fields.
    if (sampleRoot) {
        const arr = walkPath(overRef.trim(), sampleRoot);
        if (Array.isArray(arr) && arr.length > 0) {
            const el = arr[0];
            if (el && typeof el === 'object' && !Array.isArray(el)) return el;
        }
    }
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

/**
 * Upstream groups visible to ONE step inside a Loop's body (the inspector's
 * step-list editor — see LoopBodyEditor.jsx). Body steps aren't real DAG
 * nodes (execLoop runs them via a synthetic per-iteration sub-DAG, never
 * recorded individually), so this mirrors computeUpstreamGroups' topological
 * accumulation but scoped to what's ACTUALLY bound at runtime for body step
 * `bodyIndex`:
 *   - everything visible OUTSIDE the loop (outerGroups, unchanged)
 *   - a synthetic "current item" group for `loop.<itemVar>` — an
 *     array-of-elements sample when batchSize>1, exactly matching what
 *     execLoop binds (a slice, not a single element)
 *   - the real output shape of every EARLIER body step (0..bodyIndex-1),
 *     via the same describeNode() dispatch computeUpstreamGroups uses, so
 *     an integration_action/set/etc. body step offers typed field
 *     suggestions just like a normal upstream step would
 *
 * `previewSample` is the NDV's merged sample root (already resolves
 * loopStep.overRef against real-run/pinned data when available).
 */
export function computeLoopBodyGroups(loopStep, bodyIndex, outerGroups, previewSample, catalog, definition) {
    const itemVar = loopStep.itemVar || 'item';
    const batchSize = Math.max(1, Number(loopStep.batchSize) || 1);
    const elementSample = resolveElementSample(loopStep.overRef, previewSample) || {};
    const isPlainObject = elementSample && typeof elementSample === 'object' && !Array.isArray(elementSample);
    const itemGroup = {
        id: '__loop_item',
        label: batchSize > 1 ? `Current batch (loop.${itemVar})` : `Current item (loop.${itemVar})`,
        kind: 'loop',
        basePath: `loop.${itemVar}`,
        sample: batchSize > 1 ? [elementSample] : elementSample,
        // A batch is an ARRAY of items — no single-item field list to offer
        // (mirrors the array-sample branch of sampleToFields elsewhere).
        fields: (batchSize > 1 || !isPlainObject) ? [] : sampleToFields(elementSample, `loop.${itemVar}`),
    };
    const toolToOutput = buildToolOutputMap(catalog);
    const priorGroups = (loopStep.body || [])
        .slice(0, bodyIndex)
        .map((s) => describeNode(s, definition, toolToOutput, {}))
        .filter(Boolean);
    return [...(outerGroups || []), itemGroup, ...priorGroups];
}
