import React, { useMemo, useState } from 'react';
import MarkdownRenderer from '../../MarkdownRenderer';
import {
    Activity, Cpu, Zap, Clock, Wrench, BarChart3, RefreshCw,
    TrendingUp, Users, DollarSign, ChevronRight, Globe, Bot,
    ArrowUp, ArrowDown, Minus, Layers, MessageSquare, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { fmt, fmtCost, fmtDuration, fmtTime, COLORS, AGENT_COLORS, getAgentStyle, MODEL_COLORS } from './shared';
import { CostTimelineChart, MetricCard, Card, Empty, ModelRow, AgentRow } from './shared';


export function ActivityPage({ recent, modelCosts, filterSources, filterModels, activityFilters, setActivityFilters }) {
    const filtered = useMemo(() => {
        return recent.filter(r => {
            if (activityFilters.source && r.source !== activityFilters.source) return false;
            if (activityFilters.model && r.model !== activityFilters.model) return false;
            if (activityFilters.search) {
                const term = activityFilters.search.toLowerCase();
                if (!(r.agent_name || '').toLowerCase().includes(term) &&
                    !(r.user_id || '').toLowerCase().includes(term) &&
                    !(r.model || '').toLowerCase().includes(term)) return false;
            }
            return true;
        });
    }, [recent, activityFilters]);

    const pillStyle = (active) => ({
        padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: active ? 700 : 500,
        border: 'none', cursor: 'pointer', transition: 'all 0.15s',
        background: active ? COLORS.primary + '25' : 'var(--bg-tertiary, rgba(255,255,255,0.04))',
        color: active ? COLORS.primary : 'var(--text-muted, #888)',
    });

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* Filters */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px',
                padding: '14px 16px', borderRadius: '12px',
                background: 'var(--bg-secondary, #1a1a2e)',
                border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
                alignItems: 'center',
            }}>
                {/* Source pills */}
                <button onClick={() => setActivityFilters(f => ({ ...f, source: '' }))} style={pillStyle(!activityFilters.source)}>All</button>
                {filterSources.map(s => (
                    <button key={s} onClick={() => setActivityFilters(f => ({ ...f, source: f.source === s ? '' : s }))} style={pillStyle(activityFilters.source === s)}>
                        {s}
                    </button>
                ))}

                <div style={{ width: '1px', height: '20px', background: 'var(--border-default, rgba(255,255,255,0.1))', margin: '0 4px' }} />

                {/* Model dropdown */}
                <select
                    value={activityFilters.model}
                    onChange={e => setActivityFilters(f => ({ ...f, model: e.target.value }))}
                    style={{
                        padding: '5px 10px', borderRadius: '8px', fontSize: '11px',
                        background: 'var(--bg-tertiary, #222)', color: 'var(--text-primary, #fff)',
                        border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
                        outline: 'none', cursor: 'pointer',
                    }}
                >
                    <option value="">All Models</option>
                    {filterModels.map(m => <option key={m} value={m}>{m}</option>)}
                </select>

                {/* Search */}
                <input
                    type="text"
                    placeholder="Search agent, user, model..."
                    value={activityFilters.search}
                    onChange={e => setActivityFilters(f => ({ ...f, search: e.target.value }))}
                    style={{
                        padding: '5px 12px', borderRadius: '8px', fontSize: '11px',
                        background: 'var(--bg-tertiary, #222)', color: 'var(--text-primary, #fff)',
                        border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
                        outline: 'none', minWidth: '180px',
                    }}
                />

                <span style={{ fontSize: '10px', color: 'var(--text-muted, #666)', marginLeft: 'auto' }}>
                    {filtered.length} of {recent.length} calls
                </span>
            </div>

            <Card title="Recent API Calls" icon={Clock}>
                {filtered.length === 0 ? (
                    <Empty text="No activity matches your filters" />
                ) : (
                    <div style={{ maxHeight: '600px', overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-default, rgba(255,255,255,0.1))' }}>
                                    {['Time', 'Source', 'Agent', 'Type', 'Model', 'Input', 'Output', 'Total', 'Latency', 'Cost'].map(h => (
                                        <th key={h} style={{
                                            padding: '10px 8px', textAlign: 'left',
                                            color: 'var(--text-muted, #888)', fontWeight: 600,
                                            fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em',
                                            position: 'sticky', top: 0,
                                            background: 'var(--bg-secondary, #1a1a2e)',
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((r, i) => {
                                    const agStyle = getAgentStyle(r.agent_type);
                                    const c = modelCosts[r.model];
                                    const cost = c ? ((r.prompt_tokens || 0) / 1e6) * (c.input || 0) + ((r.completion_tokens || 0) / 1e6) * (c.output || 0) : null;
                                    return (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.04))' }}>
                                            <td style={{ padding: '8px', color: 'var(--text-muted, #888)', whiteSpace: 'nowrap', fontSize: '11px' }}>
                                                {fmtTime(r.timestamp)}
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                <span style={{
                                                    padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 600,
                                                    background: 'var(--bg-tertiary, rgba(255,255,255,0.04))', color: 'var(--text-muted, #aaa)',
                                                }}>{r.source || '—'}</span>
                                            </td>
                                            <td style={{ padding: '8px', color: 'var(--text-primary, #fff)', fontWeight: 500, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }}>
                                                {r.agent_name || '—'}
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                <span style={{
                                                    padding: '2px 7px', borderRadius: '4px',
                                                    fontSize: '10px', fontWeight: 600,
                                                    background: agStyle.bg, color: agStyle.text,
                                                }}>{r.agent_type || 'chat'}</span>
                                            </td>
                                            <td style={{ padding: '8px', color: 'var(--text-secondary, #aaa)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px' }}>
                                                {r.model || '—'}
                                            </td>
                                            <td style={{ padding: '8px', color: COLORS.blue, fontWeight: 500, fontSize: '11px' }}>{fmt(r.prompt_tokens)}</td>
                                            <td style={{ padding: '8px', color: COLORS.amber, fontWeight: 500, fontSize: '11px' }}>{fmt(r.completion_tokens)}</td>
                                            <td style={{ padding: '8px', color: COLORS.green, fontWeight: 600, fontSize: '11px' }}>{fmt(r.total_tokens)}</td>
                                            <td style={{ padding: '8px', color: 'var(--text-muted, #888)', fontSize: '11px' }}>{fmtDuration(r.duration_ms)}</td>
                                            <td style={{ padding: '8px', color: COLORS.amber, fontWeight: 500, fontSize: '11px' }}>{cost != null ? fmtCost(cost) : '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}

