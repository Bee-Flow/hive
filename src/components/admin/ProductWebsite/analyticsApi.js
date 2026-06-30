/**
 * Website-analytics admin API. All routes are super-admin gated server-side
 * and proxy a self-hosted Umami instance — the browser never holds Umami
 * credentials. Mirrors the cmsApi.js URL-builder style.
 */
import { API_BASE } from '../../../utils/helpers';

const root = `${API_BASE}/api/cms/admin/analytics`;

export const analyticsApi = {
    settings: () => `${root}/settings`,
    sites:    () => `${root}/sites`,
    overview: ({ siteId, range, timezone } = {}) => {
        const p = new URLSearchParams();
        if (siteId) p.set('siteId', siteId);
        if (range) p.set('range', range);
        if (timezone) p.set('timezone', timezone);
        const qs = p.toString();
        return `${root}/overview${qs ? `?${qs}` : ''}`;
    },
};

// Thin fetch wrapper — always send the session cookie, parse JSON, throw on
// non-2xx so callers can surface a message.
export async function analyticsFetch(url, opts = {}) {
    const res = await fetch(url, { credentials: 'include', ...opts });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
    if (!res.ok) {
        throw new Error(json?.error || `Request failed (${res.status})`);
    }
    return json;
}
