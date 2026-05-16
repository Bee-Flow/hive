import React, { forwardRef, useMemo, useCallback, useRef, useState, useEffect, useImperativeHandle } from 'react';
import {
    ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
    useReactFlow, MarkerType, applyNodeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus } from 'lucide-react';

import { buildLayout, seedPositions } from './flow/layout';
import { edgeTypes } from './flow/edges';
import { buildIssuesByStep } from './flow/matchValidationToStep';
import { NodeRuntimeContext } from './flow/NodeRuntimeContext';

import TriggerNode from './flow/nodes/TriggerNode';
import IntegrationActionNode from './flow/nodes/IntegrationActionNode';
import AiStepNode from './flow/nodes/AiStepNode';
import ConditionNode from './flow/nodes/ConditionNode';
import LoopNode from './flow/nodes/LoopNode';
import CodeNode from './flow/nodes/CodeNode';
import NotificationNode from './flow/nodes/NotificationNode';
import SetNode from './flow/nodes/SetNode';
import DateTimeNode from './flow/nodes/DateTimeNode';
import WaitNode from './flow/nodes/WaitNode';
import StopErrorNode from './flow/nodes/StopErrorNode';
import SwitchNode from './flow/nodes/SwitchNode';
import FilterNode from './flow/nodes/FilterNode';
import LimitNode from './flow/nodes/LimitNode';
import DedupeNode from './flow/nodes/DedupeNode';
import AggregateNode from './flow/nodes/AggregateNode';
import SummarizeNode from './flow/nodes/SummarizeNode';

const NODE_TYPES = {
    trigger:            TriggerNode,
    integration_action: IntegrationActionNode,
    ai_step:            AiStepNode,
    condition:          ConditionNode,
    loop:               LoopNode,
    code:               CodeNode,
    notification:       NotificationNode,
    // n8n-style utility nodes
    set:                SetNode,
    datetime:           DateTimeNode,
    wait:               WaitNode,
    stop_error:         StopErrorNode,
    switch:             SwitchNode,
    filter:             FilterNode,
    limit:              LimitNode,
    dedupe:             DedupeNode,
    aggregate:          AggregateNode,
    summarize:          SummarizeNode,
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
 *   - readOnly={true}:  pan/zoom disabled, no clicks bubble (Quick & Expert).
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
    onDefinitionChange,
    validation = null,
    readOnly = false,
    editable = false,
    structuralEditsBlocked = false, // true while SSE stream is patching the def
    onRequestAddNode,   // ({ sourceId, position }) — called when user drags an edge end into empty pane
    onRequestOpenPalette, // () — called by the empty-state CTA on a fresh draft
    onRequestAddAfter,  // (nodeId) — called when user clicks the "+" hover button on a node
    onExecuteStep,      // (stepId) — n8n-style per-node ▶ button
    executingStepId = null,
    runInFlight = false,
}, ref) {
    return (
        <ReactFlowProvider>
            <DiagramPaneInner
                ref={ref}
                definition={definition}
                runSteps={runSteps}
                onNodeClick={onNodeClick}
                onDefinitionChange={onDefinitionChange}
                validation={validation}
                readOnly={readOnly}
                editable={editable}
                structuralEditsBlocked={structuralEditsBlocked}
                onRequestAddNode={onRequestAddNode}
                onRequestOpenPalette={onRequestOpenPalette}
                onRequestAddAfter={onRequestAddAfter}
                onExecuteStep={onExecuteStep}
                executingStepId={executingStepId}
                runInFlight={runInFlight}
            />
        </ReactFlowProvider>
    );
});

export default DiagramPane;

const DiagramPaneInner = forwardRef(function DiagramPaneInner({
    definition, runSteps, onNodeClick, onDefinitionChange,
    validation, readOnly, editable, structuralEditsBlocked,
    onRequestAddNode, onRequestOpenPalette, onRequestAddAfter,
    onExecuteStep, executingStepId, runInFlight,
}, ref) {
    const rf = useReactFlow();
    const wrapperRef = useRef(null);

    const runByStep = useMemo(() => {
        const m = new Map();
        for (const r of (runSteps || [])) if (r?.stepId) m.set(r.stepId, r);
        return m;
    }, [runSteps]);

    const issuesByStep = useMemo(
        () => buildIssuesByStep(validation, definition),
        [validation, definition],
    );

    // Derive runtime context: which steps are pinned / disabled / mid-run.
    // The 17 per-type node components read this via NodeRuntimeContext so
    // their call-sites stay unchanged.
    const runtimeContextValue = useMemo(() => {
        const pinnedById = new Set();
        const disabledById = new Set();
        const allSteps = [definition?.trigger, ...(definition?.steps || [])].filter(Boolean);
        for (const s of allSteps) {
            if (s.pinnedOutput !== undefined && s.pinnedOutput !== null) pinnedById.add(s.id);
            if (s.disabled) disabledById.add(s.id);
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
            onExecuteStep: editable ? onExecuteStep : null,
            executingStepId,
            runInFlight,
            runIndexById,
            runTotal,
        };
    }, [definition, runSteps, onExecuteStep, executingStepId, runInFlight, editable]);

    // Quick-add "+" callback only fires in editable mode — there's no
    // point rendering the button on a read-only canvas where structural
    // edits are blocked.
    const onAddAfterForLayout = (editable && !structuralEditsBlocked) ? onRequestAddAfter : null;

    const { nodes: computedNodes, edges } = useMemo(
        () => buildLayout(definition, { runByStep, issuesByStep, onAddAfter: onAddAfterForLayout }),
        [definition, runByStep, issuesByStep, onAddAfterForLayout],
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
    useEffect(() => {
        if (isDraggingRef.current) {
            pendingComputedRef.current = computedNodes;
            return;
        }
        pendingComputedRef.current = null;
        setNodes(computedNodes);
    }, [computedNodes]);

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
    }), [rf]);

    // ── Edit handlers ───────────────────────────────────────────────────

    const commitNodePositions = useCallback((changes) => {
        // Pick out position changes that finished (drag-stop emits one with
        // `dragging: false`). Live-drag changes don't need to round-trip
        // through the definition — ReactFlow handles the in-flight ghost
        // itself, and writing back on every pixel move would thrash the
        // SSE/debounced save.
        const finished = changes.filter(c => c.type === 'position' && c.dragging === false && c.position);
        if (finished.length === 0) return;
        const byId = new Map(finished.map(c => [c.id, c.position]));
        const apply = (s) => byId.has(s.id) ? { ...s, position: byId.get(s.id) } : s;
        const next = seedPositions({
            ...definition,
            trigger: apply(definition.trigger),
            steps: (definition.steps || []).map(apply),
        });
        onDefinitionChange?.(next);
    }, [definition, onDefinitionChange]);

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
                        setNodes(pending);
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

    const onConnect = useCallback(({ source, target }) => {
        if (!editable || structuralEditsBlocked) return;
        if (!source || !target || source === target) return;
        // Cycle guard: rebuild adjacency including the proposed edge and
        // check whether `source` is reachable from `target`. If so, the new
        // edge would close a loop — reject.
        const existing = definition.edges || [];
        if (existing.some(e => e.from === source && e.to === target)) return; // dedupe
        if (createsCycle(definition, source, target)) return;
        const nextEdges = [...existing, { from: source, to: target }];
        onDefinitionChange?.(seedPositions({ ...definition, edges: nextEdges }));
    }, [definition, editable, structuralEditsBlocked, onDefinitionChange]);

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
        const clientX = event.clientX ?? event.changedTouches?.[0]?.clientX;
        const clientY = event.clientY ?? event.changedTouches?.[0]?.clientY;
        if (clientX == null || clientY == null) return;
        const position = rf.screenToFlowPosition
            ? rf.screenToFlowPosition({ x: clientX, y: clientY })
            : { x: clientX, y: clientY };
        onRequestAddNode({ sourceId, position });
    }, [editable, structuralEditsBlocked, onRequestAddNode, rf]);

    const onEdgesDelete = useCallback((deleted) => {
        if (!editable || structuralEditsBlocked) return;
        if (!deleted || deleted.length === 0) return;
        const remove = new Set(deleted.map(e => `${e.source}->${e.target}`));
        const nextEdges = (definition.edges || []).filter(e => !remove.has(`${e.from}->${e.to}`));
        onDefinitionChange?.(seedPositions({ ...definition, edges: nextEdges }));
    }, [definition, editable, structuralEditsBlocked, onDefinitionChange]);

    const onNodesDelete = useCallback((deleted) => {
        if (!editable || structuralEditsBlocked) return;
        if (!deleted || deleted.length === 0) return;
        const remove = new Set(deleted.map(n => n.id));
        // Block trigger removal — the runtime requires exactly one trigger.
        if (remove.has(definition.trigger?.id)) remove.delete(definition.trigger.id);
        if (remove.size === 0) return;
        const nextSteps = (definition.steps || []).filter(s => !remove.has(s.id));
        const nextEdges = (definition.edges || []).filter(e => !remove.has(e.from) && !remove.has(e.to));
        onDefinitionChange?.(seedPositions({ ...definition, steps: nextSteps, edges: nextEdges }));
    }, [definition, editable, structuralEditsBlocked, onDefinitionChange]);

    const onDragOver = useCallback((event) => {
        if (!editable || structuralEditsBlocked) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, [editable, structuralEditsBlocked]);

    const onDrop = useCallback((event) => {
        if (!editable || structuralEditsBlocked) return;
        event.preventDefault();
        const raw = event.dataTransfer.getData('application/x-automation-step');
        if (!raw) return;
        let payload;
        try { payload = JSON.parse(raw); } catch (_) { return; }
        if (!payload || !payload.kind) return;

        const bounds = wrapperRef.current?.getBoundingClientRect();
        const point = rf.screenToFlowPosition
            ? rf.screenToFlowPosition({ x: event.clientX, y: event.clientY })
            : { x: event.clientX - (bounds?.left || 0), y: event.clientY - (bounds?.top || 0) };

        onDefinitionChange?.(applyAddNode(definition, payload, point));
    }, [editable, structuralEditsBlocked, definition, onDefinitionChange, rf]);

    // Animate edges whose source has finished but whose target is still
    // running — gives the n8n-style "data is flowing" feedback during a
    // live run. Also flash success→success edges briefly so users see
    // each segment of the DAG light up in turn. Computed BEFORE the
    // early-return below so the hook order stays stable.
    const decoratedEdges = useMemo(() => {
        if (!runInFlight && (runSteps || []).length === 0) return edges;
        return edges.map((e) => {
            const src = runByStep.get(e.source);
            const tgt = runByStep.get(e.target);
            const srcDone = src?.status === 'success' || src?.status === 'pinned';
            const tgtDone = tgt?.status === 'success' || tgt?.status === 'pinned';
            const isInFlight = srcDone && (tgt?.status === 'running' || !tgt);
            const wasTraversed = srcDone && tgtDone;
            if (isInFlight) {
                return { ...e, animated: true, style: { ...(e.style || {}), stroke: 'var(--accent)' } };
            }
            if (wasTraversed) {
                return { ...e, animated: false, style: { ...(e.style || {}), stroke: '#10b981' } };
            }
            if (tgt?.status === 'error') {
                return { ...e, animated: false, style: { ...(e.style || {}), stroke: '#ef4444' } };
            }
            return e;
        });
    }, [edges, runByStep, runInFlight, runSteps]);

    if (!definition || !definition.trigger) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-center px-6">
                <div className="text-sm font-medium text-[var(--text-primary)] mb-1">Start with a trigger</div>
                <div className="text-xs text-[var(--text-tertiary)] mb-4 max-w-xs">
                    Every workflow begins with a trigger — pick how this automation should be kicked off.
                </div>
                <button
                    type="button"
                    onClick={() => onRequestOpenPalette?.()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--accent)] text-white hover:opacity-90"
                >
                    <Plus size={14} /> Choose a trigger
                </button>
            </div>
        );
    }

    const interactive = !readOnly;
    const allowDrag = editable && !structuralEditsBlocked;
    const allowConnect = editable && !structuralEditsBlocked;

    return (
        <NodeRuntimeContext.Provider value={runtimeContextValue}>
        <div
            ref={wrapperRef}
            className="w-full h-full relative"
            style={{ minHeight: 320 }}
            onDrop={onDrop}
            onDragOver={onDragOver}
        >
            <ReactFlow
                nodes={nodes}
                edges={decoratedEdges}
                nodeTypes={NODE_TYPES}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
                fitView
                fitViewOptions={{ padding: 0.18, duration: 0 }}
                panOnDrag={interactive}
                zoomOnScroll={interactive}
                zoomOnPinch={interactive}
                zoomOnDoubleClick={interactive}
                proOptions={{ hideAttribution: true }}
                onNodeClick={interactive ? ((_evt, node) => onNodeClick?.(node.id)) : undefined}
                nodesDraggable={allowDrag}
                nodesConnectable={allowConnect}
                elementsSelectable={interactive}
                onNodesChange={editable ? onNodesChange : undefined}
                onEdgesChange={editable ? onEdgesChange : undefined}
                onConnect={editable ? onConnect : undefined}
                onConnectEnd={editable ? onConnectEnd : undefined}
                onEdgesDelete={editable ? onEdgesDelete : undefined}
                onNodesDelete={editable ? onNodesDelete : undefined}
                deleteKeyCode={editable ? ['Backspace', 'Delete'] : null}
            >
                <Background gap={16} size={1} color="var(--border-default)" />
                <Controls showInteractive={false} />
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
    if (payload.kind === 'trigger') {
        // Shape mirrors server-side emptyDefinition() in
        // server/automation/builderTools.js — the validator requires
        // `type: 'trigger'` plus an `output` map (the runtime payload
        // for manual/schedule triggers is empty until run-time).
        return {
            __replaceTrigger: true,
            id: newStepId('trigger'),
            type: 'trigger',
            kind: payload.triggerKind || 'manual',
            label: payload.label || 'Trigger',
            output: {},
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
    } else if (payload.kind === 'ai_step') {
        baseStep.prompt = 'Describe what the AI should do here.';
        baseStep.modelTier = 'auto';
        baseStep.allowTools = false;
        baseStep.inputs = {};
        baseStep.label = payload.label || 'AI step';
    } else if (payload.kind === 'condition') {
        baseStep.expr = 'true';
        baseStep.label = payload.label || 'Condition';
    } else if (payload.kind === 'loop') {
        baseStep.itemVar = 'item';
        baseStep.overRef = 'trigger.output.items';
        baseStep.maxIterations = 100;
        baseStep.body = [];
        baseStep.label = payload.label || 'Loop';
    } else if (payload.kind === 'notification') {
        baseStep.title = 'Notification';
        baseStep.body = '';
        baseStep.channels = ['notification'];
        baseStep.label = payload.label || 'Notification';
    } else if (payload.kind === 'code') {
        baseStep.code = '// async function main(inputs, ctx) {\n//   return inputs;\n// }\nreturn inputs;';
        baseStep.language = 'javascript';
        baseStep.label = payload.label || 'Code';
    } else if (payload.kind === 'set') {
        baseStep.fields = {};
        baseStep.label = payload.label || 'Edit fields';
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
    } else if (payload.kind === 'filter') {
        baseStep.arrayRef = 'trigger.output.items';
        baseStep.expr = 'true';
        baseStep.label = payload.label || 'Filter';
    } else if (payload.kind === 'limit') {
        baseStep.arrayRef = 'trigger.output.items';
        baseStep.count = 10;
        baseStep.mode = 'first';
        baseStep.label = payload.label || 'Limit';
    } else if (payload.kind === 'dedupe') {
        baseStep.arrayRef = 'trigger.output.items';
        baseStep.label = payload.label || 'Remove duplicates';
    } else if (payload.kind === 'aggregate') {
        baseStep.arrayRef = 'trigger.output.items';
        baseStep.field = 'id';
        baseStep.label = payload.label || 'Aggregate';
    } else if (payload.kind === 'summarize') {
        baseStep.arrayRef = 'trigger.output.items';
        baseStep.field = 'amount';
        baseStep.op = 'sum';
        baseStep.label = payload.label || 'Summarize';
    }
    return baseStep;
}

/**
 * Pure transform: given the current definition, a palette payload, a
 * drop position, and (optionally) a source node id to wire from, return
 * the next definition. Used by both the drag-drop path and the slide-in
 * panel's click-to-add path so the result is identical either way.
 */
export function applyAddNode(definition, payload, position, sourceId = null) {
    const built = buildStepFromPayload(payload, position);
    if (!built) return definition;

    if (built.__replaceTrigger) {
        const { __replaceTrigger, ...nextTrigger } = built;
        // Preserve existing trigger id so saved-state edges still resolve.
        if (definition.trigger?.id) nextTrigger.id = definition.trigger.id;
        return seedPositions({ ...definition, trigger: nextTrigger });
    }

    const nextSteps = [...(definition.steps || []), built];
    const nextEdges = sourceId
        ? [...(definition.edges || []), { from: sourceId, to: built.id }]
        : (definition.edges || []);
    return seedPositions({ ...definition, steps: nextSteps, edges: nextEdges });
}

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
