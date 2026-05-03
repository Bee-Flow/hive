import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Database, Table2, Play, RefreshCw, Plus, Trash2, AlertTriangle,
    ChevronLeft, ChevronRight, Loader2, KeyRound, X,
} from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

/**
 * WebpageDbViewer — three-tab UI on top of the per-webpage SQLite DB.
 *
 *   Schema  list tables + their columns (click + new-table form)
 *   Browse  pick a table, page through rows, edit/insert/delete
 *   SQL     free-form editor; auto-routes SELECT → /db/query, else → /db/exec
 *
 * Endpoints (server/routes/webpages.js):
 *   GET    /api/webpages/:id/db/schema
 *   POST   /api/webpages/:id/db/query  { sql, params? }
 *   POST   /api/webpages/:id/db/exec   { sql, params? }
 *   DELETE /api/webpages/:id/db
 */

const PAGE_SIZE = 50;

function quoteIdent(name) {
    // SQLite identifier — double-quotes; embedded quotes become two double-quotes.
    return `"${String(name).replace(/"/g, '""')}"`;
}

function formatCell(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
}

function api(webpageId, path, opts = {}) {
    const url = `${API_BASE}/api/webpages/${webpageId}${path}`;
    const headers = opts.body ? { 'Content-Type': 'application/json', ...opts.headers } : opts.headers;
    return authFetch(url, { ...opts, headers });
}

// ─── Schema tab ─────────────────────────────────────────────────────

function SchemaTab({ webpageId, schema, onRefresh, busy, onError }) {
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const [cols, setCols] = useState([{ name: 'id', type: 'INTEGER', pk: true, notnull: true }]);
    const [submitting, setSubmitting] = useState(false);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        if (!selected && schema?.tables?.length) setSelected(schema.tables[0].name);
    }, [schema, selected]);

    const addCol = () => setCols(cs => [...cs, { name: '', type: 'TEXT', pk: false, notnull: false }]);
    const updateCol = (i, patch) => setCols(cs => cs.map((c, idx) => idx === i ? { ...c, ...patch } : c));
    const removeCol = (i) => setCols(cs => cs.filter((_, idx) => idx !== i));

    const handleCreate = async () => {
        if (!name.trim()) return;
        const validCols = cols.filter(c => c.name.trim());
        if (validCols.length === 0) { onError('Add at least one column'); return; }
        const colSql = validCols.map(c => {
            let s = `${quoteIdent(c.name.trim())} ${c.type || 'TEXT'}`;
            if (c.pk) s += ' PRIMARY KEY';
            if (c.notnull && !c.pk) s += ' NOT NULL';
            return s;
        }).join(', ');
        const sql = `CREATE TABLE ${quoteIdent(name.trim())} (${colSql});`;
        setSubmitting(true);
        try {
            const r = await api(webpageId, '/db/exec', { method: 'POST', body: JSON.stringify({ sql }) });
            if (!r.ok) { onError((await r.json().catch(() => ({}))).error || 'Failed to create table'); return; }
            setCreating(false);
            setName('');
            setCols([{ name: 'id', type: 'INTEGER', pk: true, notnull: true }]);
            onRefresh();
        } catch (e) {
            onError(e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDropTable = async (tname) => {
        if (!confirm(`Drop table "${tname}"? This cannot be undone.`)) return;
        try {
            const r = await api(webpageId, '/db/exec', { method: 'POST', body: JSON.stringify({ sql: `DROP TABLE ${quoteIdent(tname)};` }) });
            if (!r.ok) { onError((await r.json().catch(() => ({}))).error || 'Drop failed'); return; }
            if (selected === tname) setSelected(null);
            onRefresh();
        } catch (e) {
            onError(e.message);
        }
    };

    const tables = schema?.tables || [];
    const sel = tables.find(t => t.name === selected);

    return (
        <div className="flex h-full" style={{ color: 'var(--vsc-fg)' }}>
            {/* Left: table list */}
            <div className="shrink-0 border-r overflow-y-auto" style={{ width: 220, borderColor: 'var(--vsc-border)' }}>
                <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--vsc-border)' }}>
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--vsc-fg-muted)' }}>Tables ({tables.length})</span>
                    <button
                        onClick={() => setCreating(c => !c)}
                        title="New table"
                        className="p-1 rounded hover:bg-[var(--vsc-hover-bg)]"
                    >
                        <Plus size={14} />
                    </button>
                </div>
                {busy ? (
                    <div className="flex items-center justify-center py-6"><Loader2 size={14} className="animate-spin" /></div>
                ) : tables.length === 0 ? (
                    <div className="px-3 py-6 text-[11px]" style={{ color: 'var(--vsc-fg-muted)' }}>
                        No tables yet — click + to create one, or use the SQL tab for a custom CREATE.
                    </div>
                ) : (
                    tables.map(t => (
                        <button
                            key={t.name}
                            onClick={() => setSelected(t.name)}
                            className="flex items-center gap-1.5 w-full px-3 py-1.5 text-left text-[12px]"
                            style={{
                                background: selected === t.name ? 'var(--vsc-tab-active-bg)' : 'transparent',
                                color: selected === t.name ? 'var(--vsc-fg)' : 'var(--vsc-fg-muted)',
                                borderLeft: selected === t.name ? '2px solid var(--vsc-accent)' : '2px solid transparent',
                            }}
                        >
                            <Table2 size={12} />
                            <span className="flex-1 truncate">{t.name}</span>
                            <span className="text-[10px]" style={{ opacity: 0.6 }}>{t.columns.length} col</span>
                        </button>
                    ))
                )}
            </div>

            {/* Right: details / new-table form */}
            <div className="flex-1 overflow-y-auto p-4">
                {creating ? (
                    <div className="max-w-xl">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold">New table</h3>
                            <button onClick={() => setCreating(false)} className="p-1 rounded hover:bg-[var(--vsc-hover-bg)]"><X size={14} /></button>
                        </div>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="table_name"
                            className="w-full px-2 py-1.5 mb-3 text-[12px] rounded border outline-none"
                            style={{ borderColor: 'var(--vsc-border)', background: 'var(--vsc-editor-bg)', color: 'var(--vsc-fg)' }}
                        />
                        <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--vsc-fg-muted)' }}>Columns</div>
                        <div className="space-y-1.5 mb-3">
                            {cols.map((c, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                    <input
                                        value={c.name}
                                        onChange={e => updateCol(i, { name: e.target.value })}
                                        placeholder="name"
                                        className="flex-1 px-2 py-1 text-[12px] rounded border outline-none"
                                        style={{ borderColor: 'var(--vsc-border)', background: 'var(--vsc-editor-bg)', color: 'var(--vsc-fg)' }}
                                    />
                                    <select
                                        value={c.type}
                                        onChange={e => updateCol(i, { type: e.target.value })}
                                        className="px-2 py-1 text-[12px] rounded border outline-none"
                                        style={{ borderColor: 'var(--vsc-border)', background: 'var(--vsc-editor-bg)', color: 'var(--vsc-fg)' }}
                                    >
                                        <option>INTEGER</option>
                                        <option>TEXT</option>
                                        <option>REAL</option>
                                        <option>BLOB</option>
                                        <option>NUMERIC</option>
                                    </select>
                                    <label className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--vsc-fg-muted)' }}>
                                        <input type="checkbox" checked={!!c.pk} onChange={e => updateCol(i, { pk: e.target.checked })} /> PK
                                    </label>
                                    <label className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--vsc-fg-muted)' }}>
                                        <input type="checkbox" checked={!!c.notnull} onChange={e => updateCol(i, { notnull: e.target.checked })} /> NOT NULL
                                    </label>
                                    <button onClick={() => removeCol(i)} className="p-1 rounded hover:bg-[var(--vsc-hover-bg)]" title="Remove"><Trash2 size={12} /></button>
                                </div>
                            ))}
                        </div>
                        <button onClick={addCol} className="text-[11px] mb-3" style={{ color: 'var(--vsc-accent)' }}>+ Add column</button>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCreate}
                                disabled={submitting || !name.trim()}
                                className="px-3 py-1.5 rounded text-[12px] font-medium disabled:opacity-50"
                                style={{ background: 'var(--vsc-accent)', color: '#fff' }}
                            >
                                {submitting ? 'Creating…' : 'Create'}
                            </button>
                            <button onClick={() => setCreating(false)} className="px-3 py-1.5 rounded text-[12px]" style={{ color: 'var(--vsc-fg-muted)' }}>Cancel</button>
                        </div>
                    </div>
                ) : sel ? (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Table2 size={14} /> {sel.name}
                            </h3>
                            <button
                                onClick={() => handleDropTable(sel.name)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] hover:bg-[var(--vsc-hover-bg)]"
                                style={{ color: '#ef4444' }}
                                title="Drop table"
                            >
                                <Trash2 size={12} /> Drop
                            </button>
                        </div>
                        <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ color: 'var(--vsc-fg-muted)', borderBottom: '1px solid var(--vsc-border)' }}>
                                    <th className="text-left py-1.5 pr-3 font-medium">Column</th>
                                    <th className="text-left py-1.5 pr-3 font-medium">Type</th>
                                    <th className="text-left py-1.5 pr-3 font-medium">PK</th>
                                    <th className="text-left py-1.5 pr-3 font-medium">Not Null</th>
                                    <th className="text-left py-1.5 pr-3 font-medium">Default</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sel.columns.map(c => (
                                    <tr key={c.name} style={{ borderBottom: '1px solid var(--vsc-border)' }}>
                                        <td className="py-1.5 pr-3 font-mono">
                                            {c.primaryKey && <KeyRound size={11} className="inline mr-1" style={{ color: '#eab308' }} />}
                                            {c.name}
                                        </td>
                                        <td className="py-1.5 pr-3" style={{ color: 'var(--vsc-fg-muted)' }}>{c.type || '—'}</td>
                                        <td className="py-1.5 pr-3">{c.primaryKey ? '✓' : ''}</td>
                                        <td className="py-1.5 pr-3">{c.notNull ? '✓' : ''}</td>
                                        <td className="py-1.5 pr-3 font-mono" style={{ color: 'var(--vsc-fg-muted)' }}>{c.defaultValue ?? ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {sel.sql && (
                            <pre className="mt-4 p-2 rounded text-[11px] overflow-x-auto" style={{ background: 'var(--vsc-sidebar-bg)', color: 'var(--vsc-fg-muted)', border: '1px solid var(--vsc-border)' }}>{sel.sql}</pre>
                        )}
                    </div>
                ) : (
                    <div className="text-[12px]" style={{ color: 'var(--vsc-fg-muted)' }}>Select a table on the left, or click + to create one.</div>
                )}
            </div>
        </div>
    );
}

// ─── Browse tab ─────────────────────────────────────────────────────

function BrowseTab({ webpageId, schema, onError }) {
    const tables = schema?.tables || [];
    const [tableName, setTableName] = useState(null);
    const [page, setPage] = useState(0);
    const [rows, setRows] = useState([]);
    const [columns, setColumns] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState(null); // { rowidx, col, value }
    const [inserting, setInserting] = useState(false);
    const [insertValues, setInsertValues] = useState({});

    useEffect(() => {
        if (!tableName && tables.length) setTableName(tables[0].name);
    }, [tables, tableName]);

    const tableMeta = tables.find(t => t.name === tableName);

    const load = useCallback(async () => {
        if (!tableName) return;
        setLoading(true);
        try {
            const offset = page * PAGE_SIZE;
            const sql = `SELECT rowid, * FROM ${quoteIdent(tableName)} LIMIT ? OFFSET ?`;
            const r = await api(webpageId, '/db/query', { method: 'POST', body: JSON.stringify({ sql, params: [PAGE_SIZE, offset] }) });
            const data = await r.json();
            if (!r.ok) { onError(data.error || 'Query failed'); setRows([]); setColumns([]); setLoading(false); return; }
            setRows(data.rows || []);
            setColumns(data.columns || []);

            const cnt = await api(webpageId, '/db/query', { method: 'POST', body: JSON.stringify({ sql: `SELECT COUNT(*) AS n FROM ${quoteIdent(tableName)}` }) });
            const cdata = await cnt.json();
            if (cnt.ok) setTotal(cdata.rows?.[0]?.n ?? 0);
        } catch (e) {
            onError(e.message);
        } finally {
            setLoading(false);
        }
    }, [webpageId, tableName, page, onError]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(0); }, [tableName]);

    const dataColumns = columns.filter(c => c !== 'rowid');

    const startEdit = (rowidx, col, value) => {
        // Don't allow editing rowid itself.
        if (col === 'rowid') return;
        setEditing({ rowidx, col, value: value === null ? '' : formatCell(value), wasNull: value === null });
    };

    const commitEdit = async () => {
        if (!editing) return;
        const { rowidx, col, value, wasNull } = editing;
        const row = rows[rowidx];
        if (!row || row.rowid === undefined) {
            setEditing(null);
            return;
        }
        // Treat empty string as either '' (TEXT) or NULL: if originally NULL and unchanged, no-op.
        const newVal = value;
        if (wasNull && newVal === '') { setEditing(null); return; }
        try {
            const sql = `UPDATE ${quoteIdent(tableName)} SET ${quoteIdent(col)} = ? WHERE rowid = ?`;
            const r = await api(webpageId, '/db/exec', { method: 'POST', body: JSON.stringify({ sql, params: [newVal, row.rowid] }) });
            const data = await r.json();
            if (!r.ok) { onError(data.error || 'Update failed'); return; }
            setEditing(null);
            await load();
        } catch (e) {
            onError(e.message);
        }
    };

    const deleteRow = async (rowidx) => {
        const row = rows[rowidx];
        if (!row || row.rowid === undefined) return;
        if (!confirm(`Delete row rowid=${row.rowid}?`)) return;
        try {
            const sql = `DELETE FROM ${quoteIdent(tableName)} WHERE rowid = ?`;
            const r = await api(webpageId, '/db/exec', { method: 'POST', body: JSON.stringify({ sql, params: [row.rowid] }) });
            const data = await r.json();
            if (!r.ok) { onError(data.error || 'Delete failed'); return; }
            await load();
        } catch (e) {
            onError(e.message);
        }
    };

    const handleInsert = async () => {
        if (!tableMeta) return;
        const cols = tableMeta.columns;
        const values = cols.map(c => insertValues[c.name]);
        const colNames = cols.map(c => quoteIdent(c.name)).join(', ');
        const placeholders = cols.map(() => '?').join(', ');
        const sql = `INSERT INTO ${quoteIdent(tableName)} (${colNames}) VALUES (${placeholders})`;
        // Convert blank strings on integer/real columns to null so the user gets default behaviour.
        const params = cols.map((c, i) => {
            const v = values[i];
            if (v === undefined || v === '') return null;
            if (/^(INT|REAL|NUM)/i.test(c.type || '')) {
                const n = Number(v);
                return Number.isFinite(n) ? n : v;
            }
            return v;
        });
        try {
            const r = await api(webpageId, '/db/exec', { method: 'POST', body: JSON.stringify({ sql, params }) });
            const data = await r.json();
            if (!r.ok) { onError(data.error || 'Insert failed'); return; }
            setInserting(false);
            setInsertValues({});
            await load();
        } catch (e) {
            onError(e.message);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="flex flex-col h-full" style={{ color: 'var(--vsc-fg)' }}>
            <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0" style={{ borderColor: 'var(--vsc-border)' }}>
                <Table2 size={14} style={{ color: 'var(--vsc-fg-muted)' }} />
                <select
                    value={tableName || ''}
                    onChange={e => setTableName(e.target.value)}
                    className="px-2 py-1 text-[12px] rounded border outline-none"
                    style={{ borderColor: 'var(--vsc-border)', background: 'var(--vsc-editor-bg)', color: 'var(--vsc-fg)' }}
                >
                    {tables.length === 0 && <option value="">— no tables —</option>}
                    {tables.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
                <button onClick={load} className="p-1 rounded hover:bg-[var(--vsc-hover-bg)]" title="Refresh">
                    <RefreshCw size={13} />
                </button>
                <div className="flex-1" />
                <span className="text-[11px]" style={{ color: 'var(--vsc-fg-muted)' }}>
                    {total} row{total === 1 ? '' : 's'}
                </span>
                <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1 rounded hover:bg-[var(--vsc-hover-bg)] disabled:opacity-40"
                    title="Previous page"
                >
                    <ChevronLeft size={14} />
                </button>
                <span className="text-[11px]" style={{ color: 'var(--vsc-fg-muted)' }}>
                    {page + 1} / {totalPages}
                </span>
                <button
                    onClick={() => setPage(p => p + 1 < totalPages ? p + 1 : p)}
                    disabled={page + 1 >= totalPages}
                    className="p-1 rounded hover:bg-[var(--vsc-hover-bg)] disabled:opacity-40"
                    title="Next page"
                >
                    <ChevronRight size={14} />
                </button>
                <button
                    onClick={() => { setInserting(true); setInsertValues({}); }}
                    disabled={!tableMeta}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] disabled:opacity-50"
                    style={{ background: 'var(--vsc-accent)', color: '#fff' }}
                >
                    <Plus size={12} /> Insert row
                </button>
            </div>

            {inserting && tableMeta && (
                <div className="shrink-0 border-b p-3" style={{ borderColor: 'var(--vsc-border)', background: 'var(--vsc-sidebar-bg)' }}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--vsc-fg-muted)' }}>New row</span>
                        <button onClick={() => setInserting(false)} className="p-1 rounded hover:bg-[var(--vsc-hover-bg)]"><X size={12} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        {tableMeta.columns.map(c => (
                            <div key={c.name} className="flex flex-col">
                                <label className="text-[10px] mb-0.5" style={{ color: 'var(--vsc-fg-muted)' }}>
                                    {c.name} <span className="font-mono">{c.type}</span>{c.primaryKey ? ' · PK' : ''}{c.notNull ? ' · NOT NULL' : ''}
                                </label>
                                <input
                                    value={insertValues[c.name] ?? ''}
                                    onChange={e => setInsertValues(v => ({ ...v, [c.name]: e.target.value }))}
                                    placeholder={c.defaultValue ?? (c.notNull ? 'required' : 'NULL')}
                                    className="px-2 py-1 text-[12px] rounded border outline-none"
                                    style={{ borderColor: 'var(--vsc-border)', background: 'var(--vsc-editor-bg)', color: 'var(--vsc-fg)' }}
                                />
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={handleInsert}
                        className="px-3 py-1 rounded text-[12px] font-medium"
                        style={{ background: 'var(--vsc-accent)', color: '#fff' }}
                    >
                        Insert
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 size={16} className="animate-spin" /></div>
                ) : !tableName ? (
                    <div className="px-3 py-8 text-[12px]" style={{ color: 'var(--vsc-fg-muted)' }}>No table selected.</div>
                ) : rows.length === 0 ? (
                    <div className="px-3 py-8 text-[12px]" style={{ color: 'var(--vsc-fg-muted)' }}>Empty table.</div>
                ) : (
                    <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse', tableLayout: 'auto' }}>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--vsc-sidebar-bg)' }}>
                            <tr style={{ borderBottom: '1px solid var(--vsc-border)' }}>
                                <th className="text-left px-2 py-1.5 font-mono" style={{ color: 'var(--vsc-fg-muted)' }}>rowid</th>
                                {dataColumns.map(c => (
                                    <th key={c} className="text-left px-2 py-1.5 font-mono" style={{ color: 'var(--vsc-fg-muted)' }}>{c}</th>
                                ))}
                                <th style={{ width: 32 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, rowidx) => (
                                <tr key={row.rowid ?? rowidx} className="hover:bg-[var(--vsc-hover-bg)]" style={{ borderBottom: '1px solid var(--vsc-border)' }}>
                                    <td className="px-2 py-1 font-mono" style={{ color: 'var(--vsc-fg-muted)' }}>{row.rowid}</td>
                                    {dataColumns.map(c => {
                                        const isEditing = editing && editing.rowidx === rowidx && editing.col === c;
                                        const v = row[c];
                                        return (
                                            <td key={c} className="px-2 py-1 font-mono" onDoubleClick={() => startEdit(rowidx, c, v)} style={{ cursor: 'text' }}>
                                                {isEditing ? (
                                                    <input
                                                        autoFocus
                                                        value={editing.value}
                                                        onChange={e => setEditing(s => ({ ...s, value: e.target.value }))}
                                                        onBlur={commitEdit}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') commitEdit();
                                                            else if (e.key === 'Escape') setEditing(null);
                                                        }}
                                                        className="w-full px-1 py-0.5 text-[12px] rounded border outline-none"
                                                        style={{ borderColor: 'var(--vsc-accent)', background: 'var(--vsc-editor-bg)', color: 'var(--vsc-fg)' }}
                                                    />
                                                ) : v === null || v === undefined ? (
                                                    <span style={{ color: 'var(--vsc-fg-muted)', fontStyle: 'italic' }}>NULL</span>
                                                ) : (
                                                    <span className="block max-w-[400px] truncate" title={formatCell(v)}>{formatCell(v)}</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="px-1">
                                        <button
                                            onClick={() => deleteRow(rowidx)}
                                            className="p-1 rounded hover:bg-[var(--vsc-hover-bg)]"
                                            title="Delete row"
                                        >
                                            <Trash2 size={12} style={{ color: '#ef4444' }} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// ─── SQL tab ────────────────────────────────────────────────────────

function SqlTab({ webpageId, onError, onSchemaChanged }) {
    const [sql, setSql] = useState('SELECT name FROM sqlite_master WHERE type=\'table\' ORDER BY name;');
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    const [resetting, setResetting] = useState(false);

    const isSelect = useMemo(() => /^\s*(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(sql), [sql]);

    const run = async () => {
        if (!sql.trim()) return;
        setRunning(true);
        setResult(null);
        try {
            const path = isSelect ? '/db/query' : '/db/exec';
            const r = await api(webpageId, path, { method: 'POST', body: JSON.stringify({ sql }) });
            const data = await r.json();
            if (!r.ok) {
                setResult({ error: data.error || 'Query failed' });
            } else if (isSelect) {
                setResult({ kind: 'rows', rows: data.rows || [], columns: data.columns || [], truncated: !!data.truncated });
            } else {
                setResult({ kind: 'exec', changes: data.changes, lastInsertRowid: data.lastInsertRowid, multi: !!data.multi });
                    onSchemaChanged?.();
            }
        } catch (e) {
            setResult({ error: e.message });
        } finally {
            setRunning(false);
        }
    };

    const handleReset = async () => {
        if (!confirm('Reset the entire database? This deletes all tables and data and cannot be undone.')) return;
        setResetting(true);
        try {
            const r = await api(webpageId, '/db', { method: 'DELETE' });
            if (!r.ok) {
                onError((await r.json().catch(() => ({}))).error || 'Reset failed');
            } else {
                setResult({ kind: 'exec', changes: 0, lastInsertRowid: 0, multi: false, message: 'Database reset.' });
                    onSchemaChanged?.();
            }
        } catch (e) {
            onError(e.message);
        } finally {
            setResetting(false);
        }
    };

    return (
        <div className="flex flex-col h-full" style={{ color: 'var(--vsc-fg)' }}>
            <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0" style={{ borderColor: 'var(--vsc-border)' }}>
                <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--vsc-fg-muted)' }}>
                    {isSelect ? 'Read query' : 'Write / DDL'}
                </span>
                <div className="flex-1" />
                <button
                    onClick={run}
                    disabled={running || !sql.trim()}
                    className="flex items-center gap-1 px-3 py-1 rounded text-[12px] font-medium disabled:opacity-50"
                    style={{ background: 'var(--vsc-accent)', color: '#fff' }}
                >
                    {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Run
                </button>
            </div>
            <textarea
                value={sql}
                onChange={e => setSql(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(); }}
                spellCheck={false}
                className="shrink-0 w-full px-3 py-2 text-[12px] font-mono outline-none resize-none border-b"
                style={{ height: 140, borderColor: 'var(--vsc-border)', background: 'var(--vsc-editor-bg)', color: 'var(--vsc-fg)' }}
                placeholder="-- Cmd/Ctrl+Enter to run"
            />

            <div className="flex-1 overflow-auto">
                {!result ? (
                    <div className="px-3 py-3 text-[11px]" style={{ color: 'var(--vsc-fg-muted)' }}>
                        SELECT/WITH/PRAGMA → read query. Anything else (INSERT, CREATE, ALTER, …) → exec.
                    </div>
                ) : result.error ? (
                    <div className="m-3 px-3 py-2 rounded text-[12px]" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)' }}>
                        <AlertTriangle size={12} className="inline mr-1" /> {result.error}
                    </div>
                ) : result.kind === 'exec' ? (
                    <div className="m-3 px-3 py-2 rounded text-[12px]" style={{ background: 'var(--vsc-sidebar-bg)', border: '1px solid var(--vsc-border)' }}>
                        {result.message
                            ? result.message
                            : result.multi
                                ? 'Multi-statement script executed.'
                                : `OK — ${result.changes} row${result.changes === 1 ? '' : 's'} affected${result.lastInsertRowid ? `, lastInsertRowid=${result.lastInsertRowid}` : ''}.`}
                    </div>
                ) : (
                    <div className="text-[12px]">
                        <div className="px-3 py-1.5 text-[11px]" style={{ color: 'var(--vsc-fg-muted)' }}>
                            {result.rows.length} row{result.rows.length === 1 ? '' : 's'}{result.truncated ? ' (truncated at 10000)' : ''}
                        </div>
                        {result.rows.length > 0 ? (
                            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                                <thead style={{ position: 'sticky', top: 0, background: 'var(--vsc-sidebar-bg)' }}>
                                    <tr style={{ borderBottom: '1px solid var(--vsc-border)' }}>
                                        {result.columns.map(c => (
                                            <th key={c} className="text-left px-2 py-1 font-mono" style={{ color: 'var(--vsc-fg-muted)' }}>{c}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.rows.map((row, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--vsc-border)' }}>
                                            {result.columns.map(c => (
                                                <td key={c} className="px-2 py-1 font-mono">
                                                    {row[c] === null || row[c] === undefined
                                                        ? <span style={{ color: 'var(--vsc-fg-muted)', fontStyle: 'italic' }}>NULL</span>
                                                        : <span className="block max-w-[400px] truncate" title={formatCell(row[c])}>{formatCell(row[c])}</span>}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="px-3 py-3" style={{ color: 'var(--vsc-fg-muted)' }}>(no rows)</div>
                        )}
                    </div>
                )}
            </div>

            {/* Danger zone */}
            <div className="shrink-0 px-3 py-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--vsc-border)' }}>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--vsc-fg-muted)' }}>Danger zone</span>
                <button
                    onClick={handleReset}
                    disabled={resetting}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] hover:bg-[var(--vsc-hover-bg)] disabled:opacity-50"
                    style={{ color: '#ef4444' }}
                    title="Drop all tables (DELETE /db)"
                >
                    <Trash2 size={11} /> Reset database
                </button>
            </div>
        </div>
    );
}

// ─── Top-level viewer ───────────────────────────────────────────────

export default function WebpageDbViewer({ webpageId }) {
    const [tab, setTab] = useState('schema'); // 'schema' | 'browse' | 'sql'
    const [schema, setSchema] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const loadSchema = useCallback(async () => {
        if (!webpageId) return;
        setBusy(true);
        setError(null);
        try {
            const r = await api(webpageId, '/db/schema');
            const data = await r.json();
            if (!r.ok) {
                setError(data.error || 'Schema lookup failed');
                setSchema({ tables: [] });
            } else {
                setSchema(data);
            }
        } catch (e) {
            setError(e.message);
            setSchema({ tables: [] });
        } finally {
            setBusy(false);
        }
    }, [webpageId]);

    useEffect(() => { loadSchema(); }, [loadSchema]);

    // Listen for AI-driven DB updates broadcast over the chat SSE stream so the
    // viewer refreshes when the model mutates the DB mid-conversation.
    useEffect(() => {
        const onAiDbUpdate = () => loadSchema();
        window.addEventListener('webpage_db_update', onAiDbUpdate);
        return () => window.removeEventListener('webpage_db_update', onAiDbUpdate);
    }, [loadSchema]);

    const TABS = [
        { id: 'schema', label: 'Schema', Icon: Database },
        { id: 'browse', label: 'Browse', Icon: Table2 },
        { id: 'sql', label: 'SQL', Icon: Play },
    ];

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--vsc-editor-bg)', color: 'var(--vsc-fg)' }}>
            <div className="flex items-center shrink-0 border-b" style={{ borderColor: 'var(--vsc-border)', background: 'var(--vsc-sidebar-bg)' }}>
                {TABS.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[12px]"
                        style={{
                            background: tab === id ? 'var(--vsc-tab-active-bg)' : 'transparent',
                            color: tab === id ? 'var(--vsc-fg)' : 'var(--vsc-fg-muted)',
                            borderRight: '1px solid var(--vsc-border)',
                            borderTop: tab === id ? '2px solid var(--vsc-accent)' : '2px solid transparent',
                        }}
                    >
                        <Icon size={13} /> {label}
                    </button>
                ))}
                <div className="flex-1" />
                <button
                    onClick={loadSchema}
                    title="Refresh schema"
                    className="flex items-center gap-1 px-2 py-1 mr-2 rounded text-[11px] hover:bg-[var(--vsc-hover-bg)]"
                    style={{ color: 'var(--vsc-fg-muted)' }}
                >
                    <RefreshCw size={12} /> Refresh
                </button>
            </div>

            {error && (
                <div className="m-2 px-2 py-1 rounded text-[11px]" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)' }}>
                    {error}
                </div>
            )}

            <div className="flex-1 min-h-0">
                {tab === 'schema' && (
                    <SchemaTab webpageId={webpageId} schema={schema} onRefresh={loadSchema} busy={busy} onError={setError} />
                )}
                {tab === 'browse' && (
                    <BrowseTab webpageId={webpageId} schema={schema} onError={setError}  />
                )}
                {tab === 'sql' && (
                    <SqlTab webpageId={webpageId} onError={setError}  onSchemaChanged={loadSchema} />
                )}
            </div>
        </div>
    );
}
