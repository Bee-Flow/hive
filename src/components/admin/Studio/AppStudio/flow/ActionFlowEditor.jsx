import { Background, Handle, Position, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { CornerDownRight, Plus, Server, Trash2 } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import '@xyflow/react/dist/style.css';

import { NODE_W, layoutGraph } from './layout';
import StepSettings from './StepSettings';
import { newStep, paletteGroups, stepMeta } from './stepCatalog';
import {
    canConnect, graphToSteps, scopesOf, stepsToGraph, stripStepIds, withStepIds,
} from './stepGraph';
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

function FlowBody({ action, onChange, definition, node = null, disabled = false }) {
    const [selectedId, setSelectedId] = useState(null);
    const [adding, setAdding] = useState(null);   // { prefix } — which scope

    // Ids are editor-only: assigned on the way in, stripped on the way out.
    const withIds = useMemo(() => withStepIds(normalizeToSequence(action)), [action]);
    const graph = useMemo(() => stepsToGraph(withIds), [withIds]);
    const positions = useMemo(() => layoutGraph(graph.nodes), [graph.nodes]);

    const screens = definition?.screens || [];
    const selected = graph.nodes.find((n) => n.id === selectedId && !n.isEntry) || null;

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

    /** Append a step to the end of one scope. */
    const addStep = useCallback((kind, prefix) => {
        const step = { ...newStep(kind, { screenId: screens[0]?.id || '' }), id: `n${Date.now()}` };
        const id = prefix ? `${prefix}/${step.id}` : step.id;
        const scopeNodes = graph.nodes.filter((n) => n.prefix === prefix && !n.isEntry);
        const last = scopeNodes[scopeNodes.length - 1];
        const entry = graph.nodes.find((n) => n.isEntry && n.prefix === prefix);

        const nodes = [...graph.nodes, {
            id, kind, step, prefix,
            parentId: entry?.parentId ?? null,
            scopeKey: entry?.scopeKey ?? null,
            scopeLabel: entry?.scopeLabel ?? null,
            isEntry: false,
        }];
        const from = last?.id || entry?.id;
        const edges = from ? [...graph.edges, { id: `${from}->${id}`, from, to: id }] : graph.edges;

        setAdding(null);
        setSelectedId(id);
        commitSteps(graphToSteps(nodes, edges));
    }, [graph, screens, commitSteps]);

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
            onSelect: () => setSelectedId(n.isEntry ? null : n.id),
            onAdd: () => setAdding({ prefix: n.isEntry ? n.prefix : n.prefix }),
            disabled,
        },
    })), [graph.nodes, positions, selectedId, disabled]);

    const rfEdges = useMemo(() => graph.edges.map((e) => ({
        id: e.id, source: e.from, target: e.to, type: 'smoothstep',
    })), [graph.edges]);

    const nodeTypes = useMemo(() => ({ [NODE_TYPES_KEY]: StepFlowNode }), []);
    const rootEmpty = graph.nodes.filter((n) => n.prefix === '').length === 0;

    return (
        <div className="flex h-full min-h-[420px] w-full gap-3" data-action-flow>
            <div className="relative flex-1 min-w-0 rounded-md border border-[var(--border-subtle)] overflow-hidden">
                <ReactFlow
                    nodes={rfNodes}
                    edges={rfEdges}
                    nodeTypes={nodeTypes}
                    onConnect={disabled ? undefined : onConnect}
                    onPaneClick={() => { setSelectedId(null); setAdding(null); }}
                    fitView
                    proOptions={{ hideAttribution: true }}
                    nodesDraggable={false}
                    nodesConnectable={!disabled}
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
                        onPick={(kind) => addStep(kind, adding.prefix)}
                        onCancel={() => setAdding(null)}
                    />
                ) : selected ? (
                    <div className="flex flex-col gap-3">
                        <header className="flex items-center gap-2">
                            <h3 className="flex-1 text-sm font-semibold text-[var(--text-primary)]">
                                {stepMeta(selected.kind).label}
                            </h3>
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
        </div>
    );
}

/** A bare v1 action is an implicit one-step sequence — the runtime says so too. */
function normalizeToSequence(action) {
    if (!action) return { kind: 'sequence', steps: [] };
    if (action.kind === 'sequence') return action;
    return { kind: 'sequence', steps: [action] };
}

/** One node on the canvas: a step, or a branch's entry pill. */
function StepFlowNode({ data }) {
    const { node, selected, onSelect, onAdd, disabled } = data;

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

    return (
        <div style={{ width: NODE_W }}>
            <Handle type="target" position={Position.Top} style={{ background: 'var(--editor-accent)' }} />
            <button
                type="button"
                onClick={onSelect}
                aria-pressed={selected}
                className={`w-full text-left rounded-md border px-2.5 py-2 bg-[var(--bg-secondary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary-hover)] ${
                    selected ? 'border-[var(--editor-accent)]' : 'border-[var(--border-default)] hover:border-[var(--accent-primary-hover)]'
                }`}
            >
                <span className="flex items-center gap-2">
                    <Icon className="w-4 h-4 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-[var(--text-primary)] truncate">{meta.label}</span>
                        <span className="block text-[11px] text-[var(--text-secondary)] truncate">{summarise(node.step)}</span>
                    </span>
                    {meta.server ? (
                        <Server className="w-3 h-3 shrink-0 text-[var(--text-tertiary)]" aria-label="Runs on the server" />
                    ) : null}
                </span>
                {branches.length ? (
                    <span className="mt-1.5 flex flex-wrap gap-1">
                        {branches.map((b) => (
                            <span key={b.key} className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                                {b.label}
                            </span>
                        ))}
                    </span>
                ) : null}
            </button>
            <Handle type="source" position={Position.Bottom} style={{ background: 'var(--editor-accent)' }} />
        </div>
    );
}

/** The one line under a step's name — what it actually does, in its own words. */
function summarise(step) {
    if (!step) return '';
    switch (step.kind) {
        case 'navigate': return step.screenId ? `→ ${step.screenId}` : 'No screen picked yet';
        case 'toast': return step.message || 'No message yet';
        case 'open_url': return step.url || 'No address yet';
        case 'set_variable': return step.name ? `vars.${step.name}` : 'No variable picked yet';
        case 'condition':
        case 'switch': return step.expr || 'No condition yet';
        case 'loop': return step.itemVar ? `each ${step.itemVar}` : 'For every row';
        case 'create_record':
        case 'update_record':
        case 'delete_record': return step.tableId || 'No table picked yet';
        case 'run_automation': return step.automationId || 'No routine picked yet';
        case 'confirm': return step.message || '';
        default: return step.resultVar ? `→ vars.${step.resultVar}` : '';
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
