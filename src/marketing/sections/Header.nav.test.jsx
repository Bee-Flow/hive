/**
 * The nav's INTERACTIONS, as opposed to Header.test.jsx's active-state pins.
 *
 * Everything here was reachable-looking but broken:
 *   - a mobile parent row could only expand, so "Product" (a real page at
 *     /platform) had no route to it on a phone at all;
 *   - the mega panel claimed role="menu" with no menuitem children;
 *   - nothing closed a panel except moving the mouse, which a touch device
 *     cannot do;
 *   - the drawer left the page scrolling underneath itself.
 *
 * Run: cd agent-hub && npx vitest run src/marketing/sections/Header.nav.test.jsx
 */
import { render, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Header from './Header.jsx';

const MEGA = {
    id: 'nav_product',
    label: 'Product',
    href: '/platform',
    dropdown: {
        layout: 'columns',
        columns: [
            {
                heading: 'Work with AI',
                items: [
                    { label: 'Platform overview', href: '/platform', description: 'Chat, agents and automations', icon: 'LayoutGrid' },
                    { label: 'Notebooks', href: '/notebooks', description: 'Draft from your sources', icon: 'NotebookPen' },
                ],
            },
            {
                heading: 'Trust',
                items: [{ label: 'Privacy Shield', href: '/privacy-shield', description: 'See what reaches the model', icon: 'ShieldCheck' }],
            },
        ],
    },
};

const data = {
    enabled: true,
    logoText: 'T',
    navLinks: [MEGA, { label: 'Pricing', href: '/pricing' }],
    ctas: [{ id: 'c1', label: 'Open the app', href: '/app', style: 'primary' }],
    activeSlug: '',
};

const renderHeader = (over = {}) => render(<Header data={{ ...data, ...over }} />);
const drawer = (c) => c.querySelector('.mobile-nav');
const megaPanel = (c) => c.querySelector('.nav-mega');

beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(() => { document.body.style.overflow = ''; });

describe('the mega panel', () => {
    it('is not announced as a menu — it is a panel of ordinary links', () => {
        // role="menu" without menuitem children makes a screen reader
        // announce an empty menu. The links are just links.
        const { container } = renderHeader();
        expect(megaPanel(container).getAttribute('role')).toBeNull();
        expect(container.querySelectorAll('.nav-mega [role="menuitem"]')).toHaveLength(0);
    });

    it('marks the trigger as a popup owner and tracks its open state', () => {
        const { container } = renderHeader();
        const trigger = container.querySelector('.nav-item.has-dropdown > a');
        expect(trigger.getAttribute('aria-haspopup')).toBe('true');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');

        fireEvent.mouseEnter(container.querySelector('.nav-item.has-dropdown'));
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
    });

    it('renders every column and every description', () => {
        const { container } = renderHeader();
        expect(container.querySelectorAll('.nav-mega-col')).toHaveLength(2);
        expect(container.querySelectorAll('.nav-mega-item')).toHaveLength(3);
        expect(within(megaPanel(container)).getByText('Chat, agents and automations')).toBeTruthy();
    });

    it('closes on Escape', () => {
        const { container } = renderHeader();
        const item = container.querySelector('.nav-item.has-dropdown');
        fireEvent.mouseEnter(item);
        expect(item.className).toContain('is-open');

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(item.className).not.toContain('is-open');
    });

    it('toggles on click instead of navigating to the first child', () => {
        // The regression: a click on "Product" followed the trigger's own
        // href, so the panel was unusable for anyone who clicks instead of
        // hovers — and the review saw "Resources" jump to /roadmap.
        const { container } = renderHeader();
        const item = container.querySelector('.nav-item.has-dropdown');
        const trigger = item.querySelector('a');

        // fireEvent.click returns false when preventDefault was called —
        // i.e. the browser will NOT follow the href.
        expect(fireEvent.click(trigger)).toBe(false);
        expect(item.className).toContain('is-open');

        expect(fireEvent.click(trigger)).toBe(false);
        expect(item.className).not.toContain('is-open');
    });

    it('survives the focus-opens-first tap sequence without flashing shut', () => {
        // pointerdown → focus (wrapper onFocus opens the panel) → click.
        // The click must respect the pointerdown-time state, or the same
        // tap that opened the panel immediately closes it on touch.
        const { container } = renderHeader();
        const item = container.querySelector('.nav-item.has-dropdown');
        const trigger = item.querySelector('a');

        fireEvent.pointerDown(trigger);
        fireEvent.focus(trigger);
        expect(item.className).toContain('is-open');
        fireEvent.click(trigger);
        expect(item.className).toContain('is-open');
    });

    it('toggles from the keyboard with Space', () => {
        const { container } = renderHeader();
        const item = container.querySelector('.nav-item.has-dropdown');
        const trigger = item.querySelector('a');

        fireEvent.keyDown(trigger, { key: ' ' });
        expect(item.className).toContain('is-open');
        fireEvent.keyDown(trigger, { key: ' ' });
        expect(item.className).not.toContain('is-open');
    });

    it('leaves modified clicks (new tab) to the browser', () => {
        const { container } = renderHeader();
        const trigger = container.querySelector('.nav-item.has-dropdown > a');
        // Not prevented — ctrl+click may open the href in a new tab.
        expect(fireEvent.click(trigger, { ctrlKey: true })).toBe(true);
    });

    it('keeps plain links without a dropdown navigating normally', () => {
        const { container } = renderHeader();
        const links = [...container.querySelectorAll('.header-nav > a')];
        const pricing = links.find(a => a.textContent === 'Pricing');
        expect(fireEvent.click(pricing)).toBe(true); // not prevented
    });

    it('closes on a click outside the nav', () => {
        // The only way to dismiss a tapped-open panel on a touch device.
        const { container } = renderHeader();
        const item = container.querySelector('.nav-item.has-dropdown');
        fireEvent.mouseEnter(item);
        expect(item.className).toContain('is-open');

        fireEvent.pointerDown(document.body);
        expect(item.className).not.toContain('is-open');
    });

    it('gives the header a background while it is open', () => {
        // Otherwise an opaque panel hangs off a transparent bar at the top
        // of the page.
        const { container } = renderHeader();
        const header = container.querySelector('header.header');
        expect(header.className).not.toContain('nav-open');
        fireEvent.mouseEnter(container.querySelector('.nav-item.has-dropdown'));
        expect(header.className).toContain('nav-open');
    });
});

describe('the mobile drawer', () => {
    const openDrawer = (container) => {
        fireEvent.click(container.querySelector('.hamburger'));
        return drawer(container);
    };

    it('lets you reach the parent page AND expand its submenu', () => {
        // The regression this file exists for: one control that only ever
        // toggled meant /platform was unreachable on a phone.
        const { container } = renderHeader();
        openDrawer(container);
        const row = container.querySelector('.mobile-nav-row');

        const label = within(row).getByText('Product');
        expect(label.tagName).toBe('A');
        expect(label.getAttribute('href')).toBe('/platform');

        const caret = row.querySelector('.mobile-nav-caret');
        expect(caret.getAttribute('aria-expanded')).toBe('false');
        fireEvent.click(caret);
        expect(caret.getAttribute('aria-expanded')).toBe('true');
        expect(container.querySelector('.mobile-nav-children')).toBeTruthy();
    });

    it('falls back to toggling on the label when the parent has no href', () => {
        const { container } = renderHeader({
            navLinks: [{ ...MEGA, href: '' }],
        });
        openDrawer(container);
        const label = container.querySelector('.mobile-nav-label');
        expect(label.tagName).toBe('BUTTON');
        fireEvent.click(label);
        expect(container.querySelector('.mobile-nav-children')).toBeTruthy();
    });

    it('keeps the descriptions that make the submenu legible', () => {
        const { container } = renderHeader();
        openDrawer(container);
        fireEvent.click(container.querySelector('.mobile-nav-caret'));
        const descs = [...container.querySelectorAll('.mobile-nav-item-desc')].map(n => n.textContent);
        expect(descs).toContain('Draft from your sources');
    });

    it('shows only one section at a time', () => {
        const { container } = renderHeader({
            navLinks: [MEGA, { ...MEGA, id: 'b', label: 'Second' }],
        });
        openDrawer(container);
        const carets = container.querySelectorAll('.mobile-nav-caret');
        fireEvent.click(carets[0]);
        fireEvent.click(carets[1]);
        expect(carets[0].getAttribute('aria-expanded')).toBe('false');
        expect(carets[1].getAttribute('aria-expanded')).toBe('true');
    });

    it('renders the CTA as a button, not another nav link', () => {
        const { container } = renderHeader();
        openDrawer(container);
        const cta = container.querySelector('.mobile-nav-cta');
        expect(cta.className).toContain('mobile-nav-cta--primary');
        expect(cta.textContent).toBe('Open the app');
    });

    it('locks the page while open and restores it on close', () => {
        const { container } = renderHeader();
        openDrawer(container);
        expect(document.body.style.overflow).toBe('hidden');
        fireEvent.click(container.querySelector('.hamburger'));
        expect(document.body.style.overflow).not.toBe('hidden');
    });

    it('closes on the scrim, on Escape, and on following a link', () => {
        const { container } = renderHeader();

        openDrawer(container);
        fireEvent.click(container.querySelector('.mobile-nav-scrim'));
        expect(drawer(container).className).not.toContain('active');

        openDrawer(container);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(drawer(container).className).not.toContain('active');

        // Scoped to the drawer: the same label also exists in the desktop
        // nav, which does not (and must not) close it.
        openDrawer(container);
        fireEvent.click(within(drawer(container)).getByText('Pricing'));
        expect(drawer(container).className).not.toContain('active');
    });
});

describe('the logo', () => {
    it('resolves a cms/ key through the asset route', () => {
        // A bare `cms/x.svg` src is RELATIVE: on /solutions it resolves to
        // /solutions/cms/x.svg, hits the SPA catch-all and comes back as
        // index.html with content-type text/html — a broken image on every
        // page of the site, which is exactly what shipped.
        const { container } = renderHeader({ logo: { src: 'cms/beeflow-logo.svg', text: 'Bee Flow' } });
        const img = container.querySelector('.logo-image');
        expect(img.getAttribute('src')).toBe('/api/cms/asset/cms/beeflow-logo.svg');
    });

    it('leaves an absolute or root-relative src alone', () => {
        for (const src of ['https://cdn.example/logo.png', '/static/logo.png']) {
            const { container } = renderHeader({ logo: { src, text: 'Bee Flow' } });
            expect(container.querySelector('.logo-image').getAttribute('src')).toBe(src);
        }
    });

    it('marks the image decorative when the brand name is rendered too', () => {
        const { container } = renderHeader({ logo: { src: 'cms/l.svg', text: 'Bee Flow' } });
        expect(container.querySelector('.logo-image').getAttribute('alt')).toBe('');

        const { container: bare } = renderHeader({ logo: { src: 'cms/l.svg', text: '' } });
        expect(bare.querySelector('.logo-image').getAttribute('alt')).toBe('Logo');
    });

    it('falls back to the letter avatar with no logo image', () => {
        const { container } = renderHeader({ logo: { text: 'Bee Flow' } });
        expect(container.querySelector('.logo-image')).toBeNull();
        expect(container.querySelector('.logo-tile').textContent).toBe('B');
    });
});
