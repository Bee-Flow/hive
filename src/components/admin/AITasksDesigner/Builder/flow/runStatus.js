import { isTruncatedOutput } from '../mapping/realOutputs';
import { isInlineId } from './inlineFlowlets';

/**
 * The per-step run row the canvas decorates from (edge chips, node status
 * borders, run colouring) — one place that answers "what happened at this
 * node", so a PINNED node reads as a node with data even when there is no
 * run row at all (e.g. right after a page reload, when the in-memory run
 * state is gone but the pin lives on in the definition).
 *
 *   - primary rows only: `parentStepId` sub-rows are a layer call's internal
 *     steps and must not shadow the parent node's own row — UNLESS that
 *     flowlet is expanded on this canvas, in which case its internals ARE
 *     nodes here. The runner namespaces those rows `<callStepId>/<subStepId>`,
 *     which is exactly the id inlineFlowlets.js gives the inline nodes, so
 *     they line up by construction. Requiring both the namespaced shape and a
 *     matching node keeps a bare sub-row from shadowing a root step that
 *     happens to share its id.
 *   - a real run row wins over the synthetic pin stub — a run that actually
 *     executed already consumed the pin (the server replays pinnedOutput as a
 *     'pinned' row itself)
 *
 * Pure; colocated test in runStatus.test.js.
 */
export function effectiveRunByStep(definition, runSteps) {
    const m = new Map();
    const nodes = [];
    if (definition?.trigger?.id) nodes.push(definition.trigger);
    for (const t of (definition?.triggers || [])) if (t?.id) nodes.push(t);
    for (const s of (definition?.steps || [])) if (s?.id) nodes.push(s);
    const nodeIds = new Set(nodes.map(n => n.id));
    for (const r of (runSteps || [])) {
        if (!r?.stepId) continue;
        if (r.parentStepId && !(isInlineId(r.stepId) && nodeIds.has(r.stepId))) continue;
        const cur = m.get(r.stepId);
        if (!cur) { m.set(r.stepId, r); continue; }
        // LATEST attempt wins — first-wins showed a retried step's stale
        // failure forever. STRICT comparisons (`>`, never `>=`) keep the
        // first record on equal keys, so ordering stays stable.
        const attempts = Number(r.attempts || 0);
        const curAttempts = Number(cur.attempts || 0);
        const at = r.startedAt ? Date.parse(r.startedAt) || 0 : 0;
        const curAt = cur.startedAt ? Date.parse(cur.startedAt) || 0 : 0;
        if (attempts > curAttempts || (attempts === curAttempts && at > curAt)) m.set(r.stepId, r);
    }
    for (const node of nodes) {
        if (m.has(node.id)) continue;
        if (node.pinnedOutput == null || isTruncatedOutput(node.pinnedOutput)) continue;
        m.set(node.id, { stepId: node.id, status: 'pinned', output: node.pinnedOutput });
    }
    return m;
}
