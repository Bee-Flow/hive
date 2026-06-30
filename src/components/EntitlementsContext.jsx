import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';

/**
 * EntitlementsContext — the single client-side source for "what can this user
 * use". Fetches GET /auth/my-entitlements (the unified resolver snapshot) and
 * exposes a flat `can(id)` plus the kind-keyed `effective`/`ceiling` sets and
 * the deployment mode. Supersedes the data sources of LicenseContext +
 * SubscriptionContext + FeatureGate; those remain as thin consumers during the
 * cut-over. Authoritative gating stays server-side — this is display-only.
 */

const TIER_RANK = { community: 0, enterprise: 1, full: 2 };
const LEGACY_TIER_ALIAS = { pro: 'enterprise' };
const normalizeTier = (t) => LEGACY_TIER_ALIAS[t] || t || 'community';

// MCP servers are integrations now — no separate `mcp` bucket.
const EMPTY = { core: [], beta: [], integration: [] };

const EntitlementsContext = createContext({
    loading: true,
    degraded: false,
    tier: 'community',
    mode: 'cloud',
    effective: EMPTY,
    ceiling: EMPTY,
    can: () => false,
    inCeiling: () => false,
    lockReason: () => null,
    hasTier: () => false,
    reload: () => {},
});

export function EntitlementsProvider({ children }) {
    const [state, setState] = useState({
        loading: true,
        degraded: false,
        tier: 'community',
        mode: 'cloud',
        superAdmin: false,
        effective: EMPTY,
        ceiling: EMPTY,
        reasons: {},
        registry: [],
        error: null,
    });

    const reload = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/auth/my-entitlements`);
            if (!res.ok) { setState(s => ({ ...s, loading: false, error: `HTTP ${res.status}` })); return; }
            const j = await res.json();
            setState({
                loading: false,
                degraded: !!j.degraded,
                tier: normalizeTier(j.tier),
                mode: j.mode === 'self-hosted' ? 'self-hosted' : 'cloud',
                superAdmin: !!j.superAdmin,
                effective: j.effective || EMPTY,
                ceiling: j.ceiling || EMPTY,
                reasons: j.reasons || {},
                registry: Array.isArray(j.registry) ? j.registry : [],
                error: null,
            });
        } catch (e) {
            setState(s => ({ ...s, loading: false, error: e.message }));
        }
    }, []);

    // Fetch on mount, and REFETCH whenever auth state flips. This provider is
    // mounted above the auth boundary (so LicenseContext.hasFeature can delegate
    // to it), so its first fetch can run pre-login (401 → empty effective). App
    // dispatches `beeflow:auth-changed` on login/logout/bootstrap so we re-resolve
    // with the real session — otherwise the empty pre-login snapshot would persist
    // and hide every capability-gated surface after login.
    useEffect(() => {
        reload();
        const onAuthChanged = () => reload();
        window.addEventListener('beeflow:auth-changed', onAuthChanged);
        return () => window.removeEventListener('beeflow:auth-changed', onAuthChanged);
    }, [reload]);

    const value = useMemo(() => {
        // Defensive: fold any legacy `mcp` bucket (older backend payload) into
        // integration so frontend/backend deploy order can't break gating.
        const effSets = {
            core: new Set(state.effective.core || []),
            beta: new Set(state.effective.beta || []),
            integration: new Set([...(state.effective.integration || []), ...(state.effective.mcp || [])]),
        };
        const ceilSets = {
            core: new Set(state.ceiling.core || []),
            beta: new Set(state.ceiling.beta || []),
            integration: new Set([...(state.ceiling.integration || []), ...(state.ceiling.mcp || [])]),
        };
        // Accept either a capability id OR a legacy licence-feature name: map
        // licence-feature → capability id (e.g. 'ticket_assistant' →
        // 'itil_ticket_assistant') so every hasFeature('X')/can('X') call site
        // resolves to the same effective set the server's requireCapability uses,
        // regardless of which namespace the caller passes.
        const featureToCapId = {};
        for (const c of (state.registry || [])) {
            if (!c || !c.id) continue;
            featureToCapId[c.id] = c.id;
            if (c.licenseFeature && !(c.licenseFeature in featureToCapId)) featureToCapId[c.licenseFeature] = c.id;
        }
        const resolveId = (id) => featureToCapId[id] || id;
        const has = (set, id) => { const cid = resolveId(id); return set.core.has(cid) || set.beta.has(cid) || set.integration.has(cid); };
        return {
            loading: state.loading,
            degraded: !!state.degraded,
            tier: state.tier,
            mode: state.mode,
            superAdmin: state.superAdmin,
            effective: state.effective,
            ceiling: state.ceiling,
            registry: state.registry,
            error: state.error,
            can: (id) => has(effSets, id),
            inCeiling: (id) => has(ceilSets, id),
            lockReason: (id) => (has(effSets, id) ? null : (has(ceilSets, id) ? 'not_granted' : (state.reasons[resolveId(id)] || 'ceiling'))),
            hasTier: (req) => (TIER_RANK[state.tier] ?? -1) >= (TIER_RANK[normalizeTier(req)] ?? 99),
            reload,
        };
    }, [state, reload]);

    return <EntitlementsContext.Provider value={value}>{children}</EntitlementsContext.Provider>;
}

export function useEntitlements() {
    return useContext(EntitlementsContext);
}

export default EntitlementsContext;
