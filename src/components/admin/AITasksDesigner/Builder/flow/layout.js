import { edgeKey as defEdgeKey } from './branchEdges';
import { isFinitePos, runDagre } from './dagreLayout';
import { summariseEdgeData } from './dataSummary';
import { buildStepLabelMap } from './displayHelpers';
import { isInlineId, parseInlineId, toDisplayPosition } from './inlineFlowlets';

/**
 * Auto-layout the automation graph. Returns nodes/edges in the shape
 * React Flow expects (`{id, type, position, data}` for nodes,
 * `{id, source, target, label, data}` for edges).
 *
 * Each step / trigger may carry a persisted `position: {x, y}` written
 * by the drag-and-drop builder. When *every* node has a position we
 * skip dagre and use those coordinates verbatim. If any node lacks one,
 * dagre lays the whole graph out so the canvas is never garbled — the
 * caller is expected to write the dagre-derived positions back into the
 * definition on the next save so future renders are stable.
 *
 * Inputs:
 *   def        — the draft definition: { trigger, steps[], edges[] }
 *   runByStep  — Map<stepId, runStep> for live status / output
 *   issuesByStep — Map<stepId, { errors:[], warnings:[] }> for the badge
 *   onAddAfter — optional callback (nodeId) → void; piped through node
 *                `data` so per-type wrappers can render the n8n-style
 *                "+ next step" hover button without prop-drilling.
 *   dims       — { width, height } per-node estimate; passed in by the
 *                renderer so dagre's box sizing matches the rendered card.
 *   sidecar    — Map<prefix, entry> from inlineFlowlets.composeInlineGraph
 *                when `def` is a FLAT graph with expanded flowlets folded in.
 *                Containers become sized parent nodes, their contents become
 *                React Flow child nodes (`parentId` + `extent: 'parent'`).
 *   shiftById  — Map<id, {dx,dy}> from inlineFlowlets.shiftForExpansion: the
 *                display-only offset that moves neighbours out of an expanded
 *                container's way. Never written back to the definition.
 */
export function buildLayout(def, { runByStep, issuesByStep, onAddAfter = null, onDiagnose = null, dims = { width: 240, height: 96 }, sidecar = null, shiftById = null }) {
    if (!def || !def.trigger) {
        return { nodes: [], edges: [] };
    }
    const hasInline = !!sidecar && sidecar.size > 0;

    // Additional triggers (definition.triggers[] — webhook/app_event only,
    // scoped multi-trigger slice, see automation/validate.js's `triggers[]`
    // rules) are extra roots alongside the primary `definition.trigger`.
    // Dagre already tolerates multiple in-degree-0 nodes, so no layout-
    // algorithm change is needed beyond including them in `allSteps`.
    const additionalTriggers = Array.isArray(def.triggers) ? def.triggers : [];
    const allSteps = [def.trigger, ...additionalTriggers, ...(def.steps || [])];
    const triggerIds = new Set([def.trigger.id, ...additionalTriggers.map(t => t.id)]);
    const stepLabelById = buildStepLabelMap(def);
    if (hasInline) {
        // An inline step's own bindings address its siblings by LOCAL id
        // (`steps.s1.output.x`), so the expression humaniser needs those keys
        // too. Never overwrite a real top-level id.
        for (const s of allSteps) {
            if (!isInlineId(s.id)) continue;
            const { localId } = parseInlineId(s.id);
            if (!stepLabelById.has(localId)) stepLabelById.set(localId, s.label || localId);
        }
    }

    // Inline steps carry positions in their OWN flowlet's coordinate space, so
    // they must never be fed to dagre alongside the graph that contains them —
    // only the top-level nodes take part in the fallback layout.
    const topSteps = hasInline ? allSteps.filter(s => !isInlineId(s.id)) : allSteps;
    let positionById;
    if (topSteps.every(s => isFinitePos(s.position))) {
        positionById = new Map(topSteps.map(s => [s.id, { x: s.position.x, y: s.position.y }]));
    } else {
        const topEdges = hasInline
            ? (def.edges || []).filter(e => !isInlineId(e.from) && !isInlineId(e.to))
            : (def.edges || []);
        // Copy: runDagre hands back its cached Map, and the inline positions
        // below would otherwise be written into the shared LRU entry.
        positionById = new Map(runDagre(topSteps, topEdges, dims));
    }
    if (hasInline) {
        for (const s of allSteps) {
            if (isInlineId(s.id)) positionById.set(s.id, isFinitePos(s.position) ? s.position : { x: 0, y: 0 });
        }
    }

    const nodes = allSteps.map((s) => {
        const pos = positionById.get(s.id) || { x: 0, y: 0 };
        const inlineParent = hasInline ? sidecar.get(parseInlineId(s.id).prefix) || null : null;
        const container = hasInline ? sidecar.get(s.id) || null : null;
        // A flowlet's `layer_input` node is a trigger inside its own graph even
        // though it rides in the flat graph's `steps`. A loop's "Each item"
        // pill sits in the same slot but keeps its own type — it is not a
        // trigger, it has its own component.
        const isTrigger = triggerIds.has(s.id) || (!!inlineParent && s.type === 'trigger');
        const isContainerEntry = !!inlineParent && inlineParent.triggerId === s.id;
        const runStep = runByStep?.get(s.id) || null;
        const issues = issuesByStep?.get(s.id) || { errors: [], warnings: [] };
        const type = isTrigger ? 'trigger' : (s.type || 'integration_action');
        return {
            id: s.id,
            type,
            position: hasInline ? toDisplayPosition(s.id, pos, sidecar, shiftById) : { x: pos.x, y: pos.y },
            // React Flow draws a flowlet's contents as children of the
            // container node: positions relative to it, dragging clamped
            // inside it.
            ...(inlineParent ? { parentId: inlineParent.prefix, extent: 'parent' } : {}),
            // `width`/`height` as well as `style`: React Flow clamps an
            // `extent: 'parent'` child against the parent's KNOWN dimensions,
            // and until a measurement lands a style-only size reads as 0 — the
            // contents would all pile up in the container's top-left corner on
            // the first frame.
            ...(container
                ? {
                    width: container.size.width,
                    height: container.size.height,
                    style: { width: container.size.width, height: container.size.height },
                }
                : {}),
            // A container's entry node is structural: deleting a flowlet's
            // input would leave a triggerless mini-definition the validator
            // rejects, and a loop's "Each item" pill isn't in the document at
            // all, so there is nothing there to remove.
            ...(isContainerEntry ? { deletable: false } : {}),
            // onDiagnose stays scoped to the PRIMARY trigger only — the
            // diagnose backend isn't (yet) keyed by triggerStepId, so wiring
            // it to a secondary trigger would silently diagnose the wrong
            // one. Manual/dry-run stay primary-only for the same reason.
            data: {
                step: s,
                runStep,
                issues,
                isTrigger,
                onAddAfter,
                onDiagnose: (isTrigger && s.id === def.trigger.id) ? onDiagnose : null,
                stepLabelById,
                ...(container ? { inlineExpanded: container } : {}),
                ...(inlineParent ? { inlineParent } : {}),
            },
        };
    });

    const typeById = new Map(allSteps.map(s => [s.id, s.type]));
    const stepById = new Map(allSteps.map(s => [s.id, s]));

    // `__containerEntry` is the synthetic link from a loop's container node to
    // its "Each item" pill (inlineFlowlets.js). It exists so the variable
    // picker can see past the container into the flow before it; drawing it
    // would put a line from the container's output handle back into its own
    // first child.
    const defEdges = (def.edges || []).filter((e) => e.from && e.to && !e.__containerEntry);

    // Parallel-edge groups: several case edges between the SAME node pair
    // draw identical smooth-step paths on top of each other. LabelledEdge
    // fans them apart with a small per-lane offset; the lane index/count are
    // computed here where the whole edge list is in view.
    const pairCounts = new Map();
    for (const e of defEdges) {
        const pair = `${e.from}->${e.to}`;
        pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
    }
    const pairSeen = new Map();

    // ReactFlow ids must be unique; the definition allows true duplicate rows
    // (JSON/AI authoring), so suffix repeats of the identity key.
    const idSeen = new Map();

    const edges = defEdges
        .map((e) => {
            // Switch edges carry caseName and a label of form `case:<name>`.
            // Surface that as a chip so the user sees which branch each edge
            // routes to without having to click into the inspector.
            let kind = null;
            // Which source PORT this edge leaves from — must match a `<Handle
            // id>` rendered by the branch node (then/else for condition,
            // `case:<name>` / `case:default` for switch). Undefined for plain
            // edges, which attach to the node's single default source handle.
            let sourceHandle;
            // A guard branches on the same then/else labels as a condition,
            // but "match" / "otherwise" says nothing about what it decided —
            // give its two lines their own words.
            const fromGuard = typeById.get(e.from) === 'guard';
            if (e.label === 'then') { kind = fromGuard ? 'pii_found' : 'then'; sourceHandle = 'then'; }
            else if (e.label === 'else') { kind = fromGuard ? 'pii_clean' : 'else'; sourceHandle = 'else'; }
            else if (e.caseName) { kind = e.caseName === 'default' ? 'default' : e.caseName; sourceHandle = `case:${e.caseName}`; }
            else if (typeof e.label === 'string' && e.label.startsWith('case:')) { kind = e.label.slice(5); sourceHandle = e.label; }
            else if (e.label === 'on_error') {
                // MUST come before the loop fallback: a loop's on_error edge
                // used to fall into the done-port branch, rendering as the
                // ordinary "Done" edge with no chip and an undeletable "×"
                // (its handle-derived identity never matched) — B10.
                kind = 'on_error';
                sourceHandle = typeById.get(e.from) === 'loop' ? 'on_error' : undefined;
            }
            else if (typeById.get(e.from) === 'loop') {
                // A Loop step's remaining outgoing edge is its "Done"
                // port. Map it there regardless of label — today's saved
                // automations have this edge unlabelled, so inferring by
                // source-step-TYPE (not label) means no data migration.
                sourceHandle = 'done';
            }
            else if (e.label) kind = e.label;
            else if (typeById.get(e.from) === 'condition' || typeById.get(e.from) === 'switch' || fromGuard) {
                // Unlabelled edge out of a brancher: legal-looking, drawn from
                // the first port, but the runtime NEVER follows it (routing is
                // label-only). Mark it visually distinct instead of letting it
                // masquerade as a working connection (B5). Only JSON/AI
                // authoring can produce these — the canvas now refuses them.
                kind = 'unrouted';
            }
            // Which case slot this edge routes (index in the source switch's
            // cases array) — drives the automatic branch colours, so the line
            // and the node's port chip agree by construction.
            let caseIndex = null;
            const srcStep = stepById.get(e.from);
            const caseName = e.caseName ?? (typeof e.label === 'string' && e.label.startsWith('case:') ? e.label.slice(5) : null);
            if (caseName && caseName !== 'default' && Array.isArray(srcStep?.cases)) {
                const idx = srcStep.cases.findIndex(c => c?.name === caseName);
                if (idx >= 0) caseIndex = idx;
            }

            // Stable id: the definition row's identity, not its array index —
            // an index-based id changed on unrelated reorders and made
            // ReactFlow treat a recoloured edge as a brand-new element.
            const baseId = defEdgeKey(e);
            const dup = idSeen.get(baseId) || 0;
            idSeen.set(baseId, dup + 1);

            const pair = `${e.from}->${e.to}`;
            const parallelCount = pairCounts.get(pair) || 1;
            const parallelIndex = pairSeen.get(pair) || 0;
            pairSeen.set(pair, parallelIndex + 1);

            return {
                id: dup ? `${baseId}#dup${dup}` : baseId,
                source: e.from,
                target: e.to,
                ...(sourceHandle ? { sourceHandle } : {}),
                label: kind || undefined,
                // Carry sourceHandle in data too so the edge's "+" insert
                // control can thread the branch (then/else/case:<name>) through
                // to applyAddNode — otherwise splicing a step onto a branch
                // edge silently drops its routing label.
                //
                // defLabel/defCaseName are the DEFINITION row's true identity
                // (see flow/branchEdges.js): handlers that mutate edges must
                // match on these instead of reconstructing branch info from
                // the handle, or a delete/splice on one branch edge takes its
                // parallel siblings with it.
                data: {
                    kind,
                    sourceHandle: sourceHandle || null,
                    defLabel: e.label ?? null,
                    defCaseName: e.caseName ?? null,
                    // Persisted manual colour (palette key) + auto-colour inputs.
                    defColor: e.color ?? null,
                    caseIndex,
                    // Fan-out lane for parallel edges between the same pair.
                    ...(parallelCount > 1 ? { parallelIndex, parallelCount } : {}),
                    // How much data travelled down THIS connection on the last
                    // run ("201 records", "3 items"). Hitting ▶ on a node no
                    // longer opens its editor, so this is where the answer to
                    // "what goes to the next step" lives.
                    dataSummary: summariseEdgeData(stepById.get(e.from), runByStep?.get(e.from) || null, e),
                },
                type: 'labelled',
            };
        });

    return { nodes, edges };
}

/**
 * Returns a copy of `def` with `position: {x, y}` populated on every
 * step + trigger via dagre. Cheap to call repeatedly — used by the
 * editable canvas to backfill missing positions on first edit so users
 * don't snap a single node and have everything else fly to (0,0).
 *
 * On a FLAT graph (expanded flowlets folded in) the inline steps are skipped:
 * their coordinates belong to another graph and dagre must not mix the two.
 */
export function seedPositions(def, dims = { width: 240, height: 96 }) {
    if (!def || !def.trigger) return def;
    const additionalTriggers = Array.isArray(def.triggers) ? def.triggers : [];
    const allSteps = [def.trigger, ...additionalTriggers, ...(def.steps || [])]
        .filter(s => s && !isInlineId(s.id));
    if (allSteps.every(s => isFinitePos(s.position))) return def;
    const positionById = runDagre(
        allSteps,
        (def.edges || []).filter(e => !isInlineId(e.from) && !isInlineId(e.to)),
        dims,
    );
    const apply = (s) => isFinitePos(s.position) ? s : { ...s, position: positionById.get(s.id) || { x: 0, y: 0 } };
    return {
        ...def,
        trigger: apply(def.trigger),
        ...(additionalTriggers.length > 0 ? { triggers: additionalTriggers.map(apply) } : {}),
        steps: (def.steps || []).map(apply),
    };
}
