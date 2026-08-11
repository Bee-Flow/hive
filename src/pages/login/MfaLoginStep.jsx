import React, { useState } from 'react';
import { ShieldCheck, Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Second-factor entry shown when /auth/admin-login responds `mfaRequired`.
 * Submits the TOTP (or a recovery) code to /auth/mfa/verify-login, which
 * completes the session on success.
 */
const MfaLoginStep = ({ onVerify, onCancel, isLoading, inputClass, labelClass }) => {
    const { t } = useTranslation();
    const [code, setCode] = useState('');
    const [useRecovery, setUseRecovery] = useState(false);

    const submit = (e) => {
        e.preventDefault();
        if (code.trim()) onVerify(code.trim());
    };

    return (
        <form onSubmit={submit} className="space-y-5">
            <div className="flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                    <ShieldCheck className="w-6 h-6 text-[var(--accent-primary)]" />
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                    {useRecovery
                        ? t('mfa.enter_recovery_code', 'Enter one of your one-time recovery codes')
                        : t('mfa.enter_code', 'Enter the 6-digit code from your authenticator app')}
                </p>
            </div>

            <div>
                <label className={labelClass}>
                    {useRecovery ? t('mfa.recovery_code', 'Recovery code') : t('mfa.code', 'Verification code')}
                </label>
                <input
                    type="text"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    className={`${inputClass} text-center tracking-[0.3em] text-lg`}
                    placeholder={useRecovery ? 'xxxx-xxxx' : '000000'}
                    inputMode={useRecovery ? 'text' : 'numeric'}
                    autoComplete="one-time-code"
                    autoFocus
                    data-testid="mfa-code-input"
                />
            </div>

            <button
                type="submit"
                disabled={isLoading || !code.trim()}
                data-testid="mfa-verify-button"
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-base shadow-lg shadow-amber-500/20"
            >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ShieldCheck className="w-5 h-5" /> {t('mfa.verify', 'Verify')}</>}
            </button>

            <button
                type="button"
                onClick={() => { setUseRecovery(v => !v); setCode(''); }}
                className="w-full py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center gap-1.5"
            >
                <KeyRound className="w-4 h-4" />
                {useRecovery ? t('mfa.use_authenticator', 'Use your authenticator app instead') : t('mfa.use_recovery', 'Use a recovery code')}
            </button>

            <button
                type="button"
                onClick={onCancel}
                className="w-full py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center gap-1.5"
            >
                <ArrowLeft className="w-4 h-4" /> {t('login.back', 'Back')}
            </button>

            {/* BFSF-274: a discoverable escalation path — before this, a user
                whose codes kept failing had no idea recovery even existed. */}
            <p className="text-xs text-center text-[var(--text-muted)]">
                {t('mfa.locked_out_hint', 'Locked out? Use a recovery code, or ask your organization admin to reset two-factor authentication for your account.')}
            </p>
        </form>
    );
};

export default MfaLoginStep;
