// ── Preview content shaping (pure module) ───────────────────────────
//
// Extracted verbatim from ProductWebsitePanel.jsx so the content-shaping
// logic is unit-testable in isolation. No React, no state — every function
// here is a pure transform over the SiteDoc/PageDoc shapes.
//
//   buildPreviewContent  SiteDoc + PageDoc → the display-shape content object
//                        the marketing renderer expects (cms-preview payload)
//   resolvePreviewHref   Link object → href for the preview/public site
//   legacyifyLinks       in-place Link → href rewrite (callers MUST pass a
//                        deep clone — see the comment inside buildPreviewContent)
//   chromeStoragePath    display-shape chrome path → storage-shape path array
//   applyChromeEdit      apply an iframe chrome edit to a SiteDoc (immutable)
//   setIn                immutable nested setter (arrays for numeric segments)

export function buildPreviewContent(site, activePage) {
    const out = {};

    // Header from site chrome. The header carries:
    //   navLinks  — user-customized nav from site.header.nav (the ONLY
    //               source of nav items now; pages no longer auto-merge)
    //   activeSlug — the page being previewed, so Header.jsx can mark
    //                its matching nav entry active. Empty string = home.
    if (site?.header) {
        out.header = {
            enabled: site.header.enabled !== false,
            // Logo & brand — `logo` is the new shape; `logoText` is kept
            // alongside as a fallback for the public renderer's legacy
            // path (Header.jsx prefers logo.text when present).
            logoText: site.header.logoText,
            logo: site.header.logo || undefined,
            loginLabel: site.header.loginLabel,
            // Header buttons (multi-CTA). Each entry carries label, href
            // (resolved), style, and per-button label typography (font /
            // size / color) for the renderer to apply via inline style.
            ctas: (site.header.ctas || []).map(cta => ({
                id: cta.id,
                label: cta.label,
                href: resolvePreviewHref(cta.link, site?.pages),
                // Carry the link's "open in new tab" flag through to the
                // renderer (Header.jsx reads cta.target/cta.rel). Without
                // this the preview opened external CTAs — e.g. a "Book a
                // demo" link to Google's scheduler — in the SAME tab, so the
                // visitor lost the site after booking. The public path
                // already emits these (server/routes/cms.js); this keeps the
                // editor preview consistent with the live site.
                ...(cta.link?.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
                style: cta.style || 'primary',
                labelFont:  cta.labelFont  || '',
                labelSize:  Number.isFinite(cta.labelSize) ? cta.labelSize : 0,
                labelColor: cta.labelColor || '',
            })),
            // Master nav-link style (font / size / color) — applied to
            // every nav link + dropdown child by Header.jsx. Sits as a
            // sibling to navLinks because the items array can't carry
            // string keys.
            navStyle: site.header.navStyle || undefined,
            navLinks: (site.header.nav || []).map(n => {
                const item = {
                    label: n.label,
                    href: resolvePreviewHref(n.link, site?.pages),
                    // Flat children (legacy list-mode dropdown). Always
                    // emitted so the existing renderer path still works.
                    children: (n.children || []).map(c => ({
                        label: c.label,
                        href: resolvePreviewHref(c.link, site?.pages),
                    })),
                };
                // Mega-menu (columns) shape — additive. Only emitted when
                // the user explicitly switched the dropdown to "columns".
                if (n.dropdown?.layout === 'columns') {
                    item.dropdown = {
                        layout: 'columns',
                        columns: (n.dropdown.columns || []).map(col => ({
                            heading: col.heading || '',
                            items: (col.items || []).map(mi => ({
                                label:       mi.label || '',
                                href:        resolvePreviewHref(mi.link, site?.pages),
                                description: mi.description || '',
                                icon:        mi.icon || '',
                                target:      mi.openInNewTab ? '_blank' : undefined,
                                rel:         mi.openInNewTab ? 'noopener noreferrer' : undefined,
                            })),
                        })),
                    };
                }
                return item;
            }),
            activeSlug: activePage?.isHomepage ? '' : (activePage?.slug || ''),
        };
    }
    if (site?.footer) {
        out.footer = {
            enabled: site.footer.enabled !== false,
            // Opt-in 3-button (system / light / dark) switcher rendered
            // by the public Footer. Off by default — only emitted when
            // the user toggles it on in the Site chrome editor.
            themeSwitcher: site.footer.themeSwitcher?.enabled
                ? { enabled: true }
                : undefined,
            brand: {
                logoText: site.footer.brandText,
                blurb: site.footer.blurb,
                showDot: site.footer.showBrandDot === true,
            },
            // Master footer-link style (font + color), applied to every
            // column link AND every social link by Footer.jsx.
            linkStyle: site.footer.linkStyle || undefined,
            columns: (site.footer.columns || []).map(c => ({
                heading: c.heading,
                links: (c.links || []).map(l => ({
                    label: l.label,
                    href: resolvePreviewHref(l.link, site?.pages),
                })),
            })),
            socials: (site.footer.socials || []).map(s => ({
                platform: s.platform,
                href: resolvePreviewHref(s.link, site?.pages),
            })),
            copyright: site.footer.copyright,
            // Trust surface + locale toggle — stored under the same keys,
            // passed through so preview matches the published site.
            accountability: site.footer.accountability || undefined,
            showLanguageSwitcher: site.footer.showLanguageSwitcher === true,
        };
    }
    // Cookie banner — site-wide chrome, passed through verbatim so the
    // preview iframe renders/edits it the same way the published site will.
    if (site?.cookieBanner) out.cookieBanner = site.cookieBanner;
    // Announcement bar — same story: site-wide chrome, one per-locale text
    // blob, no links to resolve. Passed through verbatim so the preview
    // iframe renders (and inline-edits) exactly what the published site gets.
    if (site?.announcement) out.announcement = site.announcement;

    // Blocks for the active page. We emit BOTH:
    //   - the legacy keyed shape (out.hero, out.features, …) so the public
    //     site renderer at "/" keeps working until it migrates,
    //   - blocks[] in panel order so the preview can render them in the
    //     order the editor sees (multi-page WordPress-style).
    // Per-page chrome visibility — sourced from the site-index entry
    // (kept in sync with the page doc by savePageMeta). The renderer
    // hides Header/Footer when these are true; preview shows the editor
    // the same outcome the published site will produce.
    out.hideHeader = !!activePage?.hideHeader;
    out.hideFooter = !!activePage?.hideFooter;

    if (activePage?.blocks) {
        const blocksOut = [];
        for (const block of activePage.blocks) {
            // legacyifyLinks mutates `node.link` → `node.href` in place,
            // so we MUST deep-clone before calling it. A shallow spread
            // would share nested objects (block.content.cta, every nav
            // item, every Content-block element) with panel state — and
            // the next preview push would silently delete `link` off the
            // user's source-of-truth shape, snapping LinkField back to
            // its default kind on the next render and persisting the
            // corruption on the next auto-save.
            const legacy = JSON.parse(JSON.stringify({
                enabled: block.enabled !== false,
                ...(block.content || {}),
            }));
            legacyifyLinks(legacy, site?.pages);
            out[block.type] = legacy;
            blocksOut.push({
                id: block.id,
                type: block.type,
                enabled: block.enabled !== false,
                content: legacy,
                // style is opaque to the preview content builder — pass it
                // through verbatim so the iframe wrapper can apply it.
                style: block.style || {},
            });
        }
        out.blocks = blocksOut;
    }

    return out;
}

export function resolvePreviewHref(link, pages) {
    if (!link) return '#';
    if (link.kind === 'anchor')   return `#${link.anchor || ''}`;
    if (link.kind === 'app')      return link.path || '/';
    if (link.kind === 'external') return link.url || '#';
    if (link.kind === 'page') {
        const page = (pages || []).find(p => p.id === link.pageId);
        if (!page) return '#';                          // broken — page deleted
        // Public site is served at `/` (RootPathGate). Non-homepage pages
        // route via `/?slug=<slug>` so the browser keeps pathname='/' and
        // the BeeFlow app router doesn't intercept.
        const base = page.isHomepage ? '/' : `/?slug=${encodeURIComponent(page.slug)}`;
        return link.anchor ? `${base}#${link.anchor}` : base;
    }
    return '#';
}

// Link union: only these four kinds describe a Link object. Other blocks
// (e.g. Media + Text) use `kind` for unrelated discriminators (image vs
// video), so we MUST whitelist before treating an object as a Link.
const LINK_KINDS = ['page', 'external', 'anchor', 'app'];

export function legacyifyLinks(node, pages) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(n => legacyifyLinks(n, pages)); return; }
    for (const [k, v] of Object.entries(node)) {
        if (v && typeof v === 'object' && !Array.isArray(v)
            && typeof v.kind === 'string' && LINK_KINDS.includes(v.kind)) {
            if (k === 'link') {
                node.href = resolvePreviewHref(v, pages);
                delete node.link;
            } else if (k === 'ctaLink') {
                node.ctaHref = resolvePreviewHref(v, pages);
                delete node.ctaLink;
            } else {
                node[k] = resolvePreviewHref(v, pages);
            }
        } else {
            legacyifyLinks(v, pages);
        }
    }
}

// ── Chrome-path inverse mapper ───────────────────────────────────────
//
// buildPreviewContent re-shapes the SiteDoc for the iframe, so EditableText
// emits paths in display-shape (e.g. footer.brand.blurb), while the SiteDoc
// stores them in storage-shape (footer.blurb). applyChromeEdit walks the
// path, translates the few non-passthrough keys, and returns a new SiteDoc
// with the value applied. Returns null if the path doesn't map to anything
// the SiteDoc owns (so the caller can ignore the edit safely).
// Maps an iframe display-shape chrome path (e.g. footer.brand.blurb,
// header.navLinks.0.label) to the storage-shape path array the SiteDoc /
// site-locale override uses (footer.blurb, header.nav.0.label). Returns null
// if the path isn't a chrome path. Shared by applyChromeEdit (base doc) and
// the translation-mode override writer.
export function chromeStoragePath(path) {
    const parts = path.split('.');
    const root = parts[0];
    if (root !== 'header' && root !== 'footer' && root !== 'announcement') return null;

    // Announcement bar: display shape === storage shape (buildPreviewContent
    // passes site.announcement through verbatim), so every segment is a
    // straight pass-through — e.g. announcement.text.en.message.
    if (root === 'announcement') return parts;

    if (root === 'footer' && parts[1] === 'brand' && parts[2] === 'logoText' && parts.length === 3) {
        return ['footer', 'brandText'];
    } else if (root === 'footer' && parts[1] === 'brand' && parts[2] === 'blurb' && parts.length === 3) {
        return ['footer', 'blurb'];
    } else if (root === 'header' && parts[1] === 'navLinks') {
        // header.navLinks.{i}.label                       → header.nav[i].label
        // header.navLinks.{i}.children.{j}.label          → header.nav[i].children[j].label
        // Convert numeric segments in the tail to actual numbers so setIn
        // recognises array indices (otherwise children would silently be
        // converted to a plain object keyed by numeric strings).
        return [
            'header',
            'nav',
            Number(parts[2]),
            ...parts.slice(3).map(seg => /^\d+$/.test(seg) ? Number(seg) : seg),
        ];
    } else if (root === 'header' && parts[1] === 'ctas') {
        // header.ctas.{i}.label → header.ctas[i].label (storage shape
        // matches display shape here, but we still need to convert the
        // index to a number for setIn).
        return [
            'header',
            'ctas',
            Number(parts[2]),
            ...parts.slice(3).map(seg => /^\d+$/.test(seg) ? Number(seg) : seg),
        ];
    }
    // Pass-through: header.logoText / header.logo.text / header.loginLabel /
    // footer.copyright / footer.columns.{i}.heading /
    // footer.columns.{i}.links.{j}.label
    return parts.map(seg => /^\d+$/.test(seg) ? Number(seg) : seg);
}

export function applyChromeEdit(site, path, value) {
    const storagePath = chromeStoragePath(path);
    if (!storagePath) return null;
    return setIn(site, storagePath, value);
}

// Immutable nested setter. Numeric path segments produce arrays; string
// segments produce objects. Missing intermediate nodes are created so the
// edit can land even when the user is filling in a freshly-empty field.
export function setIn(obj, path, value) {
    if (path.length === 0) return value;
    const [head, ...tail] = path;
    const childIsArray = tail.length > 0 && typeof tail[0] === 'number';
    const headIsArray = typeof head === 'number';
    const base = headIsArray ? (Array.isArray(obj) ? [...obj] : []) : { ...(obj || {}) };
    const childExisting = base[head];
    const childInit = childIsArray
        ? (Array.isArray(childExisting) ? childExisting : [])
        : (childExisting && typeof childExisting === 'object' ? childExisting : {});
    base[head] = setIn(tail.length ? childInit : undefined, tail, value);
    return base;
}
