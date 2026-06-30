import React, { useMemo, useState } from 'react';
import { Check, X, RotateCcw, Loader2 } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../utils/helpers';

/**
 * QuizStep — a multiple-choice knowledge check. Single-answer by default; set
 * `step.multi` for "select all that apply". The player gates Next on a pass.
 *
 * Built-in quizzes carry their answer key (`choice.correct`) and grade locally.
 * Org-authored quizzes are `step.serverGraded`: the key never reaches the
 * client, so the answer is checked via POST /ai/learning/quiz/grade and the
 * correct ids are only revealed by the server on a pass.
 *
 * Props:
 *   step      — quiz step descriptor
 *   lessonId  — owning lesson (needed for server grading)
 *   saved     — previously recorded { status:'passed', choiceIds } (for resume)
 *   onPass    — called with the recorded state when the learner answers correctly
 */
export default function QuizStep({ step, lessonId, saved, onPass }) {
    const { t } = useTranslation();
    const multi = !!step.multi;
    const serverGraded = !!step.serverGraded;
    const localCorrectIds = useMemo(
        () => new Set((step.choices || []).filter((c) => c.correct).map((c) => c.id)),
        [step],
    );
    // For server-graded quizzes the key arrives with a passing verdict.
    const [revealedIds, setRevealedIds] = useState(() => new Set(saved?.correctChoiceIds || []));
    const correctIds = serverGraded ? revealedIds : localCorrectIds;

    const alreadyPassed = saved?.status === 'passed';
    const [selected, setSelected] = useState(() => new Set(saved?.choiceIds || []));
    const [result, setResult] = useState(alreadyPassed ? 'correct' : null); // null | 'correct' | 'wrong'
    const [checking, setChecking] = useState(false);

    const toggle = (id) => {
        if (result === 'correct') return;
        setResult(null);
        setSelected((prev) => {
            const next = new Set(multi ? prev : []);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const check = async () => {
        if (serverGraded) {
            if (checking) return;
            setChecking(true);
            try {
                const res = await authFetch(`${API_BASE}/ai/learning/quiz/grade`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lessonId, stepId: step.id, choiceIds: [...selected] }),
                });
                const body = await res.json().catch(() => null);
                if (res.ok && body?.correct) {
                    setRevealedIds(new Set(body.correctChoiceIds || [...selected]));
                    setResult('correct');
                    onPass?.({ status: 'passed', choiceIds: [...selected], correctChoiceIds: body.correctChoiceIds || [...selected], answeredAt: new Date().toISOString() });
                } else {
                    setResult('wrong');
                }
            } catch (_) {
                setResult('wrong');
            } finally {
                setChecking(false);
            }
            return;
        }
        const sameSize = selected.size === correctIds.size;
        const allRight = sameSize && [...selected].every((id) => correctIds.has(id));
        if (allRight) {
            setResult('correct');
            onPass?.({ status: 'passed', choiceIds: [...selected], answeredAt: new Date().toISOString() });
        } else {
            setResult('wrong');
        }
    };

    const explanation = t(step.explanationKey, step.explanationFallback);

    return (
        <div>
            <div className="flex items-start gap-3 mb-3">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--accent-primary) 14%, transparent)' }}
                    aria-hidden="true"
                >
                    {step.icon || '❓'}
                </div>
                <h2 className="text-base font-bold leading-snug pt-1.5" style={{ color: 'var(--text-primary)' }}>
                    {t(step.questionKey, step.questionFallback)}
                </h2>
            </div>

            {multi && (
                <p className="text-[12px] mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    {t('learn.quiz.select_all', 'Select all that apply.')}
                </p>
            )}

            <div className="flex flex-col gap-2">
                {(step.choices || []).map((c) => {
                    const isSelected = selected.has(c.id);
                    const showCorrect = result === 'correct' && correctIds.has(c.id);
                    const showWrong = result === 'wrong' && isSelected && !correctIds.has(c.id);
                    let borderColor = 'var(--border-default)';
                    let bg = 'var(--bg-card)';
                    if (showCorrect) { borderColor = '#15803d'; bg = 'color-mix(in srgb, #22c55e 12%, transparent)'; }
                    else if (showWrong) { borderColor = '#b91c1c'; bg = 'color-mix(in srgb, #ef4444 10%, transparent)'; }
                    else if (isSelected) { borderColor = 'var(--accent-primary)'; bg = 'color-mix(in srgb, var(--accent-primary) 10%, transparent)'; }
                    return (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => toggle(c.id)}
                            disabled={result === 'correct'}
                            className="text-left px-3.5 py-2.5 rounded-lg border text-[13px] flex items-start gap-2.5 transition-colors"
                            style={{ borderColor, background: bg, color: 'var(--text-primary)' }}
                        >
                            <span
                                className="mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0"
                                style={{ borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-default)' }}
                                aria-hidden="true"
                            >
                                {showCorrect && <Check className="w-3 h-3" style={{ color: '#15803d' }} />}
                                {showWrong && <X className="w-3 h-3" style={{ color: '#b91c1c' }} />}
                                {!showCorrect && !showWrong && isSelected && (
                                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-primary)' }} />
                                )}
                            </span>
                            <span>{t(c.labelKey, c.labelFallback)}</span>
                        </button>
                    );
                })}
            </div>

            {result && explanation && (
                <div
                    className="mt-3 px-3.5 py-2.5 rounded-lg text-[13px] leading-relaxed"
                    style={{
                        background: result === 'correct'
                            ? 'color-mix(in srgb, #22c55e 10%, transparent)'
                            : 'color-mix(in srgb, var(--accent-primary) 8%, transparent)',
                        color: 'var(--text-secondary)',
                    }}
                >
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {result === 'correct' ? t('learn.quiz.correct', 'Correct! ') : t('learn.quiz.not_quite', 'Not quite. ')}
                    </span>
                    {explanation}
                </div>
            )}

            <div className="mt-4">
                {result !== 'correct' ? (
                    <button
                        type="button"
                        onClick={check}
                        disabled={selected.size === 0 || checking}
                        className="px-4 py-2 rounded-lg text-[13px] font-semibold inline-flex items-center gap-2 transition-opacity disabled:opacity-40"
                        style={{ background: 'var(--accent-primary)', color: 'var(--accent-primary-fg, #fff)' }}
                    >
                        {checking
                            ? (<><Loader2 className="w-4 h-4 animate-spin" /> {t('learn.quiz.checking', 'Checking…')}</>)
                            : result === 'wrong'
                                ? (<><RotateCcw className="w-4 h-4" /> {t('learn.quiz.try_again', 'Try again')}</>)
                                : t('learn.quiz.check', 'Check answer')}
                    </button>
                ) : (
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: '#15803d' }}>
                        <Check className="w-4 h-4" /> {t('learn.quiz.passed', 'Nice — continue below.')}
                    </span>
                )}
            </div>
        </div>
    );
}
