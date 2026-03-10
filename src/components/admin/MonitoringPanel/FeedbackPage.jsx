import React, { useMemo, useState } from 'react';
import MarkdownRenderer from '../../MarkdownRenderer';
import {
    Activity, Cpu, Zap, Clock, Wrench, BarChart3, RefreshCw,
    TrendingUp, Users, DollarSign, ChevronRight, Globe, Bot,
    ArrowUp, ArrowDown, Minus, Layers, MessageSquare, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { fmt, fmtCost, fmtDuration, fmtTime, COLORS, AGENT_COLORS, getAgentStyle, MODEL_COLORS } from './shared';
import { CostTimelineChart, MetricCard, Card, Empty, ModelRow, AgentRow } from './shared';


export function FeedbackPage({ feedback, summary, filters, setFilters }) {
    const positivePct = summary?.total > 0 ? Math.round((summary.thumbs_up / summary.total) * 100) : 0;
    const [expandedId, setExpandedId] = useState(null);

    const parseSnapshot = (raw) => {
        if (!raw) return null;
        try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
    };

    const filtered = useMemo(() => {
        let list = feedback || [];
        if (filters?.rating) list = list.filter(f => f.rating === filters.rating);
        if (filters?.source) list = list.filter(f => f.source === filters.source);
        return list;
    }, [feedback, filters]);

    const pillStyle = (active) => ({
        padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: active ? 700 : 500,
        border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
        background: active ? COLORS.primary + '18' : 'transparent',
        color: active ? COLORS.primary : 'var(--text-muted, #888)',
        borderColor: active ? COLORS.primary + '40' : 'var(--border-default, rgba(255,255,255,0.08))',
    });

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '1.5rem' }}>
                <MetricCard icon={MessageSquare} label="Total Feedback" value={summary?.total || 0} color={COLORS.primary} />
                <MetricCard icon={ThumbsUp} label="Thumbs Up" value={summary?.thumbs_up || 0} color={COLORS.green} />
                <MetricCard icon={ThumbsDown} label="Thumbs Down" value={summary?.thumbs_down || 0} color={COLORS.rose} />
                <MetricCard icon={TrendingUp} label="Positive %" value={`${positivePct}%`} color={COLORS.amber} />
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <button onClick={() => setFilters(f => ({ ...f, rating: '' }))} style={pillStyle(!filters?.rating)}>All</button>
                <button onClick={() => setFilters(f => ({ ...f, rating: 'up' }))} style={pillStyle(filters?.rating === 'up')}>👍 Up</button>
                <button onClick={() => setFilters(f => ({ ...f, rating: 'down' }))} style={pillStyle(filters?.rating === 'down')}>👎 Down</button>
                <span style={{ width: '1px', background: 'var(--border-default, rgba(255,255,255,0.08))', margin: '0 4px' }} />
                <button onClick={() => setFilters(f => ({ ...f, source: '' }))} style={pillStyle(!filters?.source)}>All Sources</button>
                <button onClick={() => setFilters(f => ({ ...f, source: 'agent' }))} style={pillStyle(filters?.source === 'agent')}>🤖 Agent</button>
                <button onClick={() => setFilters(f => ({ ...f, source: 'direct' }))} style={pillStyle(filters?.source === 'direct')}>💬 Direct</button>
            </div>

            <Card title={`Feedback Entries (${filtered.length})`} icon={MessageSquare}>
                {filtered.length === 0 ? <Empty text="No feedback yet — users can rate AI responses with thumbs up/down" /> : (
                    <div>
                        {/* Table header */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: '100px 50px 1fr 100px 100px 70px 36px',
                            gap: '8px', padding: '8px 12px', marginBottom: '4px',
                            fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                            letterSpacing: '0.05em', color: 'var(--text-muted, #666)',
                        }}>
                            <span>Time</span>
                            <span>Rating</span>
                            <span>Comment</span>
                            <span>User</span>
                            <span>Organization</span>
                            <span>Source</span>
                            <span>Chat</span>
                        </div>
                        {filtered.map((f, i) => {
                            const snapshot = parseSnapshot(f.conversation_snapshot);
                            const hasSnapshot = snapshot && snapshot.length > 0;
                            const isExpanded = expandedId === f.id;
                            return (
                                <div key={f.id || i}>
                                    <div
                                        onClick={() => hasSnapshot && setExpandedId(isExpanded ? null : f.id)}
                                        style={{
                                            display: 'grid', gridTemplateColumns: '100px 50px 1fr 100px 100px 70px 36px',
                                            gap: '8px', padding: '10px 12px', borderRadius: '10px',
                                            background: i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary, rgba(255,255,255,0.02))',
                                            alignItems: 'center', animation: `slideIn ${0.1 + i * 0.02}s ease`,
                                            cursor: hasSnapshot ? 'pointer' : 'default',
                                        }}
                                    >
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted, #888)' }}>
                                            {fmtTime(f.created_at)}
                                        </span>
                                        <span style={{ fontSize: '18px' }}>
                                            {f.rating === 'up' ? '👍' : '👎'}
                                        </span>
                                        <span style={{
                                            fontSize: '12px', color: f.comment ? 'var(--text-primary, #fff)' : 'var(--text-muted, #666)',
                                            fontStyle: f.comment ? 'normal' : 'italic',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {f.comment || 'No comment'}
                                        </span>
                                        <span style={{
                                            fontSize: '12px', color: 'var(--text-secondary, #aaa)',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {f.user_id || 'Anonymous'}
                                        </span>
                                        <span style={{
                                            fontSize: '11px', color: 'var(--text-secondary, #aaa)',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {f.organization_id || '—'}
                                        </span>
                                        <span style={{
                                            fontSize: '11px', fontWeight: 600,
                                            padding: '2px 8px', borderRadius: '8px',
                                            background: f.source === 'agent' ? '#6366f115' : '#06b6d415',
                                            color: f.source === 'agent' ? '#818cf8' : '#06b6d4',
                                            textAlign: 'center',
                                        }}>
                                            {f.source === 'agent' ? '🤖 Agent' : '💬 Direct'}
                                        </span>
                                        <span style={{ fontSize: '13px', textAlign: 'center', opacity: hasSnapshot ? 1 : 0.25 }}
                                            title={hasSnapshot ? 'Click to view conversation' : 'No conversation attached'}>
                                            {hasSnapshot ? (isExpanded ? '▼' : '▶') : '—'}
                                        </span>
                                    </div>
                                    {isExpanded && hasSnapshot && (
                                        <div style={{
                                            margin: '4px 12px 12px', padding: '16px',
                                            borderRadius: '12px', border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
                                            background: 'var(--bg-secondary, #1a1a2e)',
                                            maxHeight: '400px', overflowY: 'auto',
                                        }}>
                                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted, #888)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Shared Conversation ({snapshot.length} messages)
                                            </div>
                                            {snapshot.map((m, mi) => (
                                                <div key={mi} style={{
                                                    display: 'flex', flexDirection: 'column',
                                                    alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                                                    marginBottom: '8px',
                                                }}>
                                                    <div style={{
                                                        fontSize: '10px', fontWeight: 600, marginBottom: '2px',
                                                        color: m.role === 'user' ? COLORS.primary : COLORS.green,
                                                        textTransform: 'uppercase', letterSpacing: '0.04em',
                                                    }}>
                                                        {m.role === 'user' ? '👤 User' : '🤖 Assistant'}
                                                        {m.timestamp && <span style={{ fontWeight: 400, marginLeft: '6px', color: 'var(--text-muted, #666)' }}>
                                                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>}
                                                    </div>
                                                    <div style={{
                                                        padding: '8px 12px', borderRadius: '10px',
                                                        maxWidth: '85%', fontSize: '12px', lineHeight: '1.5',
                                                        color: 'var(--text-primary, #fff)',
                                                        background: m.role === 'user'
                                                            ? COLORS.primary + '15'
                                                            : 'var(--bg-tertiary, rgba(255,255,255,0.04))',
                                                        border: '1px solid ' + (m.role === 'user'
                                                            ? COLORS.primary + '25'
                                                            : 'var(--border-default, rgba(255,255,255,0.06))'),
                                                        whiteSpace: m.role === 'user' ? 'pre-wrap' : 'normal',
                                                        wordBreak: 'break-word',
                                                    }}>
                                                        {m.role === 'assistant'
                                                            ? <MarkdownRenderer content={m.content?.length > 3000 ? m.content.slice(0, 3000) + '\n\n*...truncated...*' : m.content || ''} />
                                                            : (m.content?.length > 1500 ? m.content.slice(0, 1500) + '...' : m.content)
                                                        }
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
}

