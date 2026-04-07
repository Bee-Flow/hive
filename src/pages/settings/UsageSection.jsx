import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';
import { Bot, MessageSquare, BookOpen, Search, Code, LayoutTemplate, Filter, X, Cpu, Users, ChevronDown, Activity, ArrowUpRight, ArrowDownLeft, BarChart3, Zap, DollarSign, TrendingUp, ChevronRight, Shield, AlertTriangle, Eye, Fingerprint, Clock } from 'lucide-react';

// ── Formatters ──────────────────────────────────────────────────────────────
const fNum = (n) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n?.toLocaleString() || '0';
};
const fCur = (c) => `$${(c || 0).toFixed(2)}`;

const shortModel = (m) => {
    if (!m) return 'Unknown';
    return m.replace(/^(openai\/|anthropic\/|google\/|azure\/|mistral\/)/, '')
             .replace(/-\d{4}-\d{2}-\d{2}$/, '');
};

// ── Source details ──────────────────────────────────────────────────────────
const SOURCE_MAP = {
    agent: { label: 'Agent Chat', icon: Bot, color: '#6366f1' },
    chat: { label: 'Agent Chat', icon: Bot, color: '#6366f1' },
    direct: { label: 'Direct Chat', icon: MessageSquare, color: '#10b981' },
    notebook: { label: 'Notebooks', icon: BookOpen, color: '#8b5cf6' },
    research: { label: 'Research', icon: Search, color: '#f59e0b' },
    template: { label: 'Templates', icon: LayoutTemplate, color: '#ef4444' },
    designer: { label: 'App Designer', icon: Code, color: '#0ea5e9' },
    agent_stream: { label: 'Agent Stream', icon: Bot, color: '#6366f1' },
};
const getSourceDetails = (source) => SOURCE_MAP[source] || { label: source || 'Other', icon: Bot, color: '#94a3b8' };

// ── Palette ─────────────────────────────────────────────────────────────────
const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'];
const getColor = (i) => PALETTE[i % PALETTE.length];

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MINI COMPONENTS                                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

const Card = ({ children, style }) => (
    <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
        borderRadius: 12, overflow: 'hidden', ...style,
    }}>{children}</div>
);

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
    <Card style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <div style={{
                width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${color}15`,
            }}>
                <Icon style={{ width: 13, height: 13, color }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{label}</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
        {sub && <div style={{ marginTop: 2 }}>{sub}</div>}
    </Card>
);

const InOutBar = ({ input, output, height = 5, style }) => {
    const total = (input || 0) + (output || 0);
    if (total === 0) return <div style={{ width: '100%', height, borderRadius: 99, background: 'var(--bg-tertiary)', ...style }} />;
    const inputPct = ((input || 0) / total) * 100;
    return (
        <div style={{ width: '100%', height, borderRadius: 99, background: 'var(--bg-tertiary)', overflow: 'hidden', display: 'flex', ...style }}>
            <div style={{ height: '100%', width: `${inputPct}%`, background: '#3b82f6', borderRadius: '99px 0 0 99px', transition: 'width 0.4s ease' }} />
            <div style={{ height: '100%', flex: 1, background: '#f59e0b', borderRadius: '0 99px 99px 0', transition: 'width 0.4s ease' }} />
        </div>
    );
};

const InOutLabel = ({ input, output, inputCost, outputCost, showCost }) => (
    <div style={{ display: 'flex', gap: showCost ? 16 : 12, fontSize: 11, color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <ArrowDownLeft style={{ width: 10, height: 10, color: '#3b82f6' }} />
            <span style={{ color: '#3b82f6', fontWeight: 600 }}>{fNum(input)}</span>
            {showCost && <span style={{ color: '#3b82f6', opacity: 0.7, fontWeight: 500 }}>({fCur(inputCost)})</span>}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <ArrowUpRight style={{ width: 10, height: 10, color: '#f59e0b' }} />
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>{fNum(output)}</span>
            {showCost && <span style={{ color: '#f59e0b', opacity: 0.7, fontWeight: 500 }}>({fCur(outputCost)})</span>}
        </span>
    </div>
);

const Legend = ({ inputLabel, outputLabel }) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6', display: 'inline-block' }} /> {inputLabel}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} /> {outputLabel}
        </span>
    </div>
);

const SectionTitle = ({ children, icon: Icon, right }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {Icon && <Icon style={{ width: 14, height: 14, color: 'var(--accent-primary)', opacity: 0.7 }} />}
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{children}</span>
        </div>
        {right}
    </div>
);

const ListRow = ({ children, onClick, style: s }) => (
    <div
        onClick={onClick}
        style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 14px', background: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border-subtle)',
            cursor: onClick ? 'pointer' : 'default',
            transition: 'background 0.12s',
            ...s,
        }}
        onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
        onMouseLeave={e => { if (onClick) e.currentTarget.style.background = 'var(--bg-primary)'; }}
    >
        {children}
    </div>
);

const Avatar = ({ name, color }) => (
    <div style={{
        width: 26, height: 26, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#fff',
        background: `linear-gradient(135deg, ${color || 'var(--accent-primary)'}, ${color || 'var(--accent-primary)'}99)`,
    }}>
        {(name || '?')[0].toUpperCase()}
    </div>
);

const IconBadge = ({ icon: Icon, color, size = 26 }) => (
    <div style={{
        width: size, height: size, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, background: `${color}12`,
    }}>
        <Icon style={{ width: size * 0.5, height: size * 0.5, color }} />
    </div>
);

/* Sparkline */
const TrendChart = ({ timeline, title, avgLabel, noDataLabel }) => {
    if (!timeline?.length) return (
        <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 10 }}>
            {noDataLabel}
        </div>
    );
    const maxTokens = Math.max(...timeline.map(t => t.total_tokens || 0), 10);
    const points = timeline.map((t, i) => {
        const x = (i / Math.max(timeline.length - 1, 1)) * 100;
        const y = 100 - ((t.total_tokens || 0) / maxTokens) * 100;
        return `${x},${y}`;
    }).join(' ');

    const avgDay = (timeline.reduce((s, t) => s + (t.total_tokens || 0), 0) / timeline.length);

    return (
        <Card style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TrendingUp style={{ width: 13, height: 13, color: 'var(--accent-primary)', opacity: 0.7 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{avgLabel.replace('{value}', fNum(avgDay))}</span>
            </div>
            <div style={{ height: 56, width: '100%', position: 'relative' }}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    <defs>
                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <polygon points={`0,100 ${points} 100,100`} fill="url(#trendFill)" />
                    <polyline points={points} fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
        </Card>
    );
};

/* Filter pill */
const FilterPill = ({ label, icon: Icon, value, onChange, options, placeholder }) => (
    <div style={{ position: 'relative' }}>
        <div style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8,
            background: value ? `var(--accent-primary)` : 'var(--bg-primary)',
            border: `1px solid ${value ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
            fontSize: 12, fontWeight: 500,
            color: value ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.15s ease',
        }}>
            {Icon && <Icon style={{ width: 12, height: 12, flexShrink: 0 }} />}
            <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value || null)}
                style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: 'inherit', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
                    minWidth: 60, paddingRight: 14,
                }}
            >
                <option value="">{placeholder}</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown style={{ width: 11, height: 11, position: 'absolute', right: 8, pointerEvents: 'none', opacity: 0.5 }} />
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */
const UsageSection = () => {
    const { t } = useTranslation();
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [expandedAgent, setExpandedAgent] = useState(null);

    // Filters
    const [filterUser, setFilterUser] = useState(null);
    const [filterAgent, setFilterAgent] = useState(null);
    const [filterModel, setFilterModel] = useState(null);
    const [filterSource, setFilterSource] = useState(null);
    const hasFilters = filterUser || filterAgent || filterModel || filterSource;

    const [data, setData] = useState({
        summary: null, timeline: [], users: [], sources: [],
        agents: [], models: [], modelsByAgent: [], modelsByUser: [],
    });
    const [guardrails, setGuardrails] = useState({
        summary: null, timeline: [], byUser: [], byCategory: [], recent: [],
    });

    const buildQS = useCallback(() => {
        const params = new URLSearchParams({ days });
        if (filterUser) params.set('user', filterUser);
        if (filterAgent) params.set('agent', filterAgent);
        if (filterModel) params.set('model', filterModel);
        if (filterSource) params.set('source', filterSource);
        return params.toString();
    }, [days, filterUser, filterAgent, filterModel, filterSource]);

    useEffect(() => {
        const fetchUsage = async () => {
            setLoading(true);
            try {
                const qs = buildQS();
                const eps = ['summary', 'timeline', 'users', 'sources', 'agents', 'models', 'models-by-agent', 'models-by-user'];
                const results = await Promise.all(eps.map(ep => authFetch(`${API_BASE}/api/usage/${ep}?${qs}`)));
                const sj = async (r, fb) => { try { if (!r.ok) return fb; const d = await r.json(); return d?.error ? fb : d; } catch { return fb; } };
                const sa = async (r) => { const d = await sj(r, []); return Array.isArray(d) ? d : []; };
                setData({
                    summary: await sj(results[0], {}),
                    timeline: await sa(results[1]),
                    users: await sa(results[2]),
                    sources: await sa(results[3]),
                    agents: await sa(results[4]),
                    models: await sa(results[5]),
                    modelsByAgent: await sa(results[6]),
                    modelsByUser: await sa(results[7]),
                });
                // Fetch guardrail data in parallel
                const gEps = ['guardrails/summary', 'guardrails/timeline', 'guardrails/by-user', 'guardrails/by-category', 'guardrails/recent'];
                const gResults = await Promise.all(gEps.map(ep => authFetch(`${API_BASE}/api/usage/${ep}?${qs}`)));
                setGuardrails({
                    summary: await sj(gResults[0], {}),
                    timeline: await sa(gResults[1]),
                    byUser: await sa(gResults[2]),
                    byCategory: await sa(gResults[3]),
                    recent: await sa(gResults[4]),
                });
            } catch (err) { console.error("Failed to load usage", err); }
            setLoading(false);
        };
        fetchUsage();
    }, [buildQS]);

    // Dropdown options
    const userOptions = useMemo(() => data.users.map(u => ({ value: u.user_id, label: u.display_name || u.user_id })), [data.users]);
    const agentOptions = useMemo(() => data.agents.map(a => ({ value: a.agent_id || a.agent_name, label: a.agent_name || 'Direct Chat' })), [data.agents]);
    const modelOptions = useMemo(() => data.models.map(m => ({ value: m.model, label: shortModel(m.model) })), [data.models]);
    const sourceOptions = useMemo(() => data.sources.map(s => ({ value: s.source, label: getSourceDetails(s.source).label })), [data.sources]);

    // Group modelsByAgent by agent
    const agentModelGroups = useMemo(() => {
        const map = new Map();
        for (const row of data.modelsByAgent) {
            const key = row.agent_name || 'Direct Chat';
            if (!map.has(key)) map.set(key, { agent_name: key, agent_id: row.agent_id, models: [], total_tokens: 0, estimated_cost: 0 });
            const group = map.get(key);
            group.models.push(row);
            group.total_tokens += row.total_tokens || 0;
            group.estimated_cost += row.estimated_cost || 0;
        }
        return Array.from(map.values()).sort((a, b) => b.total_tokens - a.total_tokens);
    }, [data.modelsByAgent]);

    const clearFilters = () => { setFilterUser(null); setFilterAgent(null); setFilterModel(null); setFilterSource(null); };

    const maxUserTokens = Math.max(...data.users.map(u => u.total_tokens || 0), 1);
    const maxModelTokens = Math.max(...data.models.map(m => m.total_tokens || 0), 1);

    // Table header keys
    const tableHeaders = [
        { key: 'usage.user', align: 'left' },
        { key: 'usage.model', align: 'left' },
        { key: 'usage.in_tokens', align: 'right', color: '#3b82f6' },
        { key: 'usage.out_tokens', align: 'right', color: '#f59e0b' },
        { key: 'usage.total', align: 'right' },
        { key: 'usage.in_cost', align: 'right', color: '#3b82f6' },
        { key: 'usage.out_cost', align: 'right', color: '#f59e0b' },
        { key: 'usage.total_cost', align: 'right' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>{t('usage.title')}</h2>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontWeight: 400 }}>{t('usage.subtitle')}</p>
                </div>
                <div style={{ display: 'flex', padding: 2, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    {[7, 30, 90].map(d => (
                        <button key={d} onClick={() => setDays(d)} style={{
                            padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: d === days ? 'var(--bg-primary)' : 'transparent',
                            color: d === days ? 'var(--text-primary)' : 'var(--text-muted)',
                            boxShadow: d === days ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                            transition: 'all 0.15s',
                        }}>{d}d</button>
                    ))}
                </div>
            </div>

            {/* ── Filter Bar ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                padding: '6px 10px', borderRadius: 10,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 2 }}>
                    <Filter style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('usage.filters')}</span>
                </div>
                <FilterPill icon={Users} value={filterUser} onChange={setFilterUser} options={userOptions} placeholder={t('usage.all_users')} />
                <FilterPill icon={Bot} value={filterAgent} onChange={setFilterAgent} options={agentOptions} placeholder={t('usage.all_agents')} />
                <FilterPill icon={Cpu} value={filterModel} onChange={setFilterModel} options={modelOptions} placeholder={t('usage.all_models')} />
                <FilterPill icon={Activity} value={filterSource} onChange={setFilterSource} options={sourceOptions} placeholder={t('usage.all_sources')} />
                {hasFilters && (
                    <button onClick={clearFilters} style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
                        borderRadius: 6, border: 'none', background: 'var(--bg-tertiary)',
                        fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer',
                    }}><X style={{ width: 10, height: 10 }} /> {t('usage.clear')}</button>
                )}
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                        {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 80, borderRadius: 12, background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
                    </div>
                    <div style={{ height: 90, borderRadius: 12, background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
            ) : (
                <>
                    {/* ── Summary Cards ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                        <StatCard icon={Zap} label={t('usage.ai_calls')} color="#6366f1"
                            value={data.summary?.total_calls?.toLocaleString() || '0'} />
                        <StatCard icon={BarChart3} label={t('usage.total_tokens')} color="#3b82f6"
                            value={fNum(data.summary?.total_tokens)}
                            sub={<InOutLabel input={data.summary?.total_prompt_tokens} output={data.summary?.total_completion_tokens}
                                showCost inputCost={data.summary?.total_input_cost} outputCost={data.summary?.total_output_cost} />} />
                        <StatCard icon={DollarSign} label={t('usage.est_cost')} color="#10b981"
                            value={fCur(data.summary?.total_estimated_cost)}
                            sub={
                                <div style={{ display: 'flex', gap: 10, fontSize: 10 }}>
                                    <span style={{ color: '#3b82f6', fontWeight: 600 }}>In: {fCur(data.summary?.total_input_cost)}</span>
                                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>Out: {fCur(data.summary?.total_output_cost)}</span>
                                </div>
                            } />
                        <StatCard icon={Users} label={t('usage.active_users')} color="#f59e0b"
                            value={data.summary?.unique_users || data.users.length || 0} />
                    </div>

                    {/* ── Trend ── */}
                    <TrendChart
                        timeline={data.timeline}
                        title={t('usage.token_trend')}
                        avgLabel={t('usage.avg_per_day')}
                        noDataLabel={t('usage.no_data')}
                    />

                    {/* ── Two Column: Users + Models ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                        {/* Top Users */}
                        <div>
                            <SectionTitle icon={Users} right={<Legend inputLabel={t('usage.input')} outputLabel={t('usage.output')} />}>{t('usage.top_users')}</SectionTitle>
                            <Card>
                                {data.users.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('usage.no_active_users')}</div>
                                ) : data.users.slice(0, 8).map((u, i) => (
                                    <ListRow key={i} onClick={() => setFilterUser(u.user_id)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                            <Avatar name={u.display_name} color={getColor(i)} />
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {u.display_name}
                                                </span>
                                                <InOutBar input={u.prompt_tokens} output={u.completion_tokens} height={3} style={{ marginTop: 4, maxWidth: 100 }} />
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 10 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fNum(u.total_tokens)}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{fCur(u.estimated_cost)}</div>
                                        </div>
                                    </ListRow>
                                ))}
                            </Card>
                        </div>

                        {/* By Model */}
                        <div>
                            <SectionTitle icon={Cpu} right={<Legend inputLabel={t('usage.input')} outputLabel={t('usage.output')} />}>{t('usage.by_model')}</SectionTitle>
                            <Card>
                                {data.models.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('usage.no_model_data')}</div>
                                ) : data.models.slice(0, 8).map((m, i) => (
                                    <ListRow key={i} onClick={() => setFilterModel(m.model)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                            <IconBadge icon={Cpu} color={getColor(i)} />
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                    title={m.model}>
                                                    {shortModel(m.model)}
                                                </span>
                                                <InOutBar input={m.prompt_tokens} output={m.completion_tokens} height={3} style={{ marginTop: 4, maxWidth: 100 }} />
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 10 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fNum(m.total_tokens)}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{fCur(m.estimated_cost)} · {m.calls} {t('usage.calls')}</div>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 1, fontSize: 9 }}>
                                                <span style={{ color: '#3b82f6', fontWeight: 500 }}>In: {fCur(m.input_cost)}</span>
                                                <span style={{ color: '#f59e0b', fontWeight: 500 }}>Out: {fCur(m.output_cost)}</span>
                                            </div>
                                        </div>
                                    </ListRow>
                                ))}
                            </Card>
                        </div>
                    </div>

                    {/* ── Two Column: Sources + Model × Agent ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                        {/* By Source */}
                        <div>
                            <SectionTitle icon={Activity}>{t('usage.by_app_area')}</SectionTitle>
                            <Card>
                                {data.sources.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('usage.no_usage_recorded')}</div>
                                ) : data.sources.map((s, i) => {
                                    const d = getSourceDetails(s.source);
                                    const Icon = d.icon;
                                    return (
                                        <ListRow key={i} onClick={() => setFilterSource(s.source)}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                <IconBadge icon={Icon} color={d.color} />
                                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{d.label}</span>
                                                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{s.calls} {t('usage.calls')}</span>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 10 }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fNum(s.total_tokens)}</div>
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{fCur(s.estimated_cost)}</div>
                                            </div>
                                        </ListRow>
                                    );
                                })}
                            </Card>
                        </div>

                        {/* Model × Agent — grouped by agent, expandable */}
                        <div>
                            <SectionTitle icon={Bot}>{t('usage.models_per_agent')}</SectionTitle>
                            <Card>
                                {agentModelGroups.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{t('usage.no_data_short')}</div>
                                ) : agentModelGroups.slice(0, 8).map((group, gi) => {
                                    const isExpanded = expandedAgent === group.agent_name;
                                    return (
                                        <div key={gi}>
                                            <ListRow onClick={() => setExpandedAgent(isExpanded ? null : group.agent_name)}
                                                style={{ borderBottom: isExpanded ? 'none' : undefined }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                    <IconBadge icon={Bot} color={getColor(gi)} />
                                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {group.agent_name}
                                                        </span>
                                                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                                                            {group.models.length} model{group.models.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fNum(group.total_tokens)}</div>
                                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fCur(group.estimated_cost)}</div>
                                                    </div>
                                                    <ChevronRight style={{
                                                        width: 13, height: 13, color: 'var(--text-muted)',
                                                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                                                        transition: 'transform 0.2s ease',
                                                    }} />
                                                </div>
                                            </ListRow>
                                            {/* Expanded model sub-rows */}
                                            {isExpanded && group.models.map((m, mi) => (
                                                <div key={mi} style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '6px 14px 6px 48px', background: 'var(--bg-secondary)',
                                                    borderBottom: '1px solid var(--border-subtle)',
                                                    fontSize: 11,
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <Cpu style={{ width: 11, height: 11, color: getColor(mi + 3) }} />
                                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shortModel(m.model)}</span>
                                                        <InOutLabel input={m.prompt_tokens} output={m.completion_tokens} showCost inputCost={m.input_cost} outputCost={m.output_cost} />
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fNum(m.total_tokens)}</span>
                                                        <span style={{ color: 'var(--text-muted)' }}>{fCur(m.estimated_cost)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </Card>
                        </div>
                    </div>

                    {/* ── Model × User Table ── */}
                    {data.modelsByUser.length > 0 && (
                        <div>
                            <SectionTitle icon={Users} right={<Legend inputLabel={t('usage.input')} outputLabel={t('usage.output')} />}>{t('usage.model_usage_by_user')}</SectionTitle>
                            <Card>
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1.5fr 1fr repeat(3, 70px) repeat(3, 72px)',
                                    padding: '8px 14px', background: 'var(--bg-tertiary)',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    overflowX: 'auto',
                                }}>
                                    {tableHeaders.map(h => (
                                        <span key={h.key} style={{
                                            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                                            color: h.color || 'var(--text-muted)',
                                            textAlign: h.align,
                                            whiteSpace: 'nowrap',
                                        }}>{t(h.key)}</span>
                                    ))}
                                </div>
                                {data.modelsByUser.slice(0, 20).map((row, i) => (
                                    <div key={i} style={{
                                        display: 'grid', gridTemplateColumns: '1.5fr 1fr repeat(3, 70px) repeat(3, 72px)',
                                        padding: '7px 14px', alignItems: 'center',
                                        background: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        transition: 'background 0.1s',
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)'}
                                    >
                                        <span style={{
                                            fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            cursor: 'pointer',
                                        }} onClick={() => setFilterUser(row.user_id)}>
                                            {row.display_name || row.user_id}
                                        </span>
                                        <span style={{
                                            fontSize: 11, fontWeight: 600, color: getColor(i),
                                            display: 'flex', alignItems: 'center', gap: 4,
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            cursor: 'pointer',
                                        }} onClick={() => setFilterModel(row.model)}>
                                            <Cpu style={{ width: 10, height: 10, flexShrink: 0 }} />
                                            {shortModel(row.model)}
                                        </span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', textAlign: 'right' }}>{fNum(row.prompt_tokens)}</span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', textAlign: 'right' }}>{fNum(row.completion_tokens)}</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{fNum(row.total_tokens)}</span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', textAlign: 'right' }}>{fCur(row.input_cost)}</span>
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', textAlign: 'right' }}>{fCur(row.output_cost)}</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{fCur(row.estimated_cost)}</span>
                                    </div>
                                ))}
                            </Card>
                        </div>
                    )}

                    {/* ════════════════════════════════════════════════════════ */}
                    {/* SAFETY & GUARDRAILS SECTION                            */}
                    {/* ════════════════════════════════════════════════════════ */}
                    <div style={{ marginTop: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #ef444420, #f59e0b20)' }}>
                                <Shield style={{ width: 15, height: 15, color: '#ef4444' }} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>Safety & Guardrails</h3>
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, fontWeight: 400 }}>Content moderation, PII detection & regex guardrail events</p>
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                            <StatCard icon={Shield} label="Total Violations" color="#ef4444"
                                value={guardrails.summary?.total_events?.toLocaleString() || '0'}
                                sub={<span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{guardrails.summary?.unique_users || 0} users</span>} />
                            <StatCard icon={AlertTriangle} label="Moderation" color="#f59e0b"
                                value={guardrails.summary?.moderation_count?.toLocaleString() || '0'}
                                sub={<span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Content safety blocks</span>} />
                            <StatCard icon={Fingerprint} label="PII Detections" color="#8b5cf6"
                                value={guardrails.summary?.pii_count?.toLocaleString() || '0'}
                                sub={<span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Personal data flagged</span>} />
                            <StatCard icon={Eye} label="Regex Matches" color="#3b82f6"
                                value={guardrails.summary?.regex_count?.toLocaleString() || '0'}
                                sub={<span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Pattern-based blocks</span>} />
                        </div>

                        {/* Violation Timeline */}
                        {guardrails.timeline.length > 0 && (
                            <Card style={{ padding: '12px 16px', marginBottom: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <TrendingUp style={{ width: 13, height: 13, color: '#ef4444', opacity: 0.7 }} />
                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Violation Trend</span>
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, fontSize: 10 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} /> Moderation</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: '#8b5cf6', display: 'inline-block' }} /> PII</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: '#3b82f6', display: 'inline-block' }} /> Regex</span>
                                    </div>
                                </div>
                                {(() => {
                                    const maxVal = Math.max(...guardrails.timeline.map(t => Number(t.total) || 0), 1);
                                    return (
                                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 56 }}>
                                            {guardrails.timeline.map((t, i) => {
                                                const mod = Number(t.moderation) || 0;
                                                const pii = Number(t.pii) || 0;
                                                const reg = Number(t.regex) || 0;
                                                const total = mod + pii + reg;
                                                const h = (total / maxVal) * 100;
                                                const modH = total > 0 ? (mod / total) * h : 0;
                                                const piiH = total > 0 ? (pii / total) * h : 0;
                                                const regH = total > 0 ? (reg / total) * h : 0;
                                                return (
                                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }} title={`${t.period}: ${total} events`}>
                                                        {regH > 0 && <div style={{ height: `${regH}%`, background: '#3b82f6', borderRadius: '2px 2px 0 0', minHeight: 2 }} />}
                                                        {piiH > 0 && <div style={{ height: `${piiH}%`, background: '#8b5cf6', minHeight: 2 }} />}
                                                        {modH > 0 && <div style={{ height: `${modH}%`, background: '#f59e0b', borderRadius: total === mod ? '2px 2px 0 0' : 0, minHeight: 2 }} />}
                                                        {total === 0 && <div style={{ height: 2, background: 'var(--bg-tertiary)', borderRadius: 2 }} />}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </Card>
                        )}

                        {/* Two Column: By Category + By User */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                            <div>
                                <SectionTitle icon={AlertTriangle}>By Violation Category</SectionTitle>
                                <Card>
                                    {guardrails.byCategory.length === 0 ? (
                                        <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No violations recorded</div>
                                    ) : guardrails.byCategory.slice(0, 10).map((c, i) => {
                                        const typeColor = c.violation_type === 'moderation' ? '#f59e0b' : c.violation_type === 'pii' ? '#8b5cf6' : '#3b82f6';
                                        return (
                                            <ListRow key={i}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                    <div style={{ width: 26, height: 26, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${typeColor}12`, flexShrink: 0 }}>
                                                        {c.violation_type === 'moderation' ? <AlertTriangle style={{ width: 13, height: 13, color: typeColor }} /> :
                                                         c.violation_type === 'pii' ? <Fingerprint style={{ width: 13, height: 13, color: typeColor }} /> :
                                                         <Eye style={{ width: 13, height: 13, color: typeColor }} />}
                                                    </div>
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.category}</div>
                                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{c.violation_type}</div>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: typeColor, flexShrink: 0 }}>{c.count}</div>
                                            </ListRow>
                                        );
                                    })}
                                </Card>
                            </div>
                            <div>
                                <SectionTitle icon={Users}>Violations by User</SectionTitle>
                                <Card>
                                    {guardrails.byUser.length === 0 ? (
                                        <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No violations recorded</div>
                                    ) : guardrails.byUser.slice(0, 8).map((u, i) => (
                                        <ListRow key={i}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                                <Avatar name={u.display_name} color={getColor(i + 5)} />
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.display_name}</div>
                                                    <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: 10 }}>
                                                        {Number(u.moderation) > 0 && <span style={{ color: '#f59e0b', fontWeight: 600 }}>{u.moderation} mod</span>}
                                                        {Number(u.pii) > 0 && <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{u.pii} pii</span>}
                                                        {Number(u.regex) > 0 && <span style={{ color: '#3b82f6', fontWeight: 600 }}>{u.regex} regex</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', flexShrink: 0 }}>{u.total}</div>
                                        </ListRow>
                                    ))}
                                </Card>
                            </div>
                        </div>

                        {/* Recent Events Table */}
                        {guardrails.recent.length > 0 && (
                            <div>
                                <SectionTitle icon={Clock}>Recent Guardrail Events</SectionTitle>
                                <Card>
                                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px 1.2fr 65px 80px', padding: '8px 14px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-subtle)' }}>
                                        {['Time', 'User', 'Type', 'Categories', 'Dir', 'Action'].map(h => (
                                            <span key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{h}</span>
                                        ))}
                                    </div>
                                    {guardrails.recent.slice(0, 20).map((ev, i) => {
                                        const typeColor = ev.violation_type === 'moderation' ? '#f59e0b' : ev.violation_type === 'pii' ? '#8b5cf6' : '#3b82f6';
                                        const actionColor = ev.action_taken === 'hard_block' || ev.action_taken === 'blocked' ? '#ef4444' : ev.action_taken === 'tokenized' ? '#8b5cf6' : ev.action_taken === 'redacted' ? '#3b82f6' : '#f59e0b';
                                        return (
                                            <div key={i} style={{
                                                display: 'grid', gridTemplateColumns: '120px 1fr 80px 1.2fr 65px 80px',
                                                padding: '6px 14px', alignItems: 'center',
                                                background: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                                                borderBottom: '1px solid var(--border-subtle)', fontSize: 11,
                                            }}>
                                                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{new Date(ev.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.display_name || ev.user_id || 'Unknown'}</span>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: 99, background: typeColor, display: 'inline-block' }} />
                                                    <span style={{ fontWeight: 600, color: typeColor, textTransform: 'capitalize' }}>{ev.violation_type}</span>
                                                </span>
                                                <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ev.violation_categories}>{ev.violation_categories || '—'}</span>
                                                <span style={{ color: ev.direction === 'output' ? '#f59e0b' : '#3b82f6', fontWeight: 600, textTransform: 'capitalize' }}>{ev.direction}</span>
                                                <span style={{ fontWeight: 600, color: actionColor, fontSize: 10 }}>{(ev.action_taken || '').replace('_', ' ')}</span>
                                            </div>
                                        );
                                    })}
                                </Card>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default UsageSection;
