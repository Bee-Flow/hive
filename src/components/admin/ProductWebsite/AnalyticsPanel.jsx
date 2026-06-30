import React, { useEffect, useState, useCallback } from 'react';
import {
    BarChart3, Users, Eye, MousePointerClick, Timer, Globe,
    Activity, Settings, RefreshCw, Loader2, ExternalLink, ArrowLeft,
} from 'lucide-react';
import { analyticsApi, analyticsFetch } from './analyticsApi';
import {
    Card, MetricCard, Empty, SvgAreaChart, DonutChart, SortableTable, fmt,
} from '../MonitoringPanel/shared';

// Non-purple palette only (project rule bans indigo/violet — so we never use
// shared COLORS.primary #6366f1 / MODEL_COLORS, which include them). Pass these
// explicitly to every shared chart/card so nothing falls back to the default.
const ACCENT = '#14b8a6';                                  // teal
const PALETTE = ['#3b82f6', '#14b8a6', '#10b981', '#f59e0b', '#f97316', '#06b6d4', '#f43f5e', '#0ea5e9'];

const RANGES = [
    { id: '24h', label: 'Last 24h' },
    { id: '7d', label: 'Last 7 days' },
    { id: '30d', label: 'Last 30 days' },
    { id: '90d', label: 'Last 90 days' },
];

const TZ = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
})();

// Umami stat fields are either { value, prev } or a bare number depending on
// version — normalise both.
const statVal = (s) => (s && typeof s === 'object' ? (s.value ?? 0) : (typeof s === 'number' ? s : 0));

function fmtDurationSec(sec) {
    const s = Math.max(0, Math.round(sec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

// Umami /pageviews → { pageviews: [{x, y}], sessions: [...] }. Shape it for
// SvgAreaChart (uses `period` for x-labels, our `value` as yKey).
function toTimeseries(pageviews) {
    const arr = Array.isArray(pageviews?.pageviews) ? pageviews.pageviews : [];
    return arr.map(p => ({ period: String(p.x || '').slice(0, 16).replace('T', ' '), value: p.y || 0 }));
}

// Umami /metrics → [{ x: value, y: count }]. Rows for SortableTable.
function toRows(arr) {
    return (Array.isArray(arr) ? arr : []).map((d, i) => ({
        label: d.x || '(none)',
        count: d.y || 0,
        _key: `${i}-${d.x ?? ''}`,
    }));
}

function toDonut(arr) {
    return (Array.isArray(arr) ? arr : [])
        .filter(d => (d.y || 0) > 0)
        .map((d, i) => ({ label: d.x || '(none)', value: d.y || 0, color: PALETTE[i % PALETTE.length] }));
}

const breakdownColumns = (labelHeader) => ([
    { key: 'label', label: labelHeader, width: '1fr',
      render: (r) => <span style={{ fontSize: 12, color: 'var(--text-primary, #fff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>{r.label}</span> },
    { key: 'count', label: 'Views', width: '70px', align: 'right',
      render: (r) => <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{fmt(r.count)}</span> },
]);

export default function AnalyticsPanel() {
    const [settings, setSettings] = useState(null);   // { enabled, consentMode, url, configured }
    const [sites, setSites] = useState([]);
    const [siteId, setSiteId] = useState('');
    const [range, setRange] = useState('7d');
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [view, setView] = useState('dashboard');     // 'dashboard' | 'settings'

    // Initial load: settings + tracked sites.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const [s, sitesRes] = await Promise.all([
                    analyticsFetch(analyticsApi.settings()),
                    analyticsFetch(analyticsApi.sites()).catch(() => ({ sites: [] })),
                ]);
                if (cancelled) return;
                setSettings(s);
                const list = sitesRes?.sites || [];
                setSites(list);
                const live = list.find(x => x.live && x.tracked) || list.find(x => x.tracked);
                setSiteId(live?.id || '');
                if (!s?.enabled || !s?.configured) setView('settings');
            } catch (e) {
                if (!cancelled) setError(e.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const loadOverview = useCallback(async () => {
        if (!settings?.enabled || !settings?.configured) return;
        setRefreshing(true);
        setError(null);
        try {
            const data = await analyticsFetch(analyticsApi.overview({ siteId: siteId || undefined, range, timezone: TZ }));
            setOverview(data);
        } catch (e) {
            setError(e.message);
        } finally {
            setRefreshing(false);
        }
    }, [settings, siteId, range]);

    useEffect(() => { loadOverview(); }, [loadOverview]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                <Loader2 className="w-5 h-5 animate-spin" />
            </div>
        );
    }

    if (view === 'settings') {
        return (
            <SettingsView
                settings={settings}
                onSaved={(s) => { setSettings(s); if (s.enabled && s.configured) setView('dashboard'); }}
                onClose={settings?.enabled && settings?.configured ? () => setView('dashboard') : null}
            />
        );
    }

    const provisioned = overview?.provisioned !== false;
    const trackedSites = sites.filter(s => s.tracked);

    return (
        <div className="absolute inset-0 overflow-auto" style={{ background: 'var(--bg-primary)' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 28px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${ACCENT}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BarChart3 style={{ width: 18, height: 18, color: ACCENT }} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary, #fff)', margin: 0 }}>Website Analytics</h2>
                            <p style={{ fontSize: 12, color: 'var(--text-muted, #888)', margin: 0 }}>
                                Self-hosted, privacy-first usage tracking for your published site
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {trackedSites.length > 1 && (
                            <select
                                value={siteId}
                                onChange={(e) => setSiteId(e.target.value)}
                                style={selectStyle}
                            >
                                {trackedSites.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}{s.live ? ' (live)' : ''}</option>
                                ))}
                            </select>
                        )}
                        <select value={range} onChange={(e) => setRange(e.target.value)} style={selectStyle}>
                            {RANGES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                        <button onClick={loadOverview} title="Refresh" style={iconBtnStyle}>
                            <RefreshCw style={{ width: 15, height: 15 }} className={refreshing ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={() => setView('settings')} title="Analytics settings" style={iconBtnStyle}>
                            <Settings style={{ width: 15, height: 15 }} />
                        </button>
                    </div>
                </div>

                {error && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', color: '#fda4af', fontSize: 13 }}>
                        {error}
                    </div>
                )}

                {!provisioned ? (
                    <Empty text="No tracked site yet. Publish a CMS site (with analytics enabled) to start collecting visitor data." />
                ) : !overview?.stats ? (
                    <Empty text="No analytics data for this period yet." />
                ) : (
                    <Dashboard overview={overview} range={range} />
                )}
            </div>
        </div>
    );
}

function Dashboard({ overview }) {
    const s = overview.stats || {};
    const visits = statVal(s.visits) || statVal(s.sessions);
    const pageviews = statVal(s.pageviews);
    const visitors = statVal(s.visitors);
    const bounces = statVal(s.bounces);
    const totaltime = statVal(s.totaltime);
    const bounceRate = visits > 0 ? Math.round((bounces / visits) * 100) : 0;
    const avgVisit = visits > 0 ? totaltime / visits : 0;

    const series = toTimeseries(overview.pageviews);
    const devices = toDonut(overview.devices);
    const browsers = toDonut(overview.browsers);

    return (
        <>
            {/* Metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
                <MetricCard icon={Users} label="Visitors" value={fmt(visitors)} color={PALETTE[0]} />
                <MetricCard icon={Eye} label="Pageviews" value={fmt(pageviews)} color={ACCENT} />
                <MetricCard icon={MousePointerClick} label="Bounce rate" value={`${bounceRate}%`} color={PALETTE[3]} />
                <MetricCard icon={Timer} label="Avg. visit" value={fmtDurationSec(avgVisit)} color={PALETTE[2]} />
                <MetricCard icon={Activity} label="Active now" value={overview.active != null ? fmt(overview.active) : '—'} color={PALETTE[5]} />
            </div>

            {/* Trend */}
            <div style={{ marginBottom: 16 }}>
                <Card title="Pageviews over time">
                    <SvgAreaChart data={series} yKey="value" color={ACCENT} height={180} formatY={fmt} />
                </Card>
            </div>

            {/* Breakdowns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                <Card title="Top pages"><SortableTable columns={breakdownColumns('Page')} data={toRows(overview.pages)} emptyText="No page data" maxRows={10} /></Card>
                <Card title="Referrers"><SortableTable columns={breakdownColumns('Source')} data={toRows(overview.referrers)} emptyText="No referrer data" maxRows={10} /></Card>
                <Card title="Countries"><SortableTable columns={breakdownColumns('Country')} data={toRows(overview.countries)} emptyText="No country data" maxRows={10} /></Card>
                <Card title="Devices">{devices.length ? <DonutChart items={devices} centerLabel="Devices" centerValue={fmt(devices.reduce((a, d) => a + d.value, 0))} /> : <Empty text="No device data" />}</Card>
                <Card title="Browsers">{browsers.length ? <DonutChart items={browsers} centerLabel="Browsers" centerValue={fmt(browsers.reduce((a, d) => a + d.value, 0))} /> : <Empty text="No browser data" />}</Card>
                <Card title="Operating systems"><SortableTable columns={breakdownColumns('OS')} data={toRows(overview.os)} emptyText="No OS data" maxRows={8} /></Card>
            </div>
        </>
    );
}

function SettingsView({ settings, onSaved, onClose }) {
    const [enabled, setEnabled] = useState(!!settings?.enabled);
    const [consentMode, setConsentMode] = useState(settings?.consentMode || 'cookieless');
    const [url, setUrl] = useState(settings?.url || '');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [apiToken, setApiToken] = useState('');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);
    const [err, setErr] = useState(null);

    const save = async () => {
        setSaving(true); setErr(null); setMsg(null);
        try {
            const body = { enabled, consentMode, url };
            // Only send credentials the operator actually typed, so a blank
            // field never wipes a stored secret.
            if (username) body.username = username;
            if (password) body.password = password;
            if (apiToken) body.apiToken = apiToken;
            const res = await analyticsFetch(analyticsApi.settings(), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            setMsg(res.configured ? 'Saved. Analytics is connected.' : 'Saved — add a URL and credentials to connect.');
            setUsername(''); setPassword(''); setApiToken('');
            onSaved?.(res);
        } catch (e) {
            setErr(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="absolute inset-0 overflow-auto" style={{ background: 'var(--bg-primary)' }}>
            <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    {onClose && (
                        <button onClick={onClose} style={iconBtnStyle} title="Back to dashboard">
                            <ArrowLeft style={{ width: 15, height: 15 }} />
                        </button>
                    )}
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary, #fff)', margin: 0 }}>Analytics settings</h2>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted, #888)', margin: '0 0 20px' }}>
                    Connect your self-hosted Umami instance. Visitor data stays on your own infrastructure.
                </p>

                {err && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)', color: '#fda4af', fontSize: 13 }}>{err}</div>}
                {msg && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#6ee7b7', fontSize: 13 }}>{msg}</div>}

                <Card>
                    <Toggle label="Enable tracking" hint="Injects the tracker on your live published site." checked={enabled} onChange={setEnabled} />
                    <Field label="Umami URL" hint="Public URL of your Umami instance, e.g. https://stats.your-domain.com. Serves the visitor tracker script and is used to fetch stats (unless UMAMI_URL is set on the server for an internal address).">
                        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://stats.example.com" style={inputStyle} />
                    </Field>

                    <div style={{ margin: '6px 0 14px' }}>
                        <label style={labelStyle}>Consent mode</label>
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            <ModeChip active={consentMode === 'cookieless'} onClick={() => setConsentMode('cookieless')} title="Cookieless" desc="No cookies, no consent banner needed" />
                            <ModeChip active={consentMode === 'cookies'} onClick={() => setConsentMode('cookies')} title="Cookies" desc="Loads only after the visitor accepts cookies" />
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-default, rgba(255,255,255,0.08))', margin: '8px 0 14px', paddingTop: 14 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #888)', margin: '0 0 10px' }}>
                            Credentials {settings?.configured ? '(stored — leave blank to keep)' : ''}
                        </p>
                        <Field label="Username" hint="Umami admin user (for token login).">
                            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" placeholder={settings?.configured ? '••••••••' : 'admin'} style={inputStyle} />
                        </Field>
                        <Field label="Password">
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder={settings?.configured ? '••••••••' : ''} style={inputStyle} />
                        </Field>
                        <Field label="API token (optional)" hint="Use instead of username/password if your instance issues API keys.">
                            <input value={apiToken} onChange={(e) => setApiToken(e.target.value)} autoComplete="off" placeholder={settings?.configured ? '••••••••' : ''} style={inputStyle} />
                        </Field>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                        <button onClick={save} disabled={saving} style={primaryBtnStyle}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {saving ? 'Saving…' : 'Save settings'}
                        </button>
                        {url && (
                            <a href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: ACCENT, textDecoration: 'none' }}>
                                Open Umami <ExternalLink style={{ width: 12, height: 12 }} />
                            </a>
                        )}
                    </div>
                </Card>

                <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'flex-start', color: 'var(--text-muted, #888)', fontSize: 12 }}>
                    <Globe style={{ width: 14, height: 14, marginTop: 1, flexShrink: 0 }} />
                    <span>A Umami "website" is created automatically per CMS site the first time you publish it (or save here while a site is live).</span>
                </div>
            </div>
        </div>
    );
}

// ── Small inputs ─────────────────────────────────────────────────────
function Field({ label, hint, children }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{label}</label>
            {children}
            {hint && <p style={{ fontSize: 11, color: 'var(--text-muted, #777)', margin: '4px 0 0' }}>{hint}</p>}
        </div>
    );
}

function Toggle({ label, hint, checked, onChange }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>{label}</div>
                {hint && <div style={{ fontSize: 11, color: 'var(--text-muted, #777)' }}>{hint}</div>}
            </div>
            <button
                onClick={() => onChange(!checked)}
                aria-pressed={checked}
                style={{
                    width: 42, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0,
                    background: checked ? ACCENT : 'var(--bg-tertiary, rgba(255,255,255,0.12))',
                    position: 'relative', transition: 'background 0.15s',
                }}
            >
                <span style={{
                    position: 'absolute', top: 3, left: checked ? 21 : 3, width: 18, height: 18,
                    borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
                }} />
            </button>
        </div>
    );
}

function ModeChip({ active, onClick, title, desc }) {
    return (
        <button
            onClick={onClick}
            style={{
                flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: active ? `${ACCENT}14` : 'var(--bg-tertiary, rgba(255,255,255,0.03))',
                border: `1px solid ${active ? `${ACCENT}66` : 'var(--border-default, rgba(255,255,255,0.08))'}`,
                transition: 'all 0.15s',
            }}
        >
            <div style={{ fontSize: 13, fontWeight: 700, color: active ? ACCENT : 'var(--text-primary, #fff)' }}>{title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 2 }}>{desc}</div>
        </button>
    );
}

// ── Styles ───────────────────────────────────────────────────────────
const selectStyle = {
    background: 'var(--bg-secondary, #1a1a2e)', color: 'var(--text-primary, #fff)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.1))', borderRadius: 8,
    padding: '6px 10px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
};
const iconBtnStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32,
    borderRadius: 8, background: 'var(--bg-secondary, #1a1a2e)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.1))',
    color: 'var(--text-secondary, #aaa)', cursor: 'pointer',
};
const inputStyle = {
    width: '100%', boxSizing: 'border-box', marginTop: 5, padding: '8px 11px',
    background: 'var(--bg-primary, #0f0f1a)', color: 'var(--text-primary, #fff)',
    border: '1px solid var(--border-default, rgba(255,255,255,0.12))', borderRadius: 8, fontSize: 13,
};
const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary, #ccc)' };
const primaryBtnStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9,
    background: ACCENT, color: '#06241f', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
