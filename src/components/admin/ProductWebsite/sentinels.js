// Virtual page-list entries — non-page ids that select an editor surface
// instead of a PageDoc. The legacy '__site__' id (one combined "Site chrome"
// entry) is kept as an alias for the header entry so nothing that still
// writes it (older handlers, tests) breaks.

export const SITE_VIRTUAL_ID      = '__site__';   // legacy alias → header
export const HEADER_VIRTUAL_ID    = '__header__';
export const FOOTER_VIRTUAL_ID    = '__footer__';
export const COOKIE_VIRTUAL_ID    = '__cookie__';
// IS a chrome id — the announcement bar renders above the header on every
// page, so selecting it must switch the preview into previewMode='chrome'
// (header + bar stay visible, the page body becomes the placeholder).
export const ANNOUNCE_VIRTUAL_ID  = '__announce__';
export const DESIGN_VIRTUAL_ID    = '__design__';
// NOT a chrome id — selecting it must not switch the preview into
// previewMode='chrome' (analytics has nothing to show in isolation; the
// preview keeps rendering the fallback page like the Design entry does).
export const ANALYTICS_VIRTUAL_ID = '__analytics__';

const CHROME_IDS = new Set([
    SITE_VIRTUAL_ID, HEADER_VIRTUAL_ID, FOOTER_VIRTUAL_ID,
    COOKIE_VIRTUAL_ID, ANNOUNCE_VIRTUAL_ID,
]);
const VIRTUAL_IDS = new Set([...CHROME_IDS, DESIGN_VIRTUAL_ID, ANALYTICS_VIRTUAL_ID]);

/** True for any virtual entry (chrome or design) — i.e. NOT a real page id. */
export function isVirtualPageId(id) {
    return VIRTUAL_IDS.has(id);
}

/** True for the chrome entries (header / footer / cookie banner / announcement bar, incl. the legacy alias). */
export function isChromeEntryId(id) {
    return CHROME_IDS.has(id);
}

/** Resolve the legacy '__site__' alias to the header entry; pass everything else through. */
export function normalizeVirtualId(id) {
    return id === SITE_VIRTUAL_ID ? HEADER_VIRTUAL_ID : id;
}
