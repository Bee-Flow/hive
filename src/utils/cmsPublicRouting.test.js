import { describe, it, expect } from 'vitest';
import { RESERVED_TOP_LEVEL, CMS_FALLBACK_SLUGS, hasCmsFallback, isCmsPathCandidate, isPublicMarketingPath, parseCmsPath, LOCALE_PREFIXES, slugIssues } from './cmsPublicRouting';

describe('isCmsPathCandidate', () => {
    it('accepts the homepage and plain single-segment slugs', () => {
        expect(isCmsPathCandidate('/')).toBe(true);
        expect(isCmsPathCandidate('')).toBe(true);
        expect(isCmsPathCandidate('/about')).toBe(true);
        expect(isCmsPathCandidate('/about-us/')).toBe(true);
    });
    it('rejects reserved paths, multi-segment paths and underscores', () => {
        expect(isCmsPathCandidate('/app')).toBe(false);
        expect(isCmsPathCandidate('/a/b')).toBe(false);
        expect(isCmsPathCandidate('/my_page')).toBe(false);
        expect(isCmsPathCandidate('/__cms_preview__')).toBe(false);
    });

    // /pricing was reserved, so a CMS page at that slug could be authored and
    // edited but never rendered — production shipped exactly that, an
    // invisible pricing page. Editors own it now.
    it('lets the CMS serve /pricing', () => {
        expect(isCmsPathCandidate('/pricing')).toBe(true);
        expect(RESERVED_TOP_LEVEL.has('pricing')).toBe(false);
    });

    it('reserves /f for hosted form pages', () => {
        // Without this the CMS catch-all claims /f/<token> and every published
        // form URL renders a CMS 404 instead of the form.
        expect(RESERVED_TOP_LEVEL.has('f')).toBe(true);
        expect(isCmsPathCandidate('/f')).toBe(false);
        expect(parseCmsPath('/f/abcdef')).toBeNull();
    });

    it('keeps the DSR-form URL reserved', () => {
        // /privacy frames the public DSR request form; a CMS page must not be
        // able to shadow it.
        expect(isCmsPathCandidate('/privacy')).toBe(false);
    });
});

describe('isPublicMarketingPath', () => {
    // The consent boundary for trackers and telemetry (webVitalsReporter,
    // telemetry/openobserve): on these paths the CookieBanner decision governs.
    it('covers CMS pages and the framed static public pages', () => {
        expect(isPublicMarketingPath('/')).toBe(true);
        expect(isPublicMarketingPath('/pricing')).toBe(true);
        expect(isPublicMarketingPath('/nl/pricing')).toBe(true);
        expect(isPublicMarketingPath('/privacy')).toBe(true);
        expect(isPublicMarketingPath('/privacy/requests')).toBe(true);
        expect(isPublicMarketingPath('/__demo__/agents')).toBe(true);
    });
    it('excludes product surfaces, whose telemetry regime is separate', () => {
        expect(isPublicMarketingPath('/app')).toBe(false);
        expect(isPublicMarketingPath('/app/agents')).toBe(false);
        expect(isPublicMarketingPath('/login')).toBe(false);
        expect(isPublicMarketingPath('/chat/abc123')).toBe(false);
        expect(isPublicMarketingPath('/f/0123456789abcdef01234567')).toBe(false);
        expect(isPublicMarketingPath(null)).toBe(false);
    });
});

describe('CMS_FALLBACK_SLUGS', () => {
    // Every feature_locked 403 in the product sends the user to
    // <host>/pricing. If the CMS has no such page the path must still resolve
    // to the built-in one rather than bouncing into the app shell.
    it('covers /pricing, the hardcoded upgrade destination', () => {
        expect(CMS_FALLBACK_SLUGS.has('pricing')).toBe(true);
    });

    it('only contains slugs the CMS is allowed to serve', () => {
        for (const slug of CMS_FALLBACK_SLUGS) {
            expect(RESERVED_TOP_LEVEL.has(slug)).toBe(false);
            expect(isCmsPathCandidate(`/${slug}`)).toBe(true);
        }
    });
});

describe('hasCmsFallback', () => {
    // RootPathGate calls this when the CMS is off, or when the slug 404s. A
    // false here means the visitor is dropped into the auth-gated app shell —
    // which for /pricing would mean every feature_locked upgrade link in the
    // product lands on a login screen.
    it('is true for /pricing regardless of slashes or case', () => {
        expect(hasCmsFallback('/pricing')).toBe(true);
        expect(hasCmsFallback('/pricing/')).toBe(true);
        expect(hasCmsFallback('/Pricing')).toBe(true);
        expect(hasCmsFallback('pricing')).toBe(true);
    });

    it('is false for everything else, so ordinary 404s still reach the app', () => {
        expect(hasCmsFallback('/about')).toBe(false);
        expect(hasCmsFallback('/')).toBe(false);
        expect(hasCmsFallback('')).toBe(false);
        expect(hasCmsFallback(null)).toBe(false);
        expect(hasCmsFallback('/pricing/extra')).toBe(false);
    });
});

describe('slugIssues', () => {
    it('flags reserved app slugs as blocking', () => {
        for (const s of ['app', 'privacy', 'admin', 'chat']) {
            expect(RESERVED_TOP_LEVEL.has(s)).toBe(true);
            const issue = slugIssues(s);
            expect(issue?.kind).toBe('reserved');
            expect(issue?.blocking).toBe(true);
        }
    });
    it('flags duplicates as blocking, excluding the page\'s own slug', () => {
        const opts = { existingSlugs: ['home', 'about', 'contact'], currentSlug: 'about' };
        expect(slugIssues('contact', opts)?.kind).toBe('duplicate');
        expect(slugIssues('contact', opts)?.blocking).toBe(true);
        expect(slugIssues('about', opts)).toBeNull();       // unchanged own slug
        expect(slugIssues('team', opts)).toBeNull();
    });
    it('flags underscore / bad-charset slugs as a non-blocking warning', () => {
        const issue = slugIssues('my_page');
        expect(issue?.kind).toBe('unroutable');
        expect(issue?.blocking).toBe(false);
        expect(slugIssues('-lead')?.kind).toBe('unroutable');
    });
    it('is silent for empty and clean slugs', () => {
        expect(slugIssues('')).toBeNull();
        expect(slugIssues('my-page')).toBeNull();
    });
});

describe('locale-prefixed paths', () => {
    // Dutch used to live at ?locale=nl, which gave every page three crawlable
    // URLs serving two content variants with no canonical and no hreflang.
    it('splits a locale prefix off the slug', () => {
        expect(parseCmsPath('/nl/pricing')).toEqual({ locale: 'nl', slug: 'pricing' });
        expect(parseCmsPath('/nl')).toEqual({ locale: 'nl', slug: '' });
        expect(parseCmsPath('/nl/')).toEqual({ locale: 'nl', slug: '' });
    });

    it('leaves an un-prefixed path on the default locale', () => {
        expect(parseCmsPath('/pricing')).toEqual({ locale: null, slug: 'pricing' });
        expect(parseCmsPath('/')).toEqual({ locale: null, slug: '' });
    });

    it('does not treat every two-letter segment as a language', () => {
        // A page could legitimately be slugged `it`; guessing would serve the
        // homepage in a language nobody asked for instead of that page.
        expect(parseCmsPath('/it')).toEqual({ locale: null, slug: 'it' });
        expect(parseCmsPath('/it/pricing')).toBeNull();
        expect(LOCALE_PREFIXES.has('en')).toBe(false);
    });

    it('still rejects reserved and multi-segment paths behind a prefix', () => {
        expect(parseCmsPath('/nl/app')).toBeNull();
        expect(parseCmsPath('/nl/a/b')).toBeNull();
        expect(isCmsPathCandidate('/nl/pricing')).toBe(true);
        expect(isCmsPathCandidate('/nl/app')).toBe(false);
    });
});
