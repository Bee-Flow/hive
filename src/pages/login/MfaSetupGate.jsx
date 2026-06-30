import React, { useEffect, useState } from 'react';
import { ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { useTranslation } from '../../hooks/useTranslation';
import RecoveryCodes from '../../components/mfa/RecoveryCodes';
import beeFlowLogo from '../../assets/bee-flow-logo.svg';

/**
 * Full-screen forced MFA-enrollment gate. Shown (by App.jsx) when the server
 * reports `mfaSetupRequired` — i.e. an admin requires two-factor auth on
 * username/password accounts and this account hasn't enrolled yet. The only
 * ways out are completing enrollment (→ onDone) or signing out (→ onLogout);
 * there is intentionally no "skip".
 *
 * Reuses the same /auth/mfa/{setup,enable} endpoints and the shared
 * RecoveryCodes panel as Settings → Security, so enrollment behaves identically.
 */
export default function MfaSetupGate({ onDone, onLogout }) {
    const { t } = useTranslation();
    const [setupData, setSetupData] = useState(null); // { otpauthUrl, qr, secret }
    const [code, setCode] = useState('');
    const [newCodes, setNewCodes] = useState(null);   // recovery codes shown once
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const post = async (path, body) => {
        const res = await authFetch(`${API_BASE}/auth/mfa/${path}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    };

    // Kick off enrollment immediately so the QR is on screen without an extra click.
    useEffect(() => {
        let alive = true;
        (async () => {
            setBusy(true);
            try {
                const data = await post('setup');
                if (alive) setSetupData(data);
            } catch (e) {
                if (alive) setError(e.message);
            } finally {
                if (alive) setBusy(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    const confirmEnable = async () => {
        setError(''); setBusy(true);
        try {
            const data = await post('enable', { code: code.trim() });
            setNewCodes(data.recoveryCodes || []);
            setCode('');
        } catch (e) { setError(e.message); }
        finally { setBusy(false); }
    };

    const inputClass = 'w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-center tracking-[0.25em] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]';

    return (
        <div className="h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(160deg, var(--bg-primary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%)' }}>
            <div className="w-full max-w-md">
                <div className="backdrop-blur-xl rounded-3xl p-8 shadow-2xl border relative overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                    <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent" />

                    <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-5 rounded-full overflow-hidden shadow-xl ring-4 ring-[var(--border-subtle)]">
                            <img src={beeFlowLogo} alt="Bee Flow" className="w-full h-full object-cover" />
                        </div>
                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                            <ShieldCheck className="w-7 h-7 text-emerald-400" />
                        </div>
                        <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                            {t('mfa.required_title', 'Set up two-factor authentication')}
                        </h2>
                        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            {t('mfa.required_desc', 'Your administrator requires two-factor authentication on password accounts. Set it up now to continue.')}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                        </div>
                    )}

                    {newCodes ? (
                        <RecoveryCodes codes={newCodes} onDone={onDone} />
                    ) : setupData ? (
                        <div className="space-y-4">
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
                            <button onClick={confirmEnable} disabled={busy || code.trim().length < 6} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: 'var(--accent-primary)' }}>
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} {t('mfa.enable', 'Enable')}
                            </button>
                        </div>
                    ) : (
                        <div className="flex justify-center py-6">
                            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
                        </div>
                    )}

                    <button
                        onClick={onLogout}
                        className="w-full mt-4 py-2.5 rounded-xl font-medium text-sm border transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                    >
                        {t('sidebar.sign_out', 'Sign Out')}
                    </button>
                </div>
            </div>
        </div>
    );
}
