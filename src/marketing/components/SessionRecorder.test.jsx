import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import SessionRecorder from './SessionRecorder.jsx';

const SCRIPT_ID = 'bf-umami-recorder';
const WEBSITE_ID = 'web_123';
const RECORDER_URL = 'https://stats.example.com/recorder.js';
const tag = () => document.getElementById(SCRIPT_ID);

const accept = () => {
    window.localStorage.setItem('cookie_consent', 'accepted');
    window.dispatchEvent(new CustomEvent('bf-cookie-consent', { detail: 'accepted' }));
};
const withdraw = () => {
    window.localStorage.setItem('cookie_consent', 'declined');
    window.dispatchEvent(new CustomEvent('bf-cookie-consent', { detail: 'declined' }));
};

const props = { websiteId: WEBSITE_ID, recorderUrl: RECORDER_URL };

describe('SessionRecorder', () => {
    beforeEach(() => {
        cleanup();
        tag()?.remove();
        try { window.localStorage.clear(); } catch { /* ignore */ }
        window.history.replaceState(null, '', '/');
    });
    afterEach(() => { tag()?.remove(); });

    it('renders nothing and holds the recorder until consent is accepted', () => {
        const { container } = render(<SessionRecorder {...props} />);
        expect(container.firstChild).toBeNull();
        expect(tag()).toBeNull();
    });

    it('injects the recorder on consent accept, with inputs masked', () => {
        render(<SessionRecorder {...props} />);
        accept();
        const s = tag();
        expect(s).toBeTruthy();
        expect(s.src).toBe(RECORDER_URL);
        expect(s.getAttribute('data-website-id')).toBe(WEBSITE_ID);
        expect(s.getAttribute('data-mask-all-inputs')).toBe('true');
        expect(s.defer).toBe(true);
    });

    it('removes the recorder when consent is withdrawn', () => {
        render(<SessionRecorder {...props} />);
        accept();
        expect(tag()).toBeTruthy();
        withdraw();
        expect(tag()).toBeNull();
    });

    it('reacts to consent granted in another tab (storage event)', () => {
        render(<SessionRecorder {...props} />);
        window.localStorage.setItem('cookie_consent', 'accepted');
        window.dispatchEvent(new StorageEvent('storage', { key: 'cookie_consent', newValue: 'accepted' }));
        expect(tag()).toBeTruthy();
    });

    it('never injects twice', () => {
        render(<SessionRecorder {...props} />);
        accept();
        accept();
        expect(document.querySelectorAll(`#${SCRIPT_ID}`).length).toBe(1);
    });

    it('never records inside the admin preview iframe', () => {
        window.history.replaceState(null, '', '/?preview=1');
        render(<SessionRecorder {...props} />);
        accept();
        expect(tag()).toBeNull();
    });

    it('does nothing without a websiteId or recorderUrl', () => {
        render(<SessionRecorder websiteId={WEBSITE_ID} />);
        accept();
        expect(tag()).toBeNull();
        cleanup();
        render(<SessionRecorder recorderUrl={RECORDER_URL} />);
        accept();
        expect(tag()).toBeNull();
    });

    // The headline privacy guarantee: unlike the cookieless pageview tracker,
    // recording is NEVER consent-free. There is no prop that relaxes this.
    it('stays gated even though the site may be in cookieless mode', () => {
        render(<SessionRecorder {...props} consentMode="cookieless" />);
        expect(tag()).toBeNull();
        accept();
        expect(tag()).toBeTruthy();
    });
});
