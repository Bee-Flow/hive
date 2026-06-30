import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, Loader2, RefreshCw, KeyRound, AlertCircle, Check } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';
import RecoveryCodes from '../../components/mfa/RecoveryCodes';

/**
 * Personal security settings — TOTP MFA enrollment & management.
 * Talks to /auth/mfa/{status,setup,enable,disable,recovery-codes/regenerate}.
 */
const ChangePassword = () => {
    const { t } = useTranslation();
    const [oldPassword, setOld] = useState('');
    const [newPassword, setNew] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [ok, setOk] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setErr(''); setOk(false);
        if (newPassword.length < 8) { setErr(t('reset.min_length', 'Password must be at least 8 characters')); return; }
        if (newPassword !== confirm) { setErr(t('login.passwords_no_match', 'Passwords do not match')); return; }
        setBusy(true);
        try {
            const res = await authFetch(`${API_BASE}/auth/change-password`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPassword, newPassword }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
                setOk(true); setOld(''); setNew(''); setConfirm('');
            } else {
                setErr(data.error || t('changepw.failed', 'Failed to change password'));
            }
        } catch (e) { setErr(t('login.connection_error', 'Connection error. Please try again.')); }
        finally { setBusy(false); }
    };

    const field = 'w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]';
    const label = 'block text-xs font-medium text-[var(--text-secondary)] mb-1';

    return (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 space-y-4">
            <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[var(--accent-primary)]" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('changepw.title', 'Change password')}</h3>
            </div>
            <form onSubmit={submit} className="space-y-3" autoComplete="off">
                <div>
                    <label className={label}>{t('changepw.current', 'Current password')}</label>
                    <input type="password" value={oldPassword} onChange={e => setOld(e.target.value)} className={field} autoComplete="current-password" required />
                </div>
                <div>
                    <label className={label}>{t('changepw.new', 'New password')}</label>
                    <input type="password" value={newPassword} onChange={e => setNew(e.target.value)} className={field} autoComplete="new-password" minLength={8} required />
                </div>
                <div>
                    <label className={label}>{t('changepw.confirm', 'Confirm new password')}</label>
                    <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className={field} autoComplete="new-password" minLength={8} required />
                </div>
                {err && <p className="text-sm text-red-500 flex items-center gap-1.5"><AlertCircle className="w-4 h-4 shrink-0" /> {err}</p>}
                {ok && <p className="text-sm text-emerald-400 flex items-center gap-1.5"><Check className="w-4 h-4 shrink-0" /> {t('changepw.success', 'Password changed successfully.')}</p>}
                <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-2" style={{ background: 'var(--accent-primary)' }}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {t('changepw.update', 'Update password')}
                </button>
            </form>
        </div>
    );
};

export default function SecuritySection() {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState({ enabled: false, recoveryCodesRemaining: 0 });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    // Enrollment flow
    const [setupData, setSetupData] = useState(null); // { otpauthUrl, qr, secret }
    const [code, setCode] = useState('');
    const [newCodes, setNewCodes] = useState(null); // recovery codes shown once
    // Disable / regenerate flows
    const [disarmCode, setDisarmCode] = useState('');
    const [mode, setMode] = useState(null); // null | 'disable' | 'regenerate'

    const loadStatus = async () => {
        try {
            const res = await authFetch(`${API_BASE}/auth/mfa/status`);
            if (res.ok) setStatus(await res.json());
        } catch (_) { /* ignore */ }
        finally { setLoading(false); }
    };
    useEffect(() => { loadStatus(); }, []);

    const post = async (path, body) => {
        const res = await authFetch(`${API_BASE}/auth/mfa/${path}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    };

    const beginSetup = async () => {
        setError(''); setBusy(true);
        try { setSetupData(await post('setup')); }
        catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    const confirmEnable = async () => {
        setError(''); setBusy(true);
        try {
            const data = await post('enable', { code: code.trim() });
            setNewCodes(data.recoveryCodes || []);
            setSetupData(null); setCode('');
            await loadStatus();
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    const confirmDisarm = async () => {
        setError(''); setBusy(true);
        try {
            if (mode === 'disable') {
                await post('disable', { code: disarmCode.trim() });
                setMode(null); setDisarmCode('');
                await loadStatus();
            } else if (mode === 'regenerate') {
                const data = await post('recovery-codes/regenerate', { code: disarmCode.trim() });
                setNewCodes(data.recoveryCodes || []);
                setMode(null); setDisarmCode('');
                await loadStatus();
            }
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    const inputClass = 'w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-center tracking-[0.25em] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]';

    if (loading) {
        return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" /></div>;
    }

    return (
        <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
            <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[var(--accent-primary)]" /> {t('settings.security', 'Security')}
                </h2>
                <p className="text-sm text-[var(--text-muted)] mt-1">{t('mfa.section_desc', 'Add a second factor to protect your account at sign-in.')}</p>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
            )}

            {/* One-time recovery codes display (after enable / regenerate) */}
            {newCodes ? (
                <RecoveryCodes codes={newCodes} onDone={() => setNewCodes(null)} />
            ) : setupData ? (
                /* Enrollment: QR + confirm code */
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 space-y-4">
                    <p className="text-sm text-[var(--text-secondary)]">
                        {t('mfa.scan_qr', 'Scan this QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…), then enter the 6-digit code to confirm.')}
                    </p>
                    <div className="flex justify-center">
                        <img src={setupData.qr} alt="MFA QR code" width={200} height={200} className="rounded-lg border border-[var(--border-subtle)] bg-white p-2" />
                    </div>
                    <details className="text-xs text-[var(--text-muted)]">
                        <summary className="cursor-pointer">{t('mfa.cant_scan', 'Can’t scan? Enter this key manually')}</summary>
                        <code className="block mt-2 p-2 rounded bg-[var(--bg-primary)] break-all select-all">{setupData.secret}</code>
                    </details>
                    <input className={inputClass} value={code} onChange={e => setCode(e.target.value)} placeholder="000000" inputMode="numeric" maxLength={6} autoFocus />
                    <div className="flex gap-2">
                        <button onClick={() => { setSetupData(null); setCode(''); setError(''); }} className="flex-1 py-2.5 rounded-lg border border-[var(--border-default)] text-sm font-medium text-[var(--text-secondary)]">
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button onClick={confirmEnable} disabled={busy || code.trim().length < 6} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: 'var(--accent-primary)' }}>
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} {t('mfa.enable', 'Enable')}
                        </button>
                    </div>
                </div>
            ) : status.enabled ? (
                /* Enabled state */
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{t('mfa.enabled_title', 'Two-factor authentication is on')}</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5" /> {t('mfa.codes_remaining', '{n} recovery codes remaining', { n: status.recoveryCodesRemaining })}
                    </p>

                    {mode ? (
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-[var(--text-secondary)]">
                                {t('mfa.confirm_with_code', 'Enter a current code to confirm')}
                            </label>
                            <input className={inputClass} value={disarmCode} onChange={e => setDisarmCode(e.target.value)} placeholder="000000" autoFocus />
                            <div className="flex gap-2">
                                <button onClick={() => { setMode(null); setDisarmCode(''); setError(''); }} className="flex-1 py-2 rounded-lg border border-[var(--border-default)] text-sm font-medium text-[var(--text-secondary)]">
                                    {t('common.cancel', 'Cancel')}
                                </button>
                                <button onClick={confirmDisarm} disabled={busy || !disarmCode.trim()} className={`flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2 ${mode === 'disable' ? 'bg-red-600' : ''}`} style={mode === 'regenerate' ? { background: 'var(--accent-primary)' } : {}}>
                                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    {mode === 'disable' ? t('mfa.disable', 'Disable') : t('mfa.regenerate', 'Regenerate')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => { setMode('regenerate'); setError(''); }} className="px-3 py-2 rounded-lg border border-[var(--border-default)] text-sm font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                                <RefreshCw className="w-4 h-4" /> {t('mfa.regenerate_codes', 'Regenerate recovery codes')}
                            </button>
                            <button onClick={() => { setMode('disable'); setError(''); }} className="px-3 py-2 rounded-lg border border-red-500/30 text-sm font-medium text-red-400 flex items-center gap-1.5">
                                <ShieldOff className="w-4 h-4" /> {t('mfa.disable', 'Disable')}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                /* Disabled state */
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <ShieldOff className="w-5 h-5 text-[var(--text-muted)]" />
                        <div>
                            <div className="text-sm font-semibold text-[var(--text-primary)]">{t('mfa.disabled_title', 'Two-factor authentication is off')}</div>
                            <div className="text-xs text-[var(--text-muted)]">{t('mfa.disabled_desc', 'Use an authenticator app for an extra layer of security.')}</div>
                        </div>
                    </div>
                    <button onClick={beginSetup} disabled={busy} className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-2" style={{ background: 'var(--accent-primary)' }}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} {t('mfa.enable', 'Enable')}
                    </button>
                </div>
            )}

            {/* Change password — only for accounts that have a password */}
            {status.hasPassword && <ChangePassword />}
        </div>
    );
}
