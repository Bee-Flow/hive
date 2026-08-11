import { AlertTriangle, ClipboardPaste, Loader2, Plus, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PasteImportPanel from './PasteImportPanel';
import { PAGE_SIZE, createRecord, deleteRecord, listRecords, updateRecord } from './recordsApi';
import RowCellEditor from './RowCellEditor';
import { cellText } from './rowValues';
import { importableFields } from './spreadsheetPaste';
import ConfirmDialog from '../../../../shared/ConfirmDialog';
import toast from '../../../../shared/Toast';

/**
 * App Studio — the rows of ONE saved table: read them, type them, paste them.
 *
 * Reads and writes go through recordsApi, i.e. the same record endpoints the
 * running app uses, so what shows here is what a viewer's grid would show
 * (minus their access filter — this is the owner's own view). The table must
 * already exist server-side: a table that has never been saved has no storage
 * behind it, which is why TablesManager only opens this tab for a saved one.
 *
 * A cell edits in place and saves on its own (PATCH of that one column); a new
 * row is typed as a DRAFT row and only sent when it is confirmed, so a table
 * with required columns doesn't reject a half-typed row before the user has
 * reached the second one.
 */

export default function RowsTab({ appId, table, tables = [], fieldsUnsaved = false }) {
    const fields = useMemo(() => importableFields(table?.fields), [table]);
    const columns = useMemo(
        () => (Array.isArray(table?.fields) ? table.fields : []).filter((f) => f && f.key),
        [table],
    );

    const [rows, setRows] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [editing, setEditing] = useState(null); // { rowId, key }
    const [savingId, setSavingId] = useState(null);
    const [draft, setDraft] = useState(null);
    const [draftError, setDraftError] = useState(null);
    const [savingDraft, setSavingDraft] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [pasting, setPasting] = useState(false);
    const [relationRows, setRelationRows] = useState({});

    const tableId = table?.id || null;

    const load = useCallback(async () => {
        if (!appId || !tableId) return;
        setLoading(true);
        setError(null);
        try {
            const page = await listRecords(appId, tableId, { limit: PAGE_SIZE });
            setRows(page.records);
            setCursor(page.nextCursor);
        } catch (err) {
            setError(err?.message || 'The rows could not be loaded.');
        } finally {
            setLoading(false);
        }
    }, [appId, tableId]);

    useEffect(() => {
        setDraft(null);
        setEditing(null);
        load();
    }, [load]);

    // Relation cells choose a row of the table they point at, so their choices
    // are that table's rows — one capped page per target, fetched once.
    useEffect(() => {
        const targets = [...new Set(fields.filter((f) => f.type === 'relation' && f.relation?.table).map((f) => f.relation.table))];
        if (!appId || targets.length === 0) return undefined;
        let cancelled = false;
        (async () => {
            for (const target of targets) {
                let page = { records: [] };
                try { page = await listRecords(appId, target, { limit: PAGE_SIZE }); } catch { /* an unreadable target just offers nothing */ }
                if (cancelled) return;
                setRelationRows((cur) => (cur[target] ? cur : { ...cur, [target]: page.records }));
            }
        })();
        return () => { cancelled = true; };
    }, [appId, fields]);

    const saveCell = async (row, field, value) => {
        setEditing(null);
        if (row[field.key] === value) return;
        setSavingId(row.id);
        try {
            // Compare-and-set on the row we actually looked at: two people in
            // this table at once used to overwrite each other with no trace.
            const res = await updateRecord(appId, tableId, row.id, { [field.key]: value }, {
                expectedUpdatedAt: row.updated_at || null,
            });
            const saved = res?.record;
            setRows((cur) => cur.map((r) => (r.id === row.id ? (saved || { ...r, [field.key]: value }) : r)));
        } catch (err) {
            if (err?.code === 'record_conflict' && err.body?.record) {
                // Show them what won rather than their lost edit, and say so.
                const current = err.body.record;
                setRows((cur) => cur.map((r) => (r.id === row.id ? current : r)));
                toast.error('Someone else changed this row — it has been refreshed with their version.');
            } else {
                toast.error(err?.message || 'That change could not be saved.');
            }
        } finally {
            setSavingId(null);
        }
    };

    const saveDraft = async () => {
        setSavingDraft(true);
        setDraftError(null);
        try {
            const res = await createRecord(appId, tableId, draft || {});
            if (res?.record) setRows((cur) => [...cur, res.record]);
            else await load();
            setDraft(null);
        } catch (err) {
            setDraftError(err?.message || 'That row could not be added.');
        } finally {
            setSavingDraft(false);
        }
    };

    const removeRow = async () => {
        const id = confirmDeleteId;
        setConfirmDeleteId(null);
        if (!id) return;
        try {
            await deleteRecord(appId, tableId, id);
            setRows((cur) => cur.filter((r) => r.id !== id));
        } catch (err) {
            toast.error(err?.message || 'That row could not be deleted.');
        }
    };

    const loadMore = async () => {
        if (!cursor) return;
        setLoadingMore(true);
        try {
            const page = await listRecords(appId, tableId, { limit: PAGE_SIZE, cursor });
            setRows((cur) => [...cur, ...page.records]);
            setCursor(page.nextCursor);
        } catch (err) {
            toast.error(err?.message || 'The next rows could not be loaded.');
        } finally {
            setLoadingMore(false);
        }
    };

    const tableFor = (fieldRef) => (tables || []).find((t) => t.id === fieldRef || t.key === fieldRef) || null;

    const addButton = () => (
        <button
            type="button"
            onClick={() => { setDraft({}); setDraftError(null); }}
            disabled={!!draft || columns.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
        >
            <Plus className="h-3.5 w-3.5" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
            Add a row
        </button>
    );

    const pasteButton = () => (
        <button
            type="button"
            onClick={() => setPasting(true)}
            disabled={columns.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
        >
            <ClipboardPaste className="h-3.5 w-3.5" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
            Paste from a spreadsheet
        </button>
    );

    if (pasting) {
        return (
            <PasteImportPanel
                table={table}
                onCreate={(values) => createRecord(appId, tableId, values)}
                onImported={(created) => { if (created.length) setRows((cur) => [...cur, ...created]); }}
                onClose={() => setPasting(false)}
            />
        );
    }

    if (columns.length === 0) {
        return (
            <p className="py-10 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
                This table has no columns yet — add a few on the Tables tab first, then come back to fill them in.
            </p>
        );
    }

    const cellFor = (row, field) => {
        const isEditing = editing && editing.rowId === row.id && editing.key === field.key;
        if (field.type === 'computed') {
            return (
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }} title="Worked out automatically">
                    {cellText(row[field.key], field)}
                </span>
            );
        }
        if (field.type === 'bool') {
            return (
                <RowCellEditor
                    field={field}
                    value={row[field.key]}
                    disabled={savingId === row.id}
                    onCommit={(v) => saveCell(row, field, v)}
                />
            );
        }
        if (isEditing) {
            return (
                <RowCellEditor
                    field={field}
                    value={row[field.key]}
                    autoFocus
                    disabled={savingId === row.id}
                    relationRows={field.relation?.table ? relationRows[field.relation.table] : null}
                    relationTable={field.relation?.table ? tableFor(field.relation.table) : null}
                    onCommit={(v) => saveCell(row, field, v)}
                    onCancel={() => setEditing(null)}
                />
            );
        }
        return (
            <button
                type="button"
                onClick={() => setEditing({ rowId: row.id, key: field.key })}
                className="w-full truncate rounded-md px-1 py-1 text-left text-sm hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--text-primary)' }}
                aria-label={`${field.name || field.key} — click to change`}
            >
                {cellText(row[field.key], field)}
            </button>
        );
    };

    return (
        <div className="flex min-h-[22rem] flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {loading ? 'Loading rows…' : `${rows.length} row${rows.length === 1 ? '' : 's'}${cursor ? ' so far' : ''} in ${table?.name || table?.key}`}
                </span>
                <div className="ml-auto flex items-center gap-2">
                    {addButton()}
                    {pasteButton()}
                </div>
            </div>

            {fieldsUnsaved ? (
                <p
                    className="flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-xs"
                    style={{ borderColor: 'rgba(217, 119, 6, 0.4)', background: 'rgba(217, 119, 6, 0.1)', color: '#d97706' }}
                >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>You changed the columns but haven’t saved yet — these rows still show the saved ones. Save the table to see the change here.</span>
                </p>
            ) : null}

            {error ? (
                <div className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={load}
                        className="rounded-md border px-2 py-0.5"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    >
                        Try again
                    </button>
                </div>
            ) : null}

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Loading rows…
                </div>
            ) : rows.length === 0 && !draft && !error ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center" style={{ borderColor: 'var(--border-default)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No rows yet.</p>
                    <p className="max-w-sm text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        Type the first one here, or paste a block straight out of Excel or Google Sheets — you pick which column goes where.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {addButton()}
                        {pasteButton()}
                    </div>
                </div>
            ) : (
                <div className="w-full overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr>
                                {columns.map((f) => (
                                    <th
                                        key={f.key}
                                        scope="col"
                                        className="border-b px-2 py-1.5 text-left text-xs font-medium"
                                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                                    >
                                        {f.name || f.key}
                                        {f.required ? <span aria-hidden="true" style={{ color: 'var(--error)' }}> *</span> : null}
                                    </th>
                                ))}
                                <th className="border-b px-2 py-1.5" style={{ borderColor: 'var(--border-default)' }} aria-label="Row actions" />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, index) => (
                                <tr key={row.id}>
                                    {columns.map((f) => (
                                        <td key={f.key} className="border-b px-2 py-1 align-top" style={{ borderColor: 'var(--border-default)' }}>
                                            {cellFor(row, f)}
                                        </td>
                                    ))}
                                    <td className="border-b px-2 py-1 align-middle" style={{ borderColor: 'var(--border-default)' }}>
                                        <button
                                            type="button"
                                            aria-label={`Delete row ${index + 1}`}
                                            onClick={() => setConfirmDeleteId(row.id)}
                                            className="rounded p-1 hover:bg-[var(--bg-card-hover)]"
                                            style={{ color: 'var(--error)' }}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {draft ? (
                                <tr>
                                    {columns.map((f) => (
                                        <td key={f.key} className="border-b px-2 py-1 align-top" style={{ borderColor: 'var(--border-default)' }}>
                                            {f.type === 'computed' ? (
                                                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Worked out later</span>
                                            ) : (
                                                <RowCellEditor
                                                    field={f}
                                                    value={draft[f.key] ?? null}
                                                    live
                                                    disabled={savingDraft}
                                                    relationRows={f.relation?.table ? relationRows[f.relation.table] : null}
                                                    relationTable={f.relation?.table ? tableFor(f.relation.table) : null}
                                                    onCommit={(v) => setDraft((d) => ({ ...(d || {}), [f.key]: v }))}
                                                />
                                            )}
                                        </td>
                                    ))}
                                    <td className="border-b px-2 py-1 align-middle" style={{ borderColor: 'var(--border-default)' }}>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={saveDraft}
                                                disabled={savingDraft}
                                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                                                style={{ background: 'var(--accent-primary)' }}
                                            >
                                                {savingDraft ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
                                                Add
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setDraft(null); setDraftError(null); }}
                                                disabled={savingDraft}
                                                className="rounded-md border px-2 py-1 text-xs disabled:opacity-50"
                                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            )}

            {draftError ? (
                <p className="text-xs" role="alert" style={{ color: 'var(--error)' }}>{draftError}</p>
            ) : null}

            {cursor && !loading ? (
                <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="self-center inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs disabled:opacity-50"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                    {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                    Show more rows
                </button>
            ) : null}

            <ConfirmDialog
                open={!!confirmDeleteId}
                title="Delete this row?"
                description="The row is removed straight away. This can’t be undone."
                confirmLabel="Delete row"
                destructive
                onConfirm={removeRow}
                onCancel={() => setConfirmDeleteId(null)}
            />
        </div>
    );
}
