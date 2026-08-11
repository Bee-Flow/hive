import React, { useState, useEffect, useMemo } from 'react';
import { Activity, Zap, DollarSign, BarChart3, Bot, MessageSquare, BookOpen, Search, Code, LayoutTemplate } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';

const fNum = (n) => {
    if (n == null) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
};
const fCur = (c) => `$${(c || 0).toFixed(2)}`;

const shortModel = (m) => {
    if (!m) return 'Unknown';
    return m.replace(/^(openai\/|anthropic\/|google\/|azure\/|mistral\/)/, '')
            .replace(/-\d{4}-\d{2}-\d{2}$/, '');
};

const SOURCE_MAP = {
    agent: { label: 'Agent Chat', icon: Bot, color: '#0ea5e9' },
    chat: { label: 'Agent Chat', icon: Bot, color: '#0ea5e9' },
    direct: { label: 'Direct Chat', icon: MessageSquare, color: '#10b981' },
    notebook: { label: 'Notebooks', icon: BookOpen, color: '#14b8a6' },
    research: { label: 'Research', icon: Search, color: '#f59e0b' },
    template: { label: 'Templates', icon: LayoutTemplate, color: '#ef4444' },
    designer: { label: 'App Designer', icon: Code, color: '#0ea5e9' },
    agent_stream: { label: 'Agent Stream', icon: Bot, color: '#0ea5e9' },
};
const sourceFor = (k) => SOURCE_MAP[k] || { label: k || 'Other', icon: Bot, color: '#94a3b8' };

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
        {sub && <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
    </Card>
);

// Tiny inline SVG line — no chart dep. Renders a single sparkline over the
// daily cost timeline so the user can see spend trend at a glance.
const Sparkline = ({ data, color = '#0ea5e9', height = 60 }) => {
    if (!Array.isArray(data) || data.length < 2) {
        return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-muted)' }}>Not enough data yet</div>;
    }
    const max = Math.max(...data.map(d => d.value || 0), 0.01);
    const w = 600;
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = height - ((d.value || 0) / max) * (height - 8) - 4;
        return `${x},${y}`;
    }).join(' ');
    return (
        <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
            <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
        </svg>
    );
};

const ConsumerUsageSection = () => {
    const { t } = useTranslation();
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState(null);
    const [costTimeline, setCostTimeline] = useState([]);
    const [byModel, setByModel] = useState([]);
    const [bySource, setBySource] = useState([]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const [s, ct, m, src] = await Promise.all([
                    authFetch(`${API_BASE}/api/usage/summary?days=${days}`).then(r => r.ok ? r.json() : null),
                    authFetch(`${API_BASE}/api/usage/cost-timeline?days=${days}`).then(r => r.ok ? r.json() : []),
                    authFetch(`${API_BASE}/api/usage/by-model?days=${days}`).then(r => r.ok ? r.json() : []),
                    authFetch(`${API_BASE}/api/usage/sources?days=${days}`).then(r => r.ok ? r.json() : []),
                ]);
                if (cancelled) return;
                setSummary(s);
                setCostTimeline(Array.isArray(ct) ? ct : []);
                setByModel(Array.isArray(m) ? m : []);
                setBySource(Array.isArray(src) ? src : []);
            } catch (e) {
                console.error('[ConsumerUsage] load error:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [days]);

    const sparklinePoints = useMemo(() => {
        return costTimeline.map(row => ({
            value: Number(row.billed_cost ?? row.total_cost ?? row.cost ?? row.value ?? 0),
            label: row.date || row.day || '',
        }));
    }, [costTimeline]);

    // Backend redacts token/message counts for non-admin callers and replaces
    // estimated_cost with marked-up billed_cost. Detect that shape so the UI
    // shows a cost-only customer view.
    const isCustomerView = summary && summary.total_calls === undefined && summary.billed_cost !== undefined;
    const totalCost = isCustomerView
        ? Number(summary?.billed_cost || 0)
        : Number(summary?.combined_total_cost ?? summary?.total_estimated_cost ?? 0);

    if (loading && !summary) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-6 w-48 bg-[var(--bg-tertiary)] rounded-lg" />
                <div className="grid grid-cols-3 gap-3">
                    <div className="h-24 bg-[var(--bg-tertiary)] rounded-xl" />
                    <div className="h-24 bg-[var(--bg-tertiary)] rounded-xl" />
                    <div className="h-24 bg-[var(--bg-tertiary)] rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5 animate-fadeIn">
            {/* Header + range picker */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">
                        {t('settings.usage_monitoring', 'Usage & Monitoring')}
                    </h2>
                    <p className="text-sm text-[var(--text-muted)] mt-1">
                        Track your AI usage and spend
                    </p>
                </div>
                <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    {[7, 30, 90].map(d => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                            style={{
                                background: days === d ? 'var(--accent-primary)' : 'transparent',
                                color: days === d ? '#fff' : 'var(--text-muted)',
                            }}
                        >
                            {d}d
                        </button>
                    ))}
                </div>
            </div>

            {/* Stat cards */}
            {isCustomerView ? (
                <div className="grid grid-cols-1 gap-3">
                    <StatCard
                        icon={DollarSign}
                        label="AI usage this period"
                        value={`€${totalCost.toFixed(2)}`}
                        color="#10b981"
                    />
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-3">
                    <StatCard
                        icon={DollarSign}
                        label="Estimated cost"
                        value={fCur(totalCost)}
                        sub={`In: ${fCur(summary?.total_input_cost ?? 0)} · Out: ${fCur(summary?.total_output_cost ?? 0)}`}
                        color="#10b981"
                    />
                    <StatCard
                        icon={Zap}
                        label="AI calls"
                        value={fNum(summary?.total_calls ?? 0)}
                        sub={`${fNum(summary?.total_tokens ?? 0)} tokens`}
                        color="#0ea5e9"
                    />
                    <StatCard
                        icon={Activity}
                        label="Tokens"
                        value={fNum(summary?.total_tokens ?? 0)}
                        sub={`In: ${fNum(summary?.total_prompt_tokens || 0)} · Out: ${fNum(summary?.total_completion_tokens || 0)}`}
                        color="#f59e0b"
                    />
                </div>
            )}

            {/* Cost trend */}
            <Card>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BarChart3 style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Cost trend</span>
                </div>
                <div style={{ padding: '16px' }}>
                    <Sparkline data={sparklinePoints} color="#10b981" />
                </div>
            </Card>

            {/* Per-model + per-source side by side — admin/raw view only */}
            {!isCustomerView && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        Per model
                    </div>
                    {byModel.length === 0 ? (
                        <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>No model usage yet.</div>
                    ) : (
                        <div>
                            {byModel.slice(0, 8).map((row, i) => (
                                <div
                                    key={row.model || i}
                                    style={{ padding: '10px 16px', borderBottom: i < Math.min(byModel.length, 8) - 1 ? '1px solid var(--border-subtle)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                >
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{shortModel(row.model)}</p>
                                        <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                            {fNum(row.total_tokens || (row.prompt_tokens || 0) + (row.completion_tokens || 0))} tokens · {row.total_calls || 0} calls
                                        </p>
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{fCur(row.total_cost || row.estimated_cost || 0)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
                <Card>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                        Per source
                    </div>
                    {bySource.length === 0 ? (
                        <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)' }}>No source usage yet.</div>
                    ) : (
                        <div>
                            {bySource.slice(0, 8).map((row, i) => {
                                const meta = sourceFor(row.source);
                                const Icon = meta.icon;
                                return (
                                    <div
                                        key={row.source || i}
                                        style={{ padding: '10px 16px', borderBottom: i < Math.min(bySource.length, 8) - 1 ? '1px solid var(--border-subtle)' : 'none', display: 'flex', alignItems: 'center', gap: 10 }}
                                    >
                                        <div style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${meta.color}15` }}>
                                            <Icon style={{ width: 14, height: 14, color: meta.color }} />
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{meta.label}</p>
                                            <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{row.total_calls || 0} calls · {fNum(row.total_tokens || 0)} tokens</p>
                                        </div>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{fCur(row.total_cost || row.estimated_cost || 0)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Card>
            </div>
            )}
        </div>
    );
};

export default ConsumerUsageSection;
