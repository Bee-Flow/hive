import React, { useState, useEffect, useMemo } from 'react';
import {
    AlertTriangle, AlertOctagon, ZapOff, RefreshCcw, XCircle,
    Clock, Filter, Search, Cpu, Bot
} from 'lucide-react';
import {
    fmt, fmtDuration, fmtTime, shortModel, COLORS,
    Card, Empty, MetricCard
} from './shared';

const API = (import.meta.env.VITE_API_URL || '') + '/api/terminations';
const OPTS = { credentials: 'include' };

const TYPE_META = {
    max_tokens:     { label: 'Max tokens',     color: COLORS.amber,  icon: ZapOff },
    max_iterations: { label: 'Max iterations', color: COLORS.orange, icon: RefreshCcw },
    error:          { label: 'Error',          color: COLORS.rose,   icon: AlertOctagon },
    aborted:        { label: 'Aborted',        color: COLORS.cyan,   icon: XCircle },
};

const TYPE_ORDER = ['max_tokens', 'max_iterations', 'error', 'aborted'];

async function fetchJson(url) {
    try {
        const r = await fetch(url, OPTS);
        if (!r.ok) return null;
        return await r.json();
    } catch { return null; }
}

function rangeQuery(range, customStart, customEnd) {
    if (range === 'all') return '';
    if (range === 'custom' && customStart && customEnd) {
        return `?startDate=${encodeURIComponent(new Date(customStart).toISOString())}&endDate=${encodeURIComponent(new Date(customEnd).toISOString())}`;
    }
    const days = range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 30;
    return `?days=${days}`;
}

function TypeBadge({ type }) {
    const meta = TYPE_META[type] || { label: type, color: COLORS.rose, icon: AlertTriangle };
    const Icon = meta.icon;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
            background: meta.color + '15', color: meta.color, border: `1px solid ${meta.color}30`,
        }}>
            <Icon style={{ width: 11, height: 11 }} />
            {meta.label}
        </span>
    );
}

function StackedBarChart({ data }) {
    if (!data || data.length === 0) return <Empty text="No data to display" />;

    // data: [{ period, type, count }, ...]; aggregate by period
    const buckets = {};
    for (const r of data) {
        if (!buckets[r.period]) buckets[r.period] = { period: r.period };
        buckets[r.period][r.type] = (buckets[r.period][r.type] || 0) + r.count;
    }
    const periods = Object.values(buckets).sort((a, b) => a.period.localeCompare(b.period));
    const maxTotal = Math.max(...periods.map(p => TYPE_ORDER.reduce((s, t) => s + (p[t] || 0), 0)), 1);

    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 140, padding: '8px 0' }}>
            {periods.map(p => {
                const total = TYPE_ORDER.reduce((s, t) => s + (p[t] || 0), 0);
                const heightPct = (total / maxTotal) * 100;
                return (
                    <div key={p.period} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 8 }}>
                        <div title={`${p.period} · ${total} terminations`} style={{
                            width: '100%', height: `${heightPct}%`, minHeight: total > 0 ? 2 : 0,
                            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                            borderRadius: '4px 4px 0 0', overflow: 'hidden',
                        }}>
                            {TYPE_ORDER.map(t => {
                                const v = p[t] || 0;
                                if (v === 0) return null;
                                return (
                                    <div key={t} style={{
                                        height: `${(v / total) * 100}%`,
                                        background: TYPE_META[t].color,
                                    }} />
                                );
                            })}
                        </div>
                        <span style={{ fontSize: 9, color: 'var(--text-muted, #888)', whiteSpace: 'nowrap' }}>
                            {p.period.slice(5)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export function TerminationsPage({ range = '7d', customStart, customEnd, refreshKey }) {
    const [summary, setSummary] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [rows, setRows] = useState([]);
    const [byAgent, setByAgent] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('');
    const [filterAgent, setFilterAgent] = useState('');
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        const q = rangeQuery(range, customStart, customEnd);
        const interval = (range === 'today' || (range === 'custom' && customStart && customEnd && (new Date(customEnd) - new Date(customStart)) <= 86400000))
            ? 'hour' : 'day';
        const intervalQ = (q ? '&' : '?') + `interval=${interval}`;
        Promise.all([
            fetchJson(API + '/summary' + q),
            fetchJson(API + '/timeline' + q + intervalQ),
            fetchJson(API + q + (q ? '&' : '?') + 'limit=200'),
            fetchJson(API + '/by-agent' + q),
        ]).then(([sum, tl, list, ag]) => {
            if (cancelled) return;
            setSummary(sum);
            setTimeline(tl?.rows || []);
            setRows(list?.rows || []);
            setByAgent(ag?.rows || []);
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [range, customStart, customEnd, refreshKey]);

    const filtered = useMemo(() => {
        let data = rows;
        if (filterType) data = data.filter(r => r.termination_type === filterType);
        if (filterAgent) data = data.filter(r => r.agent_id === filterAgent);
        if (search) {
            const q = search.toLowerCase();
            data = data.filter(r =>
                (r.agent_name || '').toLowerCase().includes(q) ||
                (r.model || '').toLowerCase().includes(q) ||
                (r.error_code || '').toLowerCase().includes(q)
            );
        }
        return data;
    }, [rows, filterType, filterAgent, search]);

    const agentOptions = useMemo(() => {
        const seen = new Map();
        for (const r of rows) {
            if (r.agent_id && !seen.has(r.agent_id)) seen.set(r.agent_id, r.agent_name || r.agent_id);
        }
        return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
    }, [rows]);

    if (loading) {
        return (
            <Card>
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted, #888)' }}>
                    Loading terminations…
                </div>
            </Card>
        );
    }

    const total = summary?.total || 0;
    const by = summary?.by_type || {};

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.3s ease' }}>
            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <MetricCard icon={AlertTriangle}  label="Total"          value={fmt(total)}                       color={COLORS.rose} />
                <MetricCard icon={ZapOff}          label="Max tokens"    value={fmt(by.max_tokens || 0)}          color={COLORS.amber}
                    subtitle={total ? `${Math.round(((by.max_tokens || 0) / total) * 100)}% of stops` : ''} />
                <MetricCard icon={RefreshCcw}      label="Max iterations" value={fmt(by.max_iterations || 0)}     color={COLORS.orange}
                    subtitle={total ? `${Math.round(((by.max_iterations || 0) / total) * 100)}% of stops` : ''} />
                <MetricCard icon={AlertOctagon}    label="Errors"         value={fmt(by.error || 0)}              color={COLORS.rose}
                    subtitle={total ? `${Math.round(((by.error || 0) / total) * 100)}% of stops` : ''} />
                <MetricCard icon={XCircle}         label="Aborted"        value={fmt(by.aborted || 0)}            color={COLORS.cyan}
                    subtitle="Client disconnects" />
            </div>

            {/* Timeline chart */}
            <Card title="Terminations over time" icon={Clock}>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted, #888)', marginBottom: 6 }}>
                    {TYPE_ORDER.map(t => (
                        <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: TYPE_META[t].color }} />
                            {TYPE_META[t].label}
                        </span>
                    ))}
                </div>
                <StackedBarChart data={timeline} />
            </Card>

            {/* By agent */}
            {byAgent.length > 0 && (
                <Card title="By agent" icon={Bot}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px 80px', gap: 8, padding: '6px 4px',
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted, #666)' }}>
                        <span>Agent</span>
                        <span style={{ textAlign: 'right' }}>Total</span>
                        <span style={{ textAlign: 'right' }}>Max tok.</span>
                        <span style={{ textAlign: 'right' }}>Max iter.</span>
                        <span style={{ textAlign: 'right' }}>Errors</span>
                        <span style={{ textAlign: 'right' }}>Aborted</span>
                    </div>
                    {byAgent.map(a => (
                        <div key={a.agent_id || 'unknown'} style={{
                            display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px 80px', gap: 8,
                            padding: '8px 4px', borderTop: '1px solid var(--border-default, rgba(255,255,255,0.06))',
                            fontSize: 12, color: 'var(--text-primary, #fff)', alignItems: 'center'
                        }}>
                            <span>{a.agent_name || a.agent_id || '—'}</span>
                            <span style={{ textAlign: 'right', fontWeight: 700 }}>{a.total}</span>
                            <span style={{ textAlign: 'right', color: COLORS.amber }}>{a.max_tokens || 0}</span>
                            <span style={{ textAlign: 'right', color: COLORS.orange }}>{a.max_iterations || 0}</span>
                            <span style={{ textAlign: 'right', color: COLORS.rose }}>{a.errors || 0}</span>
                            <span style={{ textAlign: 'right', color: COLORS.cyan }}>{a.aborted || 0}</span>
                        </div>
                    ))}
                </Card>
            )}

            {/* Detail table */}
            <Card>
                {/* Filter row */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                        borderRadius: 8, background: 'var(--bg-primary, #0f0f1a)',
                        border: '1px solid var(--border-default, rgba(255,255,255,0.08))', flex: '0 1 220px',
                    }}>
                        <Search style={{ width: 12, height: 12, color: 'var(--text-muted, #888)' }} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search agent / model / error..."
                            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary, #fff)', width: '100%' }}
                        />
                    </div>
                    <div style={filterSelectWrapper}>
                        <Filter style={{ width: 12, height: 12, color: 'var(--text-muted, #888)' }} />
                        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={filterSelectStyle}>
                            <option value="">All types</option>
                            {TYPE_ORDER.map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
                        </select>
                    </div>
                    <div style={filterSelectWrapper}>
                        <Bot style={{ width: 12, height: 12, color: 'var(--text-muted, #888)' }} />
                        <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} style={filterSelectStyle}>
                            <option value="">All agents</option>
                            {agentOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>
                        {filtered.length} event{filtered.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Table header */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 1fr 1fr 130px 100px 60px 70px 70px 24px',
                    gap: 8, padding: '8px',
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: 'var(--text-muted, #666)',
                }}>
                    <span>Time</span>
                    <span>Agent</span>
                    <span>Model</span>
                    <span>Type</span>
                    <span>Error code</span>
                    <span style={{ textAlign: 'right' }}>Iter.</span>
                    <span style={{ textAlign: 'right' }}>Duration</span>
                    <span style={{ textAlign: 'right' }}>Tokens</span>
                    <span></span>
                </div>

                {filtered.length === 0 && <Empty text="No terminations match the filters" />}

                {filtered.map(r => {
                    const isOpen = expanded === r.id;
                    const meta = TYPE_META[r.termination_type] || {};
                    return (
                        <div key={r.id}>
                            <div
                                onClick={() => setExpanded(isOpen ? null : r.id)}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '110px 1fr 1fr 130px 100px 60px 70px 70px 24px',
                                    gap: 8, padding: '10px 8px',
                                    borderTop: '1px solid var(--border-default, rgba(255,255,255,0.06))',
                                    fontSize: 12, color: 'var(--text-primary, #fff)',
                                    alignItems: 'center', cursor: 'pointer',
                                }}
                            >
                                <span style={{ color: 'var(--text-muted, #888)', fontSize: 11 }}>{fmtTime(r.timestamp)}</span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {r.agent_name || r.agent_id || <span style={{ color: 'var(--text-muted, #666)' }}>—</span>}
                                </span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted, #aaa)' }}>
                                    {shortModel(r.model)}
                                </span>
                                <span><TypeBadge type={r.termination_type} /></span>
                                <span style={{ fontSize: 11, color: r.error_code ? COLORS.rose : 'var(--text-muted, #666)' }}>
                                    {r.error_code || '—'}
                                </span>
                                <span style={{ textAlign: 'right', color: 'var(--text-muted, #aaa)' }}>{r.iteration_count || 0}</span>
                                <span style={{ textAlign: 'right', color: 'var(--text-muted, #aaa)' }}>{fmtDuration(r.duration_ms)}</span>
                                <span style={{ textAlign: 'right', color: 'var(--text-muted, #aaa)' }}>{fmt(r.total_tokens)}</span>
                                <span style={{ color: meta.color || 'var(--text-muted, #666)', textAlign: 'right' }}>
                                    {isOpen ? '▾' : '▸'}
                                </span>
                            </div>
                            {isOpen && (
                                <div style={{
                                    padding: '12px 16px',
                                    background: 'var(--bg-primary, #0f0f1a)',
                                    fontSize: 12, color: 'var(--text-muted, #aaa)',
                                    display: 'flex', flexDirection: 'column', gap: 6,
                                    borderTop: '1px solid var(--border-default, rgba(255,255,255,0.06))',
                                }}>
                                    <DetailRow label="Source"      value={r.source} />
                                    <DetailRow label="Conversation" value={r.conversation_id} mono />
                                    <DetailRow label="User"        value={r.user_id} mono />
                                    <DetailRow label="Organization" value={r.organization_id} mono />
                                    <DetailRow label="Error class" value={r.error_class} />
                                    <DetailRow label="Error"       value={r.error_first_line} mono />
                                    <DetailRow label="Stack"       value={r.stack_first_line} mono />
                                    <DetailRow label="Tokens"      value={`prompt ${fmt(r.prompt_tokens)} · completion ${fmt(r.completion_tokens)} · total ${fmt(r.total_tokens)}`} />
                                    <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted, #666)', fontStyle: 'italic' }}>
                                        Privacy: berichten worden niet gelogd. Alleen gesanitiseerde metadata is hier zichtbaar.
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </Card>
        </div>
    );
}

function DetailRow({ label, value, mono }) {
    return (
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
            <span style={{ minWidth: 110, fontSize: 11, color: 'var(--text-muted, #666)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
            <span style={{
                fontFamily: mono ? 'var(--font-mono, ui-monospace, monospace)' : 'inherit',
                wordBreak: 'break-all', flex: 1,
                color: value ? 'var(--text-primary, #fff)' : 'var(--text-muted, #666)',
            }}>
                {value || '—'}
            </span>
        </div>
    );
}

const filterSelectWrapper = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
    borderRadius: 8, background: 'var(--bg-primary, #0f0f1a)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
};

const filterSelectStyle = {
    background: 'transparent', border: 'none', outline: 'none',
    fontSize: 12, color: 'var(--text-primary, #fff)', cursor: 'pointer',
};
