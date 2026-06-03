/**
 * Client mirror of the server's per-locale merge + sparse-override helpers.
 *
 * Keep `mergeLocaleContent` byte-for-byte equivalent to
 * server/stores/cmsStore.js `mergeLocaleContent` — the editor preview must
 * render exactly what the published site will serve. (A parity check lives in
 * the cmsStore translation tests.)
 *
 * Used by ProductWebsitePanel (preview merge, inline-edit writes) and
 * TranslationPanel (reading/writing the sparse override).
 */

function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function clone(v) {
    return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

// Merge a sparse, text-only locale OVERRIDE onto BASE. Structure (arrays,
// object keys, non-text fields) is driven by BASE; arrays merge by index; a
// non-empty string in the override wins; an empty/missing string falls back to
// the source. See the server function for the authoritative spec.
export function mergeLocaleContent(base, override) {
    if (override === undefined || override === null) return base;
    if (Array.isArray(base)) {
        if (!Array.isArray(override)) return base;
        return base.map((el, i) =>
            i < override.length ? mergeLocaleContent(el, override[i]) : el);
    }
    if (Array.isArray(override)) return base;
    if (isPlainObject(base)) {
        if (!isPlainObject(override)) return base;
        const out = { ...base };
        for (const k of Object.keys(base)) {
            if (Object.prototype.hasOwnProperty.call(override, k)) {
                out[k] = mergeLocaleContent(base[k], override[k]);
            }
        }
        return out;
    }
    if (typeof override === 'string' && override.trim() !== '') return override;
    return base;
}

// Read the value at a path of string keys / numeric indices, or undefined.
export function getLocalePath(root, segs) {
    let cur = root;
    for (const k of segs) {
        if (cur == null || typeof cur !== 'object') return undefined;
        cur = cur[k];
    }
    return cur;
}

// Immutably set `value` at `segs` in a CLONE of `root`, materializing objects
// and index-aligned (null-padded) arrays so the sparse override lines up with
// the base when merged. An empty-string value prunes the leaf (and any parent
// that becomes empty) so the field re-inherits the source text.
export function setLocalePath(root, segs, value) {
    const next = root && typeof root === 'object' ? clone(root) : {};
    const empty = typeof value === 'string' && value.trim() === '';
    if (empty) {
        pruneLocalePath(next, segs);
        return next;
    }
    let cur = next;
    for (let i = 0; i < segs.length - 1; i++) {
        const k = segs[i];
        const nextIsIdx = typeof segs[i + 1] === 'number';
        if (typeof k === 'number') {
            while (cur.length <= k) cur.push(null);
            if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = nextIsIdx ? [] : {};
            cur = cur[k];
        } else {
            if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = nextIsIdx ? [] : {};
            cur = cur[k];
        }
    }
    const last = segs[segs.length - 1];
    if (typeof last === 'number') { while (cur.length <= last) cur.push(null); cur[last] = value; }
    else cur[last] = value;
    return next;
}

// Remove the leaf at `segs`, then walk back up removing now-empty containers.
function pruneLocalePath(root, segs) {
    const chain = [root];
    let cur = root;
    for (let i = 0; i < segs.length - 1; i++) {
        if (cur == null || typeof cur !== 'object') return;
        cur = cur[segs[i]];
        chain.push(cur);
    }
    if (cur == null || typeof cur !== 'object') return;
    const last = segs[segs.length - 1];
    if (Array.isArray(cur)) { if (last < cur.length) cur[last] = null; }
    else delete cur[last];
    // Collapse empties from the leaf upward.
    for (let i = chain.length - 1; i >= 1; i--) {
        const node = chain[i];
        const parent = chain[i - 1];
        const key = segs[i - 1];
        const isEmpty = Array.isArray(node)
            ? node.every(x => x == null)
            : (node && typeof node === 'object' && Object.keys(node).length === 0);
        if (isEmpty) {
            if (Array.isArray(parent)) parent[key] = null;
            else delete parent[key];
        } else break;
    }
}

// Pre-merge a SiteDoc with its site-locale override for the preview. Returns a
// clone with header/footer text merged; everything else untouched.
export function mergePreviewSite(site, siteOverride) {
    if (!site || !siteOverride) return site;
    const next = clone(site);
    if (siteOverride.header) next.header = mergeLocaleContent(next.header, siteOverride.header);
    if (siteOverride.footer) next.footer = mergeLocaleContent(next.footer, siteOverride.footer);
    return next;
}

// Pre-merge a page with its page-locale override (+ the site override's page
// title) for the preview. Returns a clone with each block's content + seo +
// title merged.
export function mergePreviewPage(page, pageOverride, siteOverride) {
    if (!page) return page;
    const next = clone(page);
    if (pageOverride?.blocks && Array.isArray(next.blocks)) {
        next.blocks = next.blocks.map((b) => {
            const ov = pageOverride.blocks[b.id];
            return ov ? { ...b, content: mergeLocaleContent(b.content, ov.content || {}) } : b;
        });
    }
    if (pageOverride?.seo && next.seo) next.seo = mergeLocaleContent(next.seo, pageOverride.seo);
    const titleOv = siteOverride?.pageTitles?.[next.id];
    if (typeof titleOv === 'string' && titleOv.trim()) next.title = titleOv;
    return next;
}
