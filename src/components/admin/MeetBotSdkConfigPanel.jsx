import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { Loader2, Check, Video, Zap, Shield, ExternalLink } from 'lucide-react';

/**
 * Admin panel for Meet Bot SDK providers:
 *   - Microsoft Teams via Azure Communication Services (ACS) Call Automation
 *   - Google Meet via the Meet Media API v2beta + service-account DWD
 *
 * Both providers bypass the Playwright browser path and join meetings
 * through the official vendor media APIs. When configured here, the
 * dispatcher in server/core/meetBot.js prefers them over their browser
 * counterparts automatically.
 */
export default function MeetBotSdkConfigPanel() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    // Teams / ACS
    const [acsConfigured, setAcsConfigured] = useState(false);
    const [acsConnectionString, setAcsConnectionString] = useState('');
    const [callbackBaseUrl, setCallbackBaseUrl] = useState('');
    const [callbackBaseUrlFromEnv, setCallbackBaseUrlFromEnv] = useState(null);
    const [callbackSecretConfigured, setCallbackSecretConfigured] = useState(false);
    const [callbackSecret, setCallbackSecret] = useState('');

    // Google Meet SDK (OAuth user flow)
    const [gmClientConfigured, setGmClientConfigured] = useState(false);
    const [gmClientIdPreview, setGmClientIdPreview] = useState(null);
    const [gmAuthorized, setGmAuthorized] = useState(false);
    const [gmAuthorizedEmail, setGmAuthorizedEmail] = useState(null);
    const [gmClientId, setGmClientId] = useState('');
    const [gmClientSecret, setGmClientSecret] = useState('');

    const loadStatus = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/meet-bot/sdk-config`);
            if (res.ok) {
                const data = await res.json();
                setAcsConfigured(!!data?.teams?.acsConfigured);
                setCallbackBaseUrl(data?.teams?.callbackBaseUrl || '');
                setCallbackBaseUrlFromEnv(data?.teams?.callbackBaseUrlFromEnv || null);
                setCallbackSecretConfigured(!!data?.teams?.callbackSecretConfigured);

                setGmClientConfigured(!!data?.googleMeet?.clientConfigured);
                setGmClientIdPreview(data?.googleMeet?.clientIdPreview || null);
                setGmAuthorized(!!data?.googleMeet?.authorized);
                setGmAuthorizedEmail(data?.googleMeet?.authorizedEmail || null);
            } else {
                setMessage({ type: 'error', text: 'Failed to load SDK config (admin required).' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: e.message });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadStatus(); }, [loadStatus]);

    const flash = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4000);
    };

    const saveTeams = async ({ clear = false } = {}) => {
        setSaving(true);
        try {
            const body = {};
            if (clear) {
                body.clearAcsConnectionString = true;
            } else if (acsConnectionString.trim()) {
                body.acsConnectionString = acsConnectionString.trim();
            }
            if (callbackBaseUrl.trim() || callbackBaseUrl === '') body.callbackBaseUrl = callbackBaseUrl;
            if (callbackSecret.trim()) body.callbackSecret = callbackSecret.trim();

            const res = await authFetch(`${API_BASE}/api/meet-bot/sdk-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            setAcsConnectionString('');
            setCallbackSecret('');
            await loadStatus();
            flash('success', clear ? 'Teams ACS connection cleared.' : 'Teams SDK settings saved.');
        } catch (e) {
            flash('error', `Save failed: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const saveGoogle = async ({ clearAll = false, revokeOnly = false } = {}) => {
        setSaving(true);
        try {
            const body = {};
            if (clearAll) {
                body.clearGoogleMeetOAuthClient = true;
            } else if (revokeOnly) {
                body.clearGoogleMeetRefreshToken = true;
            } else {
                if (gmClientId.trim()) body.googleMeetOAuthClientId = gmClientId.trim();
                if (gmClientSecret.trim()) body.googleMeetOAuthClientSecret = gmClientSecret.trim();
            }

            const res = await authFetch(`${API_BASE}/api/meet-bot/sdk-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            setGmClientId('');
            setGmClientSecret('');
            await loadStatus();
            flash('success',
                clearAll ? 'Google Meet OAuth client cleared.' :
                revokeOnly ? 'Google Meet authorisation revoked. Re-authorise to continue using the SDK provider.' :
                'Google Meet OAuth client saved. Click "Authorize with Google" to complete setup.'
            );
        } catch (e) {
            flash('error', `Save failed: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const startGoogleAuth = () => {
        // Full-page redirect so Google's consent screen can set cookies on the
        // top-level origin. Opening in a popup sometimes breaks with 3P-cookie
        // policies.
        window.location.href = `${API_BASE}/api/meet-bot/google-oauth/start`;
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent-primary)' }} />
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Video className="w-5 h-5" style={{ color: '#10b981' }} />
                        Meeting Bot (SDK Providers)
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        Configure <strong>Microsoft Teams</strong> (Azure Communication Services Call Automation) and <strong>Google Meet</strong> (Meet Media API) SDK
                        providers. When configured, the bot joins meetings via the official media APIs instead of the Playwright browser path —
                        more reliable, no bot password needed, no UI flakiness.
                    </p>
                </div>

                {message && (
                    <div className="rounded-xl px-4 py-3 text-sm" style={{
                        background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: message.type === 'success' ? '#10b981' : '#ef4444',
                    }}>{message.text}</div>
                )}

                {/* ── Google Meet SDK (OAuth user flow) ─────────────────── */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div>
                            <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <Zap className="w-4 h-4" style={{ color: '#1a73e8' }} />
                                Google Meet (Media API v2beta)
                                {gmClientConfigured && gmAuthorized && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Configured</span>
                                )}
                                {gmClientConfigured && !gmAuthorized && (
                                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>Needs authorisation</span>
                                )}
                            </h3>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                Uses OAuth 2.0 <strong>user credentials</strong> (not a service account — the Meet Media scope isn't DWD-compatible).
                                Authorise once as a dedicated bot account; the refresh token is stored and reused to mint access tokens on each join.
                            </p>
                        </div>
                    </div>

                    <div className="p-6 space-y-5">
                        <div className="rounded-lg border p-4 text-xs space-y-1" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
                            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Setup checklist</p>
                            <p>1. Enable <strong>Google Meet API</strong> + <strong>Google Meet Media API</strong> in Google Cloud Console.</p>
                            <p>2. OAuth consent screen → user type <strong>Internal</strong>. Add scopes:</p>
                            <pre className="mt-1 p-2 rounded text-[11px] whitespace-pre-wrap" style={{ background: 'var(--bg-secondary)' }}>
{`https://www.googleapis.com/auth/meetings.space.readonly
https://www.googleapis.com/auth/meetings.conference.media.readonly`}
                            </pre>
                            <p>3. Create an OAuth <strong>Client ID</strong> (type: Web application). Add this server's callback URL as an authorised redirect URI:</p>
                            <pre className="mt-1 p-2 rounded text-[11px] break-all" style={{ background: 'var(--bg-secondary)' }}>
{`${(typeof window !== 'undefined' ? window.location.origin : '')}/api/meet-bot/google-oauth/callback`}
                            </pre>
                            <p>4. Enable the Meet <strong>Media API</strong> in Workspace Admin → Apps → Google Workspace → Google Meet → Meet safety settings.</p>
                            <p>5. Paste client ID + secret below, then click "Authorize with Google" while signed in as the bot account.</p>
                            <a
                                href="https://developers.google.com/meet/media-api/guides/overview"
                                target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 mt-2"
                                style={{ color: 'var(--accent-primary)' }}
                            >
                                Meet Media API docs <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>

                        <div>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-primary)' }}>OAuth Client ID</label>
                            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                                {gmClientConfigured
                                    ? <>Currently saved: <strong style={{ color: 'var(--text-primary)' }}>{gmClientIdPreview || '(stored)'}</strong>. Paste a new value to replace it.</>
                                    : 'Ends with .apps.googleusercontent.com'}
                            </p>
                            <input
                                type="text"
                                value={gmClientId}
                                onChange={(e) => setGmClientId(e.target.value)}
                                placeholder="1234567890-abc123.apps.googleusercontent.com"
                                className="w-full px-3 py-2 rounded-lg text-sm font-mono border outline-none focus:ring-2"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-primary)' }}>OAuth Client Secret</label>
                            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                                {gmClientConfigured ? 'A client secret is currently saved. Paste a new value to rotate it.' : 'From the OAuth 2.0 client credentials page.'}
                            </p>
                            <input
                                type="password"
                                value={gmClientSecret}
                                onChange={(e) => setGmClientSecret(e.target.value)}
                                placeholder="GOCSPX-…"
                                className="w-full max-w-md px-3 py-2 rounded-lg text-sm font-mono border outline-none focus:ring-2"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2">
                            <button
                                onClick={() => saveGoogle()}
                                disabled={saving || (!gmClientId.trim() && !gmClientSecret.trim())}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                                style={{ background: 'linear-gradient(135deg, #1a73e8, #4285f4)' }}
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Save OAuth client
                            </button>
                            <button
                                onClick={startGoogleAuth}
                                disabled={saving || !gmClientConfigured}
                                title={!gmClientConfigured ? 'Save client ID + secret first' : undefined}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                                style={{ border: '1px solid var(--border-default)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}
                            >
                                <ExternalLink className="w-4 h-4" />
                                {gmAuthorized ? 'Re-authorize with Google' : 'Authorize with Google'}
                            </button>
                            {gmAuthorized && gmAuthorizedEmail && (
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    Authorised as <strong style={{ color: 'var(--text-primary)' }}>{gmAuthorizedEmail}</strong>
                                </span>
                            )}
                            {gmAuthorized && (
                                <button
                                    onClick={() => saveGoogle({ revokeOnly: true })}
                                    disabled={saving}
                                    className="px-3 py-2 rounded-lg text-xs border transition-all hover:bg-red-500/10"
                                    style={{ borderColor: 'var(--border-default)', color: '#ef4444' }}
                                >
                                    Revoke authorisation
                                </button>
                            )}
                            {gmClientConfigured && (
                                <button
                                    onClick={() => saveGoogle({ clearAll: true })}
                                    disabled={saving}
                                    className="px-3 py-2 rounded-lg text-xs border transition-all hover:bg-red-500/10"
                                    style={{ borderColor: 'var(--border-default)', color: '#ef4444' }}
                                >
                                    Clear OAuth client
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Teams ACS / Call Automation ────────────────────────── */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div>
                            <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <Shield className="w-4 h-4" style={{ color: '#6264A7' }} />
                                Microsoft Teams (ACS Call Automation)
                                {acsConfigured && callbackSecretConfigured && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Configured</span>
                                )}
                            </h3>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                Uses Azure Communication Services Call Automation to join Teams meetings via the meeting-URL flow. Requires an
                                ACS resource and a public HTTPS callback endpoint.
                            </p>
                        </div>
                    </div>

                    <div className="p-6 space-y-5">
                        <div className="rounded-lg border p-4 text-xs space-y-1" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
                            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Setup checklist</p>
                            <p>1. Create an Azure Communication Services resource; copy the connection string.</p>
                            <p>2. Expose this server on a public HTTPS URL that ACS can reach (for callbacks).</p>
                            <p>3. Generate a strong random secret used to sign callback URLs.</p>
                            <a
                                href="https://learn.microsoft.com/azure/communication-services/concepts/call-automation/call-automation"
                                target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 mt-2"
                                style={{ color: 'var(--accent-primary)' }}
                            >
                                ACS Call Automation docs <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>

                        <div>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-primary)' }}>ACS Connection String</label>
                            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                                {acsConfigured ? 'A connection string is currently saved. Paste a new one to replace it.' : 'Starts with endpoint=https://…'}
                            </p>
                            <input
                                type="password"
                                value={acsConnectionString}
                                onChange={(e) => setAcsConnectionString(e.target.value)}
                                placeholder="endpoint=https://<resource>.communication.azure.com/;accesskey=…"
                                className="w-full px-3 py-2 rounded-lg text-sm font-mono border outline-none focus:ring-2"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-primary)' }}>Public callback base URL</label>
                            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                                Public HTTPS URL of this server. ACS will POST call events to <code>&lt;base&gt;/api/teams-sdk/callback</code>.
                                {callbackBaseUrlFromEnv && !callbackBaseUrl && <> Falls back to env <code>SERVER_BASE_URL</code>: <strong>{callbackBaseUrlFromEnv}</strong></>}
                            </p>
                            <input
                                type="url"
                                value={callbackBaseUrl}
                                onChange={(e) => setCallbackBaseUrl(e.target.value)}
                                placeholder="https://yourdomain.example.com"
                                className="w-full max-w-md px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-primary)' }}>Callback signing secret</label>
                            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                                {callbackSecretConfigured ? 'A signing secret is currently saved. Enter a new value to rotate it.' : 'Pick a random string (≥ 32 chars). Used to verify callbacks originated from us.'}
                            </p>
                            <input
                                type="password"
                                value={callbackSecret}
                                onChange={(e) => setCallbackSecret(e.target.value)}
                                placeholder="random signing secret"
                                className="w-full max-w-md px-3 py-2 rounded-lg text-sm font-mono border outline-none focus:ring-2"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <button
                                onClick={() => saveTeams()}
                                disabled={saving}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                                style={{ background: 'linear-gradient(135deg, #6264A7, #4b4fb3)' }}
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Save Teams SDK
                            </button>
                            {acsConfigured && (
                                <button
                                    onClick={() => saveTeams({ clear: true })}
                                    disabled={saving}
                                    className="px-3 py-2 rounded-lg text-xs border transition-all hover:bg-red-500/10"
                                    style={{ borderColor: 'var(--border-default)', color: '#ef4444' }}
                                >
                                    Clear ACS connection
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
