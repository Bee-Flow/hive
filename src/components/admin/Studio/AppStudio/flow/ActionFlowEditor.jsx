import { Background, Handle, Position, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { AlertTriangle, ChevronDown, ChevronUp, CornerDownRight, Plus, Server, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@xyflow/react/dist/style.css';

import { NODE_W, layoutGraph } from './layout';
import { newStep, paletteGroups, stepMeta } from './stepCatalog';
import {
    canConnect, graphToSteps, makeId, parseId, scopesOf, SEP, stepsToGraph, stripStepIds, withStepIds,
} from './stepGraph';
import { isDanglingRef, labelForRef } from './stepReferences';
import StepSettings from './StepSettings';
import useStepReferences from './useStepReferences';
import NodeContextMenu from '../../../AITasksDesigner/Builder/flow/NodeContextMenu';
import { NodeRuntimeContext } from '../../../AITasksDesigner/Builder/flow/NodeRuntimeContext';
import StepNodeBase from '../../../AITasksDesigner/Builder/flow/nodes/StepNodeBase';
import IconButton from '../../../../shared/IconButton';
import toast from '../../../../shared/Toast';

/**
 * An action, as a picture you can build.
 *
 * A multi-step action could only ever be written by the AI builder — the
 * inspector edits four of the ten action kinds and none of the eighteen step
 * kinds. So "when this button is clicked, check something, then write a row,
 * then go to the next screen" was describable in a chat message and unreachable
 * any other way.
 *
 * ── WHY THIS IS NOT THE AUTOMATIONS CANVAS ──────────────────────────
 * That one draws a DAG whose runner gates fan-in. An App Studio action is a
 * strict tree, and it has to stay one: `stepIndex` is never stored, so the
 * browser and the server each derive it by walking the saved tree in the same
 * pre-order. A merge or a fan-out here would break that agreement silently, on
 * the server, at run time. stepGraph.canConnect is what refuses those, and
 * stepGraph.test.js pins the pre-order walk itself.
 *
 * What IS shared is the vocabulary: branches read `then` / `else` /
 * `case:<name>`, the same words the routine builder uses.
 *
 * `action` is a definition.actions entry; `onChange` emits the next one. Ids on
 * steps are assigned here and stripped on the way out — the schema addresses a
 * step by position, not by name.
 */

const NODE_TYPES_KEY = 'appStudioStep';

export default function ActionFlowEditor(props) {
    // React Flow needs its provider; keeping it here means callers mount one
    // component, not two.
    return (
        <ReactFlowProvider>
            <FlowBody {...props} />
        </ReactFlowProvider>
    );
}

function FlowBody({ action, onChange, definition, node = null, disabled = false, formFields = [] }) {
    const [selectedId, setSelectedId] = useState(null);
    const [adding, setAdding] = useState(null);   // { prefix, after? } — where
    const [ctxMenu, setCtxMenu] = useState(null); // { id, x, y } — right-click

    // Ids are editor-only: assigned on the way in, stripped on the way out.
    const withIds = useMemo(() => withStepIds(normalizeToSequence(action)), [action]);
    const graph = useMemo(() => stepsToGraph(withIds), [withIds]);
    const positions = useMemo(() => layoutGraph(graph.nodes), [graph.nodes]);

    const screens = definition?.screens || [];
    const references = useStepReferences(definition);
    const selected = graph.nodes.find((n) => n.id === selectedId && !n.isEntry) || null;

    /**
     * The scope a step was just appended to, held until the new graph arrives.
     *
     * A step's id is DERIVED from its position on every render (withStepIds
     * numbers the tree in pre-order) and stripped again on the way out, so the
     * temporary id addStep hands to graphToSteps does not survive the round
     * trip. Selecting that id therefore selected nothing: you picked "Show a
     * message" from the palette and the settings panel stayed on "Pick a step
     * to change it", with the new step's required Message field never shown.
     *
     * So the position is what is held, and resolved to an id once the rebuilt
     * graph is in hand.
     */
    const pendingScopeRef = useRef(null);
    const tempIdRef = useRef(0);
    useEffect(() => {
        const pending = pendingScopeRef.current;
        if (!pending) return;
        pendingScopeRef.current = null;
        const scoped = graph.nodes.filter((n) => n.prefix === pending.prefix && !n.isEntry);
        const added = scoped[pending.at] || scoped[scoped.length - 1];
        if (added) setSelectedId(added.id);
    }, [graph]);

    const commitSteps = useCallback((steps) => {
        onChange({ kind: 'sequence', steps: stripStepIds(steps) });
    }, [onChange]);

    /** Replace one step, wherever it sits. */
    const patchStep = useCallback((id, patch) => {
        const nodes = graph.nodes.map((n) => (n.id === id ? { ...n, step: { ...n.step, ...patch } } : n));
        commitSteps(graphToSteps(nodes, graph.edges));
    }, [graph, commitSteps]);

    const removeStep = useCallback((id) => {
        const gone = new Set([id, ...graph.nodes.filter((n) => n.id.startsWith(`${id}/`)).map((n) => n.id)]);
        const nodes = graph.nodes.filter((n) => !gone.has(n.id));
        const edges = graph.edges.filter((e) => !gone.has(e.from) && !gone.has(e.to));
        setSelectedId(null);
        commitSteps(graphToSteps(nodes, edges));
    }, [graph, commitSteps]);

    /**
     * Put a new step in one scope — at `at` (0-based) or, by default, at the
     * end. The automations canvas offers "+" on the node itself for exactly
     * this, so a step can be added where it belongs rather than only at the
     * bottom and then walked up.
     */
    const addStep = useCallback((kind, prefix, at = null) => {
        // Editor-only and thrown away by the commit below; a counter rather than
        // a clock so two adds in the same millisecond cannot share an id.
        tempIdRef.current += 1;
        const step = { ...newStep(kind, { screenId: screens[0]?.id || '' }), id: `n${tempIdRef.current}` };
        const id = prefix ? `${prefix}/${step.id}` : step.id;
        const scopeNodes = graph.nodes.filter((n) => n.prefix === prefix && !n.isEntry);
        const last = scopeNodes[scopeNodes.length - 1];
        const entry = graph.nodes.find((n) => n.isEntry && n.prefix === prefix);

        const fresh = {
            id, kind, step, prefix,
            parentId: entry?.parentId ?? null,
            scopeKey: entry?.scopeKey ?? null,
            scopeLabel: entry?.scopeLabel ?? null,
            isEntry: false,
        };

        setAdding(null);
        if (at == null) {
            // Appending: keep the chain and hang the new step off the last one.
            const from = last?.id || entry?.id;
            const edges = from ? [...graph.edges, { id: `${from}->${id}`, from, to: id }] : graph.edges;
            pendingScopeRef.current = { prefix, at: scopeNodes.length };
            commitSteps(graphToSteps([...graph.nodes, fresh], edges));
            return;
        }
        // Inserting: splice into the scope's node order and drop that scope's
        // edges, which encode the OLD order (see moveStep).
        pendingScopeRef.current = { prefix, at };
        commitSteps(graphToSteps(spliceScope(graph.nodes, prefix, at, fresh), dropScopeEdges(graph.edges, prefix)));
    }, [graph, screens, commitSteps]);

    /**
     * A copy of one step, right after the original — and everything inside it.
     *
     * graphToSteps rebuilds a container's children from the GRAPH, not from the
     * step object, so copying the step alone would produce a duplicate with
     * every branch emptied. The whole subtree is re-prefixed under the copy's
     * id and its edges come along, which is what keeps the branches populated
     * and in order.
     */
    const duplicateStep = useCallback((id) => {
        const { prefix } = parseId(id);
        const scoped = graph.nodes.filter((n) => n.prefix === prefix && !n.isEntry);
        const at = scoped.findIndex((n) => n.id === id);
        if (at === -1) return;

        tempIdRef.current += 1;
        const copyId = makeId(prefix, `n${tempIdRef.current}`);
        const remap = (nid) => copyId + nid.slice(id.length);
        const inside = (nid) => nid.startsWith(`${id}${SEP}`);

        // stripStepIds clears the editor-only ids from the copy's whole subtree,
        // so the duplicate cannot collide with the original's children.
        const [copiedStep] = stripStepIds([scoped[at].step]);
        const copy = { ...scoped[at], id: copyId, step: copiedStep };

        const descendants = graph.nodes.filter((n) => inside(n.id)).map((n) => ({
            ...n,
            id: remap(n.id),
            prefix: remap(n.prefix),
            parentId: n.parentId && inside(n.parentId) ? remap(n.parentId) : copyId,
        }));
        const descendantEdges = graph.edges
            .filter((e) => inside(e.from) && inside(e.to))
            .map((e) => ({ id: `${remap(e.from)}->${remap(e.to)}`, from: remap(e.from), to: remap(e.to) }));

        pendingScopeRef.current = { prefix, at: at + 1 };
        commitSteps(graphToSteps(
            [...spliceScope(graph.nodes, prefix, at + 1, copy), ...descendants],
            [...dropScopeEdges(graph.edges, prefix), ...descendantEdges],
        ));
    }, [graph, commitSteps]);

    /**
     * Move a step one place within its own branch.
     *
     * Reordering was only ever offered as a drag between the node handles, and
     * that could never succeed: the graph is re-derived from the tree on every
     * render as a COMPLETE chain, so every node already has its one incoming
     * and one outgoing edge and canConnect refused every pair — inside a branch
     * on the fan-in rule, at the root on the cycle rule. There is also no
     * edge-delete path (the canvas passes no onEdgesChange/deleteKeyCode), so
     * there was nothing to disconnect first. Deleting a step and rebuilding it
     * further down was the only way to reorder anything.
     *
     * The automations canvas reorders by dropping a step onto a connection,
     * which its DAG model allows. An app action is a strict tree, so order
     * lives in the ARRAY: this reorders one scope's nodes and drops that
     * scope's edges, and graphToSteps reads the scope back in node order
     * (orderScope falls through to `previousOrder` when nothing constrains it).
     */
    const moveStep = useCallback((id, delta) => {
        const { prefix } = parseId(id);
        const scoped = graph.nodes.filter((n) => n.prefix === prefix && !n.isEntry);
        const at = scoped.findIndex((n) => n.id === id);
        const to = at + delta;
        if (at === -1 || to < 0 || to >= scoped.length) return;

        const reordered = scoped.slice();
        [reordered[at], reordered[to]] = [reordered[to], reordered[at]];

        // Rebuild the node list with this scope's nodes in their new order,
        // leaving every other scope exactly where it was.
        let next = 0;
        const nodes = graph.nodes.map((n) => (
            (n.prefix === prefix && !n.isEntry) ? reordered[next++] : n
        ));
        pendingScopeRef.current = { prefix, at: to };
        commitSteps(graphToSteps(nodes, dropScopeEdges(graph.edges, prefix)));
    }, [graph, commitSteps]);

    const onConnect = useCallback((connection) => {
        const verdict = canConnect(connection.source, connection.target, graph.edges, graph.nodes);
        if (!verdict.ok) { toast.info(verdict.reason); return; }
        commitSteps(graphToSteps(graph.nodes, [
            ...graph.edges,
            { id: `${connection.source}->${connection.target}`, from: connection.source, to: connection.target },
        ]));
    }, [graph, commitSteps]);

    const rfNodes = useMemo(() => graph.nodes.map((n) => ({
        id: n.id,
        type: NODE_TYPES_KEY,
        position: positions.get(n.id) || { x: 0, y: 0 },
        draggable: false,       // position is derived; dragging would lie
        selectable: !n.isEntry,
        data: {
            node: n,
            selected: n.id === selectedId,
            summary: summarise(n.step, references.options),
            onSelect: () => setSelectedId(n.isEntry ? null : n.id),
            onAdd: () => setAdding({ prefix: n.prefix }),
            // The "+" on the node itself — add a step straight after this one,
            // the same gesture the routine builder offers.
            onAddAfter: n.isEntry ? null : () => setAdding({ prefix: n.prefix, after: n.id }),
            onContextMenu: n.isEntry ? undefined : (e) => {
                e.preventDefault();
                setSelectedId(n.id);
                setCtxMenu({ id: n.id, x: e.clientX, y: e.clientY });
            },
            disabled,
        },
    })), [graph.nodes, positions, selectedId, disabled, references.options]);

    /**
     * The step actions StepNodeBase draws on hover. It reads them from this
     * context in the routine builder too, so providing it here is all it takes
     * for an app step to behave like a routine step.
     */
    const nodeRuntime = useMemo(() => ({
        onDeleteNode: disabled ? null : removeStep,
        onDuplicateNode: disabled ? null : duplicateStep,
        // No partial execution, pinning, detaching or inline layers here — the
        // context's own defaults cover every one of those.
        attachedIds: new Set(),
    }), [disabled, removeStep, duplicateStep]);

    const rfEdges = useMemo(() => graph.edges.map((e) => ({
        id: e.id, source: e.from, target: e.to, type: 'smoothstep',
    })), [graph.edges]);

    const nodeTypes = useMemo(() => ({ [NODE_TYPES_KEY]: StepFlowNode }), []);
    const rootEmpty = graph.nodes.filter((n) => n.prefix === '').length === 0;

    return (
        <NodeRuntimeContext.Provider value={nodeRuntime}>
        <div className="flex h-full min-h-[420px] w-full gap-3" data-action-flow>
            <div className="relative flex-1 min-w-0 rounded-md border border-[var(--border-subtle)] overflow-hidden">
                <ReactFlow
                    nodes={rfNodes}
                    edges={rfEdges}
                    nodeTypes={nodeTypes}
                    onConnect={disabled ? undefined : onConnect}
                    // Order is changed with the move controls in the panel, not
                    // by dragging: the graph is always a complete chain, so every
                    // drag canConnect could receive is one it must refuse.
                    onPaneClick={() => { setSelectedId(null); setAdding(null); }}
                    fitView
                    proOptions={{ hideAttribution: true }}
                    nodesDraggable={false}
                    nodesConnectable={false}
                >
                    <Background gap={16} size={1} color="var(--border-subtle)" />
                </ReactFlow>

                {rootEmpty ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                        <p className="text-xs text-[var(--text-secondary)]">Nothing happens yet.</p>
                        <button
                            type="button"
                            onClick={() => setAdding({ prefix: '' })}
                            disabled={disabled}
                            className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                        >
                            <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add the first step
                        </button>
                    </div>
                ) : null}
            </div>

            <aside className="w-[300px] shrink-0 overflow-y-auto rounded-md border border-[var(--border-subtle)] p-3">
                {adding ? (
                    <StepPalette
                        onPick={(kind) => addStep(kind, adding.prefix, indexAfter(graph, adding.after))}
                        onCancel={() => setAdding(null)}
                    />
                ) : selected ? (
                    <div className="flex flex-col gap-3">
                        <header className="flex items-center gap-2">
                            <h3 className="flex-1 text-sm font-semibold text-[var(--text-primary)]">
                                {stepMeta(selected.kind).label}
                            </h3>
                            <IconButton
                                ariaLabel="Move this step earlier"
                                size="sm"
                                disabled={disabled || !canMove(graph, selected.id, -1)}
                                onClick={() => moveStep(selected.id, -1)}
                            >
                                <ChevronUp />
                            </IconButton>
                            <IconButton
                                ariaLabel="Move this step later"
                                size="sm"
                                disabled={disabled || !canMove(graph, selected.id, 1)}
                                onClick={() => moveStep(selected.id, 1)}
                            >
                                <ChevronDown />
                            </IconButton>
                            <IconButton
                                ariaLabel={`Delete this ${stepMeta(selected.kind).label.toLowerCase()} step`}
                                variant="danger"
                                size="sm"
                                disabled={disabled}
                                onClick={() => removeStep(selected.id)}
                            >
                                <Trash2 />
                            </IconButton>
                        </header>
                        <StepSettings
                            step={selected.step}
                            onChange={(next) => patchStep(selected.id, next)}
                            definition={definition}
                            node={node}
                            screens={screens}
                            formFields={formFields}
                            disabled={disabled}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        <p className="text-xs text-[var(--text-secondary)]">
                            Pick a step to change it, or add one to the end.
                        </p>
                        <button
                            type="button"
                            onClick={() => setAdding({ prefix: '' })}
                            disabled={disabled}
                            className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                        >
                            <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add a step
                        </button>
                    </div>
                )}
            </aside>

            {/* The routine builder's own right-click menu, unchanged. */}
            {ctxMenu ? (
                <NodeContextMenu
                    x={ctxMenu.x}
                    y={ctxMenu.y}
                    canDelete={!disabled}
                    canDuplicate={!disabled}
                    onDuplicate={() => duplicateStep(ctxMenu.id)}
                    onDelete={() => removeStep(ctxMenu.id)}
                    onClose={() => setCtxMenu(null)}
                />
            ) : null}
        </div>
        </NodeRuntimeContext.Provider>
    );
}

/** Where a step added "after this one" lands in its scope. */
function indexAfter(graph, afterId) {
    if (!afterId) return null;
    const { prefix } = parseId(afterId);
    const scoped = graph.nodes.filter((n) => n.prefix === prefix && !n.isEntry);
    const at = scoped.findIndex((n) => n.id === afterId);
    return at === -1 ? null : at + 1;
}

/**
 * Put `node` at position `at` among the non-entry nodes of one scope, leaving
 * every other scope exactly where it is. The node ARRAY carries the order —
 * see moveStep for why the scope's edges are dropped alongside it.
 */
function spliceScope(nodes, prefix, at, node) {
    const scoped = nodes.filter((n) => n.prefix === prefix && !n.isEntry);
    const anchor = scoped[at];
    if (anchor) {
        const i = nodes.indexOf(anchor);
        return [...nodes.slice(0, i), node, ...nodes.slice(i)];
    }
    // Past the end of the scope: straight after its last node, so the new one
    // stays inside the scope rather than drifting into whatever follows.
    const last = scoped[scoped.length - 1];
    if (!last) return [...nodes, node];
    const i = nodes.indexOf(last);
    return [...nodes.slice(0, i + 1), node, ...nodes.slice(i + 1)];
}

/** Forget one scope's edges — they encode the order the array now owns. */
function dropScopeEdges(edges, prefix) {
    return edges.filter((e) => parseId(e.from).prefix !== prefix);
}

/** Is there a neighbour that way, inside this step's own branch? */
function canMove(graph, id, delta) {
    const { prefix } = parseId(id);
    const scoped = graph.nodes.filter((n) => n.prefix === prefix && !n.isEntry);
    const at = scoped.findIndex((n) => n.id === id);
    return at !== -1 && at + delta >= 0 && at + delta < scoped.length;
}

/** A bare v1 action is an implicit one-step sequence — the runtime says so too. */
function normalizeToSequence(action) {
    if (!action) return { kind: 'sequence', steps: [] };
    if (action.kind === 'sequence') return action;
    return { kind: 'sequence', steps: [action] };
}

/**
 * One node on the canvas: a step, or a branch's entry pill.
 *
 * A step draws with StepNodeBase — the SAME chrome the automations canvas uses
 * for its own steps. Not only for looks: it brings the hover actions (duplicate,
 * delete), the "+" that adds a step right after this one, the validation badge
 * and the per-branch output ports, all behaving exactly as they do in the
 * routine builder. Somebody who has wired a routine already knows how to wire
 * an app.
 *
 * Those actions arrive through NodeRuntimeContext, which is how StepNodeBase
 * reads them there too — so nothing about that component had to change to serve
 * a second canvas.
 */
function StepFlowNode({ id, data }) {
    const { node, selected, summary, onSelect, onAdd, onAddAfter, onContextMenu, disabled } = data;

    if (node.isEntry) {
        return (
            <div style={{ width: NODE_W }}>
                <Handle type="source" position={Position.Bottom} style={{ background: 'var(--editor-accent)' }} />
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                    <CornerDownRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="font-medium">{node.scopeLabel}</span>
                    <button
                        type="button"
                        onClick={onAdd}
                        disabled={disabled}
                        aria-label={`Add a step to ${node.scopeLabel}`}
                        className="ml-auto px-1.5 py-0.5 rounded border border-dashed border-[var(--border-default)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                    >
                        <Plus className="w-3 h-3" aria-hidden="true" />
                    </button>
                </div>
            </div>
        );
    }

    const meta = stepMeta(node.kind);
    const Icon = meta.icon;
    const branches = scopesOf(node.step);

    const body = (
        <div>
            <div className="font-semibold truncate">{meta.label}</div>
            <div
                className={`mt-0.5 flex items-center gap-1 text-[10px] truncate ${
                    summary?.missing ? 'text-[var(--error)]' : 'text-[var(--text-secondary)]'
                }`}
                data-step-missing-ref={summary?.missing ? 'true' : undefined}
            >
                {summary?.missing ? (
                    <AlertTriangle className="w-3 h-3 shrink-0" aria-label="This no longer exists" />
                ) : null}
                <span className="truncate">{summary?.text}</span>
            </div>
        </div>
    );

    return (
        <div
            style={{ width: NODE_W }}
            onClick={onSelect}
            onContextMenu={onContextMenu}
            data-step-node={node.id}
            data-selected={selected || undefined}
            className={selected ? 'rounded-lg ring-2 ring-[var(--editor-accent)]' : undefined}
        >
            <StepNodeBase
                icon={<Icon size={14} />}
                typeLabel={meta.label}
                help={meta.blurb}
                body={body}
                badges={meta.server ? (
                    <Server className="w-3 h-3 text-[var(--text-tertiary)]" aria-label="Runs on the server" />
                ) : null}
                // A reference pointing at something deleted is a real error, so
                // it lights the same validation badge a bad routine step does.
                issues={summary?.missing ? { errors: ['This no longer exists'], warnings: [] } : null}
                nodeId={id}
                onAddAfter={disabled ? null : onAddAfter}
                // condition/switch/loop get one output port per branch, the way
                // the routine builder draws its own branching steps.
                sourceHandles={branches.length
                    ? branches.map((b) => ({ id: b.key, label: b.label, tone: 'neutral' }))
                    : null}
                sourceConnectable={false}
            />
        </div>
    );
}

/**
 * The one line under a step's name — what it actually does, in its own words.
 *
 * It used to print the raw id for everything a step points at: a "Go to screen"
 * node read `→ scr_8f21`, "Add a row" read `tbl_9f3a2c`, "Run routine" read a
 * uuid. On a canvas whose whole job is showing what happens, the one line that
 * says WHICH thing was the one line nobody could read. `options` is the same
 * name lookup the settings pickers use; without it (nothing loaded yet) each
 * helper falls back to the id, so the node never goes blank.
 *
 * → { text, missing } — `missing` marks a step pointing at something that has
 * since been deleted, so the canvas can show it before the app is published.
 */
function summarise(step, options = {}) {
    if (!step) return { text: '', missing: false };

    const ref = (kind, id, empty) => {
        if (!id) return { text: empty, missing: false };
        return { text: labelForRef(options[kind], id), missing: isDanglingRef(options[kind], id) };
    };
    const plain = (text) => ({ text: text || '', missing: false });

    switch (step.kind) {
        case 'navigate': {
            const r = ref('screen', step.screenId, 'No screen picked yet');
            return { ...r, text: step.screenId ? `→ ${r.text}` : r.text };
        }
        case 'open_modal':
        case 'close_modal': return ref('modal', step.modalId, 'No dialog picked yet');
        case 'toast': return plain(step.message || 'No message yet');
        case 'open_url': return plain(step.url || 'No address yet');
        case 'set_variable': return plain(step.name ? `vars.${step.name}` : 'No variable picked yet');
        case 'condition':
        case 'switch': return plain(step.expr || 'No condition yet');
        case 'loop': return plain(step.itemVar ? `each ${step.itemVar}` : 'For every row');
        case 'create_record':
        case 'update_record':
        case 'delete_record': return ref('table', step.tableId, 'No table picked yet');
        case 'refresh': {
            if (step.tableId) return ref('table', step.tableId, '');
            if (step.datasetId) return ref('dataset', step.datasetId, '');
            return plain('Everything on the screen');
        }
        case 'run_automation': return ref('automation', step.automationId, 'No routine picked yet');
        case 'send_email': return ref('connector', step.connectorId, 'No mailbox picked yet');
        case 'confirm': return plain(step.message || '');
        default: return plain(step.resultVar ? `→ vars.${step.resultVar}` : '');
    }
}

function StepPalette({ onPick, onCancel }) {
    return (
        <div className="flex flex-col gap-3">
            <header className="flex items-center gap-2">
                <h3 className="flex-1 text-sm font-semibold text-[var(--text-primary)]">Add a step</h3>
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)] rounded px-1"
                >
                    Cancel
                </button>
            </header>
            {paletteGroups().map(({ group, kinds }) => (
                <div key={group} className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{group}</span>
                    {kinds.map(({ kind, label, blurb, icon: Icon }) => (
                        <button
                            key={kind}
                            type="button"
                            onClick={() => onPick(kind)}
                            className="flex items-start gap-2 text-left rounded-md border border-[var(--border-subtle)] px-2 py-1.5 hover:bg-[var(--bg-tertiary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)]"
                        >
                            <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
                            <span className="min-w-0">
                                <span className="block text-xs font-medium text-[var(--text-primary)]">{label}</span>
                                <span className="block text-[11px] text-[var(--text-secondary)]">{blurb}</span>
                            </span>
                        </button>
                    ))}
                </div>
            ))}
        </div>
    );
}
