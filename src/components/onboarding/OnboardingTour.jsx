import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../utils/helpers';
import scopedStorage from '../../utils/scopedStorage';
import { resolveTourSteps, TOUR_SEEN_KEY, TOUR_START_EVENT, TOUR_ENSURE_SIDEBAR_EVENT } from './tourSteps';

/**
 * OnboardingTour — a lightweight, dependency-free guided tour for new users.
 *
 * Spotlights real elements (sidebar nav, settings, the agent creator), drives
 * navigation where a stop lives on another view, and runs INTERACTIVE steps that
 * wait for the user to actually do something (type / submit) before advancing.
 * Completion is stored per-user, server-side (the database), via
 * POST /ai/user-settings; a localStorage flag is kept only as a same-browser
 * flash-guard so the tour doesn't briefly re-appear before the server responds.
 *
 * Reliability: the active step runs a requestAnimationFrame resolve+measure loop
 * that re-queries the selector every frame and only locks onto a node that is
 * actually showable (in the DOM, visible, non-zero box, on screen). This tracks
 * elements that mount late (lazy panels), move (sidebar width animation), get
 * replaced on re-render, or are duplicated off-screen (sidebar compact strip).
 * If a target can't be shown it falls back to a centered card.
 *
 * Props:
 *   user        — current user ({ id, permissions, orgRole, isAdmin, … })
 *   onNavigate  — App's navigateToPage(pageKey)
 *   currentPage — active page key; auto-start only fires on the chat home
 */
const CARD_WIDTH = 340;
const SPOTLIGHT_PAD = 8;
const EDGE = 16;
const DEFAULT_TIMEOUT = 3000;   // resolve timeout for static targets
const NAV_TIMEOUT = 6000;       // resolve timeout when the step navigates (lazy)

function isShowable(el) {
    if (!el || !document.body.contains(el)) return false;
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) return false;
    return true;
}

// First node matching the selector that is actually showable — guards against
// the sidebar's off-screen duplicate icons (the visible one wins).
function pickShowable(selector) {
    if (!selector) return null;
    let nodes;
    try { nodes = document.querySelectorAll(selector); } catch (e) { return null; }
    for (const n of nodes) if (isShowable(n)) return n;
    return null;
}

export default function OnboardingTour({ user, onNavigate, currentPage }) {
    const { t } = useTranslation();
    const [active, setActive] = useState(false);
    const [steps, setSteps] = useState([]);
    const [stepIndex, setStepIndex] = useState(0);
    const [rect, setRect] = useState(null); // target rect, or null → centered card

    const targetElRef = useRef(null);
    const navigatedRef = useRef(false);     // did we drive navigation this run?
    const agentCreatedRef = useRef(false);  // did the user actually create an agent?
    const cardRef = useRef(null);

    const step = steps[stepIndex] || null;

    const startTour = useCallback(() => {
        const resolved = resolveTourSteps(user);
        if (!resolved.length) return;
        navigatedRef.current = false;
        agentCreatedRef.current = false;
        setSteps(resolved);
        setStepIndex(0);
        setRect(null);
        setActive(true);
    }, [user]);

    // ── Persist + close ───────────────────────────────────────────────
    const finish = useCallback(async () => {
        setActive(false);
        setRect(null);
        targetElRef.current = null;
        try { if (user?.id) scopedStorage.setCurrentUser(user.id); } catch (e) { /* ignore */ }
        try { scopedStorage.setItem(TOUR_SEEN_KEY, '1'); } catch (e) { /* ignore */ }
        try {
            await authFetch(`${API_BASE}/ai/user-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [TOUR_SEEN_KEY]: true }),
            });
        } catch (e) { /* best-effort — local guard already set */ }
        if (navigatedRef.current && onNavigate) onNavigate('agents');
        navigatedRef.current = false;
    }, [onNavigate, user?.id]);

    const goNext = useCallback(() => {
        setStepIndex((i) => {
            if (i >= steps.length - 1) { finish(); return i; }
            return i + 1;
        });
    }, [steps.length, finish]);

    const goPrev = useCallback(() => {
        setStepIndex((i) => Math.max(0, i - 1));
    }, []);

    // ── Auto-start for first-time users (desktop, on the chat home only) ──
    const autoStartTriedRef = useRef(false);
    useEffect(() => {
        if (autoStartTriedRef.current) return;
        if (!user?.id) return;
        if (currentPage && currentPage !== 'agents') return; // wait until they're on chat
        if (typeof window !== 'undefined' && window.innerWidth < 768) { autoStartTriedRef.current = true; return; }
        autoStartTriedRef.current = true;
        let cancelled = false;
        try { scopedStorage.setCurrentUser(user.id); } catch (e) { /* ignore */ }
        try { if (scopedStorage.getItem(TOUR_SEEN_KEY) === '1') return; } catch (e) { /* ignore */ }

        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/ai/user-settings`);
                if (!res.ok || cancelled) return;
                const data = await res.json();
                if (data?.[TOUR_SEEN_KEY]) return;
                setTimeout(() => { if (!cancelled) startTour(); }, 900);
            } catch (e) { /* don't block the app on a settings fetch */ }
        })();
        return () => { cancelled = true; };
    }, [user?.id, currentPage, startTour]);

    // ── Replay on demand ───────────────────────────────────────────────
    useEffect(() => {
        const onStart = () => startTour();
        window.addEventListener(TOUR_START_EVENT, onStart);
        return () => window.removeEventListener(TOUR_START_EVENT, onStart);
    }, [startTour]);

    // ── Per-step: navigate, then a rAF resolve+measure loop ────────────
    useEffect(() => {
        if (!active || !step) return undefined;

        // Steps that need a precondition.
        if (step.requiresAgentCreated && !agentCreatedRef.current) { goNext(); return undefined; }
        if (step.ensureSidebarOpen) {
            try { window.dispatchEvent(new CustomEvent(TOUR_ENSURE_SIDEBAR_EVENT)); } catch (e) { /* ignore */ }
        }
        if (step.navigateTo && onNavigate) { navigatedRef.current = true; onNavigate(step.navigateTo); }

        // Centered step (no spotlight target).
        if (!step.target) { setRect(null); targetElRef.current = null; return undefined; }

        let cancelled = false;
        let raf = null;
        let acquired = false;
        const deadline = performance.now() + (step.timeoutMs || (step.navigateTo ? NAV_TIMEOUT : DEFAULT_TIMEOUT));

        const measure = (el) => {
            const r = el.getBoundingClientRect();
            setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        };

        const frame = () => {
            if (cancelled) return;
            const el = pickShowable(step.target);

            if (el) {
                if (targetElRef.current !== el) {
                    targetElRef.current = el;
                    if (!acquired) {
                        acquired = true;
                        try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) { /* ignore */ }
                    }
                }
                measure(el);
                raf = requestAnimationFrame(frame);
                return;
            }

            // Not currently showable.
            const stillExists = (() => { try { return !!document.querySelector(step.target); } catch (e) { return false; } })();

            // Interactive "targetGone": the element we were showing left the DOM
            // (e.g. the prompt box once the agent was created) → advance.
            if (acquired && step.advanceOn?.targetGone && !stillExists) {
                agentCreatedRef.current = true;
                goNext();
                return;
            }

            // Before lock-on, honour the resolve deadline.
            if (!acquired && performance.now() > deadline) {
                if (step.optional) { goNext(); return; }
                setRect(null); targetElRef.current = null; return; // graceful centered fallback
            }
            // Once acquired we keep tracking (the element may be re-mounting).
            raf = requestAnimationFrame(frame);
        };

        raf = requestAnimationFrame(frame);
        return () => { cancelled = true; if (raf) cancelAnimationFrame(raf); };
    }, [active, stepIndex, step, onNavigate, goNext]);

    // ── Keep glued on scroll / resize ──────────────────────────────────
    useEffect(() => {
        if (!active) return undefined;
        let frame = null;
        const reposition = () => {
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const el = targetElRef.current;
                if (el && isShowable(el)) {
                    const r = el.getBoundingClientRect();
                    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
                }
            });
        };
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
        return () => {
            if (frame) cancelAnimationFrame(frame);
            window.removeEventListener('resize', reposition);
            window.removeEventListener('scroll', reposition, true);
        };
    }, [active]);

    // ── Interactive auto-advance (input typed / window event / fallback) ──
    useEffect(() => {
        if (!active || !step?.advanceOn) return undefined;
        const { input, event, predicate, timeoutMs } = step.advanceOn;
        const cleanups = [];
        let advanced = false;
        const advance = () => { if (advanced) return; advanced = true; goNext(); };

        if (input) {
            const minLen = input.minLength || 1;
            const onInput = (e) => {
                const tgt = e.target;
                try {
                    if (tgt && tgt.matches && tgt.matches(step.target) && String(tgt.value || '').trim().length >= minLen) {
                        advance();
                    }
                } catch (err) { /* ignore */ }
            };
            document.addEventListener('input', onInput, true);
            cleanups.push(() => document.removeEventListener('input', onInput, true));
        }
        if (event) {
            const onEvt = (e) => { if (!predicate || predicate(e.detail)) advance(); };
            window.addEventListener(event, onEvt);
            cleanups.push(() => window.removeEventListener(event, onEvt));
        }
        if (timeoutMs) {
            const to = setTimeout(advance, timeoutMs);
            cleanups.push(() => clearTimeout(to));
        }
        return () => cleanups.forEach((fn) => fn());
    }, [active, stepIndex, step, goNext]);

    // ── Keyboard (Next/Back disabled on interactive steps so typing works) ──
    useEffect(() => {
        if (!active) return undefined;
        const interactive = !!step?.interactive;
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); finish(); return; }
            if (interactive) return; // let Enter / arrows reach the field
            if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); goNext(); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [active, step, finish, goNext, goPrev]);

    // ── Focus the card on each step (but not interactive steps) ─────────
    useEffect(() => {
        if (active && !step?.interactive) {
            const id = setTimeout(() => { try { cardRef.current?.focus(); } catch (e) { /* ignore */ } }, 60);
            return () => clearTimeout(id);
        }
        return undefined;
    }, [active, stepIndex, step]);

    // ── Card position (clamped to the viewport) ────────────────────────
    const cardStyle = useMemo(() => {
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
        const estH = 210;
        const clamp = (v, max) => Math.max(EDGE, Math.min(v, max - EDGE));

        if (!rect || (step && step.placement === 'center')) {
            return { top: Math.round(vh / 2 - estH / 2), left: Math.round(vw / 2 - CARD_WIDTH / 2) };
        }
        const placement = step?.placement || 'right';
        let top;
        let left;
        switch (placement) {
            case 'left': left = rect.left - CARD_WIDTH - 16; top = rect.top; break;
            case 'top': left = rect.left; top = rect.top - estH - 16; break;
            case 'bottom': left = rect.left; top = rect.top + rect.height + 16; break;
            case 'right':
            default: left = rect.left + rect.width + 16; top = rect.top - 8; break;
        }
        return { top: Math.round(clamp(top, vh - estH)), left: Math.round(clamp(left, vw - CARD_WIDTH)) };
    }, [rect, step]);

    if (!active || !step) return null;

    const total = steps.length;
    const isLast = stepIndex === total - 1;
    const isFirst = stepIndex === 0;
    const interactive = !!step.interactive;
    const showBack = !isFirst && !interactive;
    const title = t(step.titleKey, step.titleFallback);
    const body = t(step.bodyKey, step.bodyFallback);
    const actionHint = interactive ? t(step.actionHintKey, step.actionHintFallback) : null;

    return createPortal(
        <div aria-live="polite">
            {/* Click-catcher — blocks the app behind the tour, EXCEPT on
                interactive steps where the user must touch the real element. */}
            {!interactive && <div style={{ position: 'fixed', inset: 0, zIndex: 9997 }} />}

            {/* Dimmer: spotlight cutout when we have a target, else a flat scrim. */}
            {rect ? (
                <div
                    aria-hidden="true"
                    style={{
                        position: 'fixed',
                        top: rect.top - SPOTLIGHT_PAD,
                        left: rect.left - SPOTLIGHT_PAD,
                        width: rect.width + SPOTLIGHT_PAD * 2,
                        height: rect.height + SPOTLIGHT_PAD * 2,
                        borderRadius: 12,
                        boxShadow:
                            '0 0 0 9999px rgba(8, 9, 15, 0.62), 0 0 0 2px var(--accent-primary), 0 0 0 7px color-mix(in srgb, var(--accent-primary) 32%, transparent)',
                        pointerEvents: 'none',
                        transition: 'top .2s ease, left .2s ease, width .2s ease, height .2s ease',
                        zIndex: 9998,
                        animation: 'beeflowTourPulse 2s ease-in-out infinite',
                    }}
                />
            ) : (
                <div aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'rgba(8, 9, 15, 0.62)', zIndex: 9998 }} />
            )}

            {/* Card */}
            <div
                ref={cardRef}
                role="dialog"
                aria-modal={interactive ? undefined : 'true'}
                aria-labelledby="beeflow-tour-title"
                aria-describedby="beeflow-tour-body"
                tabIndex={-1}
                className="rounded-2xl border outline-none p-5"
                style={{
                    position: 'fixed',
                    top: cardStyle.top,
                    left: cardStyle.left,
                    width: CARD_WIDTH,
                    maxWidth: 'calc(100vw - 32px)',
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-default)',
                    boxShadow: 'var(--shadow-popover, 0 20px 60px rgba(0,0,0,0.45))',
                    zIndex: 9999,
                    animation: 'beeflowTourIn .22s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
            >
                <div className="flex items-start gap-3">
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--accent-primary) 14%, transparent)' }}
                        aria-hidden="true"
                    >
                        {step.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 id="beeflow-tour-title" className="text-[15px] font-bold text-[var(--text-primary)] leading-snug">
                            {title}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={finish}
                        aria-label={t('tour.skip', 'Skip tour')}
                        className="p-1 -mt-1 -mr-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors flex-shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <p id="beeflow-tour-body" className="mt-2.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    {body}
                </p>

                <div className="mt-4 flex items-center justify-between gap-3">
                    {/* Progress dots */}
                    <div className="flex items-center gap-1.5" aria-hidden="true">
                        {steps.map((s, i) => (
                            <span
                                key={s.id}
                                className="rounded-full transition-all duration-200"
                                style={{
                                    width: i === stepIndex ? 18 : 6,
                                    height: 6,
                                    background: i === stepIndex ? 'var(--accent-primary)' : 'var(--border-default)',
                                }}
                            />
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        {showBack && (
                            <button
                                type="button"
                                onClick={goPrev}
                                className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                {t('tour.back', 'Back')}
                            </button>
                        )}
                        {interactive ? (
                            <span
                                className="text-[12px] font-semibold text-[var(--accent-primary)]"
                                style={{ animation: 'beeflowHintPulse 1.6s ease-in-out infinite' }}
                            >
                                {actionHint}
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={goNext}
                                className="inline-flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-[12px] font-semibold transition-opacity hover:opacity-90"
                                style={{ background: 'var(--accent-primary)', color: 'var(--accent-primary-fg, #fff)' }}
                            >
                                {isLast ? (
                                    <>
                                        <Check className="w-3.5 h-3.5" />
                                        {t('tour.finish', 'Got it')}
                                    </>
                                ) : (
                                    <>
                                        {t('tour.next', 'Next')}
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer: step count + skip */}
                <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">
                        {t('tour.step_counter', 'Step {n} of {total}').replace('{n}', String(stepIndex + 1)).replace('{total}', String(total))}
                    </span>
                    {!isLast && (
                        <button
                            type="button"
                            onClick={finish}
                            className="text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                        >
                            {t('tour.skip', 'Skip tour')}
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes beeflowTourIn {
                    from { opacity: 0; transform: translateY(6px) scale(0.98); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes beeflowTourPulse {
                    0%, 100% { box-shadow: 0 0 0 9999px rgba(8,9,15,0.62), 0 0 0 2px var(--accent-primary), 0 0 0 7px color-mix(in srgb, var(--accent-primary) 32%, transparent); }
                    50%      { box-shadow: 0 0 0 9999px rgba(8,9,15,0.62), 0 0 0 2px var(--accent-primary), 0 0 0 11px color-mix(in srgb, var(--accent-primary) 14%, transparent); }
                }
                @keyframes beeflowHintPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
                @media (prefers-reduced-motion: reduce) {
                    [aria-modal="true"], [aria-hidden="true"], #beeflow-tour-title { animation: none !important; }
                }
            `}</style>
        </div>,
        document.body,
    );
}
