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

    // Google Meet SDK
    const [gmServiceAccountConfigured, setGmServiceAccountConfigured] = useState(false);
    const [gmServiceAccountEmail, setGmServiceAccountEmail] = useState(null);
    const [gmServiceAccountKey, setGmServiceAccountKey] = useState('');
    const [gmImpersonationUser, setGmImpersonationUser] = useState('');

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

                setGmServiceAccountConfigured(!!data?.googleMeet?.serviceAccountConfigured);
                setGmServiceAccountEmail(data?.googleMeet?.serviceAccountEmail || null);
                setGmImpersonationUser(data?.googleMeet?.impersonationUser || '');
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

    const saveGoogle = async ({ clear = false } = {}) => {
        setSaving(true);
        try {
            const body = {};
            if (clear) {
                body.clearGoogleMeetServiceAccountKey = true;
            } else if (gmServiceAccountKey.trim()) {
                body.googleMeetServiceAccountKey = gmServiceAccountKey.trim();
            }
            if (gmImpersonationUser || gmImpersonationUser === '') {
                body.googleMeetImpersonationUser = gmImpersonationUser.trim();
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
            setGmServiceAccountKey('');
            await loadStatus();
            flash('success', clear ? 'Google Meet service account cleared.' : 'Google Meet SDK settings saved.');
        } catch (e) {
            flash('error', `Save failed: ${e.message}`);
        } finally {
            setSaving(false);
        }
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

                {/* ── Google Meet SDK ───────────────────────────────────── */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div>
                            <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <Zap className="w-4 h-4" style={{ color: '#1a73e8' }} />
                                Google Meet (Media API v2beta)
                                {gmServiceAccountConfigured && gmImpersonationUser && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Configured</span>
                                )}
                            </h3>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                Uses a Google Cloud service account with <strong>domain-wide delegation</strong> to impersonate a Workspace user and join active conferences
                                via the Meet Media API. No browser, no bot password.
                            </p>
                        </div>
                    </div>

                    <div className="p-6 space-y-5">
                        <div className="rounded-lg border p-4 text-xs space-y-1" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
                            <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Setup checklist</p>
                            <p>1. Enable <strong>Google Meet API</strong> and <strong>Google Meet Media API</strong> in Google Cloud Console.</p>
                            <p>2. Create a service account and generate a JSON key.</p>
                            <p>3. In the Google Workspace Admin console, grant the service account <strong>domain-wide delegation</strong> for these scopes:</p>
                            <pre className="mt-1 p-2 rounded text-[11px] whitespace-pre-wrap" style={{ background: 'var(--bg-secondary)' }}>
{`https://www.googleapis.com/auth/meetings.space.created
https://www.googleapis.com/auth/meetings.space.readonly
https://www.googleapis.com/auth/meetings.conference.media.readonly`}
                            </pre>
                            <p>4. Enable the Meet <strong>Media API</strong> in Workspace → Apps → Google Workspace → Google Meet → Meet safety settings.</p>
                            <p>5. The impersonation user must be a real Workspace user who can be invited to meetings.</p>
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
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-primary)' }}>Service Account JSON key</label>
                            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                                {gmServiceAccountConfigured
                                    ? <>Currently saved: <strong style={{ color: 'var(--text-primary)' }}>{gmServiceAccountEmail || '(key stored)'}</strong>. Paste a new key to replace it.</>
                                    : 'Paste the entire JSON content of the service account key file.'
                                }
                            </p>
                            <textarea
                                value={gmServiceAccountKey}
                                onChange={(e) => setGmServiceAccountKey(e.target.value)}
                                placeholder='{ "type": "service_account", "project_id": "…", "private_key": "…", "client_email": "…" }'
                                rows={6}
                                className="w-full px-3 py-2 rounded-lg text-xs font-mono border outline-none focus:ring-2"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-primary)' }}>Impersonation user (Workspace email)</label>
                            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                                The service account will call the Meet Media API as this user. Pick a dedicated account (e.g. <code>bot@your-workspace.com</code>).
                            </p>
                            <input
                                type="email"
                                value={gmImpersonationUser}
                                onChange={(e) => setGmImpersonationUser(e.target.value)}
                                placeholder="bot@your-workspace.com"
                                className="w-full max-w-md px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <button
                                onClick={() => saveGoogle()}
                                disabled={saving || (!gmServiceAccountKey.trim() && gmImpersonationUser === (gmImpersonationUser || ''))}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                                style={{ background: 'linear-gradient(135deg, #1a73e8, #4285f4)' }}
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Save Google Meet SDK
                            </button>
                            {gmServiceAccountConfigured && (
                                <button
                                    onClick={() => saveGoogle({ clear: true })}
                                    disabled={saving}
                                    className="px-3 py-2 rounded-lg text-xs border transition-all hover:bg-red-500/10"
                                    style={{ borderColor: 'var(--border-default)', color: '#ef4444' }}
                                >
                                    Clear service account key
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
