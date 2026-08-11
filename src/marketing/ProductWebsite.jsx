import React, { useEffect, useRef, useState } from 'react';
import './marketing.css';
// Self-hosted Fontshare families — registers @font-face for Satoshi,
// Cabinet Grotesk, General Sans, Clash Display, Clash Grotesk. No CDN
// dependency; files live under agent-hub/public/fonts/.
import './self-hosted-fonts.css';
// Editor-only block chrome (outlines, name tag, toolbar, insert zones).
// Every rule is scoped under `.marketing-root.cms-preview`, so importing
// it here is inert on the published site.
import './preview-chrome.css';

import Header       from './sections/Header';
import Hero         from './sections/Hero';
import SocialProof  from './sections/SocialProof';
import Content      from './sections/Content';
import MediaText    from './sections/MediaText';
import Features     from './sections/Features';
import Steps        from './sections/Steps';
import Security     from './sections/Security';
import Integrations from './sections/Integrations';
import Architecture from './sections/Architecture';
import TechStats    from './sections/TechStats';
import CTA          from './sections/CTA';
import CtaBanner    from './sections/CtaBanner';
import LiveComponent from './sections/LiveComponent';
import Pricing      from './sections/PricingSection';
import CustomerSupport from './sections/CustomerSupport';
import Testimonials from './sections/Testimonials';
import Faq          from './sections/Faq';
import TrustBand    from './sections/TrustBand';
import Showcase     from './sections/Showcase';
import FeatureDemo  from './sections/FeatureDemo';
import Roadmap      from './sections/Roadmap';
import CompareTable from './sections/CompareTable';
import GitHubStats  from './sections/GitHubStats';
import ReleaseNotes from './sections/ReleaseNotes';
import Footer       from './sections/Footer';
// "Skip to content" — first focusable element, targets the <main id="main">
// landmark below. Chrome like the cookie banner, so it lives in components/.
import SkipLink     from './components/SkipLink';
// Site-wide cookie consent banner. Lives outside ./sections because it's
// chrome (fixed-position overlay), not an in-flow page section.
import CookieBanner from './components/CookieBanner';
// Site-wide announcement strip. Also chrome, and also fixed — it sits ABOVE
// the header and publishes --announce-height so the header/hero/drawer
// offsets move down by exactly its measured height.
import AnnouncementBar from './components/AnnouncementBar';
// Injects the (cookieless-by-default) Umami usage tracker on the live public
// site. Renders nothing; only active when the server passes an `analytics`
// config and we're not in the admin preview iframe.
import AnalyticsTracker from './components/AnalyticsTracker';
import GoogleAnalyticsTracker from './components/GoogleAnalyticsTracker';
import SessionRecorder from './components/SessionRecorder';
import { startAnalyticsEvents } from './components/analyticsEvents';

import { useScrollReveal } from './components/ScrollReveal';
import useCmsHead from './useCmsHead';
import { BlockIdContext } from './components/EditableText';
import { PreviewBlockChrome, InsertZone } from './components/PreviewBlockChrome';
import { resolveAssetUrl } from './assetUrl';
import { LOCALE_PREFIXES } from '../utils/cmsPublicRouting';

// Resolve which language the cookie banner / announcement bar should show.
// Their `text` blobs carry every locale, so we pick one at render time.
//
// The PATH decides, full stop. Public URLs are locale-prefixed (`/nl/pricing`)
// and the server 301s the old `?locale=` form onto the path, so the legacy
// param is honoured only for the instant before that redirect. The browser
// language is deliberately NOT a fallback any more: it made a Dutch-browser
// visitor reading the ENGLISH page at /pricing meet a Dutch cookie banner —
// and a Dutch aria-label on the floating cookie button — as their first
// interaction with an otherwise English site. The banner speaks the language
// of the page it sits on. Anything other than Dutch falls back to English.
function resolveCookieLang() {
    if (typeof window === 'undefined') return 'en';
    try {
        // Not "any two-letter segment": /it is a valid CMS slug, not Italian.
        // LOCALE_PREFIXES is the same allowlist the router itself uses.
        const seg = (window.location.pathname.split('/')[1] || '').toLowerCase();
        const fromPath = LOCALE_PREFIXES.has(seg) ? seg : null;
        const param = new URLSearchParams(window.location.search).get('locale');
        const loc = (fromPath || param || 'en').toLowerCase().split('-')[0];
        return loc === 'nl' ? 'nl' : 'en';
    } catch {
        return 'en';
    }
}

// Exported for the admin AddBlockDialog's live section thumbnails
// (SectionThumb renders the real section components at scale 0.2).
export const SECTION_REGISTRY = {
    hero: Hero,
    socialProof: SocialProof,
    content: Content,
    'media-text': MediaText,
    features: Features,
    steps: Steps,
    security: Security,
    integrations: Integrations,
    architecture: Architecture,
    techStats: TechStats,
    cta: CTA,
    'cta-banner': CtaBanner,
    'live-component': LiveComponent,
    pricing: Pricing,
    'customer-support': CustomerSupport,
    testimonials: Testimonials,
    faq: Faq,
    'trust-band': TrustBand,
    showcase: Showcase,
    'feature-demo': FeatureDemo,
    roadmap: Roadmap,
    'compare-table': CompareTable,
    'github-stats': GitHubStats,
    'release-notes': ReleaseNotes,
};

const isPreviewMode = () =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('preview');

// ── Design system bridge ────────────────────────────────────────────
//
// `design` is the user-customizable design system from site.design. It
// arrives via either:
//   • cms-preview postMessage (admin iframe) — every keystroke in the
//     Design tab pushes a fresh design payload here
//   • content.design embedded in the legacy /api/cms/site response
//     (public marketing site at "/", so the published site honors the
//     user's branding without an App.jsx change)
//
// We mirror each design field to a CSS custom property on .marketing-root
// via inline style. The CSS file already declares fallbacks for every
// token, so a missing/null design just means "use the file's defaults".
function applyDesignToRoot(rootEl, design, effectiveTheme) {
    if (!rootEl) return;
    const style = rootEl.style;
    if (!design || typeof design !== 'object') {
        // No design — clear any inline overrides we previously set.
        for (const prop of CSS_VAR_PROPS) style.removeProperty(prop);
        rootEl.classList.remove('cms-theme-dark', 'cms-gradient', 'cms-grain',
            'cms-motion--none', 'cms-motion--subtle');
        return;
    }
    const c = design.colors || {};
    // effectiveTheme (resolved from the visitor's theme switcher choice
    // when the site exposes it) wins over design.theme. Falls back to
    // the design's setting when no visitor override is active.
    const resolved = effectiveTheme || (design.theme === 'dark' ? 'dark' : 'light');
    const isDark = resolved === 'dark';

    // Brand colors always come from the user — they ride through both
    // modes; darkColors.primary/accent are optional per-mode adjustments.
    const dk = isDark && design.darkColors && typeof design.darkColors === 'object'
        ? design.darkColors : null;
    const primary = (dk && dk.primary) || c.primary;
    const accent  = (dk && dk.accent)  || c.accent;
    if (primary)     style.setProperty('--brand-primary',   primary);
    if (c.secondary) style.setProperty('--brand-secondary', c.secondary);
    if (accent)      style.setProperty('--brand-accent',    accent);

    // Layout palette (bg/surface/text). Dark mode is now fully token-
    // driven from design.darkColors — set inline the same way light is.
    // A stale payload without darkColors keeps the legacy remove-path so
    // the .cms-theme-dark fallback class in marketing.css still wins.
    if (dk) {
        if (dk.background)    style.setProperty('--brand-bg',             dk.background);
        if (dk.surface)       style.setProperty('--brand-surface',        dk.surface);
        if (dk.textPrimary)   style.setProperty('--brand-text',           dk.textPrimary);
        if (dk.textSecondary) style.setProperty('--brand-text-secondary', dk.textSecondary);
    } else if (isDark) {
        style.removeProperty('--brand-bg');
        style.removeProperty('--brand-surface');
        style.removeProperty('--brand-text');
        style.removeProperty('--brand-text-secondary');
    } else {
        if (c.background)    style.setProperty('--brand-bg',             c.background);
        if (c.surface)       style.setProperty('--brand-surface',        c.surface);
        if (c.textPrimary)   style.setProperty('--brand-text',           c.textPrimary);
        if (c.textSecondary) style.setProperty('--brand-text-secondary', c.textSecondary);
    }

    // Dark-band tokens — set in BOTH themes from design.darkColors so the
    // per-block 'dark' band (style.band) is always palette-consistent
    // with the site's dark mode, even on a light page.
    const bandDk = design.darkColors || {};
    if (bandDk.background)    style.setProperty('--band-dark-bg',             bandDk.background);
    if (bandDk.surface)       style.setProperty('--band-dark-surface',        bandDk.surface);
    if (bandDk.textPrimary)   style.setProperty('--band-dark-text',           bandDk.textPrimary);
    if (bandDk.textSecondary) style.setProperty('--band-dark-text-secondary', bandDk.textSecondary);

    const fonts = design.fonts || {};
    if (fonts.heading) style.setProperty('--font-heading', cssFontStack(fonts.heading));
    if (fonts.body)    style.setProperty('--font-body',    cssFontStack(fonts.body));
    if (fonts.mono)    style.setProperty('--font-mono',    cssMonoStack(fonts.mono));

    if (typeof design.radius === 'number' && design.radius >= 0 && design.radius <= 48) {
        style.setProperty('--radius-base', `${design.radius}px`);
    }

    // Typography v2 — display cap (64/80/96px), heading weight, body size.
    const ty = design.typography || {};
    const displayMax = { md: '4rem', lg: '5rem', xl: '6rem' }[ty.displaySize];
    if (displayMax) style.setProperty('--display-max', displayMax);
    if ([500, 600, 700].includes(ty.headingWeight)) {
        style.setProperty('--heading-weight', String(ty.headingWeight));
    }
    if ([16, 17, 18].includes(ty.bodySize)) {
        style.setProperty('--text-body', `${ty.bodySize}px`);
    }

    // ── Component shape + size ──────────────────────────────────────
    // Each map below is value → inline properties. The DEFAULT value maps
    // to {} so it emits nothing, and every CSS consumer is written
    // var(--token, <today's literal>) — that is what makes an absent
    // field, an unknown field and an explicit default all render
    // identically. Applied AFTER the scalar tokens above so the
    // "sharp implies flat" coupling can override the shadow level.
    const comp = design.components || {};
    const lay  = design.layout || {};
    applyEnum(style, SHAPE_MAPS.buttonShape,     comp.buttonShape);
    applyEnum(style, SHAPE_MAPS.buttonSize,      comp.buttonSize);
    applyEnum(style, SHAPE_MAPS.navHeight,       comp.navHeight);
    applyEnum(style, SHAPE_MAPS.logoSize,        comp.logoSize);
    applyEnum(style, SHAPE_MAPS.cardPadding,     comp.cardPadding);
    applyEnum(style, SHAPE_MAPS.shadow,          comp.shadow);
    applyEnum(style, SHAPE_MAPS.containerWidth,  lay.containerWidth);
    applyEnum(style, SHAPE_MAPS.sectionRhythm,   lay.sectionRhythm);

    // Button label color. 'auto' derives from the RESOLVED primary's
    // luminance, which a single site-wide value can't express when a theme
    // inverts its button between light and dark mode.
    if (comp.buttonTextColor === 'dark') {
        style.setProperty('--btn-primary-fg', '#0B0B0C');
    } else if (comp.buttonTextColor === 'auto') {
        style.setProperty('--btn-primary-fg', relativeLuminance(primary) > 0.45 ? '#0B0B0C' : '#fff');
    }

    // 'sharp' means "flat" as a whole idiom, not just square corners —
    // applied last so it wins over the shadow level.
    if (comp.buttonShape === 'sharp') {
        style.setProperty('--btn-shadow', 'none');
        style.setProperty('--btn-shadow-hover', 'none');
        style.setProperty('--btn-lift', '0px');
        style.setProperty('--btn-blur', 'none');
        style.setProperty('--pill-radius', '0px');
        style.setProperty('--logo-radius', '0px');
    }

    rootEl.classList.toggle('cms-theme-dark', isDark);
    rootEl.classList.toggle('cms-gradient',   design.gradient === true);
    rootEl.classList.toggle('cms-grain',      design.grain === true);
    rootEl.classList.toggle('cms-motion--none',   design.motion === 'none');
    rootEl.classList.toggle('cms-motion--subtle', design.motion === 'subtle');
    // Structural variants are classes (they change WHICH declarations
    // exist); the identity values 'bar' and 'hairline' get no class.
    rootEl.classList.toggle('cms-nav--floating',  comp.navStyle === 'floating');
    rootEl.classList.toggle('cms-nav--bordered',  comp.navStyle === 'bordered');
    rootEl.classList.toggle('cms-cards--soft',     comp.cardStyle === 'soft');
    rootEl.classList.toggle('cms-cards--flat',     comp.cardStyle === 'flat');
    rootEl.classList.toggle('cms-cards--elevated', comp.cardStyle === 'elevated');
}

// value → { cssProp: value } maps. A value that is absent from a map (which
// includes every identity value) emits nothing at all.
const SHAPE_MAPS = {
    buttonShape: {
        pill:    { '--btn-radius': '999px' },
        rounded: { '--btn-radius': 'calc(var(--radius-base) * 0.5)' },
        sharp:   { '--btn-radius': '0px' },
    },
    buttonSize: {
        sm: { '--btn-pad-y': '10px', '--btn-pad-x': '22px', '--btn-font-size': '0.875rem' },
        lg: { '--btn-pad-y': '17px', '--btn-pad-x': '40px', '--btn-font-size': '1.0625rem' },
    },
    navHeight: {
        compact: { '--header-height': '60px' },
        tall:    { '--header-height': '88px' },
    },
    logoSize: {
        sm: { '--logo-size': '30px' },
        lg: { '--logo-size': '46px' },
    },
    cardPadding: {
        compact: { '--card-pad-scale': '0.75' },
        roomy:   { '--card-pad-scale': '1.3' },
    },
    shadow: {
        none:   { '--card-shadow': 'none', '--card-shadow-hover': 'none',
                  '--btn-shadow': 'none', '--btn-shadow-hover': 'none' },
        medium: { '--shadow-card': '0 8px 30px var(--shadow-color)' },
        strong: { '--shadow-card': '0 16px 48px var(--shadow-color-strong)' },
    },
    containerWidth: {
        // 'full' is 1760px, NOT 100%: --bleed-w uses calc(var(--max-width)
        // - 48px), and a percentage there would resolve against the grid
        // column instead of the container and narrow full-bleed images.
        narrow: { '--max-width': '1120px' },
        wide:   { '--max-width': '1440px' },
        full:   { '--max-width': '1760px' },
    },
    sectionRhythm: {
        tight: { '--section-y': 'clamp(56px, 4.5vw + 28px, 88px)',
                 '--section-y-hero': 'clamp(72px, 6vw + 36px, 120px)' },
        airy:  { '--section-y': 'clamp(96px, 8vw + 48px, 152px)',
                 '--section-y-hero': 'clamp(112px, 10vw + 56px, 192px)' },
    },
};

function applyEnum(style, map, value) {
    const props = map && map[value];
    if (!props) return;
    for (const [prop, v] of Object.entries(props)) style.setProperty(prop, v);
}

// sRGB relative luminance (WCAG). Local to the marketing bundle on purpose —
// the admin panel's colorUtils lives across the app boundary.
function relativeLuminance(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return 0;
    let h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const chan = (i) => {
        const c = parseInt(h.slice(i * 2, i * 2 + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * chan(0) + 0.7152 * chan(1) + 0.0722 * chan(2);
}

const CSS_VAR_PROPS = [
    '--brand-primary', '--brand-secondary', '--brand-accent',
    '--brand-bg', '--brand-surface',
    '--brand-text', '--brand-text-secondary',
    '--band-dark-bg', '--band-dark-surface',
    '--band-dark-text', '--band-dark-text-secondary',
    '--font-heading', '--font-body', '--font-mono',
    '--radius-base',
    '--display-max', '--heading-weight', '--text-body',
    // Shape + size. Every property any SHAPE_MAPS entry can set must be
    // listed, or it survives after the design is cleared.
    '--btn-radius', '--btn-pad-y', '--btn-pad-x', '--btn-font-size',
    '--btn-shadow', '--btn-shadow-hover', '--btn-lift', '--btn-blur',
    '--btn-primary-fg', '--pill-radius',
    '--header-height', '--logo-size', '--logo-radius',
    '--card-pad-scale', '--card-shadow', '--card-shadow-hover',
    '--shadow-card', '--max-width', '--section-y', '--section-y-hero',
];

// The self-hosted families carry a metric-matched local fallback face
// (self-hosted-fonts.css); slotting it right after the web font means text
// that paints before the WOFF2 arrives already occupies the web font's
// geometry, so the swap moves nothing. See fallbackFaceFor in googleFonts.js.
function cssMonoStack(name) {
    const safe = String(name || '').replace(/"/g, '');
    const quoted = /\s/.test(safe) ? `"${safe}"` : safe;
    const fb = fallbackFaceFor(safe);
    const metric = fb ? `, "${fb}"` : '';
    return `${quoted}${metric}, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
}

function cssFontStack(name) {
    // Quote names that contain spaces; always include system fallbacks
    // so the page renders before the font file has finished loading.
    const safe = String(name || '').replace(/"/g, '');
    const quoted = /\s/.test(safe) ? `"${safe}"` : safe;
    const fb = fallbackFaceFor(safe);
    const metric = fb ? `, "${fb}"` : '';
    return `${quoted}${metric}, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}

// ── Font loader ─────────────────────────────────────────────────────
//
// Maintain one <link rel="stylesheet"> per font source (Google +
// Fontshare today) in the iframe head. Hrefs are rebuilt whenever the
// picked-font set changes; the existing <link> elements are updated in
// place rather than recreated so the browser keeps the same network
// entries and avoids a flash of unstyled text.
import { buildFontsHrefs, fallbackFaceFor } from '../components/admin/ProductWebsite/googleFonts';

// Legacy ID, kept around so an old <link> from a previous build of the
// iframe gets cleaned up cleanly when the new multi-source loader
// initialises. New links use the per-source IDs returned by
// buildFontsHrefs (e.g. cms-fonts-google, cms-fonts-fontshare).
const LEGACY_FONTS_LINK_ID = 'cms-google-fonts';

// Repeat-visit font-flash mitigation: the per-site font <link> normally
// waits for the /api/cms/site payload, so custom-font sites paint once in
// the fallback face and reflow. We cache the last computed hrefs and
// inject them at module import time — the request starts ~a round-trip
// earlier and display=swap keeps text visible throughout. ensureFontsLink
// later reconciles the hrefs if the design changed.
const FONT_HREFS_CACHE_KEY = 'cms.fontHrefs';
(function bootstrapCachedFonts() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    try {
        const cached = JSON.parse(window.localStorage.getItem(FONT_HREFS_CACHE_KEY) || 'null');
        if (!Array.isArray(cached)) return;
        for (const entry of cached) {
            if (!entry || typeof entry.id !== 'string' || typeof entry.href !== 'string') continue;
            if (!/^https:\/\/(fonts\.googleapis\.com|api\.fontshare\.com)\//.test(entry.href)) continue;
            if (document.getElementById(entry.id)) continue;
            const link = document.createElement('link');
            link.id = entry.id;
            link.rel = 'stylesheet';
            link.href = entry.href;
            document.head.appendChild(link);
        }
    } catch { /* corrupt cache — ignore, ensureFontsLink rebuilds it */ }
})();

function ensureFontsLink(doc, headingFont, bodyFont, extras = [], headingWeight = 600) {
    if (!doc) return;

    // Drop the legacy single-source <link> from older builds. Idempotent
    // — first call wins, subsequent calls are no-ops.
    const legacy = doc.getElementById(LEGACY_FONTS_LINK_ID);
    if (legacy) legacy.remove();

    const families = new Set();
    const add = (raw) => {
        if (typeof raw !== 'string') return;
        const f = raw.trim();
        if (f) families.add(f);
    };
    add(headingFont);
    add(bodyFont);
    for (const f of extras) add(f);

    // Source-aware URL bundle — one entry per CDN. Weights are derived
    // from the design (heading weight + regular/medium/bold) instead of
    // the old fixed 400–800 spread; premium typography never uses 800,
    // so dropping it trims every font payload.
    const weights = Array.from(new Set([400, 500, headingWeight, 700]))
        .filter(w => Number.isFinite(w))
        .sort((a, b) => a - b);
    const hrefs = buildFontsHrefs(Array.from(families), weights);

    // Cache the computed hrefs so the module-scope bootstrap below can
    // inject them ~a round-trip earlier on repeat visits.
    try {
        window.localStorage.setItem(FONT_HREFS_CACHE_KEY, JSON.stringify(hrefs));
    } catch { /* private mode etc. — cache is best-effort */ }

    // Track which source IDs are needed THIS pass. Anything previously
    // injected for a source no longer in the list (e.g. last Fontshare
    // family was deleted) gets removed so we don't keep unused CSS
    // bytes lingering in the iframe head.
    const wantedIds = new Set(hrefs.map(h => h.id));
    for (const id of ['cms-fonts-google', 'cms-fonts-fontshare']) {
        if (wantedIds.has(id)) continue;
        const stale = doc.getElementById(id);
        if (stale) stale.remove();
    }

    for (const { id, href } of hrefs) {
        let link = doc.getElementById(id);
        if (!link) {
            link = doc.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            doc.head.appendChild(link);
        }
        if (link.getAttribute('href') !== href) link.setAttribute('href', href);
    }
}

// Walk the current content + design to collect every per-field font name
// the user has picked outside the site Design tab. Returned as an array
// of strings (deduped by `ensureFontsLink`). Without this, picking a
// non-Design font for e.g. the brand title saves correctly but the
// browser falls back to a system font because the family is never
// downloaded.
function collectCustomFontFamilies(content) {
    const out = [];
    const push = (v) => { if (typeof v === 'string' && v.trim()) out.push(v.trim()); };
    if (!content || typeof content !== 'object') return out;

    const header = content.header || {};
    push(header.logo?.titleFont);
    push(header.navStyle?.fontFamily);
    for (const cta of header.ctas || []) push(cta?.labelFont);

    const footer = content.footer || {};
    push(footer.linkStyle?.fontFamily);

    // Block-level per-text fonts — every block currently using textStyle
    // helpers stores fonts under *Style.fontFamily. Walk shallowly across
    // known fields to avoid descending into untyped user content.
    for (const block of content.blocks || []) {
        const c = block?.content;
        if (!c || typeof c !== 'object') continue;
        // Hero
        push(c.badgeStyle?.fontFamily);
        push(c.titleStyle?.fontFamily);
        push(c.leadStyle?.fontFamily);
        // Social Proof
        push(c.eyebrowStyle?.fontFamily);
        // (titleStyle already covered above — both blocks reuse the key)
    }
    return out;
}

// ── Per-block style wrapper ─────────────────────────────────────────
//
// Each block in `content.blocks` is wrapped in a `.cms-block-wrap`
// whose className + inline style come from `block.style`. The wrapper
// owns padding/margin/background/maxWidth/alignment; the section
// component inside it stays focused on content and doesn't have to
// know about styling.
// Types whose section markup carries no internal .reveal elements — the
// wrapper supplies the entrance animation so every block type animates
// uniformly. Never applied in preview (contentEditable focus + the
// editing chrome must not sit inside an opacity transition).
const WRAPPER_REVEAL_TYPES = new Set([
    'socialProof', 'content', 'media-text', 'cta-banner',
    'live-component', 'pricing', 'customer-support',
]);

function blockWrapClasses(style, { type, inPreview } = {}) {
    const out = ['cms-block-wrap'];
    const maxWidth = style?.maxWidth || 'full';
    out.push(`cms-block-wrap--${['narrow', 'medium', 'wide', 'full'].includes(maxWidth) ? maxWidth : 'full'}`);
    if (style?.align && ['left', 'center', 'right'].includes(style.align)) {
        out.push(`cms-block-wrap--align-${style.align}`);
    }
    if (typeof style?.backgroundImage === 'string' && style.backgroundImage) {
        out.push('cms-block-wrap--has-image');
    }
    // ── style v2 (all optional; absent = today's rendering) ─────────
    // band: works on EVERY type via the retheme-scope rule in tokens.css.
    if (['surface', 'tint', 'dark', 'primary'].includes(style?.band)) {
        out.push(`cms-band--${style.band}`);
    }
    // rhythm: re-declares --section-y for the wrapped section.
    if (['compact', 'spacious'].includes(style?.rhythm)) {
        out.push(`cms-rhythm--${style.rhythm}`);
    }
    if (style?.glow === true) out.push('cms-glow');
    if (style?.reveal === 'off') {
        // Forces any internal .reveal elements visible (per-block motion off).
        out.push('cms-no-reveal');
    } else if (!inPreview && WRAPPER_REVEAL_TYPES.has(type)) {
        out.push('reveal');
    }
    if (typeof style?.cssClass === 'string' && style.cssClass.trim()) {
        out.push(style.cssClass.trim());
    }
    return out.join(' ');
}

function blockWrapStyle(style) {
    if (!style || typeof style !== 'object') return undefined;
    const css = {};

    // NOTE: color overrides are NOT set inline here. They're emitted as a
    // dedicated <style> rule (see buildBlockOverrideCss) targeting the
    // wrapper by data-cms-block-id. Inline custom-property cascade through
    // multi-level alias chains (--accent-gradient → --brand-primary)
    // doesn't reliably override the site-level inline values; a real CSS
    // rule with attribute selector cascades cleanly to all descendants.

    // Spacing — CSS-value strings (e.g. '4rem', '64px') pass through verbatim.
    const sp = style.spacing;
    if (sp && typeof sp === 'object') {
        if (typeof sp.paddingTop    === 'string' && sp.paddingTop)    css.paddingTop    = sp.paddingTop;
        if (typeof sp.paddingBottom === 'string' && sp.paddingBottom) css.paddingBottom = sp.paddingBottom;
    }

    // Grid column override (style v2) — consumed by the grid rules in
    // tokens.css via repeat(var(--cms-cols, N), 1fr).
    if ([2, 3, 4].includes(Number(style.columns))) {
        css['--cms-cols'] = Number(style.columns);
    }

    // Background image. cms-block-wrap--has-image (added by blockWrapClasses)
    // ensures size/position/repeat from marketing.css and triggers the
    // ::before overlay pseudo, which reads --cms-bg-overlay below.
    if (typeof style.backgroundImage === 'string' && style.backgroundImage) {
        css.backgroundImage = `url(${JSON.stringify(resolveAssetUrl(style.backgroundImage))})`;
    }
    if (typeof style.backgroundOverlay === 'string' && style.backgroundOverlay) {
        css['--cms-bg-overlay'] = style.backgroundOverlay;
    }

    return Object.keys(css).length ? css : undefined;
}

// Build a CSS rule string that scopes color-token overrides to a single
// block's wrapper via [data-cms-block-id="..."]. Returns null when there's
// nothing to override (so the rendered <style> stays empty).
//
// CSS custom properties resolve var() references at the point of declaration,
// not the point of use. marketing.css declares aliases like
//   .marketing-root { --accent: var(--brand-primary); --bg-primary: var(--brand-bg); … }
// which get computed ON .marketing-root using ITS --brand-* values. Setting
// --brand-primary on a deeper wrapper would NOT change those aliases for
// descendants, because the alias values were already baked at the
// marketing-root level. Most section CSS uses the aliases, not the raw
// --brand-* tokens, so a naked --brand-* override would be near-invisible.
//
// To fix: re-declare the alias chain at the wrapper level too, so it
// re-evaluates against whatever --brand-* the wrapper exposes (overridden
// where set, inherited otherwise). --accent-gradient additionally depends
// on the .cms-gradient class on .marketing-root — both flavors are emitted
// so only the matching one applies.
function buildBlockOverrideCss(blockId, style) {
    const co = style?.colorOverrides;
    if (!co || typeof co !== 'object' || !blockId) return null;
    const decls = [];
    if (co.primary)       decls.push(`--brand-primary: ${co.primary};`);
    if (co.secondary)     decls.push(`--brand-secondary: ${co.secondary};`);
    if (co.accent)        decls.push(`--brand-accent: ${co.accent};`);
    if (co.background)    decls.push(`--brand-bg: ${co.background};`);
    if (co.surface)       decls.push(`--brand-surface: ${co.surface};`);
    if (co.text)          decls.push(`--brand-text: ${co.text};`);
    if (co.textSecondary) decls.push(`--brand-text-secondary: ${co.textSecondary};`);
    if (decls.length === 0) return null;

    // Escape the id to be safe in the attribute selector. Block IDs are
    // already alphanumeric+underscore via the store, but being defensive.
    const safeId = String(blockId).replace(/"/g, '');
    const sel = `[data-cms-block-id="${safeId}"]`;

    // Aliases that must be re-evaluated on the wrapper so descendants see
    // the overridden brand tokens. Mirrors the alias declarations in
    // marketing.css's .marketing-root rule (minus the hard-coded ones like
    // --text-muted / --border-subtle, which the override layer doesn't
    // attempt to recompute).
    const aliases = [
        '--accent: var(--brand-primary);',
        '--accent-light: var(--brand-accent);',
        '--bg-primary: var(--brand-bg);',
        '--bg-secondary: var(--brand-surface);',
        '--text-primary: var(--brand-text);',
        '--text-secondary: var(--brand-text-secondary);',
    ];

    // Inherited CSS properties (color, background) are computed *once* on
    // .marketing-root from var(--text-primary)/var(--bg-primary) and
    // descendants inherit the RESOLVED value — not the variable. So a
    // wrapper that only redeclares the variables doesn't change anything
    // for sections like Media+Text that have no own color/background
    // rules. We re-paint these on the wrapper itself when the user
    // explicitly overrides them, so descendants inherit from the wrapper
    // instead of the marketing-root. Only emitted on demand to avoid
    // forcing a background color on blocks that didn't ask for one.
    if (co.text)       aliases.push('color: var(--text-primary);');
    if (co.background) aliases.push('background-color: var(--bg-primary);');

    return [
        `${sel} { ${decls.join(' ')} ${aliases.join(' ')} }`,
        // Gradient flavor — matches when the site has gradient mode on.
        `.marketing-root.cms-gradient ${sel} { --accent-gradient: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%); }`,
        // Solid flavor — matches when gradient mode is off.
        `.marketing-root:not(.cms-gradient) ${sel} { --accent-gradient: var(--brand-primary); }`,
    ].join(' ');
}

// resolveAssetUrl moved to ./assetUrl.js (sections import it there without
// cycling through this module); imported for local use + re-exported so
// existing imports keep resolving.
export { resolveAssetUrl };

/**
 * Public product website. Renders enabled sections in canonical order from
 * the CMS content tree, applies the user's design system to root-level CSS
 * variables, and wraps each block with its style overrides.
 *
 * Preview mode (?preview=1):
 *   - Receives `cms-preview { content, design }` postMessage with structural
 *     and design changes from the panel.
 *   - Each text node becomes a click-to-edit `EditableText` that posts
 *     `cms-edit` events back to the panel on blur.
 *   - Receives `cms-active { blockId, locked, labels }` mirroring the
 *     panel's block selection + AI stream lock. The block map paints the
 *     active outline (`.cms-block-active`) and renders PreviewBlockChrome
 *     inside each wrapper: a name tag + floating toolbar posting
 *     `cms-block-action`, and insert "+" zones posting `cms-insert-at`.
 *     All chrome keys on the wrapper's block *id*, never its type — the
 *     old SectionFrame hover toolbar keyed on type and never resolved
 *     (see components/SectionFrame.jsx).
 */
export default function ProductWebsite({ content: initialContent, analytics = null }) {
    const rootRef = useRef(null);
    const [content, setContent] = useState(initialContent || {});

    // Automatic interaction events (CTA clicks, outbound links, downloads, form
    // submits). No consent logic of its own: it calls window.umami.track, which
    // only exists once the consent-gated tracker has loaded.
    const eventsEnabled = !!analytics && !analytics.disabledForPage;
    useEffect(() => {
        if (!eventsEnabled) return undefined;
        return startAnalyticsEvents();
    }, [eventsEnabled]);

    // Design comes from one of three sources, in order of priority:
    //   1. cms-preview postMessage (preview mode, live editor)
    //   2. content.design embedded by the public route (synthesizeLegacyContent)
    //   3. null → CSS file defaults take over
    const [design, setDesign] = useState(initialContent?.design || null);
    // Preview mode: 'chrome' renders header/footer with a neutral placeholder
    // body so the user can edit site chrome in isolation. Null/'page' renders
    // the page's blocks normally. Only set in admin preview (postMessage).
    const [previewMode, setPreviewMode] = useState(null);
    // Latest cms-active payload from the panel (admin preview only).
    // Selection state LIVES in the panel — this is a read-only mirror the
    // block chrome renders from: blockId = the active block's id (never
    // type), locked = AI stream lock, labels = { [type]: label } so block
    // pills get human names without importing admin code.
    const [cmsActive, setCmsActive] = useState({ blockId: null, locked: false, labels: {} });

    // Visitor theme override — null = follow design.theme; 'light'/'dark'
    // force a mode. Persisted across visits in localStorage when the site
    // exposes the footer theme toggle.
    const [themeOverride, setThemeOverrideState] = useState(() => {
        if (typeof window === 'undefined') return null;
        try {
            const v = window.localStorage.getItem('cms.themeOverride');
            return v === 'light' || v === 'dark' ? v : null;
        } catch { return null; }
    });
    const setThemeOverride = (next) => {
        setThemeOverrideState(next);
        try {
            if (next) window.localStorage.setItem('cms.themeOverride', next);
            else      window.localStorage.removeItem('cms.themeOverride');
        } catch { /* ignore */ }
    };
    // Resolved theme drives the dark-mode class. Override wins; otherwise
    // fall back to the site's design.theme.
    const effectiveTheme =
        themeOverride ||
        (design?.theme === 'dark' ? 'dark' : 'light');
    const isDark = effectiveTheme === 'dark';
    const toggleTheme = () => setThemeOverride(isDark ? 'light' : 'dark');

    useEffect(() => {
        setContent(initialContent || {});
        if (initialContent?.design) setDesign(initialContent.design);
    }, [initialContent]);

    // Preview-mode listener — admin panel posts structural + design updates.
    useEffect(() => {
        if (!isPreviewMode()) return;
        // Same-origin-only: the admin panel that posts cms-preview lives on
        // the same origin as this page. Without this check a malicious
        // parent frame could inject arbitrary content + design (CSS vars
        // including font URLs) into our DOM via postMessage.
        const expectedOrigin = window.location.origin;
        const onMessage = (e) => {
            if (e.origin !== expectedOrigin) return;
            if (e.data?.type === 'cms-preview') {
                if (e.data.content) setContent(e.data.content);
                // Allow null/undefined design to mean "no override", but
                // normalize to null so applyDesignToRoot clears inline vars.
                if ('design' in e.data) setDesign(e.data.design || null);
                if ('previewMode' in e.data) setPreviewMode(e.data.previewMode || null);
            }
            // Selection/lock sync from the panel — stored verbatim; the
            // block map below derives the active class + chrome props.
            if (e.data?.type === 'cms-active') {
                setCmsActive({
                    blockId: typeof e.data.blockId === 'string' ? e.data.blockId : null,
                    locked: e.data.locked === true,
                    labels: (e.data.labels && typeof e.data.labels === 'object' && !Array.isArray(e.data.labels))
                        ? e.data.labels
                        : {},
                });
            }
            // Translation list → scroll the matching block into view and flash
            // a highlight so the admin sees which block a row belongs to.
            if (e.data?.type === 'cms-scroll' && typeof e.data.blockId === 'string') {
                const el = rootRef.current?.querySelector(`[data-cms-block-id="${e.data.blockId.replace(/"/g, '')}"]`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('cms-block-flash');
                    setTimeout(() => el.classList.remove('cms-block-flash'), 1200);
                }
            }
        };
        // Forward undo/redo hotkeys to the admin panel — Ctrl/Cmd+Z is
        // otherwise dead while focus sits inside this iframe (key events
        // never bubble cross-document). Native text undo must keep winning
        // inside EditableText / form fields, so contentEditable and
        // input/textarea targets are left alone (no preventDefault, no
        // forward). Shift+Z / Y = redo. Same expectedOrigin as above.
        const onKeyDown = (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            const k = (e.key || '').toLowerCase();
            if (k !== 'z' && k !== 'y') return;
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            e.preventDefault();
            const action = (k === 'y' || (k === 'z' && e.shiftKey)) ? 'redo' : 'undo';
            window.parent?.postMessage({ type: 'cms-hotkey', action }, expectedOrigin);
        };
        window.addEventListener('message', onMessage);
        window.addEventListener('keydown', onKeyDown);
        // Mark the root with a class so CSS can adapt (e.g., un-fix the header).
        rootRef.current?.classList.add('cms-preview');
        // Tell the parent we're ready — explicit target origin (no '*').
        window.parent?.postMessage({ type: 'cms-preview-ready' }, expectedOrigin);
        return () => {
            window.removeEventListener('message', onMessage);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, []);

    // Apply design to the root element + sync Google Fonts <link> in head.
    // effectiveTheme is included in deps so the dark-mode class flips when
    // the visitor toggles the footer switcher.
    useEffect(() => {
        applyDesignToRoot(rootRef.current, design, effectiveTheme);
        // Also load any per-field fonts the user picked outside the
        // Design tab — Brand title, nav links, footer links, header
        // buttons, block-level *Style.fontFamily. Without this branch
        // those picks save fine but the browser falls back to a system
        // font because the family was never downloaded.
        ensureFontsLink(
            rootRef.current?.ownerDocument,
            design?.fonts?.heading,
            design?.fonts?.body,
            [design?.fonts?.mono, ...collectCustomFontFamilies(content)],
            design?.typography?.headingWeight,
        );
    }, [design, effectiveTheme, content]);

    useScrollReveal(rootRef, content);

    // Public-site <head>: page title, SEO meta, robots and favicon. Never in
    // editor preview (the iframe keeps its neutral title). pageTitle/seo come
    // from synthesizeLegacyContent (locale overrides pre-merged server-side);
    // favicon from the design blob.
    useCmsHead({
        enabled: !isPreviewMode(),
        pageTitle: content.pageTitle,
        seo: content.seo,
        favicon: design?.favicon,
        resolveAssetUrl,
    });

    // When the panel sends a blocks[] array (multi-page CMS), render in that
    // order so the preview reflects the editor's block list. Otherwise fall
    // back to the legacy keyed shape so the public site at "/" keeps working.
    const orderedBlocks = Array.isArray(content.blocks)
        ? content.blocks.filter(b => {
            const keep = b && b.enabled !== false && SECTION_REGISTRY[b.type];
            // Dev-only: an unknown block type renders nothing. Warn so the
            // "empty page" cause is visible during development (production
            // stays silent; the import boundary surfaces it to users).
            if (import.meta.env?.DEV && b && b.enabled !== false && !SECTION_REGISTRY[b.type]) {
                console.warn('[ProductWebsite] skipping unknown block type', { id: b.id, type: b.type });
            }
            return keep;
        })
        : null;

    // Per-page chrome visibility. When the active page has hideHeader /
    // hideFooter set, suppress that part of the site chrome. Both are
    // ignored in chrome-preview mode (the user is editing the chrome
    // itself and needs to see it). Undefined/null/missing → show, so
    // pages that pre-date the flags keep their original behaviour.
    const isChromePreview = previewMode === 'chrome';
    const showHeader = isChromePreview || !content.hideHeader;
    const showFooter = isChromePreview || !content.hideFooter;

    // Click-to-select only in the admin preview (?preview=1). The block
    // wrappers also render on the public site, where posting to the parent
    // frame would be pointless — gate it so the public page stays inert.
    const inPreview = isPreviewMode();

    return (
        <div className="marketing-root" ref={rootRef}>
            {/* First focusable element on the page — keyboard/AT users skip
                the announcement bar + full nav straight to the <main>
                landmark below. Renders nothing in the admin preview. */}
            <SkipLink />
            {/* Announcement bar — above the header on every page. Renders
                nothing unless the site enabled it AND the resolved locale
                has a message, so sites without one are pixel-identical.
                Shares resolveCookieLang() with the cookie banner: both read
                one per-locale text blob and pick the visitor's language. */}
            <AnnouncementBar
                enabled={content.announcement?.enabled === true}
                dismissible={content.announcement?.dismissible !== false}
                variant={content.announcement?.variant}
                language={resolveCookieLang()}
                text={content.announcement?.text}
            />
            {showHeader ? (
                <Header
                    data={content.header}
                    showLanguageSwitcher={content.footer?.showLanguageSwitcher !== false}
                />
            ) : null}
            {/* The page's one main landmark — every rendered section sits
                inside it; site chrome (header, footer, banners) stays out.
                No section component renders its own <main> (the standalone
                HomePage/PricingPage ones are separate routes), so this never
                creates a duplicate landmark. Also the skip-link target. */}
            <main id="main">
            {previewMode === 'chrome' ? (
                <ChromePreviewPlaceholder />
            ) : orderedBlocks ? (
                <>
                    {orderedBlocks.map(b => {
                        const Comp = SECTION_REGISTRY[b.type];
                        const overrideCss = buildBlockOverrideCss(b.id, b.style);
                        // Chrome positions are computed against the FULL
                        // blocks array — orderedBlocks filters out disabled/
                        // unknown blocks, so its own indices would make the
                        // panel splice new sections in the wrong slot.
                        const srcIndex = content.blocks.indexOf(b);
                        const isActive = inPreview && cmsActive.blockId === b.id;
                        return (
                            <React.Fragment key={b.id}>
                                {/* Insert-before zone (preview only). */}
                                {inPreview
                                    ? <InsertZone index={srcIndex} locked={cmsActive.locked} />
                                    : null}
                                {overrideCss ? <style>{overrideCss}</style> : null}
                                <div
                                    data-cms-block-id={b.id}
                                    // Read by analyticsEvents.js so a CTA click can
                                    // be attributed to the block it came from.
                                    data-cms-block-type={b.type}
                                    className={`${blockWrapClasses(b.style, { type: b.type, inPreview })}${isActive ? ' cms-block-active' : ''}`}
                                    style={blockWrapStyle(b.style)}
                                    // Clicking anywhere in the block (images,
                                    // buttons, empty space — not just editable
                                    // text) selects it in the panel. Bubbles up
                                    // from descendants; doesn't preventDefault, so
                                    // links/buttons still work. Editable-text focus
                                    // posts the same id, which the panel dedupes.
                                    onClick={inPreview
                                        ? () => window.parent?.postMessage(
                                            { type: 'cms-select', blockId: b.id }, '*')
                                        : undefined}
                                >
                                    {/* Stamp this block's id onto every EditableText
                                        inside so inline edits write back to THIS
                                        block, not the first one of its type. */}
                                    <BlockIdContext.Provider value={b.id}>
                                        <Comp data={{ enabled: b.enabled !== false, ...(b.content || {}) }} />
                                    </BlockIdContext.Provider>
                                    {/* Name tag + floating toolbar (preview only) —
                                        a view of the panel's selection/lock state. */}
                                    {inPreview ? (
                                        <PreviewBlockChrome
                                            blockId={b.id}
                                            label={cmsActive.labels[b.type] || b.type}
                                            locked={cmsActive.locked}
                                            isFirst={srcIndex === 0}
                                            isLast={srcIndex === content.blocks.length - 1}
                                        />
                                    ) : null}
                                </div>
                            </React.Fragment>
                        );
                    })}
                    {/* Insert-after-last zone (preview only). */}
                    {inPreview
                        ? <InsertZone index={content.blocks.length} locked={cmsActive.locked} />
                        : null}
                </>
            ) : (
                <>
                    <Hero         data={content.hero} />
                    <SocialProof  data={content.socialProof} />
                    <Features     data={content.features} />
                    <Steps        data={content.steps} />
                    <Security     data={content.security} />
                    <Integrations data={content.integrations} />
                    <Architecture data={content.architecture} />
                    <TechStats    data={content.techStats} />
                    <CTA          data={content.cta} />
                </>
            )}
            </main>
            {showFooter ? (
                <Footer
                    data={content.footer}
                    isDark={isDark}
                    onToggleTheme={toggleTheme}
                />
            ) : null}
            {/* Site-wide cookie banner. Rendered inside .marketing-root so its
                inline styles resolve the brand CSS variables (--brand-primary
                etc.). Always mounted on marketing pages — the component itself
                decides whether to render based on the visitor's stored choice. */}
            <CookieBanner
                enabled={content.cookieBanner?.enabled !== false}
                language={resolveCookieLang()}
                text={content.cookieBanner?.text}
            />
            {/* Usage trackers — render nothing; inject <script> tags only on
                the live public site (gated server-side and by visitor consent).
                Off in preview, and off entirely on pages the admin excluded
                from analytics (analytics.disabledForPage). Umami is first-party
                (cookieless by default); Google Analytics is ALWAYS gated behind
                cookie-banner consent. */}
            {analytics && !analytics.disabledForPage ? <AnalyticsTracker {...analytics} /> : null}
            {analytics?.ga?.measurementId && !analytics.disabledForPage
                ? <GoogleAnalyticsTracker measurementId={analytics.ga.measurementId} />
                : null}
            {/* Session recording (heatmaps + replays). Opt-in per site server-
                side, and consent-gated in EVERY consent mode — recording a
                visitor's clicks and DOM is not cookieless-innocent the way a
                pageview count is. */}
            {analytics?.recorderUrl && analytics.websiteId && !analytics.disabledForPage
                ? <SessionRecorder websiteId={analytics.websiteId} recorderUrl={analytics.recorderUrl} />
                : null}
        </div>
    );
}

// Placeholder body shown in the admin preview when the editor is on the
// "Site chrome" panel — keeps header/footer in view while making it clear
// why the body is empty.
function ChromePreviewPlaceholder() {
    return (
        <div style={{
            minHeight: '50vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4rem 1.5rem',
            background: 'var(--brand-bg, transparent)',
        }}>
            <p style={{
                maxWidth: 420,
                margin: 0,
                textAlign: 'center',
                fontSize: '0.9rem',
                lineHeight: 1.6,
                color: 'var(--brand-text-secondary, #94a3b8)',
                opacity: 0.75,
            }}>
                Header and footer are shared across all pages.
            </p>
        </div>
    );
}
