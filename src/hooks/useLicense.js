import { useCallback, useEffect, useState } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';

/**
 * useLicense — read & mutate the active license for the current scope.
 *
 * Returns:
 *   tier              — 'community' | 'pro' | 'enterprise' | 'full'
 *   features          — string[] features unlocked by the tier
 *   limits            — numeric limits (max_users, max_agents, ...)
 *   license           — full license row (or null when default community)
 *   source            — 'license_key' | 'default'
 *   loading, error
 *   activate(token)   — submit a license JWT
 *   deactivate()      — drop the active license
 *   refresh()         — force a refresh-ping (admin-only on the server)
 *   reload()          — re-fetch /api/license/status
 *
 * The hook is intentionally small — it does not push tier into a global
 * context. Wrap it in a context if you want app-wide gating.
 */
export default function useLicense() {
    const [status, setStatus] = useState({
        tier: 'community',
        source: 'default',
        scope: null,
        license: null,
        features: [],
        limits: {},
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const r = await authFetch(`${API_BASE}/api/license/status`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            setStatus(data);
        } catch (e) {
            setError(e.message || 'Failed to load license');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { reload(); }, [reload]);

    const activate = useCallback(async (token) => {
        const r = await authFetch(`${API_BASE}/api/license/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
            const err = new Error(data.error || `HTTP ${r.status}`);
            err.code = data.code;
            throw err;
        }
        if (data.status) setStatus(data.status);
        else await reload();
        return data;
    }, [reload]);

    const deactivate = useCallback(async () => {
        const r = await authFetch(`${API_BASE}/api/license/deactivate`, { method: 'DELETE' });
        if (!r.ok && r.status !== 404) {
            const data = await r.json().catch(() => ({}));
            throw new Error(data.error || `HTTP ${r.status}`);
        }
        await reload();
    }, [reload]);

    const refresh = useCallback(async () => {
        const r = await authFetch(`${API_BASE}/api/license/refresh`, { method: 'POST' });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        await reload();
        return data;
    }, [reload]);

    const hasFeature = useCallback((name) => {
        return Array.isArray(status.features) && status.features.includes(name);
    }, [status]);

    const TIER_RANK = { community: 0, pro: 1, enterprise: 2, full: 3 };
    const hasTier = useCallback((required) => {
        return (TIER_RANK[status.tier] ?? -1) >= (TIER_RANK[required] ?? 99);
    }, [status]);

    return {
        ...status,
        loading,
        error,
        reload,
        activate,
        deactivate,
        refresh,
        hasFeature,
        hasTier,
    };
}
