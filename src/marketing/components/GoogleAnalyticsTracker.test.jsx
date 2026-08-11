import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import GoogleAnalyticsTracker from './GoogleAnalyticsTracker.jsx';

const SCRIPT_ID = 'bf-ga-tracker';
const INIT_ID = 'bf-ga-init';
const ID = 'G-ABCD1234';
const tag = () => document.getElementById(SCRIPT_ID);
const init = () => document.getElementById(INIT_ID);

const accept = () => {
    window.localStorage.setItem('cookie_consent', 'accepted');
    window.dispatchEvent(new CustomEvent('bf-cookie-consent', { detail: 'accepted' }));
};
const withdraw = () => {
    window.localStorage.setItem('cookie_consent', 'declined');
    window.dispatchEvent(new CustomEvent('bf-cookie-consent', { detail: 'declined' }));
};

describe('GoogleAnalyticsTracker', () => {
    beforeEach(() => {
        cleanup();
        tag()?.remove();
        init()?.remove();
        delete window[`ga-disable-${ID}`];
        try { window.localStorage.clear(); } catch { /* ignore */ }
        window.history.replaceState(null, '', '/');
    });
    afterEach(() => { tag()?.remove(); init()?.remove(); });

    it('renders nothing and holds the script until consent is accepted', () => {
        const { container } = render(<GoogleAnalyticsTracker measurementId={ID} />);
        expect(container.firstChild).toBeNull();
        expect(tag()).toBeNull();
        expect(init()).toBeNull();
    });

    it('injects gtag.js + the init snippet on consent accept', () => {
        render(<GoogleAnalyticsTracker measurementId={ID} />);
        accept();
        const s = tag();
        expect(s).toBeTruthy();
        expect(s.async).toBe(true);
        expect(s.src).toBe(`https://www.googletagmanager.com/gtag/js?id=${ID}`);
        expect(init()?.text).toContain(`gtag('config', '${ID}', { anonymize_ip: true });`);
        expect(window[`ga-disable-${ID}`]).toBe(false);
    });

    it('injects immediately when consent was accepted before mount', () => {
        window.localStorage.setItem('cookie_consent', 'accepted');
        render(<GoogleAnalyticsTracker measurementId={ID} />);
        expect(tag()).toBeTruthy();
    });

    it('removes both tags and sets the ga-disable flag on withdrawal', () => {
        window.localStorage.setItem('cookie_consent', 'accepted');
        render(<GoogleAnalyticsTracker measurementId={ID} />);
        expect(tag()).toBeTruthy();

        withdraw();
        expect(tag()).toBeNull();
        expect(init()).toBeNull();
        expect(window[`ga-disable-${ID}`]).toBe(true);
    });

    it('never injects in the admin preview iframe (?preview)', () => {
        window.localStorage.setItem('cookie_consent', 'accepted');
        window.history.replaceState(null, '', '/?preview=1');
        render(<GoogleAnalyticsTracker measurementId={ID} />);
        expect(tag()).toBeNull();
    });

    it('rejects malformed measurement ids outright', () => {
        window.localStorage.setItem('cookie_consent', 'accepted');
        render(<GoogleAnalyticsTracker measurementId={"G-abc'};alert(1);//"} />);
        expect(tag()).toBeNull();
        expect(init()).toBeNull();
    });

    it('does not inject twice', () => {
        window.localStorage.setItem('cookie_consent', 'accepted');
        const { rerender } = render(<GoogleAnalyticsTracker measurementId={ID} />);
        rerender(<GoogleAnalyticsTracker measurementId={ID} />);
        accept();
        expect(document.querySelectorAll(`#${SCRIPT_ID}`).length).toBe(1);
        expect(document.querySelectorAll(`#${INIT_ID}`).length).toBe(1);
    });
});
