import { useEffect } from 'react';

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
const CONSENT_KEY = 'cookie_consent';        // shared with CookieBanner.jsx
const LEGACY_CONSENT_KEY = 'bf_cookie_consent'; // pre-rename key (CookieBanner migrates it)

function consentAccepted() {
    try {
        // Fall back to the legacy key so a returning visitor whose consent
        // predates the rename is tracked without re-interacting with the banner
        // (the banner only migrates + emits its event on an explicit choice).
        return window.localStorage.getItem(CONSENT_KEY) === 'accepted'
            || window.localStorage.getItem(LEGACY_CONSENT_KEY) === 'accepted';
    } catch {
        return false;
    }
}

function injectTracker(scriptUrl, websiteId) {
    if (typeof document === 'undefined') return;
    if (document.getElementById(SCRIPT_ID)) return;
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.defer = true;
    s.src = scriptUrl;
    s.setAttribute('data-website-id', websiteId);
    document.head.appendChild(s);
}

function removeTracker() {
    if (typeof document === 'undefined') return;
    document.getElementById(SCRIPT_ID)?.remove();
}

export default function AnalyticsTracker({ websiteId, scriptUrl, consentMode } = {}) {
    useEffect(() => {
        if (!websiteId || !scriptUrl) return undefined;
        // Never track inside the admin preview iframe.
        if (typeof window !== 'undefined'
            && new URLSearchParams(window.location.search).has('preview')) {
            return undefined;
        }

        const cookieMode = consentMode === 'cookies';
        const apply = () => {
            if (!cookieMode || consentAccepted()) injectTracker(scriptUrl, websiteId);
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
    }, [websiteId, scriptUrl, consentMode]);

    return null;
}
