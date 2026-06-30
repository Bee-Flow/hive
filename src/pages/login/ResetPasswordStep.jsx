import React, { useState } from 'react';
import { Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * New-password form for the reset link (token comes from the URL, held by the
 * parent). Local validation only; server errors surface via the parent's
 * shared error block.
 */
const ResetPasswordStep = ({ onSubmit, onDone, isLoading, done, inputClass, labelClass }) => {
    const { t } = useTranslation();
    const [pw, setPw] = useState('');
    const [confirm, setConfirm] = useState('');
    const [localErr, setLocalErr] = useState('');

    if (done) {
        return (
            <div className="space-y-5 text-center">
                <div className="flex justify-center"><CheckCircle2 className="w-12 h-12 text-emerald-400" /></div>
                <p className="text-sm text-[var(--text-secondary)]">
                    {t('reset.success', 'Your password has been reset. You can now sign in with your new password.')}
                </p>
                <button onClick={onDone} className="w-full py-3 text-white rounded-xl font-semibold" style={{ background: 'var(--accent-primary)' }}>
                    {t('reset.go_signin', 'Go to sign in')}
                </button>
            </div>
        );
    }

    const submit = (e) => {
        e.preventDefault();
        setLocalErr('');
        if (pw.length < 8) { setLocalErr(t('reset.min_length', 'Password must be at least 8 characters')); return; }
        if (pw !== confirm) { setLocalErr(t('login.passwords_no_match', 'Passwords do not match')); return; }
        onSubmit(pw);
    };

    return (
        <form onSubmit={submit} className="space-y-5">
            <p className="text-sm text-[var(--text-secondary)] text-center">{t('reset.choose_new', 'Choose a new password for your account.')}</p>
            <div>
                <label className={labelClass}>{t('reset.new_password', 'New password')}</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                    <input type="password" value={pw} onChange={e => setPw(e.target.value)} className={inputClass} placeholder="••••••••" required minLength={8} autoFocus data-testid="reset-new-password" />
                </div>
            </div>
            <div>
                <label className={labelClass}>{t('reset.confirm_password', 'Confirm new password')}</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                    <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputClass} placeholder="••••••••" required minLength={8} />
                </div>
            </div>
            {localErr && <p className="text-sm text-red-500">{localErr}</p>}
            <button type="submit" disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-base shadow-lg shadow-amber-500/20">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('reset.set_password', 'Set new password')}
            </button>
        </form>
    );
};

export default ResetPasswordStep;
