import React, { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';
import { ArrowLeft, Plus, Trash2, Edit3, BarChart3, X, Play, Save, Table, Hash, TrendingUp, AlertCircle, Loader2, Database, Layers, Activity } from 'lucide-react';

// ── Visualization Components ────────────────────────────

const StatPanel = ({ data }) => {
    if (!data?.rows?.length) return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No data</div>;
    const value = Object.values(data.rows[0])[0];
    const label = data.columns?.[0]?.name || 'Value';
    return (
        <div className="flex flex-col items-center justify-center h-full gap-1">
            <span className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {typeof value === 'number' ? value.toLocaleString() : String(value ?? '—')}
            </span>
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
        </div>
    );
};

const TablePanel = ({ data }) => {
    if (!data?.columns?.length) return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No data</div>;
    return (
        <div className="h-full overflow-auto custom-scrollbar">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead>
                    <tr>{data.columns.map((col, i) => (
                        <th key={i} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider sticky top-0"
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-default)' }}>{col.name}</th>
                    ))}</tr>
                </thead>
                <tbody>{data.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                        {data.columns.map((col, j) => (
                            <td key={j} className="px-3 py-2" style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' }}>
                                {row[col.name] != null ? String(row[col.name]) : '—'}
                            </td>
                        ))}
                    </tr>
                ))}</tbody>
            </table>
        </div>
    );
};

const TimeSeriesPanel = ({ data }) => {
    if (!data?.rows?.length) return <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">No data</div>;
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container || !data.rows.length) return;
        const rect = container.getBoundingClientRect();
        const w = rect.width, h = rect.height;
        canvas.width = w * 2; canvas.height = h * 2;
        canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2); ctx.clearRect(0, 0, w, h);
        const valueCol = data.columns.find((_, i) => i > 0) || data.columns[0];
        const values = data.rows.map(r => parseFloat(r[valueCol.name]) || 0);
        const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
        const pad = { top: 20, right: 20, bottom: 30, left: 50 };
        const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
        ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (ch / 4) * i;
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
            ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'right';
            ctx.fillText((max - (range / 4) * i).toFixed(1), pad.left - 6, y + 3);
        }
        ctx.strokeStyle = '#6366f1'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
        values.forEach((v, i) => {
            const x = pad.left + (cw / Math.max(values.length - 1, 1)) * i;
            const y = pad.top + ch - ((v - min) / range) * ch;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.lineTo(pad.left + cw, pad.top + ch); ctx.lineTo(pad.left, pad.top + ch); ctx.closePath();
        const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.15)'); gradient.addColorStop(1, 'rgba(99, 102, 241, 0.01)');
        ctx.fillStyle = gradient; ctx.fill();
    }, [data]);
    return <div ref={containerRef} className="h-full w-full"><canvas ref={canvasRef} /></div>;
};

const VIZ_COMPONENTS = { stat: StatPanel, table: TablePanel, timeseries: TimeSeriesPanel };
const VIZ_TYPES = [
    { id: 'stat', label: 'Stat', icon: Hash, description: 'Single number' },
    { id: 'table', label: 'Table', icon: Table, description: 'Data table' },
    { id: 'timeseries', label: 'Time Series', icon: TrendingUp, description: 'Line chart' },
];

// ── Panel Card ──────────────────────────────────────────

const PanelCard = ({ panel, onEdit, onDelete }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const execute = useCallback(async () => {
        if (!panel.query) return;
        setLoading(true); setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/monitoring/panels/${panel.id}/execute`, { method: 'POST' });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Query failed');
            setData(result);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }, [panel.id, panel.query]);
    useEffect(() => { execute(); }, [execute]);
    const VizComponent = VIZ_COMPONENTS[panel.visualization_type] || StatPanel;
    return (
        <div className="rounded-xl border flex flex-col h-full" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{panel.title}</h3>
                <div className="flex items-center gap-1">
                    <button onClick={execute} className="p-1 rounded hover:bg-[var(--bg-tertiary)]" title="Refresh"><Play className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /></button>
                    <button onClick={() => onEdit(panel)} className="p-1 rounded hover:bg-[var(--bg-tertiary)]" title="Edit"><Edit3 className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /></button>
                    <button onClick={() => onDelete(panel.id)} className="p-1 rounded hover:bg-[var(--bg-tertiary)]" title="Delete"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                </div>
            </div>
            <div className="flex-1 p-3 min-h-[120px]">
                {loading ? <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
                    : error ? <div className="flex items-center justify-center h-full gap-2 text-sm text-red-400"><AlertCircle className="w-4 h-4" /><span className="truncate">{error}</span></div>
                        : !panel.query ? <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>Click edit to configure</div>
                            : <VizComponent data={data} />}
            </div>
        </div>
    );
};

// ── Panel Editor Modal ──────────────────────────────────

const PanelEditor = ({ panel, tables, onSave, onClose }) => {
    const [title, setTitle] = useState(panel?.title || 'New Panel');
    const [vizType, setVizType] = useState(panel?.visualization_type || 'stat');
    const [dataSource, setDataSource] = useState(panel?.data_source || 'app');
    const [query, setQuery] = useState(panel?.query || '');
    const [preview, setPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState(null);
    const [saving, setSaving] = useState(false);

    const runPreview = async () => {
        if (!query.trim()) return;
        setPreviewLoading(true); setPreviewError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/monitoring/query/preview`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: query, dataSource }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Query failed');
            setPreview(data);
        } catch (err) { setPreviewError(err.message); }
        finally { setPreviewLoading(false); }
    };

    const handleSave = async () => {
        setSaving(true);
        await onSave({ title, visualizationType: vizType, dataSource, query });
        setSaving(false);
    };

    const VizPreview = VIZ_COMPONENTS[vizType] || StatPanel;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="rounded-2xl border shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{panel?.id ? 'Edit Panel' : 'Add Panel'}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]"><X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Title */}
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Title</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border text-sm outline-none focus:border-[var(--accent-primary)]" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                    </div>

                    {/* Data Source selector */}
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Data Source</label>
                        <div className="flex gap-2">
                            <button onClick={() => setDataSource('app')}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${dataSource === 'app' ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'hover:bg-[var(--bg-tertiary)]'}`}
                                style={{ borderColor: dataSource === 'app' ? 'var(--accent-primary)' : 'var(--border-default)', color: dataSource === 'app' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                                <Database className="w-4 h-4" />Organisation Data
                            </button>
                            <button onClick={() => setDataSource('usage')}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${dataSource === 'usage' ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'hover:bg-[var(--bg-tertiary)]'}`}
                                style={{ borderColor: dataSource === 'usage' ? 'var(--accent-primary)' : 'var(--border-default)', color: dataSource === 'usage' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                                <Activity className="w-4 h-4" />AI Usage
                            </button>
                            {tables.filter(t => t.source === 'custom').length > 0 && (
                                <button onClick={() => setDataSource('custom')}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${dataSource === 'custom' ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'hover:bg-[var(--bg-tertiary)]'}`}
                                    style={{ borderColor: dataSource === 'custom' ? 'var(--accent-primary)' : 'var(--border-default)', color: dataSource === 'custom' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                                    <Layers className="w-4 h-4" />Custom Tables
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Available tables hint */}
                    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Available tables:</p>
                        <div className="flex flex-wrap gap-1.5">
                            {tables.filter(t => t.source === dataSource).map(t => (
                                <button key={t.name} onClick={() => setQuery(prev => prev ? prev : `SELECT * FROM ${t.name} LIMIT 10`)}
                                    className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
                                    style={{ background: 'var(--bg-primary)', color: 'var(--accent-primary)', border: '1px solid var(--border-default)' }}>
                                    {t.displayName}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Visualization Type */}
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Visualization</label>
                        <div className="flex gap-2">
                            {VIZ_TYPES.map(vt => (
                                <button key={vt.id} onClick={() => setVizType(vt.id)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${vizType === vt.id ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'hover:bg-[var(--bg-tertiary)]'}`}
                                    style={{ borderColor: vizType === vt.id ? 'var(--accent-primary)' : 'var(--border-default)', color: vizType === vt.id ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                                    <vt.icon className="w-4 h-4" />{vt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* SQL Query */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>SQL Query</label>
                            <button onClick={runPreview} disabled={!query.trim() || previewLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all disabled:opacity-50" style={{ background: 'var(--accent-primary)' }}>
                                <Play className="w-3 h-3" />Run Preview
                            </button>
                        </div>
                        <textarea value={query} onChange={e => setQuery(e.target.value)} rows={5}
                            placeholder={dataSource === 'app' ? "SELECT status, COUNT(*) as count FROM tasks GROUP BY status" : dataSource === 'usage' ? "SELECT model, COUNT(*) as calls FROM ai_usage_log GROUP BY model ORDER BY calls DESC" : "SELECT * FROM your_table LIMIT 10"}
                            className="w-full px-4 py-3 rounded-lg border text-sm outline-none focus:border-[var(--accent-primary)] font-mono resize-none"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                        {(dataSource === 'app' || dataSource === 'usage') && (
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Queries are automatically scoped to your organisation{dataSource === 'usage' ? ' (costs & tokens hidden)' : ''}</p>
                        )}
                    </div>

                    {/* Preview */}
                    {(preview || previewLoading || previewError) && (
                        <div>
                            <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-muted)' }}>Preview</label>
                            <div className="rounded-lg border h-48" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                                {previewLoading ? <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
                                    : previewError ? <div className="flex items-center justify-center h-full gap-2 text-sm text-red-400 px-4"><AlertCircle className="w-4 h-4 flex-shrink-0" />{previewError}</div>
                                        : <VizPreview data={preview} />}
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
                    <button onClick={handleSave} disabled={saving || !title.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50" style={{ background: 'var(--accent-primary)' }}>
                        <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save Panel'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Custom Table Modal ──────────────────────────────────

const CreateTableModal = ({ onClose, onCreated }) => {
    const [name, setName] = useState('');
    const [columns, setColumns] = useState([{ name: '', type: 'text' }]);
    const [saving, setSaving] = useState(false);

    const addCol = () => setColumns(prev => [...prev, { name: '', type: 'text' }]);
    const removeCol = (i) => setColumns(prev => prev.filter((_, j) => j !== i));
    const updateCol = (i, field, val) => setColumns(prev => prev.map((c, j) => j === i ? { ...c, [field]: val } : c));

    const save = async () => {
        const validCols = columns.filter(c => c.name.trim());
        if (!name.trim() || !validCols.length) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/api/monitoring/custom-tables`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName: name, columns: validCols }),
            });
            if (res.ok) { onCreated?.(); onClose(); }
        } catch (err) { console.error(err); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="rounded-2xl border shadow-2xl w-full max-w-lg" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}>
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Create Custom Table</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]"><X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Table name (e.g. Revenue, KPIs)"
                        className="w-full px-4 py-2.5 rounded-lg border text-sm outline-none focus:border-[var(--accent-primary)]"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                    <div>
                        <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Columns</label>
                        <div className="space-y-2">
                            {columns.map((col, i) => (
                                <div key={i} className="flex gap-2">
                                    <input value={col.name} onChange={e => updateCol(i, 'name', e.target.value)} placeholder="Column name"
                                        className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none focus:border-[var(--accent-primary)]"
                                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                    <select value={col.type} onChange={e => updateCol(i, 'type', e.target.value)}
                                        className="px-3 py-2 rounded-lg border text-sm outline-none"
                                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                                        <option value="text">Text</option>
                                        <option value="number">Number</option>
                                        <option value="date">Date</option>
                                        <option value="boolean">Boolean</option>
                                    </select>
                                    {columns.length > 1 && (
                                        <button onClick={() => removeCol(i)} className="p-2 rounded hover:bg-[var(--bg-tertiary)]"><X className="w-4 h-4 text-red-400" /></button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button onClick={addCol} className="mt-2 text-xs font-medium flex items-center gap-1" style={{ color: 'var(--accent-primary)' }}>
                            <Plus className="w-3 h-3" />Add Column
                        </button>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
                    <button onClick={save} disabled={saving || !name.trim() || !columns.some(c => c.name.trim())}
                        className="px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent-primary)' }}>
                        {saving ? 'Creating...' : 'Create Table'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Main Component ──────────────────────────────────────

const MonitoringDashboard = ({ onBack, user }) => {
    const [view, setView] = useState('list');
    const [dashboards, setDashboards] = useState([]);
    const [activeDashboard, setActiveDashboard] = useState(null);
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingPanel, setEditingPanel] = useState(null);
    const [showCreateTable, setShowCreateTable] = useState(false);
    const [renaming, setRenaming] = useState(null);
    const [renamingValue, setRenamingValue] = useState('');

    const loadDashboards = useCallback(async () => {
        try { const r = await authFetch(`${API_BASE}/api/monitoring/dashboards`); if (r.ok) setDashboards(await r.json()); }
        catch (e) { console.error(e); } finally { setLoading(false); }
    }, []);

    const loadTables = useCallback(async () => {
        try { const r = await authFetch(`${API_BASE}/api/monitoring/tables`); if (r.ok) setTables(await r.json()); }
        catch (e) { console.error(e); }
    }, []);

    const loadDashboard = useCallback(async (id) => {
        try {
            const r = await authFetch(`${API_BASE}/api/monitoring/dashboards/${id}`);
            if (r.ok) { setActiveDashboard(await r.json()); setView('dashboard'); }
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => { loadDashboards(); loadTables(); }, [loadDashboards, loadTables]);

    const createDashboard = async () => {
        try {
            const r = await authFetch(`${API_BASE}/api/monitoring/dashboards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'New Dashboard' }) });
            const data = await r.json();
            if (r.ok) { loadDashboard(data.id); loadDashboards(); }
            else { console.error('[Monitoring] Create failed:', data); alert('Failed to create dashboard: ' + (data.error || 'Unknown error')); }
        } catch (e) { console.error('[Monitoring] Create error:', e); alert('Failed to create dashboard: ' + e.message); }
    };

    const deleteDashboard = async (id) => {
        try {
            await authFetch(`${API_BASE}/api/monitoring/dashboards/${id}`, { method: 'DELETE' });
            setDashboards(p => p.filter(d => d.id !== id));
            if (activeDashboard?.id === id) { setActiveDashboard(null); setView('list'); }
        } catch (e) { console.error(e); }
    };

    const renameDashboard = async (id) => {
        if (!renamingValue.trim()) return;
        try {
            await authFetch(`${API_BASE}/api/monitoring/dashboards/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: renamingValue }) });
            setRenaming(null); loadDashboards();
            if (activeDashboard?.id === id) loadDashboard(id);
        } catch (e) { console.error(e); }
    };

    const savePanel = async (panelData) => {
        try {
            if (editingPanel?.id) {
                await authFetch(`${API_BASE}/api/monitoring/panels/${editingPanel.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(panelData) });
            } else {
                await authFetch(`${API_BASE}/api/monitoring/panels`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dashboardId: activeDashboard.id, ...panelData }) });
            }
            setEditingPanel(null); loadDashboard(activeDashboard.id);
        } catch (e) { console.error(e); }
    };

    const deletePanel = async (panelId) => {
        try { await authFetch(`${API_BASE}/api/monitoring/panels/${panelId}`, { method: 'DELETE' }); loadDashboard(activeDashboard.id); }
        catch (e) { console.error(e); }
    };

    const deleteCustomTable = async (id) => {
        try { await authFetch(`${API_BASE}/api/monitoring/custom-tables/${id}`, { method: 'DELETE' }); loadTables(); }
        catch (e) { console.error(e); }
    };

    // ── List View ──
    if (view === 'list') return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <div className="flex items-center justify-between px-6 h-16 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]"><ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
                    <BarChart3 className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                    <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Monitoring</h1>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold tracking-wider uppercase" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)' }}>Beta</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowCreateTable(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-secondary)' }}>
                        <Layers className="w-4 h-4" />Custom Tables
                    </button>
                    <button onClick={createDashboard} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent-primary)' }}>
                        <Plus className="w-4 h-4" />New Dashboard
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                {loading ? <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
                    : dashboards.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.08)' }}>
                                <BarChart3 className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
                            </div>
                            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>No dashboards yet</h2>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Create your first dashboard to start monitoring your organisation's data</p>
                            <button onClick={createDashboard} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent-primary)' }}>
                                <Plus className="w-4 h-4" />Create Dashboard
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                                {dashboards.map(d => (
                                    <div key={d.id} onClick={() => loadDashboard(d.id)}
                                        className="group rounded-xl border p-5 cursor-pointer transition-all hover:shadow-lg hover:border-[var(--accent-primary)]/30"
                                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                        <div className="flex items-start justify-between mb-3">
                                            {renaming === d.id ? (
                                                <input value={renamingValue} onChange={e => setRenamingValue(e.target.value)}
                                                    onBlur={() => renameDashboard(d.id)} onKeyDown={e => e.key === 'Enter' && renameDashboard(d.id)}
                                                    onClick={e => e.stopPropagation()} autoFocus
                                                    className="text-base font-semibold px-2 py-1 rounded border outline-none focus:border-[var(--accent-primary)]"
                                                    style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                            ) : <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{d.name}</h3>}
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={e => { e.stopPropagation(); setRenaming(d.id); setRenamingValue(d.name); }} className="p-1.5 rounded hover:bg-[var(--bg-tertiary)]"><Edit3 className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /></button>
                                                <button onClick={e => { e.stopPropagation(); deleteDashboard(d.id); }} className="p-1.5 rounded hover:bg-[var(--bg-tertiary)]"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                                            </div>
                                        </div>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Created {new Date(d.created_at).toLocaleDateString()}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Custom Tables List */}
                            {tables.filter(t => t.source === 'custom').length > 0 && (
                                <div>
                                    <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                        <Layers className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />Custom Tables
                                    </h2>
                                    <div className="space-y-2">
                                        {tables.filter(t => t.source === 'custom').map(t => (
                                            <div key={t.name} className="flex items-center justify-between px-4 py-3 rounded-lg border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                                <div>
                                                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.displayName}</span>
                                                    <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>{t.description}</span>
                                                </div>
                                                <button onClick={() => { const ct = tables.find(ct2 => ct2.name === t.name); /* find custom_tables id from full list */ }} className="p-1.5 rounded hover:bg-[var(--bg-tertiary)]"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
            </div>
            {showCreateTable && <CreateTableModal onClose={() => setShowCreateTable(false)} onCreated={loadTables} />}
        </div>
    );

    // ── Dashboard View ──
    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <div className="flex items-center justify-between px-6 h-14 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-3">
                    <button onClick={() => { setView('list'); setActiveDashboard(null); }} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]"><ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
                    <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{activeDashboard?.name}</h1>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold tracking-wider uppercase" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)' }}>Beta</span>
                </div>
                <button onClick={() => setEditingPanel({})} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent-primary)' }}>
                    <Plus className="w-4 h-4" />Add Panel
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                {(!activeDashboard?.panels || activeDashboard.panels.length === 0) ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.08)' }}>
                            <Plus className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
                        </div>
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Empty dashboard</h2>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Add your first panel to visualise your organisation's data</p>
                        <button onClick={() => setEditingPanel({})} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent-primary)' }}>
                            <Plus className="w-4 h-4" />Add First Panel
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ gridAutoRows: '260px' }}>
                        {activeDashboard.panels.map(panel => (
                            <PanelCard key={panel.id} panel={panel} onEdit={() => setEditingPanel(panel)} onDelete={deletePanel} />
                        ))}
                    </div>
                )}
            </div>
            {editingPanel !== null && <PanelEditor panel={editingPanel} tables={tables} onSave={savePanel} onClose={() => setEditingPanel(null)} />}
        </div>
    );
};

export default MonitoringDashboard;
