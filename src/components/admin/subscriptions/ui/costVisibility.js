// Single source of truth for the "should an end user see internal €/cost
// numbers?" rule. Flat-rate (fixed) subscribers see only % usage of their
// quota; pay-as-you-go (metered) subscribers see live cost because that's
// what their Stripe bill is computed from.
//
// Plain function, not a React hook — keep it usable anywhere (including
// before early returns) without tripping react-hooks/rules-of-hooks.
export function getCostVisibility(billingModel) {
    const showCost = billingModel === 'metered';
    return { showCost, isMetered: showCost, isFixed: !showCost };
}
