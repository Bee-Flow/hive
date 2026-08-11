import { useEffect } from 'react';
import { consentAccepted } from './consent';

// Injects Google Analytics 4 (gtag.js) onto a published CMS site.
//
// GDPR stance — this is a privacy-first product: unlike the cookieless Umami
// tracker, GA sets cookies and sends data to Google, so it is NEVER
// consent-free. The tag is only injected after the visitor explicitly accepts
// via the CookieBanner, and it is removed again (plus the documented
// `ga-disable-<id>` kill switch) the moment consent is withdrawn — same-tab
// via the `bf-cookie-consent` event, other tabs via `storage`. When the
// cookie banner is disabled there is no way to consent, so GA simply never
// loads. Never mounted in the admin preview iframe.
//
// Public CMS navigation is full document loads (no SPA routing), so the
// config-time page_view per document is all the tracking needed.

const SCRIPT_ID = 'bf-ga-tracker';
const INIT_ID = 'bf-ga-init';
// Also enforced server-side (cmsStore sanitizeAnalytics). Re-checked here
// because the id is interpolated into a script URL and inline script text —
// nothing outside G-[A-Z0-9]* may ever reach either.
const MEASUREMENT_ID_RE = /^G-[A-Z0-9]{4,20}$/;

function injectGa(measurementId) {
    if (typeof document === 'undefined') return;
    // Clear the opt-out flag a prior withdrawal may have set this session.
    try { window[`ga-disable-${measurementId}`] = false; } catch { /* ignore */ }
    if (document.getElementById(SCRIPT_ID)) return;
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(s);
    const init = document.createElement('script');
    init.id = INIT_ID;
    init.text = 'window.dataLayer = window.dataLayer || [];\n'
        + 'function gtag(){dataLayer.push(arguments);}\n'
        + "gtag('js', new Date());\n"
        + `gtag('config', '${measurementId}', { anonymize_ip: true });\n`;
    document.head.appendChild(init);
}

function removeGa(measurementId) {
    if (typeof document === 'undefined') return;
    document.getElementById(SCRIPT_ID)?.remove();
    document.getElementById(INIT_ID)?.remove();
    // Removing the tags doesn't stop an already-loaded gtag from sending
    // events this session — the documented per-property disable flag does.
    try { window[`ga-disable-${measurementId}`] = true; } catch { /* ignore */ }
}

export default function GoogleAnalyticsTracker({ measurementId } = {}) {
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const id = typeof measurementId === 'string' ? measurementId.trim().toUpperCase() : '';
        if (!MEASUREMENT_ID_RE.test(id)) return undefined;
        // Never track inside the admin preview iframe.
        if (new URLSearchParams(window.location.search).has('preview')) return undefined;

        const apply = () => {
            if (consentAccepted()) injectGa(id);
            else removeGa(id);
        };
        apply();

        const onConsentChange = () => apply();
        window.addEventListener('bf-cookie-consent', onConsentChange);
        window.addEventListener('storage', onConsentChange);
        return () => {
            window.removeEventListener('bf-cookie-consent', onConsentChange);
            window.removeEventListener('storage', onConsentChange);
        };
    }, [measurementId]);

    return null;
}
