import React, { useLayoutEffect, useRef, useState } from 'react';
import EditableText from './EditableText';

/**
 * Site-wide announcement bar — a short, dismissible strip that sits ABOVE
 * the site header (the UiPath/Microsoft pattern). Off by default; the admin
 * turns it on per site in the CMS ("Site → Announcement bar").
 *
 * Data shape (site.announcement, mirrors site.cookieBanner):
 *
 *   { enabled, dismissible, variant, text: { en: {message,linkLabel,linkUrl}, nl: {…} } }
 *
 * ONE per-locale `text` blob carries every language, so — exactly like the
 * cookie banner — the bar needs no locale-override layer: the caller resolves
 * the visitor's language at render time and we pick the matching entry.
 *
 * ── Layout contract (important) ──────────────────────────────────────
 * `.header` and `.mobile-nav` are `position: fixed` and the hero / drawer /
 * sticky-ledger offsets are all computed from `--header-height`. Rather than
 * putting the bar in normal flow (where the fixed header would simply cover
 * it), the bar is ALSO `position: fixed; top: 0` and publishes its own height
 * as `--announce-height` on `.marketing-root`. marketing.css then adds
 * `var(--announce-height, 0px)` to every one of those offsets.
 *
 * The height is MEASURED (ResizeObserver), not a constant, because the copy
 * wraps to two or three lines on narrow viewports — a hard-coded 40px would
 * let the header slide under a wrapped strip on mobile.
 *
 * When the bar renders nothing the property is removed, so every offset
 * falls back to `0px` and resolves to byte-identical CSS to before the
 * feature existed.
 */

// Dismissal is stored under ONE key holding a fingerprint of the message the
// visitor dismissed — not a boolean. A boolean would mean that once someone
// closed "Black Friday: 30% off", they'd never see "We're SOC 2 certified"
// either. Fingerprinting the resolved message re-shows the bar whenever the
// copy actually changes, which is the behaviour an editor expects after
// publishing new text. (Switching site language also changes the resolved
// message and therefore re-shows the bar once — acceptable, and arguably
// correct: it IS a message the visitor has not read yet.)
const STORAGE_KEY = 'cms.announcementDismissed';

// djb2 → base36. Short, stable, dependency-free; collisions are harmless
// here (worst case one visitor doesn't re-see a changed announcement).
function fingerprint(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}

const VARIANTS = new Set(['accent', 'surface', 'dark']);

const isPreviewMode = () =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('preview');

const str = (v) => (typeof v === 'string' ? v : '');

// Same locale resolution as the cookie banner: use the requested language
// when the blob has copy for it, otherwise fall back to English.
// (ProductWebsite.jsx resolves the language itself via resolveCookieLang()
// and passes it in, so the URL/browser-language logic lives in one place.)
function resolveStrings(text, language) {
    const lang = text?.[language] ? language : 'en';
    const s = text?.[lang] || {};
    return {
        lang,
        message:   str(s.message),
        linkLabel: str(s.linkLabel),
        linkUrl:   str(s.linkUrl),
    };
}

/**
 * Publish the bar's MEASURED height as `--announce-height` on the marketing
 * root, so the fixed header and every `--header-height`-derived offset can
 * move down by exactly that much. Layout effect, so the offsets are right
 * before the first paint; removes (never zeroes) the property on teardown so
 * an absent bar leaves every calc() byte-identical to before this feature.
 */
function useAnnounceHeight(barRef, visible) {
    useLayoutEffect(() => {
        const el = barRef.current;
        if (!el || typeof window === 'undefined') return undefined;
        const root = el.closest('.marketing-root') || el.parentElement;
        if (!root) return undefined;
        const apply = () => {
            const h = Math.round(el.getBoundingClientRect().height);
            root.style.setProperty('--announce-height', `${h}px`);
        };
        apply();
        let ro = null;
        if (typeof ResizeObserver !== 'undefined') {
            ro = new ResizeObserver(apply);
            ro.observe(el);
        }
        return () => {
            if (ro) ro.disconnect();
            root.style.removeProperty('--announce-height');
        };
    }, [barRef, visible]);
}

export default function AnnouncementBar({
    enabled = false,
    dismissible = true,
    variant = 'accent',
    language = 'en',
    text = undefined,
} = {}) {
    const { lang, message, linkLabel, linkUrl } = resolveStrings(text, language);

    const inPreview = isPreviewMode();
    const barRef = useRef(null);

    // localStorage is read SYNCHRONOUSLY in the initializer, not in a mount
    // effect. The old 'unset'-then-effect pattern rendered null on the first
    // React frame and mounted the bar on the second — and because `.hero`
    // derives its padding from `--announce-height`, that second-frame mount
    // pushed everything below the hero down by the bar's height. Lighthouse
    // measured it as the page's single largest layout shift (CLS 0.419
    // desktop). A sync read costs microseconds, happens before the browser
    // ever paints, and serves both goals at once: a dismissing visitor never
    // sees a flash, and a first-time visitor gets the bar on frame 1.
    // In the admin preview we skip storage entirely: the editor must always
    // see what they're editing.
    const [dismissedFor, setDismissedFor] = useState(() => {
        if (inPreview || typeof window === 'undefined') return null;
        try {
            return window.localStorage.getItem(STORAGE_KEY);
        } catch {
            // Storage blocked (private mode) → treat as never dismissed.
            return null;
        }
    });

    const sig = message ? fingerprint(message) : '';
    const visible = !!enabled
        && !!message
        && !(dismissible && dismissedFor === sig);

    useAnnounceHeight(barRef, visible);

    if (!visible) return null;

    const dismiss = () => {
        // In the admin preview closing is inert — otherwise the editor would
        // lose the surface they selected in the navigator with no way back.
        if (inPreview) return;
        setDismissedFor(sig);
        try {
            window.localStorage.setItem(STORAGE_KEY, sig);
        } catch {
            /* storage blocked — the in-memory dismissal still hides the bar */
        }
    };

    const cls = VARIANTS.has(variant) ? variant : 'accent';

    return (
        <div
            ref={barRef}
            className={`announce-bar announce-bar--${cls}${dismissible ? ' announce-bar--dismissible' : ''}`}
            role="region"
            aria-label="Site announcement"
        >
            <p className="announce-bar-body">
                <EditableText path={`announcement.text.${lang}.message`} placeholder="Announcement">
                    {message}
                </EditableText>
                {linkUrl || linkLabel ? (
                    <>
                        {' '}
                        <a
                            className="announce-bar-link"
                            href={linkUrl || '#'}
                            // Same rule as every other marketing link: in the
                            // admin preview a click must not navigate the
                            // iframe away from what the user is editing.
                            onClick={(e) => { if (inPreview) e.preventDefault(); }}
                        >
                            <EditableText path={`announcement.text.${lang}.linkLabel`} placeholder="Link">
                                {linkLabel}
                            </EditableText>
                        </a>
                    </>
                ) : null}
            </p>
            {dismissible ? (
                <button
                    type="button"
                    className="announce-bar-close"
                    onClick={dismiss}
                    aria-label="Dismiss announcement"
                    title="Dismiss"
                >
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
                        <path
                            d="M1.5 1.5l11 11M12.5 1.5l-11 11"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>
            ) : null}
        </div>
    );
}
