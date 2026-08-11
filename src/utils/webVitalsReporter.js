// Web Vitals reporting — fire-and-forget metric beacons.
//
// Captures Core Web Vitals (CLS, INP, LCP) plus FCP and TTFB and posts
// each metric to /api/web-vitals as it becomes available. Used to track
// real-user perceived performance over time and measure the impact of
// the lazy-load / memoization work that follows in later phases.
//
// Implementation notes:
//   * Uses navigator.sendBeacon when available — survives page unloads,
//     which is critical for LCP/INP/CLS that often fire late.
//   * Falls back to fetch(..., { keepalive: true }) when sendBeacon is
//     missing or rejects (e.g. Safari with payloads above its quota).
//   * Silent on every failure path. Telemetry must never break the app.
//   * Endpoint mirrors clientErrors.js — log-only, no DB churn.
//   * Consent-gated on the public marketing surface, per metric at send time
//     (covers the sendBeacon unload path too): accepting the CookieBanner
//     mid-session starts reporting from that moment, withdrawing stops it,
//     and pre-consent metrics are dropped — never buffered for later. In-app
//     (/app etc. — product telemetry for signed-in users) stays ungated.
//
// Public API:
//   reportWebVitals() — call once at app mount, after first render.

import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';
import { APP_BUILD_SHA } from './appVersion';
import { isPublicMarketingPath } from './cmsPublicRouting';
import { API_BASE } from './helpers';
import { consentAccepted } from '../marketing/components/consent';

// Must be absolute against API_BASE — when the SPA runs inside the
// Nextcloud iframe, a bare `/api/...` resolves to NC's domain rather
// than the connector's proxy path and the request 404s on NC.
const ENDPOINT = `${API_BASE}/api/web-vitals`;

function send(metric) {
    // Public marketing context → only beacon with cookie consent (see header
    // note). Re-read per metric so the same-tab CookieBanner choice takes
    // effect on the very next metric without any event wiring here.
    try {
        if (isPublicMarketingPath(window.location.pathname) && !consentAccepted()) return;
    } catch { return; /* no window → nothing to send anyway */ }

    const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        delta: metric.delta,
        id: metric.id,
        rating: metric.rating,
        navigationType: metric.navigationType,
        url: typeof window !== 'undefined' ? window.location.pathname : '',
        at: new Date().toISOString(),
        buildSha: APP_BUILD_SHA,
    });

    try {
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
            // sendBeacon ignores response status; treat falsy as queue-failed.
            const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
            if (ok) return;
        }
    } catch { /* fall through to fetch */ }

    try {
        if (typeof fetch === 'function') {
            fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                credentials: 'include',
                keepalive: true,
            }).catch(() => {});
        }
    } catch { /* best effort */ }
}

let started = false;

export function reportWebVitals() {
    if (started) return;
    started = true;
    onCLS(send);
    onINP(send);
    onLCP(send);
    onFCP(send);
    onTTFB(send);
}
