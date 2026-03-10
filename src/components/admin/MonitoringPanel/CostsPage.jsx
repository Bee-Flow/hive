import React, { useMemo, useState } from 'react';
import MarkdownRenderer from '../../MarkdownRenderer';
import {
    Activity, Cpu, Zap, Clock, Wrench, BarChart3, RefreshCw,
    TrendingUp, Users, DollarSign, ChevronRight, Globe, Bot,
    ArrowUp, ArrowDown, Minus, Layers, MessageSquare, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { fmt, fmtCost, fmtDuration, fmtTime, COLORS, AGENT_COLORS, getAgentStyle, MODEL_COLORS } from './shared';
import { CostTimelineChart, MetricCard, Card, Empty, ModelRow, AgentRow } from './shared';


export function CostsPage({ byModel, costPerModel, modelCosts, totalCost, costTimeline, range, onNavigate }) {
    const modelsWithCost = byModel.filter(m => costPerModel[m.model]);
    const modelsWithoutCost = byModel.filter(m => !costPerModel[m.model]);
    const maxCost = Math.max(...Object.values(costPerModel), 0.001);

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* Total Cost Hero */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(249, 115, 22, 0.08))',
                borderRadius: '16px', padding: '28px', marginBottom: '1.25rem',
                border: '1px solid rgba(245, 158, 11, 0.15)',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: COLORS.amber, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
                            Estimated Total Cost
                        </div>
                        <div style={{ fontSize: '40px', fontWeight: 800, color: 'var(--text-primary, #fff)', letterSpacing: '-1px' }}>
                            {fmtCost(totalCost)}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted, #888)', marginTop: '4px' }}>
                            {modelsWithCost.length} of {byModel.length} models have cost data
                        </div>
                    </div>
                    {onNavigate && (
                        <button
                            onClick={() => onNavigate('admin/ai-config')}
                            style={{
                                padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
                                background: 'rgba(245, 158, 11, 0.15)', color: COLORS.amber,
                                border: '1px solid rgba(245, 158, 11, 0.25)', cursor: 'pointer',
                                transition: 'all 0.15s',
                            }}
                        >
                            ⚙️ Edit Model Costs
                        </button>
                    )}
                </div>
            </div>

            {/* Cost Timeline */}
            <Card title="Daily Cost Trend" icon={TrendingUp} style={{ marginBottom: '1.25rem' }}>
                <CostTimelineChart data={costTimeline} />
            </Card>

            {/* Cost per model */}
            <Card title="Cost Breakdown by Model" icon={DollarSign}>
                {modelsWithCost.length === 0 ? (
                    <Empty text="No model costs configured — go to AI Config → Model Costs to set pricing" />
                ) : (
                    <div>
                        {modelsWithCost
                            .sort((a, b) => (costPerModel[b.model] || 0) - (costPerModel[a.model] || 0))
                            .map((m, i) => {
                                const cost = costPerModel[m.model] || 0;
                                const pct = (cost / totalCost) * 100;
                                const c = modelCosts[m.model];
                                return (
                                    <div key={i} style={{ padding: '12px 0', borderBottom: i < modelsWithCost.length - 1 ? '1px solid var(--border-default, rgba(255,255,255,0.05))' : 'none' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #fff)' }}>{m.model}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>
                                                    {fmt(m.prompt_tokens || 0)} in · {fmt(m.completion_tokens || 0)} out
                                                </span>
                                                <span style={{ fontSize: '15px', fontWeight: 700, color: COLORS.amber }}>{fmtCost(cost)}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--bg-tertiary, #222)', overflow: 'hidden' }}>
                                                <div style={{
                                                    height: '100%', borderRadius: '3px',
                                                    width: `${(cost / maxCost) * 100}%`,
                                                    background: `linear-gradient(90deg, ${COLORS.amber}, ${COLORS.orange})`,
                                                    transition: 'width 0.4s ease',
                                                }} />
                                            </div>
                                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #888)', minWidth: '40px', textAlign: 'right' }}>
                                                {pct.toFixed(1)}%
                                            </span>
                                        </div>
                                        {c && (
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted, #666)', marginTop: '4px' }}>
                                                Rate: ${c.input}/M input · ${c.output}/M output
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                )}
            </Card>

            {modelsWithoutCost.length > 0 && (
                <Card title="Models Without Cost Data" icon={Minus} style={{ marginTop: '14px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {modelsWithoutCost.map((m, i) => (
                            <span key={i} style={{
                                padding: '4px 10px', borderRadius: '6px', fontSize: '11px',
                                background: 'var(--bg-tertiary, rgba(255,255,255,0.04))',
                                color: 'var(--text-muted, #888)',
                            }}>{m.model}</span>
                        ))}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #666)', marginTop: '8px' }}>
                        Configure costs in AI Config → Model Costs to track spending for these models
                    </div>
                </Card>
            )}
        </div>
    );
}

