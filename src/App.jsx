import React, { Suspense } from 'react';
import { lazyWithI18n } from './utils/lazyWithReload';
/* ── The marketing/app split ──────────────────────────────────────────────
   This module is the PUBLIC router shell: the marketing site, the embeds and
   the handful of anonymous pages. The entire authenticated product lives in
   ./AuthedApp.jsx behind the single lazy boundary below — App.jsx used to
   hold both halves, and even with the feature trees already lazy, the shell
   itself statically imported the licence contexts, the Studio route table
   (→ module-runtime registry) and the 1,200-line <App/>, which a marketing
   visitor parsed for nothing. Import NOTHING from AuthedApp.jsx statically;
   one careless import welds the whole product back into the entry chunk. */
const AuthedApp = lazyWithI18n(() => import('./AuthedApp'));
// Warm-up: a signed-in user landing on /app should not pay for the lazy
// boundary with a serial round trip — start fetching the app chunk AND the
// i18n catalogue while React is still mounting. Marketing paths skip both.
if (typeof window !== 'undefined' && window.location.pathname.startsWith('/app')) {
    import('./AuthedApp');
    ensureI18nDefaults();
}

import ProductWebsite from './marketing/ProductWebsite';
const EmbedChat = lazyWithI18n(() => import('./pages/EmbedChat'));
const DsrRequestPage = lazyWithI18n(() => import('./pages/DsrRequestPage'));
const PublicFormPage = lazyWithI18n(() => import('./pages/PublicFormPage'));
/* Lazy although they are marketing surfaces: both render only on the
   `cms === false` branch, which is always reached AFTER the /api/cms/site
   fetch resolves — never on first paint. On beeflow.nl (CMS live) they never
   load at all. */
const HomePage = lazyWithI18n(() => import('./marketing/HomePage'));
const PricingPage = lazyWithI18n(() => import('./marketing/PricingPage'));
// Public feature demos (/__demo__/<feature>). Lazy so the real Studio
// component trees and their fixtures never land in the marketing bundle —
// a visitor who never opens a demo downloads none of it.
const DemoHost = lazyWithI18n(() => import('./demo/DemoHost'));
import { isCmsPathCandidate, hasCmsFallback, parseCmsPath } from './utils/cmsPublicRouting';
import { API_BASE } from './utils/helpers';
import { ensureI18nDefaults } from './hooks/useTranslation';

/* Matches the shell background painted by index.html, so a chunk fetch never
   shows through as white. AuthedApp.jsx carries its own copy — importing
   across the boundary would defeat the split. */
function AppBackdrop() {
    return <div style={{ background: '#06090F', minHeight: '100vh' }} />;
}

// Root wrapper — handles embed route before App's hooks
function AppRoot() {
    /* One boundary around every branch below. Several of them (the embed,
       AuthedApp) resolve lazy chunks, and returning a bare lazy element from a
       component with no Suspense above it throws. */
    return (
        <Suspense fallback={<AppBackdrop />}>
            <AppRoutes />
        </Suspense>
    );
}

function AppRoutes() {
    const chatMatch = window.location.pathname.match(/^\/chat\/([a-zA-Z0-9-]+)/);
    if (chatMatch) {
        /* The embed is public and often sits in a customer's iframe, so it gets
           a real fallback rather than null — an earlier pass lazy-loaded this
           with `fallback={null}` and the iframe showed a blank frame while the
           chunk arrived. Transparent, because the embedder controls the frame's
           background and we should not paint over it. */
        return (
            <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
                <EmbedChat agentId={chatMatch[1]} />
            </Suspense>
        );
    }
    // Dedicated CMS preview route — rendered inside the admin Product Website
    // editor's iframe. Always shows the marketing site in preview mode, with
    // no auth/enabled/redirect coupling.
    if (window.location.pathname === '/__cms_preview__') {
        return <CmsPreviewHost />;
    }
    // Public feature demos, framed by the marketing site. Mounted here — before
    // any auth, licence or CMS handling — because the whole point is that an
    // anonymous visitor can use them. DemoHost installs an in-memory transport
    // that authFetch honours instead of the network, so nothing behind this
    // route can reach the API (see demo/demoTransport.js).
    {
        const demoMatch = window.location.pathname.match(/^\/__demo__\/([a-z0-9-]+)\/?$/);
        if (demoMatch) {
            return (
                <Suspense fallback={null}>
                    <DemoHost feature={demoMatch[1]} />
                </Suspense>
            );
        }
    }
    // Hosted form pages (`kind: 'form'` automation trigger). Anonymous by
    // design: the token in the URL IS the credential, and the whole point is
    // that someone WITHOUT an account can fill the form in. The page uses bare
    // fetch (never authFetch, which reloads on 401) and stamps its own
    // data-theme, since applyThemeToDocument never runs here.
    {
        const formMatch = window.location.pathname.match(/^\/f\/([a-f0-9]{24,64})\/?$/);
        if (formMatch) {
            return (
                <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
                    <PublicFormPage token={formMatch[1]} />
                </Suspense>
            );
        }
    }
    // Public data-subject request form (GDPR Art. 15–22). Mounted before any
    // auth handling — the whole point is that a data subject WITHOUT an
    // account can reach it. The backend endpoint is rate-limited per IP and
    // resolves the org from the subject's email. Organisations link this page
    // from their privacy notice (see Compliance → Settings).
    if (window.location.pathname === '/privacy/requests' || window.location.pathname === '/privacy/requests/') {
        return (
            <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
                <DsrRequestPage />
            </Suspense>
        );
    }
    // NOTE: /pricing is deliberately NOT intercepted here any more. It used to
    // return <PricingPage/> unconditionally, which meant a CMS page at that
    // slug could be authored and edited but never rendered — production had
    // exactly that, an invisible pricing page nobody could reach. It now falls
    // through to RootPathGate, which serves the CMS page when one exists and
    // drops back to <PricingPage/> when it does not (see CMS_FALLBACK_SLUGS).
    // Path-based marketing-site gate: intercept `/` and any single-segment
    // path (e.g. `/about`, `/contact`) so they render the public product
    // website. RootPathGate falls through to <App /> when the CMS is off
    // OR when the slug doesn't match a real page.
    if (isCmsPathCandidate(window.location.pathname)) {
        return <RootPathGate />;
    }
    // Mounted ONLY on this authenticated branch: the embed / CMS / pricing
    // early-returns above stay provider-free (a bare /chat/<id> embed
    // intentionally has no entitlements context → can()/hasFeature() ⇒ false).
    return <AuthedApp />;
}

// Isolated host for the CMS preview iframe. Renders ProductWebsite with empty
// content; the admin panel pushes the real content via cms-preview postMessage
// immediately after ProductWebsite posts its cms-preview-ready handshake.
// No fetch, no auth coupling, no redirect logic — the iframe always renders
// the marketing site shell, never the chat app.
function CmsPreviewHost() {
    return <ProductWebsite content={{}} />;
}

/**
 * The CMS payload the server already inlined into this document, or null.
 *
 * routes/publicRender.js renders the marketing page server-side and embeds the
 * exact payload `/api/cms/site` would have returned. Reading it here is what
 * lets the first React render have real content: without it RootPathGate
 * mounted with `cms === null`, painted a full-viewport #06090F rectangle over
 * the server's own HTML, and then went to the network for content it had
 * already been handed. Lighthouse measured the result as a black first
 * filmstrip frame, FCP 1.9s and CLS 0.437.
 *
 * Returns null on anything unexpected — a missing tag (the un-rendered shell
 * from nginx's @shell fallback), malformed JSON, or a payload for a different
 * locale than this visitor resolves to. Every one of those falls back to the
 * fetch path, which is exactly the old behaviour.
 */
function readInlinedCms(expectedLocale) {
    try {
        const el = document.getElementById('__BEEFLOW_CMS__');
        if (!el) return null;
        const data = JSON.parse(el.textContent || 'null');
        if (!data || data.enabled !== true || !data.content) return null;
        // The server rendered for the PATH's locale. A visitor whose stored or
        // browser language differs resolves to something else, and showing the
        // server's language first would swap the page under them a moment
        // later. Let those fall through to the fetch instead.
        if (expectedLocale && data.locale && data.locale !== expectedLocale) return null;
        return data;
    } catch {
        return null;
    }
}

/** The locale this visitor resolves to. Mirrors the effect below exactly. */
function resolveInitialLocale() {
    try {
        const params = new URLSearchParams(window.location.search);
        let stored = null;
        try { stored = localStorage.getItem('beeflow_locale'); } catch { /* ignore */ }
        const parsed = parseCmsPath(window.location.pathname) || { locale: null };
        return (parsed.locale
            || params.get('locale')
            || stored
            || (navigator.language || 'en').split('-')[0]).toLowerCase();
    } catch {
        return 'en';
    }
}

function RootPathGate() {
    const isPreview = new URLSearchParams(window.location.search).has('preview');
    // null = still fetching, false = disabled (redirect happening),
    // object = { content } when CMS is enabled (or in preview mode).
    //
    // Seeded from the server-rendered payload when there is one, so the very
    // first render paints the page instead of a holding screen. Lazy initialiser:
    // this must run once, before paint, not on every render.
    const [cms, setCms] = React.useState(() => {
        if (isPreview) return null;
        const inlined = readInlinedCms(resolveInitialLocale());
        if (!inlined) return null;
        return { content: inlined.content || {}, analytics: null, fromServer: true };
    });

    // Captured once, not read from `cms`: the effect runs with an empty dep list
    // and must know whether the FIRST render came from the server, which is a
    // fact about this page load rather than current state.
    const hadServerContent = React.useRef(!!(cms && cms.fromServer)).current;

    React.useEffect(() => {
        let cancelled = false;
        const params = new URLSearchParams(window.location.search);
        // Locale precedence: explicit ?locale= → the visitor's stored choice
        // (shared with the app i18n picker) → browser language → English. The
        // stored key lets the marketing language switcher persist across
        // page-to-page navigation, where nav links carry no ?locale.
        let storedLocale = null;
        try { storedLocale = localStorage.getItem('beeflow_locale'); } catch { /* ignore */ }
        // Path-based routing: `/about` → slug "about", `/nl/about` → locale
        // "nl" + slug "about", `/` → the homepage. The legacy `?slug=` query
        // param still wins if present so old links keep working.
        const parsed = parseCmsPath(window.location.pathname) || { locale: null, slug: '' };
        // The PATH now decides the language, ahead of ?locale= and the stored
        // choice. It has to: /nl/pricing must be Dutch for a first-time visitor
        // arriving from a search result, who has no stored preference and whose
        // browser may be set to anything at all.
        const locale = (parsed.locale
            || params.get('locale')
            || storedLocale
            || (navigator.language || 'en').split('-')[0]).toLowerCase();
        const slug = (params.get('slug') || parsed.slug || '').toString();

        // Preview mode: always render the marketing site so the admin's iframe
        // shows something even when the public site is still disabled. The
        // editor pushes the real content via cms-preview postMessage right
        // after the cms-preview-ready handshake, so an empty content object is
        // the correct initial state. (This branch used to fetch
        // GET /api/cms/admin — an endpoint that no longer exists; the fetch
        // always failed into {} anyway. The editor's own iframe uses
        // /__cms_preview__, not this legacy path.)
        if (isPreview) {
            setCms({ content: {} });
            return;
        }

        const qs = `locale=${encodeURIComponent(locale)}` +
                   (slug ? `&slug=${encodeURIComponent(slug)}` : '');
        /* When the server already inlined the page, this request exists only
           to pick up the analytics envelope — nothing about it is
           paint-relevant, and firing it on mount made it compete with the
           LCP image and the font files for bandwidth during the exact window
           Lighthouse scores. Defer it past `load` (idle callback with a
           timeout floor, so analytics still starts within a few seconds on
           browsers without requestIdleCallback). The no-server-content path
           keeps the immediate fetch: there the response decides what the
           page IS, and the visitor is looking at a holding screen until it
           lands. */
        const fire = () => {
            if (cancelled) return;
            fetch(`${API_BASE}/api/cms/site?${qs}`)
                .then(r => r.ok ? r.json() : { enabled: false })
                .catch(() => ({ enabled: false }))
                .then(handleSiteResponse);
        };
        let idleHandle = null;
        let idleIsTimeout = false;
        if (hadServerContent && typeof window.requestIdleCallback === 'function') {
            idleHandle = window.requestIdleCallback(fire, { timeout: 4000 });
        } else if (hadServerContent) {
            idleHandle = setTimeout(fire, 1500);
            idleIsTimeout = true;
        } else {
            fire();
        }

        function handleSiteResponse(data) {
                if (cancelled) return;
                /* The server already rendered this page and inlined its content,
                   so this request exists only to pick up the analytics envelope
                   (Umami ids, consent mode, GA) that the inlined payload leaves
                   out. It must never be able to take the page away: without this
                   guard a transient API hiccup would answer `{enabled:false}` and
                   bounce a perfectly good, already-visible marketing page to the
                   app shell — a failure the visitor would see as the page
                   vanishing mid-read. */
                if (hadServerContent) {
                    if (data?.enabled && data.analytics) {
                        setCms(prev => (prev ? { ...prev, analytics: data.analytics } : prev));
                    }
                    return;
                }
                // Self-hosted: no public marketing site. The server flags this
                // via `appOnly` (RootPathGate runs outside LicenseProvider so it
                // can't read deployment mode itself). Rewrite "/" — and any
                // single-segment slug — to /app so visitors land on the app
                // shell, never the static HomePage.
                if (data?.appOnly) {
                    if (window.location.pathname !== '/app') {
                        window.history.replaceState(null, '', '/app');
                    }
                    setCms(false);
                    return;
                }
                if (!data?.enabled) {
                    // No live CMS site. For "/" we render the static public
                    // HomePage (handled in the render branch below) so that
                    // beeflow.nl/ stays a no-login URL — required for Google's
                    // OAuth consent-screen verification. For non-root single-
                    // segment paths (e.g. /random) we still hand off to the
                    // app shell, redirecting to /app so the login form lives
                    // at a stable URL and the back button doesn't loop.
                    if (window.location.pathname !== '/') {
                        window.history.replaceState(null, '', '/app');
                    }
                    setCms(false);
                    return;
                }
                // Path-based 404: the user asked for `/widgets`, the CMS
                // is live, but no page with that slug exists. Hand the URL
                // back to the BeeFlow app router rather than rendering an
                // empty marketing shell. Homepage requests (no slug) skip
                // this check — the homepage is implicit.
                if (slug && data.found === false) {
                    setCms(false);
                    return;
                }
                // Canonical URL: the homepage lives at "/" only. If the
                // user typed `/home` (or any slug that resolves to the
                // homepage), rewrite the URL bar to "/" without reloading.
                // canonicalSlug is "" for the homepage, otherwise the
                // page's own slug.
                if (typeof data.canonicalSlug === 'string') {
                    // Keep the locale prefix. Without it the rewrite below
                    // would turn /nl/pricing into /pricing on every load, and
                    // the page would silently switch to English.
                    const prefix = parsed.locale ? `/${parsed.locale}` : '';
                    const canonical = `${prefix}/${data.canonicalSlug}`.replace(/\/$/, '') || '/';
                    if (window.location.pathname !== canonical) {
                        window.history.replaceState(
                            null,
                            '',
                            canonical + window.location.search + window.location.hash,
                        );
                    }
                }
                setCms({ content: data.content || {}, analytics: data.analytics || null });
        }
        return () => {
            cancelled = true;
            if (idleHandle != null) {
                if (idleIsTimeout) clearTimeout(idleHandle);
                else if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleHandle);
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (cms === null) {
        /* Only reached when there was no server-rendered payload to seed from:
           the un-rendered shell, preview mode, or a locale mismatch. It stays a
           holding screen (flashing the login form would be worse) but no longer
           paints near-black over a light site — that hard #06090F rectangle was
           the black first frame in the Lighthouse filmstrip. `transparent` keeps
           whatever the document background already is, so on a server-rendered
           page the visitor sees the page, not a colour. */
        return <div style={{ background: 'transparent', minHeight: '100vh' }} />;
    }
    if (cms === false) {
        // CMS-managed site is off, OR this slug has no page. At "/" show the
        // static public HomePage so there's a no-login landing for users (and
        // Google's OAuth verifier).
        if (window.location.pathname === '/') return <HomePage />;
        // Same idea for the slugs that MUST resolve to something: /pricing is
        // the upgrade destination hardcoded into every feature_locked 403, so
        // an install with no CMS pricing page still gets the built-in one
        // rather than being bounced into the app shell.
        if (hasCmsFallback(window.location.pathname)) return <PricingPage />;
        // Anywhere else, fall through to the auth-gated app shell.
        // Provider-wrapped — SSO/OAuth lands here (origin "/" rewritten to /app
        // without a reload), so a bare <App/> would run without the licence /
        // entitlements context. See AuthedApp.
        return <AuthedApp />;
    }
    return <ProductWebsite content={cms.content} analytics={cms.analytics} />;
}


export default AppRoot;
