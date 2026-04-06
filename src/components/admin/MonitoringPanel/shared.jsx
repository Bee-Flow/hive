import React from 'react';
import {
    Activity, Cpu, Zap, Clock, Wrench, BarChart3, RefreshCw,
    TrendingUp, Users, DollarSign, ChevronRight, Globe, Bot,
    ArrowUp, ArrowDown, Minus, Layers, MessageSquare, ThumbsUp, ThumbsDown
} from 'lucide-react';

// Formatters
export function fmt(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
}

export function fmtCost(n) {
    if (!n || n === 0) return '$0.00';
    if (n >= 1) return '$' + n.toFixed(2);
    if (n >= 0.01) return '$' + n.toFixed(3);
    if (n >= 0.001) return '$' + n.toFixed(4);
    return '$' + n.toFixed(6);
}

export function fmtDuration(ms) {
    if (!ms) return '—';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

export function fmtTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60_000) return 'just now';
    if (diff < 3600_000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const COLORS = {
    primary: '#6366f1',
    purple: '#8b5cf6',
    blue: '#3b82f6',
    green: '#10b981',
    emerald: '#059669',
    amber: '#f59e0b',
    orange: '#f97316',
    rose: '#f43f5e',
    pink: '#ec4899',
    cyan: '#06b6d4',
    teal: '#14b8a6',
};

export const AGENT_COLORS = {
    chat: { bg: '#6366f115', text: '#818cf8', label: '💬 Chat' },
    system: { bg: '#8b5cf615', text: '#a78bfa', label: '⚙️ System' },
};

export function getAgentStyle(type) {
    return AGENT_COLORS[type] || AGENT_COLORS.chat;
}

export const MODEL_COLORS = ['#6366f1', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#f97316', '#ec4899', '#f43f5e', '#14b8a6'];


export function CostTimelineChart({ data, color1 = COLORS.amber, color2 = COLORS.orange }) {
    const maxCost = Math.max(...data.map(d => d.total_cost || 0), 0.001);
    if (data.length === 0) return <Empty text="No cost data yet" />;
    return (
        <div style={{ padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '120px' }}>
                {data.slice(-30).map((d, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                        <div
                            style={{
                                width: '100%', minWidth: '4px',
                                height: `${Math.max((d.total_cost / maxCost) * 100, 3)}%`,
                                background: `linear-gradient(to top, ${color1}, ${color2})`,
                                borderRadius: '4px 4px 0 0',
                                transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                opacity: 0.85,
                            }}
                            title={`${d.period}: ${fmtCost(d.total_cost)}, ${d.calls} calls`}
                        />
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted, #666)' }}>
                    {data[0]?.period?.slice(5) || ''}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted, #666)' }}>
                    {data[data.length - 1]?.period?.slice(5) || ''}
                </span>
            </div>
        </div>
    );
}


export function MetricCard({ icon: Icon, label, value, color, subtitle }) {
    return (
        <div style={{
            background: 'var(--bg-secondary, #1a1a2e)', borderRadius: '14px',
            padding: '18px', border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
            display: 'flex', flexDirection: 'column', gap: '8px',
            transition: 'border-color 0.2s, transform 0.2s',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                    width: '30px', height: '30px', borderRadius: '8px',
                    background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Icon style={{ width: 16, height: 16, color }} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #888)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {label}
                </span>
            </div>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary, #fff)', lineHeight: 1 }}>
                {value}
            </span>
            {subtitle && <span style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>{subtitle}</span>}
        </div>
    );
}

export function Card({ title, icon: Icon, children, style: extraStyle }) {
    return (
        <div style={{
            background: 'var(--bg-secondary, #1a1a2e)', borderRadius: '14px',
            padding: '18px 20px', border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
            ...extraStyle,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Icon style={{ width: 16, height: 16, color: COLORS.primary }} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{title}</span>
            </div>
            {children}
        </div>
    );
}

export function Empty({ text }) {
    return (
        <div style={{
            padding: '2.5rem 1rem', textAlign: 'center',
            color: 'var(--text-muted, #666)', fontSize: '13px',
            borderRadius: '10px', background: 'var(--bg-tertiary, rgba(255,255,255,0.02))',
        }}>
            {text}
        </div>
    );
}

export function ModelRow({ model: m, index, maxTokens, cost }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 0', borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.05))',
        }}>
            <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: MODEL_COLORS[index % MODEL_COLORS.length], flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.model || 'unknown'}
                </div>
                <div style={{ height: '4px', borderRadius: '2px', background: 'var(--bg-tertiary, #222)', overflow: 'hidden', marginTop: '4px' }}>
                    <div style={{
                        height: '100%', borderRadius: '2px',
                        width: `${((m.total_tokens || 0) / maxTokens) * 100}%`,
                        background: MODEL_COLORS[index % MODEL_COLORS.length],
                        transition: 'width 0.3s ease',
                    }} />
                </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: COLORS.green }}>{fmt(m.total_tokens)}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted, #888)' }}>
                    {m.calls} calls{cost ? ` · ${fmtCost(cost)}` : ''}
                </div>
            </div>
        </div>
    );
}

export function AgentRow({ agent: a, index, detailed }) {
    const style = getAgentStyle(a.agent_type);
    return (
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0', borderBottom: '1px solid var(--border-default, rgba(255,255,255,0.05))',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span style={{
                    padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700,
                    background: style.bg, color: style.text, flexShrink: 0,
                }}>{a.agent_type || 'chat'}</span>
                <span style={{
                    fontSize: '12px', fontWeight: 600, color: 'var(--text-primary, #fff)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: detailed ? '200px' : '130px',
                }}>{a.agent_name || a.agent_id || 'Unknown'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', flexShrink: 0 }}>
                {detailed && (
                    <span style={{ color: 'var(--text-muted, #888)' }}>{fmtDuration(a.avg_duration_ms)} avg</span>
                )}
                <span style={{ color: COLORS.green, fontWeight: 600 }}>{fmt(a.total_tokens)} tok</span>
                <span style={{ color: 'var(--text-muted, #888)' }}>{a.calls} calls</span>
                <span style={{ color: COLORS.amber, fontWeight: 600, minWidth: '50px', textAlign: 'right' }}>{fmtCost(a.estimated_cost || 0)}</span>
            </div>
        </div>
    );
}

