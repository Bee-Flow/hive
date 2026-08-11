/**
 * Pages — does each page actually work?
 *
 * The old version was four ranked lists of the same dimension (path, title,
 * query, hostname), two of which are permanently empty on a marketing site, and
 * the only number any of them carried was a raw view count. A view count cannot
 * tell you whether a page works.
 *
 * `/report/breakdown` returns views, visitors, visits, bounces and totaltime
 * per row in ONE call, so a page can be judged on engagement instead of
 * popularity. That report was already allow-listed and entirely unused.
 */
import React, { useMemo, useState } from 'react';
import { FileText, Compass } from 'lucide-react';
import { useAnalyticsQuery } from '../useAnalyticsQuery';
import {
    ACCENT, SERIES, Card, Empty, ErrorNote, Skeleton, SortableTable, ShareBar,
    BreakdownTable, fmt, fmtDurationSec, rateColor, maxOf,
} from '../ui';
import { pivot } from '../model';

export default function PagesSection({ scope, onDrill }) {
    const [sortKey, setSortKey] = useState('views');

    const breakdown = useAnalyticsQuery('report', 'breakdown', scope, { body: { fields: ['path'] } });
    const titles = useAnalyticsQuery('query', 'metrics', scope, { params: { type: 'title', limit: 15 } });

    const rows = useMemo(() => {
        const p = pivot(breakdown.payload, ['path']);
        return p
            .filter(r => r.path)
            .sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
    }, [breakdown.payload, sortKey]);

    const totals = useMemo(() => rows.reduce((a, r) => ({
        views: a.views + r.views,
        visitors: a.visitors + r.visitors,
        visits: a.visits + r.visits,
    }), { views: 0, visitors: 0, visits: 0 }), [rows]);

    const peakViews = useMemo(() => maxOf(rows.map(r => r.views)), [rows]);

    if (breakdown.loading) {
        return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}><Skeleton height={320} /><Skeleton height={200} /></div>;
    }
    if (breakdown.error) return <ErrorNote message={breakdown.error} onRetry={breakdown.reload} />;

    const columns = [
        {
            key: 'path', label: 'Page', width: '2fr',
            render: (r) => (
                <span title={`Filter the dashboard by ${r.path}`} style={{
                    fontSize: 12, color: 'var(--text-primary, #fff)',
                    textDecoration: 'underline dotted', textUnderlineOffset: 3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                }}>{r.path}</span>
            ),
        },
        {
            key: 'views', label: 'Views', width: '110px', align: 'right',
            render: (r) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
                    <ShareBar value={r.views} of={peakViews} width={40} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, minWidth: 32, textAlign: 'right' }}>{fmt(r.views)}</span>
                </span>
            ),
        },
        {
            key: 'visitors', label: 'Visitors', width: '80px', align: 'right',
            render: (r) => <span style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)' }}>{fmt(r.visitors)}</span>,
        },
        {
            key: 'bounceRate', label: 'Bounce', width: '80px', align: 'right',
            render: (r) => (r.bounceRate == null
                ? <span style={{ fontSize: 12, color: 'var(--text-muted, #777)' }}>—</span>
                // Colour is a hint; the number is always printed beside it.
                : <span style={{ fontSize: 12, fontWeight: 700, color: rateColor(r.bounceRate) }}>
                    {Math.round(r.bounceRate)}%
                </span>),
        },
        {
            key: 'avgTime', label: 'Time on page', width: '110px', align: 'right',
            render: (r) => (
                <span style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)' }}>
                    {r.avgTime == null ? '—' : fmtDurationSec(r.avgTime)}
                </span>
            ),
        },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card title="Every page, by engagement" icon={FileText} action={
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted, #777)' }}>rank by</span>
                    {[
                        { k: 'views', l: 'Views' },
                        { k: 'visitors', l: 'Visitors' },
                        { k: 'bounceRate', l: 'Bounce' },
                        { k: 'avgTime', l: 'Time' },
                    ].map(o => (
                        <button key={o.k} onClick={() => setSortKey(o.k)} style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                            border: `1px solid ${sortKey === o.k ? `${ACCENT}66` : 'var(--border-subtle, rgba(255,255,255,0.1))'}`,
                            background: sortKey === o.k ? `${ACCENT}14` : 'transparent',
                            color: sortKey === o.k ? ACCENT : 'var(--text-muted, #888)',
                        }}>{o.l}</button>
                    ))}
                </div>
            }>
                {rows.length === 0 ? (
                    <Empty text="No pageviews in this period." />
                ) : (
                    <>
                        <SortableTable
                            columns={columns} data={rows.map((r, i) => ({ ...r, _key: `${i}-${r.path}` }))}
                            maxRows={25} emptyText="No pageviews in this period."
                            onRowClick={(r) => onDrill('path', r.path)}
                        />
                        <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 11, color: 'var(--text-muted, #888)' }}>
                            <span><strong style={{ color: 'var(--text-primary, #fff)' }}>{fmt(rows.length)}</strong> pages visited</span>
                            <span><strong style={{ color: 'var(--text-primary, #fff)' }}>{fmt(totals.views)}</strong> views</span>
                            <span>
                                <strong style={{ color: 'var(--text-primary, #fff)' }}>
                                    {totals.visits ? (totals.views / totals.visits).toFixed(1) : '—'}
                                </strong> pages per visit
                            </span>
                        </div>
                    </>
                )}
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                <Card title="By page title" icon={Compass} action={
                    <span style={{ fontSize: 10, color: 'var(--text-muted, #777)' }}>
                        useful when several paths share a template
                    </span>
                }>
                    {titles.loading ? <Skeleton height={180} />
                        : titles.error ? <ErrorNote message={titles.error} onRetry={titles.reload} compact />
                        : <BreakdownTable rows={titles.payload} labelHeader="Title" maxRows={10}
                            blankLabel="Untitled" emptyText="No titles recorded."
                            onDrill={(v) => onDrill('title', v)} />}
                </Card>

                <EntryPages scope={scope} onDrill={onDrill} />
            </div>
        </div>
    );
}

/**
 * Where visits START.
 *
 * Umami has no entry-page dimension, but a visit's landing page is what
 * `visits` counts per path: a page with visits ≈ views is where people arrive,
 * a page with far more views than visits is one they navigate to. Presented as
 * exactly that ratio rather than pretending to be a true entry report.
 */
function EntryPages({ scope, onDrill }) {
    const breakdown = useAnalyticsQuery('report', 'breakdown', scope, { body: { fields: ['path'] } });
    const rows = useMemo(() => pivot(breakdown.payload, ['path'])
        .filter(r => r.path && r.visits > 0)
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 10), [breakdown.payload]);
    const peak = maxOf(rows.map(r => r.visits));

    return (
        <Card title="Where visits start" icon={Compass} action={
            <span style={{ fontSize: 10, color: 'var(--text-muted, #777)' }}>visits, not views</span>
        }>
            {breakdown.loading ? <Skeleton height={180} />
                : breakdown.error ? <ErrorNote message={breakdown.error} onRetry={breakdown.reload} compact />
                : rows.length === 0 ? <Empty text="No visits in this period." />
                : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {rows.map((r, i) => (
                            <button key={`${i}-${r.path}`} onClick={() => onDrill('path', r.path)}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left', padding: 0,
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 3 }}>
                                    <span style={{
                                        fontSize: 12, color: 'var(--text-primary, #fff)', overflow: 'hidden',
                                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>{r.path}</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: SERIES.secondary, flexShrink: 0 }}>
                                        {fmt(r.visits)}
                                    </span>
                                </div>
                                <ShareBar value={r.visits} of={peak} color={SERIES.secondary} />
                            </button>
                        ))}
                    </div>
                )}
        </Card>
    );
}
