/**
 * Overview — the front door.
 *
 * It answers one question: is the site doing better or worse than last period,
 * and what changed? The previous version was a shelf of disconnected numbers —
 * five tiles with no comparison, two near-identical single-series charts, and a
 * six-card grid half of which read "No X data" on any normal site.
 *
 * Three things changed the character of it:
 *   - `stats.comparison` (the previous period's absolute totals) was already
 *     being fetched and thrown away. Every headline number now carries it.
 *   - The series are densified against the requested window. Umami returns only
 *     non-empty buckets, which is why this chart used to be a flat line with
 *     "07-27 00:00" at both ends.
 *   - The six ranked lists collapse into one "what moved" table plus a
 *     composition strip, because six lists of five rows is not a summary.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Eye, MousePointerClick, Timer, Activity, TrendingUp, Layers } from 'lucide-react';
import { analyticsApi, analyticsFetch } from '../../analyticsApi';
import {
    ACCENT, SERIES, Card, Empty, ErrorNote, Skeleton, SkeletonGrid, StatGrid, StatTile,
    BreakdownTable, SplitBar, fmt, statVal, fmtDurationSec, compare,
} from '../ui';
import TrendChart from '../charts/TrendChart';
import { resolveWindow, densify, bucketLabel, lastBucketPartial } from '../window';

export default function OverviewSection({ scope, onDrill }) {
    const [state, setState] = useState({ data: null, loading: true, error: null });

    const load = useCallback(async () => {
        setState(s => ({ ...s, loading: true, error: null }));
        try {
            const data = await analyticsFetch(analyticsApi.overview(scope));
            setState({ data, loading: false, error: null });
        } catch (e) {
            setState({ data: null, loading: false, error: e.message });
        }
        // scope is a fresh object per render of the shell; key on its content.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(scope)]);

    useEffect(() => { load(); }, [load]);

    const { data: overview, loading, error } = state;
    const win = useMemo(() => resolveWindow(scope), [scope]);

    const chart = useMemo(() => {
        if (!overview?.pageviews) return null;
        const views = densify(overview.pageviews.pageviews, win);
        const sessions = densify(overview.pageviews.sessions, win);
        return {
            labels: views.map(p => bucketLabel(p.t, win.unit)),
            series: [
                { key: 'views', label: 'Pageviews', data: views.map(p => p.value), color: ACCENT },
                { key: 'sessions', label: 'Sessions', data: sessions.map(p => p.value), color: SERIES.secondary, style: 'line' },
            ],
            partialLast: lastBucketPartial(win),
        };
    }, [overview, win]);

    if (loading && !overview) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <SkeletonGrid count={5} height={78} />
                <Skeleton height={240} />
                <SkeletonGrid count={2} height={200} min={320} />
            </div>
        );
    }
    if (error) return <ErrorNote message={error} onRetry={load} />;
    if (!overview?.stats) return <Empty text="No analytics data for this period yet." />;

    const s = overview.stats || {};
    const cmp = s.comparison || {};
    const visits = statVal(s.visits) || statVal(s.sessions);
    const pageviews = statVal(s.pageviews);
    const visitors = statVal(s.visitors);
    const bounceRate = visits > 0 ? (statVal(s.bounces) / visits) * 100 : 0;
    const avgVisit = visits > 0 ? statVal(s.totaltime) / visits : 0;

    const prevVisits = statVal(cmp.visits);
    const prevBounce = prevVisits > 0 ? (statVal(cmp.bounces) / prevVisits) * 100 : null;
    const prevAvg = prevVisits > 0 ? statVal(cmp.totaltime) / prevVisits : null;

    const partial = overview.partialErrors || [];
    const failed = (key) => partial.find(e => e.key === key)?.message || null;

    const tile = (current, previous, kind) => {
        const c = compare(current, previous, kind);
        return { delta: c.delta, deltaDisplay: c.display, state: c.state };
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {partial.length > 0 && (
                <ErrorNote
                    onRetry={load}
                    message={`Some data could not be loaded: ${partial.map(e => e.key).join(', ')}. ${partial[0].message}`}
                />
            )}

            <StatGrid>
                <StatTile icon={Users} label="Visitors" value={fmt(visitors)} color={SERIES.secondary}
                    {...tile(visitors, statVal(cmp.visitors), 'count')} />
                <StatTile icon={Eye} label="Pageviews" value={fmt(pageviews)} color={ACCENT}
                    {...tile(pageviews, statVal(cmp.pageviews), 'count')} />
                <StatTile icon={MousePointerClick} label="Bounce rate" value={`${Math.round(bounceRate)}%`} color={SERIES.warn}
                    goodWhenDown {...tile(bounceRate, prevBounce, 'rate')} />
                <StatTile icon={Timer} label="Avg. visit" value={fmtDurationSec(avgVisit)} color={SERIES.primary}
                    {...tile(avgVisit, prevAvg, 'duration')} />
                <StatTile icon={Activity} label="Active now" value={overview.active != null ? fmt(overview.active) : '—'}
                    color={SERIES.secondary} subtitle="last 5 minutes" />
            </StatGrid>

            <Card title="Traffic over time" icon={TrendingUp}>
                {failed('pageviews')
                    ? <ErrorNote message={failed('pageviews')} onRetry={load} compact />
                    : chart
                        ? <TrendChart
                            labels={chart.labels} series={chart.series}
                            partialLast={chart.partialLast} height={220}
                            emptyText="No traffic in this period." />
                        : <Empty text="No traffic in this period." />}
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                <Card title="Top pages" action={
                    <DrillHint show={!!overview.pages?.length} />
                }>
                    {failed('pages')
                        ? <ErrorNote message={failed('pages')} onRetry={load} compact />
                        : <BreakdownTable rows={overview.pages} labelHeader="Page" maxRows={8}
                            emptyText="No pageviews in this period."
                            onDrill={(v) => onDrill('path', v)} />}
                </Card>

                <Card title="Where they came from" action={<DrillHint show={!!overview.referrers?.length} />}>
                    {failed('referrers')
                        ? <ErrorNote message={failed('referrers')} onRetry={load} compact />
                        : <BreakdownTable rows={overview.referrers} labelHeader="Source" maxRows={8}
                            blankLabel="Direct / no referrer"
                            emptyText="Everyone arrived directly — no referring sites in this period."
                            onDrill={(v) => onDrill('referrer', v)} />}
                </Card>
            </div>

            <Composition overview={overview} onDrill={onDrill} />
        </div>
    );
}

/**
 * Devices, browsers, OS and countries as four composition bars in ONE card.
 *
 * They were four cards (two of them donuts) showing the same handful of
 * numbers. A donut spends 160px of height to say "67% laptop", carries identity
 * in a colour-only legend, and cannot be scanned against its neighbours.
 */
function Composition({ overview, onDrill }) {
    const strips = [
        { key: 'devices', label: 'Devices', dim: 'device', rows: overview.devices },
        { key: 'browsers', label: 'Browsers', dim: 'browser', rows: overview.browsers },
        { key: 'os', label: 'Operating systems', dim: 'os', rows: overview.os },
        { key: 'countries', label: 'Countries', dim: 'country', rows: overview.countries },
    ].filter(s => Array.isArray(s.rows) && s.rows.length > 0);

    if (!strips.length) {
        return (
            <Card title="Who visited" icon={Layers}>
                <Empty text="No visitor breakdown for this period yet." />
            </Card>
        );
    }

    return (
        <Card title="Who visited" icon={Layers}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {strips.map(s => {
                    const top = s.rows.slice(0, 5);
                    const rest = s.rows.slice(5).reduce((a, r) => a + (r.y || 0), 0);
                    const segments = [
                        ...top.map(r => ({ label: r.x || 'Unknown', value: r.y || 0 })),
                        ...(rest > 0 ? [{ label: 'Other', value: rest, color: 'var(--border-default, rgba(255,255,255,0.2))' }] : []),
                    ];
                    return (
                        <div key={s.key}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #888)', marginBottom: 6 }}>
                                {s.label}
                            </div>
                            <SplitBar segments={segments} legend height={10} />
                            {onDrill && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                    {top.filter(r => r.x).map(r => (
                                        <button key={r.x} onClick={() => onDrill(s.dim, r.x)}
                                            title={`Filter the dashboard by ${r.x}`}
                                            style={{
                                                fontSize: 10, padding: '2px 7px', borderRadius: 6, cursor: 'pointer',
                                                background: 'transparent', color: 'var(--text-muted, #888)',
                                                border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                                            }}>
                                            filter: {r.x}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

function DrillHint({ show }) {
    if (!show) return null;
    return (
        <span style={{ fontSize: 10, color: 'var(--text-muted, #777)' }}>click a row to filter</span>
    );
}
