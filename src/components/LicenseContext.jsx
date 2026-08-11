import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';
import { useEntitlements } from './EntitlementsContext';
import UpgradePrompt from './billing/UpgradePrompt';

/**
 * LicenseContext — app-wide tier/feature awareness.
 *
 * Wrap the authenticated portion of the app with <LicenseProvider> so any
 * component can call useLicenseContext() without re-fetching status.
 *
 * The provider polls /api/license/status once on mount and exposes
 * reload/activate/deactivate/refresh. There used to be a separate
 * useLicense() hook that fired a second status request and held its own
 * copy of state — those two copies could drift on activation. The hook is
 * gone; the provider is the single source of truth.
 */

// MUST stay in sync with server/license/tiers.js → TIER_HIERARCHY.
// The repo's two Docker containers (agent-hub, server) each see only their
// own sub-tree, so a shared module isn't reachable at build time. The CI
// smoke test in Phase 12 asserts the two arrays stay in lock-step.
//
// Legacy `pro` tier values (from old license keys or Stripe rows minted
// before the Pro tier was retired) are normalised to `enterprise` via
// LEGACY_TIER_ALIAS — same contract as the server side.
export const TIER_HIERARCHY = ['community', 'enterprise', 'full'];
export const LEGACY_TIER_ALIAS = { pro: 'enterprise' };
export const TIER_RANK = Object.fromEntries(TIER_HIERARCHY.map((t, i) => [t, i]));

function normalizeTier(tier) {
    if (typeof tier !== 'string') return tier;
    return LEGACY_TIER_ALIAS[tier] || tier;
}

const LicenseContext = createContext({
    tier: 'community',
    source: 'default',
    scope: null,
    license: null,
    subscription: null,
    features: [],
    limits: {},
    // serverOverride: true when a server-wide licence is GOVERNING this
    // install (self-hosted). Per-org activation UI uses it to
    // switch into a read-only banner ("Tier is managed server-wide"). It is
    // false on cloud even when a server licence exists. See
    // server/license/index.js → getLicenseStatus / serverLicenseGovernsOrgs.
    serverOverride: false,
    // serverLicense: the server-wide licence row (public shape) when one
    // exists, regardless of deployment mode — admin Server-licence panel uses
    // it to display/manage the licence even on cloud (where it doesn't govern).
    serverLicense: null,
    upgradeUrl: 'https://beeflow.nl/pricing',
    // 'cloud' (Bee Flow SaaS) or 'self-hosted' (customer-run install). Drives
    // which paid-access mechanism is shown: subscriptions on cloud, license
    // keys on self-hosted. Sourced from /auth/setup-status (server env
    // DEPLOYMENT_MODE). Defaults to 'cloud' until setup-status resolves.
    deploymentMode: 'cloud',
    loading: true,
    error: null,
    hasFeature: () => false,
    hasTier: () => false,
    reload: async () => {},
    activate: async () => {},
    deactivate: async () => {},
    refresh: async () => {},
});

export function LicenseProvider({ children }) {
    const [state, setState] = useState({
        tier: 'community',
        source: 'default',
        scope: null,
        license: null,
        subscription: null,
        features: [],
        limits: {},
        serverOverride: false,
        serverLicense: null,
        loading: true,
        error: null,
        upgradeUrl: 'https://beeflow.nl/pricing',
        deploymentMode: 'cloud',
    });
    // Must SET the ref to true on every mount, not just rely on useRef's
    // initial value. React StrictMode's mount → cleanup → remount cycle
    // otherwise leaves the ref stuck at false (cleanup ran, nothing re-set
    // it), silently swallowing every async setState — including the one
    // that flips `loading` to false. Symptom: RequireTier returns null
    // forever → blank pages behind any tier gate. Mirrors ThemeContext.
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const reload = useCallback(async () => {
        try {
            const r = await authFetch(`${API_BASE}/api/license/status`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            if (!mountedRef.current) return;
            // Older deployments may still respond with `tier: 'pro'` from
            // legacy license rows; normalise so paywall UI matches the
            // current hierarchy.
            const normalised = { ...data, tier: normalizeTier(data.tier) };
            if (data.license && typeof data.license === 'object') {
                normalised.license = { ...data.license, tier: normalizeTier(data.license.tier) };
            }
            if (data.subscription && typeof data.subscription === 'object') {
                normalised.subscription = { ...data.subscription, tier: normalizeTier(data.subscription.tier) };
            }
            setState(s => ({ ...s, ...normalised, loading: false, error: null }));
        } catch (e) {
            if (!mountedRef.current) return;
            console.warn('[LicenseProvider] reload failed', e);
            setState(s => ({ ...s, loading: false, error: e.message || 'license fetch failed' }));
        }
    }, []);

    const activate = useCallback(async (token) => {
        const r = await authFetch(`${API_BASE}/api/license/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });
        let data = {};
        try { data = await r.json(); } catch (e) { console.warn('[LicenseProvider] activate response not JSON', e); }
        if (!r.ok) {
            const err = new Error(data.error || `HTTP ${r.status}`);
            err.code = data.code;
            throw err;
        }
        if (data.status && mountedRef.current) {
            setState(s => ({ ...s, ...data.status, loading: false, error: null }));
        }
        await reload();
        return data;
    }, [reload]);

    const deactivate = useCallback(async () => {
        const r = await authFetch(`${API_BASE}/api/license/deactivate`, { method: 'DELETE' });
        if (!r.ok && r.status !== 404) {
            let data = {};
            try { data = await r.json(); } catch (e) { console.warn('[LicenseProvider] deactivate response not JSON', e); }
            throw new Error(data.error || `HTTP ${r.status}`);
        }
        await reload();
    }, [reload]);

    const refresh = useCallback(async () => {
        const r = await authFetch(`${API_BASE}/api/license/refresh`, { method: 'POST' });
        let data = {};
        try { data = await r.json(); } catch (e) { console.warn('[LicenseProvider] refresh response not JSON', e); }
        if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
        await reload();
        return data;
    }, [reload]);

    // Pull the (self-host-overridable) upgrade URL from /auth/setup-status
    // once at mount. Falls back to the public BeeFlow pricing page if the
    // server doesn't surface a URL (e.g. older API versions).
    useEffect(() => {
        const ac = new AbortController();
        (async () => {
            try {
                // authFetch, not bare fetch: it is the single choke point every
                // other call in this file already goes through, and the public
                // feature demos rely on that being true without exception —
                // one raw fetch here is a real network call from an anonymous
                // demo page. (authFetch skips its 401-reload for /auth/ paths,
                // so the login-flow behaviour is unchanged.)
                const r = await authFetch(`${API_BASE}/auth/setup-status`, { signal: ac.signal });
                if (!r.ok) return;
                const data = await r.json();
                if (ac.signal.aborted) return;
                const patch = {};
                if (data?.licenseUpgradeUrl) patch.upgradeUrl = data.licenseUpgradeUrl;
                if (data?.deploymentMode === 'cloud' || data?.deploymentMode === 'self-hosted') {
                    patch.deploymentMode = data.deploymentMode;
                }
                if (Object.keys(patch).length > 0) setState(s => ({ ...s, ...patch }));
            } catch (e) {
                if (e.name === 'AbortError') return;
                console.warn('[LicenseProvider] setup-status fetch failed', e);
            }
        })();
        return () => { ac.abort(); };
    }, []);

    // Fetch licence status on mount AND re-fetch whenever auth flips. This
    // provider is mounted above the auth boundary, so its first fetch runs
    // pre-login (anonymous → community/default snapshot). App dispatches
    // `beeflow:auth-changed` on login/logout/bootstrap; without re-resolving
    // here, the pre-login tier/features/limits would persist after login and
    // every tier- or licence-gated surface would stay stale until a full page
    // refresh. Mirrors EntitlementsContext, which delegates `hasFeature` here.
    useEffect(() => {
        reload();
        const onAuthChanged = () => reload();
        window.addEventListener('beeflow:auth-changed', onAuthChanged);
        return () => window.removeEventListener('beeflow:auth-changed', onAuthChanged);
    }, [reload]);

    const tier = state.tier;
    // Feature gating delegates to the unified entitlements snapshot — the SAME
    // resolver the server's requireCapability enforces — so a page can never
    // render while its API 403s. `ent.can` accepts capability ids AND legacy
    // licence-feature names (see EntitlementsContext). The `state.features`
    // array from /api/license/status is still fetched for licence-management
    // display, but no longer drives gating. `hasTier` stays on the licence tier
    // (a licence-management concern, not a per-capability grant).
    const ent = useEntitlements();
    const entCan = ent.can;
    const hasFeature = useCallback((name) => entCan(name), [entCan]);
    const hasTier = useCallback(
        (required) => {
            const a = TIER_RANK[normalizeTier(tier)] ?? -1;
            const b = TIER_RANK[normalizeTier(required)] ?? 99;
            return a >= b;
        },
        [tier],
    );

    const value = useMemo(() => ({
        ...state,
        hasFeature,
        hasTier,
        // Surface entitlements load/degraded/error so feature gates can avoid a
        // render-then-flip while the snapshot resolves, and fail OPEN on a
        // transient resolver outage (the server gate stays authoritative).
        entLoading: ent.loading,
        entDegraded: ent.degraded,
        entError: ent.error,
        reload,
        activate,
        deactivate,
        refresh,
    }), [state, hasFeature, hasTier, ent.loading, ent.degraded, ent.error, reload, activate, deactivate, refresh]);

    return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicenseContext() {
    return useContext(LicenseContext);
}

/**
 * <RequireTier tier="enterprise">...</RequireTier> — render children only when
 * the active tier is at least the given level. Otherwise render an upgrade
 * panel.
 *
 * Use sparingly — for hard route gating. Most UI elements should soft-gate
 * via lock icons (see <LockedIfBelow />).
 */
export function RequireTier({
    tier = 'enterprise', feature = null, children, fallback = null,
    onNavigateToLicense = null, onNavigateToBilling = null,
}) {
    const ctx = useLicenseContext();
    const upgradeUrl = ctx.upgradeUrl || 'https://beeflow.nl/pricing';
    // Wait for the licence status and, for a feature gate, the entitlements
    // snapshot before deciding — prevents a flash of the upgrade panel.
    if (ctx.loading || (feature && ctx.entLoading)) return null;

    // Feature gates fail OPEN on a transient resolver outage (degraded / fetch
    // error): render the page and let the server gate enforce, rather than show
    // a false "upgrade" wall during a backend blip. Tier gates are unaffected.
    const entUnavailable = !!(ctx.entDegraded || ctx.entError);
    const ok = feature ? (entUnavailable || ctx.hasFeature(feature)) : ctx.hasTier(tier);
    if (ok) return <>{children}</>;
    if (fallback) return fallback;

    return (
        <UpgradePrompt
            requiredTier={tier}
            feature={feature}
            deploymentMode={ctx.deploymentMode}
            upgradeUrl={upgradeUrl}
            onNavigateToBilling={onNavigateToBilling}
            onNavigateToLicense={onNavigateToLicense}
        />
    );
}

/**
 * <LockedIfBelow tier="enterprise">{({ locked, requiredTier }) => (...)}</LockedIfBelow>
 * Render-prop helper for lightweight inline gating (lock icons, tooltips).
 */
export function LockedIfBelow({ tier = 'enterprise', feature = null, children }) {
    const ctx = useLicenseContext();
    // Don't flash a lock while the snapshot is still loading, and don't show a
    // false lock during a transient resolver outage — fail open (server gate
    // remains authoritative).
    const entUnavailable = !!(ctx.entLoading || ctx.entDegraded || ctx.entError);
    const ok = feature ? (entUnavailable || ctx.hasFeature(feature)) : ctx.hasTier(tier);
    return children({ locked: !ok, requiredTier: tier, currentTier: ctx.tier, ctx });
}

export default LicenseContext;
