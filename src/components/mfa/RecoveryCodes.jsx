import React, { useState } from 'react';
import { AlertCircle, Copy, Check } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * One-time recovery-codes panel, shown once after MFA enable / regenerate.
 * Shared by the Settings → Security section and the forced MFA-enrollment
 * gate so the "save your codes" UX stays identical in both places.
 */
export default function RecoveryCodes({ codes, onDone }) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard?.writeText(codes.join('\n'));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-[var(--text-secondary)]">
                    {t('mfa.save_recovery_codes', 'Save these one-time recovery codes somewhere safe. Each can be used once if you lose access to your authenticator. They won’t be shown again.')}
                </p>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {codes.map(c => (
                    <div key={c} className="px-2 py-1.5 rounded bg-[var(--bg-primary)] text-center text-[var(--text-primary)] select-all">{c}</div>
                ))}
            </div>
            <div className="flex gap-2">
                <button onClick={copy} className="flex-1 py-2 rounded-lg border border-[var(--border-default)] text-sm font-medium text-[var(--text-primary)] flex items-center justify-center gap-2">
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />} {copied ? t('common.copied', 'Copied') : t('common.copy', 'Copy')}
                </button>
                <button onClick={onDone} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'var(--accent-primary)' }}>
                    {t('mfa.ive_saved_them', 'I’ve saved them')}
                </button>
            </div>
        </div>
    );
}
