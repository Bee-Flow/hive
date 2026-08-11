import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import Header from './Header.jsx';

// Active-state pin: page-kind links resolve to `/slug` on the published site
// but `/?slug=slug` in the admin preview — isActive must match both, and the
// homepage entry (`/`, empty activeSlug) must highlight too.

const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
    { label: 'Pricing', href: '/?slug=pricing' },
];

const renderHeader = (activeSlug) => render(
    <Header data={{ enabled: true, logoText: 'T', navLinks, activeSlug }} />,
);

const activeLabels = (container) =>
    [...container.querySelectorAll('.header-nav a.active')].map(a => a.textContent);

describe('Header nav active state', () => {
    beforeEach(() => {
        window.history.replaceState(null, '', '/');
    });

    it('highlights the published-site href form (/slug)', () => {
        const { container } = renderHeader('about');
        expect(activeLabels(container)).toEqual(['About']);
    });

    it('highlights the admin-preview href form (/?slug=slug)', () => {
        const { container } = renderHeader('pricing');
        expect(activeLabels(container)).toEqual(['Pricing']);
    });

    it('highlights the homepage entry when viewing the homepage', () => {
        const { container } = renderHeader('');
        expect(activeLabels(container)).toEqual(['Home']);
    });

    it('highlights nothing for a slug with no nav entry', () => {
        const { container } = renderHeader('contact');
        expect(activeLabels(container)).toEqual([]);
    });
});
