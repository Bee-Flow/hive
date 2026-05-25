/**
 * SubscriptionContext — single source of truth for the org's current
 * Stripe subscription, used by the App shell to gate access when no
 * active plan is in place.
 *
 * `hasActiveSub` is the gate signal:
 *   - true  → org has status `active` or `trialing`
 *   - false → no subscription, expired, suspended, cancelled → app
 *             shell should redirect non-admin users to the License page.
 *
 * The fetch is best-effort and tolerant: 404s/network errors leave the
 * state at "no subscription" which is the safe default for the gate.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE } from '../utils/helpers';
import { cloudFetch } from '../utils/cloudFetch';

const SubscriptionContext = createContext({
    sub: null,
    loading: true,
    hasActiveSub: false,
    refresh: () => {},
});

export function SubscriptionProvider({ children, user }) {
    const [sub, setSub] = useState(null);
    const [loading, setLoading] = useState(true);
    const [version, setVersion] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const orgId = user?.organizationId || user?.orgId;
        // Consumer accounts (no org) and the platform-operator user fall
        // through with no subscription state — the gate ignores them.
        if (!orgId) { setSub(null); setLoading(false); return; }
        setLoading(true);
        const deploymentMode = user?.featureFlags?.deploymentMode || 'cloud';
        cloudFetch(deploymentMode, `${API_BASE}/api/subscriptions/orgs/${orgId}`)
            .then(r => (r?.ok ? r.json() : null))
            .then(data => { if (!cancelled) setSub(data || null); })
            .catch(() => { if (!cancelled) setSub(null); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [user?.organizationId, user?.orgId, user?.featureFlags?.deploymentMode, version]);

    const hasActiveSub = !!sub && ['active', 'trialing'].includes(sub.status);
    const value = { sub, loading, hasActiveSub, refresh: () => setVersion(v => v + 1) };

    return (
        <SubscriptionContext.Provider value={value}>
            {children}
        </SubscriptionContext.Provider>
    );
}

export function useSubscriptionContext() {
    return useContext(SubscriptionContext);
}

export default SubscriptionContext;
