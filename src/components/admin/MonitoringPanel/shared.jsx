import React, { useState, useMemo } from 'react';
import {
    ArrowUp, ArrowDown, Minus, ChevronDown, X, Filter,
    Users, Bot, Cpu, Activity
} from 'lucide-react';

// ── Formatters ──────────────────────────────────────────────────────────────

export function fmt(n) {
    if (n == null) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(Math.round(n));
}

export function fmtCost(n) {
    if (!n || n === 0) return '$0.00';
    if (n >= 1) return '$' + n.toFixed(2);
    if (n >= 0.01) return '$' + n.toFixed(3);
    if (n >= 0.001) return '$' + n.toFixed(4);
    return '$' + n.toFixed(6);
}

// Cache-aware provider cost (USD) for a usage row, given its rate entry `c`
// ({ input, output, cacheRead } per 1M tokens from the model-costs map).
// Cached input tokens are billed at the cached rate, not the full input rate —
// matches the backend computeCost. Falls back gracefully when cacheRead or
// cached_tokens are absent (e.g. redacted non-admin rows → cached defaults 0).
export function rowCost(row, c) {
    if (!c) return null;
    const prompt = row?.prompt_tokens || 0;
    const completion = row?.completion_tokens || 0;
    const cached = row?.cached_tokens || 0;
    const uncached = Math.max(0, prompt - cached);
    const cacheRate = c.cacheRead > 0 ? c.cacheRead : (c.input || 0);
    return (uncached / 1e6) * (c.input || 0)
        + (cached / 1e6) * cacheRate
        + (completion / 1e6) * (c.output || 0);
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

export function fmtPct(n) {
    if (!n && n !== 0) return '—';
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(1)}%`;
}

export function shortModel(m) {
    if (!m) return 'Unknown';
    return m.replace(/^(openai\/|anthropic\/|google\/|azure\/|mistral\/)/, '')
        .replace(/-\d{4}-\d{2}-\d{2}$/, '');
}

// ── Colors ──────────────────────────────────────────────────────────────────

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

export const MODEL_COLORS = [
    '#6366f1', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981',
    '#f59e0b', '#f97316', '#ec4899', '#f43f5e', '#14b8a6',
];

export const SOURCE_MAP = {
    agent: { label: 'Agent Chat', icon: Bot, color: '#6366f1' },
    chat: { label: 'Agent Chat', icon: Bot, color: '#6366f1' },
    direct: { label: 'Direct Chat', icon: Activity, color: '#10b981' },
    notebook: { label: 'Notebooks', icon: Activity, color: '#8b5cf6' },
    research: { label: 'Research', icon: Activity, color: '#f59e0b' },
    template: { label: 'Templates', icon: Activity, color: '#ef4444' },
    designer: { label: 'App Designer', icon: Activity, color: '#0ea5e9' },
    agent_stream: { label: 'Agent Stream', icon: Bot, color: '#6366f1' },
};
export const getSourceDetails = (source) =>
    SOURCE_MAP[source] || { label: source || 'Other', icon: Activity, color: '#94a3b8' };

// ── Base UI Components ──────────────────────────────────────────────────────

export function Card({ title, icon: Icon, children, style: extraStyle, action }) {
    return (
        <div style={{
            background: 'var(--bg-secondary, #1a1a2e)', borderRadius: '14px',
            padding: '18px 20px', border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
            ...extraStyle,
        }}>
            {(title || action) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {Icon && <Icon style={{ width: 16, height: 16, color: COLORS.primary }} />}
                        {title && <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{title}</span>}
                    </div>
                    {action}
                </div>
            )}
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

export function MetricCard({ icon: Icon, label, value, color, subtitle, delta, deltaLabel }) {
    const deltaColor = delta > 0 ? COLORS.green : delta < 0 ? COLORS.rose : 'var(--text-muted, #888)';
    const DeltaIcon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;

    return (
        <div style={{
            background: 'var(--bg-secondary, #1a1a2e)', borderRadius: '14px',
            padding: '18px', border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
            display: 'flex', flexDirection: 'column', gap: '6px',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minHeight: '16px' }}>
                {delta != null && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px', fontWeight: 600, color: deltaColor }}>
                        <DeltaIcon style={{ width: 12, height: 12 }} />
                        {fmtPct(delta)}
                    </span>
                )}
                {(subtitle || deltaLabel) && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted, #888)' }}>
                        {subtitle || deltaLabel}
                    </span>
                )}
            </div>
        </div>
    );
}

// ── InOut Bar (stacked input/output bar) ────────────────────────────────────

export function InOutBar({ input, output, height = 5, style }) {
    const total = (input || 0) + (output || 0);
    if (total === 0) return <div style={{ width: '100%', height, borderRadius: 99, background: 'var(--bg-tertiary, rgba(255,255,255,0.06))', ...style }} />;
    const inputPct = ((input || 0) / total) * 100;
    return (
        <div style={{ width: '100%', height, borderRadius: 99, background: 'var(--bg-tertiary, rgba(255,255,255,0.06))', overflow: 'hidden', display: 'flex', ...style }}>
            <div style={{ height: '100%', width: `${inputPct}%`, background: COLORS.blue, borderRadius: '99px 0 0 99px', transition: 'width 0.4s ease' }} />
            <div style={{ height: '100%', flex: 1, background: COLORS.amber, borderRadius: '0 99px 99px 0', transition: 'width 0.4s ease' }} />
        </div>
    );
}

export function InOutLabel({ input, output, inputCost, outputCost, showCost }) {
    return (
        <div style={{ display: 'flex', gap: showCost ? 14 : 10, fontSize: '11px', color: 'var(--text-muted, #888)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: COLORS.blue, display: 'inline-block' }} />
                <span style={{ color: COLORS.blue, fontWeight: 600 }}>{fmt(input)}</span>
                {showCost && inputCost != null && <span style={{ color: COLORS.blue, opacity: 0.7, fontWeight: 500 }}>({fmtCost(inputCost)})</span>}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: COLORS.amber, display: 'inline-block' }} />
                <span style={{ color: COLORS.amber, fontWeight: 600 }}>{fmt(output)}</span>
                {showCost && outputCost != null && <span style={{ color: COLORS.amber, opacity: 0.7, fontWeight: 500 }}>({fmtCost(outputCost)})</span>}
            </span>
        </div>
    );
}

// ── SVG Area Chart ──────────────────────────────────────────────────────────

export function SvgAreaChart({ data, yKey = 'total_tokens', label = 'value', color = COLORS.primary, height = 140, formatY = fmt, formatLabel }) {
    const [hover, setHover] = useState(null);

    if (!data || data.length === 0) return <Empty text="No data to display" />;

    const maxY = Math.max(...data.map(d => d[yKey] || 0), 1);
    const points = data.map((d, i) => {
        const x = (i / Math.max(data.length - 1, 1)) * 100;
        const y = 100 - ((d[yKey] || 0) / maxY) * 90; // 90% max to leave top padding
        return { x, y, d };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaPath = `${linePath} L100,100 L0,100 Z`;

    return (
        <div style={{ position: 'relative', height }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                    <linearGradient id={`grad-${yKey}-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                    </linearGradient>
                </defs>
                <path d={areaPath} fill={`url(#grad-${yKey}-${color.replace('#', '')})`} />
                <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                {/* Hover zones */}
                {points.map((p, i) => (
                    <rect
                        key={i}
                        x={i === 0 ? 0 : (points[i - 1].x + p.x) / 2}
                        y="0"
                        width={i === 0 ? (points[1]?.x || 100) / 2 : i === points.length - 1 ? 100 - (points[i - 1].x + p.x) / 2 : (points[i + 1].x - points[i - 1].x) / 2}
                        height="100"
                        fill="transparent"
                        onMouseEnter={() => setHover(i)}
                        onMouseLeave={() => setHover(null)}
                        style={{ cursor: 'crosshair' }}
                    />
                ))}
                {/* Hover dot */}
                {hover != null && points[hover] && (
                    <circle cx={points[hover].x} cy={points[hover].y} r="3" fill={color} stroke="#fff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                )}
            </svg>
            {/* Hover tooltip */}
            {hover != null && points[hover] && (
                <div style={{
                    position: 'absolute',
                    left: `${points[hover].x}%`, top: '-6px',
                    transform: 'translateX(-50%)',
                    padding: '4px 10px', borderRadius: '8px',
                    background: 'var(--bg-primary, #0f0f1a)',
                    border: '1px solid var(--border-default, rgba(255,255,255,0.12))',
                    fontSize: '11px', fontWeight: 600, color: 'var(--text-primary, #fff)',
                    whiteSpace: 'nowrap', pointerEvents: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    zIndex: 10,
                }}>
                    <div style={{ color }}>{formatY(points[hover].d[yKey] || 0)}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted, #888)', marginTop: '1px' }}>
                        {formatLabel ? formatLabel(points[hover].d) : points[hover].d.period || ''}
                    </div>
                </div>
            )}
            {/* X-axis labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted, #666)' }}>{data[0]?.period?.slice(5) || ''}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted, #666)' }}>{data[data.length - 1]?.period?.slice(5) || ''}</span>
            </div>
        </div>
    );
}

// ── SVG Donut Chart ─────────────────────────────────────────────────────────

export function DonutChart({ items, size = 160, centerLabel, centerValue }) {
    const total = items.reduce((s, i) => s + (i.value || 0), 0) || 1;
    let cumulative = 0;

    const arcs = items.map((item, idx) => {
        const pct = (item.value || 0) / total;
        const startAngle = cumulative * 360;
        cumulative += pct;
        const endAngle = cumulative * 360;
        const large = pct > 0.5 ? 1 : 0;
        const r = 40;
        const cx = 50, cy = 50;
        const toRad = (deg) => (deg - 90) * (Math.PI / 180);
        const x1 = cx + r * Math.cos(toRad(startAngle));
        const y1 = cy + r * Math.sin(toRad(startAngle));
        const x2 = cx + r * Math.cos(toRad(endAngle - 0.1));
        const y2 = cy + r * Math.sin(toRad(endAngle - 0.1));
        const path = `M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2}`;
        return { ...item, path, pct, color: item.color || MODEL_COLORS[idx % MODEL_COLORS.length] };
    });

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <svg width={size} height={size} viewBox="0 0 100 100">
                {arcs.map((arc, i) => (
                    <path key={i} d={arc.path} fill="none" stroke={arc.color} strokeWidth="14" strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.4s ease' }} />
                ))}
                {centerLabel && (
                    <>
                        <text x="50" y="46" textAnchor="middle" fill="var(--text-muted, #888)" fontSize="6" fontWeight="600" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {centerLabel}
                        </text>
                        <text x="50" y="58" textAnchor="middle" fill="var(--text-primary, #fff)" fontSize="12" fontWeight="800">
                            {centerValue}
                        </text>
                    </>
                )}
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                {arcs.map((arc, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: arc.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-secondary, #aaa)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                            {arc.label}
                        </span>
                        <span style={{ color: 'var(--text-muted, #888)', fontWeight: 600, marginLeft: 'auto' }}>
                            {(arc.pct * 100).toFixed(0)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Filter Bar ──────────────────────────────────────────────────────────────

function FilterSelect({ icon: Icon, value, onChange, options, placeholder }) {
    return (
        <div style={{ position: 'relative' }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '8px',
                background: value ? `${COLORS.primary}15` : 'var(--bg-primary, #0f0f1a)',
                border: `1px solid ${value ? COLORS.primary + '40' : 'var(--border-default, rgba(255,255,255,0.08))'}`,
                fontSize: '12px', fontWeight: 500,
                color: value ? COLORS.primary : 'var(--text-secondary, #aaa)',
                transition: 'all 0.15s ease',
            }}>
                {Icon && <Icon style={{ width: 12, height: 12, flexShrink: 0 }} />}
                <select
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value || null)}
                    style={{
                        background: 'transparent', border: 'none', outline: 'none',
                        color: 'inherit', fontSize: '12px', fontWeight: 500,
                        cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
                        minWidth: '60px', paddingRight: '14px',
                    }}
                >
                    <option value="">{placeholder}</option>
                    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown style={{ width: 11, height: 11, position: 'absolute', right: 8, pointerEvents: 'none', opacity: 0.5 }} />
            </div>
        </div>
    );
}

export function FilterBar({ filters, setFilters, userOptions = [], agentOptions = [], modelOptions = [], sourceOptions = [] }) {
    const hasFilters = filters.user || filters.agent || filters.model || filters.source;
    const clear = () => setFilters({ user: null, agent: null, model: null, source: null });

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
            padding: '8px 12px', borderRadius: '10px',
            background: 'var(--bg-secondary, #1a1a2e)',
            border: '1px solid var(--border-default, rgba(255,255,255,0.08))',
            marginBottom: '16px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
                <Filter style={{ width: 12, height: 12, color: 'var(--text-muted, #888)' }} />
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted, #888)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filters</span>
            </div>
            <FilterSelect icon={Users} value={filters.user} onChange={v => setFilters(f => ({ ...f, user: v }))} options={userOptions} placeholder="All Users" />
            <FilterSelect icon={Bot} value={filters.agent} onChange={v => setFilters(f => ({ ...f, agent: v }))} options={agentOptions} placeholder="All Agents" />
            <FilterSelect icon={Cpu} value={filters.model} onChange={v => setFilters(f => ({ ...f, model: v }))} options={modelOptions} placeholder="All Models" />
            <FilterSelect icon={Activity} value={filters.source} onChange={v => setFilters(f => ({ ...f, source: v }))} options={sourceOptions} placeholder="All Sources" />
            {hasFilters && (
                <button onClick={clear} style={{
                    display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px',
                    border: 'none', background: 'var(--bg-tertiary, rgba(255,255,255,0.04))',
                    fontSize: '10px', fontWeight: 600, color: 'var(--text-muted, #888)', cursor: 'pointer',
                }}>
                    <X style={{ width: 10, height: 10 }} /> Clear
                </button>
            )}
        </div>
    );
}

// ── Sortable Table ──────────────────────────────────────────────────────────

export function SortableTable({ columns, data, onRowClick, emptyText = 'No data', maxRows = 50 }) {
    const [sortCol, setSortCol] = useState(null);
    const [sortDir, setSortDir] = useState('desc');

    const handleSort = (colKey) => {
        if (sortCol === colKey) {
            setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        } else {
            setSortCol(colKey);
            setSortDir('desc');
        }
    };

    const sorted = useMemo(() => {
        if (!sortCol) return data;
        return [...data].sort((a, b) => {
            const av = a[sortCol], bv = b[sortCol];
            if (typeof av === 'number' && typeof bv === 'number') {
                return sortDir === 'desc' ? bv - av : av - bv;
            }
            const as = String(av || ''), bs = String(bv || '');
            return sortDir === 'desc' ? bs.localeCompare(as) : as.localeCompare(bs);
        });
    }, [data, sortCol, sortDir]);

    if (data.length === 0) return <Empty text={emptyText} />;

    const gridCols = columns.map(c => c.width || '1fr').join(' ');

    return (
        <div>
            {/* Header */}
            <div style={{
                display: 'grid', gridTemplateColumns: gridCols,
                gap: '8px', padding: '8px 12px', marginBottom: '2px',
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.05em', color: 'var(--text-muted, #666)',
            }}>
                {columns.map(col => (
                    <span
                        key={col.key}
                        onClick={() => col.sortable !== false && handleSort(col.key)}
                        style={{
                            textAlign: col.align || 'left',
                            cursor: col.sortable !== false ? 'pointer' : 'default',
                            userSelect: 'none',
                            display: 'flex', alignItems: 'center', gap: '3px',
                            justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start',
                        }}
                    >
                        {col.label}
                        {sortCol === col.key && (
                            <span style={{ fontSize: '8px', opacity: 0.7 }}>{sortDir === 'desc' ? '▼' : '▲'}</span>
                        )}
                    </span>
                ))}
            </div>
            {/* Rows */}
            {sorted.slice(0, maxRows).map((row, i) => (
                <div
                    key={row._key || i}
                    onClick={() => onRowClick?.(row)}
                    style={{
                        display: 'grid', gridTemplateColumns: gridCols,
                        gap: '8px', padding: '10px 12px', borderRadius: '8px',
                        background: i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary, rgba(255,255,255,0.02))',
                        alignItems: 'center',
                        cursor: onRowClick ? 'pointer' : 'default',
                        transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (onRowClick) e.currentTarget.style.background = 'var(--bg-tertiary, rgba(255,255,255,0.05))'; }}
                    onMouseLeave={e => { if (onRowClick) e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary, rgba(255,255,255,0.02))'; }}
                >
                    {columns.map(col => (
                        <div key={col.key} style={{ textAlign: col.align || 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {col.render ? col.render(row, i) : (
                                <span style={{ fontSize: '12px', fontWeight: 500, color: col.color || 'var(--text-primary, #fff)' }}>
                                    {row[col.key] ?? '—'}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

// ── Model / Agent Rows (lightweight) ────────────────────────────────────────

export function ModelRow({ model: m, index, maxTokens, cost }) {
    const cached = m.cached_tokens || 0;
    const reasoning = m.reasoning_tokens || 0;
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
                    {shortModel(m.model || 'unknown')}
                </div>
                <InOutBar input={m.prompt_tokens} output={m.completion_tokens} height={3} style={{ marginTop: '4px', maxWidth: '120px' }} />
                {(cached > 0 || reasoning > 0) && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted, #888)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                        {cached > 0 && <span title="Cached input tokens">💾 {fmt(cached)}</span>}
                        {reasoning > 0 && <span title="Reasoning / thinking tokens (billed at output rate)">🧠 {fmt(reasoning)}</span>}
                    </div>
                )}
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

// ── Skeleton / Loading ──────────────────────────────────────────────────────

export function Skeleton({ height = 80, style }) {
    return (
        <div style={{
            height, borderRadius: '12px',
            background: 'var(--bg-tertiary, rgba(255,255,255,0.04))',
            animation: 'pulse 1.5s ease-in-out infinite',
            ...style,
        }} />
    );
}

export function SkeletonGrid({ count = 4, height = 80 }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, gap: '12px' }}>
            {Array.from({ length: count }, (_, i) => <Skeleton key={i} height={height} />)}
        </div>
    );
}
