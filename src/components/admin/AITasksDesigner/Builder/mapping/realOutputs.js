/**
 * Real step output — the bridge between "what a run/pin actually produced"
 * and the design-time sample world the editors reason in.
 *
 * The builder used to keep these separate: `computeUpstreamGroups` (auto-map,
 * VariableTree, LoopOverPicker) saw only static describer samples, while the
 * one place that overlaid real data was a private helper inside NodeDetailView.
 * The visible symptom: run a step, get 10 real records, add a Filter after it —
 * and the new node still says "no list picked yet" because the auto-mapper
 * never saw the records. This module is the single shared source:
 *
 *   buildRealOutputMap(definition, runSteps)  → Map<stepId, output>
 *
 * built once per render by the canvas owner (BuildTab) and threaded into
 * computeUpstreamGroups / autoMapStep / NodeDetailView, so every consumer of
 * `groups` heals at once.
 *
 * Pure, framework-free. Never deep-clones outputs (a pinned output can be
 * 256 KB — the server's truncation cap); everything holds references.
 */

/**
 * The server replaces any step payload over its 256 KB cap with a sentinel
 * `{ __truncated__: true, originalBytes, headSample }` (see
 * server/automation/payloadTruncation.js). A sentinel is not data — it must
 * never become a sample, an auto-map source, or a pin.
 */
export function isTruncatedOutput(v) {
    return !!v && typeof v === 'object' && v.__truncated__ === true;
}

/**
 * Overlay real output onto a design-time sample, key by key. Real data wins;
 * a real scalar/array replaces the sample subtree wholesale (a real Gmail
 * `results` array is the truth, not a merge candidate). Sample keys the real
 * output lacks survive — a describer may know fields a particular run didn't
 * happen to produce.
 *
 * (Moved verbatim from NodeDetailView so the whole builder shares one
 * definition of "real wins".)
 */
export function deepOverlay(base, real) {
    if (real === null || typeof real !== 'object' || Array.isArray(real)) return real;
    if (base === null || typeof base !== 'object' || Array.isArray(base)) return real;
    const out = { ...base };
    for (const k of Object.keys(real)) out[k] = (k in base) ? deepOverlay(base[k], real[k]) : real[k];
    return out;
}

/**
 * The freshest real output per node id.
 *
 *   - Only ids that exist in the definition (trigger, secondary triggers,
 *     steps) — rows for deleted steps linger in the builder stream state and
 *     must not resurrect them.
 *   - Run rows: primary rows only (no `parentStepId` sub-rows from layer
 *     calls), non-null and non-truncated output. First match wins, matching
 *     the long-standing NodeDetailView lookup semantics.
 *   - Pinned output (stored on the step in the definition) OVERRIDES a run
 *     row — a pin is the user saying "this is the data I'm building against".
 */
export function buildRealOutputMap(definition, runSteps) {
    const map = new Map();
    if (!definition) return map;

    const nodes = [];
    if (definition.trigger?.id) nodes.push(definition.trigger);
    for (const t of (definition.triggers || [])) if (t?.id) nodes.push(t);
    for (const s of (definition.steps || [])) if (s?.id) nodes.push(s);
    const knownIds = new Set(nodes.map(n => n.id));

    for (const r of (runSteps || [])) {
        if (!r || r.parentStepId || !knownIds.has(r.stepId)) continue;
        if (r.output == null || isTruncatedOutput(r.output)) continue;
        if (!map.has(r.stepId)) map.set(r.stepId, r.output);
    }

    for (const node of nodes) {
        if (node.pinnedOutput == null || isTruncatedOutput(node.pinnedOutput)) continue;
        map.set(node.id, node.pinnedOutput);
    }

    return map;
}

/**
 * Assemble the preview root tree ({trigger, steps, loop}) the binding editors
 * resolve paths against — from groups that computeUpstreamGroups has ALREADY
 * overlaid with real data (`hasRealData`).
 *
 * Replaces NodeDetailView's private builder and fixes two of its bugs by
 * construction:
 *   - multi-trigger clobber: every trigger-kind group used to write
 *     trigger.output, so a secondary trigger's placeholder overwrote the
 *     primary's real data. Now a group carrying real data locks the slot.
 *   - loop scope: loop groups were assigned without any real overlay; the
 *     overlay now happens upstream (inferLoopItemSample resolves against the
 *     real sample root), so whatever the group holds IS the truth.
 */
export function buildSampleRoot(groups) {
    const root = { trigger: { output: {} }, steps: {}, loop: {} };
    let triggerLocked = false;
    for (const g of (groups || [])) {
        if (g.kind === 'trigger') {
            if (triggerLocked) continue;
            root.trigger.output = g.sample || {};
            if (g.hasRealData) triggerLocked = true;
        } else if (String(g.basePath || '').startsWith('loop.')) {
            // The group's BASE PATH decides its slot, not its `kind`. Two very
            // different groups carry kind:'loop' — the per-item scope
            // (`loop.<itemVar>`, describeForEachItem / computeLoopBodyGroups)
            // AND a Loop STEP seen from downstream (`steps.<id>.output`, whose
            // runtime value is execLoop's `{iterations, results:[…]}` envelope
            // — see describeLoop). Keying on `kind` filed the STEP under
            // `root.loop['<id>.output']`, colliding with the loop-scope
            // namespace and leaving `root.steps.<id>` empty: nothing wired
            // AFTER a Loop resolved in any preview, auto-map or picker.
            const tail = String(g.basePath).split('.').slice(1).join('.');
            if (tail) root.loop[tail] = g.sample || {};
        } else {
            root.steps[g.id] = { output: g.sample || {} };
        }
    }
    return root;
}
