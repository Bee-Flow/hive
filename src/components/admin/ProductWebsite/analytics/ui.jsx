/**
 * Presentation kit for the Website Analytics dashboard.
 *
 * Composes the two existing admin kits rather than adding a fourth:
 *   - MonitoringPanel/shared : Card, SvgAreaChart, DonutChart, SortableTable, fmt
 *   - settings/usage/kit     : TrendChip, Sparkline, MetricCard, TOKENS
 * Only genuinely new primitives (drill-down breakdowns, partial-error notes,
 * heatmap/funnel/retention visuals) are written from scratch.
 *
 * Colour rule: the project bans purple/violet/indigo, and MonitoringPanel's
 * COLORS.primary is #6366f1 — so every chart/card here is passed an explicit
 * colour and nothing is allowed to fall back to the shared default.
 */
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Card as BaseCard, Empty, SortableTable, fmt } from '../../MonitoringPanel/shared';
import { TrendChip } from '../../../../pages/settings/usage/kit';

export const ACCENT = '#14b8a6';                                  // teal
export const PALETTE = ['#3b82f6', '#14b8a6', '#10b981', '#f59e0b', '#f97316', '#06b6d4', '#f43f5e', '#0ea5e9'];
export const paletteAt = (i) => PALETTE[i % PALETTE.length];

/**
 * Categorical series colours, as a fixed set rather than by rank.
 *
 * PALETTE's teal and emerald are near-indistinguishable side by side, and
 * assigning by index means bars repaint when a list is filtered. Ranked lists
 * should be single-hue (length carries magnitude); only genuinely categorical
 * series need distinct colours, and then these four.
 */
export const SERIES = Object.freeze({
    primary: '#14b8a6', secondary: '#3b82f6', warn: '#f59e0b', bad: '#f43f5e',
});

export { Empty, SortableTable, fmt };

/**
 * Card, shadowing MonitoringPanel's.
 *
 * Identical prop surface, but the icon defaults to ACCENT instead of
 * COLORS.primary — which is #6366f1, the indigo this project bans. Wrapping
 * here fixes every card on the dashboard without touching the monitoring
 * dashboard that legitimately uses the shared one.
 */
export function Card({ title, icon: Icon, children, style, action, iconColor = ACCENT }) {
    // Memoised: a component type created inline during render is a new type on
    // every render, which would remount the icon each time.
    const Tinted = React.useMemo(
        () => (Icon ? (props) => <Icon {...props} style={{ ...props?.style, color: iconColor }} /> : undefined),
        [Icon, iconColor],
    );
    return (
        <BaseCard title={title} icon={Tinted} action={action} style={style}>
            {children}
        </BaseCard>
    );
}

/** Max of a numeric list without spreading it — `Math.max(...arr)` blows the
 *  argument limit (and throws RangeError) somewhere around 100k entries, which
 *  a busy heatmap page reaches easily. */
export function maxOf(values, initial = 1) {
    let m = initial;
    for (const v of values) if (Number.isFinite(v) && v > m) m = v;
    return m;
}

// ── Value helpers ────────────────────────────────────────────────────

// Umami stat fields are either { value, prev } or a bare number depending on
// version — normalise both.
export const statVal = (s) => (s && typeof s === 'object' ? (s.value ?? 0) : (typeof s === 'number' ? s : 0));

export function fmtDurationSec(sec) {
    const s = Math.max(0, Math.round(sec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

/** Umami reports replay/session durations in MILLISECONDS. Formatting them as
 *  seconds turned an 11.8-second recording into "196m 21s". */
export function fmtDurationMs(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n < 0) return '—';
    return n < 1000 ? '<1s' : fmtDurationSec(n / 1000);
}

export function fmtAgo(ts, now = Date.now()) {
    const t = typeof ts === 'number' ? ts : Date.parse(ts);
    if (!Number.isFinite(t)) return '';
    const s = Math.max(0, Math.round((now - t) / 1000));
    if (s < 45) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
}

/** `{ "/faq": 5, "/": 2 }` → `[{ x, y }]` sorted desc. Umami's realtime
 *  endpoint returns maps where every other endpoint returns rows. */
export function mapToRows(map) {
    if (!map || typeof map !== 'object' || Array.isArray(map)) return [];
    return Object.entries(map)
        .map(([x, y]) => ({ x, y: Number(y) || 0 }))
        .sort((a, b) => b.y - a.y);
}

/** Umami /pageviews → rows for SvgAreaChart (`period` x-label, `value` yKey). */
export function toTimeseries(series) {
    const arr = Array.isArray(series) ? series : [];
    return arr.map(p => ({ period: String(p.x || '').slice(0, 16).replace('T', ' '), value: p.y || 0 }));
}

/**
 * Umami /metrics → [{ x, y }] → table rows.
 *
 * A missing value is flagged with `isBlank` rather than substituted with the
 * string "(none)": renderers then choose the right words for their dimension
 * ("Direct" for a referrer, "Unknown" for a country), and — the actual bug —
 * a dimension whose real value happens to BE "(none)" stays drillable.
 */
export function toRows(arr) {
    return (Array.isArray(arr) ? arr : []).map((d, i) => ({
        label: d.x || null,
        isBlank: !d.x,
        count: d.y || 0,
        _key: `${i}-${d.x ?? ''}`,
    }));
}

export function toDonut(arr) {
    return (Array.isArray(arr) ? arr : [])
        .filter(d => (d.y || 0) > 0)
        .map((d, i) => ({ label: d.x || '(none)', value: d.y || 0, color: paletteAt(i) }));
}

/**
 * Percentage delta vs the previous period. Umami's `stats` returns a
 * `comparison` block that the old dashboard threw away.
 */
export function deltaPct(current, previous) {
    const c = Number(current) || 0;
    const p = Number(previous) || 0;
    if (!p) return null;
    return Math.round(((c - p) / p) * 100);
}

/**
 * Period-over-period comparison, aware of what kind of number it is given.
 *
 * `deltaPct` alone is wrong twice over. On a RATE it reports the relative
 * change of a percentage — a bounce rate moving 25% → 20% renders as "↓20%"
 * when the honest statement is "5 points better". And when the previous period
 * is 0 it returns null, so going from nothing to something — usually the most
 * interesting thing on the page — renders as blank space.
 *
 * @param kind 'count' | 'rate' (0-100 points) | 'duration' (seconds) | 'ratio' (0-1)
 * @returns { delta, display, state } — state ∈ up | down | flat | new | none
 */
export function compare(current, previous, kind = 'count') {
    const c = Number(current);
    const p = Number(previous);
    if (!Number.isFinite(c)) return { delta: null, display: null, state: 'none' };

    if (kind === 'rate' || kind === 'ratio') {
        if (!Number.isFinite(p)) return { delta: null, display: null, state: 'none' };
        const scale = kind === 'ratio' ? 100 : 1;
        const points = (c - p) * scale;
        if (Math.abs(points) < 0.05) return { delta: 0, display: 'no change', state: 'flat' };
        return {
            delta: points,
            display: `${Math.abs(points).toFixed(1)} pts`,
            state: points > 0 ? 'up' : 'down',
        };
    }

    if (!Number.isFinite(p) || p === 0) {
        // A previous period of zero has no meaningful percentage, but "new" is
        // still information — far better than rendering nothing at all.
        if (c === 0) return { delta: null, display: null, state: 'none' };
        return { delta: 100, display: 'new', state: 'new' };
    }

    const pct = ((c - p) / p) * 100;
    if (Math.abs(pct) < 0.5) return { delta: 0, display: 'no change', state: 'flat' };
    return {
        delta: Math.round(pct),
        display: `${Math.abs(Math.round(pct))}%`,
        state: pct > 0 ? 'up' : 'down',
    };
}

/** Traffic-light for a rate where lower is better (bounce, exit). The value is
 *  always printed alongside — colour is never the only carrier. */
export function rateColor(pct) {
    const n = Number(pct);
    if (!Number.isFinite(n)) return 'var(--text-muted, #888)';
    if (n <= 40) return '#10b981';
    if (n <= 60) return '#f59e0b';
    return '#f43f5e';
}

// ── Stat tile with comparison ────────────────────────────────────────

export function StatTile({
    icon: Icon, label, value, color = ACCENT, delta, deltaLabel,
    goodWhenDown = false, subtitle, deltaDisplay, state,
}) {
    // `state: 'new'` has no percentage worth showing — TrendChip would render
    // "100%", implying a measured doubling rather than "there was nothing here
    // before".
    const chipDisplay = deltaDisplay ?? (delta != null ? `${Math.abs(delta)}%` : null);
    return renderStatTile({ Icon, label, value, color, delta, chipDisplay, deltaLabel, goodWhenDown, subtitle, state });
}

function renderStatTile({ Icon, label, value, color, delta, chipDisplay, deltaLabel, goodWhenDown, subtitle, state }) {
    return (
        <div style={{
            background: 'var(--bg-secondary, #1a1a2e)',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            borderRadius: 12, padding: '12px 14px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                {Icon && <Icon style={{ width: 14, height: 14, color }} />}
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted, #888)' }}>{label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary, #fff)', lineHeight: 1.1 }}>{value}</span>
                {state === 'new' ? (
                    <span title={deltaLabel || 'nothing in the previous period'} style={{
                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                        padding: '2px 6px', borderRadius: 5, background: `${ACCENT}1f`, color: ACCENT,
                    }}>new</span>
                ) : state === 'flat' ? (
                    <span title={deltaLabel || 'vs previous period'}
                        style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>no change</span>
                ) : delta != null && chipDisplay ? (
                    <TrendChip delta={delta} display={chipDisplay} goodWhenDown={goodWhenDown}
                        title={deltaLabel || 'vs previous period'} />
                ) : null}
            </div>
            {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted, #777)', marginTop: 3 }}>{subtitle}</div>}
        </div>
    );
}

export function StatGrid({ children, min = 170 }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 }}>
            {children}
        </div>
    );
}

// ── Failure + loading states ─────────────────────────────────────────

/**
 * A card whose data failed to load.
 *
 * This exists because the previous dashboard rendered upstream failures as an
 * ordinary empty table — which is how a hard 400 on every "Top pages" request
 * went unnoticed. An empty state must mean "no data", never "we broke".
 */
export function ErrorNote({ message, onRetry, compact = false }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: compact ? '8px 10px' : '10px 14px', borderRadius: 10,
            background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)',
            color: '#fda4af', fontSize: 12,
        }}>
            <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
            <span style={{ flex: 1, wordBreak: 'break-word' }}>{message}</span>
            {onRetry && (
                <button onClick={onRetry} title="Retry" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent',
                    border: '1px solid rgba(244,63,94,0.35)', borderRadius: 7, color: '#fda4af',
                    fontSize: 11, fontWeight: 700, padding: '3px 8px', cursor: 'pointer', flexShrink: 0,
                }}>
                    <RefreshCw style={{ width: 11, height: 11 }} /> Retry
                </button>
            )}
        </div>
    );
}

export function Skeleton({ height = 80, style }) {
    return (
        <div style={{
            height, borderRadius: 10, background: 'var(--bg-secondary, rgba(255,255,255,0.04))',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
            animation: 'bf-analytics-pulse 1.4s ease-in-out infinite', ...style,
        }} />
    );
}

export function SkeletonGrid({ count = 4, height = 80, min = 170 }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 }}>
            {Array.from({ length: count }, (_, i) => <Skeleton key={i} height={height} />)}
        </div>
    );
}

/** Keyframes for the skeleton pulse — mounted once by the panel shell. */
export function AnalyticsStyles() {
    return (
        <style>{`
            @keyframes bf-analytics-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.45 } }
        `}</style>
    );
}

/**
 * Wraps a section body in the three states every panel needs. Keeps each
 * section from re-implementing loading/error/empty inconsistently.
 */
export function AsyncCard({ title, icon, loading, error, onRetry, isEmpty, emptyText, children, right, height = 120 }) {
    let body;
    if (loading) body = <Skeleton height={height} />;
    else if (error) body = <ErrorNote message={error} onRetry={onRetry} compact />;
    else if (isEmpty) body = <Empty text={emptyText || 'No data'} />;
    else body = children;
    return <Card title={title} icon={icon} action={right}>{body}</Card>;
}

// ── Breakdown table with drill-down ──────────────────────────────────

/**
 * A [{x,y}] dimension rendered as a sortable table. Clicking a row adds a
 * dashboard-wide filter when `onDrill` is given.
 */
export function BreakdownTable({
    rows, labelHeader, valueHeader = 'Views', onDrill, maxRows = 10, emptyText,
    blankLabel = 'Unknown',
}) {
    const data = toRows(rows);
    const total = data.reduce((a, r) => a + r.count, 0);
    const columns = [
        {
            key: 'label', label: labelHeader, width: '1fr',
            render: (r) => {
                const text = r.isBlank ? blankLabel : r.label;
                const clickable = !!onDrill && !r.isBlank;
                return (
                    <span
                        title={clickable ? `Filter by ${text}` : text}
                        style={{
                            fontSize: 12, overflow: 'hidden',
                            color: r.isBlank ? 'var(--text-muted, #888)' : 'var(--text-primary, #fff)',
                            fontStyle: r.isBlank ? 'italic' : 'normal',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            textDecoration: clickable ? 'underline dotted' : 'none',
                            textUnderlineOffset: 3,
                        }}
                    >{text}</span>
                );
            },
        },
        {
            key: 'count', label: valueHeader, width: '120px', align: 'right',
            render: (r) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
                    <ShareBar value={r.count} of={total} width={44} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, minWidth: 34, textAlign: 'right' }}>{fmt(r.count)}</span>
                </span>
            ),
        },
    ];
    return (
        <SortableTable
            columns={columns}
            data={data}
            maxRows={maxRows}
            emptyText={emptyText || 'No data'}
            onRowClick={onDrill ? (r) => !r.isBlank && onDrill(r.label) : undefined}
        />
    );
}

/**
 * The "bar in a table cell" every section wanted its own table for. It is a
 * cell renderer, not a table — `SortableTable` stays the only table.
 */
export function ShareBar({ value, of, color = ACCENT, height = 5, width, label }) {
    const pct = of > 0 ? Math.max(0, Math.min(100, (Number(value) / of) * 100)) : 0;
    return (
        <span
            title={label || `${pct.toFixed(1)}%`}
            style={{
                display: 'inline-block', width: width || '100%', height,
                borderRadius: 99, background: 'var(--bg-tertiary, rgba(255,255,255,0.08))',
                overflow: 'hidden', verticalAlign: 'middle', flexShrink: 0,
            }}
        >
            <span style={{ display: 'block', width: `${pct}%`, height: '100%', borderRadius: 99, background: color }} />
        </span>
    );
}

/**
 * A composition bar — one row showing how a whole divides into parts.
 * `mode: 'diverging'` splits positive/negative around a centre line, for
 * period-over-period change.
 */
export function SplitBar({ segments, mode = 'stacked', height = 10, legend = false, formatValue = fmt }) {
    const items = (Array.isArray(segments) ? segments : []).filter(s => (Number(s.value) || 0) !== 0);
    if (!items.length) return null;
    const total = items.reduce((a, s) => a + Math.abs(Number(s.value) || 0), 0) || 1;

    return (
        <div>
            <div style={{ display: 'flex', height, borderRadius: 99, overflow: 'hidden', gap: 1 }}>
                {items.map((s, i) => {
                    const share = (Math.abs(Number(s.value) || 0) / total) * 100;
                    const color = s.color || (mode === 'diverging'
                        ? (Number(s.value) >= 0 ? SERIES.primary : SERIES.bad)
                        : paletteAt(i));
                    return (
                        <div
                            key={`${s.label}-${i}`}
                            title={`${s.label}: ${formatValue(s.value)} (${share.toFixed(1)}%)`}
                            style={{ width: `${share}%`, background: color }}
                        />
                    );
                })}
            </div>
            {legend && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                    {items.map((s, i) => (
                        <span key={`${s.label}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                            <span style={{
                                width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                                background: s.color || (mode === 'diverging'
                                    ? (Number(s.value) >= 0 ? SERIES.primary : SERIES.bad)
                                    : paletteAt(i)),
                            }} />
                            <span style={{ color: 'var(--text-muted, #888)' }}>{s.label}</span>
                            <span style={{ color: 'var(--text-primary, #fff)', fontWeight: 700 }}>{formatValue(s.value)}</span>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Horizontal bar list — better than a table when the shape is a ranking.
 *
 * Single-hue by default: in a ranking, bar length already carries magnitude and
 * the label carries identity, so per-rank colours add nothing and actively
 * mislead — the same item changes colour when the list is filtered. Pass
 * `color` to override, or `peak` to keep the scale stable across two lists.
 */
export function BarList({
    rows, onDrill, max = 8, formatValue = fmt, emptyText = 'No data',
    color = ACCENT, peak: peakProp, blankLabel = 'Unknown',
}) {
    const items = (Array.isArray(rows) ? rows : []).slice(0, max);
    if (!items.length) return <Empty text={emptyText} />;
    const peak = peakProp || maxOf(items.map(r => r.y || 0));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {items.map((r, i) => {
                const isBlank = !r.x;
                const label = isBlank ? blankLabel : r.x;
                const clickable = !!onDrill && !isBlank;
                return (
                    <button
                        key={`${i}-${label}`}
                        onClick={clickable ? () => onDrill(label) : undefined}
                        title={clickable ? `Filter by ${label}` : label}
                        style={{
                            display: 'block', width: '100%', textAlign: 'left', background: 'transparent',
                            border: 'none', padding: 0, cursor: clickable ? 'pointer' : 'default',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 3 }}>
                            <span style={{
                                fontSize: 12, overflow: 'hidden',
                                color: isBlank ? 'var(--text-muted, #888)' : 'var(--text-primary, #fff)',
                                fontStyle: isBlank ? 'italic' : 'normal',
                                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>{label}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, flexShrink: 0 }}>{formatValue(r.y || 0)}</span>
                        </div>
                        <ShareBar value={r.y || 0} of={peak} color={color} />
                    </button>
                );
            })}
        </div>
    );
}
