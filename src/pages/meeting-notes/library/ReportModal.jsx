import { Copy, Loader2, Sparkles } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import Modal from '../../../components/shared/Modal';
import MarkdownRenderer from '../../../components/MarkdownRenderer';
import useTranslation from '../../../hooks/useTranslation';
import { reportMeetings } from '../lib/transcriptionsApi';

/**
 * Multi-meeting AI report: the user picked N notes in the library, asks one
 * question, and gets a cited markdown report back. One-shot, nothing persisted
 * — closing the modal discards the report.
 */
export default function ReportModal({ open, onClose, meetings = [] }) {
    const { t } = useTranslation();
    const [prompt, setPrompt] = useState('');
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!open) return;
        setPrompt('');
        setResult(null);
        setError(null);
        setBusy(false);
        setCopied(false);
    }, [open]);

    const PRESETS = [
        t('meeting_notes.report_preset_decisions', 'Summarize the key decisions and action items across these meetings'),
        t('meeting_notes.report_preset_themes', 'What themes keep coming back, and what changed between meetings?'),
        t('meeting_notes.report_preset_open', 'List everything that is still open or unresolved'),
    ];

    const generate = async (text) => {
        const question = String(text ?? prompt).trim();
        if (!question || busy) return;
        setPrompt(question);
        setBusy(true);
        setError(null);
        try {
            const res = await reportMeetings({ ids: meetings.map((m) => m.id), prompt: question });
            setResult(res);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const copy = async () => {
        if (!result?.report) return;
        try {
            await navigator.clipboard.writeText(result.report);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (_) { /* clipboard unavailable */ }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="lg"
            title={t('meeting_notes.report_title', 'Ask AI about these meetings')}
            description={meetings.map((m) => m.title).join(' · ')}
        >
            <div className="flex flex-col gap-3">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generate(); }
                    }}
                    placeholder={t('meeting_notes.report_placeholder', 'Ask a question or describe the report you want…')}
                    rows={2}
                    disabled={busy}
                    className="w-full resize-none px-3 py-2 rounded-xl text-sm border outline-none"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                />

                {!result && !busy && (
                    <div className="flex flex-wrap gap-2">
                        {PRESETS.map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => generate(p)}
                                className="text-left text-xs px-3 py-1.5 rounded-full border transition-colors hover:bg-[var(--bg-tertiary)]"
                                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => generate()}
                        disabled={busy || !prompt.trim()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {busy
                            ? t('meeting_notes.report_generating', 'Generating…')
                            : t('meeting_notes.report_generate', 'Generate report')}
                    </button>
                    {result && (
                        <button
                            type="button"
                            onClick={copy}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors hover:bg-[var(--bg-tertiary)]"
                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                        >
                            <Copy className="w-3.5 h-3.5" />
                            {copied ? t('meeting_notes.report_copied', 'Copied') : t('meeting_notes.report_copy', 'Copy')}
                        </button>
                    )}
                </div>

                {error && (
                    <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
                )}

                {result && (
                    <div
                        className="rounded-xl border px-4 py-3 max-h-[50vh] overflow-auto text-sm"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                    >
                        <MarkdownRenderer content={result.report} />
                        {!result.usedTranscripts && (
                            <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
                                {t('meeting_notes.report_summaries_note', 'Based on meeting summaries — the combined transcripts were too long to include in full.')}
                            </p>
                        )}
                        {result.truncatedNotes > 0 && (
                            <p className="text-[11px] mt-1" style={{ color: '#f59e0b' }}>
                                {t('meeting_notes.report_truncated_note', 'Some meetings were too long and were shortened for this report.')}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}
