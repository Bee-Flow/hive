/**
 * Events — what visitors actually clicked.
 *
 * The old tab was one bar list of event NAMES ("cta_click 6") plus a permanent
 * "click an event above to see its properties" placeholder occupying half the
 * screen. Knowing that `cta_click` happened six times is close to useless; the
 * question is always WHICH button, in WHICH block, on WHICH page.
 *
 * That is answerable and always has been: the public renderer stamps
 * `label`, `href`, `block` and `blockType` onto every auto-tracked event, and
 * `/query/event-data` returns them. Nothing in the product read them.
 */
import React, { useMemo } from 'react';
import { Zap, MousePointerClick, Layers, ExternalLink } from 'lucide-react';
import { useAnalyticsQuery } from '../useAnalyticsQuery';
import {
    ACCENT, SERIES, Card, Empty, ErrorNote, Skeleton, ShareBar, StatGrid, StatTile,
    fmt, maxOf,
} from '../ui';
import { foldEventData, ctaLeaderboard, blockLeaderboard } from '../model';
import { blockLabel } from '../heatmap/model';

const EVENT_LABELS = {
    cta_click: 'Button & link clicks',
    form_submit: 'Form submissions',
    outbound_click: 'Clicks to other sites',
    file_download: 'File downloads',
};

export default function EventsSection({ scope, onDrill }) {
    const names = useAnalyticsQuery('query', 'metrics', scope, { params: { type: 'event', limit: 25 } });
    // pageSize is only forwardable because the proxy now allow-lists it —
    // without it we would silently only ever see Umami's first page.
    const detail = useAnalyticsQuery('query', 'event-data', scope, { params: { pageSize: 500 } });

    const nameRows = useMemo(() => (Array.isArray(names.payload) ? names.payload : [])
        .filter(r => r.x), [names.payload]);
    const total = nameRows.reduce((a, r) => a + (r.y || 0), 0);

    const events = useMemo(() => foldEventData(detail.payload), [detail.payload]);
    const ctas = useMemo(() => ctaLeaderboard(events), [events]);
    const blocks = useMemo(() => blockLeaderboard(events), [events]);

    if (names.loading) {
        return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}><Skeleton height={120} /><Skeleton height={280} /></div>;
    }
    if (names.error) return <ErrorNote message={names.error} onRetry={names.reload} />;

    if (!nameRows.length) {
        return (
            <Card title="Events" icon={Zap}>
                <Empty text="No interactions recorded yet. The published site tracks button clicks, form submissions, outbound links and file downloads automatically — they appear here as soon as a visitor uses the site." />
            </Card>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <StatGrid min={200}>
                {nameRows.slice(0, 4).map((r, i) => (
                    <StatTile
                        key={r.x} icon={i === 0 ? MousePointerClick : Zap}
                        label={EVENT_LABELS[r.x] || r.x}
                        value={fmt(r.y || 0)}
                        color={i === 0 ? ACCENT : SERIES.secondary}
                        subtitle={r.x}
                    />
                ))}
            </StatGrid>

            <Card title="What visitors clicked" icon={MousePointerClick} action={
                <span style={{ fontSize: 10, color: 'var(--text-muted, #777)' }}>
                    {fmt(total)} interactions
                </span>
            }>
                {detail.loading ? <Skeleton height={240} />
                    : detail.error ? <ErrorNote message={detail.error} onRetry={detail.reload} compact />
                    : ctas.length === 0 ? (
                        <Empty text="These events carry no labels yet — republish the site so the tracker attaches them." />
                    ) : <CtaTable rows={ctas} />}
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                <Card title="Which blocks earn the clicks" icon={Layers} action={
                    <span style={{ fontSize: 10, color: 'var(--text-muted, #777)' }}>across every page</span>
                }>
                    {detail.loading ? <Skeleton height={200} />
                        : blocks.length === 0 ? <Empty text="No block attribution available for these events." />
                        : <BlockTable rows={blocks} />}
                </Card>

                <Card title="Event types" icon={Zap}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        {nameRows.map((r, i) => (
                            <button key={r.x} onClick={() => onDrill('event', r.x)}
                                title={`Filter the dashboard by ${r.x}`}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left', padding: 0,
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 3 }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-primary, #fff)' }}>
                                        {EVENT_LABELS[r.x] || r.x}
                                    </span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{fmt(r.y || 0)}</span>
                                </div>
                                <ShareBar value={r.y || 0} of={total} />
                            </button>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}

/** One row per distinct label, with where it was placed. */
function CtaTable({ rows }) {
    const peak = maxOf(rows.map(r => r.count));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {rows.slice(0, 20).map(r => (
                <div key={r.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 4, alignItems: 'baseline' }}>
                        <span style={{ display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0 }}>
                            <span style={{
                                fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #fff)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>{r.label}</span>
                            {r.href && (
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
                                    fontSize: 10, color: 'var(--text-muted, #777)',
                                }}>
                                    <ExternalLink style={{ width: 9, height: 9 }} />
                                    {shortHref(r.href)}
                                </span>
                            )}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT, flexShrink: 0 }}>{fmt(r.count)}</span>
                    </div>
                    <ShareBar value={r.count} of={peak} />
                    {r.placements.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                            {r.placements.map(p => (
                                <span key={p.type} style={{
                                    fontSize: 10, padding: '1px 7px', borderRadius: 5,
                                    background: 'var(--bg-tertiary, rgba(255,255,255,0.05))',
                                    color: 'var(--text-muted, #999)',
                                }}>
                                    {blockLabel(p.type)} · {fmt(p.count)}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function BlockTable({ rows }) {
    const peak = maxOf(rows.map(r => r.count));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {rows.map(r => (
                <div key={r.type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 3 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-primary, #fff)' }}>{blockLabel(r.type)}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{fmt(r.count)}</span>
                    </div>
                    <ShareBar value={r.count} of={peak} />
                    {r.labels.length > 0 && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted, #777)', marginTop: 3 }}>
                            {r.labels.slice(0, 4).join(' · ')}{r.labels.length > 4 ? ` +${r.labels.length - 4} more` : ''}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

/** Trim an href to something readable in a chip. */
function shortHref(href) {
    const s = String(href);
    try {
        const u = new URL(s.includes('://') ? s : `https://${s}`);
        return `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`.slice(0, 42);
    } catch {
        return s.slice(0, 42);
    }
}
