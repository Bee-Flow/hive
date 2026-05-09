import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import { useTranslation } from '../hooks/useTranslation';

/**
 * LicenseContext — app-wide tier/feature awareness.
 *
 * Wrap the authenticated portion of the app with <LicenseProvider> so any
 * component can call useLicenseContext() without re-fetching status.
 *
 * The provider polls /api/license/status once on mount and exposes a
 * `reload()` function. Activation flows in OrgInfoPanel call the same
 * endpoint via useLicense() — call ctx.reload() afterwards if you need
 * the rest of the app to react instantly.
 */

const TIER_RANK = { community: 0, pro: 1, enterprise: 2, full: 3 };

const LicenseContext = createContext({
    tier: 'community',
    source: 'default',
    license: null,
    features: [],
    limits: {},
    loading: true,
    error: null,
    hasFeature: () => false,
    hasTier: () => false,
    reload: async () => {},
});

export function LicenseProvider({ children }) {
    const [state, setState] = useState({
        tier: 'community',
        source: 'default',
        license: null,
        features: [],
        limits: {},
        loading: true,
        error: null,
    });

    const reload = async () => {
        try {
            const r = await authFetch(`${API_BASE}/api/license/status`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const data = await r.json();
            setState(s => ({ ...s, ...data, loading: false, error: null }));
        } catch (e) {
            setState(s => ({ ...s, loading: false, error: e.message || 'license fetch failed' }));
        }
    };

    useEffect(() => { reload(); }, []);

    const value = useMemo(() => ({
        ...state,
        hasFeature: (name) => Array.isArray(state.features) && state.features.includes(name),
        hasTier: (required) => (TIER_RANK[state.tier] ?? -1) >= (TIER_RANK[required] ?? 99),
        reload,
    }), [state]);

    return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicenseContext() {
    return useContext(LicenseContext);
}

/**
 * <RequireTier tier="pro">...</RequireTier> — render children only when the
 * active tier is at least the given level. Otherwise render an upgrade panel.
 *
 * Use sparingly — for hard route gating. Most UI elements should soft-gate
 * via lock icons (see <LockedIfBelow />).
 */
export function RequireTier({ tier = 'pro', feature = null, children, fallback = null, onNavigateToLicense = null }) {
    const ctx = useLicenseContext();
    const { t } = useTranslation();
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
                {t('license.community_explainer', 'You can activate Pro, Enterprise, or a custom plan with a license key purchased at beeflow.ai. Activation unlocks features like automations, multi-user, guardrails, and more.')}
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
                    href="https://beeflow.ai/pricing"
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-lg text-xs font-semibold border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                >
                    {t('license.upgrade_at_beeflow', 'Upgrade at beeflow.ai')}
                </a>
            </div>
        </div>
    );
}

/**
 * <LockedIfBelow tier="pro">{({ locked, requiredTier }) => (...)}</LockedIfBelow>
 * Render-prop helper for lightweight inline gating (lock icons, tooltips).
 */
export function LockedIfBelow({ tier = 'pro', feature = null, children }) {
    const ctx = useLicenseContext();
    const ok = feature ? ctx.hasFeature(feature) : ctx.hasTier(tier);
    return children({ locked: !ok, requiredTier: tier, currentTier: ctx.tier, ctx });
}

export default LicenseContext;
