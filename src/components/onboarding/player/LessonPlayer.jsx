import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, ArrowRight, Check, Lock, PartyPopper } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import {
    getLesson,
    resolveLessonPlayerSteps,
    registerEphemeralTour,
    clearEphemeralTour,
    TOUR_START_EVENT,
    LESSON_COMPLETE_EVENT,
} from '../lessons';
import { stepType, STEP_TYPES, stepIsRequired } from '../stepTypes';
import { markLessonComplete, saveStepState, readStepState } from '../learningProgress';
import SlideStep from './SlideStep';
import QuizStep from './QuizStep';
import ExerciseStep from './ExerciseStep';

/**
 * LessonPlayer — the focused surface for a rich lesson (slides / quizzes / AI-graded
 * exercises). Live-app "tour" steps are NOT rendered here: the player slices the
 * contiguous run of tour steps, registers it as an ephemeral tour, hands off to the
 * existing OnboardingTour engine (TOUR_START_EVENT), renders nothing while the
 * spotlight runs, and resumes when the engine fires LESSON_COMPLETE_EVENT for that
 * ephemeral id. This keeps OnboardingTour.jsx unchanged.
 *
 * Props:
 *   lessonId, courseId — what to play
 *   user               — current user (gates Studio-only steps, scopes progress)
 *   modelTier          — tier for the AI coach (default 'fast')
 *   onClose()          — dismiss the player (progress already saved per step)
 *   onComplete(id) -> Promise<{ newBadges, courseComplete, courseTitle }|void>
 *                      — called after the lesson is marked complete; the host
 *                        returns celebration info to show on the final screen.
 */
export default function LessonPlayer({ lessonId, user, modelTier = 'fast', onClose, onComplete }) {
    const { t } = useTranslation();
    const lesson = useMemo(() => getLesson(lessonId), [lessonId]);
    const steps = useMemo(() => resolveLessonPlayerSteps(lessonId, user), [lessonId, user]);

    const [stepIndex, setStepIndex] = useState(0);
    const [statusMap, setStatusMap] = useState(() => readStepState(user, lessonId));
    const [handoff, setHandoff] = useState(null); // { ephemeralId, resumeIndex }
    const [finished, setFinished] = useState(false);
    const [celebration, setCelebration] = useState(null);

    const handoffRef = useRef(null);
    useEffect(() => { handoffRef.current = handoff; }, [handoff]);

    const step = steps[stepIndex] || null;
    const total = steps.length;

    const recordStatus = useCallback((stepId, state) => {
        setStatusMap((prev) => ({ ...prev, [stepId]: state }));
        saveStepState(user, lessonId, stepId, state);
    }, [user, lessonId]);

    // Whether the learner may advance past the current step.
    const canAdvance = useCallback((s) => {
        if (!s) return false;
        const ty = stepType(s);
        if (ty === STEP_TYPES.SLIDE || ty === STEP_TYPES.TOUR) return true;
        if (!stepIsRequired(s)) return true;
        const st = statusMap[s.id]?.status;
        if (ty === STEP_TYPES.QUIZ) return st === 'passed';
        if (ty === STEP_TYPES.EXERCISE) return st === 'passed' || st === 'skipped';
        return true;
    }, [statusMap]);

    const finishLesson = useCallback(async () => {
        setFinished(true);
        try { await markLessonComplete(user, lessonId); } catch (_) { /* best-effort */ }
        try { window.dispatchEvent(new CustomEvent(LESSON_COMPLETE_EVENT, { detail: { lessonId } })); } catch (_) { /* ignore */ }
        try {
            const info = onComplete ? await onComplete(lessonId) : null;
            if (info) setCelebration(info);
        } catch (_) { /* non-fatal */ }
    }, [user, lessonId, onComplete]);

    const goToIndex = useCallback((idx) => {
        if (idx >= total) { finishLesson(); return; }
        setStepIndex(Math.max(0, idx));
    }, [total, finishLesson]);

    const advance = useCallback(() => {
        if (!canAdvance(step)) return;
        goToIndex(stepIndex + 1);
    }, [canAdvance, step, goToIndex, stepIndex]);

    const back = useCallback(() => {
        if (handoff) return;
        setStepIndex((i) => Math.max(0, i - 1));
    }, [handoff]);

    // When the current step is a live tour step, gather the contiguous run and hand
    // it off to the engine.
    useEffect(() => {
        if (finished || handoff) return;
        const cur = steps[stepIndex];
        if (!cur || stepType(cur) !== STEP_TYPES.TOUR) return;
        let end = stepIndex;
        while (end < steps.length && stepType(steps[end]) === STEP_TYPES.TOUR) end += 1;
        const run = steps.slice(stepIndex, end);
        const ephemeralId = registerEphemeralTour(run);
        setHandoff({ ephemeralId, resumeIndex: end });
    }, [stepIndex, steps, handoff, finished]);

    // Dispatch the handoff AFTER our chrome unmounts (render returns null while
    // handoff is set), so the spotlight isn't hidden behind the player backdrop.
    useEffect(() => {
        if (!handoff) return undefined;
        const raf = requestAnimationFrame(() => {
            try { window.dispatchEvent(new CustomEvent(TOUR_START_EVENT, { detail: { lessonId: handoff.ephemeralId } })); } catch (_) { /* ignore */ }
        });
        return () => cancelAnimationFrame(raf);
    }, [handoff]);

    // Resume when the engine finishes our ephemeral tour segment.
    useEffect(() => {
        const onDone = (e) => {
            const id = e?.detail?.lessonId;
            const h = handoffRef.current;
            if (h && id === h.ephemeralId) {
                clearEphemeralTour(id);
                setHandoff(null);
                goToIndex(h.resumeIndex);
            }
        };
        window.addEventListener(LESSON_COMPLETE_EVENT, onDone);
        return () => window.removeEventListener(LESSON_COMPLETE_EVENT, onDone);
    }, [goToIndex]);

    // Escape closes the player (per-step progress is already persisted).
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !handoff) { e.preventDefault(); onClose?.(); } };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, handoff]);

    // While a tour segment runs, the player gets out of the way entirely.
    if (handoff) return null;

    const title = lesson ? t(lesson.titleKey, lesson.titleFallback) : '';
    const isLast = stepIndex === total - 1;
    const advanceable = canAdvance(step);

    const renderStep = () => {
        if (!step) return null;
        switch (stepType(step)) {
            case STEP_TYPES.QUIZ:
                return <QuizStep step={step} lessonId={lessonId} saved={statusMap[step.id]} onPass={(s) => recordStatus(step.id, s)} />;
            case STEP_TYPES.EXERCISE:
                return <ExerciseStep step={step} saved={statusMap[step.id]} modelTier={modelTier} onState={(s) => recordStatus(step.id, s)} />;
            case STEP_TYPES.SLIDE:
            default:
                return <SlideStep step={step} />;
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
            onMouseDown={(e) => { if (e.target === e.currentTarget && !finished) onClose?.(); }}
            aria-live="polite">
            <div className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>

                {/* Header */}
                <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b" style={{ borderColor: 'var(--border-default)' }}>
                    <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--accent-primary)' }}>
                            {t('settings.learning_center', 'Learning Center')}
                        </div>
                        <h2 className="text-[15px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{title}</h2>
                    </div>
                    <button type="button" onClick={() => onClose?.()} aria-label={t('common.close', 'Close')}
                        className="p-1.5 rounded-lg flex-shrink-0 transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ color: 'var(--text-tertiary)' }}>
                        <X className="w-4.5 h-4.5" />
                    </button>
                </div>

                {/* Progress bar */}
                {!finished && (
                    <div className="flex items-center gap-1 px-5 pt-3" aria-hidden="true">
                        {steps.map((s, i) => (
                            <span key={s.id || i} className="h-1.5 flex-1 rounded-full transition-colors"
                                style={{ background: i < stepIndex ? 'var(--accent-primary)' : (i === stepIndex ? 'color-mix(in srgb, var(--accent-primary) 45%, transparent)' : 'var(--border-subtle)') }} />
                        ))}
                    </div>
                )}

                {/* Body */}
                <div className="px-5 py-4 overflow-y-auto">
                    {finished ? (
                        <CompletionScreen t={t} celebration={celebration} />
                    ) : renderStep()}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--border-default)', background: 'color-mix(in srgb, var(--bg-tertiary) 40%, transparent)' }}>
                    {finished ? (
                        <>
                            <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }} />
                            <button type="button" onClick={() => onClose?.()}
                                className="px-4 py-2 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5"
                                style={{ background: 'var(--accent-primary)', color: 'var(--accent-primary-fg, #fff)' }}>
                                {t('learn.player.done', 'Done')} <Check className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-2">
                                <span className="text-[12px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                                    {t('tour.step_counter', 'Step {n} of {total}').replace('{n}', String(stepIndex + 1)).replace('{total}', String(total))}
                                </span>
                                {stepIndex > 0 && (
                                    <button type="button" onClick={back}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
                                        style={{ color: 'var(--text-secondary)' }}>
                                        <ArrowLeft className="w-3.5 h-3.5" /> {t('tour.back', 'Back')}
                                    </button>
                                )}
                            </div>
                            <button type="button" onClick={advance} disabled={!advanceable}
                                className="px-4 py-2 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5 transition-opacity disabled:opacity-40"
                                style={{ background: 'var(--accent-primary)', color: 'var(--accent-primary-fg, #fff)' }}
                                title={!advanceable ? t('learn.player.complete_to_continue', 'Complete this step to continue') : undefined}>
                                {!advanceable && stepIsRequired(step) && <Lock className="w-3.5 h-3.5" />}
                                {isLast ? t('learn.player.finish', 'Finish lesson') : t('tour.next', 'Next')}
                                {advanceable && <ArrowRight className="w-4 h-4" />}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}

function CompletionScreen({ t, celebration }) {
    const newBadges = celebration?.newBadges || [];
    return (
        <div className="py-6 text-center">
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-3"
                style={{ background: 'color-mix(in srgb, var(--accent-primary) 16%, transparent)' }}>
                🎉
            </div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {t('learn.player.lesson_complete', 'Lesson complete!')}
            </h3>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {t('learn.player.lesson_complete_sub', 'Nice work. Your progress is saved.')}
            </p>

            {newBadges.length > 0 && (
                <div className="mt-5 p-4 rounded-xl border inline-flex flex-col items-center gap-2"
                    style={{ borderColor: 'var(--accent-primary)', background: 'color-mix(in srgb, var(--accent-primary) 8%, transparent)' }}>
                    <div className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--accent-primary)' }}>
                        <PartyPopper className="w-4 h-4" /> {t('learn.player.badge_earned', 'Badge earned')}
                    </div>
                    {newBadges.map((b) => (
                        <div key={b.id || b.badgeId} className="flex items-center gap-2">
                            <span className="text-2xl" aria-hidden="true">{b.icon || '🏅'}</span>
                            <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
                                {t(b.titleKey, b.titleFallback || b.title)}
                            </span>
                        </div>
                    ))}
                    {celebration?.courseComplete && celebration?.courseTitle && (
                        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                            {t('learn.player.course_complete', 'You completed {course}.').replace('{course}', celebration.courseTitle)}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
