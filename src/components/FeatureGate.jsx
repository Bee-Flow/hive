import React from 'react';

/**
 * FeatureGate — single source of truth for client-side feature visibility.
 *
 * Server-side enforcement is the actual security boundary; this component
 * is purely UX: it hides or disables UI that calls into gated APIs so users
 * don't see buttons that always 403.
 *
 * The gate reads `user.canUseFeature[featureId]` (computed by the server in
 * /auth/my-permissions as the intersection of plan + license + beta-feature
 * allow-list) and renders:
 *
 *   - children when the feature is enabled
 *   - the `fallback` slot (or nothing) when disabled
 *   - the `lockedFallback` slot when explicitly provided and the user can
 *     "see" the feature but not "use" it (e.g. upsell teasers)
 *
 * `requireAny`/`requireAll` accept arrays of feature IDs for composite gates.
 *
 * Example:
 *   <FeatureGate user={user} feature="webpages">
 *     <WebpagesNavItem />
 *   </FeatureGate>
 *
 *   <FeatureGate user={user} feature="swarm" fallback={<UpsellBadge />}>
 *     <SwarmLauncher />
 *   </FeatureGate>
 */
export default function FeatureGate({
    user,
    feature,
    requireAny,
    requireAll,
    fallback = null,
    children,
}) {
    const allowed = isFeatureAllowed(user, { feature, requireAny, requireAll });
    if (allowed) return <>{children}</>;
    return fallback;
}

/**
 * Imperative helper for places where wrapping in JSX is awkward (menu
 * builders, conditional class names, etc.). Returns a boolean.
 */
export function isFeatureAllowed(user, { feature, requireAny, requireAll } = {}) {
    if (!user) return false;
    // Super-admin sees everything.
    if (user.isAdmin || user.role === 'admin') return true;

    const allow = (id) => {
        if (!id) return true;
        // Prefer the server-computed `canUseFeature` map. Fall back to the
        // legacy betaFeatures + permissions arrays so components that
        // mounted before the map propagated don't blank out.
        if (user.canUseFeature && Object.prototype.hasOwnProperty.call(user.canUseFeature, id)) {
            return !!user.canUseFeature[id];
        }
        const legacyBeta = Array.isArray(user.betaFeatures) && user.betaFeatures.includes(id);
        const wildcard = Array.isArray(user.permissions) && user.permissions.includes('all');
        return legacyBeta || wildcard;
    };

    if (Array.isArray(requireAll) && requireAll.length > 0) {
        return requireAll.every(allow);
    }
    if (Array.isArray(requireAny) && requireAny.length > 0) {
        return requireAny.some(allow);
    }
    return allow(feature);
}
