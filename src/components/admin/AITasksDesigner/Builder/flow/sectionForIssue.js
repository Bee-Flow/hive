/**
 * Maps validation issues to the inspector accordion section that contains
 * the offending field, so SettingsForm can force that section open (errors
 * must never hide behind a collapsed section).
 *
 * Validation records carry an id-based path like `steps[<id>].inputs.subject`
 * / `steps[<id>].expr` / `steps[<id>].forEach.overRef` / `trigger.kind`
 * (server/automation/validate.js). `stepIssues` is already filtered to one
 * step (matchValidationToStep), so here we only need the FIELD TAIL after the
 * step id, then map its leading segment to a section key.
 *
 * `null` in a type's map = a flat, always-visible field (Label, Prompt,
 * Trigger kind) — no section to open. An unknown tail falls back to the
 * type's first section so an error is never silently hidden.
 */

const FLAT = null;

// Per-step-type: section order is implied by the values; `fallback` is the
// section an unrecognised field tail opens. Keep these field→section maps in
// sync with the <AccordionSection> boundaries in SettingsForm.jsx.
const TAXONOMY = {
    ai_step: {
        fallback: 'advanced',
        map: {
            label: FLAT, prompt: FLAT,
            systemPrompt: 'advanced', model: 'advanced', modelTier: 'advanced', allowTools: 'advanced',
            inputs: 'inputs',
            outputFields: 'output',
            forEach: 'advanced',
        },
    },
    integration_action: {
        fallback: 'basics',
        map: { label: FLAT, tool: 'basics', operation: 'basics', inputs: 'inputs', forEach: 'advanced' },
    },
    condition: { fallback: 'condition', map: { label: FLAT, expr: 'condition' } },
    loop: { fallback: 'loop', map: { label: FLAT, overRef: 'loop', itemVar: 'loop', maxIterations: 'loop' } },
    notification: { fallback: 'message', map: { label: FLAT, title: 'message', body: 'message', inputs: 'message' } },
    set: { fallback: 'fields', map: { label: FLAT, fields: 'fields', inputs: 'fields' } },
    layer_output: { fallback: 'fields', map: { label: FLAT, fields: 'fields' } },
    call_layer: { fallback: 'inputs', map: { label: FLAT, layerKey: 'flowlet', layerId: 'flowlet', inputs: 'inputs' } },
    switch: { fallback: 'basics', map: { label: FLAT, expr: 'basics', cases: 'cases' } },
    datetime: { fallback: 'config', map: { label: FLAT, op: 'config', input: 'config', input2: 'config', amount: 'config', format: 'config', part: 'config', unit: 'config' } },
    wait: { fallback: 'config', map: { label: FLAT, seconds: 'config' } },
    stop_error: { fallback: 'config', map: { label: FLAT, message: 'config' } },
    filter: { fallback: 'config', map: { label: FLAT, arrayRef: 'config', expr: 'config' } },
    limit: { fallback: 'config', map: { label: FLAT, arrayRef: 'config', count: 'config', maxItems: 'config' } },
    dedupe: { fallback: 'config', map: { label: FLAT, arrayRef: 'config', field: 'config' } },
    aggregate: { fallback: 'config', map: { label: FLAT, arrayRef: 'config', field: 'config' } },
    summarize: { fallback: 'config', map: { label: FLAT, arrayRef: 'config' } },
    code: { fallback: 'code', map: { label: FLAT, code: 'code', language: 'code' } },
    trigger: { fallback: 'config', map: { label: FLAT, kind: FLAT, params: 'config', appEvent: 'event', scheduleCron: 'schedule', scheduleTz: 'schedule' } },
};

/** Strip the path down to the field tail after the step id (or `trigger`). */
function fieldTail(path, stepId) {
    if (typeof path !== 'string') return '';
    let tail = path;
    const idIdx = stepId ? path.indexOf(stepId) : -1;
    if (idIdx >= 0) tail = path.slice(idIdx + stepId.length);
    else if (path.startsWith('trigger')) tail = path.slice('trigger'.length);
    return tail.replace(/^\]?\.?/, ''); // drop a leading `].` / `.`
}

/** Leading field segment of a tail, e.g. `inputs.subject` → `inputs`. */
function leadingSegment(tail) {
    return (String(tail).split(/[.[\]]/).filter(Boolean)[0]) || '';
}

/**
 * @param {object} step        the step being edited (needs `type`, `id`)
 * @param {{errors?:[], warnings?:[]}} stepIssues  step-scoped validation
 * @returns {Set<string>} section keys that contain at least one error
 */
export function sectionsWithErrors(step, stepIssues) {
    const out = new Set();
    if (!step || !stepIssues) return out;
    const tax = TAXONOMY[step.type];
    if (!tax) return out;
    for (const rec of (stepIssues.errors || [])) {
        const seg = leadingSegment(fieldTail(rec?.path, step.id));
        if (!seg) continue;
        const section = tax.map[seg];
        if (section === FLAT) continue;           // always-visible field
        out.add(section || tax.fallback);          // unknown tail → first section
    }
    return out;
}

export { TAXONOMY };
