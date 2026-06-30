// Shared "monitoring UI kit" for the Usage & Monitoring dashboard.
//
// Consolidates the visual primitives that the five tabs (Overview, Safety,
// Integrations, Feedback, Terminations) previously each re-implemented with
// small drifts: the big-number HERO, the small KPI cards (StatCard/MiniStat/
// KpiCard/Kpi → one MetricCard), the per-tab header, alert banner, chip
// filters, drill chips, show-more, collapsibles, etc.
//
// Inline-styled on purpose: it matches the dashboard's existing CSS-var
// vocabulary (--bg-secondary / --border-subtle / --text-muted) rather than the
// Tailwind/TSX shared components, so adopting it is a pure consolidation with
// no visual drift. No purple/violet/indigo anywhere.

import { AlertTriangle, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';

// ── Spacing tokens ───────────────────────────────────────────────────────────
// One value per role, applied everywhere, to resolve the old 14-vs-16 outer-gap
// and 8/10/12/14 grid-gap drift.
export const TOKENS = {
    pagePad: 16,        // outer column gap between sections
    sectionGap: 14,     // gap inside a section block
    cardPad: '14px 16px',
    cardRadius: 12,
    heroRadius: 14,
    heroPad: 18,
    gridGap: 12,        // breakdown-grid gutter
    tileGap: 8,         // hero 2×2 tile gutter
};

// ── Sparkline ────────────────────────────────────────────────────────────────
export const Sparkline = ({ values, color = '#0ea5e9', width = 60, height = 16 }) => {
    if (!Array.isArray(values) || values.length < 2) return null;
    const max = Math.max(...values, 1);
    const points = values.map((v, i) => {
        const x = (i / (values.length - 1)) * (width - 2) + 1;
        const y = height - 1 - ((v / max) * (height - 2));
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return (
        <svg width={width} height={height} style={{ display: 'block', marginTop: 2 }}>
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
};

// ── StatusPill ───────────────────────────────────────────────────────────────
// The uppercase status chip (Excellent / Watch / Critical / active …). `color`
// must be a hex so the `${color}15` tint is valid.
export const StatusPill = ({ label, color, dot = false }) => (
    <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 6,
        background: `${color}15`, color, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
        {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: color, display: 'inline-block' }} />}
        {label}
    </span>
);

// ── TrendChip ────────────────────────────────────────────────────────────────
// Half-period delta arrow. `goodWhenDown` for higher-is-bad metrics (cost, PII);
// false for higher-is-good (sovereignty score). `display` is the formatted
// magnitude (e.g. "$3.20" or "5").
export const TrendChip = ({ delta, display, title, goodWhenDown = false }) => {
    if (delta == null) return null;
    const isGood = goodWhenDown ? delta < 0 : delta > 0;
    const color = delta === 0 ? '#94a3b8' : isGood ? '#10b981' : '#ef4444';
    const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '·';
    return (
        <span title={title} style={{
            display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 5,
            background: delta === 0 ? 'var(--bg-tertiary)' : `${color}15`, color, fontSize: 11, fontWeight: 800,
        }}>
            <span style={{ fontSize: 13 }}>{arrow}</span>{display}
        </span>
    );
};

// ── Card ─────────────────────────────────────────────────────────────────────
// Default: an edge-to-edge container (ListRows fill it). When `title`/`right` is
// given it pads itself and renders a header row (the old Terminations Card).
export const Card = ({ children, style, title, icon: Icon, right, pad }) => {
    const padded = pad ?? (!!title || !!right);
    return (
        <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
            borderRadius: TOKENS.cardRadius, overflow: 'hidden',
            ...(padded ? { padding: TOKENS.cardPad } : null), ...style,
        }}>
            {(title || right) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {Icon && <Icon style={{ width: 14, height: 14, color: 'var(--accent-primary)', opacity: 0.8 }} />}
                        {title && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>}
                    </div>
                    {right}
                </div>
            )}
            {children}
        </div>
    );
};

// ── MetricCard ───────────────────────────────────────────────────────────────
// Single replacement for StatCard / MiniStat / KpiCard / Kpi.
//   size 'sm' → horizontal, 18px, optional sparkline (old MiniStat; hero asides)
//   size 'md' → vertical,   22px, optional subtitle  (old Kpi / StatCard)
//   size 'lg' → vertical,   24px, optional subtitle  (old KpiCard)
export const MetricCard = ({ icon: Icon, label, value, color = '#0ea5e9', subtitle, spark, size = 'md', onClick }) => {
    if (size === 'sm') {
        return (
            <div onClick={onClick} style={{
                padding: '10px 12px', borderRadius: 10, background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', gap: 10, cursor: onClick ? 'pointer' : 'default',
            }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}15`, flexShrink: 0 }}>
                    {Icon && <Icon style={{ width: 14, height: 14, color }} />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</div>
                    {Array.isArray(spark) && spark.length > 1 && <Sparkline values={spark} color={color} />}
                </div>
            </div>
        );
    }
    const valueSize = size === 'lg' ? 24 : 22;
    const chip = size === 'lg' ? 28 : 26;
    return (
        <div onClick={onClick} style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 12,
            padding: 14, display: 'flex', flexDirection: 'column', gap: 5, cursor: onClick ? 'pointer' : 'default',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: chip, height: chip, borderRadius: 7, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {Icon && <Icon style={{ width: 13, height: 13, color }} />}
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{label}</span>
            </div>
            <span style={{ fontSize: valueSize, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.05 }}>{value}</span>
            {subtitle && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subtitle}</span>}
        </div>
    );
};

// ── MetricGrid ───────────────────────────────────────────────────────────────
// `cols` for a fixed N-column grid; `min` for an auto-fit minmax grid.
export const MetricGrid = ({ children, cols = 2, min, gap = TOKENS.gridGap }) => (
    <div style={{
        display: 'grid',
        gridTemplateColumns: min ? `repeat(auto-fit, minmax(${min}px, 1fr))` : `repeat(${cols}, minmax(0, 1fr))`,
        gap,
    }}>
        {children}
    </div>
);

// ── MonitorHero ──────────────────────────────────────────────────────────────
// THE big-number + KPI-grid pattern used by every tab. Left: eyebrow (+ infoTip)
// + headline value + status pill + trend chip + subline + optional children
// (stacked bars / explainer). Right: `aside` (a MetricGrid of MetricCards, or a
// trend chart). `accent` must be a hex (drives the gradient wash).
export const MonitorHero = ({
    accent = '#10b981', eyebrow, infoTip, value, valueColor, valueSize = 54,
    status, trend, subline, leftRatio = 1.2, children, aside,
}) => (
    <div style={{
        borderRadius: TOKENS.heroRadius, padding: TOKENS.heroPad, background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)', overflow: 'hidden', position: 'relative',
    }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at top left, ${accent}12, transparent 60%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: aside ? `${leftRatio}fr 1fr` : '1fr', gap: 24, alignItems: 'center' }}>
            <div>
                {eyebrow && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{eyebrow}</span>
                        {infoTip}
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: valueSize, fontWeight: 800, color: valueColor || accent, letterSpacing: '-0.04em', lineHeight: 1 }}>{value}</span>
                    {status && <StatusPill label={status.label} color={status.color} />}
                    {trend}
                </div>
                {subline && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{subline}</div>}
                {children}
            </div>
            {aside && <div>{aside}</div>}
        </div>
    </div>
);

// ── TabHeader ────────────────────────────────────────────────────────────────
// Uniform per-tab header (icon + title + description + status pill + actions).
// `iconColor` must be a hex (drives the chip tint). `actions` holds the range
// control / refresh on the panels.
export const TabHeader = ({ icon: Icon, iconColor = '#0ea5e9', title, description, status, actions }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            {Icon && (
                <div style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${iconColor}18`, flexShrink: 0 }}>
                    <Icon style={{ width: 16, height: 16, color: iconColor }} />
                </div>
            )}
            <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>{title}</h3>
                    {status && <StatusPill label={status.label} color={status.color} dot={status.dot} />}
                </div>
                {description && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0', fontWeight: 400 }}>{description}</p>}
            </div>
        </div>
        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
);

// ── AlertBanner ──────────────────────────────────────────────────────────────
// One action-required banner for all tabs (Feedback/Terminations no longer
// re-implement it). Spacing comes from the parent column gap (no marginBottom).
export const AlertBanner = ({ severity = 'amber', title = 'Action required', message, ctaLabel, onCta, icon: Icon = AlertTriangle }) => {
    const c = severity === 'red' ? '#ef4444' : '#f59e0b';
    return (
        <div style={{
            padding: '12px 16px', borderRadius: 12, background: `${c}10`, border: `1px solid ${c}55`,
            display: 'flex', alignItems: 'center', gap: 12,
        }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${c}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon style={{ width: 16, height: 16, color: c }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: c }}>{title}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 1 }}>{message}</div>
            </div>
            {ctaLabel && onCta && (
                <button onClick={onCta} style={{
                    padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: c, color: 'white', fontWeight: 700, fontSize: 12,
                    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                }}>
                    {ctaLabel} <ChevronRight style={{ width: 14, height: 14 }} />
                </button>
            )}
        </div>
    );
};

// ── SectionTitle ─────────────────────────────────────────────────────────────
export const SectionTitle = ({ children, icon: Icon, right }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {Icon && <Icon style={{ width: 14, height: 14, color: 'var(--accent-primary)', opacity: 0.7 }} />}
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{children}</span>
        </div>
        {right}
    </div>
);

// ── ListRow ──────────────────────────────────────────────────────────────────
export const ListRow = ({ children, onClick, style: s }) => (
    <div
        onClick={onClick}
        style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 14px', background: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border-subtle)',
            cursor: onClick ? 'pointer' : 'default', transition: 'background 0.12s', ...s,
        }}
        onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
        onMouseLeave={e => { if (onClick) e.currentTarget.style.background = 'var(--bg-primary)'; }}
    >
        {children}
    </div>
);

// ── FilterChipBar ────────────────────────────────────────────────────────────
// One chip group. Options: { value, label, icon?, color?, count? }. A `color`
// adds the colored-dot + tinted-active affordance (Safety); without it the chip
// is a flat accent toggle (Feedback). `size='sm'` for the compact egress/EU row.
export const FilterChipBar = ({ value, onChange, options, size = 'md' }) => {
    const pad = size === 'sm' ? '4px 10px' : '5px 12px';
    const fs = size === 'sm' ? 10 : 11;
    return (
        <div style={{ display: 'flex', gap: size === 'sm' ? 4 : 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {options.map(o => {
                const active = value === o.value;
                const color = o.color;
                const Icon = o.icon;
                return (
                    <button key={String(o.value)} onClick={() => onChange(o.value)} style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: pad, borderRadius: 8,
                        border: active && color ? `1.5px solid ${color}` : '1px solid var(--border-subtle)',
                        background: active ? (color ? `${color}10` : 'var(--accent-primary)') : 'var(--bg-secondary)',
                        color: active ? (color || '#fff') : 'var(--text-muted)',
                        fontWeight: active ? 700 : 500, fontSize: fs, cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                        {color && <span style={{ width: 6, height: 6, borderRadius: 99, background: color, opacity: active ? 1 : 0.5 }} />}
                        {Icon && <Icon style={{ width: 12, height: 12 }} />}
                        {o.label}
                        {o.count != null && (
                            <span style={{
                                background: active ? (color ? `${color}20` : 'rgba(255,255,255,0.22)') : 'var(--bg-tertiary)',
                                padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                color: active ? (color || '#fff') : 'var(--text-muted)',
                            }}>{o.count}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

// ── DrillChip ────────────────────────────────────────────────────────────────
// The removable "axis: label ✕" filter chip used by Safety + Integrations.
export const DrillChip = ({ axis, label, onClear }) => (
    <div style={{ marginBottom: 8 }}>
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 6px 5px 10px', borderRadius: 99,
            background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.25)', fontSize: 11, color: 'var(--text-primary)',
        }}>
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0ea5e9' }}>{axis}</span>
            <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{String(label || '').replace(/_/g, ' ')}</span>
            <button onClick={onClear} aria-label="Clear filter" style={{
                width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
            }}>✕</button>
        </span>
    </div>
);

// ── ShowMore ─────────────────────────────────────────────────────────────────
export const ShowMore = ({ remaining, onMore, label = 'Show more' }) => (
    <button onClick={onMore} style={{
        width: '100%', padding: '10px 0', border: 'none', cursor: 'pointer',
        background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
        transition: 'all 0.15s', borderTop: '1px solid var(--border-subtle)',
    }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
    >
        {label}{remaining != null ? ` (${remaining} remaining)` : ''}
    </button>
);

// ── CollapsibleSection ───────────────────────────────────────────────────────
// Wraps a dense block under a click-to-expand header with a count badge, so the
// data is preserved but doesn't crowd the page by default.
export const CollapsibleSection = ({ title, icon: Icon, count, defaultOpen = false, right, children }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                <button onClick={() => setOpen(o => !o)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}>
                    <ChevronRight style={{ width: 14, height: 14, color: 'var(--text-muted)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                    {Icon && <Icon style={{ width: 14, height: 14, color: 'var(--accent-primary)', opacity: 0.7 }} />}
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
                    {count != null && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '1px 7px', borderRadius: 8 }}>{count}</span>}
                </button>
                {open && right}
            </div>
            {open && children}
        </div>
    );
};

// ── EmptyInline ──────────────────────────────────────────────────────────────
// Small "no data" line. `boxed` adds the bg-tertiary placard (Feedback/
// Terminations); default plain (inside an existing Card).
export const EmptyInline = ({ text, icon: Icon, boxed = false }) => (
    <div style={{
        padding: '22px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        ...(boxed ? { borderRadius: 10, background: 'var(--bg-tertiary)' } : null),
    }}>
        {Icon && <Icon style={{ width: 18, height: 18, opacity: 0.7 }} />}
        <span>{text}</span>
    </div>
);
