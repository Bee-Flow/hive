import React, { useMemo, useState } from 'react';
import MarkdownRenderer from '../../MarkdownRenderer';
import {
    Activity, Cpu, Zap, Clock, Wrench, BarChart3, RefreshCw,
    TrendingUp, Users, DollarSign, ChevronRight, Globe, Bot,
    ArrowUp, ArrowDown, Minus, Layers, MessageSquare, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { fmt, fmtCost, fmtDuration, fmtTime, COLORS, AGENT_COLORS, getAgentStyle, MODEL_COLORS } from './shared';
import { CostTimelineChart, MetricCard, Card, Empty, ModelRow, AgentRow } from './shared';


export function AgentsPage({ byAgent, modelCosts, costPerModel, onSelect }) {
    const grouped = useMemo(() => {
        const map = {};
        byAgent.forEach(a => {
            const type = a.agent_type || 'chat';
            if (!map[type]) map[type] = [];
            map[type].push(a);
        });
        return map;
    }, [byAgent]);

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* Summary cards per agent type */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '1.25rem' }}>
                {Object.entries(grouped).map(([type, agents]) => {
                    const style = getAgentStyle(type);
                    const totalCalls = agents.reduce((s, a) => s + (a.calls || 0), 0);
                    const totalTokens = agents.reduce((s, a) => s + (a.total_tokens || 0), 0);
                    const totalCost = agents.reduce((s, a) => s + (a.estimated_cost || 0), 0);
                    return (
                        <div key={type} style={{
                            background: 'var(--bg-secondary, #1a1a2e)', borderRadius: '14px',
                            padding: '18px', border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <span style={{
                                    padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                                    background: style.bg, color: style.text,
                                }}>{style.label}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary, #fff)' }}>{fmt(totalCalls)}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>calls</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 800, color: COLORS.green }}>{fmt(totalTokens)}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>tokens</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 800, color: COLORS.amber }}>{fmtCost(totalCost)}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>cost</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* All agents list */}
            <Card title="All Agents" icon={Bot}>
                {byAgent.length === 0 ? <Empty text="No agent data yet" /> : (
                    <div>
                        {byAgent.map((a, i) => (
                            <div key={i} onClick={() => onSelect?.(a)} style={{ cursor: 'pointer' }}>
                                <AgentRow agent={a} index={i} detailed />
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}

