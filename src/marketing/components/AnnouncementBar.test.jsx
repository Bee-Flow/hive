import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import AnnouncementBar from './AnnouncementBar';

const TEXT = {
    en: { message: 'We are SOC 2 certified', linkLabel: 'Read more', linkUrl: '/security' },
    nl: { message: 'Wij zijn SOC 2 gecertificeerd', linkLabel: 'Lees meer', linkUrl: '/security' },
};

// The renderer publishes --announce-height on the closest .marketing-root,
// so every test mounts inside one (mirrors ProductWebsite.jsx).
function mount(props) {
    const root = document.createElement('div');
    root.className = 'marketing-root';
    document.body.appendChild(root);
    return { root, ...render(<AnnouncementBar {...props} />, { container: root }) };
}

describe('AnnouncementBar', () => {
    beforeEach(() => { window.localStorage.clear(); });
    afterEach(() => {
        cleanup();
        document.querySelectorAll('.marketing-root').forEach(n => n.remove());
    });

    it('renders nothing when disabled', () => {
        mount({ enabled: false, text: TEXT });
        expect(screen.queryByText(TEXT.en.message)).toBeNull();
    });

    it('renders nothing when the resolved locale has no message', () => {
        mount({ enabled: true, text: { en: { message: '' } } });
        expect(document.querySelector('.announce-bar')).toBeNull();
    });

    it('renders the message + link for the requested language', () => {
        mount({ enabled: true, language: 'nl', text: TEXT });
        expect(screen.getByText(TEXT.nl.message)).toBeInTheDocument();
        const link = document.querySelector('.announce-bar-link');
        expect(link.getAttribute('href')).toBe('/security');
        expect(link.textContent).toBe(TEXT.nl.linkLabel);
    });

    it('falls back to English for a language the blob has no copy for', () => {
        mount({ enabled: true, language: 'de', text: TEXT });
        expect(screen.getByText(TEXT.en.message)).toBeInTheDocument();
    });

    it('applies the variant class and defaults unknown variants to accent', () => {
        mount({ enabled: true, text: TEXT, variant: 'dark' });
        expect(document.querySelector('.announce-bar--dark')).toBeTruthy();
        cleanup();
        mount({ enabled: true, text: TEXT, variant: 'nonsense' });
        expect(document.querySelector('.announce-bar--accent')).toBeTruthy();
    });

    it('publishes --announce-height on the marketing root and clears it when gone', () => {
        const { root, rerender } = mount({ enabled: true, text: TEXT });
        expect(root.style.getPropertyValue('--announce-height')).toMatch(/^\d+px$/);
        rerender(<AnnouncementBar enabled={false} text={TEXT} />);
        // Absent bar → property removed → every calc() falls back to 0px.
        expect(root.style.getPropertyValue('--announce-height')).toBe('');
    });

    it('hides the close button when dismissible is false', () => {
        mount({ enabled: true, text: TEXT, dismissible: false });
        expect(document.querySelector('.announce-bar-close')).toBeNull();
    });

    it('dismisses, persists a fingerprint, and stays hidden on remount', () => {
        mount({ enabled: true, text: TEXT });
        fireEvent.click(document.querySelector('.announce-bar-close'));
        expect(document.querySelector('.announce-bar')).toBeNull();
        const stored = window.localStorage.getItem('cms.announcementDismissed');
        expect(stored).toBeTruthy();

        cleanup();
        mount({ enabled: true, text: TEXT });
        expect(document.querySelector('.announce-bar')).toBeNull();
    });

    it('re-shows when the message changes after a dismissal', () => {
        mount({ enabled: true, text: TEXT });
        fireEvent.click(document.querySelector('.announce-bar-close'));
        cleanup();

        const next = { en: { ...TEXT.en, message: 'Black Friday: 30% off' } };
        mount({ enabled: true, text: next });
        expect(screen.getByText('Black Friday: 30% off')).toBeInTheDocument();
    });
});
