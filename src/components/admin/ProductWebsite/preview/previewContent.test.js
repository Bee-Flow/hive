import { describe, it, expect } from 'vitest';
import {
    buildPreviewContent,
    resolvePreviewHref,
    legacyifyLinks,
    chromeStoragePath,
    applyChromeEdit,
    setIn,
} from './previewContent';

const PAGES = [
    { id: 'pg_home', slug: 'home', title: 'Home', isHomepage: true },
    { id: 'pg_pricing', slug: 'pricing plans', title: 'Pricing', isHomepage: false },
];

describe('resolvePreviewHref', () => {
    it('resolves each link kind', () => {
        expect(resolvePreviewHref({ kind: 'anchor', anchor: 'faq' }, PAGES)).toBe('#faq');
        expect(resolvePreviewHref({ kind: 'app', path: '/app/login' }, PAGES)).toBe('/app/login');
        expect(resolvePreviewHref({ kind: 'external', url: 'https://x.test' }, PAGES)).toBe('https://x.test');
        expect(resolvePreviewHref({ kind: 'page', pageId: 'pg_home' }, PAGES)).toBe('/');
        expect(resolvePreviewHref({ kind: 'page', pageId: 'pg_pricing' }, PAGES)).toBe('/?slug=pricing%20plans');
        expect(resolvePreviewHref({ kind: 'page', pageId: 'pg_pricing', anchor: 'tiers' }, PAGES)).toBe('/?slug=pricing%20plans#tiers');
    });
    it('falls back to # for null/deleted-page/unknown links', () => {
        expect(resolvePreviewHref(null, PAGES)).toBe('#');
        expect(resolvePreviewHref({ kind: 'page', pageId: 'pg_gone' }, PAGES)).toBe('#');
        expect(resolvePreviewHref({ kind: 'mystery' }, PAGES)).toBe('#');
    });
});

describe('legacyifyLinks', () => {
    it('rewrites link → href and ctaLink → ctaHref in place', () => {
        const node = {
            cta: { label: 'Go', link: { kind: 'page', pageId: 'pg_home' } },
            ctaLink: { kind: 'external', url: 'https://x.test' },
        };
        legacyifyLinks(node, PAGES);
        expect(node.cta.href).toBe('/');
        expect(node.cta.link).toBeUndefined();
        expect(node.ctaHref).toBe('https://x.test');
        expect(node.ctaLink).toBeUndefined();
    });
    it('leaves non-Link kind discriminators alone (media-text kind:image)', () => {
        const node = { media: { kind: 'image', src: 'cms/x.png' } };
        legacyifyLinks(node, PAGES);
        expect(node.media).toEqual({ kind: 'image', src: 'cms/x.png' });
    });
});

describe('buildPreviewContent', () => {
    const site = {
        pages: PAGES,
        header: {
            logoText: 'Acme',
            nav: [{ label: 'Pricing', link: { kind: 'page', pageId: 'pg_pricing' } }],
            ctas: [{ id: 'c1', label: 'Book', link: { kind: 'external', url: 'https://cal.test', newTab: true } }],
        },
        footer: { brandText: 'Acme', blurb: 'We fly', columns: [], socials: [] },
        cookieBanner: { enabled: true, text: { en: { message: 'hi' } } },
        announcement: {
            enabled: true, dismissible: true, variant: 'accent',
            text: { en: { message: 'We ship', linkLabel: 'More', linkUrl: '/blog' } },
        },
    };
    const page = {
        id: 'pg_pricing', slug: 'pricing plans', hideHeader: true,
        blocks: [
            { id: 'b1', type: 'hero', enabled: true, content: { lead: 'x', primaryCta: { label: 'Go', link: { kind: 'page', pageId: 'pg_home' } } }, style: { maxWidth: 'wide' } },
            { id: 'b2', type: 'cta', enabled: false, content: {} },
        ],
    };

    it('NEVER mutates panel state (deep-clone before legacyifyLinks)', () => {
        const snapshot = JSON.parse(JSON.stringify({ site, page }));
        buildPreviewContent(site, page);
        // The user's source-of-truth Link objects must survive untouched —
        // a shallow copy here silently deletes `link` off panel state and
        // persists the corruption on the next auto-save.
        expect({ site, page }).toEqual(snapshot);
        expect(page.blocks[0].content.primaryCta.link).toEqual({ kind: 'page', pageId: 'pg_home' });
    });

    it('emits blocks[] in order AND the legacy keyed shape, with resolved links', () => {
        const out = buildPreviewContent(site, page);
        expect(out.blocks.map(b => b.id)).toEqual(['b1', 'b2']);
        expect(out.blocks[1].enabled).toBe(false);
        expect(out.blocks[0].style).toEqual({ maxWidth: 'wide' });
        expect(out.hero.primaryCta.href).toBe('/');
        expect(out.hero.primaryCta.link).toBeUndefined();
        expect(out.hideHeader).toBe(true);
        expect(out.hideFooter).toBe(false);
    });

    it('shapes chrome: nav hrefs, cta newTab target/rel, footer brand, cookie banner verbatim', () => {
        const out = buildPreviewContent(site, page);
        expect(out.header.navLinks[0].href).toBe('/?slug=pricing%20plans');
        expect(out.header.ctas[0].target).toBe('_blank');
        expect(out.header.ctas[0].rel).toBe('noopener noreferrer');
        expect(out.header.activeSlug).toBe('pricing plans');
        expect(out.footer.brand).toEqual({ logoText: 'Acme', blurb: 'We fly', showDot: false });
        expect(out.cookieBanner).toEqual(site.cookieBanner);
    });

    it('passes the announcement bar through verbatim, and omits it when absent', () => {
        expect(buildPreviewContent(site, page).announcement).toEqual(site.announcement);
        const { announcement, ...noAnnounce } = site;
        expect(announcement).toBeTruthy();
        expect(buildPreviewContent(noAnnounce, page).announcement).toBeUndefined();
    });
});

describe('chromeStoragePath', () => {
    it('maps display-shape paths to storage-shape paths', () => {
        expect(chromeStoragePath('footer.brand.blurb')).toEqual(['footer', 'blurb']);
        expect(chromeStoragePath('footer.brand.logoText')).toEqual(['footer', 'brandText']);
        expect(chromeStoragePath('header.navLinks.0.label')).toEqual(['header', 'nav', 0, 'label']);
        expect(chromeStoragePath('header.navLinks.1.children.2.label')).toEqual(['header', 'nav', 1, 'children', 2, 'label']);
        expect(chromeStoragePath('header.ctas.1.label')).toEqual(['header', 'ctas', 1, 'label']);
        expect(chromeStoragePath('footer.columns.0.links.1.label')).toEqual(['footer', 'columns', 0, 'links', 1, 'label']);
        expect(chromeStoragePath('header.logoText')).toEqual(['header', 'logoText']);
    });
    it('passes announcement paths straight through (display shape === storage shape)', () => {
        expect(chromeStoragePath('announcement.text.en.message'))
            .toEqual(['announcement', 'text', 'en', 'message']);
        expect(applyChromeEdit({ announcement: { text: { nl: { message: 'oud' } } } },
            'announcement.text.nl.message', 'nieuw').announcement.text.nl.message).toBe('nieuw');
    });
    it('returns null for non-chrome paths', () => {
        expect(chromeStoragePath('hero.lead')).toBeNull();
    });
});

describe('setIn / applyChromeEdit', () => {
    it('is immutable and produces arrays for numeric segments', () => {
        const site = { header: { nav: [{ label: 'A' }] } };
        const next = setIn(site, ['header', 'nav', 0, 'label'], 'B');
        expect(next.header.nav[0].label).toBe('B');
        expect(site.header.nav[0].label).toBe('A');
        expect(Array.isArray(next.header.nav)).toBe(true);
    });
    it('creates missing intermediates', () => {
        const next = setIn({}, ['footer', 'columns', 1, 'heading'], 'X');
        expect(next.footer.columns[1].heading).toBe('X');
        expect(Array.isArray(next.footer.columns)).toBe(true);
    });
    it('applyChromeEdit routes through the inverse map and ignores non-chrome paths', () => {
        const site = { footer: { blurb: 'old' } };
        const next = applyChromeEdit(site, 'footer.brand.blurb', 'new');
        expect(next.footer.blurb).toBe('new');
        expect(site.footer.blurb).toBe('old');
        expect(applyChromeEdit(site, 'hero.lead', 'x')).toBeNull();
    });
});
