import { render, cleanup } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import CardActionWrapper from './CardActionWrapper';

// The wrapper originally hard-coded target="_blank" because cardUrl was only
// ever an external URL. Cards now also link to our own pages (the /compare hub
// routes to every comparison page this way), and opening an internal page in a
// new tab breaks the back button and leaves a tab per card behind.
//
// The internal/external split is a one-line condition that is very easy to
// undo by accident, so it is pinned here.

function mount(card) {
    return render(
        <CardActionWrapper card={card} className="feature-card">
            <h3>Card</h3>
        </CardActionWrapper>,
    );
}

const anchor = (c) => mount(c).container.querySelector('a');

describe('CardActionWrapper link targets', () => {
    afterEach(cleanup);

    it('keeps internal paths in the same tab', () => {
        const a = anchor({ cardAction: 'link', cardUrl: '/microsoft-alternative' });
        expect(a).not.toBeNull();
        expect(a.getAttribute('href')).toBe('/microsoft-alternative');
        expect(a.getAttribute('target')).toBeNull();
        expect(a.getAttribute('rel')).toBeNull();
    });

    it('opens off-site links in a new tab, with the noopener guard', () => {
        const a = anchor({ cardAction: 'link', cardUrl: 'https://example.com/x' });
        expect(a.getAttribute('target')).toBe('_blank');
        expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('treats a protocol-relative URL as external', () => {
        // '//evil.com' starts with '/' but is NOT ours — the check has to look
        // at the second character or an off-site link silently becomes
        // same-tab, which is the more dangerous direction of this bug.
        const a = anchor({ cardAction: 'link', cardUrl: '//evil.com/x' });
        expect(a.getAttribute('target')).toBe('_blank');
        expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('renders a plain div when there is no link', () => {
        const { container } = mount({ cardAction: 'none' });
        expect(container.querySelector('a')).toBeNull();
        expect(container.querySelector('div.feature-card')).not.toBeNull();
    });

    it('ignores a link action with an empty url', () => {
        const { container } = mount({ cardAction: 'link', cardUrl: '   ' });
        expect(container.querySelector('a')).toBeNull();
    });
});
