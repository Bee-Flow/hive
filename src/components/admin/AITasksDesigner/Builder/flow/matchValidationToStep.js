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
export function buildIssuesByStep(validation, def, sidecar = null) {
    const out = new Map();
    if (!def) return out;
    // Secondary triggers (definition.triggers[]) get badges too — the server
    // now writes their record paths as `triggers[<id>]…` (C7), and the
    // substring match below picks the id straight out of that.
    const ids = [
        def.trigger?.id,
        ...(Array.isArray(def.triggers) ? def.triggers.map(t => t?.id) : []),
        ...(def.steps || []).map(s => s.id),
    ].filter(Boolean);
    for (const id of ids) {
        const m = matchValidationToStep(validation, id);
        if (m.errors.length || m.warnings.length) out.set(id, m);
    }
    // Expanded containers (inlineFlowlets.js): their nodes carry prefixed ids
    // (`cl1/s1`, `lp1/a`) that appear nowhere in a validation path. Both kinds
    // are reported under a scope of their own with the LOCAL id, so narrow to
    // that scope first and only then match the local id — otherwise a step
    // named `out` in one flowlet would collect every other flowlet's `out`
    // errors too. Without this, a broken step inside a container has its badge
    // land on nothing at all.
    //
    //   flowlet — `layers.<key>.…`                 (validate.js's layer pass)
    //   loop    — `steps[<loopId>].body.steps[…]`  (validate.js's walkNested)
    for (const [prefix, entry] of (sidecar || [])) {
        // A loop's scope is `includes`, not `startsWith`: the same loop inside a
        // flowlet reports as `layers.<key>.steps[<loopId>].body.…`.
        const scope = entry.kind === 'loop'
            ? `steps[${entry.callStepId}].body.`
            : `layers.${entry.layerKey}.`;
        const inScope = (rec) => typeof rec?.path === 'string'
            && (entry.kind === 'loop' ? rec.path.includes(scope) : rec.path.startsWith(scope));
        const errors = (validation?.errors || []).filter(inScope);
        const warnings = (validation?.warnings || []).filter(inScope);
        if (!errors.length && !warnings.length) continue;
        for (const childId of (entry.childIds || [])) {
            const local = childId.slice(prefix.length + 1);
            const m = {
                errors: errors.filter(r => r.path.includes(local)),
                warnings: warnings.filter(r => r.path.includes(local)),
            };
            if (m.errors.length || m.warnings.length) out.set(childId, m);
        }
    }
    return out;
}
