// Public-routing rules for CMS page slugs — the single client source of
// truth for which top-level paths the app shell claims and which slugs can
// actually be reached on the public site.
//
// Extracted from App.jsx so the CMS editor can warn about unreachable slugs
// without importing the app root. App.jsx imports these back — behavior
// unchanged. NOTE: the server's RESERVED_SLUGS
// (server/i18n/defaults/cmsDefaults.js) is a SUBSET of this list and stays
// that way on purpose: the server keeps accepting legacy slugs so imports
// and renames of existing data never break; the client warns instead.

// Top-level paths claimed by the BeeFlow app shell. Any single-segment
// pathname starting with one of these (e.g. `/app`, `/api`, `/admin`) is
// handed straight to the app router instead of being treated as a CMS page
// slug. Mirrors RESERVED_SLUGS in server/i18n/defaults/cmsDefaults.js plus
// the legacy short-id prefixes used by App.jsx's parsers.
// NOTE on `pricing`: it used to be reserved, which meant a CMS page at that
// slug could be created and edited but never rendered — App.jsx served the
// hardcoded marketing/PricingPage.jsx instead. Pricing copy changes far more
// often than a deploy cycle, so the CMS page now wins and PricingPage is the
// FALLBACK for installs with no CMS site (see RootPathGate). `privacy`,
// `terms` and `legal` stay reserved: those are served from in-repo markdown
// and must keep stable URLs for Google's OAuth consent screen.
export const RESERVED_TOP_LEVEL = new Set([
    'app', 'api', 'admin', 'auth', 'login', 'logout', 'register', 'signup',
    'dashboard', 'settings', 'embed', 'oauth', 'callback',
    'chat', 'd', 'a', 'agent',
    // `f` is the hosted form-trigger namespace (/f/<token>). Without it the CMS
    // catch-all would claim the path and every published form URL would render
    // a 404 page instead of the form.
    'f',
    'org-settings', 'email-kb', 'ticket-assistant',
    'privacy', 'terms', 'legal',
    '__cms_preview__',
]);

/**
 * Slugs that fall back to a built-in page when the CMS has nothing for them.
 *
 * `/pricing` is load-bearing: every `feature_locked` 403 in the product sends
 * the user to `https://beeflow.nl/pricing` (server/core/entitlements.js), and
 * LicenseContext / UpgradePrompt / GuardrailsPanel hardcode the same URL. So
 * the path must resolve to something real even on an install whose CMS is off
 * or whose site has no pricing page.
 */
export const CMS_FALLBACK_SLUGS = new Set(['pricing']);

/**
 * Should `pathname` fall back to a built-in page when the CMS has nothing?
 *
 * A predicate rather than an inline expression in App.jsx so the decision is
 * testable on its own — the alternative is rendering RootPathGate with a
 * mocked fetch to assert one boolean.
 */
export function hasCmsFallback(pathname) {
    if (!pathname) return false;
    const seg = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    return CMS_FALLBACK_SLUGS.has(seg);
}

// The public router only matches this shape (note: NO underscore — the
// server's slug charset allows `_`, but such slugs are publicly unroutable).
export const PUBLIC_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Non-default locales that get a URL prefix: `/nl/pricing`, `/nl`.
 *
 * The default locale is deliberately NOT in here — it is served un-prefixed,
 * so `/pricing` and `/en/pricing` can never both resolve.
 *
 * This is an explicit allowlist rather than "any two-letter segment" because a
 * page could legitimately be slugged `it` or `no`, and guessing would serve
 * the homepage in a language nobody asked for instead of that page. Adding a
 * published language therefore means adding it here; `publicPath.test.js` on
 * the server pins the two copies against each other.
 */
export const LOCALE_PREFIXES = new Set(['nl']);

/**
 * Split a pathname into `{ locale, slug }`, or null when it is not a CMS path.
 * `locale` is null when the URL carries no prefix (i.e. the default locale).
 *
 * Dutch used to live at `?locale=nl`, which gave every page three crawlable
 * URLs — `/pricing`, `/pricing?locale=en`, `/pricing?locale=nl` — serving two
 * content variants with no canonical and no hreflang, so search engines read
 * them as duplicates rather than as a translation.
 */
export function parseCmsPath(pathname) {
    if (!pathname || pathname === '/' || pathname === '') return { locale: null, slug: '' };
    const trimmed = pathname.replace(/\/+$/, '') || '/';
    if (trimmed === '/') return { locale: null, slug: '' };

    const segments = trimmed.slice(1).split('/');
    if (segments.length > 2) return null;

    let locale = null;
    let seg = segments[0].toLowerCase();

    if (LOCALE_PREFIXES.has(seg)) {
        locale = seg;
        if (segments.length === 1) return { locale, slug: '' };   // e.g. /nl
        seg = segments[1].toLowerCase();
    } else if (segments.length === 2) {
        return null;
    }

    if (RESERVED_TOP_LEVEL.has(seg)) return null;
    if (!PUBLIC_SLUG_RE.test(seg)) return null;
    return { locale, slug: seg };
}

// Returns true when `pathname` could be a CMS page (homepage, a single
// non-reserved slug segment, or either of those behind a locale prefix).
// Anything else falls through to the app shell.
export function isCmsPathCandidate(pathname) {
    return parseCmsPath(pathname) !== null;
}

/**
 * Is `pathname` part of the anonymous public marketing surface — a CMS page,
 * or one of the static pages the marketing shell frames (the legal docs
 * including the public DSR form, and the /__demo__ feature demos)?
 *
 * This is the consent boundary for trackers and telemetry: on these paths the
 * visitor is a member of the public and the CookieBanner decision governs
 * whether anything may beacon. Product surfaces (/app, /login, the /chat
 * embed, hosted /f forms) are NOT marketing pages — telemetry there is
 * signed-in product telemetry with its own gates.
 */
export function isPublicMarketingPath(pathname) {
    if (typeof pathname !== 'string') return false;
    if (isCmsPathCandidate(pathname)) return true;
    return /^\/(privacy|terms|legal|__demo__)(\/|$)/.test(pathname);
}

/**
 * Editor-side slug lint. Returns null when the slug is fine, else
 * `{ kind: 'reserved' | 'duplicate' | 'unroutable', blocking, message }`.
 *
 * - `reserved`  — collides with an app route / static page. BLOCKING: the
 *                 server rejects these on create + rename.
 * - `duplicate` — another page of the site already uses the slug. BLOCKING:
 *                 the server would silently auto-suffix (-2) on commit;
 *                 telling the user beats surprising them.
 * - `unroutable`— contains `_` or a leading symbol. Warn-only: the server
 *                 accepts these (legacy data), but the public router will
 *                 never serve the page.
 *
 * `existingSlugs` is the site's page slug list; `currentSlug` excludes the
 * page's own (unchanged) slug from the duplicate check.
 */
export function slugIssues(slug, { existingSlugs = null, currentSlug = null } = {}) {
    const s = (slug || '').trim().toLowerCase();
    if (!s) return null;
    if (RESERVED_TOP_LEVEL.has(s)) {
        return {
            kind: 'reserved',
            blocking: true,
            message: `"/${s}" is reserved by the app — pick a different slug.`,
        };
    }
    if (Array.isArray(existingSlugs) && s !== (currentSlug || '').toLowerCase()
        && existingSlugs.some(e => (e || '').toLowerCase() === s)) {
        return {
            kind: 'duplicate',
            blocking: true,
            message: `Another page already uses "/${s}" — slugs must be unique.`,
        };
    }
    if (!PUBLIC_SLUG_RE.test(s)) {
        return {
            kind: 'unroutable',
            blocking: false,
            message: 'Public URLs only match lowercase letters, digits and "-" (no "_" and no leading symbol) — this page won\'t be publicly reachable.',
        };
    }
    return null;
}
