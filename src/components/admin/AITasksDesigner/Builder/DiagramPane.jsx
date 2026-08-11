import {
    ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Panel,
    useReactFlow, MarkerType, applyNodeChanges,
} from '@xyflow/react';
import { Crosshair, Trash2, X, Zap } from 'lucide-react';
import React, { forwardRef, useMemo, useCallback, useRef, useState, useEffect, useImperativeHandle } from 'react';
import '@xyflow/react/dist/style.css';

import { NodeRuntimeContext } from './flow/NodeRuntimeContext';
import { normalizeDefinitionShape, emptyGraph } from './flow/normalizeDefinition';
import { branchFromHandle, edgeKey, matchesEdgeIdentity } from './flow/branchEdges';
import { readStepPayload, dropTargetFromPoint, sameDropTarget } from './flow/stepDrag';
import { defaultFormDeclaration } from './flow/settings/FormTriggerFields';
import { defaultFormPageDeclaration, defaultFormEndingDeclaration } from './flow/settings/FormBuilderFields';
import { findNodeDropTarget, sameNodeDropTarget } from './flow/nodeDropTarget';
import { isRouteStep, routePorts } from './flow/routeModel';
import { ROUTE_STEP_NAME } from './flow/stepDisplayName';
import { defaultTriggerLabel } from './flow/triggerLabels';
import { effectiveRunByStep } from './flow/runStatus';
import { computeRunFocus } from './flow/runFocus';
import { spliceStepIntoEdge } from './flow/branchEdges';
import { decorateRunEdges, identityColorForEdge } from './flow/edgeColoring';
import { resolvePiiGroupColors } from './flow/edgeColorOps';
import { EdgeCrossingProvider } from './flow/EdgeCrossingContext';
import { edgeTypes } from './flow/edges';
import { CONTAINER_HEADER, fromDisplayPosition, isInlineId, parseInlineId, prefixAddedStep, sameInlineScope } from './flow/inlineFlowlets';
import { buildLayout, seedPositions } from './flow/layout';
import LineColorPanel from './flow/LineColorPanel';
import { buildIssuesByStep } from './flow/matchValidationToStep';
import NodeContextMenu from './flow/NodeContextMenu';
import {
    applyDeleteNodes, applyDuplicateNode, applyDetachNode,
    canDeleteNode, canDuplicateNode, canDetachNode,
} from './flow/nodeOps';

import AggregateNode from './flow/nodes/AggregateNode';
import AiStepNode from './flow/nodes/AiStepNode';
import CallFlowletNode from './flow/nodes/CallFlowletNode';
import CallStepNode from './flow/nodes/CallStepNode';
import CodeNode from './flow/nodes/CodeNode';
import ConditionNode from './flow/nodes/ConditionNode';
import DateTimeNode from './flow/nodes/DateTimeNode';
import DedupeNode from './flow/nodes/DedupeNode';
import FilterNode from './flow/nodes/FilterNode';
import FlowletOutputNode from './flow/nodes/FlowletOutputNode';
import FormPageNode from './flow/nodes/FormPageNode';
import GuardNode from './flow/nodes/GuardNode';
import HttpRequestNode from './flow/nodes/HttpRequestNode';
import IntegrationActionNode from './flow/nodes/IntegrationActionNode';
import LimitNode from './flow/nodes/LimitNode';
import LoopItemNode from './flow/nodes/LoopItemNode';
import LoopNode from './flow/nodes/LoopNode';
import NotificationNode from './flow/nodes/NotificationNode';
import ParseJsonNode from './flow/nodes/ParseJsonNode';
import SetNode from './flow/nodes/SetNode';
import StopErrorNode from './flow/nodes/StopErrorNode';
import SummarizeNode from './flow/nodes/SummarizeNode';
import SwitchNode from './flow/nodes/SwitchNode';
import TokenizeNode from './flow/nodes/TokenizeNode';
import TriggerNode from './flow/nodes/TriggerNode';
import UntokenizeNode from './flow/nodes/UntokenizeNode';
import WaitNode from './flow/nodes/WaitNode';
import { applyAutoMapToStep } from './mapping/autoMapInputs';
import scopedStorage from '../../../../utils/scopedStorage';
import { toast } from '../../../shared/Toast';

// Exported so flow/nodeDefs.test.js can assert this and flow/nodeDefs.js name
// the same set of step types: every renderable type needs a presentation
// record, and every record needs either a component here or a documented
// reason in nodeDefs' PALETTE_ABSENT. A type missing from one side used to
// surface as a raw type name in the UI (or, for approval/parallel, a bare
// unstyled React Flow default node with no handles).
export const NODE_TYPES = {
    trigger:            TriggerNode,
    integration_action: IntegrationActionNode,
    ai_step:            AiStepNode,
    condition:          ConditionNode,
    loop:               LoopNode,
    code:               CodeNode,
    notification:       NotificationNode,
    http_request:       HttpRequestNode,
    form_page:          FormPageNode,
    // n8n-style utility nodes
    set:                SetNode,
    parse_json:         ParseJsonNode,
    datetime:           DateTimeNode,
    wait:               WaitNode,
    stop_error:         StopErrorNode,
    switch:             SwitchNode,
    filter:             FilterNode,
    guard:              GuardNode,
    tokenize:           TokenizeNode,
    untokenize:         UntokenizeNode,
    limit:              LimitNode,
    dedupe:             DedupeNode,
    aggregate:          AggregateNode,
    summarize:          SummarizeNode,
    // Flowlets (reusable sub-automations)
    call_layer:         CallFlowletNode,
    layer_output:       FlowletOutputNode,
    // Steps (reusable standalone building blocks, kind='block')
    call_block:         CallStepNode,
    // Canvas-only: the "Each item" pill at the head of an expanded loop. Not a
    // step — see nodeDefs' SYNTHETIC_TYPES.
    loop_item:          LoopItemNode,
};

// Stable default edge options — direction arrowhead at the target end so
// the user can read flow direction at a glance, plus the labelled-edge
// custom type that supports then/else branch chips.
const DEFAULT_EDGE_OPTIONS = {
    type: 'labelled',
    markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'var(--text-tertiary)',
        width: 14,
        height: 14,
    },
};

/**
 * Interactive flow diagram for the automation builder.
 *
 * Three modes, controlled by `editable` + `readOnly`:
 *   - readOnly={true}:  pan/zoom disabled. Node clicks still fire IF an
 *                       onNodeClick handler is supplied (run-replay
 *                       click-to-inspect); with no handler nothing bubbles
 *                       (static Quick & Expert thumbnails).
 *   - editable={false}: clickable nodes (Build with AI inspector), no drag.
 *   - editable={true}:  full n8n-style canvas — drag, connect handles, drop
 *                       from palette, Delete-key to remove. Position + edge
 *                       changes call `onDefinitionChange(nextDef)`; the
 *                       parent persists via the existing automation API.
 *
 * Imperative handle (forwarded via ref) exposes:
 *   - getCenter():  returns flow-coordinates for the current viewport center.
 *                   The slide-in NodePalette uses this for click-to-add when
 *                   the user didn't drop at a specific position.
 *
 * Cycle protection: `onConnect` rejects edges that would create a cycle
 * or a self-loop. The runtime validator catches it anyway, but blocking
 * at the UI prevents a broken save round-trip while the user is still
 * arranging the graph.
 */
const DiagramPane = forwardRef(function DiagramPane({
    definition,
    runSteps = [],
    onNodeClick,
    onNodeExpand,      // (nodeId) — double-click: open the FULL editor
    onDefinitionChange,
    validation = null,
    readOnly = false,
    editable = false,
    structuralEditsBlocked = false, // true while SSE stream is patching the def
    onRequestAddNode,   // ({ sourceId, position }) — called when user drags an edge end into empty pane
    onRequestOpenPalette, // () — called by the empty-state CTA on a fresh draft
    onRequestAddAfter,  // (nodeId) — called when user clicks the "+" hover button on a node
    onRequestInsertOnEdge, // ({ sourceId, targetId, position }) — "+" on an edge: insert a step between two nodes
    onDropStep,         // (payload, { position, sourceId?, targetId?, label?, caseName? }) — a step dragged in from the ribbon
    onExecuteStep,      // (stepId) — n8n-style per-node ▶ button
    executingStepId = null,
    runInFlight = false,
    catalog = null,           // tool catalog — needed for auto-mapping on connect
    realOutputById = null,    // Map<stepId, output> (mapping/realOutputs) — real run/pinned data for auto-map + chips
    autoMapEnabled = true,    // auto-map inputs when an edge is drawn
    onAutoMapped,             // (stepId, count) — fired after a successful auto-map
    onOpenLayer,              // (layerKey) — drill into an inline flowlet's sub-canvas
    layerSummaries = {},      // { layerKey: description } — shown on call_layer nodes
    onStepAdded,              // (payload, sourceStep|null) — usage telemetry for the smart Add-step menu
    highlightedStepId = null, // stepId briefly ringed — e.g. after a validation-issue click
    // ── expanded flowlets ────────────────────────────────────────────────
    // `definition` may be a FLAT graph (inlineFlowlets.composeInlineGraph) with
    // one or more flowlets folded in. These three describe that folding; when
    // no flowlet is expanded they are empty and every path below is the
    // ordinary single-graph one.
    sidecar = null,           // Map<prefix, entry> — what was folded in where
    shiftById = null,         // Map<id, {dx,dy}> — display-only neighbour shift
    onToggleInline = null,    // (nodeId, layerKey) — expand/collapse in place
    layerRefCounts = {},      // { layerKey: callSiteCount }
}, ref) {
    return (
        <ReactFlowProvider>
            {/* Lets each edge see where the others are drawn, so a crossing gets
                a bridge instead of an ambiguous junction. Wraps the whole pane
                rather than the canvas, so it survives a canvas remount. */}
            <EdgeCrossingProvider>
            <DiagramPaneInner
                ref={ref}
                onOpenLayer={onOpenLayer}
                layerSummaries={layerSummaries}
                definition={definition}
                runSteps={runSteps}
                onNodeClick={onNodeClick}
                onNodeExpand={onNodeExpand}
                onDefinitionChange={onDefinitionChange}
                validation={validation}
                readOnly={readOnly}
                editable={editable}
                structuralEditsBlocked={structuralEditsBlocked}
                onRequestAddNode={onRequestAddNode}
                onRequestOpenPalette={onRequestOpenPalette}
                onRequestAddAfter={onRequestAddAfter}
                onRequestInsertOnEdge={onRequestInsertOnEdge}
                onDropStep={onDropStep}
                onExecuteStep={onExecuteStep}
                executingStepId={executingStepId}
                runInFlight={runInFlight}
                catalog={catalog}
                realOutputById={realOutputById}
                autoMapEnabled={autoMapEnabled}
                onAutoMapped={onAutoMapped}
                onStepAdded={onStepAdded}
                highlightedStepId={highlightedStepId}
                sidecar={sidecar}
                shiftById={shiftById}
                onToggleInline={onToggleInline}
                layerRefCounts={layerRefCounts}
            />
            </EdgeCrossingProvider>
        </ReactFlowProvider>
    );
});

export default DiagramPane;

const DiagramPaneInner = forwardRef(function DiagramPaneInner({
    definition, runSteps, onNodeClick, onNodeExpand, onDefinitionChange,
    validation, readOnly, editable, structuralEditsBlocked,
    onRequestAddNode, onRequestOpenPalette, onRequestAddAfter, onRequestInsertOnEdge,
    onDropStep = null,
    onExecuteStep, executingStepId, runInFlight,
    catalog = null, realOutputById = null, autoMapEnabled = true, onAutoMapped, onOpenLayer,
    layerSummaries = {},
    onDiagnose = null,
    onStepAdded,
    highlightedStepId = null,
    sidecar = null,
    shiftById = null,
    onToggleInline = null,
    layerRefCounts = {},
}, ref) {
    const rf = useReactFlow();
    const hasInline = !!sidecar && sidecar.size > 0;
    const inlineExpandedIds = useMemo(() => new Set(sidecar ? sidecar.keys() : []), [sidecar]);
    const inlineTriggerIds = useMemo(
        () => new Set(sidecar ? [...sidecar.values()].map(e => e.triggerId).filter(Boolean) : []),
        [sidecar],
    );
    // Expanded LOOP containers, by prefix. A loop body is an ordered array with
    // no edges of its own: the chain on screen IS the order, derived on the way
    // in and read back on the way out (flow/loopBodyEdges.js). So the gestures
    // that change order all work, and the ones that would draw something the
    // runtime can't do — a free-hand connection, deleting a link — are refused
    // rather than silently undone by the next render.
    const loopPrefixes = useMemo(
        () => new Set(sidecar ? [...sidecar.values()].filter(e => e.kind === 'loop').map(e => e.prefix) : []),
        [sidecar],
    );
    const inLoopBody = useCallback(
        (nodeId) => loopPrefixes.size > 0 && loopPrefixes.has(parseInlineId(nodeId).prefix),
        [loopPrefixes],
    );

    /**
     * A node's absolute canvas position. React Flow stores a node inside an
     * expanded flowlet relative to its container, so anything that hands a
     * position OUT of this component has to add the ancestors back on.
     */
    const absPositionOf = useCallback((node) => {
        if (!node?.position) return null;
        let { x, y } = node.position;
        let parent = node.parentId;
        while (parent) {
            const pn = rf.getNode?.(parent);
            if (!pn?.position) break;
            x += pn.position.x;
            y += pn.position.y;
            parent = pn.parentId;
        }
        return { x, y };
    }, [rf]);

    /**
     * Which graph a canvas point belongs to: the innermost expanded flowlet
     * whose box contains it (its header strip excluded — dropping on the title
     * bar means "next to the flowlet", not "into it"), or '' for the canvas's
     * own graph.
     */
    const scopeAtPoint = useCallback((point) => {
        if (!hasInline || !point) return '';
        let best = '';
        for (const [prefix, entry] of sidecar) {
            const abs = absPositionOf(rf.getNode?.(prefix));
            if (!abs) continue;
            const inside = point.x >= abs.x && point.x <= abs.x + entry.size.width
                && point.y >= abs.y + CONTAINER_HEADER && point.y <= abs.y + entry.size.height;
            if (inside && prefix.length > best.length) best = prefix;
        }
        return best;
    }, [hasInline, sidecar, rf, absPositionOf]);
    const wrapperRef = useRef(null);

    // Clicking a node opens its focused Node Detail View (NDV) — owned by the
    // parent (BuilderShell). The canvas itself no longer renders any
    // node-anchored panels.

    // Primary run rows + synthetic 'pinned' stubs for pinned nodes without a
    // run row — so a pin alone still yields edge chips and node status (e.g.
    // after a reload, when in-memory run state is gone but pins persist).
    const runByStep = useMemo(() => effectiveRunByStep(definition, runSteps), [definition, runSteps]);

    // "Colour lines by" — a per-user presentational lens (never part of the
    // definition: it would pollute version diffs for zero shared value).
    // 'branches' by default: automatic case colours only touch case edges,
    // and manual colours render in every mode.
    const [edgeColorMode, setEdgeColorModeState] = useState(
        () => {
            const v = scopedStorage.getItem('builderEdgeColorMode');
            return v === 'off' || v === 'pii' ? v : 'branches';
        },
    );
    const setEdgeColorMode = useCallback((mode) => {
        setEdgeColorModeState(mode);
        scopedStorage.setItem('builderEdgeColorMode', mode);
    }, []);
    // The PII option only means something once a loaded run step carries a
    // pii summary (builder test-runs with the Privacy Shield applied to
    // routines) — offered disabled with an explanatory tooltip until then.
    const hasPiiData = useMemo(() => {
        for (const r of runByStep.values()) if (r?.piiSummary) return true;
        return false;
    }, [runByStep]);

    const issuesByStep = useMemo(
        () => buildIssuesByStep(validation, definition, sidecar),
        [validation, definition, sidecar],
    );

    // Per-node delete / duplicate. Reached from the node's hover chrome, the
    // canvas context menu, and the node detail view — three surfaces, one pair
    // of handlers (BFSF-319). Declared ABOVE runtimeContextValue because that
    // memo publishes them to every node component.
    //
    // Read their inputs through a ref so the callbacks keep a STABLE identity.
    // `onDefinitionChange` is BuilderShell's `onVisualEdit`, whose useCallback
    // depends on the draft-history object — recreated every render — so a
    // normal dep array would churn `runtimeContextValue` on every render and
    // re-render all 23 node components each time.
    const nodeOpsRef = useRef(null);
    nodeOpsRef.current = { definition, editable, structuralEditsBlocked, onDefinitionChange, catalog, realOutputById, autoMapEnabled, onAutoMapped, inlineTriggerIds };

    const onDeleteNode = useCallback((stepId) => {
        const { definition: def, editable: ed, structuralEditsBlocked: blocked, onDefinitionChange: emit, inlineTriggerIds: protectedIds } = nodeOpsRef.current;
        if (!ed || blocked || !stepId) return;
        // The layer_input of an expanded flowlet: its mini-definition requires
        // exactly one, so there is nothing sensible to do here.
        if (protectedIds?.has?.(stepId)) return;
        const next = applyDeleteNodes(def, stepId);
        if (next === def) return; // primary trigger / unknown id
        emit?.(seedPositions(next));
    }, []);

    // "Remove it from the connection" — unwire the step but keep it. The
    // definition it emits already carries the parked position, so this must NOT
    // go through a re-layout; seedPositions leaves set positions alone.
    const onDetachNode = useCallback((stepId) => {
        const { definition: def, editable: ed, structuralEditsBlocked: blocked, onDefinitionChange: emit } = nodeOpsRef.current;
        if (!ed || blocked || !stepId) return;
        const next = applyDetachNode(def, stepId);
        if (next === def) return; // not a step, or already loose
        emit?.(seedPositions(next));
    }, []);

    const onDuplicateNode = useCallback((stepId) => {
        const { definition: def, editable: ed, structuralEditsBlocked: blocked, onDefinitionChange: emit } = nodeOpsRef.current;
        if (!ed || blocked || !stepId) return;
        const { definition: next, newStepId } = applyDuplicateNode(def, stepId);
        if (!newStepId) return; // triggers aren't duplicable
        // The copy of a step inside an expanded flowlet belongs to that
        // flowlet — without the prefix it would land in the flow around it.
        const { prefix } = parseInlineId(stepId);
        emit?.(seedPositions(prefix ? prefixAddedStep(next, newStepId, prefix) : next));
    }, []);

    // Derive runtime context: which steps are pinned / disabled / mid-run.
    // The 17 per-type node components read this via NodeRuntimeContext so
    // their call-sites stay unchanged.
    const runtimeContextValue = useMemo(() => {
        const pinnedById = new Set();
        const disabledById = new Set();
        // Custom per-step symbol (a Lucide icon name set in the inspector).
        // StepNodeBase reads this to override the default type icon.
        const customIconById = new Map();
        const allSteps = [definition?.trigger, ...(definition?.steps || [])].filter(Boolean);
        for (const s of allSteps) {
            if (s.pinnedOutput !== undefined && s.pinnedOutput !== null) pinnedById.add(s.id);
            if (s.disabled) disabledById.add(s.id);
            if (s.icon) customIconById.set(s.id, s.icon);
        }
        // Run ordinal — 1-based by finishedAt — so users can see "3/8" on
        // the currently running node. The node still showing 'running'
        // gets ordinal = (count of completed) + 1. 'pinned' steps count as
        // completed for ordering — they're synthetic but the user wants
        // to see their position in the run.
        const ordered = (runSteps || []).filter(s => s.stepId && (s.status === 'success' || s.status === 'skipped' || s.status === 'pinned'))
            .slice().sort((a, b) => String(a.finishedAt || '').localeCompare(String(b.finishedAt || '')));
        const runIndexById = new Map();
        ordered.forEach((s, i) => runIndexById.set(s.stepId, i + 1));
        const runningStep = (runSteps || []).find(s => s.status === 'running');
        if (runningStep?.stepId) runIndexById.set(runningStep.stepId, ordered.length + 1);
        const runTotal = allSteps.length - 1; // exclude trigger
        return {
            pinnedById,
            disabledById,
            customIconById,
            onExecuteStep: editable ? onExecuteStep : null,
            executingStepId,
            runInFlight,
            runIndexById,
            runTotal,
            onOpenLayer: onOpenLayer || null,
            layerSummaries: layerSummaries || {},
            highlightedStepId,
            // Node actions (BFSF-319). Null on a read-only canvas or while the
            // AI holds structural edits, so StepNodeBase renders no chrome.
            onDeleteNode: (editable && !structuralEditsBlocked) ? onDeleteNode : null,
            onDuplicateNode: (editable && !structuralEditsBlocked) ? onDuplicateNode : null,
            onDetachNode: (editable && !structuralEditsBlocked) ? onDetachNode : null,
            // Which nodes are wired to anything — the Disconnect button is
            // pointless on a loose card, so it isn't rendered there. Nor on a
            // step inside a loop: its links are derived from the body's order,
            // so "take it out of the flow" would be undone on the next render.
            // Deleting it, or dragging it somewhere else in the chain, are the
            // two things that mean something there.
            attachedIds: new Set(
                (definition?.edges || [])
                    .flatMap(e => [e.from, e.to])
                    .filter(id => id && !inLoopBody(id)),
            ),
            primaryTriggerId: definition?.trigger?.id || null,
            // A flowlet's `layer_input` node is its trigger, so it gets the
            // same treatment as one: never duplicated, never detached, and —
            // since its mini-definition needs exactly one — never deleted.
            triggerIds: new Set([
                definition?.trigger?.id,
                ...(definition?.triggers || []).map(t => t?.id),
                ...inlineTriggerIds,
            ].filter(Boolean)),
            undeletableIds: inlineTriggerIds,
            // Expand/collapse a flowlet in place. Offered on a read-only canvas
            // too — looking inside a sub-flow isn't an edit.
            onToggleInline,
            inlineExpanded: inlineExpandedIds,
            layerRefCounts,
        };
    }, [definition, runSteps, onExecuteStep, executingStepId, runInFlight, editable, structuralEditsBlocked, onOpenLayer, layerSummaries, highlightedStepId, onToggleInline, inlineExpandedIds, inlineTriggerIds, inLoopBody, layerRefCounts]);

    // ── Where the run is ─────────────────────────────────────────────────
    //
    // Lives in ./flow/runFocus so the reconciliation against the live graph
    // (BFSF-364 — a deleted node must not keep a "Run failed" banner alive, and
    // `done` must never exceed `total`) can be tested without mounting the
    // whole canvas.
    const runFocus = useMemo(
        () => computeRunFocus({ runSteps, runInFlight, definition }),
        [runSteps, runInFlight, definition],
    );

    const focusRunStep = useCallback(() => {
        if (!runFocus?.stepId) return;
        const node = rf?.getNode?.(runFocus.stepId);
        const abs = absPositionOf(node);
        if (!abs) return;
        // Keep the user's zoom — jumping the scale as well as the position is
        // disorienting when it happens mid-run.
        rf.setCenter?.(
            abs.x + (node.measured?.width ?? node.width ?? 240) / 2,
            abs.y + (node.measured?.height ?? node.height ?? 60) / 2,
            { duration: 300, zoom: rf.getZoom?.() },
        );
    }, [rf, runFocus?.stepId, absPositionOf]);

    // Quick-add "+" callback only fires in editable mode — there's no
    // point rendering the button on a read-only canvas where structural
    // edits are blocked.
    const onAddAfterForLayout = (editable && !structuralEditsBlocked) ? onRequestAddAfter : null;

    const { nodes: computedNodes, edges } = useMemo(
        () => buildLayout(definition, { runByStep, issuesByStep, onAddAfter: onAddAfterForLayout, onDiagnose, sidecar, shiftById }),
        [definition, runByStep, issuesByStep, onAddAfterForLayout, onDiagnose, sidecar, shiftById],
    );

    // ── Live drag mirror ────────────────────────────────────────────────
    //
    // React Flow is in controlled mode — `nodes` is the source of truth
    // and it does NOT animate drags by itself. If we keep using the
    // computed-from-definition nodes directly, the visual stays frozen
    // while the user drags (definition only updates on drag-end). So we
    // mirror computedNodes into local state and apply React Flow's
    // position changes on every onNodesChange tick. The definition is
    // still only written at drag-end via commitNodePositions, so we
    // don't thrash buildLayout / the debounced save round-trip.
    const [nodes, setNodes] = useState(computedNodes);
    // Track whether ReactFlow is currently dragging a node. If `definition`
    // updates mid-drag (e.g. an autosave round-trip rewrites positions),
    // unconditional sync would snap the dragged node back to the persisted
    // position. We sync immediately on a non-drag definition change, and
    // defer the sync to drag-end otherwise.
    const isDraggingRef = useRef(false);
    const pendingComputedRef = useRef(null);
    // `buildLayout` rebuilds nodes from the definition, and those fresh objects
    // carry no `selected` flag — so every re-layout (a run tick, a validation
    // pass, an autosave round-trip) silently dropped the user's selection and
    // multi-select looked broken. Selection is view state, not document state:
    // carry it across the sync.
    const carrySelection = useCallback((next) => {
        setNodes((prev) => {
            const selected = new Set(prev.filter(n => n.selected).map(n => n.id));
            if (selected.size === 0) return next;
            return next.map(n => (selected.has(n.id) ? { ...n, selected: true } : n));
        });
    }, []);
    useEffect(() => {
        if (isDraggingRef.current) {
            pendingComputedRef.current = computedNodes;
            return;
        }
        pendingComputedRef.current = null;
        carrySelection(computedNodes);
    }, [computedNodes, carrySelection]);

    useImperativeHandle(ref, () => ({
        /**
         * Flow-coordinates for the current viewport center. Used by the
         * slide-in palette when the user clicks (rather than drags) an item
         * — we need a sensible drop position and the canvas center is the
         * least surprising default.
         */
        getCenter: () => {
            const bounds = wrapperRef.current?.getBoundingClientRect();
            if (!bounds) return { x: 0, y: 0 };
            const cx = bounds.left + bounds.width / 2;
            const cy = bounds.top + bounds.height / 2;
            return rf.screenToFlowPosition
                ? rf.screenToFlowPosition({ x: cx, y: cy })
                : { x: bounds.width / 2, y: bounds.height / 2 };
        },
        /**
         * Pan/zoom the viewport to center a specific node — used when the
         * user clicks a validation issue to jump to the node it's about.
         * Highlighting itself is driven by the `highlightedStepId` prop
         * (via NodeRuntimeContext), not by this method.
         */
        focusStep: (stepId) => {
            if (!stepId || !rf.fitView) return;
            rf.fitView({ nodes: [{ id: stepId }], duration: 300, maxZoom: 1, padding: 0.5 });
        },
    }), [rf]);

    // ── Edit handlers ───────────────────────────────────────────────────

    // ── Drag a node next to something to wire it up ──────────────────────
    //
    // While a LOOSE node is dragged, the connection or node it would attach to
    // lights up and a hint follows the cursor, so "if I let go now, this
    // happens" is visible before the drop. Repositioning a node that already
    // has connections is left alone — see flow/nodeDropTarget.js.
    const [nodeDropTarget, setNodeDropTarget] = useState(null);
    const [dropHintPos, setDropHintPos] = useState(null);
    const pendingConnectRef = useRef(null);

    /** Apply a pending drop-target wiring to a definition. */
    const applyPendingConnect = useCallback((def, draggedId) => {
        const hit = pendingConnectRef.current;
        pendingConnectRef.current = null;
        if (!hit) return def;
        const dragged = (def.steps || []).find(s => s.id === draggedId)
            || (def.triggers || []).find(t => t.id === draggedId)
            || (def.trigger?.id === draggedId ? def.trigger : null);
        const firstPort = isRouteStep(dragged) ? routePorts(dragged)[0] : null;
        let wired;
        let downstreamId;
        if (hit.kind === 'edge') {
            const identity = { label: hit.label, caseName: hit.caseName };
            wired = { ...def, edges: spliceStepIntoEdge(def.edges || [], draggedId, hit.sourceId, hit.targetId, identity, firstPort) };
            downstreamId = draggedId; // the dragged node was spliced into the edge
        } else {
            // Chaining onto a node: a brancher's continuation must leave by a
            // real port, or the runtime never follows it (B5).
            const source = hit.from === draggedId ? dragged : ((def.steps || []).find(s => s.id === hit.from) || null);
            const port = isRouteStep(source) ? routePorts(source)[0] : null;
            const branch = {};
            if (port?.label) branch.label = port.label;
            if (port?.caseName != null) branch.caseName = port.caseName;
            wired = { ...def, edges: [...(def.edges || []), { from: hit.from, to: hit.to, ...branch }] };
            downstreamId = hit.to;
        }
        // Drag-to-wire used to be the ONE connect surface that never
        // auto-mapped — a loose node dropped next to a data-bearing node got
        // wired but stayed unconfigured. Same recipe as onConnect below.
        const { catalog: cat, realOutputById: real, autoMapEnabled: am, onAutoMapped: notify } = nodeOpsRef.current;
        if (am && cat && downstreamId) {
            const { definition: mapped, mappedKeys, forEachEnabled } = applyAutoMapToStep(wired, downstreamId, cat, { realOutputById: real });
            if (mappedKeys.length || forEachEnabled) {
                notify?.(downstreamId, mappedKeys.length, forEachEnabled);
                return mapped;
            }
        }
        return wired;
    }, []);

    const onNodeDrag = useCallback((event, node) => {
        if (!editable || structuralEditsBlocked) return;
        // Only offer to wire the dragged node to things in ITS graph — a node
        // inside an expanded flowlet can't connect to the flow around it.
        const candidates = (rf.getNodes ? rf.getNodes() : [])
            .filter(n => sameInlineScope(n.id, node.id));
        const hit = findNodeDropTarget({
            draggedId: node.id,
            nodes: candidates,
            renderedEdges: hasInline ? edges.filter(e => sameInlineScope(e.source, node.id)) : edges,
            definition,
        });
        setNodeDropTarget(prev => (sameNodeDropTarget(prev, hit) ? prev : hit));
        if (!hit) { setDropHintPos(null); return; }
        const bounds = wrapperRef.current?.getBoundingClientRect();
        if (bounds) setDropHintPos({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    }, [editable, structuralEditsBlocked, rf, edges, definition, hasInline]);

    /**
     * Release: hand the wiring to commitNodePositions so the new position and
     * the new connection land in ONE definition update — two separate writes
     * from the same closure would clobber each other.
     *
     * React Flow emits the drag-stop position change and this callback in an
     * order we don't control, so if the position commit already went out
     * (leaving the ref unconsumed) we write the connection ourselves on the
     * next tick. Either order ends with both applied, exactly once.
     */
    const onNodeDragStop = useCallback((_event, node) => {
        const hit = nodeDropTarget;
        setNodeDropTarget(null);
        setDropHintPos(null);
        if (!hit || !editable || structuralEditsBlocked) return;
        pendingConnectRef.current = hit;
        setTimeout(() => {
            if (!pendingConnectRef.current) return;   // commitNodePositions took it
            const { definition: def, onDefinitionChange: emit } = nodeOpsRef.current;
            emit?.(seedPositions(applyPendingConnect(def, node?.id)));
        }, 0);
    }, [nodeDropTarget, editable, structuralEditsBlocked, applyPendingConnect]);

    const commitNodePositions = useCallback((changes) => {
        // Pick out position changes that finished (drag-stop emits one with
        // `dragging: false`). Live-drag changes don't need to round-trip
        // through the definition — ReactFlow handles the in-flight ghost
        // itself, and writing back on every pixel move would thrash the
        // SSE/debounced save.
        const finished = changes.filter(c => c.type === 'position' && c.dragging === false && c.position);
        if (finished.length === 0) return;
        // React Flow hands back DISPLAY coordinates: a node inside an expanded
        // flowlet is positioned relative to its container, and a node the
        // container pushed aside carries that shift. Storing either verbatim
        // would walk the graph across the canvas every time a flowlet is
        // expanded and collapsed.
        const byId = new Map(finished.map(c => [
            c.id,
            hasInline ? fromDisplayPosition(c.id, c.position, sidecar, shiftById) : c.position,
        ]));
        const apply = (s) => byId.has(s.id) ? { ...s, position: byId.get(s.id) } : s;
        // Mirror seedPositions' own shape: triggers[] (secondary triggers)
        // must be rebuilt too — dragging one used to write a definition that
        // simply omitted the move, so the node snapped back on the next
        // layout pass (B6).
        const moved = {
            ...definition,
            trigger: apply(definition.trigger),
            ...(Array.isArray(definition.triggers) ? { triggers: definition.triggers.map(apply) } : {}),
            steps: (definition.steps || []).map(apply),
        };
        // A node dropped next to a connection/node also gets WIRED here, in the
        // same commit as its position — one definition update, one undo entry.
        const next = seedPositions(applyPendingConnect(moved, finished[0]?.id));
        onDefinitionChange?.(next);
    }, [definition, onDefinitionChange, applyPendingConnect, hasInline, sidecar, shiftById]);

    const onNodesChange = useCallback((changes) => {
        // Always mirror the position into local state so the node moves
        // with the cursor during drag. We do this regardless of
        // `editable` because applyNodeChanges also handles selection,
        // dimensions, and removal events that React Flow expects to
        // round-trip — ignoring them entirely makes the canvas feel
        // broken in subtle ways (e.g. selection ring not updating).
        setNodes(prev => applyNodeChanges(changes, prev));
        // Track drag in-flight so the computedNodes sync effect doesn't
        // snap a dragged node back when the definition reflows mid-drag.
        for (const c of changes) {
            if (c.type === 'position') {
                if (c.dragging === true) isDraggingRef.current = true;
                else if (c.dragging === false) {
                    isDraggingRef.current = false;
                    // Drain any deferred computedNodes sync now.
                    if (pendingComputedRef.current) {
                        const pending = pendingComputedRef.current;
                        pendingComputedRef.current = null;
                        carrySelection(pending);
                    }
                }
            }
        }
        if (!editable) return;
        // Persist to the definition only when the drag finishes
        // (commitNodePositions filters dragging:false changes).
        commitNodePositions(changes);
    }, [editable, commitNodePositions]);

    const onEdgesChange = useCallback((_changes) => {
        // No-op: edges are derived from definition.edges. Selection state is
        // ephemeral and handled by ReactFlow; structural removals go through
        // onEdgesDelete which we wire below.
    }, []);

    // ── Multi-select ─────────────────────────────────────────────────────
    //
    // Everything that ACTS on a multi-selection already handles one: React
    // Flow drags every selected node together, `onNodesDelete` receives the
    // whole set, and `commitNodePositions` writes every finished move in one
    // definition update (so a group move is one undo step). What was missing
    // was the gesture and any sign that a selection existed at all.
    const [selectedIds, setSelectedIds] = useState([]);
    const onSelectionChange = useCallback(({ nodes: sel }) => {
        setSelectedIds((prev) => {
            const next = (sel || []).map(n => n.id);
            // React Flow re-emits on every internal change; a new array with
            // the same ids would re-render the whole canvas for nothing.
            if (prev.length === next.length && prev.every((id, i) => id === next[i])) return prev;
            return next;
        });
    }, []);

    // A modifier-click is a selection gesture, not "open this node" — without
    // this, ctrl-clicking a second node opened its editor over the canvas.
    const onNodeClickWithSelection = useCallback((evt, node) => {
        if (evt?.ctrlKey || evt?.metaKey || evt?.shiftKey) return;
        onNodeClick?.(node.id);
    }, [onNodeClick]);

    const clearSelection = useCallback(() => {
        rf?.setNodes?.(ns => ns.map(n => (n.selected ? { ...n, selected: false } : n)));
    }, [rf]);

    const deleteSelection = useCallback(() => {
        if (!editable || structuralEditsBlocked || selectedIds.length === 0) return;
        const ids = selectedIds.filter(id => !inlineTriggerIds.has(id));
        if (ids.length === 0) return;
        const next = applyDeleteNodes(definition, ids);
        if (next === definition) return;
        onDefinitionChange?.(seedPositions(next));
    }, [definition, editable, structuralEditsBlocked, selectedIds, onDefinitionChange, inlineTriggerIds]);

    const onConnect = useCallback(({ source, target, sourceHandle }) => {
        if (!editable || structuralEditsBlocked) return;
        if (!source || !target || source === target) return;
        // A flowlet is a separate graph: an edge from inside one to the flow
        // around it has nowhere to live, and the runtime has no way to follow
        // it. Data crosses that boundary through the flowlet's inputs and its
        // Return step, not through a connection.
        if (!sameInlineScope(source, target)) return;
        // Inside a loop, the lines are drawn FROM the body's order, not the
        // other way round: the runtime rebuilds them per iteration and runs the
        // body top to bottom (engine.js buildLinearEdges). A hand-drawn branch
        // or merge here would be rubbed out by the next render, so say why
        // rather than appearing to accept it.
        if (inLoopBody(source) || inLoopBody(target)) {
            toast.info('Steps inside a loop always run top to bottom. Drag a step onto the line to move it.');
            return;
        }
        // Capture which branch port the edge was dragged from so the runtime
        // routes it correctly. `then`/`else` for a condition; `case:<name>`
        // (incl. `case:default`) for a switch. Plain steps drag from the
        // single default handle (no id) and stay unlabelled.
        const branch = branchFromHandle(sourceHandle);
        // A brancher (condition/switch) routes ONLY along labelled edges — an
        // unlabelled edge out of one draws from the first port but never
        // fires at run time (B5). The branch nodes only expose branch
        // handles, so this is unreachable via normal dragging; it guards the
        // programmatic/stale-handle paths. stop_error edges are dead by
        // definition (B9) — nothing ever runs after a Stop-and-Error.
        const sourceStep = source === definition.trigger?.id
            ? definition.trigger
            : (definition.steps || []).find(s => s.id === source);
        if (sourceStep && (sourceStep.type === 'condition' || sourceStep.type === 'switch') && !branch.label) return;
        if (sourceStep?.type === 'stop_error') return;
        // Cycle guard: rebuild adjacency including the proposed edge and
        // check whether `source` is reachable from `target`. If so, the new
        // edge would close a loop — reject.
        const existing = definition.edges || [];
        // Dedupe by source+target+branch so two different branch ports can
        // legitimately route to the same downstream step.
        if (existing.some(e => e.from === source && e.to === target && (e.label || null) === (branch.label || null))) return;
        if (createsCycle(definition, source, target)) return;
        const nextEdges = [...existing, { from: source, to: target, ...branch }];
        // Compute against the def WITH the new edge so the target sees its
        // new upstream source, then auto-map its still-empty inputs.
        let nextDef = seedPositions({ ...definition, edges: nextEdges });
        if (autoMapEnabled && catalog) {
            const { definition: mapped, mappedKeys, forEachEnabled } = applyAutoMapToStep(nextDef, target, catalog, { realOutputById });
            nextDef = mapped;
            if (mappedKeys.length || forEachEnabled) onAutoMapped?.(target, mappedKeys.length, forEachEnabled);
        }
        onDefinitionChange?.(nextDef);
    }, [definition, editable, structuralEditsBlocked, onDefinitionChange, autoMapEnabled, catalog, realOutputById, onAutoMapped, inLoopBody]);

    /**
     * When the user drags a connection handle but releases over the empty
     * pane (no target handle), open the slide-in palette anchored at the
     * drop point so they can pick a follow-up step. The parent will insert
     * BOTH the node AND the source→new edge in one definition update so
     * undo treats it as a single action.
     */
    const onConnectEnd = useCallback((event, connectionState) => {
        if (!editable || structuralEditsBlocked) return;
        if (!onRequestAddNode) return;
        // React Flow v12 connectionState has isValid + fromNode. We only
        // want the "dropped on pane" case — if isValid is true the user hit
        // an existing handle and onConnect already fired.
        if (!connectionState || connectionState.isValid) return;
        const sourceId = connectionState.fromNode?.id;
        if (!sourceId) return;
        // Which branch port the drag started from — so a step created by
        // dropping on empty pane is wired to that branch (then/else/case).
        const sourceHandle = connectionState.fromHandle?.id || null;
        const clientX = event.clientX ?? event.changedTouches?.[0]?.clientX;
        const clientY = event.clientY ?? event.changedTouches?.[0]?.clientY;
        if (clientX == null || clientY == null) return;
        const position = rf.screenToFlowPosition
            ? rf.screenToFlowPosition({ x: clientX, y: clientY })
            : { x: clientX, y: clientY };
        onRequestAddNode({ sourceId, position, sourceHandle });
    }, [editable, structuralEditsBlocked, onRequestAddNode, rf]);

    // Delete-key / marquee edge deletion. React Flow hands us the RENDERED
    // edges, whose data carries the definition row's true identity
    // (layout.js: defLabel/defCaseName). Matching on the full edgeKey removes
    // exactly the selected rows — the bare (source,target) pair used to take
    // every parallel branch edge between the same two nodes with it (B4).
    const onEdgesDelete = useCallback((deleted) => {
        if (!editable || structuralEditsBlocked) return;
        if (!deleted || deleted.length === 0) return;
        const all = definition.edges || [];
        const remove = new Set();
        for (const d of deleted) {
            if (d.data && ('defLabel' in d.data || 'defCaseName' in d.data)) {
                remove.add(edgeKey({ from: d.source, to: d.target, label: d.data.defLabel || undefined, caseName: d.data.defCaseName ?? undefined }));
            } else {
                // Stale render without identity data: only pair-match when it
                // is unambiguous — refuse to over-delete parallel branches.
                const pairRows = all.filter(e => e.from === d.source && e.to === d.target);
                if (pairRows.length === 1) remove.add(edgeKey(pairRows[0]));
            }
        }
        if (remove.size === 0) return;
        const nextEdges = all.filter(e => !remove.has(edgeKey(e)));
        onDefinitionChange?.(seedPositions({ ...definition, edges: nextEdges }));
    }, [definition, editable, structuralEditsBlocked, onDefinitionChange]);

    // "×" button on an edge — remove just that connection. Identity comes
    // from the edge's own data (label/caseName, threaded via edges.jsx); the
    // handle-derived branch remains as fallback for stale renders.
    const onEdgeDeleteClick = useCallback(({ source, target, sourceHandle, label, caseName }) => {
        if (!editable || structuralEditsBlocked || !source || !target) return;
        const identity = (label != null || caseName != null)
            ? { label, caseName }
            : branchFromHandle(sourceHandle || null); // {} | {label} | {label,caseName}
        const hasIdentity = identity.label != null || identity.caseName != null;
        const matchesClicked = (e) => {
            if (e.from !== source || e.to !== target) return false;
            if (!hasIdentity && sourceHandle == null) return true; // plain edge — pair match is enough
            return matchesEdgeIdentity(e, identity);
        };
        const nextEdges = (definition.edges || []).filter(e => !matchesClicked(e));
        onDefinitionChange?.(seedPositions({ ...definition, edges: nextEdges }));
    }, [definition, editable, structuralEditsBlocked, onDefinitionChange]);

    // Palette button on an edge — persist (or clear) the connection's colour.
    // Cosmetic definition data: identity-matched exactly like delete, but no
    // re-layout and no seedPositions (topology is untouched).
    const onEdgeSetColor = useCallback(({ source, target, sourceHandle, label, caseName, color }) => {
        if (!editable || structuralEditsBlocked || !source || !target) return;
        const identity = (label != null || caseName != null)
            ? { label, caseName }
            : branchFromHandle(sourceHandle || null);
        const hasIdentity = identity.label != null || identity.caseName != null;
        const matchesClicked = (e) => {
            if (e.from !== source || e.to !== target) return false;
            if (!hasIdentity && sourceHandle == null) return true;
            return matchesEdgeIdentity(e, identity);
        };
        const nextEdges = (definition.edges || []).map((e) => {
            if (!matchesClicked(e)) return e;
            if (!color) {
                // "auto" — remove the key entirely rather than persisting null.
                const { color: _dropped, ...rest } = e;
                return rest;
            }
            return { ...e, color };
        });
        onDefinitionChange?.({ ...definition, edges: nextEdges });
    }, [definition, editable, structuralEditsBlocked, onDefinitionChange]);

    // "+" button on an edge — insert a step BETWEEN source and target. We
    // hand the parent both ends + a midpoint position so it can open the
    // palette; on pick it splices the new node in (source→new→target) and
    // drops ONLY the clicked edge (identity-matched — B3).
    const onEdgeInsertClick = useCallback(({ source, target, sourceHandle, label, caseName }) => {
        if (!editable || structuralEditsBlocked || !source || !target || !onRequestInsertOnEdge) return;
        // Absolute, not the raw node positions: inside an expanded flowlet
        // those are relative to the container, and the midpoint would land
        // near the canvas origin.
        const a = absPositionOf(rf.getNode?.(source));
        const b = absPositionOf(rf.getNode?.(target));
        const position = (a && b) ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
        // Thread the branch identity so the spliced-in step keeps routing on
        // the same branch AND the sibling branch edges survive the splice.
        onRequestInsertOnEdge({
            sourceId: source, targetId: target, position,
            sourceHandle: sourceHandle || null,
            label: label ?? null, caseName: caseName ?? null,
        });
    }, [editable, structuralEditsBlocked, onRequestInsertOnEdge, rf, absPositionOf]);

    // Delete via the Delete/Backspace key, the node's hover "🗑" button, or the
    // canvas context menu — all land here.
    //
    // `applyDeleteNodes` BRIDGES the graph rather than just pruning it: removing
    // a step from the middle of a flow used to drop every edge touching it,
    // silently severing the chain and stranding everything downstream as
    // unreachable roots (BFSF-319). It also keeps the primary-trigger guard —
    // the runtime requires exactly one — while letting secondary triggers
    // (definition.triggers[]) go like any other node.
    const onNodesDelete = useCallback((deleted) => {
        if (!editable || structuralEditsBlocked) return;
        if (!deleted || deleted.length === 0) return;
        const ids = deleted.map(n => n.id).filter(id => !inlineTriggerIds.has(id));
        if (ids.length === 0) return;
        const next = applyDeleteNodes(definition, ids);
        if (next === definition) return; // nothing removable (e.g. primary trigger only)
        onDefinitionChange?.(seedPositions(next));
    }, [definition, editable, structuralEditsBlocked, onDefinitionChange, inlineTriggerIds]);

    // Right-click a node → the delete/duplicate menu. Anchored in VIEWPORT
    // coordinates because the menu portals to document.body, outside the React
    // Flow transform.
    const [ctxMenu, setCtxMenu] = useState(null); // { stepId, x, y }
    const closeCtxMenu = useCallback(() => setCtxMenu(null), []);
    const onNodeContextMenu = useCallback((event, node) => {
        if (!editable || structuralEditsBlocked || !node?.id) return;
        event.preventDefault();
        setCtxMenu({ stepId: node.id, x: event.clientX, y: event.clientY });
    }, [editable, structuralEditsBlocked]);
    // A pan/zoom would leave the menu floating over the wrong node.
    useEffect(() => { if (ctxMenu) closeCtxMenu();   }, [definition]);

    // ── Drag a step in from the ribbon / add-step menu ───────────────────
    //
    // The drop is position-aware: hovering a CONNECTION splices the step into
    // it, hovering a NODE wires it from that node, and empty canvas leaves it
    // loose. `dropTarget` drives the live highlight so the user can see which
    // of the three they're about to get BEFORE releasing.
    const [dropTarget, setDropTarget] = useState(null); // {kind:'edge'|'node'|'pane', id?}

    const onDragOver = useCallback((event) => {
        if (!editable || structuralEditsBlocked) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        const hit = dropTargetFromPoint(event.clientX, event.clientY);
        setDropTarget(prev => (sameDropTarget(prev, hit) ? prev : hit));
    }, [editable, structuralEditsBlocked]);

    // Leaving the canvas entirely clears the highlight; moving between the
    // canvas's own children fires dragleave too, so ignore those.
    const onDragLeave = useCallback((event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setDropTarget(null);
    }, []);

    /**
     * Double-click drills into a flowlet's canvas, and on any other node means
     * "show me everything" — the full Input|Parameters|Output editor, where a
     * single click opens only the settings the step needs.
     * (zoomOnDoubleClick is disabled on the editable canvas below so the
     * gesture doesn't also zoom.)
     */
    const onNodeDoubleClick = useCallback((_evt, node) => {
        if (!node?.id) return;
        const step = (definition?.steps || []).find(s => s.id === node.id);
        if (step?.type === 'call_layer' && step.layerKey && onOpenLayer) { onOpenLayer(step.layerKey); return; }
        // Double-clicking something drawn INSIDE an expanded flowlet means
        // "take me to this flowlet" — the same gesture, one level down.
        if (hasInline && isInlineId(node.id) && onOpenLayer) {
            const owner = sidecar.get(parseInlineId(node.id).prefix);
            if (owner?.layerKey) { onOpenLayer(owner.layerKey); return; }
        }
        onNodeExpand?.(node.id);
    }, [definition, onOpenLayer, onNodeExpand, hasInline, sidecar]);

    const onDrop = useCallback((event) => {
        setDropTarget(null);
        if (!editable || structuralEditsBlocked) return;
        event.preventDefault();
        const payload = readStepPayload(event.dataTransfer);
        if (!payload) return;

        const bounds = wrapperRef.current?.getBoundingClientRect();
        const point = rf.screenToFlowPosition
            ? rf.screenToFlowPosition({ x: event.clientX, y: event.clientY })
            : { x: event.clientX - (bounds?.left || 0), y: event.clientY - (bounds?.top || 0) };

        // Where did it land? Re-hit-test on drop rather than trusting the last
        // dragover — a fast release can outrun the final dragover tick.
        const hit = dropTargetFromPoint(event.clientX, event.clientY);
        // …and in WHICH graph. Dropping inside an expanded flowlet adds the
        // step to that flowlet; wiring is only offered to nodes/edges of the
        // same graph, since a connection can't cross the boundary.
        const scopePrefix = scopeAtPoint(point);
        const inScope = (id) => parseInlineId(id || '').prefix === scopePrefix;
        const isBrancher = (id) => {
            const s = (definition.steps || []).find(x => x.id === id);
            return s?.type === 'condition' || s?.type === 'switch' || s?.type === 'stop_error';
        };
        let wiring = null;
        if (hit.kind === 'edge') {
            const hovered = edges.find(e => e.id === hit.id);
            if (hovered && inScope(hovered.source)) {
                wiring = {
                    sourceId: hovered.source,
                    targetId: hovered.target,
                    label: hovered.data?.defLabel ?? null,
                    caseName: hovered.data?.defCaseName ?? null,
                };
            }
        } else if (hit.kind === 'node' && hit.id !== payload.id && inScope(hit.id)) {
            // Append after the node — the same wiring the node's "+" produces.
            // A brancher routes ONLY on labelled edges, and Stop-and-Error ends
            // the run: wiring from either would draw a connection that never
            // fires (B5/B9), so those drops add the step unconnected and the
            // user drags from the branch port they mean.
            if (!isBrancher(hit.id)) wiring = { sourceId: hit.id, targetId: null, label: null, caseName: null };
        }

        // Preferred path: hand the payload + wiring to the parent, which owns
        // auto-map, usage telemetry and the create-flowlet meta-action.
        if (onDropStep) {
            onDropStep(payload, { position: point, scopePrefix, ...(wiring || {}) });
            return;
        }
        // Fallback (callers that don't pass onDropStep): plain unconnected add.
        // applyAddNode normalizes its base internally (BFSF-318), so a
        // degraded `definition` can't produce a shapeless graph here either.
        onDefinitionChange?.(applyAddNode(definition, payload, point));
        onStepAdded?.(payload, null);
    }, [editable, structuralEditsBlocked, definition, edges, onDropStep, onDefinitionChange, onStepAdded, rf, scopeAtPoint]);

    // Animate edges whose source has finished but whose target is still
    // running — gives the n8n-style "data is flowing" feedback during a
    // live run. Also flash success→success edges briefly so users see
    // each segment of the DAG light up in turn. Computed BEFORE the
    // early-return below so the hook order stays stable.
    // Attach the edge-action callbacks + editable flag so each edge can
    // render its hover "+"/"×" controls. Done in a first pass so it applies
    // whether or not a run is in flight.
    const allowEdgeEdits = editable && !structuralEditsBlocked;
    // `onInspect` backs the run-data chip: it opens the SOURCE step's full
    // view, which is where the rows behind "201 records" actually are.
    const edgesWithControls = useMemo(() => {
        const inspect = onNodeExpand || onNodeClick || null;
        if (!allowEdgeEdits) {
            return inspect ? edges.map(e => ({ ...e, data: { ...(e.data || {}), onInspect: inspect } })) : edges;
        }
        return edges.map((e) => {
            // A line inside an expanded loop is derived from the body's order,
            // not stored: "+" means "put a step here", which IS an order edit,
            // but there is nothing to delete or recolour — the next render
            // would draw the link straight back. Offering the controls anyway
            // would be offering two buttons that quietly do nothing.
            const derived = inLoopBody(e.source);
            return {
                ...e,
                data: {
                    ...(e.data || {}),
                    editable: true,
                    onInsert: onEdgeInsertClick,
                    onDelete: derived ? null : onEdgeDeleteClick,
                    onSetColor: derived ? null : onEdgeSetColor,
                    onInspect: inspect,
                },
            };
        });
    }, [edges, allowEdgeEdits, onEdgeInsertClick, onEdgeDeleteClick, onEdgeSetColor, onNodeExpand, onNodeClick, inLoopBody]);

    // Drop-target accent: the hovered connection thickens in the accent colour
    // ("release here and I'll splice the step in"); the hovered node gets an
    // outline ("release here and I'll wire it after this step").
    // Both gestures share one highlight language: dragging a step in from the
    // ribbon, and dragging a loose node around the canvas.
    const dropHighlightEdgeId = dropTarget?.kind === 'edge' ? dropTarget.id
        : nodeDropTarget?.kind === 'edge' ? nodeDropTarget.edgeId : null;
    const dropHighlightNodeId = dropTarget?.kind === 'node' ? dropTarget.id
        : nodeDropTarget?.kind === 'node' ? nodeDropTarget.nodeId : null;
    const nodesWithDropTarget = useMemo(() => {
        if (!dropHighlightNodeId) return nodes;
        return nodes.map(n => (n.id === dropHighlightNodeId
            ? { ...n, style: { ...(n.style || null), outline: '2px solid var(--accent)', outlineOffset: '4px', borderRadius: '12px' } }
            : n));
    }, [nodes, dropHighlightNodeId]);

    // Identity colours: what each line MEANS — a manual pick (edge.color),
    // or, per the "Colour lines by" mode, its branch case / the source's
    // dominant PII group. Stamped as both stroke and data.chipColor so the
    // line and its case chip agree.
    // PII group → hex, with this routine's own overrides (Lines panel) folded
    // over the fixed defaults.
    const piiGroupColors = useMemo(() => resolvePiiGroupColors(definition), [definition]);

    const identityColoredEdges = useMemo(() => {
        return edgesWithControls.map((e) => {
            const srcRun = runByStep.get(e.source) || null;
            const color = identityColorForEdge(e.data, edgeColorMode, srcRun, piiGroupColors);
            if (!color) return e;
            // In PII mode, spell out WHAT was detected on the chip tooltip —
            // counts only ("Email ×3"), never values; "approximate" when the
            // scan was partial or regex-grade.
            let piiTooltip = null;
            if (edgeColorMode === 'pii' && srcRun?.piiSummary?.categories) {
                const parts = Object.entries(srcRun.piiSummary.categories).map(([k, n]) => `${k} ×${n}`);
                piiTooltip = `Detected: ${parts.join(', ')}${srcRun.piiSummary.degraded ? ' — approximate' : ''}`;
            }
            return {
                ...e,
                style: { ...(e.style || {}), stroke: color, strokeWidth: 2 },
                data: { ...(e.data || {}), identityColor: color, chipColor: color, ...(piiTooltip ? { piiTooltip } : {}) },
            };
        });
    }, [edgesWithControls, edgeColorMode, runByStep, piiGroupColors]);

    // Run-state decoration on top (flow/edgeColoring.js): error red beats
    // everything; in-flight animates; traversal keeps a custom colour (width
    // bump) and paints uncoloured edges the classic green. runByStep (not
    // runSteps) so a pinned-only graph still decorates — its rows can be
    // synthetic pin stubs with no run behind them.
    const decoratedEdges = useMemo(
        () => decorateRunEdges(identityColoredEdges, { runByStep, runInFlight }),
        [identityColoredEdges, runByStep, runInFlight],
    );

    const renderedEdges = useMemo(() => {
        if (!dropHighlightEdgeId) return decoratedEdges;
        return decoratedEdges.map(e => (e.id === dropHighlightEdgeId
            ? { ...e, style: { ...(e.style || null), stroke: 'var(--accent)', strokeWidth: 3 } }
            : e));
    }, [decoratedEdges, dropHighlightEdgeId]);

    if (!definition || !definition.trigger) {
        // The first screen of a new routine. It used to be a small heading and
        // a line of grey prose adrift in a full-height canvas, whose only
        // affordance was the sentence "pick one from the bar above" — no
        // button, nothing to press (BFSF-327). Sized up, and given the CTA the
        // `onRequestOpenPalette` prop was declared for and never wired to.
        //
        // Sits slightly ABOVE centre: an optically centred block reads as
        // centred, a mathematically centred one reads as low.
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-center px-6 py-10">
                <div className="-mt-[6vh] flex flex-col items-center">
                    <div className="mb-5 h-16 w-16 rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-tertiary)]">
                        <Zap size={28} />
                    </div>
                    <div className="text-2xl font-semibold text-[var(--text-primary)] mb-2">Start with a trigger</div>
                    <div className="text-[15px] leading-relaxed text-[var(--text-secondary)] max-w-lg">
                        Every workflow begins with a trigger — it decides when this
                        automation runs.
                    </div>
                    {onRequestOpenPalette && (
                        <button
                            type="button"
                            onClick={onRequestOpenPalette}
                            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-primary-fg,#ffffff)] shadow-sm transition hover:opacity-90"
                        >
                            <Zap size={15} /> Choose a trigger
                        </button>
                    )}
                    <div className="mt-3 text-xs text-[var(--text-tertiary)]">
                        …or pick one from the bar above, or drag it onto the canvas.
                    </div>
                </div>
            </div>
        );
    }

    // Which flowlet the right-clicked node calls, if any — drives the menu's
    // Expand/Collapse entry.
    const ctxMenuLayerKey = ctxMenu
        ? ((definition?.steps || []).find(s => s.id === ctxMenu.stepId && s.type === 'call_layer')?.layerKey || null)
        : null;

    const interactive = !readOnly;
    const allowDrag = editable && !structuralEditsBlocked;
    const allowConnect = editable && !structuralEditsBlocked;
    // Click-to-inspect is decoupled from readOnly: a caller that passes an
    // onNodeClick handler (e.g. RunExecutionView's click-to-inspect-a-run-step
    // panel) wants node clicks even though the canvas is read-only for editing.
    // Static thumbnails (Quick/Expert) pass no handler, so they stay inert.
    const clickable = typeof onNodeClick === 'function';

    return (
        <NodeRuntimeContext.Provider value={runtimeContextValue}>
        <div
            ref={wrapperRef}
            className="w-full h-full relative"
            style={{ minHeight: 320 }}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
        >
            <ReactFlow
                nodes={nodesWithDropTarget}
                edges={renderedEdges}
                nodeTypes={NODE_TYPES}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
                fitView
                fitViewOptions={{
                    // Was 0.18 — an 18% margin on every side of a canvas that
                    // is usually far wider than it is tall. On a long
                    // left-to-right flow that margin is spent where there is
                    // nothing to show, and it comes straight out of the scale,
                    // which is the one thing making the cards hard to read.
                    // 0.08 keeps the graph off the edges without paying for
                    // empty space, and offsets the wider ranksep in layout.js.
                    padding: 0.08,
                    duration: 0,
                }}
                zoomOnScroll={interactive}
                zoomOnPinch={interactive}
                // Editable canvas reserves double-click for flowlet drill-in;
                // zooming on the same gesture would fight the navigation.
                zoomOnDoubleClick={interactive && !editable}
                proOptions={{ hideAttribution: true }}
                // Multi-select, on the gesture every node editor uses: drag on
                // empty canvas draws a selection box. Panning moves to the
                // middle mouse button and to Space+drag (React Flow's default
                // pan-activation key) — the same trade Figma, Miro and n8n
                // make, because in a canvas you build on you reach for
                // "select these" far more often than "shift the viewport",
                // and the wheel still zooms.
                //
                // Ctrl/Cmd+click adds or removes a single node. Dragging any
                // selected node moves the whole selection and Delete removes
                // all of it — both fall out of React Flow once a selection
                // exists, since onNodesDelete and commitNodePositions already
                // take arrays.
                panOnDrag={interactive ? [1] : false}
                selectionOnDrag={interactive}
                selectionKeyCode="Shift"
                multiSelectionKeyCode={['Meta', 'Control']}
                selectNodesOnDrag={false}
                onSelectionChange={editable ? onSelectionChange : undefined}
                onNodeClick={clickable ? onNodeClickWithSelection : undefined}
                onNodeDoubleClick={interactive ? onNodeDoubleClick : undefined}
                nodesDraggable={allowDrag}
                nodesConnectable={allowConnect}
                elementsSelectable={interactive || clickable}
                onNodeDrag={editable ? onNodeDrag : undefined}
                onNodeDragStop={editable ? onNodeDragStop : undefined}
                onNodesChange={editable ? onNodesChange : undefined}
                onEdgesChange={editable ? onEdgesChange : undefined}
                onConnect={editable ? onConnect : undefined}
                onConnectEnd={editable ? onConnectEnd : undefined}
                onEdgesDelete={editable ? onEdgesDelete : undefined}
                onNodesDelete={editable ? onNodesDelete : undefined}
                onNodeContextMenu={editable ? onNodeContextMenu : undefined}
                deleteKeyCode={editable ? ['Backspace', 'Delete'] : null}
            >
                <Background gap={16} size={1} color="var(--border-default)" />
                <Controls showInteractive={false} />
                {/* Where the run is. Named, counted, and one click from being
                    centred — a pulsing border tells you nothing when the node
                    doing the pulsing is outside the viewport. */}
                {runFocus && (
                    <Panel position="top-center">
                        <div className="flex items-center gap-2 rounded-full border border-[var(--accent)]/40 bg-[var(--bg-primary)] shadow-lg px-3 py-1.5 text-xs">
                            <span className="relative flex h-2 w-2 shrink-0">
                                {runFocus.state === 'running' && (
                                    <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-60 animate-ping" />
                                )}
                                <span className={`relative inline-flex h-2 w-2 rounded-full ${runFocus.state === 'error' ? 'bg-red-500' : 'bg-[var(--accent)]'}`} />
                            </span>
                            <span className="font-medium text-[var(--text-primary)]">
                                {runFocus.state === 'error' ? 'Run failed at' : 'Running'}
                            </span>
                            {runFocus.label && (
                                <span className="max-w-[16rem] truncate text-[var(--text-secondary)]">{runFocus.label}</span>
                            )}
                            <span className="text-[var(--text-tertiary)] tabular-nums">
                                {runFocus.done}/{runFocus.total}
                            </span>
                            {runFocus.stepId && (
                                <button
                                    type="button"
                                    onClick={focusRunStep}
                                    title="Centre the canvas on this step"
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[var(--accent)] hover:bg-[var(--accent)]/10 transition"
                                >
                                    <Crosshair size={12} /> Show
                                </button>
                            )}
                        </div>
                    </Panel>
                )}

                {/* Selection bar. A multi-selection is otherwise invisible
                    apart from the rings, and nothing tells you the gestures
                    exist — so it names the count, offers the destructive
                    action explicitly, and teaches the shortcut. */}
                {/* Panning moved to Space/middle-drag so plain drag can select;
                    say so once, or the first drag reads as a broken canvas. */}
                {interactive && selectedIds.length === 0 && (
                    <Panel position="bottom-center">
                        <div className="rounded-full bg-[var(--bg-primary)]/80 border border-[var(--border-default)] px-2.5 py-1 text-[10px] text-[var(--text-tertiary)] pointer-events-none">
                            Drag to select · Space or middle-drag to pan
                        </div>
                    </Panel>
                )}
                {editable && selectedIds.length > 0 && (
                    // Bottom-centre: the run banner owns the top, and these two
                    // would otherwise sit on top of each other.
                    <Panel position="bottom-center">
                        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-lg px-2.5 py-1.5 text-xs">
                            <span className="font-medium text-[var(--text-primary)]">
                                {selectedIds.length} step{selectedIds.length === 1 ? '' : 's'} selected
                            </span>
                            <span className="text-[10px] text-[var(--text-tertiary)]">
                                {selectedIds.length === 1 ? 'ctrl-click to add more' : 'drag to move them together'}
                            </span>
                            <button
                                type="button"
                                onClick={deleteSelection}
                                disabled={structuralEditsBlocked}
                                title="Delete the selected steps (their neighbours reconnect)"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-red-600 hover:bg-red-500/10 disabled:opacity-40 transition"
                            >
                                <Trash2 size={12} /> Delete
                            </button>
                            <button
                                type="button"
                                onClick={clearSelection}
                                title="Clear the selection"
                                aria-label="Clear selection"
                                className="p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition"
                            >
                                <X size={13} />
                            </button>
                        </div>
                    </Panel>
                )}
                {/* "Colour lines by" + the rules panel behind it — mode is a
                    per-user lens; the colour RULES (pin a case colour, remap a
                    PII group) edit the definition. Shown wherever connections
                    are; rule editing only on an editable canvas. */}
                {(definition.edges || []).length > 0 && (
                    <Panel position="top-right">
                        <LineColorPanel
                            mode={edgeColorMode}
                            onModeChange={setEdgeColorMode}
                            definition={definition}
                            editable={allowEdgeEdits}
                            onDefinitionChange={onDefinitionChange}
                            hasPiiData={hasPiiData}
                        />
                    </Panel>
                )}
                <MiniMap
                    pannable
                    zoomable
                    nodeColor={(n) => {
                        const status = n.data?.runStep?.status;
                        if (status === 'success' || status === 'pinned') return '#10b981';
                        if (status === 'error')   return '#ef4444';
                        if (status === 'running') return 'var(--accent)';
                        return 'var(--bg-tertiary, rgba(0,0,0,0.1))';
                    }}
                    maskColor="rgba(0,0,0,0.04)"
                />
            </ReactFlow>
            {ctxMenu && (
                <NodeContextMenu
                    x={ctxMenu.x}
                    y={ctxMenu.y}
                    canDelete={canDeleteNode(definition, ctxMenu.stepId)}
                    canDuplicate={canDuplicateNode(definition, ctxMenu.stepId)}
                    canDetach={canDetachNode(definition, ctxMenu.stepId)}
                    onDuplicate={() => onDuplicateNode(ctxMenu.stepId)}
                    onDetach={() => onDetachNode(ctxMenu.stepId)}
                    onDelete={() => onDeleteNode(ctxMenu.stepId)}
                    onExecute={onExecuteStep && !runInFlight ? () => onExecuteStep(ctxMenu.stepId) : null}
                    onToggleInline={ctxMenuLayerKey && onToggleInline ? () => onToggleInline(ctxMenu.stepId, ctxMenuLayerKey) : null}
                    inlineExpanded={inlineExpandedIds.has(ctxMenu.stepId)}
                    onClose={closeCtxMenu}
                />
            )}
            {/* "Let go and I'll wire it up" — follows the cursor while a loose
                node is dragged next to a connection or another node, so the
                highlight isn't left to guesswork. */}
            {nodeDropTarget && dropHintPos && (
                <div
                    className="absolute z-30 pointer-events-none px-2 py-1 rounded-md text-[11px] font-medium bg-[var(--accent)] text-white shadow-lg whitespace-nowrap"
                    style={{ left: dropHintPos.x + 16, top: dropHintPos.y + 16 }}
                >
                    {nodeDropTarget.kind === 'edge' ? 'Release to insert here' : 'Release to connect'}
                </div>
            )}
            {editable && structuralEditsBlocked && (
                <div className="absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800">
                    AI is editing — structural edits paused
                </div>
            )}
        </div>
        </NodeRuntimeContext.Provider>
    );
});

function newStepId(kind) {
    const prefix = kind === 'integration_action' ? 'act'
        : kind === 'ai_step' ? 'ai'
        : kind === 'condition' ? 'cond'
        : kind === 'loop' ? 'loop'
        : kind === 'notification' ? 'notif'
        : kind === 'code' ? 'code'
        : kind === 'trigger' ? 'trig'
        : 'step';
    const rand = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().split('-')[0]
        : Math.random().toString(36).slice(2, 10);
    return `${prefix}_${rand}`;
}

/**
 * Translate a palette payload into a fully-scaffolded step / trigger.
 * Exported so the slide-in NodePalette can use it for click-to-add
 * without re-implementing the per-kind defaults.
 *
 * Triggers are special: they replace `definition.trigger` rather than
 * appending to `definition.steps`.
 */
export function buildStepFromPayload(payload, position) {
    if (!payload || !payload.kind) return null;
    // 'create_layer' is a palette meta-action handled by BuildTab's
    // handleAddNode (create flowlet + insert call_layer + drill in) — it is
    // not a step. Dropping it on the canvas is a no-op.
    if (payload.kind === 'create_layer') return null;
    if (payload.kind === 'trigger') {
        // Shape mirrors server-side emptyDefinition() in
        // server/automation/builderTools.js — the validator requires
        // `type: 'trigger'` plus an `output` map (the runtime payload
        // for manual/schedule triggers is empty until run-time).
        //
        // `asSecondaryTrigger` (set by the ribbon's "+ add another trigger"
        // affordance, webhook/app_event only) appends to
        // `definition.triggers[]` instead of replacing the one primary
        // `definition.trigger` — see automation/validate.js's `triggers[]`
        // rules, which reject schedule/manual there.
        return {
            [payload.asSecondaryTrigger ? '__addTrigger' : '__replaceTrigger']: true,
            id: newStepId('trigger'),
            type: 'trigger',
            kind: payload.triggerKind || 'manual',
            label: payload.label || defaultTriggerLabel(payload.triggerKind || 'manual'),
            output: {},
            // A form trigger drops in already WORKING — title, three questions,
            // a thank-you message and a preset. Refining is optional; an empty
            // form would be a dead end that also blocks activation.
            ...(payload.triggerKind === 'form' ? { form: defaultFormDeclaration() } : null),
            position: position || { x: 0, y: 0 },
        };
    }
    const id = newStepId(payload.kind);
    // Defaults are chosen to pass server-side `validateDefinition`:
    //   - required string fields (prompt, expr, overRef, code, title)
    //     are non-empty so the validator's *_missing checks pass
    //   - `condition.expr` defaults to `true` so the parser accepts it
    // These are obviously placeholder values the user will replace via
    // the inspector — they're not meant as final content.
    const baseStep = { id, type: payload.kind, position: position || { x: 0, y: 0 } };
    if (payload.kind === 'integration_action') {
        baseStep.tool = payload.tool || '';
        baseStep.label = payload.label || payload.tool || 'Integration';
        baseStep.inputs = {};
        // appId lets the inspector list sibling operations of the same app
        // (the single-node operation switcher); sideEffect (from the catalog,
        // authoritative over the node's name heuristic) drives the ⚡ badge
        // and dry-run skipping. Both are optional for older drag payloads.
        if (payload.appId) baseStep.appId = payload.appId;
        if (payload.sideEffect != null) baseStep.sideEffect = payload.sideEffect;
    } else if (payload.kind === 'ai_step') {
        baseStep.prompt = 'Describe what the AI should do here.';
        baseStep.modelTier = 'auto';
        baseStep.allowTools = false;
        baseStep.inputs = {};
        baseStep.label = payload.label || 'AI step';
    } else if (payload.kind === 'condition') {
        baseStep.expr = 'true';
        baseStep.label = payload.label || 'Condition';
    } else if (payload.kind === 'tokenize') {
        // Same as the guard: no honest default for "what should I hide", and
        // autoMapStep binds it to the nearest upstream text on arrival.
        baseStep.sourceRef = payload.sourceRef || '';
        baseStep.label = payload.label || 'Hide personal data';
    } else if (payload.kind === 'untokenize') {
        baseStep.sourceRef = payload.sourceRef || '';
        baseStep.label = payload.label || 'Show real values again';
    } else if (payload.kind === 'guard') {
        // sourceRef is REQUIRED by the validator, and there is no honest
        // default for "what should I scan" — the panel asks, and the nearest
        // upstream value is offered as a one-click pick. A placeholder path
        // here would look configured while scanning nothing.
        baseStep.sourceRef = payload.sourceRef || '';
        baseStep.label = payload.label || 'Check for personal data';
    } else if (payload.kind === 'loop') {
        baseStep.itemVar = 'item';
        // EMPTY, like the collection ops below (C20 / A18): the old
        // 'trigger.output.items' literal looked configured but resolved to
        // nothing on most triggers, so the loop ran zero iterations and
        // reported success. Blank is safe to autosave — `loop.overRef_missing`
        // is in the server's COMPLETENESS_CODES, so it downgrades to an amber
        // activate-blocking warning — and mapping/autoMapInputs.js binds it
        // from the nearest upstream array the moment the node is connected
        // (isScaffoldOverRef already treated both '' and the old literal as
        // scaffold, so that heal path was written for this and never reachable).
        baseStep.overRef = '';
        baseStep.maxIterations = 100;
        baseStep.body = [];
        baseStep.label = payload.label || 'Loop';
    } else if (payload.kind === 'notification') {
        baseStep.title = 'Notification';
        baseStep.body = '';
        baseStep.channels = ['notification'];
        baseStep.label = payload.label || 'Notification';
    } else if (payload.kind === 'http_request') {
        baseStep.url = '';
        baseStep.method = 'GET';
        baseStep.headers = {};
        baseStep.body = '';
        baseStep.timeoutMs = 10_000;
        // Blocks localhost/private-network/cloud-metadata targets by
        // default — an OPTIONAL per-step toggle (not mandatory), see
        // server/core/automationRunner/engine.js's execHttpRequest.
        baseStep.blockPrivateTargets = true;
        baseStep.label = payload.label || 'HTTP Request';
    } else if (payload.kind === 'form_page') {
        // Dropped ready to run, like the trigger: a real question (or a real
        // closing message) so the node is publishable before it is edited.
        // `theme: null` inside the declaration means "match the first page".
        const ending = payload.mode === 'ending';
        baseStep.mode = ending ? 'ending' : 'input';
        baseStep.form = ending ? defaultFormEndingDeclaration() : defaultFormPageDeclaration();
        if (!ending) baseStep.waitSeconds = 3600;
        baseStep.label = payload.label || (ending ? 'Show a summary' : 'Ask for more info');
    } else if (payload.kind === 'code') {
        baseStep.code = '// async function main(inputs, ctx) {\n//   return inputs;\n// }\nreturn inputs;';
        baseStep.language = 'javascript';
        baseStep.label = payload.label || 'Code';
    } else if (payload.kind === 'set') {
        baseStep.fields = {};
        baseStep.label = payload.label || 'Edit data';
    } else if (payload.kind === 'parse_json') {
        // Empty fields is only a validation WARNING (parse_json.no_fields) —
        // deliberate, so a freshly-dropped node survives the autosave
        // round-trip before the user adds rows.
        baseStep.sourceRef = '';
        baseStep.mode = 'paths';
        baseStep.fields = [];
        baseStep.label = payload.label || 'Parse JSON';
    } else if (payload.kind === 'datetime') {
        baseStep.op = 'now';
        baseStep.label = payload.label || 'Date & Time';
    } else if (payload.kind === 'wait') {
        baseStep.seconds = 5;
        baseStep.label = payload.label || 'Wait';
    } else if (payload.kind === 'stop_error') {
        baseStep.message = 'Halted';
        baseStep.label = payload.label || 'Stop and error';
    } else if (payload.kind === 'switch') {
        baseStep.expr = 'trigger.output.value';
        baseStep.cases = [{ name: 'case1', value: '' }];
        baseStep.defaultBranch = null;
        baseStep.label = payload.label || 'Switch';
    // Collection ops seed an EMPTY arrayRef (C20): auto-map fills it from the
    // nearest upstream array on connect, and an unfilled one shows a visible
    // amber `arrayRef_missing` chip (draft warning, blocks activation) instead
    // of the old 'trigger.output.items' literal that silently resolved to
    // nothing and ran the op as a green no-op on most triggers.
    //
    // Their `field` seeds are empty for the SAME reason (A18): 'id' and
    // 'amount' were placeholder guesses that looked configured, and a field
    // that is on no item makes Aggregate emit a list of undefineds and
    // Summarize total nothing and call it 0. There is no honest default for
    // "which field" — the panel asks, and offers the real fields of the source
    // list as one-click picks. `aggregate.field_missing` /
    // `summarize.field_missing` are both in COMPLETENESS_CODES, so blank
    // autosaves fine and warns amber until it is answered.
    } else if (payload.kind === 'filter') {
        baseStep.arrayRef = '';
        baseStep.expr = 'true';
        baseStep.label = payload.label || ROUTE_STEP_NAME;
    } else if (payload.kind === 'limit') {
        baseStep.arrayRef = '';
        baseStep.count = 10;
        baseStep.mode = 'first';
        baseStep.label = payload.label || 'Limit';
    } else if (payload.kind === 'dedupe') {
        baseStep.arrayRef = '';
        baseStep.label = payload.label || 'Remove duplicates';
    } else if (payload.kind === 'aggregate') {
        baseStep.arrayRef = '';
        baseStep.field = '';
        baseStep.label = payload.label || 'Aggregate';
    } else if (payload.kind === 'summarize') {
        baseStep.arrayRef = '';
        baseStep.field = '';
        baseStep.op = 'sum';
        baseStep.label = payload.label || 'Summarize';
    } else if (payload.kind === 'call_layer') {
        // Inline flowlets: the step only carries the flowlet key — input/output
        // contracts derive live from definition.layers[layerKey] via
        // getLayerContract (no denormalised copies, no version pinning).
        baseStep.layerKey = payload.layerKey || '';
        baseStep.label = payload.label || 'Flowlet';
        baseStep.inputs = {};
    } else if (payload.kind === 'call_block') {
        // Reusable Steps: the step carries the external Step's id; its input /
        // output contract derives live from the Steps catalog (no version pin).
        baseStep.blockId = payload.blockId || '';
        baseStep.label = payload.label || 'Step';
        // Seed the node's symbol from the source Step so it reads the same on
        // the canvas; the user can override it in the inspector.
        if (payload.icon) baseStep.icon = payload.icon;
        baseStep.inputs = {};
    } else if (payload.kind === 'layer_output') {
        baseStep.fields = {};
        baseStep.label = payload.label || 'Return';
    }
    return baseStep;
}

/**
 * Pure transform: given the current definition, a palette payload, a
 * drop position, and (optionally) a source node id to wire from, return
 * the next definition. Used by both the drag-drop path and the slide-in
 * panel's click-to-add path so the result is identical either way.
 */
export function applyAddNode(definition, payload, position, sourceId = null, sourceHandle = null) {
    const built = buildStepFromPayload(payload, position);
    if (!built) return definition;
    // Normalize FIRST so the trigger branches below can't inherit a base that
    // is missing `steps`/`edges`. They are key-preserving spreads, and
    // seedPositions early-returns once every node has a position — so without
    // this a `{}` base produced a trigger-only definition the server rejects
    // with "'steps' must be an array" (BFSF-318).
    const base = normalizeDefinitionShape(definition) || emptyGraph();

    if (built.__replaceTrigger) {
        const { __replaceTrigger, ...nextTrigger } = built;
        // Preserve existing trigger id so saved-state edges still resolve.
        if (base.trigger?.id) nextTrigger.id = base.trigger.id;
        return seedPositions({ ...base, trigger: nextTrigger });
    }

    if (built.__addTrigger) {
        // triggers[] is root-only: a flowlet/Step graph (layer_input trigger)
        // cannot carry secondary triggers — the validator rejects the whole
        // document (`triggers.not_supported_here`). The ribbon hides the
        // cluster in those scopes (C8); this guards programmatic paths.
        if (base.trigger?.kind === 'layer_input') return definition;
        const { __addTrigger, ...newTrigger } = built;
        return seedPositions({ ...base, triggers: [...(base.triggers || []), newTrigger] });
    }

    const nextSteps = [...base.steps, built];
    const nextEdges = sourceId
        ? [...base.edges, { from: sourceId, to: built.id, ...branchFromHandle(sourceHandle) }]
        : base.edges;
    return seedPositions({ ...base, steps: nextSteps, edges: nextEdges });
}

// branchFromHandle moved to flow/branchEdges.js (the shared edge-identity
// module) — re-exported here because LoopBodyEditor and older tests import it
// from DiagramPane.
export { branchFromHandle } from './flow/branchEdges';

/**
 * Would adding edge `from → to` create a cycle? Walks the existing
 * graph: if `from` is reachable from `to`, the new edge closes a loop.
 */
function createsCycle(def, from, to) {
    const adj = new Map();
    for (const e of (def.edges || [])) {
        if (!adj.has(e.from)) adj.set(e.from, []);
        adj.get(e.from).push(e.to);
    }
    const stack = [to];
    const seen = new Set();
    while (stack.length) {
        const cur = stack.pop();
        if (cur === from) return true;
        if (seen.has(cur)) continue;
        seen.add(cur);
        for (const next of (adj.get(cur) || [])) stack.push(next);
    }
    return false;
}

export { createsCycle };
