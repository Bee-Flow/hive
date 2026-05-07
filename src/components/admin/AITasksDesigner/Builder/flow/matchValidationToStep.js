/**
 * Filter validation records (errors + warnings) by step id. Same logic
 * the StepInspector uses — extracted so the diagram and the inspector
 * agree on what counts as "this step's problem".
 *
 * Records carry a `path` like `steps[<id>].expr` (see
 * server/automation/validate.js); we match by substring on the step id.
 */
export function matchValidationToStep(validation, stepId) {
    if (!validation || !stepId) return { errors: [], warnings: [] };
    const matches = (rec) => typeof rec?.path === 'string' && rec.path.includes(stepId);
    return {
        errors: (validation.errors || []).filter(matches),
        warnings: (validation.warnings || []).filter(matches),
    };
}

/**
 * Build a Map<stepId, {errors, warnings}> across the whole graph in
 * one pass. Used by the diagram's layout helper so each node only
 * receives its own slice.
 */
export function buildIssuesByStep(validation, def) {
    const out = new Map();
    if (!def) return out;
    const ids = [def.trigger?.id, ...(def.steps || []).map(s => s.id)].filter(Boolean);
    for (const id of ids) {
        const m = matchValidationToStep(validation, id);
        if (m.errors.length || m.warnings.length) out.set(id, m);
    }
    return out;
}
