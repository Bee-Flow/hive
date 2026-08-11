/**
 * Carry a `?plan=<id>` deep link across the login boundary.
 *
 * The pricing page links to `/app/billing?plan=<id>`, but a logged-out visitor
 * is bounced to the sign-in card first and the query string is lost on the way.
 * Previously `?plan=` was read nowhere at all, so every pricing CTA silently
 * dropped the plan the visitor had just chosen and dumped them on a generic
 * page — the single most expensive gap in the funnel.
 *
 * sessionStorage rather than localStorage: the intent belongs to this browsing
 * session. A plan chosen last week should not resurface.
 */

const KEY = 'beeflow.pendingPlanId';

/**
 * Read `?plan=` off the current URL and remember it, then strip it from the
 * address bar so a refresh or a copied link doesn't re-trigger the intent.
 * Safe to call on every boot.
 *
 * @returns {string|null} the captured plan id, if any
 */
export function capturePendingPlanFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search);
        const plan = params.get('plan');
        if (!plan) return readPendingPlan();

        sessionStorage.setItem(KEY, plan);
        params.delete('plan');
        const qs = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
        return plan;
    } catch {
        // Private-browsing modes can throw on sessionStorage; a lost
        // preselection is not worth breaking the page over.
        return null;
    }
}

/** The remembered plan id, or null. */
export function readPendingPlan() {
    try { return sessionStorage.getItem(KEY) || null; } catch { return null; }
}

/**
 * Consume the remembered plan — returns it and clears it, so a preselection is
 * applied exactly once and doesn't re-fire when the user navigates back.
 */
export function takePendingPlan() {
    const plan = readPendingPlan();
    if (plan) clearPendingPlan();
    return plan;
}

export function clearPendingPlan() {
    try { sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
