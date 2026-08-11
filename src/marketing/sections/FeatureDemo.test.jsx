/**
 * The feature-demo block renders two different things now: the live iframe on
 * desktop, and on a phone a scaled non-interactive preview plus two "Open
 * full screen" links into /__demo__/<id>?vw=1280. Nothing pinned the iframe's
 * containment attributes before this file existed — and those attributes are
 * the sandbox half of the demo security story, so both branches pin them
 * exactly. The other invariant worth a test: the CMS editor's poster outranks
 * the phone branch, so the builder's mobile preview preset never boots a
 * second copy of the app.
 *
 * jsdom reports clientWidth 0, so these tests assert structure and
 * attributes, never measured pixels (the stance src/test/setup.js documents).
 *
 * Run: cd agent-hub && npx vitest run src/marketing/sections/FeatureDemo.test.jsx
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import FeatureDemo from './FeatureDemo';

const base = {
    enabled: true,
    feature: 'routines',
    height: 760,
    theme: 'light',
    title: 'The actual builder',
    note: 'Sample data only.',
    cta: { label: 'Start in the app', link: { href: '/app' } },
};

// Relative, so jsdom's configured origin is preserved — an absolute URL with
// a different host throws SecurityError.
function setPreview(on) {
    window.history.replaceState({}, '', on ? '?preview=1' : '?');
}

// The setup-file stub only installs itself when matchMedia is missing, so a
// per-test swap (restored in afterEach) is safe and does not fight it.
let originalMatchMedia;
function setPhone(on) {
    window.matchMedia = (query) => ({
        matches: on && query === '(max-width: 768px)',
        media: String(query || ''),
        onchange: null,
        addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {},
        dispatchEvent() { return false; },
    });
}

beforeEach(() => { originalMatchMedia = window.matchMedia; });
afterEach(() => {
    window.matchMedia = originalMatchMedia;
    setPreview(false);
});

const CONTAINMENT = {
    sandbox: 'allow-scripts allow-same-origin',
    allow: '',
    referrerpolicy: 'no-referrer',
    loading: 'lazy',
};

function expectContainment(iframe) {
    for (const [attr, value] of Object.entries(CONTAINMENT)) {
        expect(iframe.getAttribute(attr), attr).toBe(value);
    }
}

describe('on desktop', () => {
    it('renders the live iframe with the exact containment attributes', () => {
        setPhone(false);
        const { container } = render(<FeatureDemo data={base} />);

        const iframe = container.querySelector('iframe.feature-demo-iframe');
        expect(iframe).not.toBeNull();
        expect(iframe.getAttribute('src')).toBe('/__demo__/routines?theme=light');
        expectContainment(iframe);
    });

    it('shows no mobile chrome and keeps the block height inline', () => {
        setPhone(false);
        const { container } = render(<FeatureDemo data={base} />);

        expect(container.querySelector('.feature-demo-open-overlay')).toBeNull();
        expect(container.querySelector('.feature-demo-open-btn')).toBeNull();
        expect(container.querySelector('.feature-demo-scale-clip')).toBeNull();
        expect(container.querySelector('.feature-demo-frame').style.height).toBe('760px');
    });
});

describe('on a phone', () => {
    beforeEach(() => setPhone(true));

    it('renders the scaled sandwich instead of a phone-width iframe', () => {
        const { container } = render(<FeatureDemo data={base} />);

        const clip = container.querySelector('.feature-demo-scale-clip');
        expect(clip).not.toBeNull();

        const canvas = container.querySelector('.feature-demo-scale-canvas');
        expect(canvas.getAttribute('aria-hidden')).toBe('true');
        expect(canvas.style.width).toBe('1280px');
        expect(canvas.style.transformOrigin).toBe('top left');
        expect(canvas.style.transform).toMatch(/^scale\(/);

        // The framed document keeps the exact same containment as on desktop,
        // sits outside the tab order (it is inside an aria-hidden subtree),
        // and does NOT carry vw — viewport meta is inert inside an iframe.
        const iframe = canvas.querySelector('iframe.feature-demo-iframe');
        expect(iframe.getAttribute('src')).toBe('/__demo__/routines?theme=light');
        expectContainment(iframe);
        expect(iframe.getAttribute('tabindex')).toBe('-1');

        // The frame's height comes from the clip, not from the block field.
        expect(container.querySelector('.feature-demo-frame').style.height).toBe('');
        expect(clip.style.height).toMatch(/px$/);
    });

    it('offers the full-screen demo through both the overlay and the footer button, same tab', () => {
        const { container } = render(<FeatureDemo data={base} />);

        const overlay = container.querySelector('a.feature-demo-open-overlay');
        const button = container.querySelector('a.feature-demo-open-btn');
        for (const link of [overlay, button]) {
            expect(link).not.toBeNull();
            expect(link.getAttribute('href')).toBe('/__demo__/routines?theme=light&vw=1280');
            // Same tab on purpose: the demo host's close button relies on
            // history.back() landing on this exact page.
            expect(link.getAttribute('target')).toBeNull();
        }
        expect(button.textContent).toMatch(/Open full screen/);
        // The note and an AUTHORED cta survive next to the new button. (No
        // cta ships by default any more — the owner removed the "Open the
        // real thing" button — but the renderer capability stays.)
        expect(screen.getByText('Sample data only.')).toBeInTheDocument();
        expect(screen.getByText('Start in the app')).toBeInTheDocument();
    });

    it('carries a dark theme into the full-screen URL', () => {
        const { container } = render(<FeatureDemo data={{ ...base, theme: 'dark' }} />);
        expect(container.querySelector('a.feature-demo-open-overlay').getAttribute('href'))
            .toBe('/__demo__/routines?theme=dark&vw=1280');
    });

    it('still renders the placeholder for an unknown feature — no iframe, no links', () => {
        const { container } = render(<FeatureDemo data={{ ...base, feature: 'not-a-feature' }} />);

        expect(container.querySelector('.feature-demo-placeholder')).not.toBeNull();
        expect(container.querySelector('iframe')).toBeNull();
        expect(container.querySelector('.feature-demo-open-overlay')).toBeNull();
        expect(container.querySelector('.feature-demo-open-btn')).toBeNull();
    });

    it('shows the poster in the CMS editor preview, never the scaled preview', () => {
        setPreview(true);
        const { container } = render(<FeatureDemo data={base} />);

        expect(container.querySelector('.feature-demo-poster')).not.toBeNull();
        expect(container.querySelector('.feature-demo-scale-clip')).toBeNull();
        expect(container.querySelector('iframe')).toBeNull();
    });
});

// Guards the hooks-above-early-return refactor: hooks now run before the
// enabled check, and a disabled block must still render nothing on either
// branch.
describe('a disabled block', () => {
    it.each([['desktop', false], ['phone', true]])('renders nothing on %s', (_label, phone) => {
        setPhone(phone);
        const { container } = render(<FeatureDemo data={{ ...base, enabled: false }} />);
        expect(container.firstChild).toBeNull();
    });
});
