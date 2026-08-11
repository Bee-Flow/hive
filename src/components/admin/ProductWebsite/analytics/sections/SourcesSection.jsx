/**
 * Sources — how people found the site.
 *
 * This was the worst screen in the product: six cards, all empty, plus a
 * footnote apologising for them. Five of the six were UTM dimensions, and a
 * self-hosted marketing site's links are mostly untagged, so "empty" is the
 * NORMAL state, not the exception.
 *
 * So it is designed for sparse first. The channel mix is computed from the
 * referrers we do have and always says something. The five UTM dimensions come
 * from ONE `/report/utm` call instead of five `/metrics` requests, and collapse
 * into a single card that stays quiet when there is nothing to report. And the
 * empty state offers the thing that would fix it — a tagged link — rather than
 * explaining why the box is grey.
 */
import React, { useMemo, useState } from 'react';
import { Share2, Link2, Copy, Check } from 'lucide-react';
import { useAnalyticsQuery } from '../useAnalyticsQuery';
import {
    ACCENT, SERIES, Card, Empty, ErrorNote, Skeleton, SplitBar, ShareBar,
    fmt, fmtDurationSec, rateColor, maxOf,
} from '../ui';
import { toChannels, referrerHost, pivot } from '../model';

export default function SourcesSection({ scope, onDrill }) {
    const referrers = useAnalyticsQuery('query', 'metrics', scope, { params: { type: 'referrer', limit: 50 } });
    const stats = useAnalyticsQuery('query', 'stats', scope);
    const utm = useAnalyticsQuery('report', 'utm', scope);
    const quality = useAnalyticsQuery('report', 'breakdown', scope, { body: { fields: ['referrer'] } });

    const rows = useMemo(() => (Array.isArray(referrers.payload) ? referrers.payload : []), [referrers.payload]);

    // Everything that arrived without a referrer is direct traffic. Deriving it
    // from the totals is the only way to show it — Umami reports it as a blank
    // referrer row, which the old bar list rendered as "(none)".
    const channels = useMemo(() => {
        const referred = rows.filter(r => r.x).reduce((a, r) => a + (r.y || 0), 0);
        const blank = rows.filter(r => !r.x).reduce((a, r) => a + (r.y || 0), 0);
        const totalVisits = Number(stats.payload?.visits) || 0;
        const direct = Math.max(blank, totalVisits - referred);
        return toChannels(rows.filter(r => r.x), { direct });
    }, [rows, stats.payload]);

    const enriched = useMemo(() => {
        const byRef = new Map();
        for (const r of pivot(quality.payload, ['referrer'])) {
            if (r.referrer) byRef.set(r.referrer, r);
        }
        return rows.filter(r => r.x).map(r => ({
            referrer: r.x,
            host: referrerHost(r.x),
            views: r.y || 0,
            ...(byRef.get(r.x) || {}),
        })).sort((a, b) => b.views - a.views);
    }, [rows, quality.payload]);

    if (referrers.loading && stats.loading) {
        return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}><Skeleton height={140} /><Skeleton height={260} /></div>;
    }
    if (referrers.error) return <ErrorNote message={referrers.error} onRetry={referrers.reload} />;

    const peak = maxOf(enriched.map(r => r.views));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card title="Channel mix" icon={Share2}>
                {channels.length === 0 ? (
                    <Empty text="No visits in this period." />
                ) : (
                    <>
                        <SplitBar
                            segments={channels.map((c, i) => ({
                                label: c.label, value: c.value, color: CHANNEL_COLORS[c.label] || SERIES.secondary,
                            }))}
                            legend height={12}
                        />
                        <p style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)', margin: '12px 0 0' }}>
                            {channels[0].share >= 80
                                ? <>Almost everything is <strong>{channels[0].label.toLowerCase()}</strong> traffic
                                    ({Math.round(channels[0].share)}%). Tag the links you share to see more here.</>
                                : <><strong>{channels[0].label}</strong> is your biggest channel
                                    at {Math.round(channels[0].share)}%, followed by {channels[1]?.label?.toLowerCase()
                                        || 'nothing else'}{channels[1] ? ` at ${Math.round(channels[1].share)}%` : ''}.</>}
                        </p>
                    </>
                )}
            </Card>

            <Card title="Referring sites" icon={Share2} action={
                enriched.length ? <span style={{ fontSize: 10, color: 'var(--text-muted, #777)' }}>click to filter</span> : null
            }>
                {enriched.length === 0 ? (
                    <Empty text="Nobody arrived from another site in this period — all traffic was direct or untracked." />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        {enriched.slice(0, 15).map((r, i) => (
                            <button key={`${i}-${r.referrer}`} onClick={() => onDrill('referrer', r.referrer)}
                                style={{
                                    display: 'block', width: '100%', textAlign: 'left', padding: 0,
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 3 }}>
                                    <span style={{
                                        fontSize: 12, color: 'var(--text-primary, #fff)', overflow: 'hidden',
                                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>{r.host}</span>
                                    <span style={{ display: 'flex', gap: 12, flexShrink: 0, alignItems: 'baseline' }}>
                                        {r.bounceRate != null && (
                                            <span style={{ fontSize: 11, color: rateColor(r.bounceRate) }}>
                                                {Math.round(r.bounceRate)}% bounce
                                            </span>
                                        )}
                                        {r.avgTime != null && (
                                            <span style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>
                                                {fmtDurationSec(r.avgTime)}
                                            </span>
                                        )}
                                        <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{fmt(r.views)}</span>
                                    </span>
                                </div>
                                <ShareBar value={r.views} of={peak} />
                            </button>
                        ))}
                    </div>
                )}
            </Card>

            <CampaignCard utm={utm} onDrill={onDrill} />
        </div>
    );
}

const CHANNEL_COLORS = {
    Direct: '#64748b',
    Search: SERIES.secondary,
    Referral: SERIES.primary,
    Social: '#0ea5e9',
    Email: SERIES.warn,
    'AI assistants': '#f97316',
    Campaign: '#10b981',
    Paid: SERIES.bad,
};

const UTM_FIELDS = [
    { key: 'utm_source', label: 'Source', dim: 'utmSource' },
    { key: 'utm_medium', label: 'Medium', dim: 'utmMedium' },
    { key: 'utm_campaign', label: 'Campaign', dim: 'utmCampaign' },
    { key: 'utm_content', label: 'Content', dim: 'utmContent' },
    { key: 'utm_term', label: 'Term', dim: 'utmTerm' },
];

/**
 * All five UTM dimensions in one card, from one request.
 *
 * When they are all empty — the normal case — it becomes a link builder rather
 * than five grey boxes, because the only way to make this card useful is to go
 * and tag a link.
 */
function CampaignCard({ utm, onDrill }) {
    const data = utm.payload || {};
    const present = UTM_FIELDS
        .map(f => ({ ...f, rows: Array.isArray(data[f.key]) ? data[f.key] : [] }))
        .filter(f => f.rows.length > 0);

    if (utm.loading) return <Card title="Campaigns" icon={Link2}><Skeleton height={140} /></Card>;

    if (!present.length) {
        return (
            <Card title="Campaigns" icon={Link2}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary, #ccc)', margin: '0 0 4px' }}>
                    No tagged links were visited in this period.
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted, #888)', margin: '0 0 14px' }}>
                    Campaign data only appears when you share a link carrying <code>?utm_source=…</code>.
                    Build one here and every visit through it shows up in this card.
                </p>
                <UtmBuilder />
            </Card>
        );
    }

    return (
        <Card title="Campaigns" icon={Link2}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {present.map(f => {
                    const peak = maxOf(f.rows.map(r => Number(r.y ?? r.count) || 0));
                    return (
                        <div key={f.key}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #888)', marginBottom: 7 }}>
                                {f.label}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                {f.rows.slice(0, 6).map((r, i) => {
                                    const label = r.x ?? r.name ?? r.value;
                                    const value = Number(r.y ?? r.count) || 0;
                                    return (
                                        <button key={`${i}-${label}`} onClick={() => label && onDrill(f.dim, label)}
                                            style={{
                                                display: 'block', width: '100%', textAlign: 'left', padding: 0,
                                                background: 'transparent', border: 'none', cursor: 'pointer',
                                            }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                                                <span style={{
                                                    fontSize: 12, color: 'var(--text-primary, #fff)', overflow: 'hidden',
                                                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>{label}</span>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{fmt(value)}</span>
                                            </div>
                                            <ShareBar value={value} of={peak} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))' }}>
                <UtmBuilder />
            </div>
        </Card>
    );
}

/** Builds a tagged URL. Purely client-side; nothing is stored. */
function UtmBuilder() {
    const [url, setUrl] = useState('');
    const [source, setSource] = useState('');
    const [medium, setMedium] = useState('');
    const [campaign, setCampaign] = useState('');
    const [copied, setCopied] = useState(false);

    const built = useMemo(() => {
        if (!url.trim()) return '';
        try {
            const u = new URL(url.includes('://') ? url : `https://${url}`);
            if (source.trim()) u.searchParams.set('utm_source', source.trim());
            if (medium.trim()) u.searchParams.set('utm_medium', medium.trim());
            if (campaign.trim()) u.searchParams.set('utm_campaign', campaign.trim());
            return u.toString();
        } catch { return ''; }
    }, [url, source, medium, campaign]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(built);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch { /* clipboard blocked — the field is selectable anyway */ }
    };

    return (
        <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #888)', marginBottom: 8 }}>
                Build a tagged link
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                <Field value={url} onChange={setUrl} placeholder="https://your.site/pricing" label="Destination" />
                <Field value={source} onChange={setSource} placeholder="newsletter" label="Source" />
                <Field value={medium} onChange={setMedium} placeholder="email" label="Medium" />
                <Field value={campaign} onChange={setCampaign} placeholder="launch-july" label="Campaign" />
            </div>
            {built && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                    <input readOnly value={built} onFocus={(e) => e.target.select()} style={{
                        flex: 1, fontFamily: 'ui-monospace, monospace', fontSize: 11,
                        background: 'var(--bg-primary, #0f0f1a)', color: 'var(--text-primary, #fff)',
                        border: '1px solid var(--border-default, rgba(255,255,255,0.12))',
                        borderRadius: 8, padding: '7px 10px',
                    }} />
                    <button onClick={copy} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px',
                        borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                        background: ACCENT, color: '#06241f',
                    }}>
                        {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>
            )}
        </div>
    );
}

function Field({ value, onChange, placeholder, label }) {
    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted, #888)' }}>{label}</span>
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{
                background: 'var(--bg-primary, #0f0f1a)', color: 'var(--text-primary, #fff)',
                border: '1px solid var(--border-default, rgba(255,255,255,0.12))',
                borderRadius: 8, padding: '6px 9px', fontSize: 12, width: '100%',
            }} />
        </label>
    );
}
