import { useEffect } from 'react';
import { consentAccepted } from './consent';

// Injects Umami's session recorder (heatmaps + session replay) on a published
// CMS site.
//
// GDPR stance — this is a privacy-first product. Umami's *pageview* tracking is
// cookieless and defensible without consent, which is why AnalyticsTracker can
// load in `cookieless` mode unprompted. Recording is a different thing: the
// recorder captures clicks, mouse movement, scrolling and DOM structure from a
// real person's session. So it is gated on explicit cookie-banner consent in
// EVERY consent mode, including cookieless, and is removed the moment consent
// is withdrawn — same-tab via `bf-cookie-consent`, other tabs via `storage`.
// If the site's cookie banner is disabled there is no way to consent, so the
// recorder simply never loads. Never mounted in the admin preview iframe.
//
// It is additionally opt-in per site (admin → Website Analytics → Settings),
// so the server only sends `recorderUrl` for sites the operator switched on.

const SCRIPT_ID = 'bf-umami-recorder';

function injectRecorder(scriptUrl, websiteId) {
    if (typeof document === 'undefined') return;
    if (document.getElementById(SCRIPT_ID)) return;
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.defer = true;
    s.src = scriptUrl;
    s.setAttribute('data-website-id', websiteId);
    // Never capture what people type. Umami masks inputs when asked; we ask
    // always rather than leaving it to the operator to remember.
    s.setAttribute('data-mask-all-inputs', 'true');
    document.head.appendChild(s);
}

function removeRecorder() {
    if (typeof document === 'undefined') return;
    document.getElementById(SCRIPT_ID)?.remove();
}

export default function SessionRecorder({ websiteId, recorderUrl } = {}) {
    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        if (!websiteId || !recorderUrl) return undefined;
        // Never record inside the admin preview iframe.
        if (new URLSearchParams(window.location.search).has('preview')) return undefined;

        const apply = () => {
            if (consentAccepted()) injectRecorder(recorderUrl, websiteId);
            else removeRecorder();
        };
        apply();

        const onConsentChange = () => apply();
        window.addEventListener('bf-cookie-consent', onConsentChange);
        window.addEventListener('storage', onConsentChange);
        return () => {
            window.removeEventListener('bf-cookie-consent', onConsentChange);
            window.removeEventListener('storage', onConsentChange);
        };
    }, [websiteId, recorderUrl]);

    return null;
}
