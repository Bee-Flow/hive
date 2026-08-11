// Vitest global setup.
// Registers @testing-library/jest-dom matchers so tests can use
// `expect(el).toBeInTheDocument()`, `toHaveTextContent()`, etc.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// The EN i18n catalogue is loaded asynchronously in production (it was 55% of
// the entry chunk; see hooks/useTranslation.jsx) and every surface that
// translates is imported through lazyWithI18n, which awaits it. Tests mount
// components directly, skipping that boundary — so the setup awaits the same
// promise once, giving every test the exact guarantee production surfaces
// have: by the time a component renders, t() resolves against the full
// catalogue, never a raw key.
//
// Dynamic import behind a window guard: a handful of suites run in the plain
// node environment (the lockstep tests), and useTranslation's import chain
// reaches utils/helpers.js, which reads window.location at module scope.
if (typeof window !== 'undefined') {
    const { ensureI18nDefaults } = await import('../hooks/useTranslation');
    await ensureI18nDefaults();
}

// Each test gets a fresh DOM. Without this the React-Testing-Library
// container leaks across tests and assertions get cross-contaminated.
afterEach(() => {
    cleanup();
});

// jsdom implements neither of these, and components that measure themselves
// (the meeting-notes timeline, waveform and virtualised lists) throw on mount
// rather than degrade. That turns "does this screen render" into an untestable
// question in exactly the places where layout logic lives. A no-op observer is
// enough: tests assert on content, not on measured pixels.
if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
}
// jsdom has no matchMedia either, and components that branch on a media
// query (InputArea, the meeting-notes layout) call it during render — so the
// component throws instead of picking a branch. Report "no match": the
// desktop/default branch is the one worth asserting against.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
    window.matchMedia = (query) => ({
        matches: false,
        media: String(query || ''),
        onchange: null,
        addListener() {}, removeListener() {},      // deprecated, still used
        addEventListener() {}, removeEventListener() {},
        dispatchEvent() { return false; },
    });
}
// jsdom implements no scrolling at all, so any component that pins a chat to
// the newest message throws on mount rather than degrading. Browsers all have
// this; a no-op is the right stand-in for a DOM with no viewport.
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = function scrollIntoView() {};
}
if (typeof globalThis.IntersectionObserver === 'undefined') {
    globalThis.IntersectionObserver = class IntersectionObserver {
        constructor() { this.root = null; this.rootMargin = ''; this.thresholds = []; }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() { return []; }
    };
}
