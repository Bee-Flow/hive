import React, { useMemo, useState } from 'react';
import MarkdownRenderer from '../../MarkdownRenderer';
import {
    Activity, Cpu, Zap, Clock, Wrench, BarChart3, RefreshCw,
    TrendingUp, Users, DollarSign, ChevronRight, Globe, Bot,
    ArrowUp, ArrowDown, Minus, Layers, MessageSquare, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { fmt, fmtCost, fmtDuration, fmtTime, COLORS, AGENT_COLORS, getAgentStyle, MODEL_COLORS } from './shared';
import { CostTimelineChart, MetricCard, Card, Empty, ModelRow, AgentRow } from './shared';


export function ModelsPage({ byModel, costPerModel, modelCosts, onSelect }) {
    const maxTokens = Math.max(...byModel.map(m => m.total_tokens || 0), 1);

    return (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <Card title="All Models" icon={Cpu}>
                {byModel.length === 0 ? <Empty text="No model usage data yet — send a message to start tracking" /> : (
                    <div>
                        {/* Table header */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 100px 90px',
                            gap: '8px', padding: '8px 12px', marginBottom: '4px',
                            fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                            letterSpacing: '0.05em', color: 'var(--text-muted, #666)',
                        }}>
                            <span>Model</span>
                            <span style={{ textAlign: 'right' }}>Input Tokens</span>
                            <span style={{ textAlign: 'right' }}>Output Tokens</span>
                            <span style={{ textAlign: 'right' }}>Total Tokens</span>
                            <span style={{ textAlign: 'right' }}>Calls</span>
                            <span style={{ textAlign: 'right' }}>Est. Cost</span>
                        </div>
                        {byModel.map((m, i) => (
                            <div key={i} onClick={() => onSelect?.(m)} style={{
                                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 100px 90px',
                                gap: '8px', padding: '10px 12px', borderRadius: '10px',
                                background: i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary, rgba(255,255,255,0.02))',
                                alignItems: 'center', animation: `slideIn ${0.1 + i * 0.03}s ease`,
                                cursor: 'pointer', transition: 'background 0.15s',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        background: MODEL_COLORS[i % MODEL_COLORS.length],
                                        flexShrink: 0,
                                    }} />
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {m.model || 'unknown'}
                                    </span>
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: 500, color: COLORS.blue, textAlign: 'right' }}>
                                    {fmt(m.prompt_tokens || 0)}
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: 500, color: COLORS.amber, textAlign: 'right' }}>
                                    {fmt(m.completion_tokens || 0)}
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: COLORS.green, textAlign: 'right' }}>
                                    {fmt(m.total_tokens || 0)}
                                </span>
                                <span style={{ fontSize: '13px', color: 'var(--text-muted, #888)', textAlign: 'right' }}>
                                    {m.calls}
                                </span>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: COLORS.amber, textAlign: 'right' }}>
                                    {costPerModel[m.model] ? fmtCost(costPerModel[m.model]) : '—'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Token Distribution Visual */}
            {byModel.length > 0 && (
                <Card title="Token Distribution" icon={Layers} style={{ marginTop: '14px' }}>
                    <div style={{ display: 'flex', height: '32px', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-tertiary, #222)' }}>
                        {byModel.map((m, i) => {
                            const pct = ((m.total_tokens || 0) / (byModel.reduce((s, x) => s + (x.total_tokens || 0), 0) || 1)) * 100;
                            if (pct < 1) return null;
                            return (
                                <div key={i} title={`${m.model}: ${fmt(m.total_tokens)} tokens (${pct.toFixed(1)}%)`} style={{
                                    width: `${pct}%`, background: MODEL_COLORS[i % MODEL_COLORS.length],
                                    transition: 'width 0.4s ease', position: 'relative',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '10px', fontWeight: 700, color: '#fff',
                                    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                                    minWidth: pct > 8 ? '0' : '0',
                                }}>
                                    {pct > 8 && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }}>{m.model?.split('/').pop()}</span>}
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
                        {byModel.map((m, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted, #888)' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: MODEL_COLORS[i % MODEL_COLORS.length] }} />
                                <span style={{ color: 'var(--text-secondary, #aaa)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {m.model?.split('/').pop() || 'unknown'}
                                </span>
                                <span style={{ fontWeight: 600 }}>{fmt(m.total_tokens)}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
}

