import React, { useMemo, useState } from 'react';
import MarkdownRenderer from '../../MarkdownRenderer';
import {
    Activity, Cpu, Zap, Clock, Wrench, BarChart3, RefreshCw,
    TrendingUp, Users, DollarSign, ChevronRight, Globe, Bot,
    ArrowUp, ArrowDown, Minus, Layers, MessageSquare, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { fmt, fmtCost, fmtDuration, fmtTime, COLORS, AGENT_COLORS, getAgentStyle, MODEL_COLORS } from './shared';
import { CostTimelineChart, MetricCard, Card, Empty, ModelRow, AgentRow } from './shared';


export function ConversationsPage({ conversations }) {
    const totalCost = useMemo(() => conversations.reduce((s, c) => s + (c.total_cost || 0), 0), [conversations]);
    const totalCalls = useMemo(() => conversations.reduce((s, c) => s + (c.calls || 0), 0), [conversations]);

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '1.25rem' }}>
                <div style={{
                    padding: '18px', borderRadius: '14px',
                    background: 'var(--bg-secondary, #1a1a2e)',
                    border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary, #fff)' }}>{conversations.length}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)', marginTop: '2px' }}>Conversations</div>
                </div>
                <div style={{
                    padding: '18px', borderRadius: '14px',
                    background: 'var(--bg-secondary, #1a1a2e)',
                    border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: COLORS.green }}>{fmt(totalCalls)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)', marginTop: '2px' }}>Total API Calls</div>
                </div>
                <div style={{
                    padding: '18px', borderRadius: '14px',
                    background: 'var(--bg-secondary, #1a1a2e)',
                    border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: COLORS.amber }}>{fmtCost(totalCost)}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)', marginTop: '2px' }}>Total Cost</div>
                </div>
            </div>

            <Card title="Conversations" icon={MessageSquare}>
                {conversations.length === 0 ? <Empty text="No conversation data yet — conversations will appear after you chat with agents" /> : (
                    <div>
                        {/* Table header */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: '1.5fr 1fr 80px 100px 100px 1.2fr',
                            gap: '8px', padding: '8px 12px', marginBottom: '4px',
                            fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                            letterSpacing: '0.05em', color: 'var(--text-muted, #666)',
                        }}>
                            <span>Agent</span>
                            <span>Conversation</span>
                            <span style={{ textAlign: 'right' }}>Calls</span>
                            <span style={{ textAlign: 'right' }}>Tokens</span>
                            <span style={{ textAlign: 'right' }}>Cost</span>
                            <span>Models</span>
                        </div>
                        {conversations.map((c, i) => (
                            <div key={i} style={{
                                display: 'grid', gridTemplateColumns: '1.5fr 1fr 80px 100px 100px 1.2fr',
                                gap: '8px', padding: '10px 12px', borderRadius: '10px',
                                background: i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary, rgba(255,255,255,0.02))',
                                alignItems: 'center', animation: `slideIn ${0.1 + i * 0.02}s ease`,
                            }}>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
                                        {c.agent_name || 'Unknown Agent'}
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted, #666)', marginTop: '2px' }}>
                                        {fmtTime(c.last_call)}
                                    </div>
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {c.conversation_id?.slice(0, 12) || '—'}
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary, #aaa)', textAlign: 'right' }}>
                                    {c.calls}
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: 500, color: COLORS.green, textAlign: 'right' }}>
                                    {fmt(c.total_tokens || 0)}
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: COLORS.amber, textAlign: 'right' }}>
                                    {fmtCost(c.total_cost || 0)}
                                </span>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted, #888)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {(c.models_used || '').split(',').map((m, j) => (
                                        <span key={j} style={{
                                            display: 'inline-block', padding: '1px 6px', borderRadius: '4px',
                                            background: 'var(--bg-tertiary, rgba(255,255,255,0.05))',
                                            marginRight: '4px', fontSize: '10px',
                                        }}>{m.trim().split('/').pop()}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}

