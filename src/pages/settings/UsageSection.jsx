import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { Bot, MessageSquare, BookOpen, Search, Code, LayoutTemplate, Filter, X, Cpu, Users, ChevronDown, Activity, ArrowUpRight, ArrowDownLeft, BarChart3, Zap, DollarSign, TrendingUp, ChevronRight } from 'lucide-react';

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
        borderRadius: 14, overflow: 'hidden', ...style,
    }}>{children}</div>
);

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
    <Card style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <div style={{
                width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${color}15`,
            }}>
                <Icon style={{ width: 15, height: 15, color }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{label}</span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
        {sub && <div style={{ marginTop: 4 }}>{sub}</div>}
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

const Legend = () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6', display: 'inline-block' }} /> Input
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b', display: 'inline-block' }} /> Output
        </span>
    </div>
);

const SectionTitle = ({ children, icon: Icon, right }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {Icon && <Icon style={{ width: 15, height: 15, color: 'var(--accent-primary)', opacity: 0.7 }} />}
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{children}</span>
        </div>
        {right}
    </div>
);

const ListRow = ({ children, onClick, style: s }) => (
    <div
        onClick={onClick}
        style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 16px', background: 'var(--bg-primary)',
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
        width: 30, height: 30, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#fff',
        background: `linear-gradient(135deg, ${color || 'var(--accent-primary)'}, ${color || 'var(--accent-primary)'}99)`,
    }}>
        {(name || '?')[0].toUpperCase()}
    </div>
);

const IconBadge = ({ icon: Icon, color, size = 30 }) => (
    <div style={{
        width: size, height: size, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, background: `${color}12`,
    }}>
        <Icon style={{ width: size * 0.5, height: size * 0.5, color }} />
    </div>
);

/* Sparkline */
const TrendChart = ({ timeline }) => {
    if (!timeline?.length) return (
        <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 10 }}>
            No usage data for this period
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
        <Card style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TrendingUp style={{ width: 14, height: 14, color: 'var(--accent-primary)', opacity: 0.7 }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Token Consumption Trend</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Avg {fNum(avgDay)} / day</span>
            </div>
            <div style={{ height: 72, width: '100%', position: 'relative' }}>
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 24 }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>Usage & Monitoring</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, fontWeight: 400 }}>Track AI consumption across your organisation</p>
                </div>
                <div style={{ display: 'flex', padding: 3, borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    {[7, 30, 90].map(d => (
                        <button key={d} onClick={() => setDays(d)} style={{
                            padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: 'none', cursor: 'pointer',
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
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                padding: '8px 12px', borderRadius: 12,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginRight: 4 }}>
                    <Filter style={{ width: 13, height: 13, color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filters</span>
                </div>
                <FilterPill icon={Users} value={filterUser} onChange={setFilterUser} options={userOptions} placeholder="All Users" />
                <FilterPill icon={Bot} value={filterAgent} onChange={setFilterAgent} options={agentOptions} placeholder="All Agents" />
                <FilterPill icon={Cpu} value={filterModel} onChange={setFilterModel} options={modelOptions} placeholder="All Models" />
                <FilterPill icon={Activity} value={filterSource} onChange={setFilterSource} options={sourceOptions} placeholder="All Sources" />
                {hasFilters && (
                    <button onClick={clearFilters} style={{
                        display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                        borderRadius: 8, border: 'none', background: 'var(--bg-tertiary)',
                        fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer',
                    }}><X style={{ width: 11, height: 11 }} /> Clear</button>
                )}
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                        {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 100, borderRadius: 14, background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
                    </div>
                    <div style={{ height: 120, borderRadius: 14, background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
            ) : (
                <>
                    {/* ── Summary Cards ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                        <StatCard icon={Zap} label="AI Calls" color="#6366f1"
                            value={data.summary?.total_calls?.toLocaleString() || '0'} />
                        <StatCard icon={BarChart3} label="Total Tokens" color="#3b82f6"
                            value={fNum(data.summary?.total_tokens)}
                            sub={<InOutLabel input={data.summary?.total_prompt_tokens} output={data.summary?.total_completion_tokens}
                                showCost inputCost={data.summary?.total_input_cost} outputCost={data.summary?.total_output_cost} />} />
                        <StatCard icon={DollarSign} label="Est. Cost" color="#10b981"
                            value={fCur(data.summary?.total_estimated_cost)}
                            sub={
                                <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                                    <span style={{ color: '#3b82f6', fontWeight: 600 }}>In: {fCur(data.summary?.total_input_cost)}</span>
                                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>Out: {fCur(data.summary?.total_output_cost)}</span>
                                </div>
                            } />
                        <StatCard icon={Users} label="Active Users" color="#f59e0b"
                            value={data.summary?.unique_users || data.users.length || 0} />
                    </div>

                    {/* ── Trend ── */}
                    <TrendChart timeline={data.timeline} />

                    {/* ── Two Column: Users + Models ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                        {/* Top Users */}
                        <div>
                            <SectionTitle icon={Users} right={<Legend />}>Top Users</SectionTitle>
                            <Card>
                                {data.users.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No active users</div>
                                ) : data.users.slice(0, 8).map((u, i) => (
                                    <ListRow key={i} onClick={() => setFilterUser(u.user_id)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                            <Avatar name={u.display_name} color={getColor(i)} />
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {u.display_name}
                                                </span>
                                                <InOutBar input={u.prompt_tokens} output={u.completion_tokens} height={4} style={{ marginTop: 6, maxWidth: 120 }} />
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 12 }}>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{fNum(u.total_tokens)}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{fCur(u.estimated_cost)}</div>
                                        </div>
                                    </ListRow>
                                ))}
                            </Card>
                        </div>

                        {/* By Model */}
                        <div>
                            <SectionTitle icon={Cpu} right={<Legend />}>By Model</SectionTitle>
                            <Card>
                                {data.models.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No model data</div>
                                ) : data.models.slice(0, 8).map((m, i) => (
                                    <ListRow key={i} onClick={() => setFilterModel(m.model)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                            <IconBadge icon={Cpu} color={getColor(i)} />
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                    title={m.model}>
                                                    {shortModel(m.model)}
                                                </span>
                                                <InOutBar input={m.prompt_tokens} output={m.completion_tokens} height={4} style={{ marginTop: 6, maxWidth: 120 }} />
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 12 }}>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{fNum(m.total_tokens)}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{fCur(m.estimated_cost)} · {m.calls} calls</div>
                                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2, fontSize: 10 }}>
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                        {/* By Source */}
                        <div>
                            <SectionTitle icon={Activity}>By App Area</SectionTitle>
                            <Card>
                                {data.sources.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No usage recorded</div>
                                ) : data.sources.map((s, i) => {
                                    const d = getSourceDetails(s.source);
                                    const Icon = d.icon;
                                    return (
                                        <ListRow key={i} onClick={() => setFilterSource(s.source)}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                                <IconBadge icon={Icon} color={d.color} />
                                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{d.label}</span>
                                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{s.calls} calls</span>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 12 }}>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{fNum(s.total_tokens)}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{fCur(s.estimated_cost)}</div>
                                            </div>
                                        </ListRow>
                                    );
                                })}
                            </Card>
                        </div>

                        {/* Model × Agent — grouped by agent, expandable */}
                        <div>
                            <SectionTitle icon={Bot}>Models per Agent</SectionTitle>
                            <Card>
                                {agentModelGroups.length === 0 ? (
                                    <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>No data</div>
                                ) : agentModelGroups.slice(0, 8).map((group, gi) => {
                                    const isExpanded = expandedAgent === group.agent_name;
                                    return (
                                        <div key={gi}>
                                            <ListRow onClick={() => setExpandedAgent(isExpanded ? null : group.agent_name)}
                                                style={{ borderBottom: isExpanded ? 'none' : undefined }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                                    <IconBadge icon={Bot} color={getColor(gi)} />
                                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {group.agent_name}
                                                        </span>
                                                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                                                            {group.models.length} model{group.models.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{fNum(group.total_tokens)}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fCur(group.estimated_cost)}</div>
                                                    </div>
                                                    <ChevronRight style={{
                                                        width: 14, height: 14, color: 'var(--text-muted)',
                                                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                                                        transition: 'transform 0.2s ease',
                                                    }} />
                                                </div>
                                            </ListRow>
                                            {/* Expanded model sub-rows */}
                                            {isExpanded && group.models.map((m, mi) => (
                                                <div key={mi} style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '8px 16px 8px 56px', background: 'var(--bg-secondary)',
                                                    borderBottom: '1px solid var(--border-subtle)',
                                                    fontSize: 12,
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <Cpu style={{ width: 12, height: 12, color: getColor(mi + 3) }} />
                                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{shortModel(m.model)}</span>
                                                        <InOutLabel input={m.prompt_tokens} output={m.completion_tokens} showCost inputCost={m.input_cost} outputCost={m.output_cost} />
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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
                            <SectionTitle icon={Users} right={<Legend />}>Model Usage by User</SectionTitle>
                            <Card>
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1.2fr 1fr repeat(6, 68px)',
                                    padding: '10px 16px', background: 'var(--bg-tertiary)',
                                    borderBottom: '1px solid var(--border-subtle)',
                                    overflowX: 'auto',
                                }}>
                                    {['User', 'Model', 'In Tokens', 'Out Tokens', 'Total', 'In Cost', 'Out Cost', 'Total Cost'].map(h => (
                                        <span key={h} style={{
                                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                                            color: h.startsWith('In') ? '#3b82f6' : h.startsWith('Out') ? '#f59e0b' : 'var(--text-muted)',
                                            textAlign: ['User', 'Model'].includes(h) ? 'left' : 'right',
                                            whiteSpace: 'nowrap',
                                        }}>{h}</span>
                                    ))}
                                </div>
                                {data.modelsByUser.slice(0, 20).map((row, i) => (
                                    <div key={i} style={{
                                        display: 'grid', gridTemplateColumns: '1.2fr 1fr repeat(6, 68px)',
                                        padding: '10px 16px', alignItems: 'center',
                                        background: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        transition: 'background 0.1s',
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)'}
                                    >
                                        <span style={{
                                            fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            cursor: 'pointer',
                                        }} onClick={() => setFilterUser(row.user_id)}>
                                            {row.display_name || row.user_id}
                                        </span>
                                        <span style={{
                                            fontSize: 12, fontWeight: 600, color: getColor(i),
                                            display: 'flex', alignItems: 'center', gap: 5,
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            cursor: 'pointer',
                                        }} onClick={() => setFilterModel(row.model)}>
                                            <Cpu style={{ width: 11, height: 11, flexShrink: 0 }} />
                                            {shortModel(row.model)}
                                        </span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6', textAlign: 'right' }}>{fNum(row.prompt_tokens)}</span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', textAlign: 'right' }}>{fNum(row.completion_tokens)}</span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{fNum(row.total_tokens)}</span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6', textAlign: 'right' }}>{fCur(row.input_cost)}</span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', textAlign: 'right' }}>{fCur(row.output_cost)}</span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{fCur(row.estimated_cost)}</span>
                                    </div>
                                ))}
                            </Card>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default UsageSection;
