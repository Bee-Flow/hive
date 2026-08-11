/**
 * Audience — who visited, and what they were using.
 *
 * Was seven flat label/count tables, three of which (country/region/city) are
 * structurally empty on any Umami without a GeoLite2 database — presented as a
 * bare "No countries data", which reads as a bug rather than a missing optional
 * dependency.
 *
 * Now: geography is one drill-down table with an honest capability banner when
 * the database is absent; browser and OS are a single pivot, because "Chrome"
 * and "Windows" in two separate lists never answer "Chrome on what?"; and
 * screen widths — sitting unused in `sessions[].screen` all along — answer the
 * one question a CMS product genuinely needs: what widths must this design
 * survive?
 */
import React, { useMemo, useState } from 'react';
import { Globe, Monitor, Languages, MapPin } from 'lucide-react';
import { useAnalyticsQuery } from '../useAnalyticsQuery';
import {
    ACCENT, SERIES, Card, Empty, ErrorNote, Skeleton, ShareBar, BreakdownTable,
    fmt, maxOf,
} from '../ui';
import { pivot, screenBuckets } from '../model';

const GEO_LEVELS = [
    { dim: 'country', label: 'Countries', next: 'region' },
    { dim: 'region', label: 'Regions', next: 'city' },
    { dim: 'city', label: 'Cities', next: null },
];

export default function AudienceSection({ scope, onDrill }) {
    const [level, setLevel] = useState('country');

    const geo = useAnalyticsQuery('query', 'metrics', scope, { params: { type: level, limit: 25 } });
    const stack = useAnalyticsQuery('report', 'breakdown', scope, { body: { fields: ['browser', 'os'] } });
    const languages = useAnalyticsQuery('query', 'metrics', scope, { params: { type: 'language', limit: 12 } });
    const devices = useAnalyticsQuery('query', 'metrics', scope, { params: { type: 'device', limit: 10 } });
    const sessions = useAnalyticsQuery('query', 'sessions', scope, { params: { pageSize: 500 } });

    const sessionRows = useMemo(
        () => (Array.isArray(sessions.payload?.data) ? sessions.payload.data : []),
        [sessions.payload],
    );
    // Did anyone visit at all in this window? Answered by the sessions query, not
    // the geo one — that distinction is the whole point below.
    const hasTraffic = !sessions.loading && !sessions.error && sessionRows.length > 0;

    const geoRows = Array.isArray(geo.payload) ? geo.payload : [];
    // "Umami could not place these visitors" and "nobody visited" are different
    // answers and must not share a message.
    //
    // Umami reports the first case two different ways depending on version and
    // query: sometimes rows with a null label, sometimes — as on 3.2.0 — by
    // dropping the null-geo rows entirely and returning []. The original check
    // only caught the first, so the second fell through to "No visits in this
    // period." and reported an empty dashboard while a session sat in the table.
    // Cross-checking against the session count catches both.
    const geoUnavailable = !geo.loading && !geo.error
        && ((geoRows.length > 0 && geoRows.every(r => !r.x))
            || (geoRows.length === 0 && hasTraffic));
    const geoEmpty = !geo.loading && !geo.error && geoRows.length === 0 && !geoUnavailable;

    const stackRows = useMemo(() => {
        const rows = pivot(stack.payload, ['browser', 'os'])
            .filter(r => r.browser || r.os)
            .sort((a, b) => b.visitors - a.visitors || b.views - a.views);
        return rows;
    }, [stack.payload]);

    const screens = useMemo(() => screenBuckets(sessionRows), [sessionRows]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
                <Card title="Where they are" icon={Globe} action={
                    <div style={{ display: 'flex', gap: 4 }}>
                        {GEO_LEVELS.map(l => (
                            <button key={l.dim} onClick={() => setLevel(l.dim)} style={{
                                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                                border: `1px solid ${level === l.dim ? `${ACCENT}66` : 'var(--border-subtle, rgba(255,255,255,0.1))'}`,
                                background: level === l.dim ? `${ACCENT}14` : 'transparent',
                                color: level === l.dim ? ACCENT : 'var(--text-muted, #888)',
                            }}>{l.label}</button>
                        ))}
                    </div>
                }>
                    {geo.loading ? <Skeleton height={200} />
                        : geo.error ? <ErrorNote message={geo.error} onRetry={geo.reload} compact />
                        : geoUnavailable ? <GeoUnavailable />
                        : geoEmpty ? <Empty text="No visits in this period." />
                        : <BreakdownTable rows={geoRows} labelHeader={GEO_LEVELS.find(l => l.dim === level).label}
                            valueHeader="Views" maxRows={12} blankLabel="Unknown location"
                            onDrill={(v) => onDrill(level, v)} />}
                </Card>

                <Card title="Screen widths to design for" icon={Monitor} action={
                    screens.total ? <span style={{ fontSize: 10, color: 'var(--text-muted, #777)' }}>
                        {fmt(screens.total)} sessions
                    </span> : null
                }>
                    {sessions.loading ? <Skeleton height={200} />
                        : sessions.error ? <ErrorNote message={sessions.error} onRetry={sessions.reload} compact />
                        : screens.rows.length === 0 ? <Empty text="No session data in this period." />
                        : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                                {screens.rows.map(r => (
                                    <div key={r.label}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 3 }}>
                                            <span style={{ fontSize: 12, color: 'var(--text-primary, #fff)' }}>{r.label}</span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>
                                                {Math.round(r.share)}%
                                                <span style={{ color: 'var(--text-muted, #777)', fontWeight: 500 }}> · {fmt(r.count)}</span>
                                            </span>
                                        </div>
                                        <ShareBar value={r.share} of={100} />
                                    </div>
                                ))}
                            </div>
                        )}
                </Card>
            </div>

            <Card title="Browser and operating system" icon={Monitor} action={
                <span style={{ fontSize: 10, color: 'var(--text-muted, #777)' }}>the combination, not two lists</span>
            }>
                {stack.loading ? <Skeleton height={200} />
                    : stack.error ? <ErrorNote message={stack.error} onRetry={stack.reload} compact />
                    : stackRows.length === 0 ? <Empty text="No visits in this period." />
                    : <StackTable rows={stackRows} onDrill={onDrill} />}
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                <Card title="Devices" icon={Monitor}>
                    {devices.loading ? <Skeleton height={150} />
                        : devices.error ? <ErrorNote message={devices.error} onRetry={devices.reload} compact />
                        : <BreakdownTable rows={devices.payload} labelHeader="Device" maxRows={8}
                            emptyText="No device data." onDrill={(v) => onDrill('device', v)} />}
                </Card>
                <Card title="Languages" icon={Languages} action={
                    <span style={{ fontSize: 10, color: 'var(--text-muted, #777)' }}>browser preference</span>
                }>
                    {languages.loading ? <Skeleton height={150} />
                        : languages.error ? <ErrorNote message={languages.error} onRetry={languages.reload} compact />
                        : <BreakdownTable rows={languages.payload} labelHeader="Language" maxRows={8}
                            emptyText="No language data." onDrill={(v) => onDrill('language', v)} />}
                </Card>
            </div>
        </div>
    );
}

function StackTable({ rows, onDrill }) {
    const peak = maxOf(rows.map(r => r.visitors || r.views));
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.slice(0, 12).map((r, i) => (
                <div key={`${i}-${r.browser}-${r.os}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 3 }}>
                        <span style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'baseline' }}>
                            <button onClick={() => r.browser && onDrill('browser', r.browser)}
                                title={r.browser ? `Filter by ${r.browser}` : undefined}
                                style={chipButton(!!r.browser)}>{r.browser || 'Unknown browser'}</button>
                            <span style={{ color: 'var(--text-muted, #666)' }}>on</span>
                            <button onClick={() => r.os && onDrill('os', r.os)}
                                title={r.os ? `Filter by ${r.os}` : undefined}
                                style={chipButton(!!r.os)}>{r.os || 'Unknown OS'}</button>
                        </span>
                        <span style={{ display: 'flex', gap: 12, flexShrink: 0, alignItems: 'baseline' }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>{fmt(r.views)} views</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{fmt(r.visitors)}</span>
                        </span>
                    </div>
                    <ShareBar value={r.visitors || r.views} of={peak} />
                </div>
            ))}
        </div>
    );
}

const chipButton = (clickable) => ({
    background: 'transparent', border: 'none', padding: 0, fontSize: 12,
    color: 'var(--text-primary, #fff)', cursor: clickable ? 'pointer' : 'default',
    textDecoration: clickable ? 'underline dotted' : 'none', textUnderlineOffset: 3,
});

/**
 * Capability-missing, not error and not empty.
 *
 * Reached when visits exist but none of them carry a location. Two causes, and
 * the message names the likelier one first:
 *
 *  1. The visitor's IP never reached Umami. Behind an L4 load balancer that
 *     re-originates the connection (Scaleway's, in the hosted deployment), the
 *     proxy's own private address is what arrives, so the lookup resolves
 *     nothing and the country is stored as NULL. Fixed at the ingress by
 *     carrying the source through — see deploy/scaleway-kapsule/bootstrap.sh.
 *  2. No GeoLite2 database (self-hosted installs that strip it from the image;
 *     the official Umami image ships one at /app/geo/GeoLite2-City.mmdb).
 *
 * Either way this is a deployment gap, not a broken dashboard — say so rather
 * than claiming nobody visited.
 */
function GeoUnavailable() {
    return (
        <div style={{
            display: 'flex', gap: 9, alignItems: 'flex-start', padding: '12px 14px',
            borderRadius: 10, background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)', fontSize: 12, color: '#fcd34d',
        }}>
            <MapPin style={{ width: 14, height: 14, marginTop: 1, flexShrink: 0 }} />
            <span>
                <strong>Visits recorded, but no location data.</strong> Usually the visitor&apos;s IP address is
                not reaching the analytics service — behind a load balancer it is the balancer&apos;s own address
                that arrives, which resolves to nowhere. Everything else on this page is unaffected.
            </span>
        </div>
    );
}
