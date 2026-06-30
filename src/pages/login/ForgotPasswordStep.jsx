import React, { useState } from 'react';
import { Mail, Loader2, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * "Forgot password" email-entry step. Submits the email; the parent always
 * shows the same success state regardless of whether the account exists.
 */
const ForgotPasswordStep = ({ onSubmit, onBack, isLoading, sent, inputClass, labelClass }) => {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');

    if (sent) {
        return (
            <div className="space-y-5 text-center">
                <div className="flex justify-center"><CheckCircle2 className="w-12 h-12 text-emerald-400" /></div>
                <p className="text-sm text-[var(--text-secondary)]">
                    {t('reset.check_email', "If an account exists for that email, we've sent a password reset link. Check your inbox.")}
                </p>
                <button onClick={onBack} className="w-full py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1.5">
                    <ArrowLeft className="w-4 h-4" /> {t('reset.back_to_signin', 'Back to sign in')}
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={e => { e.preventDefault(); if (email.trim()) onSubmit(email.trim()); }} className="space-y-5">
            <p className="text-sm text-[var(--text-secondary)] text-center">
                {t('reset.forgot_desc', "Enter your email and we'll send you a link to reset your password.")}
            </p>
            <div>
                <label className={labelClass}>{t('reset.email', 'Email')}</label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" required autoFocus data-testid="forgot-email-input" />
                </div>
            </div>
            <button type="submit" disabled={isLoading || !email.trim()}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-base shadow-lg shadow-amber-500/20">
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" /> {t('reset.send_link', 'Send reset link')}</>}
            </button>
            <button type="button" onClick={onBack} className="w-full py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-1.5">
                <ArrowLeft className="w-4 h-4" /> {t('reset.back_to_signin', 'Back to sign in')}
            </button>
        </form>
    );
};

export default ForgotPasswordStep;
