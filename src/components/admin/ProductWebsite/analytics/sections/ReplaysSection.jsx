/**
 * Sessions — who visited, what they did, and which visit is worth watching.
 *
 * Three things were wrong with the old "Replays" tab. It hid behind the
 * recorder toggle and fetched nothing when recording was off — even though the
 * `sessions` resource needs no recorder at all, so switching recording off hid
 * data that was still being collected. It was a chronological dump, which
 * cannot answer "which of these is worth fourteen minutes of my time". And its
 * one headline number was wrong by three orders of magnitude: Umami reports
 * `duration` in milliseconds and it was formatted as seconds, so an 11.8-second
 * recording printed as "196m 21s".
 *
 * Playback still opens Umami's own player in a new tab. Rendering rrweb here
 * would mean a new dependency and re-implementing a video player; that is
 * deliberately deferred, and the UI says so rather than pretending.
 */
import React, { useMemo, useState } from 'react';
import { Video, ShieldAlert, ExternalLink, Monitor, Globe, Play, Users } from 'lucide-react';
import { useAnalyticsQuery } from '../useAnalyticsQuery';
import {
    ACCENT, SERIES, Card, Empty, ErrorNote, Skeleton, StatGrid, StatTile,
    fmt, fmtDurationMs, fmtAgo,
} from '../ui';
import { sessionSignals } from '../model';

const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'engaged', label: 'Engaged' },
    { id: 'recorded', label: 'Recorded' },
    { id: 'bounced', label: 'Bounced' },
];

export default function ReplaysSection({ scope, site, settings, onOpenSettings, onDrill }) {
    const [filter, setFilter] = useState('all');
    const recording = !!site?.recording;

    // Sessions need no recorder — fetch them regardless of the toggle.
    const sessions = useAnalyticsQuery('query', 'sessions', scope, { params: { pageSize: 200 } });
    const replays = useAnalyticsQuery('query', 'replays', scope, {
        params: { pageSize: 200 }, enabled: recording,
    });

    const rows = useMemo(() => {
        const list = Array.isArray(sessions.payload?.data) ? sessions.payload.data : [];
        const replayList = Array.isArray(replays.payload?.data) ? replays.payload.data : [];
        const bySession = new Map();
        for (const r of replayList) {
            // Keep the longest recording per session — a session can produce
            // several chunks and only one is worth linking to.
            const cur = bySession.get(r.sessionId);
            const span = Date.parse(r.endedAt) - Date.parse(r.startedAt);
            if (!cur || span > cur._span) bySession.set(r.sessionId, { ...r, _span: span });
        }
        return list
            .map(s => {
                const replay = bySession.get(s.id) || null;
                return { session: s, replay, ...sessionSignals(s, { events: Number(s.events) || 0, replay }) };
            })
            .sort((a, b) => b.score - a.score || Date.parse(b.session.lastAt) - Date.parse(a.session.lastAt));
    }, [sessions.payload, replays.payload]);

    const shown = useMemo(() => rows.filter(r => {
        if (filter === 'engaged') return r.events > 0 || r.views >= 4;
        if (filter === 'recorded') return r.hasReplay;
        if (filter === 'bounced') return r.views === 1 && r.duration < 10_000;
        return true;
    }), [rows, filter]);

    const totals = useMemo(() => ({
        sessions: rows.length,
        recorded: rows.filter(r => r.hasReplay).length,
        engaged: rows.filter(r => r.events > 0).length,
        avg: rows.length ? rows.reduce((a, r) => a + r.duration, 0) / rows.length : 0,
    }), [rows]);

    if (sessions.loading) {
        return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}><Skeleton height={100} /><Skeleton height={320} /></div>;
    }
    if (sessions.error) return <ErrorNote message={sessions.error} onRetry={sessions.reload} />;

    const base = (settings?.url || '').replace(/\/+$/, '');
    const websiteId = site?.websiteId;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <RecordingStrip recording={recording} totals={totals} site={site} onOpenSettings={onOpenSettings} />

            <StatGrid>
                <StatTile icon={Users} label="Sessions" value={fmt(totals.sessions)} color={ACCENT} />
                <StatTile icon={Monitor} label="Avg. length" value={fmtDurationMs(totals.avg)} color={SERIES.secondary} />
                <StatTile icon={Play} label="Interacted" value={fmt(totals.engaged)} color={SERIES.primary}
                    subtitle="clicked or submitted something" />
                <StatTile icon={Video} label="Recorded" value={fmt(totals.recorded)} color={SERIES.warn}
                    subtitle={totals.sessions ? `${Math.round((totals.recorded / totals.sessions) * 100)}% of sessions` : undefined} />
            </StatGrid>

            <Card title="Visits" icon={Users} action={
                <div style={{ display: 'flex', gap: 4 }}>
                    {FILTERS.map(f => (
                        <button key={f.id} onClick={() => setFilter(f.id)} style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                            border: `1px solid ${filter === f.id ? `${ACCENT}66` : 'var(--border-subtle, rgba(255,255,255,0.1))'}`,
                            background: filter === f.id ? `${ACCENT}14` : 'transparent',
                            color: filter === f.id ? ACCENT : 'var(--text-muted, #888)',
                        }}>{f.label}</button>
                    ))}
                </div>
            }>
                {shown.length === 0 ? (
                    <Empty text={filter === 'all'
                        ? 'No sessions in this period.'
                        : 'No sessions match that filter in this period.'} />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 560, overflowY: 'auto' }}>
                        {shown.slice(0, 100).map(r => (
                            <SessionRow key={r.session.id} row={r} base={base} websiteId={websiteId} onDrill={onDrill} />
                        ))}
                    </div>
                )}
                {shown.length > 100 && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted, #777)', margin: '10px 0 0' }}>
                        Showing the 100 most notable of {fmt(shown.length)} — narrow the date range to see the rest.
                    </p>
                )}
            </Card>

            {recording && (
                <p style={{ fontSize: 11, color: 'var(--text-muted, #777)', margin: 0 }}>
                    Playback opens in Umami — the player itself is not embedded here.
                </p>
            )}
        </div>
    );
}

function SessionRow({ row, base, websiteId, onDrill }) {
    const { session: s, replay, reasons, duration, views, events } = row;
    const href = replay && base && websiteId
        ? `${base}/websites/${websiteId}/replays/${replay.id}`
        : null;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '9px 11px', borderRadius: 9,
            background: 'var(--bg-tertiary, rgba(255,255,255,0.03))',
            borderLeft: `2px solid ${events > 0 ? ACCENT : 'transparent'}`,
        }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-primary, #fff)' }}>
                        {fmtAgo(s.lastAt)}
                    </span>
                    {reasons.map(rs => (
                        <span key={rs} style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 5,
                            background: 'var(--bg-secondary, rgba(255,255,255,0.05))',
                            color: 'var(--text-muted, #999)',
                        }}>{rs}</span>
                    ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Monitor style={{ width: 11, height: 11 }} />
                        {[s.browser, s.os, s.device].filter(Boolean).join(' · ') || 'unknown device'}
                        {s.screen ? ` · ${s.screen}` : ''}
                    </span>
                    {s.country && (
                        <button onClick={() => onDrill?.('country', s.country)}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent',
                                border: 'none', padding: 0, cursor: 'pointer', fontSize: 11,
                                color: 'var(--text-muted, #888)',
                            }}>
                            <Globe style={{ width: 11, height: 11 }} />{s.country}
                        </button>
                    )}
                    <span>
                        {fmtDurationMs(duration)} · {fmt(views)} page{views === 1 ? '' : 's'}
                        {events > 0 ? ` · ${fmt(events)} interaction${events === 1 ? '' : 's'}` : ''}
                    </span>
                </div>
            </div>
            {href ? (
                <a href={href} target="_blank" rel="noreferrer" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                    fontSize: 11, fontWeight: 700, color: ACCENT, textDecoration: 'none',
                    border: `1px solid ${ACCENT}44`, borderRadius: 7, padding: '4px 9px',
                }}>
                    Play <ExternalLink style={{ width: 11, height: 11 }} />
                </a>
            ) : (
                <span style={{ fontSize: 10, color: 'var(--text-muted, #666)', flexShrink: 0 }}>not recorded</span>
            )}
        </div>
    );
}

/**
 * "Why do I have 200 sessions but only 12 recordings?" — the first question
 * this tab has to answer, before anything else on it makes sense.
 */
function RecordingStrip({ recording, totals, site, onOpenSettings }) {
    if (!recording) {
        return (
            <div style={{
                display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 15px',
                borderRadius: 10, background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.25)', fontSize: 12, color: '#fcd34d',
            }}>
                <ShieldAlert style={{ width: 14, height: 14, marginTop: 1, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>
                    <strong>Session recording is off for {site?.name ? `“${site.name}”` : 'this site'}.</strong>{' '}
                    Every visit below is still being counted — recording only adds replay and heatmaps on top.
                    It captures clicks, scrolling and page structure, so it runs only for visitors who accepted
                    your cookie banner, in every consent mode, and form inputs are masked.
                </span>
                <button onClick={onOpenSettings} style={{
                    flexShrink: 0, padding: '6px 12px', borderRadius: 8, background: '#f59e0b',
                    color: '#2a1a00', border: 'none', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                }}>Turn it on</button>
            </div>
        );
    }

    const pct = totals.sessions ? Math.round((totals.recorded / totals.sessions) * 100) : 0;
    return (
        <div style={{
            display: 'flex', gap: 10, alignItems: 'center', padding: '9px 14px', borderRadius: 10,
            background: 'var(--bg-secondary, #1a1a2e)',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            fontSize: 12, color: 'var(--text-secondary, #aaa)',
        }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: ACCENT, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
                Recording on, inputs masked · <strong style={{ color: 'var(--text-primary, #fff)' }}>
                    {fmt(totals.recorded)} of {fmt(totals.sessions)}
                </strong> sessions recorded ({pct}%). The rest declined the cookie banner — that is expected,
                not a fault.
            </span>
            <button onClick={onOpenSettings} style={{
                background: 'transparent', border: 'none', color: ACCENT,
                fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
            }}>Recording settings →</button>
        </div>
    );
}
