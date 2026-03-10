/**
 * Monitoring Dashboard — User-friendly, no-SQL, 21 viz types, resizable panels, fullscreen
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { API_BASE, authFetch, getRelativeTime } from '../../utils/helpers';
import { VIZ_COMPONENTS } from './ChartComponents';
import PanelEditor from './PanelEditor';
import ImportManager from './ImportManager';
import {
    ArrowLeft, Plus, Trash2, Edit3, BarChart3, Loader2,
    Maximize2, Minimize2, RefreshCw, MoreVertical, Clock
} from 'lucide-react';
const API = `${API_BASE}/api/monitoring`;

/* ── Panel Component ── */
const DashboardPanel = ({ panel, onEdit, onDelete, isFullscreen }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showMenu, setShowMenu] = useState(false);

    const run = useCallback(async () => {
        if (!panel.query_config?.table) return;
        setLoading(true); setError(null);
        try {
            const res = await authFetch(`${API}/panels/${panel.id}/execute`, { method: 'POST' });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Query failed');
            setData(result);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }, [panel.id, panel.query_config]);

    useEffect(() => { run(); }, [run]);

    const Viz = VIZ_COMPONENTS[panel.visualization_type] || VIZ_COMPONENTS.stat;
    const hasConfig = !!panel.query_config?.table;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 12, border: '1px solid var(--border-default)', background: 'var(--bg-primary)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {/* Panel header */}
            <div className="panel-drag-handle" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid var(--border-subtle)', cursor: 'grab', flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{panel.title}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative' }}>
                    <button onClick={run} style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4 }} title="Refresh"><RefreshCw style={{ width: 13, height: 13, color: 'var(--text-muted)' }} /></button>
                    <button onClick={() => setShowMenu(!showMenu)} style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4 }}><MoreVertical style={{ width: 13, height: 13, color: 'var(--text-muted)' }} /></button>
                    {showMenu && (
                        <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 20, background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 120, overflow: 'hidden' }}>
                            <button onClick={() => { setShowMenu(false); onEdit(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)', textAlign: 'left' }}><Edit3 style={{ width: 13, height: 13 }} />Edit</button>
                            <button onClick={() => { setShowMenu(false); onDelete(); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#f43f5e', textAlign: 'left' }}><Trash2 style={{ width: 13, height: 13 }} />Delete</button>
                        </div>
                    )}
                </div>
            </div>
            {/* Panel body */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {loading ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} /></div>
                    : error ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#f43f5e', fontSize: 12, padding: 16, textAlign: 'center' }}>{error}</div>
                        : !hasConfig ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><button onClick={onEdit} style={{ padding: '8px 16px', borderRadius: 8, border: '1px dashed var(--border-default)', background: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>Click to configure</button></div>
                            : <Viz data={data} />}
            </div>
        </div>
    );
};

/* ── Dashboard View ── */
const DashboardView = ({ dashboard, tables, onBack, onRefresh }) => {
    const [panels, setPanels] = useState(dashboard.panels || []);
    const [editingPanel, setEditingPanel] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(0);
    const refreshRef = useRef(null);
    const gridContainerRef = useRef(null);
    const { width: containerWidth } = useContainerWidth({ ref: gridContainerRef });

    useEffect(() => { setPanels(dashboard.panels || []); }, [dashboard]);

    // Auto-refresh
    useEffect(() => {
        if (autoRefresh > 0) {
            refreshRef.current = setInterval(() => { onRefresh(); }, autoRefresh * 1000);
            return () => clearInterval(refreshRef.current);
        }
        return () => clearInterval(refreshRef.current);
    }, [autoRefresh, onRefresh]);

    const layout = panels.map(p => {
        const pos = typeof p.grid_position === 'string' ? JSON.parse(p.grid_position) : (p.grid_position || { x: 0, y: 0, w: 6, h: 4 });
        return { i: p.id, x: pos.x || 0, y: pos.y || 0, w: pos.w || 6, h: pos.h || 4, minW: 2, minH: 2 };
    });

    const handleLayoutChange = async (newLayout) => {
        const positions = newLayout.map(l => ({ id: l.i, gridPosition: { x: l.x, y: l.y, w: l.w, h: l.h } }));
        try {
            await authFetch(`${API}/dashboards/${dashboard.id}/layout`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ positions }),
            });
        } catch (e) { console.error(e); }
    };

    const addPanel = () => setEditingPanel({});
    const editPanel = (p) => setEditingPanel(p);

    const savePanel = async (data) => {
        try {
            if (editingPanel?.id) {
                await authFetch(`${API}/panels/${editingPanel.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            } else {
                await authFetch(`${API}/panels`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dashboardId: dashboard.id, ...data }) });
            }
            setEditingPanel(null); onRefresh();
        } catch (e) { console.error(e); }
    };

    const deletePanel = async (panelId) => {
        try { await authFetch(`${API}/panels/${panelId}`, { method: 'DELETE' }); onRefresh(); }
        catch (e) { console.error(e); }
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
            {/* Header */}
            {!isFullscreen && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 48, borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button onClick={onBack} style={{ padding: 4, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer' }}><ArrowLeft style={{ width: 18, height: 18, color: 'var(--text-secondary)' }} /></button>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{dashboard.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <select value={autoRefresh} onChange={e => setAutoRefresh(Number(e.target.value))} title="Auto-refresh"
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 11, outline: 'none' }}>
                            <option value={0}>Off</option><option value={30}>30s</option><option value={60}>1m</option><option value={300}>5m</option>
                        </select>
                        <button onClick={() => setIsFullscreen(true)} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer' }} title="Fullscreen"><Maximize2 style={{ width: 16, height: 16, color: 'var(--text-muted)' }} /></button>
                        <button onClick={addPanel} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--accent-primary)', cursor: 'pointer' }}><Plus style={{ width: 14, height: 14 }} />Add Panel</button>
                    </div>
                </div>
            )}
            {isFullscreen && (
                <button onClick={() => setIsFullscreen(false)} style={{ position: 'fixed', top: 12, right: 12, zIndex: 50, padding: 8, borderRadius: 8, border: 'none', background: 'var(--bg-primary)', boxShadow: '0 2px 12px rgba(0,0,0,0.15)', cursor: 'pointer' }}><Minimize2 style={{ width: 16, height: 16, color: 'var(--text-secondary)' }} /></button>
            )}

            {/* Grid */}
            <div ref={gridContainerRef} style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {panels.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
                        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart3 style={{ width: 28, height: 28, color: 'var(--accent-primary)' }} /></div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>No panels yet</p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Add your first panel to start visualizing data</p>
                        <button onClick={addPanel} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--accent-primary)', cursor: 'pointer', marginTop: 4 }}><Plus style={{ width: 15, height: 15 }} />Add Panel</button>
                    </div>
                ) : containerWidth > 0 ? (
                    <ResponsiveGridLayout
                        className="monitoring-grid"
                        layouts={{ lg: layout, md: layout, sm: layout }}
                        breakpoints={{ lg: 1100, md: 800, sm: 0 }}
                        cols={{ lg: 12, md: 8, sm: 4 }}
                        rowHeight={60}
                        width={containerWidth}
                        draggableHandle=".panel-drag-handle"
                        onLayoutChange={handleLayoutChange}
                        isResizable={true}
                        isDraggable={true}
                        compactType="vertical"
                        margin={[12, 12]}
                    >
                        {panels.map(p => (
                            <div key={p.id}>
                                <DashboardPanel panel={p} onEdit={() => editPanel(p)} onDelete={() => deletePanel(p.id)} isFullscreen={isFullscreen} />
                            </div>
                        ))}
                    </ResponsiveGridLayout>
                ) : null}
            </div>

            {editingPanel !== null && <PanelEditor panel={editingPanel} tables={tables} onSave={savePanel} onClose={() => setEditingPanel(null)} />}
        </div>
    );
};

/* ── Dashboard List (Home) ── */
const DashboardList = ({ dashboards, loading, onSelect, onCreate, onDelete, onBack }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 32 }}>
            <div style={{ width: '100%', maxWidth: 800 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {onBack && <button onClick={onBack} style={{ padding: 4, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ArrowLeft style={{ width: 18, height: 18, color: 'var(--text-secondary)' }} /></button>}
                        <BarChart3 style={{ width: 22, height: 22, color: 'var(--accent-primary)' }} />
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Dashboards</h1>
                        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 20, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)' }}>Beta</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={onCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--accent-primary)', cursor: 'pointer' }}><Plus style={{ width: 15, height: 15 }} />New Dashboard</button>
                    </div>
                </div>

                {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} /></div>
                    : dashboards.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 64, gap: 12, borderRadius: 16, border: '1px dashed var(--border-default)', background: 'var(--bg-primary)' }}>
                            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart3 style={{ width: 28, height: 28, color: 'var(--accent-primary)' }} /></div>
                            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>No dashboards yet</p>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Create your first dashboard to start monitoring data</p>
                            <button onClick={onCreate} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--accent-primary)', cursor: 'pointer', marginTop: 4 }}><Plus style={{ width: 15, height: 15 }} />Create Dashboard</button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                            {dashboards.map(d => (
                                <div key={d.id} onClick={() => onSelect(d.id)} style={{ padding: 20, borderRadius: 12, border: '1px solid var(--border-default)', background: 'var(--bg-primary)', cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(99,102,241,0.1)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none'; }}>
                                    <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
                                        <div>
                                            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>{d.name}</h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                                                <Clock style={{ width: 11, height: 11 }} />{getRelativeTime(d.updated_at || d.created_at)}
                                            </div>
                                        </div>
                                        <button onClick={e => { e.stopPropagation(); onDelete(d.id); }} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer' }}><Trash2 style={{ width: 14, height: 14, color: 'var(--text-muted)' }} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
            </div>
        </div>
    );
};

/* ── Main ── */
export default function MonitoringDashboard({ onBack }) {
    const [view, setView] = useState('list');
    const [dashboards, setDashboards] = useState([]);
    const [activeDashboard, setActiveDashboard] = useState(null);
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadDashboards = useCallback(async () => {
        try { const r = await authFetch(`${API}/dashboards`); if (r.ok) setDashboards(await r.json()); }
        catch (e) { console.error(e); } finally { setLoading(false); }
    }, []);

    const loadTables = useCallback(async () => {
        try { const r = await authFetch(`${API}/tables`); if (r.ok) setTables(await r.json()); }
        catch (e) { console.error(e); }
    }, []);

    const loadDashboard = useCallback(async (id) => {
        try { const r = await authFetch(`${API}/dashboards/${id}`); if (r.ok) { setActiveDashboard(await r.json()); setView('dashboard'); } }
        catch (e) { console.error(e); }
    }, []);

    useEffect(() => { loadDashboards(); loadTables(); }, [loadDashboards, loadTables]);

    const createDashboard = async () => {
        try {
            const r = await authFetch(`${API}/dashboards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'New Dashboard' }) });
            if (r.ok) { const d = await r.json(); loadDashboard(d.id); loadDashboards(); }
        } catch (e) { console.error(e); }
    };

    const deleteDashboard = async (id) => {
        try { await authFetch(`${API}/dashboards/${id}`, { method: 'DELETE' }); setDashboards(p => p.filter(d => d.id !== id)); if (activeDashboard?.id === id) { setActiveDashboard(null); setView('list'); } }
        catch (e) { console.error(e); }
    };

    if (view === 'dashboard' && activeDashboard) {
        return <DashboardView dashboard={activeDashboard} tables={tables} onBack={() => { setView('list'); setActiveDashboard(null); }} onRefresh={() => loadDashboard(activeDashboard.id)} />;
    }

    if (view === 'imports') {
        return (
            <div style={{ height: '100%', background: 'var(--bg-secondary)', overflowY: 'auto' }}>
                <ImportManager onBack={() => setView('list')} />
            </div>
        );
    }

    return (
        <div style={{ height: '100%', background: 'var(--bg-secondary)', overflowY: 'auto' }}>
            <DashboardList dashboards={dashboards} loading={loading} onSelect={loadDashboard} onCreate={createDashboard} onDelete={deleteDashboard} onBack={onBack} />
            {/* Import link at bottom */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '0 32px 32px' }}>
                <button onClick={() => setView('imports')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, border: '1px solid var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    📦 Data Imports
                </button>
            </div>
        </div>
    );
}
