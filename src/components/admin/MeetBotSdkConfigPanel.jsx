import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { Loader2, Check, Video, Shield, ExternalLink, AlertCircle } from 'lucide-react';

/**
 * Admin panel for Meet Bot SDK providers.
 *
 * Teams uses the Microsoft Graph native post-meeting path: no bot joins the
 * meeting, no browser, no media stack. Instead Beeflow fetches the server-
 * side transcript/recording Teams produces after the meeting ends, via the
 * organiser's delegated OAuth token. Requires three extra scopes that need
 * tenant admin consent — this panel provides the consent deep link.
 */
export default function MeetBotSdkConfigPanel() {
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState(null);
    const [message, setMessage] = useState(null);

    const loadStatus = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/meet-bot/sdk-config`);
            if (res.ok) {
                setStatus(await res.json());
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

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent-primary)' }} />
            </div>
        );
    }

    const teams = status?.teams || {};
    const canShowConsent = teams.microsoftOAuthEnabled && teams.adminConsentUrl;

    return (
        <div className="p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Video className="w-5 h-5" style={{ color: '#10b981' }} />
                        Meeting Bot (SDK Providers)
                    </h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        Teams uses the <strong>Microsoft Graph native path</strong> — Beeflow reads the transcript and recording Teams produces server-side, after the meeting ends. No bot joins the meeting, no browser, no media stack.
                    </p>
                </div>

                {message && (
                    <div className="rounded-xl px-4 py-3 text-sm" style={{
                        background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: message.type === 'success' ? '#10b981' : '#ef4444',
                    }}>{message.text}</div>
                )}

                {/* ── Teams (Graph Native) ────────────────────────── */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div>
                            <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                                <Shield className="w-4 h-4" style={{ color: '#6264A7' }} />
                                Microsoft Teams (Graph Native)
                                {teams.microsoftOAuthEnabled && teams.currentUserConnected && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Your account connected</span>
                                )}
                            </h3>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                Reads native Teams transcripts via the Microsoft Graph <code>/me/onlineMeetings/&#123;id&#125;/transcripts</code> endpoint. Only works for meetings the signed-in user organised.
                            </p>
                        </div>
                    </div>

                    <div className="p-6 space-y-5">
                        {/* Prerequisites */}
                        <div className="rounded-lg border p-4 text-xs space-y-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
                            <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Prerequisites — all four must hold for a meeting to ingest</p>
                            <div className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>1.</span>
                                <div>Microsoft OAuth provider enabled in <em>Authentication → Providers</em>.{' '}
                                    <strong style={{ color: teams.microsoftOAuthEnabled ? '#10b981' : '#ef4444' }}>{teams.microsoftOAuthEnabled ? '✓ Enabled' : '✗ Disabled'}</strong>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>2.</span>
                                <div>Tenant admin has consented to the Beeflow app for the three meeting scopes (<code>OnlineMeetings.Read</code>, <code>OnlineMeetingTranscript.Read.All</code>, <code>OnlineMeetingArtifact.Read.All</code>). Use the button below.</div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>3.</span>
                                <div>The meeting is <strong>scheduled</strong> via Outlook/Teams calendar (ad-hoc "Meet now" calls aren't exposed through Graph).</div>
                            </div>
                            <div className="flex items-start gap-2">
                                <span style={{ color: 'var(--accent-primary)' }}>4.</span>
                                <div>The host clicks <strong>Start recording</strong> in Teams (mandatory) and ideally <strong>Start transcription</strong> (for the native WebVTT path — otherwise Beeflow transcribes the mp4 via Whisper/Voxtral).</div>
                            </div>
                        </div>

                        {/* Status readout */}
                        <div className="rounded-lg border p-4 text-xs" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                            <p className="font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Current status</p>
                            <div className="space-y-1" style={{ color: 'var(--text-secondary)' }}>
                                <div><span style={{ color: 'var(--text-muted)' }}>Tenant ID:</span> <code>{teams.tenantId || '—'}</code></div>
                                <div><span style={{ color: 'var(--text-muted)' }}>Azure AD Client ID:</span> <code>{teams.clientId ? `${teams.clientId.slice(0, 8)}…` : '—'}</code></div>
                                <div><span style={{ color: 'var(--text-muted)' }}>Your Microsoft connection:</span>{' '}
                                    <strong style={{ color: teams.currentUserConnected ? '#10b981' : '#ef4444' }}>
                                        {teams.currentUserConnected ? `✓ ${teams.currentUserEmail || 'connected'}` : '✗ not connected'}
                                    </strong>
                                </div>
                            </div>
                        </div>

                        {/* Admin consent button */}
                        {canShowConsent ? (
                            <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                <p className="font-medium text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Grant tenant admin consent</p>
                                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                                    Send this link to a Microsoft 365 Global Administrator in the target tenant. It authorises Beeflow to read online meeting transcripts and recordings for every user in that tenant. One-time step per tenant.
                                </p>
                                <div className="flex items-center gap-2">
                                    <a
                                        href={teams.adminConsentUrl}
                                        target="_blank" rel="noreferrer"
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        style={{ background: 'linear-gradient(135deg, #6264A7, #4b4fb3)' }}
                                    >
                                        <Shield className="w-4 h-4" />
                                        Open admin consent flow
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                    <button
                                        onClick={() => { navigator.clipboard?.writeText(teams.adminConsentUrl); setMessage({ type: 'success', text: 'Admin consent URL copied to clipboard.' }); setTimeout(() => setMessage(null), 3000); }}
                                        className="px-3 py-2 rounded-lg text-xs border transition-all hover:bg-white/5"
                                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                                    >
                                        Copy link
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-lg border p-4 text-sm flex items-start gap-2" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444' }}>
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <div>
                                    Microsoft OAuth provider isn't configured yet. Go to <em>Authentication → Providers</em>, fill in the Azure AD app's Client ID, Secret, and Tenant, then come back to grant admin consent.
                                </div>
                            </div>
                        )}

                        {/* Reconnect hint */}
                        <div className="rounded-lg border p-4 text-xs" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                            <p style={{ color: 'var(--text-primary)' }} className="font-medium mb-1">Already connected before we added meeting scopes?</p>
                            <p>Sign out and sign back in with Microsoft to refresh your access token with the new transcript permissions.</p>
                        </div>

                        <div className="pt-2">
                            <button
                                onClick={loadStatus}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all hover:bg-white/5"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                            >
                                <Check className="w-3 h-3" />
                                Refresh status
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
