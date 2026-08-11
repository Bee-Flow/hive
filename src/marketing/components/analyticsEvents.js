/**
 * Automatic interaction tracking for published CMS sites.
 *
 * Without custom events a Umami site only knows pageviews, which makes goals,
 * funnels and journeys empty by construction. This adds the four interactions
 * every marketing site cares about, with zero per-site configuration:
 *
 *   cta_click     — a button / CTA / nav link inside the rendered site
 *   outbound_click— a link to another host
 *   file_download — a link to a document-ish file
 *   form_submit   — a form submission
 *
 * Consent: this deliberately does NOT read consent itself. It calls
 * `window.umami.track`, which only exists once the tracker script has loaded —
 * and the tracker is already gated on consent, per-page opt-out and the preview
 * bail. One gate, not two that can drift apart.
 *
 * Privacy rules (hard):
 *   - hrefs are stripped of query string and hash before being sent
 *   - input values are never read
 *   - labels are truncated, and come from visible text only
 *   - event NAMES are a fixed set, never derived from page content, so
 *     cardinality stays bounded
 *   - `umami.identify()` is never called
 */

const MAX_LABEL = 80;
const MAX_PATH = 300;

// Extensions we count as a download. Deliberately short — anything else is
// just an outbound or internal link.
const DOWNLOAD_EXT = /\.(pdf|docx?|xlsx?|pptx?|csv|zip|rar|7z|tar|gz|dmg|pkg|exe|mp3|mp4|wav|mov)$/i;

function track(name, data) {
    try {
        const fn = typeof window !== 'undefined' && window.umami && window.umami.track;
        if (typeof fn !== 'function') return;   // tracker absent → no consent → no-op
        window.umami.track(name, data);
    } catch { /* analytics must never break the page */ }
}

function clean(str, max = MAX_LABEL) {
    if (!str) return '';
    return String(str).replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Path only — query strings and fragments routinely carry personal data. */
export function safeHref(href) {
    if (!href) return '';
    try {
        const u = new URL(href, window.location.href);
        return `${u.origin}${u.pathname}`.slice(0, MAX_PATH);
    } catch {
        return String(href).split(/[?#]/)[0].slice(0, MAX_PATH);
    }
}

function isSameHost(href) {
    try {
        return new URL(href, window.location.href).host === window.location.host;
    } catch {
        return true;
    }
}

/** Visible label for an element, falling back through the usual a11y sources. */
function labelFor(el) {
    return clean(
        el.getAttribute?.('aria-label')
        || el.textContent
        || el.getAttribute?.('title')
        || el.getAttribute?.('alt')
        || '',
    );
}

/**
 * Which CMS block an element sits in. The renderer stamps `data-cms-block-id`
 * (already used by the admin preview's click-to-select) plus
 * `data-cms-block-type` on every block wrapper — that attribution is what makes
 * these events useful in funnels.
 */
function blockOf(el) {
    const holder = el.closest?.('[data-cms-block-id]');
    if (!holder) return {};
    const out = {};
    const id = holder.getAttribute('data-cms-block-id');
    const type = holder.getAttribute('data-cms-block-type');
    if (id) out.block = clean(id, 40);
    if (type) out.blockType = clean(type, 40);
    return out;
}

/**
 * Download / outbound handling for a real navigable href.
 * Returns true when it emitted an event and the click needs nothing further.
 */
function trackLink(href, label, block) {
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return false;
    const safe = safeHref(href);

    if (DOWNLOAD_EXT.test(safe)) {
        const ext = (safe.match(DOWNLOAD_EXT)?.[1] || '').toLowerCase();
        track('file_download', { href: safe, ext, label, ...block });
        return true;
    }
    if (!isSameHost(href)) {
        let host = '';
        try { host = new URL(href, window.location.href).host; } catch { /* ignore */ }
        track('outbound_click', { href: safe, host, label, ...block });
        return true;
    }
    return false;
}

function onClick(e) {
    const el = e.target?.closest?.('a[href], button, [role="button"]');
    if (!el) return;

    const href = el.tagName === 'A' ? el.getAttribute('href') : null;
    const label = labelFor(el);
    const block = blockOf(el);

    if (trackLink(href, label, block)) return;

    // Buttons and internal links inside a block are the site's calls to action.
    // A bare internal link with no block context is ordinary navigation and is
    // already captured as a pageview, so it is not worth an event.
    const isButton = el.tagName === 'BUTTON' || el.getAttribute('role') === 'button';
    if (!label || (!isButton && !block.block)) return;
    track('cta_click', { label, href: href ? safeHref(href) : undefined, ...block });
}

function onSubmit(e) {
    const form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    // Identify the form, never its contents.
    const name = clean(form.getAttribute('name') || form.getAttribute('id') || form.getAttribute('aria-label') || 'form', 40);
    track('form_submit', { form: name, ...blockOf(form) });
}

/**
 * Attach the delegated listeners. Returns a cleanup function.
 * Capture phase so a handler calling stopPropagation doesn't hide the event.
 */
export function startAnalyticsEvents() {
    if (typeof document === 'undefined') return () => {};
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('submit', onSubmit, true);
    };
}

// Exported for tests.
export const _internal = { onClick, onSubmit, labelFor, DOWNLOAD_EXT };
