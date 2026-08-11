/**
 * Performance — Core Web Vitals.
 *
 * The old version was a lie with a nice haircut: `summary.count` was 0 because
 * the tracker never asked for vitals, yet `band(0, …)` graded that as GOOD, so
 * five cards reported a flawless 0 ms for something never measured once.
 *
 * Two rules follow from that and are load-bearing here:
 *   1. Nothing is graded unless it was measured. `count === 0` is a distinct
 *      state — amber "not measured", never a green zero.
 *   2. Percentile gaps stay null. A day with no samples is a hole in the line,
 *      not a day the site was infinitely fast.
 *
 * Thresholds are Google's official Core Web Vitals bands, evaluated at p75 the
 * way CrUX does.
 */
import React, { useMemo, useState } from 'react';
import { Gauge, Wrench } from 'lucide-react';
import { useAnalyticsQuery } from '../useAnalyticsQuery';
import { ACCENT, Card, Empty, ErrorNote, Skeleton, ShareBar, fmt } from '../ui';
import TrendChart from '../charts/TrendChart';
import { resolveWindow, densify, bucketLabel } from '../window';

const GOOD = '#10b981';
const MEH = '#f59e0b';
const POOR = '#ef4444';

// [good <=, needs-improvement <=] in the metric's own unit.
const METRICS = [
    { id: 'lcp', label: 'LCP', name: 'Largest Contentful Paint', unit: 'ms', bands: [2500, 4000], fix: 'a large image or font above the fold' },
    { id: 'inp', label: 'INP', name: 'Interaction to Next Paint', unit: 'ms', bands: [200, 500], fix: 'heavy JavaScript blocking clicks' },
    { id: 'cls', label: 'CLS', name: 'Cumulative Layout Shift', unit: '', bands: [0.1, 0.25], fix: 'images or embeds without reserved space' },
    { id: 'fcp', label: 'FCP', name: 'First Contentful Paint', unit: 'ms', bands: [1800, 3000], fix: 'render-blocking CSS or slow hosting' },
    { id: 'ttfb', label: 'TTFB', name: 'Time to First Byte', unit: 'ms', bands: [800, 1800], fix: 'server or network latency' },
];

function band(value, [good, meh]) {
    if (value == null) return { color: 'var(--text-muted, #888)', label: 'Not measured', rank: -1 };
    if (value <= good) return { color: GOOD, label: 'Good', rank: 0 };
    if (value <= meh) return { color: MEH, label: 'Needs work', rank: 1 };
    return { color: POOR, label: 'Poor', rank: 2 };
}

function formatValue(value, unit) {
    if (value == null) return '—';
    if (unit === 'ms') return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
    return Number(value).toFixed(3);
}

/**
 * Umami 3.x returns every vital in one response:
 *   { chart, summary: { lcp: {p50,p75,p95}, …, count }, pages, devices, browsers }
 * `count === 0` means nothing was sampled — a full summary of zeros comes back
 * regardless, and trusting it is the bug this file exists to not repeat.
 */
function readVital(payload, id, percentile = 'p75') {
    if (!payload || Number(payload.summary?.count) === 0) return null;
    const v = payload.summary?.[id];
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object') return v[percentile] ?? v.p75 ?? v.p50 ?? null;
    return null;
}

export default function PerformanceSection({ scope, onDrill }) {
    const [percentile, setPercentile] = useState('p75');
    // One request covers all five vitals plus the per-page and per-device
    // splits — the report returns them together, so fetching per card would be
    // five identical round-trips.
    const vitals = useAnalyticsQuery('report', 'performance', scope);
    const win = useMemo(() => resolveWindow(scope), [scope]);

    const payload = vitals.payload;
    const sampleCount = Number(payload?.summary?.count) || 0;
    const measured = sampleCount > 0;

    const graded = useMemo(() => METRICS.map(m => {
        const value = readVital(payload, m.id, percentile);
        return { ...m, value, band: band(value, m.bands) };
    }), [payload, percentile]);

    // "Fix first": worst band, then furthest past its threshold. A flat list of
    // five equal cards makes you do this ranking in your head every time.
    const worst = useMemo(() => graded
        .filter(g => g.band.rank > 0)
        .sort((a, b) => (b.band.rank - a.band.rank)
            || ((b.value / b.bands[0]) - (a.value / a.bands[0]))), [graded]);

    const trend = useMemo(() => {
        const rows = Array.isArray(payload?.chart) ? payload.chart : [];
        if (!rows.length) return null;
        // Percentiles get null gaps, never zero-fill.
        const pts = densify(rows.map(r => ({ x: r.x ?? r.t ?? r.date, y: r.y ?? r.value })), win, { fill: null });
        if (pts.every(p => p.value == null)) return null;
        return { labels: pts.map(p => bucketLabel(p.t, win.unit)), data: pts.map(p => p.value) };
    }, [payload, win]);

    if (vitals.loading) {
        return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}><Skeleton height={180} /><Skeleton height={220} /></div>;
    }
    if (vitals.error) return <ErrorNote message={vitals.error} onRetry={vitals.reload} />;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!measured && <NotMeasured />}

            {measured && (
                <Verdict graded={graded} worst={worst} sampleCount={sampleCount}
                    percentile={percentile} onPercentile={setPercentile} />
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {graded.map(g => <VitalMeter key={g.id} metric={g} />)}
            </div>

            {measured && trend && (
                <Card title="Largest Contentful Paint over time" icon={Gauge}>
                    <TrendChart
                        labels={trend.labels}
                        series={[{ key: 'lcp', label: `LCP ${percentile}`, data: trend.data, color: ACCENT }]}
                        refLines={[
                            { y: 2500, label: 'good', color: GOOD },
                            { y: 4000, label: 'poor', color: POOR },
                        ]}
                        formatY={(v) => formatValue(v, 'ms')}
                        height={180}
                        emptyText="Not enough samples to draw a trend yet."
                    />
                    <p style={{ fontSize: 11, color: 'var(--text-muted, #777)', margin: '10px 0 0' }}>
                        Gaps are periods with no samples — not periods where the site was instant.
                    </p>
                </Card>
            )}

            {measured && <PerPage payload={payload} onDrill={onDrill} />}

            <div style={{ fontSize: 11, color: 'var(--text-muted, #777)', display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                <Gauge style={{ width: 13, height: 13, marginTop: 1, flexShrink: 0, color: ACCENT }} />
                <span>
                    Web vitals ride along with the standard tracker — no extra script, and nothing about the
                    visitor beyond browser timings. They are reported when someone leaves the page or after
                    ten seconds on it, so they lag the pageview slightly. Values are {percentile === 'p75'
                        ? '75th-percentile, matching how Google grades Core Web Vitals' : `${percentile} across real visits`}.
                </span>
            </div>
        </div>
    );
}

/** One sentence at the top saying what to do, before five numbers saying what is. */
function Verdict({ graded, worst, sampleCount, percentile, onPercentile }) {
    const allGood = worst.length === 0;
    return (
        <Card title="Verdict" icon={Wrench} action={
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted, #777)' }}>{fmt(sampleCount)} samples</span>
                {['p50', 'p75', 'p95'].map(p => (
                    <button key={p} onClick={() => onPercentile(p)} style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                        border: `1px solid ${percentile === p ? `${ACCENT}66` : 'var(--border-subtle, rgba(255,255,255,0.1))'}`,
                        background: percentile === p ? `${ACCENT}14` : 'transparent',
                        color: percentile === p ? ACCENT : 'var(--text-muted, #888)',
                    }}>{p}</button>
                ))}
            </div>
        }>
            {allGood ? (
                <p style={{ fontSize: 13, color: 'var(--text-secondary, #ccc)', margin: 0 }}>
                    All five Core Web Vitals are in Google&apos;s <strong style={{ color: GOOD }}>good</strong> band
                    for this period. Nothing to fix.
                </p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary, #ccc)', margin: 0 }}>
                        Fix in this order — worst band first, then furthest past its threshold.
                    </p>
                    {worst.map((g, i) => (
                        <div key={g.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                            <span style={{
                                width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'inline-flex',
                                alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800,
                                background: `${g.band.color}22`, color: g.band.color,
                            }}>{i + 1}</span>
                            <span style={{ fontSize: 12 }}>
                                <strong style={{ color: 'var(--text-primary, #fff)' }}>{g.name}</strong>{' '}
                                <span style={{ color: g.band.color, fontWeight: 700 }}>
                                    {formatValue(g.value, g.unit)}
                                </span>
                                <span style={{ color: 'var(--text-muted, #888)' }}>
                                    {' '}— target {formatValue(g.bands[0], g.unit)}. Usually {g.fix}.
                                </span>
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}

function VitalMeter({ metric }) {
    const { value, band: b, unit, bands } = metric;
    const measured = value != null;
    // Where the value sits across the three bands, capped so a catastrophic
    // outlier still renders a full bar rather than overflowing.
    const pos = measured ? Math.min(1, value / (bands[1] * 1.5)) * 100 : 0;

    return (
        <div style={{
            background: 'var(--bg-secondary, #1a1a2e)',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            borderRadius: 12, padding: '14px 16px',
        }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary, #fff)' }}>{metric.label}</span>
                <span style={{
                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '2px 7px', borderRadius: 5,
                    background: measured ? `${b.color}18` : 'transparent',
                    color: measured ? b.color : 'var(--text-muted, #777)',
                    border: measured ? 'none' : '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
                }}>{b.label}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginBottom: 8 }}>{metric.name}</div>

            <div style={{
                fontSize: measured ? 24 : 13, fontWeight: measured ? 800 : 600, lineHeight: 1.3,
                color: measured ? b.color : 'var(--text-muted, #888)',
            }}>
                {measured ? formatValue(value, unit) : 'No samples yet'}
            </div>

            {/* Threshold track: good | needs work | poor, with a marker where we sit. */}
            <div style={{ position: 'relative', marginTop: 10 }}>
                <div style={{ display: 'flex', height: 5, borderRadius: 99, overflow: 'hidden', gap: 1 }}>
                    <div style={{ flex: bands[0], background: measured ? `${GOOD}55` : `${GOOD}22` }} />
                    <div style={{ flex: bands[1] - bands[0], background: measured ? `${MEH}55` : `${MEH}22` }} />
                    <div style={{ flex: bands[1] * 0.5, background: measured ? `${POOR}55` : `${POOR}22` }} />
                </div>
                {measured && (
                    <div style={{
                        position: 'absolute', top: -3, left: `${pos}%`, transform: 'translateX(-50%)',
                        width: 3, height: 11, borderRadius: 2, background: b.color,
                    }} />
                )}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted, #777)', marginTop: 6 }}>
                good ≤ {formatValue(bands[0], unit)} · poor &gt; {formatValue(bands[1], unit)}
            </div>
        </div>
    );
}

/** Which pages are slow — the report already splits by page and device. */
function PerPage({ payload, onDrill }) {
    const pages = Array.isArray(payload?.pages) ? payload.pages : [];
    if (!pages.length) return null;
    const peak = pages.reduce((a, p) => Math.max(a, Number(p.p75) || 0), 1);

    return (
        <Card title="Slowest pages" icon={Gauge} action={
            <span style={{ fontSize: 10, color: 'var(--text-muted, #777)' }}>LCP p75 · click to filter</span>
        }>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...pages]
                    .sort((a, b) => (Number(b.p75) || 0) - (Number(a.p75) || 0))
                    .slice(0, 10)
                    .map((p, i) => {
                        const v = Number(p.p75) || 0;
                        const b = band(v, [2500, 4000]);
                        return (
                            <button key={p.name || i} onClick={() => p.name && onDrill?.('path', p.name)}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left', padding: 0,
                                    background: 'transparent', border: 'none', cursor: p.name ? 'pointer' : 'default',
                                }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 3 }}>
                                    <span style={{
                                        fontSize: 12, color: 'var(--text-primary, #fff)', overflow: 'hidden',
                                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>{p.name || 'Unknown'}</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: b.color, flexShrink: 0 }}>
                                        {formatValue(v, 'ms')}
                                        <span style={{ color: 'var(--text-muted, #777)', fontWeight: 500 }}>
                                            {' '}· {fmt(p.count || 0)}
                                        </span>
                                    </span>
                                </div>
                                <ShareBar value={v} of={peak} color={b.color} />
                            </button>
                        );
                    })}
            </div>
        </Card>
    );
}

/**
 * The capability-missing state: amber, not red. Nothing is broken — the
 * measurement simply has not happened. Distinguishing this from "zero" is the
 * entire point of this rewrite.
 */
function NotMeasured() {
    return (
        <div style={{
            display: 'flex', gap: 9, alignItems: 'flex-start', padding: '12px 15px',
            borderRadius: 10, background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)', fontSize: 12, color: '#fcd34d',
        }}>
            <Gauge style={{ width: 14, height: 14, marginTop: 1, flexShrink: 0 }} />
            <span>
                <strong>No web-vitals samples in this period.</strong> The tracker reports them when a visitor
                leaves the page or after ten seconds on it, so they arrive a little after the pageviews do —
                a quiet period can legitimately have none. If this stays empty on a site with steady traffic,
                the published site is probably still serving an older tracker: republish it.
            </span>
        </div>
    );
}

export { readVital, band, formatValue, METRICS };
