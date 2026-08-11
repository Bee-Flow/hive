// Translatable-content enumeration for the CMS — THE single client copy of
// the rules deciding which leaves of block/chrome content are text that can
// be translated.
//
// KEEP IN SYNC with server/core/cmsTranslate.js (DENY_KEYS / DENY_SUFFIX /
// value heuristics) — the manual translation list, the locale coverage
// numbers and the AI translate must all agree on the same field set. The
// server file's header points back here (it used to point at
// TranslationPanel.jsx, which now consumes this module).

import { BLOCK_EDITORS } from './editors';
import { getLocalePath } from './localeMerge';

// Keys whose value (and subtree) are structural — never translatable.
export const DENY_KEYS = new Set([
    'id', 'kind', 'type', 'slug', 'src', 'href', 'url', 'link', 'anchor',
    'path', 'pageId', 'page', 'target', 'rel', 'icon', 'platform',
    'code', 'codeRight', 'popupEmbed', 'embed', 'iframe',
    'planType', 'defaultInterval', 'enableToggle', 'interval',
    'layout', 'columnLayout', 'verticalAlign', 'mediaPosition', 'mediaSize',
    'backgroundVariant', 'background', 'gradient', 'theme', 'radius',
    'number', 'enabled', 'noIndex', 'ogImage', 'favicon', 'role', 'value',
    'style', 'align', 'variant', 'srcDark', 'frame',
    // roadmap items: `status` is a fixed vocabulary the renderer buckets on
    // ('shipped' | 'beta' | 'building' | 'exploring'). Translated to 'bèta'
    // it matches no bucket and the item silently disappears from the page.
    // Its prose counterpart, `statusLabels`, is NOT denied and does translate.
    'status',
]);
export const DENY_SUFFIX = /(Style|Color|Font|Align|Size|Variant|Url|Src|Id|Link)$/;

export function isDeniedKey(k) {
    if (typeof k !== 'string') return false;
    return DENY_KEYS.has(k) || DENY_SUFFIX.test(k);
}

export function isTranslatableValue(s) {
    const t = s.trim();
    if (!t) return false;
    if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return false;
    if (/^(https?:|mailto:|tel:|data:|\/|#)/i.test(t)) return false;
    return true;
}

// Walk content emitting { fieldPath, source } for every translatable leaf.
export function collectStrings(node, path, out) {
    if (Array.isArray(node)) {
        node.forEach((el, i) => collectStrings(el, [...path, i], out));
        return;
    }
    if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
            if (isDeniedKey(k)) continue;
            collectStrings(v, [...path, k], out);
        }
        return;
    }
    if (typeof node === 'string' && isTranslatableValue(node)) out.push({ fieldPath: path, source: node });
}

export function humanize(key) {
    return String(key)
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/^\w/, c => c.toUpperCase());
}

// Friendlier names for the most common field keys — additive over the
// humanized fallback, so unknown paths still get a sensible label.
const LABELS = {
    lead: 'Lead paragraph',
    eyebrow: 'Eyebrow (small heading)',
    blurb: 'Tagline',
    brandText: 'Brand name',
    logoText: 'Brand name',
    loginLabel: 'Login button',
    copyright: 'Copyright line',
    ctaLabel: 'Button label',
    emptyText: 'Empty-state text',
    successTitle: 'Confirmation title',
    successBody: 'Confirmation text',
    submitLabel: 'Submit button',
    heading: 'Heading',
    subheading: 'Subheading',
    body: 'Body text',
    label: 'Label',
    text: 'Text',
    title: 'Title',
    description: 'Description',
    example: 'Example',
    summary: 'Summary',
    caption: 'Caption',
    alt: 'Image alt text',
    placeholder: 'Placeholder',
    message: 'Message',
    accept: 'Accept button',
    decline: 'Decline button',
    privacyLabel: 'Privacy link label',
};

// "Feature #2 · Title" — item positions first, friendly key name last.
export function labelForPath(fieldPath) {
    const lastKey = [...fieldPath].reverse().find(s => typeof s === 'string');
    const indices = fieldPath.filter(s => typeof s === 'number');
    const base = (lastKey && LABELS[lastKey]) || (lastKey ? humanize(lastKey) : 'Text');
    return indices.length ? `${base} (#${indices.map(i => i + 1).join('·')})` : base;
}

// ── Row-group builders (pure — rows carry a `target` descriptor) ─────

export function buildPageGroups(page, pageOverride, siteOverride) {
    if (!page) return [];
    const groups = [];

    // Page & SEO group. Title lives in the SITE override (pageTitles); SEO in
    // the PAGE override — both routed via their target descriptors.
    const metaRows = [];
    if (typeof page.title === 'string' && page.title.trim()) {
        metaRows.push({
            key: 'page:title',
            label: 'Page title',
            source: page.title,
            value: getLocalePath(siteOverride, ['pageTitles', page.id]),
            target: { type: 'chrome', path: ['pageTitles', page.id] },
        });
    }
    for (const f of ['metaTitle', 'metaDescription']) {
        const src = page.seo?.[f];
        if (typeof src === 'string' && src.trim()) {
            metaRows.push({
                key: `seo:${f}`,
                label: f === 'metaTitle' ? 'Meta title' : 'Meta description',
                source: src,
                value: getLocalePath(pageOverride, ['seo', f]),
                target: { type: 'seo', field: f },
            });
        }
    }
    if (metaRows.length) groups.push({ key: 'meta', title: 'Page & SEO', icon: 'FileText', rows: metaRows });

    for (const block of page.blocks || []) {
        const found = [];
        collectStrings(block.content, [], found);
        if (!found.length) continue;
        const def = BLOCK_EDITORS[block.type] || {};
        groups.push({
            key: block.id,
            blockId: block.id,
            title: def.label || humanize(block.type),
            icon: def.icon || 'Square',
            rows: found.map((f, i) => ({
                key: `${block.id}:${f.fieldPath.join('.')}:${i}`,
                label: labelForPath(f.fieldPath),
                source: f.source,
                value: getLocalePath(pageOverride, ['blocks', block.id, 'content', ...f.fieldPath]),
                target: { type: 'block', blockId: block.id, fieldPath: f.fieldPath },
            })),
        });
    }
    return groups;
}

export function buildSiteGroups(site, siteOverride) {
    const groups = [];
    for (const region of ['header', 'footer']) {
        const node = site?.[region];
        if (!node) continue;
        const found = [];
        collectStrings(node, [], found);
        if (!found.length) continue;
        groups.push({
            key: region,
            title: region === 'header' ? 'Header' : 'Footer',
            icon: region === 'header' ? 'PanelTop' : 'PanelBottom',
            rows: found.map((f, i) => ({
                key: `${region}:${f.fieldPath.join('.')}:${i}`,
                label: labelForPath(f.fieldPath),
                source: f.source,
                value: getLocalePath(siteOverride, [region, ...f.fieldPath]),
                target: { type: 'chrome', path: [region, ...f.fieldPath] },
            })),
        });
    }
    const titleRows = [];
    for (const p of site?.pages || []) {
        if (typeof p.title === 'string' && p.title.trim()) {
            titleRows.push({
                key: `title:${p.id}`,
                label: p.title,
                source: p.title,
                value: getLocalePath(siteOverride, ['pageTitles', p.id]),
                target: { type: 'chrome', path: ['pageTitles', p.id] },
            });
        }
    }
    if (titleRows.length) groups.push({ key: 'pageTitles', title: 'Page titles', icon: 'Files', rows: titleRows });
    return groups;
}

// ── Site-wide coverage (locale menu) ─────────────────────────────────
//
// "n of m fields have a translation" per locale — computed from the state
// the panel already holds (no extra endpoint). Wording is deliberately soft:
// a filled field is not necessarily a FRESH translation (D3 — overrides
// don't track source-text changes), so never present 100% as "done".
export function coverageForLocale(site, pages, localeOverrides, locale) {
    let total = 0;
    let done = 0;
    const siteOv = localeOverrides?.siteByLocale?.[locale] || null;
    for (const g of buildSiteGroups(site, siteOv)) {
        for (const r of g.rows) {
            total += 1;
            if ((r.value || '').trim()) done += 1;
        }
    }
    for (const pageDoc of pages || []) {
        const pageOv = localeOverrides?.pagesByLocale?.[pageDoc.id]?.[locale] || null;
        for (const g of buildPageGroups(pageDoc, pageOv, siteOv)) {
            // buildPageGroups' meta group repeats the page title already
            // counted by buildSiteGroups' pageTitles rows — skip those rows.
            for (const r of g.rows) {
                if (r.key === 'page:title') continue;
                total += 1;
                if ((r.value || '').trim()) done += 1;
            }
        }
    }
    return { done, total };
}

// ── D4 guard: array-reorder detection ────────────────────────────────
//
// Locale overrides address array items by numeric index, so reordering list
// items in the DEFAULT locale silently shifts translations onto the wrong
// items in every other locale. We can't fix that without an override-schema
// change (deferred D4) — but we can detect the reorder and warn. Returns
// true when any array in `next` holds the same multiset of items as `prev`
// in a different order.
export function detectArrayReorder(prev, next) {
    if (Array.isArray(prev) && Array.isArray(next)) {
        if (prev.length === next.length && prev.length > 1) {
            const a = prev.map(x => JSON.stringify(x));
            const b = next.map(x => JSON.stringify(x));
            const sameOrder = a.every((v, i) => v === b[i]);
            if (!sameOrder && [...a].sort().join(' ') === [...b].sort().join(' ')) {
                return true;
            }
        }
        return prev.some((el, i) => detectArrayReorder(el, next[i]));
    }
    if (prev && next && typeof prev === 'object' && typeof next === 'object') {
        for (const k of Object.keys(next)) {
            if (detectArrayReorder(prev[k], next[k])) return true;
        }
    }
    return false;
}

// True when a block has any array-path override leaf in ANY locale — the
// precondition for the D4 warning.
export function blockHasArrayOverrides(localeOverrides, pageId, blockId) {
    const perLocale = localeOverrides?.pagesByLocale?.[pageId] || {};
    for (const ov of Object.values(perLocale)) {
        const blockOv = ov?.blocks?.[blockId]?.content;
        if (blockOv && subtreeHasArray(blockOv)) return true;
    }
    return false;
}

function subtreeHasArray(node) {
    if (Array.isArray(node)) return true;
    if (node && typeof node === 'object') return Object.values(node).some(subtreeHasArray);
    return false;
}
