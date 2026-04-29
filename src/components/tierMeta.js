// Shared metadata for the user-facing tier keys. Used by ModelTierSelector
// (the dropdown) and MessageItem (the "Auto → X" badge) so both stay in sync
// when keys are renamed or new tiers are added.
//
// `pro` is a legacy key that resolves server-side to the deep-thinking model;
// the human label here makes the badge read "Deep Thinking" instead of "Pro".
export const TIER_META = {
    auto: { icon: '🔀', label: 'Auto', desc: 'Optimal choice', color: '#6366f1' },
    fast: { icon: '⚡', label: 'Fast', desc: 'Quick answers', color: '#10b981' },
    standard: { icon: '🐝', iconSrc: '/BeeFlow-logo-Icon-2026.svg', label: 'Flow', desc: 'Multi-stage orchestration', color: '#f59e0b' },
    thinking: { icon: '🧠', label: 'Think', desc: 'Complex problems', color: '#8b5cf6' },
    writer: { icon: '✍️', label: 'Write', desc: 'Long-form content', color: '#ec4899' },
    deep_thinking: { icon: '✨', label: 'Deep Thinking', desc: 'Advanced reasoning', color: '#f59e0b' },
    pro: { icon: '✨', label: 'Deep Thinking', desc: 'Advanced reasoning', color: '#f59e0b' },
};

export function customTierMeta(key, cfg) {
    return {
        icon: cfg?.icon || '✨',
        label: cfg?.label || key.replace(/^custom:/, ''),
        desc: cfg?.description || 'Custom tier',
        color: '#eab308',
    };
}

// Resolve a tier key to its display label. Falls back to a Capitalised raw key
// if the tier isn't in TIER_META and isn't a custom tier.
export function tierLabel(tierKey, tiers = {}) {
    if (!tierKey) return '';
    if (TIER_META[tierKey]) return TIER_META[tierKey].label;
    if (tierKey.startsWith('custom:')) return customTierMeta(tierKey, tiers[tierKey]).label;
    return tierKey.charAt(0).toUpperCase() + tierKey.slice(1);
}
