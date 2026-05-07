import React, { useEffect, useRef, useState } from 'react';
import './marketing.css';

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
import Footer       from './sections/Footer';

import { useScrollReveal } from './components/ScrollReveal';

const SECTION_REGISTRY = {
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
function applyDesignToRoot(rootEl, design) {
    if (!rootEl) return;
    const style = rootEl.style;
    if (!design || typeof design !== 'object') {
        // No design — clear any inline overrides we previously set.
        for (const prop of CSS_VAR_PROPS) style.removeProperty(prop);
        rootEl.classList.remove('cms-theme-dark', 'cms-gradient');
        return;
    }
    const c = design.colors || {};
    const isDark = design.theme === 'dark';

    // Brand colors always come from the user — they ride through both modes.
    if (c.primary)   style.setProperty('--brand-primary',   c.primary);
    if (c.secondary) style.setProperty('--brand-secondary', c.secondary);
    if (c.accent)    style.setProperty('--brand-accent',    c.accent);

    // Layout palette (bg/surface/text). When dark mode is on, we DON'T set
    // these inline — the .cms-theme-dark class in marketing.css supplies
    // dark-flavored values and class-level rules can win. When light, the
    // user's chosen values are pushed inline and override the file defaults.
    if (isDark) {
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

    const fonts = design.fonts || {};
    if (fonts.heading) style.setProperty('--font-heading', cssFontStack(fonts.heading));
    if (fonts.body)    style.setProperty('--font-body',    cssFontStack(fonts.body));

    if (typeof design.radius === 'number' && design.radius >= 0 && design.radius <= 48) {
        style.setProperty('--radius-base', `${design.radius}px`);
    }

    rootEl.classList.toggle('cms-theme-dark', isDark);
    rootEl.classList.toggle('cms-gradient',   design.gradient === true);
}

const CSS_VAR_PROPS = [
    '--brand-primary', '--brand-secondary', '--brand-accent',
    '--brand-bg', '--brand-surface',
    '--brand-text', '--brand-text-secondary',
    '--font-heading', '--font-body',
    '--radius-base',
];

function cssFontStack(name) {
    // Quote names that contain spaces; always include system fallbacks
    // so the page renders before Google Fonts has finished loading.
    const safe = String(name || '').replace(/"/g, '');
    const quoted = /\s/.test(safe) ? `"${safe}"` : safe;
    return `${quoted}, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}

// ── Google Fonts loader ─────────────────────────────────────────────
//
// Maintain a single <link rel="stylesheet"> in the iframe head whose
// href is rebuilt whenever heading/body fonts change. We update href
// rather than recreating the element — same network entry, no flash.
const FONTS_LINK_ID = 'cms-google-fonts';

function ensureFontsLink(doc, headingFont, bodyFont) {
    if (!doc) return;
    const heading = (headingFont || '').trim();
    const body    = (bodyFont    || '').trim();
    if (!heading && !body) {
        const existing = doc.getElementById(FONTS_LINK_ID);
        if (existing) existing.remove();
        return;
    }
    const families = new Set();
    if (heading) families.add(heading);
    if (body)    families.add(body);
    const familyParam = Array.from(families)
        .map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800`)
        .join('&');
    const href = `https://fonts.googleapis.com/css2?${familyParam}&display=swap`;

    let link = doc.getElementById(FONTS_LINK_ID);
    if (!link) {
        link = doc.createElement('link');
        link.id = FONTS_LINK_ID;
        link.rel = 'stylesheet';
        doc.head.appendChild(link);
    }
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
}

// ── Per-block style wrapper ─────────────────────────────────────────
//
// Each block in `content.blocks` is wrapped in a `.cms-block-wrap`
// whose className + inline style come from `block.style`. The wrapper
// owns padding/margin/background/maxWidth/alignment; the section
// component inside it stays focused on content and doesn't have to
// know about styling.
function blockWrapClasses(style) {
    const out = ['cms-block-wrap'];
    const maxWidth = style?.maxWidth || 'full';
    out.push(`cms-block-wrap--${['narrow', 'medium', 'wide', 'full'].includes(maxWidth) ? maxWidth : 'full'}`);
    if (style?.align && ['left', 'center', 'right'].includes(style.align)) {
        out.push(`cms-block-wrap--align-${style.align}`);
    }
    if (typeof style?.backgroundImage === 'string' && style.backgroundImage) {
        out.push('cms-block-wrap--has-image');
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
    return `[data-cms-block-id="${safeId}"] { ${decls.join(' ')} }`;
}

function resolveAssetUrl(urlOrKey) {
    if (!urlOrKey) return '';
    if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://') || urlOrKey.startsWith('/')) return urlOrKey;
    if (urlOrKey.startsWith('cms/')) {
        return `/api/cms/asset/${urlOrKey.split('/').map(encodeURIComponent).join('/')}`;
    }
    return urlOrKey;
}

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
 *   - Each section is wrapped in a `SectionFrame` that exposes a hover
 *     toolbar for quick actions (focus settings, toggle visibility) which
 *     post `cms-section-action` events.
 */
export default function ProductWebsite({ content: initialContent }) {
    const rootRef = useRef(null);
    const [content, setContent] = useState(initialContent || {});
    // Design comes from one of three sources, in order of priority:
    //   1. cms-preview postMessage (preview mode, live editor)
    //   2. content.design embedded by the public route (synthesizeLegacyContent)
    //   3. null → CSS file defaults take over
    const [design, setDesign] = useState(initialContent?.design || null);
    const [activeSection, setActiveSection] = useState(null);

    useEffect(() => {
        setContent(initialContent || {});
        if (initialContent?.design) setDesign(initialContent.design);
    }, [initialContent]);

    // Preview-mode listener — admin panel posts structural + design updates
    // and active-section highlights.
    useEffect(() => {
        if (!isPreviewMode()) return;
        const onMessage = (e) => {
            if (e.data?.type === 'cms-preview') {
                if (e.data.content) setContent(e.data.content);
                // Allow null/undefined design to mean "no override", but
                // normalize to null so applyDesignToRoot clears inline vars.
                if ('design' in e.data) setDesign(e.data.design || null);
            }
            if (e.data?.type === 'cms-active-section') {
                setActiveSection(e.data.section || null);
            }
        };
        window.addEventListener('message', onMessage);
        // Mark the root with a class so CSS can adapt (e.g., un-fix the header).
        rootRef.current?.classList.add('cms-preview');
        // Tell the parent we're ready.
        window.parent?.postMessage({ type: 'cms-preview-ready' }, '*');
        return () => window.removeEventListener('message', onMessage);
    }, []);

    // Apply design to the root element + sync Google Fonts <link> in head.
    useEffect(() => {
        applyDesignToRoot(rootRef.current, design);
        ensureFontsLink(rootRef.current?.ownerDocument, design?.fonts?.heading, design?.fonts?.body);
    }, [design]);

    // Highlight the active section frame.
    useEffect(() => {
        if (!isPreviewMode() || !rootRef.current) return;
        const root = rootRef.current;
        root.querySelectorAll('.cms-section-frame.cms-section-active').forEach(el =>
            el.classList.remove('cms-section-active')
        );
        if (activeSection) {
            const target = root.querySelector(`[data-cms-section="${activeSection}"]`);
            target?.classList.add('cms-section-active');
        }
    }, [activeSection, content]);

    useScrollReveal(rootRef);

    // When the panel sends a blocks[] array (multi-page CMS), render in that
    // order so the preview reflects the editor's block list. Otherwise fall
    // back to the legacy keyed shape so the public site at "/" keeps working.
    const orderedBlocks = Array.isArray(content.blocks)
        ? content.blocks.filter(b => b && b.enabled !== false && SECTION_REGISTRY[b.type])
        : null;

    return (
        <div className="marketing-root" ref={rootRef}>
            <Header data={content.header} />
            {orderedBlocks ? (
                orderedBlocks.map(b => {
                    const Comp = SECTION_REGISTRY[b.type];
                    const overrideCss = buildBlockOverrideCss(b.id, b.style);
                    return (
                        <React.Fragment key={b.id}>
                            {overrideCss ? <style>{overrideCss}</style> : null}
                            <div
                                data-cms-block-id={b.id}
                                className={blockWrapClasses(b.style)}
                                style={blockWrapStyle(b.style)}
                            >
                                <Comp data={b.content} />
                            </div>
                        </React.Fragment>
                    );
                })
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
            <Footer data={content.footer} />
        </div>
    );
}
