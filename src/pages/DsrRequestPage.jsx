import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, Search } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

const API = (import.meta.env.VITE_API_URL || '') + '/api/dsr';

/**
 * Public data-subject request form (GDPR Art. 15–22). Deliberately reachable
 * without an account — the org is resolved server-side from the subject's
 * email and submissions are rate-limited per IP (5/hour). Linked from the
 * organisation's privacy notice (see Compliance → Settings).
 */
const REQUEST_TYPES = [
    { id: 'access', labelKey: 'dsr_public.type_access', fallback: 'Access my data (Art. 15)' },
    { id: 'rectification', labelKey: 'dsr_public.type_rectification', fallback: 'Correct my data (Art. 16)' },
    { id: 'deletion', labelKey: 'dsr_public.type_deletion', fallback: 'Delete my data (Art. 17)' },
    { id: 'portability', labelKey: 'dsr_public.type_portability', fallback: 'Export my data (Art. 20)' },
    { id: 'restriction', labelKey: 'dsr_public.type_restriction', fallback: 'Restrict processing (Art. 18)' },
    { id: 'objection', labelKey: 'dsr_public.type_objection', fallback: 'Object to processing (Art. 21)' },
];

export default function DsrRequestPage() {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [type, setType] = useState('access');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);   // { id, ack }
    const [error, setError] = useState(null);

    // Status check widget
    const [checkId, setCheckId] = useState('');
    const [checkEmail, setCheckEmail] = useState('');
    const [checkResult, setCheckResult] = useState(null);
    const [checking, setChecking] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const r = await fetch(`${API}/requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject_email: email, request_type: type, notes: notes || undefined }),
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(body.error || `${r.status}`);
            setResult(body);
        } catch (err) {
            setError(err.message);
        } finally { setSubmitting(false); }
    };

    const checkStatus = async (e) => {
        e.preventDefault();
        setChecking(true);
        setCheckResult(null);
        try {
            const r = await fetch(`${API}/requests/${encodeURIComponent(checkId)}/public?email=${encodeURIComponent(checkEmail)}`);
            const body = await r.json().catch(() => ({}));
            setCheckResult(r.ok ? body : { error: body.error || 'not found' });
        } catch {
            setCheckResult({ error: 'network' });
        } finally { setChecking(false); }
    };

    return (
        <div style={page}>
            <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <ShieldCheck size={26} style={{ color: '#10b981' }} />
                    <h1 style={{ margin: 0, fontSize: 22 }}>
                        {t('dsr_public.title', 'Privacy request')}
                    </h1>
                </div>
                <p style={{ margin: '0 0 20px', fontSize: 14, color: '#555', lineHeight: 1.5 }}>
                    {t('dsr_public.subtitle', 'Under the GDPR you can ask what personal data we process about you, and have it corrected, exported or deleted. Submit your request below — it will be answered within 30 days.')}
                </p>

                {result ? (
                    <div style={successBox}>
                        <CheckCircle2 size={28} style={{ color: '#10b981' }} />
                        <div style={{ fontSize: 15, fontWeight: 700 }}>
                            {t('dsr_public.submitted_title', 'Request received')}
                        </div>
                        <div style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>
                            {t('dsr_public.submitted_body', 'Keep this reference number to check the status of your request later:')}
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '0.02em' }}>#{result.id}</div>
                        <div style={{ fontSize: 12.5, color: '#777' }}>{result.ack}</div>
                    </div>
                ) : (
                    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <label style={fieldLabel}>
                            {t('dsr_public.email', 'Your email address')}
                            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                placeholder="you@example.com" style={input} />
                        </label>
                        <label style={fieldLabel}>
                            {t('dsr_public.type', 'What would you like us to do?')}
                            <select value={type} onChange={e => setType(e.target.value)} style={input}>
                                {REQUEST_TYPES.map(rt => (
                                    <option key={rt.id} value={rt.id}>{t(rt.labelKey, rt.fallback)}</option>
                                ))}
                            </select>
                        </label>
                        <label style={fieldLabel}>
                            {t('dsr_public.notes', 'Anything we should know? (optional)')}
                            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                                style={{ ...input, resize: 'vertical' }} />
                        </label>
                        {error && (
                            <div style={{ fontSize: 13, color: '#dc2626' }}>
                                {t('dsr_public.error', 'Could not submit the request:')} {error}
                            </div>
                        )}
                        <button type="submit" disabled={submitting} style={primaryBtn}>
                            {submitting
                                ? t('dsr_public.submitting', 'Submitting…')
                                : t('dsr_public.submit', 'Submit request')}
                        </button>
                    </form>
                )}
            </div>

            {/* Status check */}
            <div style={{ ...card, marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Search size={16} style={{ color: '#666' }} />
                    <h2 style={{ margin: 0, fontSize: 15 }}>
                        {t('dsr_public.check_title', 'Check an existing request')}
                    </h2>
                </div>
                <form onSubmit={checkStatus} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input required value={checkId} onChange={e => setCheckId(e.target.value)}
                        placeholder={t('dsr_public.check_id', 'Reference #')} style={{ ...input, flex: '0 1 130px' }} />
                    <input type="email" required value={checkEmail} onChange={e => setCheckEmail(e.target.value)}
                        placeholder={t('dsr_public.check_email', 'Your email')} style={{ ...input, flex: '1 1 200px' }} />
                    <button type="submit" disabled={checking} style={{ ...primaryBtn, padding: '10px 16px' }}>
                        {t('dsr_public.check_btn', 'Check')}
                    </button>
                </form>
                {checkResult && (
                    <div style={{ marginTop: 12, fontSize: 13.5, color: checkResult.error ? '#dc2626' : '#333' }}>
                        {checkResult.error
                            ? t('dsr_public.check_not_found', 'No request found for that reference number and email.')
                            : (t('dsr_public.check_status', 'Status of request #{id}: {status}', { id: checkResult.id, status: checkResult.status })
                                || `Status of request #${checkResult.id}: ${checkResult.status}`)}
                    </div>
                )}
            </div>
        </div>
    );
}

const page = {
    minHeight: '100vh', background: '#f6f7f9',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '48px 16px', fontFamily: 'Inter, system-ui, sans-serif', color: '#111',
};
const card = {
    background: '#fff', border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: 16, padding: 28, width: 520, maxWidth: '100%',
    boxShadow: '0 8px 30px rgba(0,0,0,0.05)',
};
const fieldLabel = {
    display: 'flex', flexDirection: 'column', gap: 6,
    fontSize: 13, fontWeight: 600, color: '#333',
};
const input = {
    border: '1px solid rgba(0,0,0,0.15)', borderRadius: 8,
    padding: '10px 12px', fontSize: 14, fontFamily: 'inherit',
    color: '#111', background: '#fff', outline: 'none', width: '100%',
};
const primaryBtn = {
    background: '#10b981', color: '#fff', border: 'none',
    padding: '11px 18px', borderRadius: 8, cursor: 'pointer',
    fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
};
const successBox = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    textAlign: 'center', padding: '24px 12px',
    background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)',
    borderRadius: 12,
};
