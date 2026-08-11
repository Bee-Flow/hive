import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import AnalyticsTracker from './AnalyticsTracker.jsx';

const SCRIPT_ID = 'bf-umami-tracker';
const tracker = () => document.getElementById(SCRIPT_ID);

const baseProps = {
    websiteId: 'w-123',
    scriptUrl: 'https://stats.example.com/script.js',
};

describe('AnalyticsTracker', () => {
    beforeEach(() => {
        cleanup();
        tracker()?.remove();
        try { window.localStorage.clear(); } catch { /* ignore */ }
        // jsdom default URL has no ?preview — keep it that way.
        window.history.replaceState(null, '', '/');
    });
    afterEach(() => { tracker()?.remove(); });

    it('renders nothing in the DOM tree', () => {
        const { container } = render(<AnalyticsTracker {...baseProps} consentMode="cookieless" />);
        expect(container.firstChild).toBeNull();
    });

    it('injects a deferred, same-config tracker script in cookieless mode', () => {
        render(<AnalyticsTracker {...baseProps} consentMode="cookieless" />);
        const s = tracker();
        expect(s).toBeTruthy();
        expect(s.defer).toBe(true);
        expect(s.getAttribute('data-website-id')).toBe('w-123');
        expect(s.getAttribute('src')).toBe('https://stats.example.com/script.js');
    });

    it('asks the tracker to collect web vitals', () => {
        // Umami gates its ENTIRE PerformanceObserver block on this attribute
        // being the literal string "true". Without it no vital is ever recorded
        // and the Performance tab reports a flawless 0 ms it never measured.
        render(<AnalyticsTracker {...baseProps} consentMode="cookieless" />);
        expect(tracker().getAttribute('data-performance')).toBe('true');
        expect(tracker().getAttribute('data-exclude-hash')).toBe('true');
    });

    it('replaces the tag when the config changes (attributes are read once, at eval)', () => {
        const { rerender } = render(<AnalyticsTracker {...baseProps} consentMode="cookieless" />);
        const first = tracker();
        // Same config → same node, no needless reload.
        rerender(<AnalyticsTracker {...baseProps} consentMode="cookieless" />);
        expect(tracker()).toBe(first);

        rerender(<AnalyticsTracker {...baseProps} websiteId="w-999" consentMode="cookieless" />);
        expect(tracker()).not.toBe(first);
        expect(tracker().getAttribute('data-website-id')).toBe('w-999');
        expect(document.querySelectorAll(`#${SCRIPT_ID}`).length).toBe(1);
    });

    it('does not inject without a websiteId or scriptUrl', () => {
        render(<AnalyticsTracker consentMode="cookieless" />);
        expect(tracker()).toBeNull();
    });

    it('does not inject in the admin preview iframe (?preview)', () => {
        window.history.replaceState(null, '', '/?preview=1');
        render(<AnalyticsTracker {...baseProps} consentMode="cookieless" />);
        expect(tracker()).toBeNull();
    });

    it('cookie mode: holds the script until consent is accepted', () => {
        render(<AnalyticsTracker {...baseProps} consentMode="cookies" />);
        expect(tracker()).toBeNull();

        // Visitor accepts → CookieBanner persists + dispatches the event.
        window.localStorage.setItem('cookie_consent', 'accepted');
        window.dispatchEvent(new CustomEvent('bf-cookie-consent', { detail: 'accepted' }));
        expect(tracker()).toBeTruthy();
    });

    it('cookie mode: removes the script when consent is withdrawn', () => {
        window.localStorage.setItem('cookie_consent', 'accepted');
        render(<AnalyticsTracker {...baseProps} consentMode="cookies" />);
        expect(tracker()).toBeTruthy();

        window.localStorage.setItem('cookie_consent', 'declined');
        window.dispatchEvent(new CustomEvent('bf-cookie-consent', { detail: 'declined' }));
        expect(tracker()).toBeNull();
    });

    it('does not inject the script twice', () => {
        const { rerender } = render(<AnalyticsTracker {...baseProps} consentMode="cookieless" />);
        rerender(<AnalyticsTracker {...baseProps} consentMode="cookieless" />);
        expect(document.querySelectorAll(`#${SCRIPT_ID}`).length).toBe(1);
    });
});
