import React, { useMemo, useState } from 'react';
import MarkdownRenderer from '../../MarkdownRenderer';
import {
    Activity, Cpu, Zap, Clock, Wrench, BarChart3, RefreshCw,
    TrendingUp, Users, DollarSign, ChevronRight, Globe, Bot,
    ArrowUp, ArrowDown, Minus, Layers, MessageSquare, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { fmt, fmtCost, fmtDuration, fmtTime, COLORS, AGENT_COLORS, getAgentStyle, MODEL_COLORS } from './shared';
import { CostTimelineChart, MetricCard, Card, Empty, ModelRow, AgentRow } from './shared';

export function OverviewPage({ summary, byModel, byAgent, timeline, costTimeline, tools, totalCost, costPerModel, modelCosts, range, browserTotalCalls, browserTotalTokens, onSelectModel, onSelectAgent }) {
    const maxTimelineTokens = Math.max(...timeline.map(t => t.total_tokens || 0), 1);

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '1.5rem' }}>
                <MetricCard icon={Zap} label="Total Calls" value={fmt(summary?.total_calls || 0)} color={COLORS.primary} />
                <MetricCard icon={BarChart3} label="Total Tokens" value={fmt(summary?.total_tokens || 0)} color={COLORS.green} />
                <MetricCard icon={Clock} label="Avg Latency" value={fmtDuration(summary?.avg_duration_ms)} color={COLORS.pink} />
                <MetricCard icon={DollarSign} label="Est. Cost" value={fmtCost(totalCost)} color={COLORS.amber} />
                <MetricCard icon={Cpu} label="Models Used" value={summary?.unique_models || 0} color={COLORS.purple} />
                <MetricCard icon={Globe} label="Browser Calls" value={fmt(browserTotalCalls)} color={COLORS.rose} />
            </div>

            {/* Timeline Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '1.25rem' }}>
                <Card title="Token Timeline" icon={TrendingUp}>
                    {timeline.length === 0 ? (
                        <Empty text="No data to display yet" />
                    ) : (
                        <div style={{ padding: '8px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '120px' }}>
                                {timeline.slice(-30).map((t, i) => (
                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                                        <div
                                            style={{
                                                width: '100%', minWidth: '4px',
                                                height: `${Math.max((t.total_tokens / maxTimelineTokens) * 100, 3)}%`,
                                                background: `linear-gradient(to top, ${COLORS.primary}, ${COLORS.purple})`,
                                                borderRadius: '4px 4px 0 0',
                                                transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                                opacity: 0.85,
                                            }}
                                            title={`${t.period}: ${fmt(t.total_tokens)} tokens, ${t.calls} calls`}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted, #666)' }}>{timeline[0]?.period?.slice(5) || ''}</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted, #666)' }}>{timeline[timeline.length - 1]?.period?.slice(5) || ''}</span>
                            </div>
                        </div>
                    )}
                </Card>
                <Card title="Cost Timeline" icon={DollarSign}>
                    <CostTimelineChart data={costTimeline} />
                </Card>
            </div>

            {/* Two columns: Top Models + Top Agents */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '1.25rem' }}>
                <Card title="Top Models" icon={Cpu}>
                    {byModel.length === 0 ? <Empty text="No model data" /> : byModel.slice(0, 5).map((m, i) => (
                        <ModelRow key={i} model={m} index={i} maxTokens={Math.max(...byModel.map(m => m.total_tokens || 0), 1)} cost={costPerModel[m.model]} />
                    ))}
                </Card>
                <Card title="Top Agents" icon={Bot}>
                    {byAgent.length === 0 ? <Empty text="No agent data" /> : byAgent.slice(0, 5).map((a, i) => (
                        <AgentRow key={i} agent={a} index={i} />
                    ))}
                </Card>
            </div>

            {/* Tools mini-chart */}
            <Card title="Tool Usage" icon={Wrench}>
                {tools.length === 0 ? <Empty text="No tool calls recorded" /> : (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {tools.slice(0, 12).map((t, i) => (
                            <div key={i} style={{
                                padding: '6px 12px', borderRadius: '20px', fontSize: '12px',
                                background: 'var(--bg-tertiary, rgba(255,255,255,0.04))',
                                border: '1px solid var(--border-default, rgba(255,255,255,0.06))',
                                color: 'var(--text-secondary, #aaa)',
                                display: 'flex', alignItems: 'center', gap: '6px',
                            }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary, #fff)' }}>{t.tool_name}</span>
                                <span style={{
                                    background: COLORS.primary + '20', color: COLORS.primary,
                                    padding: '1px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 700,
                                }}>{t.calls}×</span>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}

