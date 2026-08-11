import { useEffect } from 'react';

// Client-side <head> manager for the public CMS site.
//
// The admin has always offered per-page SEO fields (metaTitle,
// metaDescription, ogImage, noIndex — even translatable), and the Design
// editor a favicon upload, but nothing ever rendered them: the SPA fallback
// serves a static index.html and no component touched document.head. This
// hook closes that gap for JS-rendering visitors (and crawlers that execute
// JS). Known limitation, documented on purpose: non-JS crawlers still see
// the static head — a server-side head injection can come later.
//
// All injected tags are stamped with data-cms-head="1" and reconciled on
// every page change; empty values remove their tag. Never active in the
// editor preview (the iframe should keep its neutral title).

function upsertMeta(attrName, attrValue, content) {
    const selector = `meta[${attrName}="${attrValue}"][data-cms-head]`;
    let el = document.head.querySelector(selector);
    if (!content) {
        if (el) el.remove();
        return;
    }
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrValue);
        el.setAttribute('data-cms-head', '1');
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
}

function upsertIcon(href) {
    let el = document.head.querySelector('link[rel="icon"][data-cms-head]');
    if (!href) {
        if (el) el.remove();
        return;
    }
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', 'icon');
        el.setAttribute('data-cms-head', '1');
        // Appended LAST so it wins over the app's static favicon link.
        document.head.appendChild(el);
    }
    el.setAttribute('href', href);
}

function toAbsolute(url) {
    try { return new URL(url, window.location.origin).href; } catch { return url; }
}

/**
 * @param {object} opts
 * @param {boolean} opts.enabled     false in editor preview — hook is a no-op
 * @param {string}  [opts.pageTitle] the page's title (fallback for metaTitle)
 * @param {object}  [opts.seo]       { metaTitle, metaDescription, ogImage, noIndex }
 * @param {string}  [opts.favicon]   design.favicon (cms/… asset key or URL)
 * @param {(u: string) => string} opts.resolveAssetUrl  cms/… → /api/cms/asset/… resolver
 */
export default function useCmsHead({ enabled, pageTitle, seo, favicon, resolveAssetUrl }) {
    const metaTitle = seo?.metaTitle || '';
    const metaDescription = seo?.metaDescription || '';
    const ogImage = seo?.ogImage || '';
    const noIndex = !!seo?.noIndex;

    useEffect(() => {
        if (!enabled || typeof document === 'undefined') return;
        const title = metaTitle || pageTitle;
        if (title) document.title = title;
        upsertMeta('name', 'description', metaDescription);
        upsertMeta('property', 'og:title', title || '');
        upsertMeta('property', 'og:description', metaDescription);
        upsertMeta('property', 'og:image', ogImage ? toAbsolute(resolveAssetUrl(ogImage)) : '');
        upsertMeta('name', 'robots', noIndex ? 'noindex' : '');
        upsertIcon(favicon ? resolveAssetUrl(favicon) : '');
    }, [enabled, pageTitle, metaTitle, metaDescription, ogImage, noIndex, favicon, resolveAssetUrl]);
}
