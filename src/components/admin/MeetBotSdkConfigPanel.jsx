import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { Loader2, Check, Video, Shield, ExternalLink } from 'lucide-react';

/**
 * Admin panel for Meet Bot SDK providers.
 *
 * Currently exposes Microsoft Teams via Azure Communication Services (ACS)
 * Call Automation. The Google Meet Media API backend is implemented server-
 * side but not surfaced in the UI — it requires Developer Preview Program
 * enrolment and an in-browser join flow, which isn't viable for a purely
 * headless bot yet. Dispatcher still prefers the SDK provider automatically
 * once it becomes configured, so surfacing the UI later is enough to flip on.
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
                        Configure <strong>Microsoft Teams</strong> via Azure Communication Services (Call Automation). When configured, the bot joins meetings via the
                        official media API instead of the Playwright browser path — more reliable, no bot password needed.
                        Google Meet currently falls back to the browser-based provider (bot account credentials are configured on the Meeting Notes page).
                    </p>
                </div>

                {message && (
                    <div className="rounded-xl px-4 py-3 text-sm" style={{
                        background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: message.type === 'success' ? '#10b981' : '#ef4444',
                    }}>{message.text}</div>
                )}

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
