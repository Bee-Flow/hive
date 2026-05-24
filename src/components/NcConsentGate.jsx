import React, { useState } from 'react';
import { Shield, ExternalLink, Loader2 } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';

/**
 * First-load privacy disclosure modal for Nextcloud App Store users.
 *
 * Shown ONCE per NC user, before the wizard / chat. Required by App Store
 * reviewers so end-users see a clear data-flow disclosure at the point of
 * consent — not buried in a settings page they may never visit.
 *
 * Acceptance writes a `nc_consent_at` timestamp to the user record. The
 * server-side render-gate suppresses this component on subsequent loads
 * unless the consent text version changes (CONSENT_VERSION below).
 */

const CONSENT_VERSION = '2026-05-09';

const NcConsentGate = ({ user, onAccept }) => {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const accept = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/auth/nc-consent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version: CONSENT_VERSION }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            onAccept?.();
        } catch (e) {
            setError(e.message || 'Could not save your choice — please try again.');
        } finally { setSubmitting(false); }
    };

    return (
        <div
            className="h-screen flex items-center justify-center p-4"
            style={{ background: 'linear-gradient(160deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%)' }}
        >
            <div className="w-full max-w-lg">
                <div
                    className="rounded-3xl p-8 shadow-2xl border"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
                >
                    <div className="flex items-center gap-3 mb-5">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(0, 130, 201, 0.12)' }}
                        >
                            <Shield className="w-6 h-6" style={{ color: '#0082C9' }} />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Welcome to Bee Flow
                            </h1>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                A quick word about your data before we start.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3 mb-6 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        <p>
                            Bee Flow runs as an embedded app inside your Nextcloud and connects you
                            to a hosted AI assistant. To answer your questions, the assistant can
                            read or update items <strong>you explicitly ask it to</strong> —
                            for example, summarising an email you point at, or creating a calendar
                            event you describe.
                        </p>
                        <p>
                            What is sent to the Bee Flow service:
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Your Nextcloud user ID, email, and display name (for tenant identification).</li>
                            <li>Group memberships (so admins can configure access per group).</li>
                            <li>The contents of items the assistant fetches on your behalf — only at the moment of fetching, not in bulk.</li>
                        </ul>
                        <p>
                            Bee Flow does <strong>not</strong> bulk-export your files, mail,
                            calendar, or contacts. Sensitive content is redacted by the privacy
                            shield before reaching the model. You can revoke access anytime by
                            disabling the app in Nextcloud.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 text-[12px]">
                        <a
                            href="https://beeflow.nl/privacy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                            style={{ color: 'var(--accent-primary)' }}
                        >
                            Privacy policy <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                            href="https://beeflow.nl/terms"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                            style={{ color: 'var(--accent-primary)' }}
                        >
                            Terms <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>

                    {error && (
                        <p className="mb-4 text-sm text-red-500">{error}</p>
                    )}

                    <button
                        type="button"
                        onClick={accept}
                        disabled={submitting}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        I agree — start Bee Flow
                    </button>

                    <p className="mt-3 text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>
                        Logged in as <strong>{user?.displayName || user?.email}</strong>.
                        Your acceptance is recorded so you won't see this again.
                    </p>
                </div>
            </div>
        </div>
    );
};

export { CONSENT_VERSION };
export default NcConsentGate;
