/**
 * Analytics settings.
 *
 * Connection + consent (as before), plus two things that were previously
 * impossible from the UI: per-site session-recording opt-in, and a connection
 * diagnostic that shows the internal-vs-public URL split — the standard way
 * this integration half-works (the browser loads /script.js fine from the
 * public origin while every server→Umami call quietly fails).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
    ArrowLeft, ExternalLink, Globe, Loader2, ShieldAlert, Video, CheckCircle2, XCircle,
} from 'lucide-react';
import { analyticsApi, analyticsFetch } from '../../analyticsApi';
import { ACCENT, Card, ErrorNote } from '../ui';

export default function SettingsSection({ settings, sites = [], onSaved, onSitesChanged, onClose }) {
    const [enabled, setEnabled] = useState(!!settings?.enabled);
    const [consentMode, setConsentMode] = useState(settings?.consentMode || 'cookieless');
    const [url, setUrl] = useState(settings?.url || '');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [apiToken, setApiToken] = useState('');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);
    const [err, setErr] = useState(null);

    const [tracker, setTracker] = useState(settings?.tracker || {});
    const [recorder, setRecorder] = useState(settings?.recorder || {});
    const patchTracker = (k, v) => setTracker(t => ({ ...t, [k]: v }));
    const patchRecorder = (k, v) => setRecorder(r => ({ ...r, [k]: v }));

    const save = async () => {
        setSaving(true); setErr(null); setMsg(null);
        try {
            const body = { enabled, consentMode, url, tracker, recorder };
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
            // "Connected" would be a claim we cannot support: `configured` only
            // means the fields are non-empty, nothing has been probed. Point at
            // the diagnostic that actually checks.
            setMsg(res.configured
                ? 'Saved. Run the diagnostic below to confirm the whole chain works.'
                : 'Saved — add a URL and credentials to connect.');
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
            <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 28px' }}>
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

                {err && <div style={{ marginBottom: 14 }}><ErrorNote message={err} /></div>}
                {msg && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#6ee7b7', fontSize: 13 }}>{msg}</div>}

                <Card>
                    <Toggle label="Enable tracking" hint="Injects the tracker on your live published site." checked={enabled} onChange={setEnabled} />
                    <Field label="Umami URL" hint="Public URL of your Umami instance, e.g. https://stats.your-domain.com. The visitor's browser loads the tracker from here.">
                        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://stats.example.com" style={inputStyle} />
                    </Field>

                    <div style={{ margin: '6px 0 14px' }}>
                        <label style={labelStyle}>Consent mode</label>
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            <ModeChip active={consentMode === 'cookieless'} onClick={() => setConsentMode('cookieless')} title="Cookieless" desc="No cookies, no consent banner needed" />
                            <ModeChip active={consentMode === 'cookies'} onClick={() => setConsentMode('cookies')} title="Cookies" desc="Loads only after the visitor accepts cookies" />
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--text-muted, #777)', margin: '6px 0 0' }}>
                            In “Cookies” mode nothing is counted until a visitor presses Accept — including your own test visits.
                        </p>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-default, rgba(255,255,255,0.08))', margin: '8px 0 14px', paddingTop: 14 }}>
                        <p style={sectionLabelStyle}>Credentials {settings?.configured ? '(stored — leave blank to keep)' : ''}</p>
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

                <div style={{ marginTop: 14 }}>
                    <TrackerCard tracker={tracker} onChange={patchTracker} onSave={save} saving={saving} />
                </div>
                <div style={{ marginTop: 14 }}>
                    <RecorderCard recorder={recorder} maskLevels={settings?.maskLevels} onChange={patchRecorder} />
                </div>
                <div style={{ marginTop: 14 }}><DiagnoseCard /></div>
                <div style={{ marginTop: 14 }}><ConnectionCard configured={settings?.configured} /></div>
                <div style={{ marginTop: 14 }}><SitesCard sites={sites} onChanged={onSitesChanged} /></div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14, alignItems: 'flex-start', color: 'var(--text-muted, #888)', fontSize: 12 }}>
                    <Globe style={{ width: 14, height: 14, marginTop: 1, flexShrink: 0 }} />
                    <span>A Umami "website" is created automatically per CMS site the first time you publish it (or save here while a site is live).</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Tracker options mirrored onto the public <script> tag.
 *
 * Notably absent: a switch for web vitals. They are cookieless browser timings
 * riding along with a pageview already being sent under the same consent
 * decision — and making them optional is exactly how they ended up switched off
 * and unnoticed for the entire life of the feature.
 */
function TrackerCard({ tracker, onChange }) {
    return (
        <Card title="What the tracker records">
            <Field label="Environment tag" hint="Optional label attached to every event, so you can tell staging from production in the same Umami instance.">
                <input value={tracker.tag || ''} onChange={(e) => onChange('tag', e.target.value)}
                    placeholder="production" style={inputStyle} />
            </Field>
            <Field label="Only track these domains" hint="Comma-separated hostnames. Leave blank to track wherever the site is served. Useful to stop a staging copy polluting your numbers.">
                <input value={tracker.domains || ''} onChange={(e) => onChange('domains', e.target.value)}
                    placeholder="www.example.com, example.com" style={inputStyle} />
            </Field>
            <Toggle label="Drop #anchors from URLs"
                hint="On by default — otherwise /pricing#plans and /pricing count as two different pages."
                checked={tracker.excludeHash !== false} onChange={(v) => onChange('excludeHash', v)} />
            <Toggle label="Drop ?query strings from URLs"
                hint="Stronger privacy and tidier reports, but you lose UTM campaign attribution. Off by default for that reason."
                checked={!!tracker.excludeSearch} onChange={(v) => onChange('excludeSearch', v)} />
            <Toggle label="Honour Do Not Track"
                hint="Skip visitors whose browser sends a DNT header. They then appear nowhere in your numbers."
                checked={!!tracker.doNotTrack} onChange={(v) => onChange('doNotTrack', v)} />
            <p style={{ fontSize: 11, color: 'var(--text-muted, #777)', margin: '2px 0 0' }}>
                Saved with the button above. Changes apply on a visitor&apos;s next page load — no republish needed.
                Core Web Vitals are always collected: they are browser timings only, carried by the same request as
                the pageview.
            </p>
        </Card>
    );
}

/** Sampling and masking for the session recorder. */
function RecorderCard({ recorder, maskLevels = ['strict', 'moderate'], onChange }) {
    const rate = Number(recorder.sampleRate ?? 1);
    return (
        <Card title="Session recording quality">
            <Field label={`Record ${Math.round(rate * 100)}% of consenting sessions`}
                hint="Umami's own default is 15%, which on a marketing site means most real visits are never recorded and the heatmap looks broken. 100% is the right answer until you have real volume.">
                <input type="range" min="0.05" max="1" step="0.05" value={rate}
                    onChange={(e) => onChange('sampleRate', Number(e.target.value))}
                    style={{ width: '100%', marginTop: 6, accentColor: ACCENT }} />
            </Field>
            <div style={{ marginBottom: 6 }}>
                <label style={labelStyle}>Input masking</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    {maskLevels.map(l => (
                        <ModeChip key={l} active={(recorder.maskLevel || 'strict') === l}
                            onClick={() => onChange('maskLevel', l)}
                            title={l === 'strict' ? 'Strict' : 'Moderate'}
                            desc={l === 'strict' ? 'Mask all text input'
                                : 'Mask passwords and marked fields'} />
                    ))}
                </div>
                {recorder.maskLevel === 'moderate' && (
                    <p style={{ fontSize: 11, color: '#fcd34d', margin: '6px 0 0' }}>
                        Moderate masking records what visitors type into unmarked fields, which can include personal
                        data. Strict is the safer default for a privacy-first product.
                    </p>
                )}
            </div>
        </Card>
    );
}

/**
 * End-to-end diagnostic.
 *
 * Every failure mode on this integration presents identically — an empty
 * dashboard — so this walks the chain in causal order and names the first thing
 * that is actually broken.
 */
function DiagnoseCard() {
    const [state, setState] = useState({ checks: null, loading: false, error: null });

    const run = useCallback(async () => {
        setState({ checks: null, loading: true, error: null });
        try {
            const data = await analyticsFetch(analyticsApi.diagnose());
            setState({ checks: data.checks || [], loading: false, error: null });
        } catch (e) {
            setState({ checks: null, loading: false, error: e.message });
        }
    }, []);

    return (
        <Card title="Diagnose" action={
            <button onClick={run} disabled={state.loading} style={secondaryBtnStyle}>
                {state.loading ? 'Checking…' : 'Run checks'}
            </button>
        }>
            {state.error ? <ErrorNote message={state.error} onRetry={run} compact />
                : !state.checks ? (
                    <p style={{ fontSize: 12, color: 'var(--text-muted, #888)', margin: 0 }}>
                        Checks the whole chain — switch, credentials, reachability, the script your visitors actually
                        load, site registration and consent — and stops at the first thing that is broken.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {state.checks.map(c => <CheckRow key={c.id} check={c} />)}
                    </div>
                )}
        </Card>
    );
}

const CHECK_STYLE = {
    pass: { color: '#10b981', mark: '✓' },
    warn: { color: '#f59e0b', mark: '!' },
    fail: { color: '#ef4444', mark: '✕' },
    skip: { color: 'var(--text-muted, #777)', mark: '–' },
    info: { color: 'var(--text-muted, #888)', mark: 'i' },
};

function CheckRow({ check }) {
    const s = CHECK_STYLE[check.status] || CHECK_STYLE.info;
    return (
        <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <span style={{
                width: 17, height: 17, borderRadius: 5, flexShrink: 0, marginTop: 1,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 800, background: `${s.color}1f`, color: s.color,
            }}>{s.mark}</span>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-primary, #fff)' }}>{check.label}</div>
                {check.detail && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', wordBreak: 'break-word' }}>
                        {check.detail}
                    </div>
                )}
            </div>
        </div>
    );
}

/** Reachability + the internal/public URL split. */
function ConnectionCard({ configured }) {
    const [state, setState] = useState({ data: null, loading: true, error: null });

    const check = useCallback(async () => {
        setState(s => ({ ...s, loading: true, error: null }));
        try {
            const data = await analyticsFetch(analyticsApi.status());
            setState({ data, loading: false, error: null });
        } catch (e) {
            setState({ data: null, loading: false, error: e.message });
        }
    }, []);

    useEffect(() => { check(); }, [check]);

    const d = state.data;
    return (
        <Card title="Connection">
            {state.loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted, #888)' }}>
                    <Loader2 className="w-4 h-4 animate-spin" /> Checking…
                </div>
            ) : state.error ? (
                <ErrorNote message={state.error} onRetry={check} compact />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                    <Row label="Status" value={
                        d?.reachable
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#10b981', fontWeight: 700 }}>
                                <CheckCircle2 style={{ width: 13, height: 13 }} /> Connected · {d.websiteCount} website{d.websiteCount === 1 ? '' : 's'}
                              </span>
                            : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: configured ? '#ef4444' : 'var(--text-muted, #888)', fontWeight: 700 }}>
                                <XCircle style={{ width: 13, height: 13 }} /> {configured ? 'Not reachable' : 'Not configured'}
                              </span>
                    } />
                    <Row label="Public URL (browser)" value={d?.publicUrl || '—'} mono />
                    <Row label="Server URL (internal)" value={d?.internalUrl || '—'} mono />
                    {d?.error && <ErrorNote message={d.error} onRetry={check} compact />}
                    {d?.usingInternalOverride && (
                        <p style={{ fontSize: 11, color: 'var(--text-muted, #777)', margin: 0 }}>
                            UMAMI_URL is set on the server, so stats are fetched over the internal address while visitors
                            load the tracker from the public one. These are meant to differ — if you point the internal
                            one at localhost the server will try to call itself and every panel will fail.
                        </p>
                    )}
                    <button onClick={check} style={{ ...secondaryBtnStyle, alignSelf: 'flex-start' }}>Test again</button>
                </div>
            )}
        </Card>
    );
}

/** Per-site tracking state + the session-recording opt-in. */
function SitesCard({ sites, onChanged }) {
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState(null);

    const toggleRecording = async (site, next) => {
        setBusyId(site.id); setError(null);
        try {
            const res = await analyticsFetch(analyticsApi.recorder(), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ siteId: site.id, enabled: next }),
            });
            if (res?.upstreamWarning) {
                setError(`Saved, but Umami did not accept the recorder flag: ${res.upstreamWarning}`);
            }
            onChanged?.();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusyId(null);
        }
    };

    const tracked = sites.filter(s => s.tracked);

    return (
        <Card title="Sites">
            {error && <div style={{ marginBottom: 10 }}><ErrorNote message={error} compact /></div>}
            {tracked.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted, #888)', margin: 0 }}>
                    No site is tracked yet. Publish a CMS site while tracking is enabled and it will appear here.
                </p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {tracked.map(site => (
                        <div key={site.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                            padding: '10px 12px', borderRadius: 10,
                            background: 'var(--bg-tertiary, rgba(255,255,255,0.03))',
                        }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
                                    {site.name}{site.live ? <span style={{ color: ACCENT, fontWeight: 600 }}> · live</span> : null}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted, #777)', fontFamily: 'ui-monospace, monospace' }}>
                                    {site.websiteId || '—'}
                                </div>
                            </div>
                            <button
                                onClick={() => toggleRecording(site, !site.recording)}
                                disabled={busyId === site.id}
                                aria-pressed={!!site.recording}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                                    padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                                    background: site.recording ? `${ACCENT}18` : 'transparent',
                                    border: `1px solid ${site.recording ? `${ACCENT}66` : 'var(--border-default, rgba(255,255,255,0.12))'}`,
                                    color: site.recording ? ACCENT : 'var(--text-secondary, #aaa)',
                                }}
                            >
                                {busyId === site.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Video style={{ width: 13, height: 13 }} />}
                                {site.recording ? 'Recording on' : 'Record sessions'}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-start', fontSize: 11, color: 'var(--text-muted, #888)' }}>
                <ShieldAlert style={{ width: 14, height: 14, marginTop: 1, flexShrink: 0, color: '#f59e0b' }} />
                <span>
                    Session recording powers heatmaps and replays. It loads a larger script that captures clicks,
                    scrolling and page structure, so it only ever runs for visitors who accepted your cookie banner —
                    <strong> in every consent mode, including cookieless</strong>. Form inputs are masked. If your cookie
                    banner is disabled, recording can never start.
                </span>
            </div>
        </Card>
    );
}

// ── Small inputs ─────────────────────────────────────────────────────

function Row({ label, value, mono }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: 'var(--text-muted, #888)' }}>{label}</span>
            <span style={{
                color: 'var(--text-primary, #fff)', textAlign: 'right', wordBreak: 'break-all',
                fontFamily: mono ? 'ui-monospace, monospace' : undefined, fontSize: mono ? 11 : undefined,
            }}>{value}</span>
        </div>
    );
}

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
const sectionLabelStyle = {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
    color: 'var(--text-muted, #888)', margin: '0 0 10px',
};
const primaryBtnStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9,
    background: ACCENT, color: '#06241f', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const secondaryBtnStyle = {
    padding: '6px 12px', borderRadius: 8, background: 'transparent',
    border: '1px solid var(--border-default, rgba(255,255,255,0.12))',
    color: 'var(--text-secondary, #aaa)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
};
