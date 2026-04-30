import React, { useMemo } from 'react';
import {
    Zap, BarChart3, Clock, DollarSign, Cpu, Bot, Wrench, TrendingUp, Database, Brain
} from 'lucide-react';
import {
    fmt, fmtCost, fmtDuration, COLORS, MODEL_COLORS,
    MetricCard, Card, Empty, SvgAreaChart, DonutChart, ModelRow, AgentRow, shortModel
} from './shared';

export function OverviewPage({
    summary, prevSummary, deltas, deltaLabel,
    byModel, byAgent, timeline, costTimeline, tools,
    totalCost, costPerModel, modelCosts, range,
    onSelectModel, onSelectAgent, onNavigate
}) {
    const modelsWithCost = byModel.filter(m => costPerModel[m.model]);

    // Donut data: top 5 models by cost + "Other"
    const donutItems = useMemo(() => {
        const sorted = [...byModel]
            .filter(m => costPerModel[m.model])
            .sort((a, b) => (costPerModel[b.model] || 0) - (costPerModel[a.model] || 0));
        const top = sorted.slice(0, 5);
        const otherCost = sorted.slice(5).reduce((s, m) => s + (costPerModel[m.model] || 0), 0);
        const items = top.map((m, i) => ({
            label: shortModel(m.model),
            value: costPerModel[m.model] || 0,
            color: MODEL_COLORS[i % MODEL_COLORS.length],
        }));
        if (otherCost > 0) items.push({ label: 'Other', value: otherCost, color: '#64748b' });
        return items;
    }, [byModel, costPerModel]);

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            {/* ── KPI Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '1.5rem' }}>
                <MetricCard
                    icon={Zap} label="Total Calls" color={COLORS.primary}
                    value={fmt(summary?.total_calls || 0)}
                    delta={deltas?.calls} deltaLabel={deltaLabel}
                />
                <MetricCard
                    icon={BarChart3} label="Total Tokens" color={COLORS.green}
                    value={fmt(summary?.total_tokens || 0)}
                    delta={deltas?.tokens} deltaLabel={deltaLabel}
                />
                <MetricCard
                    icon={DollarSign} label="Est. Cost" color={COLORS.amber}
                    value={fmtCost(summary?.total_estimated_cost || totalCost || 0)}
                    delta={deltas?.cost} deltaLabel={deltaLabel}
                />
                <MetricCard
                    icon={Clock} label="Avg Latency" color={COLORS.pink}
                    value={fmtDuration(summary?.avg_duration_ms)}
                    delta={deltas?.latency}
                    deltaLabel={deltas?.latency != null ? (deltas.latency > 0 ? 'slower' : 'faster') : deltaLabel}
                />
            </div>
            {/* ── Cache & reasoning row (only render if either is non-zero) ── */}
            {((summary?.total_cached_tokens || 0) > 0 || (summary?.total_reasoning_tokens || 0) > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '1.5rem' }}>
                    <MetricCard
                        icon={Database} label="Cached Tokens" color={COLORS.green}
                        value={fmt(summary?.total_cached_tokens || 0)}
                        deltaLabel={(summary?.total_cache_creation_tokens || 0) > 0
                            ? `+ ${fmt(summary.total_cache_creation_tokens)} written`
                            : 'cache hits'}
                    />
                    <MetricCard
                        icon={Brain} label="Reasoning Tokens" color={COLORS.primary}
                        value={fmt(summary?.total_reasoning_tokens || 0)}
                        deltaLabel="o-series / thinking"
                    />
                </div>
            )}

            {/* ── Timeline Charts ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '1.25rem' }}>
                <Card title="Token Trend" icon={TrendingUp}>
                    <SvgAreaChart
                        data={timeline} yKey="total_tokens" color={COLORS.primary}
                        formatY={fmt}
                        formatLabel={d => `${d.period || ''} · ${d.calls || 0} calls`}
                    />
                </Card>
                <Card title="Cost Trend" icon={DollarSign}>
                    <SvgAreaChart
                        data={costTimeline} yKey="total_cost" color={COLORS.amber}
                        formatY={fmtCost}
                        formatLabel={d => `${d.period || ''} · ${fmtCost(d.total_cost || 0)}`}
                    />
                </Card>
            </div>

            {/* ── Two columns: Top Models + Top Agents ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '1.25rem' }}>
                <Card title="Top Models" icon={Cpu}>
                    {byModel.length === 0 ? <Empty text="No model data" /> : byModel.slice(0, 5).map((m, i) => (
                        <div key={i} onClick={() => onSelectModel?.(m)} style={{ cursor: 'pointer' }}>
                            <ModelRow model={m} index={i} maxTokens={Math.max(...byModel.map(m => m.total_tokens || 0), 1)} cost={costPerModel[m.model]} />
                        </div>
                    ))}
                </Card>
                <Card title="Top Agents" icon={Bot}>
                    {byAgent.length === 0 ? <Empty text="No agent data" /> : byAgent.slice(0, 5).map((a, i) => (
                        <div key={i} onClick={() => onSelectAgent?.(a)} style={{ cursor: 'pointer' }}>
                            <AgentRow agent={a} index={i} />
                        </div>
                    ))}
                </Card>
            </div>

            {/* ── Cost Breakdown + Tools ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {/* Cost donut */}
                <Card
                    title="Cost Breakdown"
                    icon={DollarSign}
                    action={onNavigate && (
                        <button
                            onClick={() => onNavigate('admin/ai-config')}
                            style={{
                                padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                                background: 'rgba(245, 158, 11, 0.1)', color: COLORS.amber,
                                border: '1px solid rgba(245, 158, 11, 0.2)', cursor: 'pointer',
                            }}
                        >
                            ⚙️ Model Costs
                        </button>
                    )}
                >
                    {donutItems.length === 0 ? (
                        <Empty text="No cost data — configure model pricing in AI Config" />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <DonutChart items={donutItems} centerLabel="Total" centerValue={fmtCost(totalCost)} />
                            {modelsWithCost.length < byModel.length && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted, #666)', padding: '6px 0' }}>
                                    ℹ️ {byModel.length - modelsWithCost.length} model{byModel.length - modelsWithCost.length > 1 ? 's' : ''} without cost data
                                </div>
                            )}
                        </div>
                    )}
                </Card>

                {/* Tool usage */}
                <Card title="Tool Usage" icon={Wrench}>
                    {tools.length === 0 ? <Empty text="No tool calls recorded" /> : (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {tools.slice(0, 15).map((t, i) => (
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
        </div>
    );
}
