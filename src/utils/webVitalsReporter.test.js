import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { reportWebVitals } from './webVitalsReporter';
import { CONSENT_STORAGE_KEY } from '../marketing/components/consent';

// Capture the callbacks web-vitals registers so tests can fire metrics on
// demand — jsdom has no PerformanceObserver, so the real library would never
// invoke them. vi.hoisted lifts the array above the (also hoisted) mock
// factory, which already runs while ./webVitalsReporter is being imported.
const handlers = vi.hoisted(() => []);
vi.mock('web-vitals', () => {
    const register = (cb) => { handlers.push(cb); };
    return { onCLS: register, onINP: register, onLCP: register, onFCP: register, onTTFB: register };
});

const sendBeacon = vi.fn(() => true);

// All five web-vitals hooks register the same send(); firing one stands in for
// any metric becoming final (including the late unload-time LCP/INP/CLS).
const fireMetric = (name = 'LCP') => handlers[0]({
    name, value: 123, delta: 123, id: 'v4-test', rating: 'good', navigationType: 'navigate',
});

beforeAll(() => {
    // jsdom ships no sendBeacon; returning true keeps send() off the fetch
    // fallback so the beacon mock sees every attempted delivery.
    Object.defineProperty(navigator, 'sendBeacon', {
        value: sendBeacon, configurable: true, writable: true,
    });
    reportWebVitals();
    expect(handlers.length).toBe(5);
});

beforeEach(() => {
    sendBeacon.mockClear();
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
});

describe('reportWebVitals consent gating', () => {
    // The gate runs inside send() — per metric, at delivery time — so nothing
    // measured pre-consent is ever buffered and replayed later.
    it('drops metrics on the public marketing site while consent is absent or declined', () => {
        fireMetric();                                                     // homepage, no choice yet
        window.localStorage.setItem(CONSENT_STORAGE_KEY, 'declined');
        fireMetric();
        window.history.replaceState(null, '', '/privacy');                // framed static page
        fireMetric();
        expect(sendBeacon).not.toHaveBeenCalled();
    });

    it('starts sending from the moment of acceptance — earlier metrics stay lost', () => {
        window.history.replaceState(null, '', '/pricing');
        fireMetric('FCP');                                                // pre-consent → dropped
        window.localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
        fireMetric('LCP');
        expect(sendBeacon).toHaveBeenCalledTimes(1);                      // only the post-consent one
        expect(String(sendBeacon.mock.calls[0][0])).toContain('/api/web-vitals');
    });

    it('stops again when consent is withdrawn in the same tab', () => {
        window.localStorage.setItem(CONSENT_STORAGE_KEY, 'accepted');
        fireMetric();
        window.localStorage.setItem(CONSENT_STORAGE_KEY, 'declined');
        fireMetric();
        expect(sendBeacon).toHaveBeenCalledTimes(1);
    });

    it('leaves in-app product telemetry ungated', () => {
        window.history.replaceState(null, '', '/app/agents');
        fireMetric();                                                     // no consent stored at all
        expect(sendBeacon).toHaveBeenCalledTimes(1);
    });
});
