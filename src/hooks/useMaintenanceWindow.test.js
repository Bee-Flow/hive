/**
 * Maintenance window hook — pure-helper tests.
 *
 * The countdown/poll loop needs timers and a network; the parts worth guarding
 * are the state machine and the ETA formatting, both of which are pure.
 */

import { describe, it, expect } from 'vitest';
import { secondsUntil, formatEta, derivePhase } from './useMaintenanceWindow';

describe('secondsUntil', () => {
    it('floors at zero once the window has passed', () => {
        expect(secondsUntil(new Date(1000).toISOString(), 5000)).toBe(0);
    });

    it('rounds to whole seconds', () => {
        expect(secondsUntil(new Date(10_400).toISOString(), 0)).toBe(10);
    });

    it('returns 0 for an unparseable date rather than NaN', () => {
        // NaN would render as "about NaN minutes".
        expect(secondsUntil('nonsense', 0)).toBe(0);
    });
});

describe('formatEta', () => {
    it('is coarse about sub-minute waits, not falsely precise', () => {
        expect(formatEta(47)).toBe('about 50 seconds');
    });

    it('never promises less than 10 seconds', () => {
        expect(formatEta(3)).toBe('about 10 seconds');
    });

    it('uses the singular for one minute', () => {
        expect(formatEta(60)).toBe('about a minute');
    });

    it('rounds to whole minutes above a minute', () => {
        expect(formatEta(200)).toBe('about 3 minutes');
    });

    it('degrades gracefully at or below zero', () => {
        expect(formatEta(0)).toBe('any moment now');
        expect(formatEta(-5)).toBe('any moment now');
        expect(formatEta(NaN)).toBe('any moment now');
    });
});

describe('derivePhase', () => {
    const win = { endsAt: new Date(Date.now() + 60_000).toISOString() };

    it('is idle with nothing announced', () => {
        expect(derivePhase({ window: null, versionChanged: false, secondsRemaining: 0 })).toBe('idle');
    });

    it('is pending while the ETA has time left', () => {
        expect(derivePhase({ window: win, versionChanged: false, secondsRemaining: 30 })).toBe('pending');
    });

    it('is overdue once the ETA runs out with no new build', () => {
        expect(derivePhase({ window: win, versionChanged: false, secondsRemaining: 0 })).toBe('overdue');
    });

    it('A NEW BUILD BEATS THE CLOCK: recovered even with time left on the ETA', () => {
        // The ETA is a guess; the version change is ground truth. If the rollout
        // finished early, users must be told immediately, not made to wait out
        // an estimate that turned out to be pessimistic.
        expect(derivePhase({ window: win, versionChanged: true, secondsRemaining: 45 })).toBe('recovered');
    });

    it('recovered outranks idle too, so the all-clear is not swallowed', () => {
        // The window is cleared server-side the moment the deploy finishes, so
        // the all-clear routinely arrives with window === null.
        expect(derivePhase({ window: null, versionChanged: true, secondsRemaining: 0 })).toBe('recovered');
    });
});
