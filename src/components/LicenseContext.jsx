import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import { useTranslation } from '../hooks/useTranslation';

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
    // serverOverride: true when a super-admin has applied a server-wide
    // licence. Per-org activation UI uses this to switch into a read-only
    // banner ("Tier is managed server-wide"). See server/license/index.js
    // → getLicenseStatus.
    serverOverride: false,
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
                const r = await fetch(`${API_BASE}/auth/setup-status`, { signal: ac.signal });
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

    useEffect(() => { reload(); }, [reload]);

    const features = state.features;
    const tier = state.tier;
    const hasFeature = useCallback(
        (name) => Array.isArray(features) && features.includes(name),
        [features],
    );
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
        reload,
        activate,
        deactivate,
        refresh,
    }), [state, hasFeature, hasTier, reload, activate, deactivate, refresh]);

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
export function RequireTier({ tier = 'enterprise', feature = null, children, fallback = null, onNavigateToLicense = null }) {
    const ctx = useLicenseContext();
    const { t } = useTranslation();
    const upgradeUrl = ctx.upgradeUrl || 'https://beeflow.nl/pricing';
    if (ctx.loading) return null;

    const ok = feature ? ctx.hasFeature(feature) : ctx.hasTier(tier);
    if (ok) return <>{children}</>;
    if (fallback) return fallback;

    return (
        <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-blue-500" />
            </div>
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-1">
                {t('license.feature_locked', 'Requires {tier} license').replace('{tier}', tier)}
            </h2>
            <p className="text-sm text-[var(--text-muted)] max-w-md mb-4">
                {t('license.community_explainer', 'You can activate Enterprise or a custom plan with a license key purchased at beeflow.nl. Activation unlocks compliance features such as SSO, audit log export, GDPR/AI Act hubs, and admin controls.')}
            </p>
            <div className="flex items-center gap-2">
                {onNavigateToLicense && (
                    <button
                        onClick={onNavigateToLicense}
                        className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600"
                    >
                        {t('license.enter_key', 'Enter license key')}
                    </button>
                )}
                <a
                    href={upgradeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-lg text-xs font-semibold border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                >
                    {t('license.upgrade_at_beeflow', 'Upgrade at beeflow.nl')}
                </a>
            </div>
        </div>
    );
}

/**
 * <LockedIfBelow tier="enterprise">{({ locked, requiredTier }) => (...)}</LockedIfBelow>
 * Render-prop helper for lightweight inline gating (lock icons, tooltips).
 */
export function LockedIfBelow({ tier = 'enterprise', feature = null, children }) {
    const ctx = useLicenseContext();
    const ok = feature ? ctx.hasFeature(feature) : ctx.hasTier(tier);
    return children({ locked: !ok, requiredTier: tier, currentTier: ctx.tier, ctx });
}

export default LicenseContext;
