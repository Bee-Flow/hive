import React, { useMemo, useState } from 'react';
import MarkdownRenderer from '../../MarkdownRenderer';
import {
    Activity, Cpu, Zap, Clock, Wrench, BarChart3, RefreshCw,
    TrendingUp, Users, DollarSign, ChevronRight, Globe, Bot,
    ArrowUp, ArrowDown, Minus, Layers, MessageSquare, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { fmt, fmtCost, fmtDuration, fmtTime, COLORS, AGENT_COLORS, getAgentStyle, MODEL_COLORS } from './shared';
import { CostTimelineChart, MetricCard, Card, Empty, ModelRow, AgentRow } from './shared';


export function UsersPage({ byUser }) {
    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <Card title="Usage by User" icon={Users}>
                {byUser.length === 0 ? <Empty text="No user tracking data yet" /> : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                        {byUser.map((u, i) => (
                            <div key={i} style={{
                                padding: '16px', borderRadius: '12px',
                                background: 'var(--bg-tertiary, rgba(255,255,255,0.03))',
                                border: '1px solid var(--border-default, rgba(255,255,255,0.06))',
                                animation: `fadeIn ${0.15 + i * 0.05}s ease`,
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '50%',
                                            background: `linear-gradient(135deg, ${MODEL_COLORS[i % MODEL_COLORS.length]}, ${MODEL_COLORS[(i + 3) % MODEL_COLORS.length]})`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '14px', fontWeight: 700, color: '#fff',
                                        }}>
                                            {(u.user_id || '?')[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary, #fff)' }}>{u.user_id || 'Anonymous'}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>{u.calls} calls</div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                    <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary, rgba(255,255,255,0.03))' }}>
                                        <div style={{ fontSize: '16px', fontWeight: 700, color: COLORS.green }}>{fmt(u.total_tokens || 0)}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted, #888)' }}>tokens</div>
                                    </div>
                                    <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary, rgba(255,255,255,0.03))' }}>
                                        <div style={{ fontSize: '16px', fontWeight: 700, color: COLORS.pink }}>{fmtDuration(u.avg_duration_ms)}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted, #888)' }}>avg latency</div>
                                    </div>
                                    <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--bg-secondary, rgba(255,255,255,0.03))' }}>
                                        <div style={{ fontSize: '16px', fontWeight: 700, color: COLORS.amber }}>{fmtCost(u.estimated_cost || 0)}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted, #888)' }}>est. cost</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
