/**
 * Realtime — what is happening on the site right now.
 *
 * Polls /query/realtime every 5s via useAnalyticsQuery, which pauses while the
 * tab is hidden so a backgrounded dashboard doesn't hammer Umami.
 *
 * Two things changed here. The headline counters used to be derived from an
 * `__type` discriminator on the event rows, which is not present on every
 * Umami build — when it is missing the tiles silently read zero while the feed
 * below them scrolls. They now come from `totals`, which the endpoint has been
 * returning all along. And `series` — per-minute views and visitors — was
 * likewise unused; it is the difference between a log tail and something you
 * can watch a launch land on.
 *
 * The endpoint takes neither a date range nor filters (`window: false` on the
 * server), so this section declares itself rangeless and filterless and the
 * shell hides both controls. Showing a "Last 7 days" picker over a live feed
 * that ignores it is just a lie with a dropdown.
 */
import React, { useMemo } from 'react';
import { Activity, Eye, Globe, FileText, Share2, Zap, Radio } from 'lucide-react';
import { useAnalyticsQuery } from '../useAnalyticsQuery';
import {
    ACCENT, SERIES, Card, Empty, ErrorNote, Skeleton, SkeletonGrid,
    StatGrid, StatTile, BarList, mapToRows, fmtAgo, fmt,
} from '../ui';
import MinuteBars from '../charts/MinuteBars';
import { parseBucket, floorTo } from '../window';

const POLL_MS = 5000;
const WINDOW_MIN = 30;

/** Umami's per-minute series → a dense 30-minute strip ending now. */
function toMinuteStrip(series) {
    const views = new Map();
    const visitors = new Map();
    for (const p of Array.isArray(series?.views) ? series.views : []) {
        const t = parseBucket(p.x);
        if (Number.isFinite(t)) views.set(floorTo(t, 'minute'), Number(p.y) || 0);
    }
    for (const p of Array.isArray(series?.visitors) ? series.visitors : []) {
        const t = parseBucket(p.x);
        if (Number.isFinite(t)) visitors.set(floorTo(t, 'minute'), Number(p.y) || 0);
    }
    // Umami's stamps are wall-clock-as-UTC; anchor the strip on the newest
    // bucket it reported so the two agree even if our clock drifts.
    const newest = Math.max(...views.keys(), ...visitors.keys(), floorTo(Date.now(), 'minute'));
    const out = [];
    for (let i = WINDOW_MIN - 1; i >= 0; i--) {
        const t = newest - i * 60_000;
        out.push({ t, value: views.get(t) || 0, overlay: visitors.get(t) || 0 });
    }
    return out;
}

export default function RealtimeSection({ scope, onDrill }) {
    const { payload, loading, error, reload } = useAnalyticsQuery('query', 'realtime', scope, { pollMs: POLL_MS });
    const active = useAnalyticsQuery('query', 'active', scope, { pollMs: POLL_MS });

    const strip = useMemo(() => toMinuteStrip(payload?.series), [payload]);

    if (loading && !payload) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <SkeletonGrid count={4} height={78} />
                <Skeleton height={140} />
                <Skeleton height={240} />
            </div>
        );
    }
    if (error) return <ErrorNote message={error} onRetry={reload} />;

    const totals = payload?.totals || {};
    const events = Array.isArray(payload?.events) ? payload.events : [];
    const urls = mapToRows(payload?.urls);
    const referrers = mapToRows(payload?.referrers);
    const countries = mapToRows(payload?.countries);

    // A row with an eventName is a custom event; without one it is a pageview.
    // That holds on every build, unlike the `__type` marker.
    const custom = events.filter(e => e.eventName);
    const onlineNow = active.payload?.visitors ?? active.payload?.x ?? null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <StatGrid>
                <StatTile icon={Activity} label="Online now" color={ACCENT}
                    value={onlineNow != null ? fmt(onlineNow) : '—'}
                    subtitle="active in the last 5 minutes" />
                <StatTile icon={Eye} label="Pageviews" value={fmt(totals.views || 0)} color={SERIES.secondary}
                    subtitle={`last ${WINDOW_MIN} minutes`} />
                <StatTile icon={Users2} label="Visitors" value={fmt(totals.visitors || 0)} color={SERIES.primary}
                    subtitle={`last ${WINDOW_MIN} minutes`} />
                <StatTile icon={Zap} label="Events" value={fmt(totals.events || 0)} color={SERIES.warn}
                    subtitle="clicks, form submits" />
            </StatGrid>

            <Card title="The last half hour" icon={Radio} action={<LiveDot />}>
                <MinuteBars
                    buckets={strip}
                    color={ACCENT}
                    overlayColor={SERIES.secondary}
                    caption="bars = pageviews · overlay = visitors"
                    height={84}
                />
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                <Card title="Pages being read" icon={FileText}>
                    <BarList rows={urls} onDrill={(v) => onDrill('path', v)}
                        emptyText="Nobody on the site right now." />
                </Card>
                <Card title="Arriving from" icon={Share2}>
                    <BarList rows={referrers} onDrill={(v) => onDrill('referrer', v)}
                        emptyText="Everyone came direct." />
                </Card>
                <Card title="Countries" icon={Globe}>
                    <BarList rows={countries} onDrill={(v) => onDrill('country', v)}
                        emptyText="No location data — this needs a GeoLite2 database on the Umami container." />
                </Card>
            </div>

            <Card title="Happening now" icon={Activity} action={<LiveDot />}>
                {events.length === 0 ? (
                    <Empty text="No activity yet. Open your published site in another tab to see it appear here." />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 380, overflowY: 'auto' }}>
                        {events.slice(0, 60).map((e, i) => (
                            <ActivityRow key={`${e.sessionId}-${e.createdAt}-${i}`} event={e} onDrill={onDrill} />
                        ))}
                    </div>
                )}
                {custom.length > 0 && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted, #777)', margin: '10px 0 0' }}>
                        {fmt(custom.length)} of these are interactions, not just page loads.
                    </p>
                )}
            </Card>
        </div>
    );
}

function ActivityRow({ event: e, onDrill }) {
    const isEvent = !!e.eventName;
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '6px 9px', borderRadius: 8,
            background: 'var(--bg-tertiary, rgba(255,255,255,0.03))',
            borderLeft: `2px solid ${isEvent ? SERIES.warn : 'transparent'}`,
        }}>
            {isEvent && (
                <span style={{
                    fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 5,
                    background: `${SERIES.warn}1f`, color: SERIES.warn, flexShrink: 0,
                }}>{e.eventName}</span>
            )}
            <button
                onClick={() => e.urlPath && onDrill?.('path', e.urlPath)}
                title={e.urlPath ? `Filter by ${e.urlPath}` : undefined}
                style={{
                    flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 'none',
                    padding: 0, cursor: e.urlPath ? 'pointer' : 'default',
                    fontSize: 12, color: 'var(--text-primary, #fff)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
            >{e.urlPath || '/'}</button>
            <span style={{ fontSize: 11, color: 'var(--text-muted, #888)', flexShrink: 0 }}>
                {[e.browser, e.os, e.country].filter(Boolean).join(' · ')}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted, #777)', flexShrink: 0, minWidth: 62, textAlign: 'right' }}>
                {fmtAgo(e.createdAt)}
            </span>
        </div>
    );
}

function LiveDot() {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted, #888)' }}>
            <span style={{
                width: 7, height: 7, borderRadius: 99, background: ACCENT, display: 'inline-block',
                animation: 'bf-analytics-pulse 1.6s ease-in-out infinite',
            }} />
            live · every {POLL_MS / 1000}s
        </span>
    );
}

// lucide's Users icon under a local name, so the import list stays honest about
// what each tile shows.
function Users2(props) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    );
}
