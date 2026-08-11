import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';

/**
 * Watches for an announced deployment window so the app can warn people before
 * the server drops from under them.
 *
 * ── Why an ETA alone is not enough ─────────────────────────────────────────
 *
 * The ETA the deploy pipeline sends is a guess about how long a rollout takes.
 * Counting it down and then declaring "we're back" would be a lie roughly half
 * the time. So this tracks two independent things:
 *
 *   - the announced window (when it should end), and
 *   - `appVersion` (APP_BUILD_SHA), which is ground truth: when the value we
 *     get back differs from the one we first booted against, a NEW build is
 *     genuinely serving this client.
 *
 * A version change flips straight to 'recovered' whether or not the ETA has
 * elapsed. The countdown is only ever cosmetic.
 *
 * Returns { phase, secondsRemaining, window, versionChanged } where phase is:
 *   'idle'       — nothing announced
 *   'pending'    — window in force, ETA has not run out
 *   'overdue'    — ETA elapsed, server has not come back on a new build
 *   'recovered'  — a new build is serving us; work can resume
 */

// Poll gently when nothing is happening; tighten once a window is open so the
// "you can continue" flip lands promptly rather than up to a minute late.
const IDLE_POLL_MS = 60_000;
const ACTIVE_POLL_MS = 5_000;

// How long the "you can continue" state sticks around before returning to idle.
const RECOVERED_LINGER_MS = 20_000;

/** Whole seconds until `endsAt`, floored at 0. Exported for tests. */
export function secondsUntil(endsAt, now = Date.now()) {
    const t = Date.parse(endsAt);
    if (!Number.isFinite(t)) return 0;
    return Math.max(0, Math.round((t - now) / 1000));
}

/**
 * Human ETA. Deliberately coarse — "about 2 minutes" is honest about a guess in
 * a way that a ticking "1:47" is not.
 */
export function formatEta(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return 'any moment now';
    if (seconds < 60) return `about ${Math.max(10, Math.round(seconds / 10) * 10)} seconds`;
    const mins = Math.round(seconds / 60);
    return mins === 1 ? 'about a minute' : `about ${mins} minutes`;
}

/**
 * Resolve the display phase. Pure, so the state machine is testable without
 * timers or a network.
 */
export function derivePhase({ window, versionChanged, secondsRemaining }) {
    if (versionChanged) return 'recovered';
    if (!window) return 'idle';
    return secondsRemaining > 0 ? 'pending' : 'overdue';
}

export function useMaintenanceWindow({ enabled = true } = {}) {
    const [window_, setWindow] = useState(null);
    const [secondsRemaining, setSecondsRemaining] = useState(0);
    const [versionChanged, setVersionChanged] = useState(false);

    // The build this client booted against. Captured on the FIRST successful
    // response rather than at module load, because we cannot know it until the
    // server tells us. Never overwritten — that is the whole comparison.
    const baselineVersion = useRef(null);
    const recoveredAt = useRef(null);

    const poll = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/maintenance`);
            if (!res.ok) return;   // 401 on a logged-out tab: nothing to show
            const data = await res.json();

            const version = data.appVersion || '';
            if (version) {
                if (baselineVersion.current === null) baselineVersion.current = version;
                else if (version !== baselineVersion.current) setVersionChanged(true);
            }

            const win = data.maintenance || null;
            setWindow(win);
            setSecondsRemaining(win ? secondsUntil(win.endsAt) : 0);
        } catch {
            // A failed poll during a rollout is EXPECTED — the pod serving us is
            // being replaced. Holding the last known state is exactly right: the
            // banner stays up across the outage instead of flickering off at the
            // moment it is most useful.
        }
    }, []);

    // Poll loop. Interval tightens while a window is open. Keyed on the boolean
    // rather than the window object so a fresh object from each poll does not
    // tear down and rebuild the interval every tick.
    const isActive = !!window_ || versionChanged;
    useEffect(() => {
        if (!enabled) return undefined;
        poll();
        const id = setInterval(poll, isActive ? ACTIVE_POLL_MS : IDLE_POLL_MS);
        return () => clearInterval(id);
    }, [enabled, poll, isActive]);

    // Local countdown so the number moves between polls.
    useEffect(() => {
        if (!window_) return undefined;
        const id = setInterval(() => setSecondsRemaining(secondsUntil(window_.endsAt)), 1000);
        return () => clearInterval(id);
    }, [window_]);

    // Retire the "you can continue" note after a while so it does not become
    // permanent furniture on a long-lived tab.
    useEffect(() => {
        if (!versionChanged) { recoveredAt.current = null; return undefined; }
        recoveredAt.current = Date.now();
        const id = setTimeout(() => {
            setVersionChanged(false);
            baselineVersion.current = null;   // re-baseline against the new build
            setWindow(null);
        }, RECOVERED_LINGER_MS);
        return () => clearTimeout(id);
    }, [versionChanged]);

    return {
        phase: derivePhase({ window: window_, versionChanged, secondsRemaining }),
        secondsRemaining,
        window: window_,
        versionChanged,
    };
}

export default useMaintenanceWindow;
