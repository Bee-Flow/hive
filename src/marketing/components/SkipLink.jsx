import React from 'react';
import './skipLink.css';

/**
 * "Skip to content" — the first focusable element on the marketing site.
 *
 * Keyboard and screen-reader users otherwise have to tab through the
 * announcement bar, the full desktop nav (including mega-menu triggers)
 * and the header CTAs on EVERY page before reaching the content. The link
 * targets the `<main id="main">` landmark that ProductWebsite wraps the
 * page blocks in.
 *
 * Visually hidden until focused (see skipLink.css). Not rendered in the
 * admin preview iframe: there is no keyboard-tab flow to shortcut inside
 * the editor, and the fixed pill would sit on top of the editing chrome.
 */
const isPreviewMode = () =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('preview');

export default function SkipLink() {
    if (isPreviewMode()) return null;
    return (
        <a className="skip-link" href="#main">
            Skip to content
        </a>
    );
}
