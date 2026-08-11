import { useEffect } from 'react';
import { consentAccepted } from './consent';

// Injects the self-hosted Umami tracker onto a published CMS site.
//
// Performance is a hard requirement here: the tag is a single ~2 KB script
// loaded with `defer` (off the critical render path) and is NOT part of the
// React bundle — so it never delays first paint or hydration. It's only ever
// mounted on the live public site (never in the admin preview iframe).
//
// Consent: when the operator configured `cookieless` tracking (the default),
// the script loads unconditionally — Umami sets no cookies and stores no PII,
// so it's consent-free under GDPR. When `cookies` mode is configured, the
// script only loads after the visitor accepts via the CookieBanner; we react
// to consent changes (same tab via the `bf-cookie-consent` event, other tabs
// via `storage`) and remove the tag again if consent is withdrawn.

const SCRIPT_ID = 'bf-umami-tracker';

/**
 * The attribute set Umami reads off its own <script> tag at eval time.
 *
 * `data-performance` is not optional decoration: Umami gates its ENTIRE
 * PerformanceObserver block on it being the literal string "true". Without it
 * no web vital is ever recorded, and the Performance tab reports a flawless
 * 0 ms for a metric that was never measured. It needs no consent gate of its
 * own — these are cookieless browser timings riding along with the pageview
 * that is already being sent under the same consent decision.
 *
 * `data-exclude-hash` keeps #anchor links from fragmenting one page's vitals
 * (and its pageviews) across a row per anchor.
 */
export function buildTrackerAttrs(websiteId, options = {}) {
    const attrs = {
        'data-website-id': String(websiteId),
        'data-performance': 'true',
        'data-exclude-hash': options.excludeHash === false ? 'false' : 'true',
    };
    if (options.excludeSearch) attrs['data-exclude-search'] = 'true';
    if (options.doNotTrack) attrs['data-do-not-track'] = 'true';
    if (options.tag) attrs['data-tag'] = String(options.tag);
    if (options.domains) attrs['data-domains'] = String(options.domains);
    return attrs;
}

function injectTracker(scriptUrl, websiteId, options) {
    if (typeof document === 'undefined') return;
    const attrs = buildTrackerAttrs(websiteId, options);
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
        // Umami reads its attributes once, at script eval, so mutating them in
        // place does nothing. If the desired set has changed the tag has to be
        // replaced — a plain early-return would silently keep the old config.
        const same = existing.getAttribute('src') === scriptUrl
            && Object.entries(attrs).every(([k, v]) => existing.getAttribute(k) === v);
        if (same) return;
        existing.remove();
    }
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.defer = true;
    s.src = scriptUrl;
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    document.head.appendChild(s);
}

function removeTracker() {
    if (typeof document === 'undefined') return;
    document.getElementById(SCRIPT_ID)?.remove();
}

export default function AnalyticsTracker({ websiteId, scriptUrl, consentMode, trackerOptions } = {}) {
    // Serialised so a new object literal with identical contents does not
    // retrigger the effect on every parent render.
    const optionsKey = JSON.stringify(trackerOptions || {});
    useEffect(() => {
        if (!websiteId || !scriptUrl) return undefined;
        const options = JSON.parse(optionsKey);
        // Never track inside the admin preview iframe.
        if (typeof window !== 'undefined'
            && new URLSearchParams(window.location.search).has('preview')) {
            return undefined;
        }

        const cookieMode = consentMode === 'cookies';
        const apply = () => {
            if (!cookieMode || consentAccepted()) injectTracker(scriptUrl, websiteId, options);
            else removeTracker();
        };
        apply();

        // Cookieless mode has nothing to react to once injected.
        if (!cookieMode) return undefined;

        const onConsentChange = () => apply();
        window.addEventListener('bf-cookie-consent', onConsentChange);
        window.addEventListener('storage', onConsentChange);
        return () => {
            window.removeEventListener('bf-cookie-consent', onConsentChange);
            window.removeEventListener('storage', onConsentChange);
        };
    }, [websiteId, scriptUrl, consentMode, optionsKey]);

    return null;
}
