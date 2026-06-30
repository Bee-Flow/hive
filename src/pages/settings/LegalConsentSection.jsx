import React, { useState, useEffect, useCallback } from 'react';
import { ScrollText, BookOpen, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';
import LegalDocModal from '../../components/LegalDocModal';

/**
 * Legal & Consent settings — the user-facing consent center.
 *   • Legal documents (mandatory): acceptance status + version + date, a Read
 *     link, and a "Review & accept" action when an update is available.
 *   • Communication preferences (optional): freely opt-in/out toggles (marketing),
 *     withdrawable any time.
 */
export default function LegalConsentSection() {
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null); // 'accept' | consentId
    const [error, setError] = useState('');
    const [viewDoc, setViewDoc] = useState(null); // { docId, title } — opens the in-app reader

    const load = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/auth/consents`);
            if (res.ok) setData(await res.json());
            else setError('Failed to load your consent status.');
        } catch (e) {
            setError('Failed to load your consent status.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const fmtDate = (s) => {
        if (!s) return '';
        try { return new Date(s).toLocaleDateString(); } catch { return s; }
    };

    const acceptUpdates = async () => {
        setBusy('accept'); setError('');
        try {
            const res = await authFetch(`${API_BASE}/auth/accept-terms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ consent: { accepted: true } }),
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
            await load();
        } catch (e) { setError(e.message); }
        finally { setBusy(null); }
    };

    const toggleOptional = async (c) => {
        setBusy(c.id); setError('');
        try {
            const res = await authFetch(`${API_BASE}/auth/consents/optional`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: c.id, granted: !c.granted }),
            });
            if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
            await load();
        } catch (e) { setError(e.message); }
        finally { setBusy(null); }
    };

    const documents = data?.documents || [];
    const optional = data?.optional || [];
    const hasUpdates = documents.some(d => !d.upToDate);

    const cardStyle = { borderColor: 'var(--border-default)', background: 'var(--bg-card, var(--bg-secondary))' };

    return (
        <div className="max-w-3xl mx-auto py-4">
            <div className="flex items-center gap-2 mb-1">
                <ScrollText className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {t('settings.legal_consent', 'Legal & Consent')}
                </h2>
            </div>
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
                {t('settings.legal_consent_desc', 'Review the agreements you have accepted and manage your communication preferences.')}
            </p>

            {error && (
                <div className="mb-4 p-3 rounded-lg flex items-center gap-2 text-sm bg-red-500/10 border border-red-500/30 text-red-500">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                </div>
            )}

            {loading ? (
                <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    <Loader2 className="w-5 h-5 animate-spin inline" />
                </div>
            ) : (
                <>
                    {/* ── Legal documents ─────────────────────────────── */}
                    <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                        {t('settings.legal_documents', 'Legal documents')}
                    </h3>
                    <div className="rounded-xl border divide-y mb-2" style={cardStyle}>
                        {documents.map(doc => (
                            <div key={doc.docId} className="flex items-center justify-between gap-3 p-3">
                                <div className="min-w-0">
                                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{doc.title}</div>
                                    <div className="text-xs flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                        {doc.accepted ? (
                                            <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                {t('settings.consent_accepted_on', 'Accepted v{version} on {date}', { version: doc.acceptedVersion, date: fmtDate(doc.acceptedAt) })}</>
                                        ) : doc.acceptedVersion != null ? (
                                            <><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> {t('settings.consent_update_available', 'Update available — please review')}</>
                                        ) : (
                                            <><AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> {t('settings.consent_not_accepted', 'Not yet accepted')}</>
                                        )}
                                    </div>
                                </div>
                                <button type="button" onClick={() => setViewDoc({ docId: doc.docId, title: doc.title })}
                                    className="shrink-0 inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--accent-primary)' }}>
                                    {t('settings.consent_read', 'Read')} <BookOpen className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {hasUpdates && (
                        <button type="button" onClick={acceptUpdates} disabled={busy === 'accept'}
                            className="mb-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                            style={{ background: 'var(--accent-primary)' }}>
                            {busy === 'accept' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            {t('settings.consent_review_accept', 'Review & accept')}
                        </button>
                    )}

                    <p className="text-xs mb-6" style={{ color: 'var(--text-tertiary, var(--text-muted))' }}>
                        {t('settings.consent_withdraw_note', 'To withdraw a required agreement you must close your account. Contact info@beeflow.nl.')}
                    </p>

                    {/* ── Communication preferences ───────────────────── */}
                    {optional.length > 0 && (
                        <>
                            <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                                {t('settings.communication_prefs', 'Communication preferences')}
                            </h3>
                            <div className="rounded-xl border divide-y" style={cardStyle}>
                                {optional.map(c => (
                                    <div key={c.id} className="flex items-start justify-between gap-3 p-3">
                                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                            {t(c.labelKey || 'consent.marketing_label', 'I would like to receive marketing communications from Bee Flow.')}
                                        </span>
                                        <button type="button" role="switch" aria-checked={c.granted}
                                            onClick={() => toggleOptional(c)} disabled={busy === c.id}
                                            className="shrink-0 relative inline-flex items-center h-6 w-11 rounded-full transition-colors disabled:opacity-50"
                                            style={{ background: c.granted ? 'var(--accent-primary)' : 'var(--border-default)' }}>
                                            <span className="inline-block h-5 w-5 rounded-full bg-white transition-transform"
                                                style={{ transform: c.granted ? 'translateX(22px)' : 'translateX(2px)' }} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}

            <LegalDocModal
                open={!!viewDoc}
                docId={viewDoc?.docId}
                title={viewDoc?.title}
                onClose={() => setViewDoc(null)}
            />
        </div>
    );
}
