import {
    ReactFlow, ReactFlowProvider, Background, Controls, Handle, MarkerType, Position,
    applyNodeChanges,
} from '@xyflow/react';
import { AlertTriangle, Database, LayoutGrid, Link2, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '@xyflow/react/dist/style.css';

import {
    addRelation, fillersOfRelation, layoutTables, LAYOUT,
    relationsOf, removeRelation, renameRelation, retargetRelation,
} from './relationOps';

/**
 * App Studio — how the tables hang together, as a map you can edit.
 *
 * A relation is a `relation` field on the table that holds it, and the server
 * turns it into a real FOREIGN KEY. Before this the only way to see or make one
 * was to open a table, add a field, set its type and pick a target — which tells
 * you nothing about the shape of the model as a whole, and is exactly the wrong
 * gesture for "these two belong together".
 *
 * ── DIRECTION ───────────────────────────────────────────────────────
 * An unlabelled arrow between two tables is read both ways, so the rule is fixed
 * and stated in the panel: the table holding the column is the MANY side, and the
 * arrow points at the ONE it belongs to. Dragging follows the same story —
 * from the bottom of the child, to the top of the parent.
 *
 * ── WHAT IS NOT PERSISTED ───────────────────────────────────────────
 * Node positions. The data model has nowhere to keep x/y, so the layout is
 * derived from the relations themselves every time (relationOps.layoutTables) and
 * dragging is a within-session convenience. Saying so beats inventing a storage
 * location the server would have to validate and migrate.
 *
 * Everything else goes through the same `onChange(tables)` the field designer
 * uses, so it dirty-tracks and saves with one Save changes.
 */

const NODE_TYPE = 'studioTable';

function TableNode({ data }) {
    const { table, fillerName, selected, onOpen } = data;
    const columns = (table.fields || []).filter((f) => f.type !== 'relation');
    return (
        <div
            className="rounded-lg border text-left"
            style={{
                width: LAYOUT.NODE_W,
                borderColor: selected ? 'var(--accent-primary)' : 'var(--border-default)',
                background: 'var(--bg-secondary)',
                boxShadow: selected ? '0 0 0 1px var(--accent-primary)' : undefined,
            }}
        >
            <Handle type="target" position={Position.Top} style={{ background: 'var(--accent-primary)' }} />
            <button
                type="button"
                onClick={() => onOpen(table.id)}
                className="w-full px-3 py-2 text-left"
                title="Open this table in the designer"
            >
                <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    <Database className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                    <span className="truncate">{table.name || table.key}</span>
                </span>
                <span className="mt-0.5 block truncate text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    {table.key} · {(table.fields || []).length} column{(table.fields || []).length === 1 ? '' : 's'}
                </span>
            </button>
            <div className="border-t px-3 py-1.5" style={{ borderColor: 'var(--border-default)' }}>
                {columns.slice(0, 4).map((f) => (
                    <p key={f.id} className="truncate text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                        {f.key}
                        {f.unique ? <span style={{ color: 'var(--text-tertiary)' }}> · unique</span> : null}
                    </p>
                ))}
                {columns.length > 4 ? (
                    <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>+{columns.length - 4} more</p>
                ) : null}
            </div>
            {fillerName ? (
                <p className="truncate border-t px-3 py-1 text-[11px]"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-tertiary)' }}>
                    filled by “{fillerName}”
                </p>
            ) : null}
            <Handle type="source" position={Position.Bottom} style={{ background: 'var(--accent-primary)' }} />
        </div>
    );
}

const nodeTypes = { [NODE_TYPE]: TableNode };

function Canvas({ tables, connectors, onChange, onOpenTable, disabled }) {
    const relations = useMemo(() => relationsOf(tables), [tables]);
    const [selectedEdgeId, setSelectedEdgeId] = useState(null);
    const [error, setError] = useState(null);
    // Positions are derived; dragging only overrides them for this session.
    const [positions, setPositions] = useState(() => layoutTables(tables));

    // A table added or removed elsewhere (the designer, a connector proposal) has
    // no position yet — re-derive rather than leaving it stacked at the origin.
    const tableIds = useMemo(() => (tables || []).map((t) => t.id).join(','), [tables]);
    useEffect(() => {
        setPositions((prev) => {
            const fresh = layoutTables(tables);
            for (const id of Object.keys(fresh)) if (prev[id]) fresh[id] = prev[id];
            return fresh;
        });
        // Only when the SET of tables changes — not on every field edit, which
        // would yank a dragged node back.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tableIds]);

    const fillerByTable = useMemo(() => {
        const m = new Map();
        for (const c of connectors || []) {
            if (!c?.sync) continue;
            const name = c.name || 'a connector';
            if (c.sync.tableId) m.set(c.sync.tableId, name);
            for (const child of c.sync.children || []) if (child?.tableId) m.set(child.tableId, name);
        }
        return m;
    }, [connectors]);

    const nodes = useMemo(() => (tables || []).map((t) => ({
        id: t.id,
        type: NODE_TYPE,
        position: positions[t.id] || { x: 0, y: 0 },
        data: {
            table: t,
            fillerName: fillerByTable.get(t.id) || null,
            selected: selectedEdgeId ? selectedEdgeId.startsWith(`${t.id}:`) : false,
            onOpen: onOpenTable,
        },
    })), [tables, positions, fillerByTable, selectedEdgeId, onOpenTable]);

    const edges = useMemo(() => relations.filter((r) => !r.dangling).map((r) => ({
        id: r.id,
        source: r.fromTableId,
        target: r.toTableId,
        type: 'smoothstep',
        label: r.fieldKey,
        selected: r.id === selectedEdgeId,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: r.id === selectedEdgeId ? 'var(--accent-primary)' : 'var(--border-default)', strokeWidth: r.id === selectedEdgeId ? 2 : 1.5 },
        labelStyle: { fill: 'var(--text-tertiary)', fontSize: 11 },
    })), [relations, selectedEdgeId]);

    const onNodesChange = useCallback((changes) => {
        setPositions((prev) => {
            const next = { ...prev };
            for (const n of applyNodeChanges(changes, Object.entries(prev).map(([id, position]) => ({ id, position })))) {
                next[n.id] = n.position;
            }
            return next;
        });
    }, []);

    const onConnect = useCallback(({ source, target }) => {
        setError(null);
        if (disabled || !source || !target) return;
        if (source === target) {
            setError('A table cannot be linked to itself here — add the field in the designer if you really need that.');
            return;
        }
        const res = addRelation(tables, { fromTableId: source, toTableId: target });
        if (res.error) { setError(res.error); return; }
        onChange(res.tables);
    }, [tables, onChange, disabled]);

    const selected = relations.find((r) => r.id === selectedEdgeId) || null;
    const from = selected ? (tables || []).find((t) => t.id === selected.fromTableId) : null;
    const to = selected ? (tables || []).find((t) => t.id === selected.toTableId) : null;

    const dangling = relations.filter((r) => r.dangling);

    const deleteSelected = () => {
        if (!selected) return;
        const fillers = fillersOfRelation(connectors, selected.fromTableId, selected.fieldKey);
        if (fillers.length) {
            setError(`“${fillers[0].name || 'A connector'}” fills this link on every refresh. Stop it filling that table first.`);
            return;
        }
        onChange(removeRelation(tables, { tableId: selected.fromTableId, fieldId: selected.fieldId }));
        setSelectedEdgeId(null);
        setError(null);
    };

    if (!(tables || []).length) {
        return (
            <p className="py-10 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                No tables yet. Add one on the Tables tab, then come back to link them up.
            </p>
        );
    }

    return (
        <div className="flex gap-3 min-h-[24rem]">
            <div className="relative flex-1 rounded-lg border" style={{ borderColor: 'var(--border-default)', height: '26rem' }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onConnect={onConnect}
                    onEdgeClick={(_, edge) => setSelectedEdgeId(edge.id)}
                    onPaneClick={() => setSelectedEdgeId(null)}
                    nodesConnectable={!disabled}
                    elementsSelectable
                    fitView
                    proOptions={{ hideAttribution: true }}
                >
                    <Background gap={16} />
                    <Controls showInteractive={false} />
                </ReactFlow>
                <button
                    type="button"
                    onClick={() => setPositions(layoutTables(tables))}
                    className="absolute right-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                    style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                >
                    <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" /> Re-arrange
                </button>
            </div>

            <div className="w-64 shrink-0 flex flex-col gap-2">
                {selected && from && to ? (
                    <div className="rounded-lg border p-3 flex flex-col gap-2"
                        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                        <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                            <Link2 className="h-3.5 w-3.5" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                            The link
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
                            Each <strong>{from.name || from.key}</strong> belongs to one{' '}
                            <strong>{to.name || to.key}</strong>.
                        </p>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Column name</span>
                            <input
                                className="w-full rounded-md border px-2 py-1.5 text-sm"
                                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                                value={selected.fieldName}
                                disabled={disabled}
                                aria-label="Column name"
                                onChange={(e) => onChange(renameRelation(tables, {
                                    tableId: selected.fromTableId, fieldId: selected.fieldId, name: e.target.value,
                                }))}
                            />
                            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                Stored in <code>{from.key}.{selected.fieldKey}</code>. Renaming the column key is a
                                migration — that stays on the Tables tab.
                            </span>
                        </label>
                        <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Points at</span>
                            <select
                                className="w-full rounded-md border px-2 py-1.5 text-sm"
                                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                                value={selected.toTableId || ''}
                                disabled={disabled}
                                aria-label="Related table"
                                onChange={(e) => onChange(retargetRelation(tables, {
                                    tableId: selected.fromTableId, fieldId: selected.fieldId, toTableId: e.target.value,
                                }))}
                            >
                                {(tables || []).filter((t) => t.id !== selected.fromTableId).map((t) => (
                                    <option key={t.id} value={t.id}>{t.name || t.key}</option>
                                ))}
                            </select>
                        </label>
                        <button
                            type="button"
                            onClick={deleteSelected}
                            disabled={disabled}
                            className="inline-flex items-center gap-1.5 self-start text-xs"
                            style={{ color: 'var(--error)' }}
                        >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove this link
                        </button>
                    </div>
                ) : (
                    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Link two tables</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            Drag from the bottom of the table that has many, to the top of the one it belongs to — an
                            attachment to its message. That adds a relation column to the first table.
                        </p>
                        <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            Click a line to rename, repoint or remove it. Connectors with follow-up steps draw their own
                            links and keep them filled.
                        </p>
                        <p className="mt-2 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                            Where the cards sit is not saved — the layout is worked out from the links each time.
                        </p>
                    </div>
                )}

                {dangling.length ? (
                    <p className="flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-xs"
                        style={{ borderColor: 'rgba(217, 119, 6, 0.4)', background: 'rgba(217, 119, 6, 0.1)', color: '#d97706' }}>
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                            {dangling.length} relation column{dangling.length === 1 ? '' : 's'} point at a table that no
                            longer exists ({dangling.map((r) => r.fieldKey).join(', ')}). Fix them on the Tables tab —
                            the model will not save until you do.
                        </span>
                    </p>
                ) : null}

                {error ? (
                    <p role="alert" className="flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-xs"
                        style={{ borderColor: 'color-mix(in srgb, var(--error) 40%, transparent)', background: 'color-mix(in srgb, var(--error) 10%, transparent)', color: 'var(--error)' }}>
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{error}</span>
                    </p>
                ) : null}
            </div>
        </div>
    );
}

export default function RelationshipsTab(props) {
    return (
        <ReactFlowProvider>
            <Canvas {...props} />
        </ReactFlowProvider>
    );
}
