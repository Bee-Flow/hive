import React, { useState } from 'react';
import { Check, ArrowUpRight, Sparkles, Loader2, RotateCcw, Lightbulb } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { gradeExercise, getHint } from '../exerciseCoach';

// Small circular score gauge (0–100). Amber for partial, green on pass. Never
// purple. A null score (coach unavailable) renders a neutral dash.
function ScoreRing({ score, passed }) {
    const r = 26;
    const c = 2 * Math.PI * r;
    const pct = typeof score === 'number' ? Math.max(0, Math.min(100, score)) : 0;
    const dash = (pct / 100) * c;
    const color = passed ? '#15803d' : (typeof score === 'number' ? 'var(--accent-primary)' : 'var(--border-default)');
    return (
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="6" />
            <circle
                cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${dash} ${c}`} transform="rotate(-90 32 32)"
                style={{ transition: 'stroke-dasharray .5s ease' }}
            />
            <text x="32" y="37" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--text-primary)">
                {typeof score === 'number' ? score : '—'}
            </text>
        </svg>
    );
}

/**
 * ExerciseStep — a free-text prompt the AI coach grades. This is the "AI watching
 * the learner and giving pointers" surface. Soft gate: a passing score unlocks
 * Next; after `maxAttempts` the learner can also skip ahead so a flaky grader can
 * never trap them.
 *
 * Props:
 *   step      — exercise step descriptor (exerciseId, instruction, passScore, maxAttempts)
 *   saved     — resume state { submission, attempts, status, score, feedback, ... }
 *   modelTier — user/org-selected tier for the coach call
 *   onState   — called with the recorded state after each grade / skip
 */
export default function ExerciseStep({ step, saved, modelTier = 'fast', onState }) {
    const { t, locale } = useTranslation();
    const maxAttempts = step.maxAttempts || 4;

    const [text, setText] = useState(saved?.submission ?? step.starter ?? '');
    const [attempts, setAttempts] = useState(saved?.attempts || 0);
    const [grading, setGrading] = useState(false);
    const [result, setResult] = useState(
        saved && (saved.status === 'passed' || saved.status === 'failed')
            ? { score: saved.score ?? null, passed: saved.status === 'passed', feedback: saved.feedback || '', strengths: saved.strengths || [], improvements: saved.improvements || [], error: null }
            : null,
    );
    const [hint, setHint] = useState(null);
    const [hinting, setHinting] = useState(false);

    const passed = result?.passed;
    const canSkip = !passed && attempts >= maxAttempts;

    const submit = async () => {
        if (grading || passed) return;
        setGrading(true);
        setHint(null);
        const r = await gradeExercise({ exerciseId: step.exerciseId, submission: text, modelTier, locale });
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        setResult(r);
        setGrading(false);
        onState?.({
            status: r.passed ? 'passed' : 'failed',
            score: r.score, submission: text, attempts: nextAttempts,
            feedback: r.feedback, strengths: r.strengths, improvements: r.improvements,
            answeredAt: new Date().toISOString(),
        });
    };

    const askHint = async () => {
        if (hinting) return;
        setHinting(true);
        const { hint: h } = await getHint({ exerciseId: step.exerciseId, submission: text, modelTier, locale });
        setHint(h);
        setHinting(false);
    };

    const skip = () => onState?.({ status: 'skipped', submission: text, attempts });

    return (
        <div>
            <div className="flex items-start gap-3 mb-2">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--accent-primary) 14%, transparent)' }}
                    aria-hidden="true"
                >
                    {step.icon || '🎯'}
                </div>
                <div className="pt-0.5">
                    <h2 className="text-base font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
                        {t(step.titleKey, step.titleFallback)}
                    </h2>
                    <p className="text-[13px] mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {t(step.instructionKey, step.instructionFallback)}
                    </p>
                </div>
            </div>

            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={passed}
                rows={5}
                placeholder={t(step.placeholderKey, step.placeholderFallback)}
                className="w-full mt-2 px-3.5 py-3 rounded-lg border text-[13px] leading-relaxed resize-y outline-none focus:ring-2"
                style={{
                    borderColor: 'var(--border-default)', background: 'var(--bg-card)',
                    color: 'var(--text-primary)', minHeight: 110,
                    '--tw-ring-color': 'color-mix(in srgb, var(--accent-primary) 35%, transparent)',
                }}
            />

            {hint && (
                <div className="mt-2 px-3.5 py-2.5 rounded-lg text-[13px] flex items-start gap-2"
                    style={{ background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)', color: 'var(--text-secondary)' }}>
                    <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} />
                    <span><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('learn.exercise.hint', 'Hint: ')}</span>{hint}</span>
                </div>
            )}

            <div className="mt-3 flex items-center gap-2 flex-wrap">
                {!passed && (
                    <button
                        type="button"
                        onClick={submit}
                        disabled={grading || text.trim().length < 3}
                        className="px-4 py-2 rounded-lg text-[13px] font-semibold inline-flex items-center gap-2 transition-opacity disabled:opacity-40"
                        style={{ background: 'var(--accent-primary)', color: 'var(--accent-primary-fg, #fff)' }}
                    >
                        {grading
                            ? (<><Loader2 className="w-4 h-4 animate-spin" /> {t('learn.exercise.reviewing', 'Reviewing…')}</>)
                            : (<><Sparkles className="w-4 h-4" /> {attempts > 0 ? t('learn.exercise.resubmit', 'Submit again') : t('learn.exercise.submit', 'Submit for review')}</>)}
                    </button>
                )}
                {!passed && (
                    <button
                        type="button"
                        onClick={askHint}
                        disabled={hinting}
                        className="px-3 py-2 rounded-lg text-[13px] font-medium inline-flex items-center gap-1.5 border transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'transparent' }}
                    >
                        {hinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
                        {t('learn.exercise.get_hint', 'Get a hint')}
                    </button>
                )}
                {canSkip && (
                    <button
                        type="button"
                        onClick={skip}
                        className="px-3 py-2 rounded-lg text-[12px] font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ color: 'var(--text-tertiary)', background: 'transparent' }}
                    >
                        {t('learn.exercise.skip', 'Skip this one')}
                    </button>
                )}
            </div>

            {result && (
                <div className="mt-4 p-4 rounded-xl border" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}>
                    <div className="flex items-start gap-4">
                        <ScoreRing score={result.score} passed={result.passed} />
                        <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold mb-1" style={{ color: result.passed ? '#15803d' : 'var(--text-primary)' }}>
                                {result.passed
                                    ? t('learn.exercise.passed', 'Great work — you nailed it!')
                                    : (result.error ? t('learn.exercise.coach_issue', 'Coach unavailable') : t('learn.exercise.keep_going', 'Close — tighten it up and resubmit'))}
                            </div>
                            {result.feedback && (
                                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{result.feedback}</p>
                            )}
                        </div>
                    </div>

                    {(result.strengths?.length > 0 || result.improvements?.length > 0) && (
                        <div className="mt-3 grid sm:grid-cols-2 gap-3">
                            {result.strengths?.length > 0 && (
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                                        {t('learn.exercise.strengths', 'What worked')}
                                    </div>
                                    <ul className="flex flex-col gap-1.5">
                                        {result.strengths.map((s, i) => (
                                            <li key={i} className="text-[12.5px] flex items-start gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                                                <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#15803d' }} /> {s}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {result.improvements?.length > 0 && (
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                                        {t('learn.exercise.improvements', 'To improve')}
                                    </div>
                                    <ul className="flex flex-col gap-1.5">
                                        {result.improvements.map((s, i) => (
                                            <li key={i} className="text-[12.5px] flex items-start gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                                                <ArrowUpRight className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent-primary)' }} /> {s}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
