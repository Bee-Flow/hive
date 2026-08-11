import { Database, FileInput, Loader2, Plug, Plus, Rows3, Share2, Table2, Trash2 } from 'lucide-react';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import RowsTab from './RowsTab';
import TableDesigner, { slugifyKey } from './TableDesigner';
import ConfirmDialog from '../../../../shared/ConfirmDialog';
import Modal from '../../../../shared/Modal';
import toast from '../../../../shared/Toast';
import ConnectorsManager, { connectorProblem } from '../bi/ConnectorsManager';
import useAppTables from '../bi/useAppTables';
import { buildFormForTable, buildGridForTable } from '../state/generators';
import { collectIds, findScreen, insertNode } from '../state/definitionOps';
import { studioAppsApi } from '../studioAppsApi';

/**
 * App Studio — the visual data-table designer (a modal).
 *
 * Left: the app's tables (from the owner data model). Right: the selected
 * table's fields (TableDesigner) plus one-click generators that drop a bound
 * form or grid onto the current screen. Structural edits (add/rename/delete
 * table, edit fields) persist to the data model via PUT /:id/schema on Save;
 * a save triggers the server's table migration, so the "Make a form/grid"
 * generators are only offered for tables that already exist server-side
 * (surfaced through useAppTables).
 *
 * The Rows tab edits the table's actual records (RowsTab). It hangs off the
 * same "does this table exist server-side yet" fact: a table that has only ever
 * been drafted here has no storage behind it, so the tab is disabled — and says
 * so — until the model is saved.
 */

// The relationship canvas pulls in ReactFlow and its stylesheet, which nobody
// opening the field designer needs — and which is a lot of code to parse before
// the modal can paint. Loaded when the tab is actually opened.
const RelationshipsTab = lazy(() => import('./RelationshipsTab'));

function randHex(n) {
    let s = '';
    while (s.length < n) s += Math.floor(Math.random() * 16).toString(16);
    return s.slice(0, n);
}
function newTableId() { return `tbl_${randHex(6)}`; }

function emptyModel() {
    return { modelVersion: 1, tables: [], roles: [], roleMapping: { default: 'app', byGroup: {} } };
}

function uniqueTableKey(base, tables) {
    const taken = new Set((tables || []).map((t) => t.key));
    let key = slugifyKey(base || 'table');
    let n = 2;
    while (taken.has(key)) { key = `${slugifyKey(base || 'table')}_${n}`; n += 1; }
    return key;
}

export default function TablesManager({
    open, onClose, appId, definition, screenId, onCommit, dispatch,
}) {
    const { tables: savedTables, refetch: refetchSaved } = useAppTables(appId);

    const [model, setModel] = useState(null);
    const [modelVersion, setModelVersion] = useState(0);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    // The model exactly as the server last accepted it. Comparing against this
    // snapshot (rather than clearing a flag when a save returns) keeps edits
    // made WHILE that save was in flight marked as unsaved.
    const [savedSnapshot, setSavedSnapshot] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [activeTab, setActiveTab] = useState('tables'); // 'tables' | 'rows' | 'connectors' | 'relations'

    const savedIds = useMemo(() => new Set((savedTables || []).map((t) => t.id)), [savedTables]);
    const savedById = useMemo(() => {
        const m = new Map();
        for (const t of savedTables || []) m.set(t.id, t);
        return m;
    }, [savedTables]);

    // Load the editable owner model whenever the modal opens.
    const load = useCallback(async () => {
        if (!appId) { setModel(emptyModel()); return; }
        setLoading(true);
        try {
            const res = await studioAppsApi.getSchema(appId);
            const loaded = (res && res.model && typeof res.model === 'object') ? res.model : emptyModel();
            if (!Array.isArray(loaded.tables)) loaded.tables = [];
            setModel(loaded);
            setModelVersion(res?.modelVersion || 0);
            setSavedSnapshot(JSON.stringify(loaded));
            setSelectedId(loaded.tables[0]?.id || null);
        } catch (err) {
            // A missing model (or endpoint) → start from a blank one; still usable.
            const blank = emptyModel();
            setModel(blank);
            setModelVersion(0);
            setSavedSnapshot(JSON.stringify(blank));
            if (err?.status && err.status !== 404) toast.error(err.message || 'Could not load the data model.');
        } finally {
            setLoading(false);
        }
    }, [appId]);

    useEffect(() => {
        if (open) load();
    }, [open, load]);

    const tables = model?.tables || [];
    const selected = tables.find((t) => t.id === selectedId) || null;
    const dirty = !!model && JSON.stringify(model) !== savedSnapshot;

    // Rows live in the table the SERVER has; a draft table has none yet, and a
    // draft field is not a column until the model is saved.
    const selectedSaved = selected ? (savedById.get(selected.id) || null) : null;
    const fieldsUnsaved = !!selectedSaved
        && JSON.stringify(selected.fields || []) !== JSON.stringify(selectedSaved.fields || []);

    // Deleting (or never having saved) the table behind the Rows tab leaves it
    // pointing at nothing — fall back to the designer rather than a blank pane.
    useEffect(() => {
        if (activeTab === 'rows' && !selectedSaved) setActiveTab('tables');
    }, [activeTab, selectedSaved]);

    const patchModel = (nextTables) => {
        setModel((m) => ({ ...(m || emptyModel()), tables: nextTables }));
    };

    // Connectors ride on the SAME model — the existing save() persists them
    // through PUT /:id/schema alongside the tables.
    const patchConnectors = (nextConnectors) => {
        setModel((m) => ({ ...(m || emptyModel()), connectors: nextConnectors }));
    };

    /**
     * A connector proposed one or more tables (from /inspect) and the owner
     * accepted them. Everything lands in ONE model update: a sync whose tableId
     * — or whose child tableId — doesn't resolve fails validation, so writing
     * them across several setState calls would leave a window where the model
     * can't be saved at all.
     *
     * A chain that expands proposes a related SET (messages + attachments joined
     * by a relation column), so this takes an array.
     */
    const createTableForConnector = (connectorId, newTables, sync) => {
        const list = Array.isArray(newTables) ? newTables : [newTables];
        if (!list.length) return;
        setModel((m) => {
            const base = m || emptyModel();
            const tablesNow = base.tables || [];
            // Keep the proposed keys unique against what's already drafted AND
            // against each other.
            const accumulated = [...tablesNow];
            for (const t of list) {
                accumulated.push({ ...t, key: uniqueTableKey(t.key || t.name, accumulated) });
            }
            return {
                ...base,
                tables: accumulated,
                connectors: (base.connectors || []).map((c) => (c.id === connectorId ? { ...c, sync } : c)),
            };
        });
        setSelectedId(list[0].id);
        toast.success(list.length > 1
            ? `${list.length} linked tables added — save your changes to create them and start filling them.`
            : 'Table added — save your changes to create it and start filling it.');
    };

    const addTable = () => {
        const name = `Table ${tables.length + 1}`;
        const t = { id: newTableId(), key: uniqueTableKey(name, tables), name, fields: [] };
        patchModel([...tables, t]);
        setSelectedId(t.id);
    };

    const renameSelected = (nextTable) => {
        patchModel(tables.map((t) => (t.id === nextTable.id ? nextTable : t)));
    };

    // A connector that fills this table would be left pointing at nothing, which
    // the model validator rejects — so say which connector, here, instead of
    // failing the whole save with a 422 after the fact.
    const fillersOf = (tableId) => (model?.connectors || []).filter((c) => c?.sync
        && (c.sync.tableId === tableId
            || (c.sync.children || []).some((child) => child?.tableId === tableId)));

    const deleteTable = () => {
        const id = confirmDeleteId;
        setConfirmDeleteId(null);
        if (!id) return;
        const fillers = fillersOf(id);
        if (fillers.length) {
            setActiveTab('connectors');
            toast.error(`“${fillers[0].name || 'A connector'}” fills this table. Stop it filling the table first, then delete it.`);
            return;
        }
        const next = tables.filter((t) => t.id !== id);
        patchModel(next);
        if (selectedId === id) setSelectedId(next[0]?.id || null);
    };

    const save = async () => {
        if (!appId || !model) return false;
        // A half-finished connector fails the WHOLE save server-side (422), so
        // say which one and what it needs instead of letting that happen.
        for (const c of model.connectors || []) {
            const problem = connectorProblem(c);
            if (problem) {
                setActiveTab('connectors');
                toast.error(`“${c.name || 'This connector'}” ${problem}.`);
                return false;
            }
        }
        const sent = model;
        setSaving(true);
        try {
            const res = await studioAppsApi.saveSchema(appId, sent, modelVersion || undefined);
            if (res.ok) {
                setModelVersion(res.version ?? modelVersion);
                setSavedSnapshot(JSON.stringify(sent));
                toast.success('Data model saved.');
                refetchSaved();
                return true;
            } else if (res.conflict) {
                toast.error('The data model changed elsewhere — reloading the latest.');
                load();
            } else if (res.invalid) {
                const first = Array.isArray(res.errors) && res.errors.length ? res.errors[0] : null;
                toast.error((typeof first === 'string' ? first : first?.message) || 'The data model is invalid.');
            }
        } catch (err) {
            toast.error(err?.message || 'Saving the data model failed.');
        } finally {
            setSaving(false);
        }
        return false;
    };

    // Drop a generated form/grid onto the current screen (one history commit).
    // The modal closes afterwards, so any unsaved table edits are persisted
    // FIRST — and the form/grid is then built from what was actually saved.
    const generate = async (kind) => {
        if (!definition || !selected) return;
        const wasDirty = dirty;
        if (wasDirty && !(await save())) return;
        const tableMeta = wasDirty ? selected : (savedById.get(selected.id) || selected);
        const taken = collectIds(definition);
        const built = kind === 'form'
            ? buildFormForTable(tableMeta, { taken })
            : buildGridForTable(tableMeta, { taken });

        let def = definition;
        if (built.actions) def = { ...def, actions: { ...(def.actions || {}), ...built.actions } };
        const screen = findScreen(def, screenId) || def.screens?.[0] || null;
        const sectionId = screen?.sections?.[0]?.id;
        if (!sectionId) { toast.error('Add a section to the screen first.'); return; }

        const res = insertNode(def, { parentId: sectionId, node: built.node });
        if (!res.nodeId) return;
        onCommit?.(res.def);
        dispatch?.({ type: 'select_node', nodeId: res.nodeId });
        dispatch?.({ type: 'set_recent_ids', ids: [res.nodeId] });
        toast.success(kind === 'form' ? 'Form added to the screen.' : 'Grid added to the screen.');
        onClose?.();
    };

    const deletingTable = tables.find((t) => t.id === confirmDeleteId) || null;

    return (
        <Modal
            open={open}
            onClose={() => !saving && onClose?.()}
            title="Tables"
            description="Design the data behind your app, then drop a form or grid onto the current screen."
            // 'full', not 'xl'. This dialog holds a table list, a field
            // designer, a rows grid and the connector editor side by side —
            // max-w-4xl gave the designer about 616px of usable width, so every
            // one of those was scrolling inside a column.
            size="full"
            footer={(
                <>
                    <button
                        type="button"
                        onClick={() => onClose?.()}
                        disabled={saving}
                        className="rounded-lg bg-white/5 px-4 py-2 text-sm hover:bg-[var(--bg-card-hover)] disabled:opacity-50"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving || !dirty}
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                        Save changes
                    </button>
                </>
            )}
        >
            {loading || !model ? (
                <div className="flex items-center gap-2 py-10 text-sm justify-center" style={{ color: 'var(--text-tertiary)' }}>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Loading tables…
                </div>
            ) : (
              <>
                {/* Tabs: Tables ↔ Rows ↔ Relationships ↔ Connectors — all over the one model. */}
                <div className="mb-3 flex items-center gap-1 border-b" style={{ borderColor: 'var(--border-default)' }}>
                    {[
                        { id: 'tables', label: 'Tables', Icon: Table2 },
                        {
                            id: 'rows',
                            label: 'Rows',
                            Icon: Rows3,
                            disabled: !selectedSaved,
                            title: 'Save the table first — until then there is nowhere to keep its rows.',
                        },
                        { id: 'relations', label: 'Relationships', Icon: Share2 },
                        { id: 'connectors', label: 'Connectors', Icon: Plug },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            disabled={tab.disabled}
                            title={tab.disabled ? tab.title : undefined}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm -mb-px border-b-2 ${tab.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                            style={{
                                borderColor: activeTab === tab.id ? 'var(--accent-primary)' : 'transparent',
                                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                fontWeight: activeTab === tab.id ? 600 : 400,
                            }}
                            aria-current={activeTab === tab.id ? 'page' : undefined}
                        >
                            <tab.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                            {tab.label}
                        </button>
                    ))}
                    {selected && !selectedSaved ? (
                        <span className="ml-auto pr-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            Save the table to start adding rows.
                        </span>
                    ) : null}
                </div>

                {activeTab === 'relations' ? (
                    <Suspense fallback={(
                        <div className="flex items-center gap-2 py-10 text-sm justify-center" style={{ color: 'var(--text-tertiary)' }}>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Loading the map…
                        </div>
                    )}>
                        <RelationshipsTab
                            tables={tables}
                            connectors={model.connectors}
                            onChange={patchModel}
                            onOpenTable={(id) => { setSelectedId(id); setActiveTab('tables'); }}
                            disabled={saving}
                        />
                    </Suspense>
                ) : activeTab === 'connectors' ? (
                    <ConnectorsManager
                        connectors={model.connectors}
                        onChange={patchConnectors}
                        disabled={saving}
                        appId={appId}
                        tables={tables}
                        onCreateTable={createTableForConnector}
                        // /inspect, /sync and "Test it" all read the LAST SAVED
                        // model. Rather than going grey until the draft is clean,
                        // the read-only ones save first (see bi/saveGate.js) —
                        // hence onSave alongside `saved`.
                        saved={!dirty}
                        onSave={save}
                    />
                ) : (
                <div className="flex gap-4 min-h-[22rem]">
                    {/* Table list */}
                    <div className="w-56 shrink-0 border-r pr-3 flex flex-col gap-1" style={{ borderColor: 'var(--border-default)' }}>
                        {tables.length === 0 ? (
                            <p className="px-1 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                No tables yet. Add one to store records.
                            </p>
                        ) : tables.map((t) => (
                            <div key={t.id} className="group flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setSelectedId(t.id)}
                                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                                    style={{
                                        background: t.id === selectedId ? 'var(--bg-tertiary)' : 'transparent',
                                        color: 'var(--text-primary)',
                                    }}
                                >
                                    <Table2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} aria-hidden="true" />
                                    <span className="truncate">{t.name || t.key}</span>
                                    {!savedIds.has(t.id) ? (
                                        <span className="ml-auto text-[9px] uppercase tracking-wide" style={{ color: 'var(--accent-primary)' }}>New</span>
                                    ) : null}
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Delete ${t.name || t.key}`}
                                    onClick={() => setConfirmDeleteId(t.id)}
                                    // Always visible. A destructive action hidden behind hover is
                                    // unreachable by keyboard and by touch, and it is only ever
                                    // FOUND by hovering something you were not trying to delete.
                                    // Muted until hover instead — discoverable, not shouty.
                                    className="p-1 rounded opacity-60 hover:opacity-100 focus-visible:opacity-100 hover:bg-[var(--bg-card-hover)] transition-opacity"
                                    style={{ color: 'var(--error)' }}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addTable}
                            className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-xs"
                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                        >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            New table
                        </button>
                    </div>

                    {/* Designer + generators, or the selected table's rows */}
                    <div className="min-w-0 flex-1">
                        {activeTab === 'rows' && selectedSaved ? (
                            <RowsTab
                                key={selectedSaved.id}
                                appId={appId}
                                table={selectedSaved}
                                tables={savedTables}
                                fieldsUnsaved={fieldsUnsaved}
                            />
                        ) : selected ? (
                            <div className="flex flex-col gap-4">
                                <TableDesigner
                                    table={selected}
                                    tables={tables}
                                    savedTable={savedById.get(selected.id) || null}
                                    onChange={renameSelected}
                                    disabled={saving}
                                />

                                <div
                                    className="rounded-lg border p-3"
                                    style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}
                                >
                                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                        <Database className="h-3.5 w-3.5" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                                        Add to this screen
                                    </div>
                                    {savedIds.has(selected.id) ? (
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => generate('form')}
                                                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-tertiary)]"
                                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            >
                                                <FileInput className="h-3.5 w-3.5" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                                                Make a form
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => generate('grid')}
                                                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-tertiary)]"
                                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            >
                                                <Table2 className="h-3.5 w-3.5" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                                                Make a grid
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                                Save this table first, then you can drop a form or a list onto the screen.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={save}
                                                disabled={saving || !dirty}
                                                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
                                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            >
                                                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                                                Save now
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                                Pick a table on the left, or add one to get started.
                                <button
                                    type="button"
                                    onClick={addTable}
                                    className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-tertiary)]"
                                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                >
                                    <Plus className="h-3.5 w-3.5" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                                    Add a table
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                )}
              </>
            )}

            <ConfirmDialog
                open={!!confirmDeleteId}
                title={`Delete “${deletingTable?.name || 'this table'}”?`}
                description="Removing the table deletes it (and its records) when you save. This can't be undone."
                confirmLabel="Delete table"
                destructive
                onConfirm={deleteTable}
                onCancel={() => setConfirmDeleteId(null)}
            />
        </Modal>
    );
}
