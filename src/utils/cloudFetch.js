import { authFetch } from './helpers';

/**
 * Wrapper around authFetch for endpoints the SaaS only mounts in cloud mode
 * (anything behind `requireCloud` on the server — stripe, subscriptions).
 *
 * In self-hosted / Nextcloud-bundled deployments those routes return 404 by
 * design. Calling them anyway turns the browser console into a noise floor
 * of red errors. This helper short-circuits to a sentinel "no response"
 * object so callers can use the same `if (!res?.ok) return` pattern they
 * already use elsewhere — no new branch shape to learn.
 *
 * Pattern (new callers should reach for this by name when adding any
 * stripe/subscription/payment endpoint):
 *
 *   const { deploymentMode } = useLicenseContext();
 *   const res = await cloudFetch(deploymentMode, `${API_BASE}/api/stripe/status`);
 *   if (!res?.ok) return;   // covers both self-hosted skip AND real failures
 *   const data = await res.json();
 */
export async function cloudFetch(deploymentMode, ...args) {
    if (deploymentMode !== 'cloud') {
        return { ok: false, status: 0, skipped: true, json: async () => null, text: async () => '' };
    }
    return authFetch(...args);
}
