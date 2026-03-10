import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Activity, Cpu, Zap, Clock, Wrench, BarChart3, RefreshCw,
    TrendingUp, Users, DollarSign, ChevronRight, Globe, Bot,
    ArrowUp, ArrowDown, Minus, Layers, MessageSquare, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { fmt, fmtCost, fmtDuration, fmtTime, COLORS, AGENT_COLORS, getAgentStyle, MODEL_COLORS } from './shared';
import { OverviewPage } from './OverviewPage';
import { ModelsPage } from './ModelsPage';
import { AgentsPage } from './AgentsPage';
import { UsersPage } from './UsersPage';
import { ConversationsPage } from './ConversationsPage';
import { CostsPage } from './CostsPage';
import { FeedbackPage } from './FeedbackPage';
import { ActivityPage } from './ActivityPage';
import { DetailDrawer } from './DetailDrawer';

const API = (import.meta.env.VITE_API_URL || '') + '/api/usage';
const AI_API = (import.meta.env.VITE_API_URL || '') + '/ai';
const FEEDBACK_API = (import.meta.env.VITE_API_URL || '') + '/api/feedback';

const RANGES = [
    { id: 'today', label: 'Today', icon: '☀️' },
    { id: '7d', label: '7 Days', icon: '📅' },
    { id: '30d', label: '30 Days', icon: '📆' },
    { id: 'all', label: 'All Time', icon: '♾️' },
];

function rangeToFilter(rangeId) {
    if (rangeId === 'all') return {};
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

const PAGES = [
    { id: 'overview', label: 'Overview', icon: BarChart3, description: 'Dashboard summary' },
    { id: 'models', label: 'Models', icon: Cpu, description: 'Token usage per model' },
    { id: 'agents', label: 'Agents', icon: Bot, description: 'Agent performance' },
    { id: 'users', label: 'Users', icon: Users, description: 'Per-user breakdown' },
    { id: 'conversations', label: 'Conversations', icon: MessageSquare, description: 'Per-conversation costs' },
    { id: 'costs', label: 'Costs', icon: DollarSign, description: 'Cost estimation' },
    { id: 'feedback', label: 'Feedback', icon: ThumbsUp, description: 'User feedback on AI responses' },
    { id: 'activity', label: 'Activity Log', icon: Clock, description: 'Recent calls' },
];

export default function MonitoringPanel({ activeSection = '', onNavigate }) {

    const VALID_IDS = PAGES.map(p => p.id);
    const page = VALID_IDS.includes(activeSection) ? activeSection : 'overview';
    const [range, setRange] = useState('7d');
    const [summary, setSummary] = useState(null);
    const [byModel, setByModel] = useState([]);
    const [byAgent, setByAgent] = useState([]);
    const [byUser, setByUser] = useState([]);
    const [timeline, setTimeline] = useState([]);
    const [costTimeline, setCostTimeline] = useState([]);
    const [tools, setTools] = useState([]);
    const [recent, setRecent] = useState([]);
    const [modelCosts, setModelCosts] = useState({});
    const [loading, setLoading] = useState(true);
    const [filterSources, setFilterSources] = useState([]);
    const [filterModels, setFilterModels] = useState([]);
    const [activityFilters, setActivityFilters] = useState({ source: '', model: '', search: '' });
    const [organizations, setOrganizations] = useState([]);
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [detailDrawer, setDetailDrawer] = useState(null);
    const [byConversation, setByConversation] = useState([]);
    const [feedback, setFeedback] = useState([]);
    const [feedbackSummary, setFeedbackSummary] = useState({ total: 0, thumbs_up: 0, thumbs_down: 0, with_comments: 0 });
    const [feedbackFilters, setFeedbackFilters] = useState({ rating: '', source: '' });

    // Fetch orgs list once
    useEffect(() => {
        fetch(`${API}/organizations`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : [])
            .then(d => setOrganizations(Array.isArray(d) ? d : []))
            .catch(() => { });
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const filters = rangeToFilter(range);
        if (selectedOrgId) filters.orgId = selectedOrgId;
        const qs = new URLSearchParams(filters).toString();
        const q = qs ? '?' + qs : '';
        try {
            const [s, m, a, u, t, tl, ct, r, mc, fs, fm, bc] = await Promise.all([
                fetch(`${API}/summary${q}`).then(r => r.json()),
                fetch(`${API}/by-model${q}`).then(r => r.json()),
                fetch(`${API}/by-agent${q}`).then(r => r.json()),
                fetch(`${API}/by-user${q}`).then(r => r.json()),
                fetch(`${API}/tools${q}`).then(r => r.json()),
                fetch(`${API}/timeline${q}&interval=${range === 'today' ? 'hour' : 'day'}`).then(r => r.json()),
                fetch(`${API}/cost-timeline${q}&interval=${range === 'today' ? 'hour' : 'day'}`).then(r => r.json()).catch(() => []),
                fetch(`${API}/recent?limit=100${selectedOrgId ? '&orgId=' + selectedOrgId : ''}`).then(r => r.json()),
                fetch(`${AI_API}/model-costs`, { credentials: 'include' }).then(r => r.ok ? r.json() : {}).catch(() => ({})),
                fetch(`${API}/filters/sources`).then(r => r.json()).catch(() => []),
                fetch(`${API}/filters/models`).then(r => r.json()).catch(() => []),
                fetch(`${API}/by-conversation${q}`).then(r => r.json()).catch(() => []),
            ]);
            setSummary(s); setByModel(Array.isArray(m) ? m : []); setByAgent(Array.isArray(a) ? a : []); setByUser(Array.isArray(u) ? u : []);
            setTools(Array.isArray(t) ? t : []); setTimeline(Array.isArray(tl) ? tl : []); setCostTimeline(Array.isArray(ct) ? ct : []);
            setRecent(Array.isArray(r) ? r : []); setModelCosts(mc && typeof mc === 'object' ? mc : {});
            setFilterSources(Array.isArray(fs) ? fs : []); setFilterModels(Array.isArray(fm) ? fm : []);
            setByConversation(Array.isArray(bc) ? bc : []);

            // Fetch feedback data
            try {
                const fbQs = new URLSearchParams(filters).toString();
                const fbQ = fbQs ? '?' + fbQs : '';
                const [fbData, fbSummary] = await Promise.all([
                    fetch(`${FEEDBACK_API}${fbQ}`, { credentials: 'include' }).then(r => r.ok ? r.json() : []).catch(() => []),
                    fetch(`${FEEDBACK_API}/summary${fbQ}`, { credentials: 'include' }).then(r => r.ok ? r.json() : {}).catch(() => ({})),
                ]);
                setFeedback(fbData);
                setFeedbackSummary(fbSummary);
            } catch (e) { console.error('[Monitoring] feedback fetch error:', e); }
        } catch (e) {
            console.error('[Monitoring] fetch error:', e);
        }
        setLoading(false);
    }, [range, selectedOrgId]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => {
        const iv = setInterval(fetchData, 30000);
        return () => clearInterval(iv);
    }, [fetchData]);

    // Computed cost
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

    const browserCalls = useMemo(() => byAgent.filter(a => a.agent_type === 'browser'), [byAgent]);
    const browserTotalTokens = useMemo(() => browserCalls.reduce((s, a) => s + (a.total_tokens || 0), 0), [browserCalls]);
    const browserTotalCalls = useMemo(() => browserCalls.reduce((s, a) => s + (a.calls || 0), 0), [browserCalls]);

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
                                }}>{p.label}</div>
                            </div>
                            {page === p.id && <ChevronRight style={{ width: 14, height: 14, color: COLORS.primary, flexShrink: 0 }} />}
                        </button>
                    ))}
                </nav>

                {/* Quick Stats in sidebar */}
                <div style={styles.sidebarStats}>
                    <div style={styles.sidebarStatItem}>
                        <span style={{ color: 'var(--text-muted, #888)', fontSize: '11px' }}>Calls</span>
                        <span style={{ color: 'var(--text-primary, #fff)', fontSize: '16px', fontWeight: 700 }}>{fmt(summary?.total_calls || 0)}</span>
                    </div>
                    <div style={styles.sidebarStatItem}>
                        <span style={{ color: 'var(--text-muted, #888)', fontSize: '11px' }}>Tokens</span>
                        <span style={{ color: COLORS.green, fontSize: '16px', fontWeight: 700 }}>{fmt(summary?.total_tokens || 0)}</span>
                    </div>
                    <div style={styles.sidebarStatItem}>
                        <span style={{ color: 'var(--text-muted, #888)', fontSize: '11px' }}>Est. Cost</span>
                        <span style={{ color: COLORS.amber, fontSize: '16px', fontWeight: 700 }}>{fmtCost(totalCost)}</span>
                    </div>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div style={styles.main}>
                {/* Top bar */}
                <div style={styles.topBar}>
                    <div>
                        <h2 style={styles.pageTitle}>
                            {PAGES.find(p => p.id === page)?.label}
                        </h2>
                        <p style={styles.pageDesc}>
                            {PAGES.find(p => p.id === page)?.description}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* Org filter (super admin) */}
                        {organizations.length > 0 && (
                            <select
                                value={selectedOrgId}
                                onChange={e => setSelectedOrgId(e.target.value)}
                                style={{
                                    padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
                                    background: selectedOrgId ? COLORS.primary + '18' : 'var(--bg-tertiary, rgba(255,255,255,0.04))',
                                    color: selectedOrgId ? COLORS.primary : 'var(--text-primary, #fff)',
                                    border: `1px solid ${selectedOrgId ? COLORS.primary + '40' : 'var(--border-default, rgba(255,255,255,0.08))'}`,
                                    outline: 'none', cursor: 'pointer', minWidth: '140px',
                                }}
                            >
                                <option value="">All Organizations</option>
                                {organizations.filter(o => o.id !== '__unassigned').map(o => (
                                    <option key={o.id} value={o.id}>{o.name} ({fmt(o.total_calls)} calls)</option>
                                ))}
                            </select>
                        )}
                        <div style={styles.rangeGroup}>
                            {RANGES.map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => setRange(r.id)}
                                    style={{
                                        ...styles.rangeBtn,
                                        ...(range === r.id ? styles.rangeBtnActive : {}),
                                    }}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                        <button onClick={fetchData} style={styles.refreshBtn} title="Refresh">
                            <RefreshCw style={{ width: 15, height: 15, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        </button>
                    </div>
                </div>

                {/* Page Content */}
                <div style={styles.content}>
                    {page === 'overview' && (
                        <OverviewPage
                            summary={summary} byModel={byModel} byAgent={byAgent}
                            timeline={timeline} costTimeline={costTimeline} tools={tools} totalCost={totalCost}
                            costPerModel={costPerModel} modelCosts={modelCosts}
                            range={range} browserTotalCalls={browserTotalCalls}
                            browserTotalTokens={browserTotalTokens}
                            onSelectModel={m => setDetailDrawer({ type: 'model', data: m })}
                            onSelectAgent={a => setDetailDrawer({ type: 'agent', data: a })}
                        />
                    )}
                    {page === 'models' && (
                        <ModelsPage byModel={byModel} costPerModel={costPerModel} modelCosts={modelCosts}
                            onSelect={m => setDetailDrawer({ type: 'model', data: m })} />
                    )}
                    {page === 'agents' && (
                        <AgentsPage byAgent={byAgent} modelCosts={modelCosts} costPerModel={costPerModel}
                            onSelect={a => setDetailDrawer({ type: 'agent', data: a })} />
                    )}
                    {page === 'users' && (
                        <UsersPage byUser={byUser} />
                    )}
                    {page === 'conversations' && (
                        <ConversationsPage conversations={byConversation} />
                    )}
                    {page === 'costs' && (
                        <CostsPage byModel={byModel} costPerModel={costPerModel} modelCosts={modelCosts} totalCost={totalCost} costTimeline={costTimeline} range={range} onNavigate={onNavigate} />
                    )}
                    {page === 'feedback' && (
                        <FeedbackPage feedback={feedback} summary={feedbackSummary}
                            filters={feedbackFilters} setFilters={setFeedbackFilters} />
                    )}
                    {page === 'activity' && (
                        <ActivityPage recent={recent} modelCosts={modelCosts}
                            filterSources={filterSources} filterModels={filterModels}
                            activityFilters={activityFilters} setActivityFilters={setActivityFilters}
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
        width: '220px', flexShrink: 0,
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
    sidebarStats: {
        padding: '12px 18px', margin: '0 8px',
        borderTop: '1px solid var(--border-default, rgba(255,255,255,0.06))',
        display: 'flex', flexDirection: 'column', gap: '8px',
    },
    sidebarStatItem: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
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
