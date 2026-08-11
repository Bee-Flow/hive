// Stripe Checkout return-flow helpers for the marketplace tab.
//
// Buy sends the hub a success/cancel URL pointing back at the current admin
// modules page (`?tab=marketplace&purchase=success|cancel&module=<id>`); on
// mount the tab parses those params, reacts, and strips them from the URL so
// a reload doesn't replay the flash. Pure functions so the parse/strip logic
// is unit-testable without mounting the component.

/**
 * Build the Checkout return URLs for a module purchase from the current
 * location (no hardcoded route — works behind any base path).
 * @param {string} moduleId
 * @param {{ origin: string, pathname: string }} loc defaults to window.location
 * @returns {{ successUrl: string, cancelUrl: string }}
 */
export function buildPurchaseReturnUrls(moduleId, loc = window.location) {
    const mk = (result) => {
        const params = new URLSearchParams({ tab: 'marketplace', purchase: result, module: moduleId });
        return `${loc.origin}${loc.pathname}?${params.toString()}`;
    };
    return { successUrl: mk('success'), cancelUrl: mk('cancel') };
}

/**
 * Parse a Checkout return from a query string. Returns null when the URL is
 * not a purchase return (no/unknown `purchase` param).
 * @param {string} search e.g. "?tab=marketplace&purchase=success&module=pro"
 * @returns {{ result: 'success' | 'cancel', moduleId: string | null } | null}
 */
export function parsePurchaseReturn(search) {
    const params = new URLSearchParams(search || '');
    const result = params.get('purchase');
    if (result !== 'success' && result !== 'cancel') return null;
    return { result, moduleId: params.get('module') || null };
}

/**
 * Relative URL with the `purchase` / `module` params removed (other params —
 * notably `tab` — are kept). Feed to history.replaceState after handling.
 * @param {{ pathname: string, search: string, hash?: string }} loc defaults to window.location
 * @returns {string}
 */
export function stripPurchaseReturnParams(loc = window.location) {
    const params = new URLSearchParams(loc.search || '');
    params.delete('purchase');
    params.delete('module');
    const qs = params.toString();
    return `${loc.pathname}${qs ? `?${qs}` : ''}${loc.hash || ''}`;
}
