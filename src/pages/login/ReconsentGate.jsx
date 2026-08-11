import React, { useState } from 'react';
import { ScrollText, Loader2, AlertCircle, BookOpen } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';
import beeFlowLogo from '../../assets/bee-flow-logo.svg';
import LegalDocModal from '../../components/LegalDocModal';

/**
 * Full-screen re-consent gate. Shown (by App.jsx) when the server reports
 * `needsReconsent` — i.e. one or more consent-bound legal documents have been
 * versioned up since this account last accepted them. The only ways out are
 * actively accepting the updated documents (→ onDone) or signing out
 * (→ onLogout); there is intentionally no "skip". Mirrors MfaSetupGate.
 */

const DOC_LABELS = {
    terms: ['signup.consent_tos', 'Terms of Service'],
    privacy: ['signup.consent_privacy', 'Privacy Policy'],
    dpa: ['signup.consent_dpa', 'Data Processing Agreement'],
    aup: ['signup.consent_aup', 'Acceptable Use Policy'],
    connector_terms: ['signup.consent_connector_terms', 'Nextcloud Connector Terms'],
};

export default function ReconsentGate({ docs = [], onDone, onLogout }) {
    const { t } = useTranslation();
    const [accepted, setAccepted] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [viewDoc, setViewDoc] = useState(null);

    const submit = async () => {
        if (!accepted) return;
        setBusy(true);
        setError('');
        try {
            const res = await authFetch(`${API_BASE}/auth/accept-terms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    consent: {
                        accepted: true,
                        acceptedDocs: docs.map(d => ({ docId: d.docId, version: d.version })),
                    },
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Request failed');
            if (onDone) onDone();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(160deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%)' }}>
            <div className="w-full max-w-md">
                <div className="backdrop-blur-xl rounded-3xl p-8 shadow-2xl border relative overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                    <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent" />

                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-11 h-11 rounded-2xl overflow-hidden ring-2 ring-[var(--border-subtle)] flex items-center justify-center bg-[var(--bg-primary)] shrink-0">
                            <img src={beeFlowLogo} alt="Bee Flow" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex items-center gap-2">
                            <ScrollText className="w-5 h-5 text-[var(--accent-primary)]" />
                            <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {t('reconsent.title', 'Our terms have been updated')}
                            </h1>
                        </div>
                    </div>

                    <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                        {t('reconsent.body', 'We have updated our legal terms. Please review and accept the updated documents to continue using Bee Flow.')}
                    </p>

                    <div className="rounded-xl border p-3 mb-5 space-y-1.5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)' }}>
                        <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                            {t('reconsent.review', 'Please review:')}
                        </p>
                        {docs.map((d) => {
                            const [key, fb] = DOC_LABELS[d.docId] || [null, d.docId];
                            const label = key ? t(key, fb) : fb;
                            return (
                                <button key={d.docId} type="button" onClick={() => setViewDoc({ docId: d.docId, title: label })}
                                    className="flex items-center gap-1.5 text-sm underline" style={{ color: 'var(--accent-primary)' }}>
                                    {label}
                                    <BookOpen className="w-3.5 h-3.5" />
                                </button>
                            );
                        })}
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-500 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <label className="flex items-start gap-2.5 cursor-pointer select-none mb-5">
                        <input
                            type="checkbox"
                            checked={accepted}
                            onChange={e => setAccepted(e.target.checked)}
                            className="mt-0.5 w-4 h-4 shrink-0"
                            style={{ accentColor: 'var(--accent-primary)' }}
                        />
                        <span className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {t('reconsent.accept_btn', 'I accept the updated terms')}
                        </span>
                    </label>

                    <button type="button" onClick={submit} disabled={!accepted || busy}
                        className="w-full py-3 rounded-xl font-medium text-white transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                        style={{ background: 'var(--accent-primary)' }}>
                        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : t('reconsent.accept_btn', 'I accept the updated terms')}
                    </button>

                    <button type="button" onClick={onLogout} disabled={busy}
                        className="w-full py-2.5 mt-2 text-sm font-medium transition-all"
                        style={{ color: 'var(--text-secondary)' }}>
                        {t('login.sign_out', 'Sign out')}
                    </button>
                </div>
            </div>

            <LegalDocModal
                open={!!viewDoc}
                docId={viewDoc?.docId}
                title={viewDoc?.title}
                onClose={() => setViewDoc(null)}
            />
        </div>
    );
}
