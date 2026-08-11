import { useEffect } from 'react';
import { GOOGLE_FONT_FAMILIES } from './appDesign';
import { buildFontsHrefs } from '../../../ProductWebsite/googleFonts';
// Self-hosted @font-face declarations (Satoshi, General Sans, Cabinet Grotesk)
// — a plain import so the bytes are served from Bee Flow itself. Idempotent:
// the bundler includes the stylesheet once however many modules import it.
import '../../../../../marketing/self-hosted-fonts.css';

/**
 * Loads the typeface an app's design asks for.
 *
 * Two kinds of pairing, deliberately: SELF-HOSTED families ship with the
 * product (no request ever leaves the browser — this is a privacy product, and
 * a font request is a request), and a small set of Google families that need a
 * stylesheet <link>. `system` (the default) loads nothing at all.
 *
 * Renders nothing. The <link> is left in place on unmount: fonts are global,
 * cheap, and removing one mid-session would restyle whatever else is using it.
 */
export default function AppFontLoader({ definition }) {
    const font = definition?.design?.font || 'system';

    useEffect(() => {
        const family = GOOGLE_FONT_FAMILIES[font];
        if (!family) return; // system, or a self-hosted family — nothing to fetch
        let hrefs = [];
        try {
            hrefs = buildFontsHrefs([family], [400, 500, 600]) || [];
        } catch {
            return; // a font is never worth breaking the app for
        }
        for (const entry of hrefs) {
            const href = typeof entry === 'string' ? entry : entry?.href;
            if (!href) continue;
            if (document.querySelector(`link[data-app-font][href="${CSS.escape(href)}"]`)) continue;
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.setAttribute('data-app-font', font);
            document.head.appendChild(link);
        }
    }, [font]);

    return null;
}
