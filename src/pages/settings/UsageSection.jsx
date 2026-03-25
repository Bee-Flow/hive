import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { Calendar, Bot, MessageSquare, BookOpen, Search, Code, LayoutTemplate } from 'lucide-react';

// Formatter for big numbers
const fNum = (n) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n?.toLocaleString() || '0';
};

// Formatter for currency
const fCur = (c) => `$${(c || 0).toFixed(2)}`;

// Source mapping to pretty labels and icons
const getSourceDetails = (source) => {
    switch (source) {
        case 'agent':
        case 'chat': return { label: 'Agent Chat', icon: Bot, color: '#3b82f6' };
        case 'direct': return { label: 'Direct Chat', icon: MessageSquare, color: '#10b981' };
        case 'notebook': return { label: 'Notebooks', icon: BookOpen, color: '#8b5cf6' };
        case 'research': return { label: 'Research', icon: Search, color: '#f59e0b' };
        case 'template': return { label: 'Templates', icon: LayoutTemplate, color: '#ef4444' };
        case 'designer': return { label: 'App Designer', icon: Code, color: '#0ea5e9' };
        default: return { label: source || 'Unknown', icon: Bot, color: '#64748b' };
    }
};

/* ── Sparkline Chart ─────────────────────────────────────────────────────── */
const TrendChart = ({ timeline }) => {
    if (!timeline?.length) return (
        <div className="h-16 flex items-center justify-center text-[11px] text-[var(--text-muted)] border rounded-lg" style={{ borderColor: 'var(--border-subtle)' }}>
            No usage data for this period
        </div>
    );

    const maxTokens = Math.max(...timeline.map(t => t.total_tokens || 0), 10);
    const points = timeline.map((t, i) => {
        const x = (i / (timeline.length - 1)) * 100;
        const y = 100 - ((t.total_tokens || 0) / maxTokens) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="h-20 w-full relative">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                {/* Grid line */}
                <line x1="0" y1="100" x2="100" y2="100" stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="1 3" />
                
                {/* Area fill */}
                <polygon points={`0,100 ${points} 100,100`} fill="url(#sparkGradient)" opacity="0.3" />
                
                {/* Line */}
                <polyline points={points} fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                
                <defs>
                    <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute top-0 right-0 text-[10px] text-[var(--text-muted)] opacity-60">Avg {(timeline.reduce((s, t) => s + (t.total_tokens||0), 0) / timeline.length / 1000).toFixed(0)}k / day</div>
        </div>
    );
};


/* ── Progress Bar segment ────────────────────────────────────────────────── */
const Bar = ({ value, max, color }) => {
    const pct = Math.min(100, Math.max(2, (value / (max || 1)) * 100));
    return (
        <div className="h-1.5 w-24 rounded-full bg-[var(--bg-tertiary)] overflow-hidden shrink-0">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
        </div>
    );
};


/* ── Main Component ──────────────────────────────────────────────────────── */
const UsageSection = () => {
    const [days, setDays] = useState(30);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        summary: null,
        timeline: [],
        users: [],
        sources: [],
        agents: []
    });

    useEffect(() => {
        const fetchUsage = async () => {
            setLoading(true);
            try {
                const [sumRes, timeRes, usrRes, srcRes, agtRes] = await Promise.all([
                    authFetch(`${API_BASE}/api/usage/summary?days=${days}`),
                    authFetch(`${API_BASE}/api/usage/timeline?days=${days}`),
                    authFetch(`${API_BASE}/api/usage/users?days=${days}`),
                    authFetch(`${API_BASE}/api/usage/sources?days=${days}`),
                    authFetch(`${API_BASE}/api/usage/agents?days=${days}`)
                ]);

                setData({
                    summary: await sumRes.json(),
                    timeline: await timeRes.json(),
                    users: await usrRes.json(),
                    sources: await srcRes.json(),
                    agents: await agtRes.json()
                });
            } catch (err) {
                console.error("Failed to load usage data", err);
            }
            setLoading(false);
        };
        fetchUsage();
    }, [days]);

    const maxUserTokens = Math.max(...data.users.map(u => u.total_tokens), 1);
    const maxSourceTokens = Math.max(...data.sources.map(s => s.total_tokens), 1);
    const maxAgentTokens = Math.max(...data.agents.map(a => a.total_tokens), 1);

    return (
        <div className="space-y-8 pb-4">
            
            {/* Header / Period Selector */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">Usage & Monitoring</h2>
                    <p className="text-sm text-[var(--text-muted)] mt-0.5">Track AI consumption across your organisation</p>
                </div>
                
                <div className="flex p-0.5 rounded-lg border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                    {[7, 30, 90].map(d => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className="px-4 py-1.5 text-[12px] font-medium rounded-md transition-colors"
                            style={{ 
                                background: d === days ? 'var(--bg-primary)' : 'transparent',
                                color: d === days ? 'var(--text-primary)' : 'var(--text-muted)',
                                boxShadow: d === days ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                            }}
                        >
                            {d}d
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="animate-pulse space-y-6">
                    <div className="grid grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-xl bg-[var(--bg-tertiary)]" />)}
                    </div>
                    <div className="h-32 rounded-xl bg-[var(--bg-tertiary)]" />
                    <div className="h-48 rounded-xl bg-[var(--bg-tertiary)]" />
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="p-4 rounded-xl border flex flex-col justify-center" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                            <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1">AI Calls</div>
                            <div className="text-2xl font-bold text-[var(--text-primary)]">{data.summary?.total_calls?.toLocaleString() || 0}</div>
                        </div>
                        <div className="p-4 rounded-xl border flex flex-col justify-center" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                            <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1">Total Tokens</div>
                            <div className="text-2xl font-bold text-[var(--text-primary)]">{fNum(data.summary?.total_tokens)}</div>
                        </div>
                        <div className="p-4 rounded-xl border flex flex-col justify-center" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                            <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1">Est. Cost</div>
                            <div className="text-2xl font-bold text-[var(--text-primary)]">{fCur(data.summary?.total_estimated_cost)}</div>
                        </div>
                        <div className="p-4 rounded-xl border flex flex-col justify-center" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                            <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1">Active Users</div>
                            <div className="text-2xl font-bold text-[var(--text-primary)]">{data.summary?.unique_users || data.users.length || 0}</div>
                        </div>
                    </div>

                    {/* Trend Chart */}
                    <div className="space-y-3">
                        <div className="text-[12px] font-semibold text-[var(--text-muted)]">Token Consumption Trend</div>
                        <TrendChart timeline={data.timeline} />
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        {/* Users Table */}
                        <div className="space-y-3">
                            <div className="text-[12px] font-semibold text-[var(--text-muted)]">Top Users</div>
                            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                                {data.users.length === 0 ? (
                                    <div className="p-4 text-center text-[12px] text-[var(--text-muted)]">No active users</div>
                                ) : (
                                    <div className="divide-y" style={{ divideColor: 'var(--border-subtle)' }}>
                                        {data.users.map((u, i) => (
                                            <div key={i} className="flex items-center justify-between p-3.5" style={{ background: 'var(--bg-primary)' }}>
                                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-medium text-white" style={{ background: 'var(--accent-primary)' }}>
                                                        {(u.display_name || '?')[0].toUpperCase()}
                                                    </div>
                                                    <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">{u.display_name}</span>
                                                </div>
                                                <div className="flex items-center gap-4 shrink-0">
                                                    <div className="text-right flex flex-col">
                                                        <span className="text-[12px] font-medium text-[var(--text-primary)]">{fNum(u.total_tokens)}</span>
                                                        <span className="text-[10px] text-[var(--text-muted)]">{fCur(u.estimated_cost)}</span>
                                                    </div>
                                                    <Bar value={u.total_tokens} max={maxUserTokens} color="var(--accent-primary)" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sources Table */}
                        <div className="space-y-3">
                            <div className="text-[12px] font-semibold text-[var(--text-muted)]">By App Area</div>
                            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                                {data.sources.length === 0 ? (
                                    <div className="p-4 text-center text-[12px] text-[var(--text-muted)]">No usage recorded</div>
                                ) : (
                                    <div className="divide-y" style={{ divideColor: 'var(--border-subtle)' }}>
                                        {data.sources.map((s, i) => {
                                            const details = getSourceDetails(s.source);
                                            const Icon = details.icon;
                                            return (
                                                <div key={i} className="flex items-center justify-between p-3.5" style={{ background: 'var(--bg-primary)' }}>
                                                    <div className="flex items-center gap-2.5 pr-2">
                                                        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-tertiary)' }}>
                                                            <Icon className="w-3.5 h-3.5" style={{ color: details.color }} />
                                                        </div>
                                                        <span className="text-[13px] font-medium text-[var(--text-primary)]">{details.label}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 shrink-0">
                                                        <div className="text-right flex flex-col">
                                                            <span className="text-[12px] font-medium text-[var(--text-primary)]">{fNum(s.total_tokens)}</span>
                                                            <span className="text-[10px] text-[var(--text-muted)]">{s.calls} {s.calls === 1 ? 'call' : 'calls'}</span>
                                                        </div>
                                                        <Bar value={s.total_tokens} max={maxSourceTokens} color={details.color} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Top Agents Panel */}
                    {data.agents.length > 0 && (
                        <div className="space-y-3 mt-4">
                            <div className="text-[12px] font-semibold text-[var(--text-muted)]">Most Used Agents</div>
                            <div className="rounded-xl border overflow-hidden p-1 space-x-1 flex overflow-x-auto pb-1" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                {data.agents.slice(0, 4).map((a, i) => (
                                    <div key={i} className="min-w-[180px] p-4 rounded-lg flex-1" style={{ background: 'var(--bg-primary)' }}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-6 h-6 rounded bg-[var(--bg-tertiary)] flex items-center justify-center">
                                                <Bot className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                            </div>
                                            <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{a.agent_name || 'System Assistant'}</span>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <div className="text-[10px] text-[var(--text-muted)] mb-0.5">Tokens</div>
                                                <div className="text-[13px] font-medium text-[var(--text-primary)]">{fNum(a.total_tokens)}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-[var(--text-muted)] mb-0.5">Cost</div>
                                                <div className="text-[13px] font-medium text-[var(--text-primary)]">{fCur(a.estimated_cost)}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default UsageSection;
