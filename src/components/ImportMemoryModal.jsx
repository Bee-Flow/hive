import React, { useState } from 'react';
import { Copy, Check, X } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import { useTranslation } from '../hooks/useTranslation';

const EXPORT_PROMPT = `Export all of my stored memories and any context you've learned about me from past conversations. Preserve my words verbatim where possible, especially for instructions and preferences.

Group by category (if applicable, in this order):
- Instructions (standing rules — always/never do X)
- People (people I know or work with)
- Projects (project details, tech stacks, URLs)
- Preferences (settings, tone, formatting)
- Workflows (how I like to work)
- Facts (specific facts about me or my work)
- Context (general background)

Return one concise bullet per memory. Do not add commentary.`;

const ImportMemoryModal = ({ onClose, onImported }) => {
    const { t } = useTranslation();
    const [pasted, setPasted] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [copied, setCopied] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const canSubmit = pasted.trim().length > 0 && !submitting && !result;

    const copyPrompt = async () => {
        try {
            await navigator.clipboard.writeText(EXPORT_PROMPT);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (_) { /* ignore */ }
    };

    const submit = async () => {
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/agents/memory/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: pasted.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || `Import failed (HTTP ${res.status})`);
            setResult(data);
            onImported?.();
            setTimeout(() => { onClose?.(); }, 1800);
        } catch (e) {
            setError(e.message || String(e));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {t('settings.memory_import_modal_title', 'Import memory')}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-md transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Step 1 */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span
                                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                            >1</span>
                            <p className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
                                {t('settings.memory_import_step1', 'Copy this prompt into a chat with your other AI provider')}
                            </p>
                        </div>
                        <div className="relative">
                            <textarea
                                value={EXPORT_PROMPT}
                                readOnly
                                rows={6}
                                className="w-full rounded-lg p-3 pr-20 text-[12px] resize-none"
                                style={{
                                    background: 'var(--bg-primary)',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid var(--border-subtle)',
                                    fontFamily: 'inherit',
                                    lineHeight: 1.5,
                                    outline: 'none',
                                }}
                            />
                            <button
                                type="button"
                                onClick={copyPrompt}
                                className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                            >
                                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {copied
                                    ? t('settings.memory_import_copied', 'Copied')
                                    : t('settings.memory_import_copy', 'Copy')}
                            </button>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span
                                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold"
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                            >2</span>
                            <p className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
                                {t('settings.memory_import_step2', 'Paste results below to add to memory')}
                            </p>
                        </div>
                        <textarea
                            value={pasted}
                            onChange={e => setPasted(e.target.value)}
                            rows={7}
                            placeholder={t('settings.memory_import_placeholder', 'Paste your memory details here')}
                            disabled={submitting || !!result}
                            className="w-full rounded-lg p-3 text-[12px] resize-y"
                            style={{
                                background: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-subtle)',
                                fontFamily: 'inherit',
                                lineHeight: 1.5,
                                outline: 'none',
                            }}
                        />
                        <div className="flex justify-end mt-1">
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                {pasted.length.toLocaleString()} / 50,000
                            </span>
                        </div>
                    </div>

                    {error && (
                        <div className="text-[12px] rounded-lg p-2" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                            {error}
                        </div>
                    )}

                    {result && (
                        <div className="text-[12px] rounded-lg p-2" style={{ background: 'rgba(5, 150, 105, 0.1)', color: '#059669' }}>
                            {result.imported > 0
                                ? t('settings.memory_import_success', 'Added {count} memories').replace('{count}', String(result.imported))
                                : t('settings.memory_import_none', 'No memories could be extracted from the text.')}
                            {result.skipped > 0 && (
                                <span style={{ color: 'var(--text-muted)' }}> · {result.skipped} skipped</span>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 rounded-lg text-[13px] font-medium disabled:opacity-50"
                        style={{ color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                    >
                        {t('settings.memory_import_cancel', 'Cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!canSubmit}
                        className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {submitting
                            ? t('settings.memory_import_submitting', 'Importing…')
                            : t('settings.memory_import_submit', 'Add to memory')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportMemoryModal;
