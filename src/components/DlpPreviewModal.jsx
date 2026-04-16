/**
 * DLP Preview Modal — shown when the server emits a `dlp_preview` event,
 * i.e. the user's prompt contains sensitive content AND the org's DLP mode
 * is 'ask'. Lets the user pick Redact / Block / Allow before the prompt
 * is sent to an external LLM.
 */

import React, { useMemo } from 'react';
import { ShieldAlert, Eye, X, Send, Lock } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import useDlpDecision from '../hooks/useDlpDecision';

function groupFindings(findings) {
    const map = new Map();
    for (const f of findings || []) {
        const key = f.label || f.category || 'Other';
        const entry = map.get(key) || { label: key, source: f.source, count: 0 };
        entry.count++;
        map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
}

export default function DlpPreviewModal() {
    const { t } = useTranslation();
    const { pending, submit, cancel, submitting, error } = useDlpDecision();
    const [remember, setRemember] = React.useState(false);

    const grouped = useMemo(() => groupFindings(pending?.findings), [pending]);

    if (!pending) return null;

    const provider = pending.provider || {};
    const providerLabel = provider.displayName || 'external provider';

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dlp-preview-title"
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)', animation: 'overlayIn .15s ease-out' }}
        >
            <div
                className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
                style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-default)',
                    animation: 'overlayContentIn .2s ease-out',
                }}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b flex items-start gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(234, 88, 12, 0.12)' }}>
                        <ShieldAlert className="w-5 h-5" style={{ color: '#ea580c' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 id="dlp-preview-title" className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {t('dlp.preview_title', 'Sensitive content detected')}
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {t('dlp.preview_subtitle', 'This prompt will be sent to')}{' '}
                            <strong style={{ color: 'var(--text-primary)' }}>{providerLabel}</strong>
                            {provider.isExternal !== false && (
                                <span className="ml-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(234, 88, 12, 0.12)', color: '#ea580c' }}>
                                    <Lock className="w-2.5 h-2.5" />
                                    {t('dlp.external_badge', 'external')}
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Findings list */}
                <div className="px-5 py-4">
                    <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                        {t('dlp.findings_title', 'Detected items')}
                    </div>
                    <ul className="space-y-1.5">
                        {grouped.map(({ label, source, count }) => (
                            <li key={label} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                                <span className="flex items-center gap-2 min-w-0">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-medium shrink-0" style={{
                                        background: source === 'custom' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                                        color: source === 'custom' ? '#8b5cf6' : '#3b82f6',
                                    }}>
                                        {source === 'custom' ? t('dlp.source_custom', 'custom') : t('dlp.source_pii', 'pii')}
                                    </span>
                                    <span className="truncate" style={{ color: 'var(--text-primary)' }}>{label}</span>
                                </span>
                                <span className="text-xs shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>×{count}</span>
                            </li>
                        ))}
                    </ul>

                    {/* Remember toggle */}
                    <label className="flex items-center gap-2 mt-4 text-xs cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
                        <input
                            type="checkbox"
                            checked={remember}
                            onChange={(e) => setRemember(e.target.checked)}
                            className="rounded"
                        />
                        {t('dlp.remember_label', 'Remember my choice for this conversation')}
                    </label>

                    {error && (
                        <div className="mt-3 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}>
                            {error}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="px-5 py-3 border-t flex items-center gap-2 justify-end" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                    <button
                        onClick={() => submit('block')}
                        disabled={submitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        style={{ color: '#dc2626', background: 'rgba(239, 68, 68, 0.08)' }}
                    >
                        <X className="w-3.5 h-3.5" />
                        {t('dlp.action_block', 'Block')}
                    </button>
                    <button
                        onClick={() => submit('allow', { rememberForConversation: remember })}
                        disabled={submitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}
                        title={t('dlp.action_allow_tooltip', 'Send the prompt unchanged')}
                    >
                        <Send className="w-3.5 h-3.5" />
                        {t('dlp.action_allow', 'Send anyway')}
                    </button>
                    <button
                        onClick={() => submit('redact', { rememberForConversation: remember })}
                        disabled={submitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        <Eye className="w-3.5 h-3.5" />
                        {t('dlp.action_redact', 'Redact and send')}
                    </button>
                </div>
            </div>
        </div>
    );
}
