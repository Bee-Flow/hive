import React, { useState, useEffect, useRef } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';
import beeFlowIcon from '../assets/bee-flow-logo.svg';

/**
 * Shown inside the embedded Nextcloud view when the connector bootstrap matched
 * this Nextcloud's admin-email domain to an existing Bee Flow organisation and
 * is waiting for the admin to confirm with a one-time code emailed to them.
 *
 * The whole flow stays in-app: the code goes SPA → connector-owned
 * /setup/verify-email-code → SaaS. On success the connector caches the tenant
 * key and we reload into the full app. No external Bee Flow login.
 */
function formatExpiresIn(expiresAt) {
    if (!expiresAt) return null;
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'expired';
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'less than a minute';
    return `${mins} minute${mins === 1 ? '' : 's'}`;
}

const EmailVerificationScreen = ({ verification, t: tProp }) => {
    const t = tProp || ((_k, d) => d);
    const v = verification || {};
    const [code, setCode] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState(null);
    const [attemptsLeft, setAttemptsLeft] = useState(null);
    const [info, setInfo] = useState(v.emailSent === false
        ? t('app.nc_verify_email_unsent', 'We couldn’t send the email automatically. Use "Resend code" below.')
        : null);
    const [maskedEmail, setMaskedEmail] = useState(v.maskedEmail || null);
    const [expiresAt, setExpiresAt] = useState(v.expiresAt || null);
    const [, setTick] = useState(0);
    const inputRef = useRef(null);

    useEffect(() => {
        const id = setInterval(() => setTick(x => x + 1), 30_000);
        return () => clearInterval(id);
    }, []);
    useEffect(() => { inputRef.current?.focus(); }, []);

    const expiresIn = formatExpiresIn(expiresAt);

    const submit = async () => {
        if (submitting || code.length !== 6) return;
        setSubmitting(true);
        setError(null);
        setInfo(null);
        try {
            const res = await authFetch(`${API_BASE}/setup/verify-email-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
            const body = await res.json().catch(() => ({}));
            if (res.ok && body.ok) {
                // Tenant key is now cached on the connector — reload into the app.
                window.location.reload();
                return;
            }
            if (typeof body.attemptsLeft === 'number') setAttemptsLeft(body.attemptsLeft);
            if (body.code === 'expired') {
                setError(t('app.nc_verify_expired', 'That code has expired. Request a new one below.'));
            } else if (body.code === 'too_many_attempts') {
                setError(t('app.nc_verify_too_many', 'Too many incorrect attempts. Request a new code below.'));
            } else if (body.code === 'invalid_code') {
                setError(t('app.nc_verify_invalid', 'That code is not correct. Check the email and try again.'));
            } else {
                setError(body.error || t('app.nc_verify_failed', 'Could not verify the code. Please try again.'));
            }
            setCode('');
            inputRef.current?.focus();
        } catch (e) {
            setError(t('app.nc_verify_network', 'Could not reach Bee Flow. Check your connection and try again.'));
        } finally {
            setSubmitting(false);
        }
    };

    const resend = async () => {
        if (resending) return;
        setResending(true);
        setError(null);
        setInfo(null);
        setAttemptsLeft(null);
        try {
            const res = await authFetch(`${API_BASE}/setup/resend-email-code`, { method: 'POST' });
            const body = await res.json().catch(() => ({}));
            if (res.ok && body.ok) {
                if (body.maskedEmail) setMaskedEmail(body.maskedEmail);
                if (body.expiresAt) setExpiresAt(body.expiresAt);
                setInfo(body.emailSent === false
                    ? t('app.nc_verify_email_unsent', 'We couldn’t send the email automatically. Check the service email configuration.')
                    : t('app.nc_verify_resent', 'A new code is on its way. Check your inbox.'));
            } else {
                setError(body.error || t('app.nc_verify_resend_failed', 'Could not send a new code. Please try again.'));
            }
        } catch (e) {
            setError(t('app.nc_verify_network', 'Could not reach Bee Flow. Check your connection and try again.'));
        } finally {
            setResending(false);
        }
    };

    return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: '24px' }}>
            <div style={{
                maxWidth: 420, width: '100%', textAlign: 'center',
                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                borderRadius: 24, padding: '40px 32px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}>
                <img src={beeFlowIcon} alt="Bee Flow" style={{ width: 64, height: 64, borderRadius: 18, margin: '0 auto 20px', objectFit: 'contain', display: 'block' }} />
                <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {t('app.nc_verify_title', 'Connect this Nextcloud')}
                </h2>
                <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                    {v.organizationName
                        ? t('app.nc_verify_desc_org', 'Enter the code we emailed to {email} to link this Nextcloud to {org}.')
                            .replace('{email}', maskedEmail || t('app.nc_verify_your_admin', 'your admin address'))
                            .replace('{org}', v.organizationName)
                        : t('app.nc_verify_desc', 'Enter the code we emailed to {email} to link this Nextcloud to your Bee Flow organisation.')
                            .replace('{email}', maskedEmail || t('app.nc_verify_your_admin', 'your admin address'))}
                </p>

                <input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                    placeholder="••••••"
                    aria-label={t('app.nc_verify_code_label', 'Verification code')}
                    style={{
                        width: '100%', boxSizing: 'border-box', textAlign: 'center',
                        fontSize: 30, fontWeight: 700, letterSpacing: 12,
                        padding: '14px 0', marginBottom: 16, borderRadius: 12,
                        border: '1px solid var(--border-default)', background: 'var(--bg-primary)',
                        color: 'var(--text-primary)', fontFamily: 'monospace',
                    }}
                />

                {error && (
                    <div style={{ marginBottom: 14, fontSize: 13, borderRadius: 10, padding: '10px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', lineHeight: 1.5 }}>
                        {error}
                        {typeof attemptsLeft === 'number' && attemptsLeft > 0 && (
                            <div style={{ marginTop: 4, opacity: 0.85 }}>
                                {t('app.nc_verify_attempts_left', '{n} attempts left').replace('{n}', String(attemptsLeft))}
                            </div>
                        )}
                    </div>
                )}
                {info && !error && (
                    <div style={{ marginBottom: 14, fontSize: 13, borderRadius: 10, padding: '10px 12px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', lineHeight: 1.5 }}>
                        {info}
                    </div>
                )}

                <button
                    onClick={submit}
                    disabled={submitting || code.length !== 6}
                    style={{
                        width: '100%', padding: '11px 0', borderRadius: 12,
                        background: 'var(--accent-primary)', color: '#fff', fontWeight: 600, fontSize: 14,
                        border: 'none', cursor: (submitting || code.length !== 6) ? 'not-allowed' : 'pointer',
                        opacity: (submitting || code.length !== 6) ? 0.55 : 1,
                    }}
                >
                    {submitting ? t('app.nc_verify_working', 'Verifying…') : t('app.nc_verify_submit', 'Verify & connect')}
                </button>

                <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <button
                        onClick={resend}
                        disabled={resending}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: resending ? 'default' : 'pointer', fontWeight: 600, fontSize: 13, padding: 0 }}
                    >
                        {resending ? t('app.nc_verify_resending', 'Sending…') : t('app.nc_verify_resend', 'Resend code')}
                    </button>
                    {expiresIn && expiresIn !== 'expired' && (
                        <span style={{ marginLeft: 8, opacity: 0.8 }}>
                            {t('app.nc_verify_expires_in', 'Code expires in {time}').replace('{time}', expiresIn)}
                        </span>
                    )}
                </div>

                <p style={{ margin: '20px 0 0', fontSize: 12, color: 'var(--text-secondary)', opacity: 0.8, lineHeight: 1.55 }}>
                    {t('app.nc_verify_admin_note', 'Only a Nextcloud admin who can read the connection email can complete this step.')}
                </p>
            </div>
        </div>
    );
};

export default EmailVerificationScreen;
