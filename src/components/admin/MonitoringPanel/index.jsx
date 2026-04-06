import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import {
    Activity, BarChart3, RefreshCw, DollarSign, Bot,
    ChevronRight, MessageSquare, ThumbsUp, Clock, Calendar
} from 'lucide-react';
import { COLORS, fmt, fmtCost } from './shared';
import { OverviewPage } from './OverviewPage';
import { UsageExplorerPage } from './UsageExplorerPage';
import { FeedbackPage } from './FeedbackPage';
import { ActivityPage } from './ActivityPage';
import { DetailDrawer } from './DetailDrawer';

const API = (import.meta.env.VITE_API_URL || '') + '/api/usage';
const AI_API = (import.meta.env.VITE_API_URL || '') + '/ai';
const FEEDBACK_API = (import.meta.env.VITE_API_URL || '') + '/api/feedback';
const OPTS = { credentials: 'include' };

const RANGES = [
    { id: 'today', labelKey: 'admin.mon_today' },
    { id: '7d', labelKey: 'admin.mon_7d' },
    { id: '30d', labelKey: 'admin.mon_30d' },
    { id: 'all', labelKey: 'admin.mon_all_time' },
    { id: 'custom', label: 'Custom' },
];

function rangeToFilter(rangeId, customStart, customEnd) {
    if (rangeId === 'all') return {};
    if (rangeId === 'custom') {
        if (!customStart || !customEnd) return {};
        return { startDate: new Date(customStart).toISOString(), endDate: new Date(customEnd).toISOString() };
    }
    const now = new Date();
    let start;
    if (rangeId === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (rangeId === '7d') {
        start = new Date(now.getTime() - 7 * 86400000);
    } else {
        start = new Date(now.getTime() - 30 * 86400000);
    }
    return { startDate: start.toISOString(), endDate: now.toISOString() };
}

// Previous period: same duration ending where current starts
function prevPeriodFilter(rangeId, customStart, customEnd) {
    if (rangeId === 'all') return null;
    const now = new Date();
    let start, end;
    if (rangeId === 'custom') {
        if (!customStart || !customEnd) return null;
        const s = new Date(customStart), e = new Date(customEnd);
        const dur = e.getTime() - s.getTime();
        if (dur <= 0) return null;
        end = s;
        start = new Date(s.getTime() - dur);
    } else if (rangeId === 'today') {
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        start = new Date(end.getTime() - 86400000);
    } else if (rangeId === '7d') {
        end = new Date(now.getTime() - 7 * 86400000);
        start = new Date(end.getTime() - 7 * 86400000);
    } else {
        end = new Date(now.getTime() - 30 * 86400000);
        start = new Date(end.getTime() - 30 * 86400000);
    }
    return { startDate: start.toISOString(), endDate: end.toISOString() };
}

// Decide chart interval based on the date span
function autoInterval(rangeId, customStart, customEnd) {
    if (rangeId === 'today') return 'hour';
    if (rangeId === 'custom' && customStart && customEnd) {
        const diffMs = new Date(customEnd) - new Date(customStart);
        if (diffMs <= 86400000) return 'hour'; // ≤ 1 day
        return 'day';
    }
    return 'day';
}

// Format a datetime-local string from a Date
function toLocalInput(date) {
    const d = new Date(date);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const PAGES = [
    { id: 'overview', labelKey: 'admin.mon_overview', icon: BarChart3, description: 'Dashboard & cost overview' },
    { id: 'usage', labelKey: 'admin.mon_usage_explorer', icon: Activity, description: 'Explore models, agents, users & conversations' },
    { id: 'feedback', labelKey: 'admin.mon_feedback', icon: ThumbsUp, description: 'User feedback on AI responses' },
    { id: 'activity', labelKey: 'admin.mon_activity', icon: Clock, description: 'Recent API call log' },
];

async function fetchJson(url) {
    try {
        const r = await fetch(url, OPTS);
        if (!r.ok) return null;
        return await r.json();
    } catch { return null; }
}

export default function MonitoringPanel({ activeSection = '', onNavigate }) {
    const { t } = useTranslation();

    const VALID_IDS = PAGES.map(p => p.id);
    const page = VALID_IDS.includes(activeSection) ? activeSection : 'overview';
    const [range, setRange] = useState('7d');
    const [customStart, setCustomStart] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); return toLocalInput(d);
    });
    const [customEnd, setCustomEnd] = useState(() => toLocalInput(new Date()));
    const [loading, setLoading] = useState(true);
    const [detailDrawer, setDetailDrawer] = useState(null);

    // ── Data stores ──
    const [summary, setSummary] = useState(null);
    const [prevSummary, setPrevSummary] = useState(null);
    const [byModel, setByModel] = useState([]);
    const [byAgent, setByAgent] = useState([]);
    const [byUser, setByUser] = useState([]);
    const [timeline, setTimeline] = useState([]);
    const [costTimeline, setCostTimeline] = useState([]);
    const [tools, setTools] = useState([]);
    const [recent, setRecent] = useState([]);
    const [modelCosts, setModelCosts] = useState({});
    const [byConversation, setByConversation] = useState([]);
    const [filterSources, setFilterSources] = useState([]);
    const [filterModels, setFilterModels] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [feedbackSummary, setFeedbackSummary] = useState({ total: 0, thumbs_up: 0, thumbs_down: 0, with_comments: 0 });

    const fetchData = useCallback(async () => {
        setLoading(true);
        const filters = rangeToFilter(range, customStart, customEnd);
        const qs = new URLSearchParams(filters).toString();
        const q = qs ? '?' + qs : '';
        const interval = autoInterval(range, customStart, customEnd);

        try {
            // Core data (always needed)
            const [s, m, a, u, tl, ct, mc, t, r, fs, fm, bc] = await Promise.all([
                fetchJson(`${API}/summary${q}`),
                fetchJson(`${API}/by-model${q}`),
                fetchJson(`${API}/by-agent${q}`),
                fetchJson(`${API}/by-user${q}`),
                fetchJson(`${API}/timeline${q}&interval=${interval}`),
                fetchJson(`${API}/cost-timeline${q}&interval=${interval}`),
                fetchJson(`${AI_API}/model-costs`),
                fetchJson(`${API}/tools${q}`),
                fetchJson(`${API}/recent?limit=100`),
                fetchJson(`${API}/filters/sources`),
                fetchJson(`${API}/filters/models`),
                fetchJson(`${API}/by-conversation${q}`),
            ]);

            setSummary(s || { total_calls: 0, total_tokens: 0, total_estimated_cost: 0, avg_duration_ms: 0 });
            setByModel(Array.isArray(m) ? m : []);
            setByAgent(Array.isArray(a) ? a : []);
            setByUser(Array.isArray(u) ? u : []);
            setTimeline(Array.isArray(tl) ? tl : []);
            setCostTimeline(Array.isArray(ct) ? ct : []);
            setModelCosts(mc && typeof mc === 'object' ? mc : {});
            setTools(Array.isArray(t) ? t : []);
            setRecent(Array.isArray(r) ? r : []);
            setFilterSources(Array.isArray(fs) ? fs : []);
            setFilterModels(Array.isArray(fm) ? fm : []);
            setByConversation(Array.isArray(bc) ? bc : []);

            // Previous period for delta comparison
            const prevFilter = prevPeriodFilter(range, customStart, customEnd);
            if (prevFilter) {
                const prevQs = new URLSearchParams(prevFilter).toString();
                const ps = await fetchJson(`${API}/summary?${prevQs}`);
                setPrevSummary(ps);
            } else {
                setPrevSummary(null);
            }

            // Feedback
            try {
                const fbQs = qs ? '?' + qs : '';
                const [fbData, fbSum] = await Promise.all([
                    fetchJson(`${FEEDBACK_API}${fbQs}`),
                    fetchJson(`${FEEDBACK_API}/summary${fbQs}`),
                ]);
                setFeedback(Array.isArray(fbData) ? fbData : []);
                setFeedbackSummary(fbSum || { total: 0, thumbs_up: 0, thumbs_down: 0, with_comments: 0 });
            } catch { /* ignore */ }
        } catch (e) {
            console.error('[Monitoring] fetch error:', e);
        }
        setLoading(false);
    }, [range, customStart, customEnd]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => {
        const iv = setInterval(fetchData, 60000); // reduced from 30s to 60s
        return () => clearInterval(iv);
    }, [fetchData]);

    // Computed costs per model
    const totalCost = useMemo(() => byModel.reduce((sum, m) => {
        const c = modelCosts[m.model];
        if (!c) return sum;
        return sum + ((m.prompt_tokens || 0) / 1e6) * (c.input || 0)
            + ((m.completion_tokens || 0) / 1e6) * (c.output || 0);
    }, 0), [byModel, modelCosts]);

    const costPerModel = useMemo(() => {
        const map = {};
        byModel.forEach(m => {
            const c = modelCosts[m.model];
            if (c) {
                map[m.model] = ((m.prompt_tokens || 0) / 1e6) * (c.input || 0)
                    + ((m.completion_tokens || 0) / 1e6) * (c.output || 0);
            }
        });
        return map;
    }, [byModel, modelCosts]);

    // Deltas
    const deltas = useMemo(() => {
        if (!prevSummary || !summary) return {};
        const calc = (curr, prev) => prev > 0 ? ((curr - prev) / prev) * 100 : null;
        return {
            calls: calc(summary.total_calls || 0, prevSummary.total_calls || 0),
            tokens: calc(summary.total_tokens || 0, prevSummary.total_tokens || 0),
            cost: calc(summary.total_estimated_cost || 0, prevSummary.total_estimated_cost || 0),
            latency: calc(summary.avg_duration_ms || 0, prevSummary.avg_duration_ms || 0),
        };
    }, [summary, prevSummary]);

    const deltaLabel = range === 'today' ? 'vs yesterday' : range === '7d' ? 'vs prev 7d' : range === '30d' ? 'vs prev 30d' : range === 'custom' ? 'vs prev period' : '';

    return (
        <div style={styles.container}>
            {/* ── Sidebar ── */}
            <div style={styles.sidebar}>
                <div style={styles.sidebarHeader}>
                    <Activity style={{ width: 20, height: 20, color: COLORS.primary }} />
                    <span style={styles.sidebarTitle}>AI Monitor</span>
                </div>

                <nav style={styles.nav}>
                    {PAGES.map(p => (
                        <button
                            key={p.id}
                            onClick={() => { if (onNavigate) onNavigate(`admin/monitoring/${p.id}`); }}
                            style={{
                                ...styles.navItem,
                                ...(page === p.id ? styles.navItemActive : {}),
                            }}
                        >
                            <p.icon style={{
                                width: 18, height: 18,
                                color: page === p.id ? COLORS.primary : 'var(--text-muted, #666)',
                                flexShrink: 0
                            }} />
                            <div style={{ flex: 1, textAlign: 'left' }}>
                                <div style={{
                                    fontSize: '13px', fontWeight: page === p.id ? 600 : 500,
                                    color: page === p.id ? 'var(--text-primary, #fff)' : 'var(--text-secondary, #aaa)',
                                }}>{t(p.labelKey)}</div>
                            </div>
                            {page === p.id && <ChevronRight style={{ width: 14, height: 14, color: COLORS.primary, flexShrink: 0 }} />}
                        </button>
                    ))}
                </nav>
            </div>

            {/* ── Main Content ── */}
            <div style={styles.main}>
                {/* Top bar */}
                <div style={styles.topBar}>
                    <div>
                        <h2 style={styles.pageTitle}>
                            {t(PAGES.find(p => p.id === page)?.labelKey)}
                        </h2>
                        <p style={styles.pageDesc}>
                            {PAGES.find(p => p.id === page)?.description}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={styles.rangeGroup}>
                            {RANGES.map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => setRange(r.id)}
                                    style={{
                                        ...styles.rangeBtn,
                                        ...(range === r.id ? styles.rangeBtnActive : {}),
                                        ...(r.id === 'custom' ? { display: 'flex', alignItems: 'center', gap: '5px' } : {}),
                                    }}
                                >
                                    {r.id === 'custom' && <Calendar style={{ width: 12, height: 12 }} />}
                                    {r.labelKey ? t(r.labelKey) : r.label}
                                </button>
                            ))}
                        </div>
                        {range === 'custom' && (
                            <div style={styles.datePickerRow}>
                                <div style={styles.datePickerField}>
                                    <span style={styles.datePickerLabel}>From</span>
                                    <input
                                        type="datetime-local"
                                        value={customStart}
                                        onChange={e => setCustomStart(e.target.value)}
                                        max={customEnd}
                                        style={styles.dateInput}
                                    />
                                </div>
                                <span style={{ color: 'var(--text-muted, #666)', fontSize: '12px', padding: '0 2px' }}>→</span>
                                <div style={styles.datePickerField}>
                                    <span style={styles.datePickerLabel}>To</span>
                                    <input
                                        type="datetime-local"
                                        value={customEnd}
                                        onChange={e => setCustomEnd(e.target.value)}
                                        min={customStart}
                                        style={styles.dateInput}
                                    />
                                </div>
                            </div>
                        )}
                        <button onClick={fetchData} style={styles.refreshBtn} title="Refresh">
                            <RefreshCw style={{ width: 15, height: 15, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        </button>
                    </div>
                </div>

                {/* Page Content */}
                <div style={styles.content}>
                    {page === 'overview' && (
                        <OverviewPage
                            summary={summary} prevSummary={prevSummary} deltas={deltas} deltaLabel={deltaLabel}
                            byModel={byModel} byAgent={byAgent} timeline={timeline}
                            costTimeline={costTimeline} tools={tools} totalCost={totalCost}
                            costPerModel={costPerModel} modelCosts={modelCosts} range={range}
                            onSelectModel={m => setDetailDrawer({ type: 'model', data: m })}
                            onSelectAgent={a => setDetailDrawer({ type: 'agent', data: a })}
                            onNavigate={onNavigate}
                        />
                    )}
                    {page === 'usage' && (
                        <UsageExplorerPage
                            byModel={byModel} byAgent={byAgent} byUser={byUser}
                            byConversation={byConversation} costPerModel={costPerModel}
                            modelCosts={modelCosts}
                            onSelectModel={m => setDetailDrawer({ type: 'model', data: m })}
                            onSelectAgent={a => setDetailDrawer({ type: 'agent', data: a })}
                        />
                    )}
                    {page === 'feedback' && (
                        <FeedbackPage feedback={feedback} summary={feedbackSummary} />
                    )}
                    {page === 'activity' && (
                        <ActivityPage
                            recent={recent} modelCosts={modelCosts}
                            filterSources={filterSources} filterModels={filterModels}
                        />
                    )}
                </div>
            </div>

            {/* Detail Drawer */}
            {detailDrawer && (
                <DetailDrawer detail={detailDrawer} modelCosts={modelCosts} costPerModel={costPerModel}
                    recent={recent} onClose={() => setDetailDrawer(null)} />
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slideIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.15; } }
            `}</style>
        </div>
    );
}

const styles = {
    container: {
        display: 'flex', height: '100%', fontFamily: 'var(--font-family, Inter, sans-serif)',
        background: 'var(--bg-primary, #0f0f1a)',
    },
    sidebar: {
        width: '200px', flexShrink: 0,
        background: 'var(--bg-secondary, #1a1a2e)',
        borderRight: '1px solid var(--border-default, rgba(255,255,255,0.08))',
        display: 'flex', flexDirection: 'column',
        padding: '16px 0',
    },
    sidebarHeader: {
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '0 18px', marginBottom: '20px',
    },
    sidebarTitle: {
        fontSize: '16px', fontWeight: 800,
        color: 'var(--text-primary, #fff)',
        letterSpacing: '-0.3px',
    },
    nav: {
        display: 'flex', flexDirection: 'column', gap: '2px',
        padding: '0 8px', flex: 1,
    },
    navItem: {
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px', borderRadius: '10px',
        background: 'transparent', border: 'none',
        cursor: 'pointer', transition: 'all 0.15s',
        width: '100%',
    },
    navItemActive: {
        background: 'var(--accent-primary, #6366f1)' + '12',
    },
    main: {
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
    },
    topBar: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.06))',
        flexShrink: 0,
    },
    pageTitle: {
        fontSize: '18px', fontWeight: 700,
        color: 'var(--text-primary, #fff)', margin: 0,
    },
    pageDesc: {
        fontSize: '12px', color: 'var(--text-muted, #888)',
        margin: '2px 0 0', fontWeight: 400,
    },
    rangeGroup: {
        display: 'flex', borderRadius: '10px', overflow: 'hidden',
        border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
    },
    rangeBtn: {
        padding: '7px 14px', fontSize: '12px', fontWeight: 500,
        border: 'none', cursor: 'pointer', transition: 'all 0.15s',
        background: 'var(--bg-secondary, #1a1a2e)',
        color: 'var(--text-muted, #888)',
    },
    rangeBtnActive: {
        background: COLORS.primary, color: '#fff', fontWeight: 700,
    },
    datePickerRow: {
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '4px 10px', borderRadius: '10px',
        background: 'var(--bg-secondary, #1a1a2e)',
        border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
        animation: 'fadeIn 0.2s ease',
    },
    datePickerField: {
        display: 'flex', flexDirection: 'column', gap: '1px',
    },
    datePickerLabel: {
        fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.05em', color: 'var(--text-muted, #666)',
        lineHeight: 1,
    },
    dateInput: {
        background: 'var(--bg-primary, #0f0f1a)',
        border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
        borderRadius: '6px', padding: '4px 8px',
        fontSize: '12px', fontWeight: 500, fontFamily: 'inherit',
        color: 'var(--text-primary, #fff)',
        outline: 'none', cursor: 'pointer',
        colorScheme: 'dark',
    },
    refreshBtn: {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '34px', height: '34px', borderRadius: '10px',
        border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
        background: 'var(--bg-secondary, #1a1a2e)', cursor: 'pointer',
        color: 'var(--text-muted, #888)', transition: 'all 0.15s',
    },
    content: {
        flex: 1, overflow: 'auto', padding: '20px 24px',
    },
};
