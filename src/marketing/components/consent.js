// Shared cookie-consent storage contract for the public marketing site.
//
// Written by CookieBanner.jsx (the only writer), read by every tracker that
// must gate on consent (AnalyticsTracker in cookie mode, GoogleAnalyticsTracker
// always). Same-tab changes are announced via the `bf-cookie-consent` window
// event; other tabs see the native `storage` event.

export const CONSENT_STORAGE_KEY = 'cookie_consent';
// Legacy key from earlier builds; CookieBanner migrates it on first read, but
// readers still fall back to it so a returning visitor whose consent predates
// the rename is honoured without re-interacting with the banner.
export const LEGACY_CONSENT_STORAGE_KEY = 'bf_cookie_consent';

/** True when the visitor has explicitly accepted cookies. */
export function consentAccepted() {
    try {
        return window.localStorage.getItem(CONSENT_STORAGE_KEY) === 'accepted'
            || window.localStorage.getItem(LEGACY_CONSENT_STORAGE_KEY) === 'accepted';
    } catch {
        return false;
    }
}
