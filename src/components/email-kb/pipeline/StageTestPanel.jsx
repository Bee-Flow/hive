import React, { useState } from 'react';
import { Play, Loader2, Check, X, RotateCcw, ChevronDown, AlertTriangle } from 'lucide-react';
import { api } from '../utils';

const TIER_OPTIONS = ['fast', 'thinking', 'writer', 'deep_thinking'];

/**
 * Try-this-stage panel.
 *
 * Lets the admin run one pipeline stage on either (a) the latest email in the
 * connected mailbox or (b) their own pasted text. Shows input + output + config.
 * On unexpected output, user can invoke an AI assistant (at a user-chosen model
 * tier) that proposes an improved system prompt.
 *
 * Props:
 *   - connectionId
 *   - stageKey:  'article'|'category'|'merge' (passed as `stage` to backend)
 *   - currentPrompt:  current system prompt in the settings state (possibly unsaved)
 *   - currentModelTier: currently configured tier for this stage
 *   - onAcceptPrompt(newPrompt): called when user clicks "Use this prompt" — writes back into the form
 *   - t:  translator
 */
const StageTestPanel = ({ connectionId, stageKey, currentPrompt, currentModelTier, onAcceptPrompt, t }) => {
    // Dedupe needs 2+ pre-merged chunk outputs — sampling the latest email
    // doesn't make sense. Default to custom mode in that case.
    const defaultMode = stageKey === 'dedupe' ? 'custom' : 'sample';
    const [mode, setMode] = useState(defaultMode);
    const [customInput, setCustomInput] = useState('');
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    // AI-assist
    const [assistOpen, setAssistOpen] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [assistTier, setAssistTier] = useState('thinking');
    const [assistLoading, setAssistLoading] = useState(false);
    const [assistResult, setAssistResult] = useState(null);
    const [assistError, setAssistError] = useState(null);

    const canAssist = ['article', 'category', 'merge', 'dedupe'].includes(stageKey);
    const customPlaceholder = stageKey === 'dedupe'
        ? t('ticket_assistant.dedupe_test_placeholder')
        : t('ticket_assistant.custom_input_placeholder');
    const canSampleMode = stageKey !== 'dedupe';

    const runStage = async (withCustom) => {
        setRunning(true);
        setError(null);
        setResult(null);
        setAssistOpen(false);
        setAssistResult(null);
        try {
            const body = {
                stage: stageKey,
                overrides: { modelTier: currentModelTier, systemPrompt: currentPrompt || undefined },
            };
            if (withCustom) body.input = customInput;
            const res = await api(`/connections/${connectionId}/pipeline/run-stage`, {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (res.error) setError(res.error);
            setResult(res);
        } catch (err) {
            setError(err.message);
        } finally {
            setRunning(false);
        }
    };

    const runAssist = async () => {
        setAssistLoading(true);
        setAssistError(null);
        setAssistResult(null);
        try {
            const sampleInput = pickInputText(result);
            const sampleOutput = pickOutputText(result);
            const res = await api(`/connections/${connectionId}/pipeline/ai-assist`, {
                method: 'POST',
                body: JSON.stringify({
                    stage: stageKey,
                    currentPrompt: currentPrompt || '',
                    sampleInput,
                    sampleOutput,
                    userFeedback: feedback,
                    modelTier: assistTier,
                }),
            });
            setAssistResult(res);
        } catch (err) {
            setAssistError(err.message);
        } finally {
            setAssistLoading(false);
        }
    };

    return (
        <div className="mt-3 p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            <div className="flex items-center justify-between">
                <div className="text-[12px] font-semibold text-[var(--text-primary)]">{t('ticket_assistant.try_stage')}</div>
                <div className="flex items-center gap-1 text-[11px]">
                    {canSampleMode && (
                        <button
                            onClick={() => setMode('sample')}
                            className={`px-2 py-0.5 rounded transition-colors ${mode === 'sample' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                        >Sample</button>
                    )}
                    <button
                        onClick={() => setMode('custom')}
                        className={`px-2 py-0.5 rounded transition-colors ${mode === 'custom' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                    >Custom</button>
                </div>
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{t('ticket_assistant.try_stage_desc')}</p>

            {mode === 'custom' && (
                <textarea
                    value={customInput}
                    onChange={e => setCustomInput(e.target.value)}
                    placeholder={customPlaceholder}
                    rows={5}
                    className="w-full mt-2 px-2 py-1.5 rounded text-[11px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] resize-y font-mono"
                />
            )}

            <div className="flex items-center gap-2 mt-2">
                <button
                    onClick={() => runStage(mode === 'custom')}
                    disabled={running || (mode === 'custom' && customInput.trim().length < 3)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50 shadow-sm transition-all"
                >
                    {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    {running ? t('ticket_assistant.stage_running') : (mode === 'custom' ? t('ticket_assistant.run_custom') : t('ticket_assistant.run_sample'))}
                </button>
                {result?.tookMs != null && (
                    <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">
                        {t('ticket_assistant.stage_took')} {result.tookMs}ms
                    </span>
                )}
            </div>

            {error && (
                <div className="mt-2 flex items-center gap-2 p-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-700">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
                </div>
            )}
            {result?.error && !error && (
                <div className="mt-2 flex items-center gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {result.error}
                </div>
            )}

            {result && !result.error && <ResultView result={result} t={t} />}

            {result && !result.error && canAssist && (
                <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
                    {!assistOpen ? (
                        <button
                            onClick={() => setAssistOpen(true)}
                            className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--accent-primary)] hover:underline"
                        >
                            {t('ticket_assistant.ask_ai_to_fix')}
                        </button>
                    ) : (
                        <AssistPanel
                            t={t}
                            feedback={feedback}
                            setFeedback={setFeedback}
                            tier={assistTier}
                            setTier={setAssistTier}
                            loading={assistLoading}
                            result={assistResult}
                            error={assistError}
                            onRun={runAssist}
                            onCancel={() => { setAssistOpen(false); setAssistResult(null); setFeedback(''); }}
                            onAccept={(newPrompt) => {
                                onAcceptPrompt(newPrompt);
                                setAssistOpen(false);
                                setAssistResult(null);
                                setFeedback('');
                            }}
                            onRefine={() => setAssistResult(null)}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

const pickInputText = (result) => {
    if (!result?.input) return '';
    if (typeof result.input === 'string') return result.input;
    return result.input.preprocessed || result.input.articleText || result.input.body || '';
};

const pickOutputText = (result) => {
    if (!result?.output) return '';
    const o = result.output;
    if (typeof o === 'string') return o;
    if (o.article) return o.article;
    if (o.category) return o.category;
    if (o.cleaned) return o.cleaned;
    if (o.after) return o.after;
    if (typeof o.merged === 'string') return o.merged;
    if (o.merged) return JSON.stringify(o.merged, null, 2);
    return JSON.stringify(o, null, 2);
};

const ResultView = ({ result, t }) => {
    const { input, output, config, source } = result;
    return (
        <div className="mt-3 space-y-2.5">
            <details className="rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)]" open={false}>
                <summary className="cursor-pointer px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5">
                        <ChevronDown className="w-3 h-3" />
                        {t('ticket_assistant.stage_input')}
                        {source === 'sample' && (
                            <span className="text-[10px] font-normal text-[var(--text-tertiary)]">
                                · {t('ticket_assistant.stage_from_sample')}
                                {input?.sample?.subject ? `: "${input.sample.subject}"` : ''}
                            </span>
                        )}
                    </span>
                </summary>
                <div className="px-2.5 py-2 max-h-48 overflow-auto">
                    <pre className="text-[11px] whitespace-pre-wrap font-mono text-[var(--text-primary)]">
                        {pickInputText(result).slice(0, 4000) || '(empty)'}
                    </pre>
                </div>
            </details>

            <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                <div className="px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] flex items-center justify-between border-b border-[var(--border-subtle)]">
                    <span>{t('ticket_assistant.stage_output')}</span>
                    {config?.modelTier && (
                        <span className="text-[10px] font-normal text-[var(--text-tertiary)]">
                            {t('ticket_assistant.tier_' + config.modelTier)}
                        </span>
                    )}
                </div>
                <div className="px-2.5 py-2 max-h-64 overflow-auto">
                    <OutputBody output={output} />
                </div>
            </div>
        </div>
    );
};

const OutputBody = ({ output }) => {
    if (!output) return <span className="text-[11px] text-[var(--text-tertiary)] italic">(no output)</span>;
    if (output.reason && !output.article && !output.category) {
        return <div className="text-[11px] text-amber-700">{output.reason}</div>;
    }
    if (output.article && output.category) {
        return (
            <div className="space-y-2">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-amber-500/10 text-amber-700 font-medium">
                    {output.category}
                </div>
                <pre className="text-[11px] whitespace-pre-wrap text-[var(--text-primary)]">{output.article}</pre>
            </div>
        );
    }
    if (output.article) return <pre className="text-[11px] whitespace-pre-wrap text-[var(--text-primary)]">{output.article}</pre>;
    if (output.category) {
        return (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-amber-500/10 text-amber-700 font-medium">
                {output.category}
            </div>
        );
    }
    if (output.cleaned) return <pre className="text-[11px] whitespace-pre-wrap text-[var(--text-primary)]">{output.cleaned}</pre>;
    if (output.before && output.after) {
        const counts = output.counts ? Object.entries(output.counts).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(', ') : '';
        return (
            <div className="space-y-2">
                {counts && <div className="text-[10px] text-[var(--text-tertiary)]">Redacted: {counts}</div>}
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <div className="text-[10px] font-semibold text-[var(--text-secondary)] mb-1">Before</div>
                        <pre className="p-1.5 bg-[var(--bg-secondary)] rounded text-[10px] whitespace-pre-wrap max-h-40 overflow-auto">{output.before}</pre>
                    </div>
                    <div>
                        <div className="text-[10px] font-semibold text-[var(--text-secondary)] mb-1">After</div>
                        <pre className="p-1.5 bg-[var(--bg-secondary)] rounded text-[10px] whitespace-pre-wrap max-h-40 overflow-auto">{output.after}</pre>
                    </div>
                </div>
            </div>
        );
    }
    if (output.merged) {
        // Dedupe stage returns a raw Markdown string; merge stage may return an array.
        if (typeof output.merged === 'string') {
            return <pre className="text-[11px] whitespace-pre-wrap text-[var(--text-primary)]">{output.merged}</pre>;
        }
        return <pre className="text-[11px] whitespace-pre-wrap text-[var(--text-primary)]">{JSON.stringify(output.merged, null, 2)}</pre>;
    }
    return <pre className="text-[11px] whitespace-pre-wrap text-[var(--text-primary)]">{JSON.stringify(output, null, 2)}</pre>;
};

const AssistPanel = ({ t, feedback, setFeedback, tier, setTier, loading, result, error, onRun, onCancel, onAccept, onRefine }) => (
    <div className="space-y-2">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-primary)]">
                {t('ticket_assistant.ai_assist_title')}
            </div>
            <button onClick={onCancel} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                <X className="w-3.5 h-3.5" />
            </button>
        </div>

        {!result && (
            <>
                <div>
                    <label className="text-[11px] font-medium text-[var(--text-secondary)] mb-1 block">
                        {t('ticket_assistant.ai_assist_feedback')}
                    </label>
                    <textarea
                        value={feedback}
                        onChange={e => setFeedback(e.target.value)}
                        placeholder={t('ticket_assistant.ai_assist_feedback_placeholder')}
                        rows={3}
                        className="w-full px-2 py-1.5 rounded text-[11px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] resize-y"
                    />
                </div>
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[11px]">
                        <label className="text-[var(--text-secondary)]">{t('ticket_assistant.ai_assist_model')}:</label>
                        <select value={tier} onChange={e => setTier(e.target.value)}
                            className="px-2 py-0.5 rounded text-[11px] bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
                            {TIER_OPTIONS.map(t_ => (
                                <option key={t_} value={t_}>{t('ticket_assistant.tier_' + t_)}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={onRun}
                        disabled={loading || feedback.trim().length < 3}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50"
                    >
                        {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                        {loading ? t('ticket_assistant.ai_assist_running') : t('ticket_assistant.ai_assist_run')}
                    </button>
                </div>
                {error && (
                    <div className="flex items-center gap-2 p-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-700">
                        <AlertTriangle className="w-3.5 h-3.5" /> {error}
                    </div>
                )}
            </>
        )}

        {result && (
            <div className="space-y-2">
                <div className="rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                    <div className="px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] flex items-center justify-between">
                        <span>{t('ticket_assistant.ai_assist_proposed')}</span>
                        {result.modelUsed && (
                            <span className="text-[10px] font-normal text-[var(--text-tertiary)]">
                                {t('ticket_assistant.ai_assist_model_used')}: {result.modelUsed}
                            </span>
                        )}
                    </div>
                    <pre className="px-2.5 py-2 text-[11px] whitespace-pre-wrap max-h-64 overflow-auto text-[var(--text-primary)] font-mono">
                        {result.proposedPrompt}
                    </pre>
                </div>
                {result.reasoning && (
                    <div className="p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-subtle)]">
                        <div className="text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] mb-1">
                            {t('ticket_assistant.ai_assist_reasoning')}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)]">{result.reasoning}</div>
                    </div>
                )}
                <div className="flex items-center justify-end gap-2">
                    <button onClick={onRefine}
                        className="flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]">
                        <RotateCcw className="w-3 h-3" /> {t('ticket_assistant.ai_assist_refine')}
                    </button>
                    <button onClick={onCancel}
                        className="px-3 py-1.5 rounded text-[11px] font-medium text-[var(--text-tertiary)] hover:bg-[var(--bg-primary)]">
                        {t('ticket_assistant.ai_assist_discard')}
                    </button>
                    <button onClick={() => onAccept(result.proposedPrompt)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-semibold bg-[var(--accent-primary)] text-white hover:opacity-90">
                        <Check className="w-3 h-3" /> {t('ticket_assistant.ai_assist_accept')}
                    </button>
                </div>
            </div>
        )}
    </div>
);

export default StageTestPanel;
