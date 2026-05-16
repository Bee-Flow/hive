// Static config for the Usage analytics dashboard. Extracted from
// pages/settings/UsageSection.jsx so that future sub-components of the
// dashboard split (Phase 5.A4) can import individual constants without
// pulling the 2254-LOC parent file.
//
// SOURCE_MAP (which pairs Lucide icon components with each source) stays
// inside UsageSection.jsx because it would otherwise require this file
// to be .tsx and to depend on a UI library. Pull the icon mapping out
// during the Phase 5.A4 split.

/**
 * Score below which the Integrations dashboard surfaces an
 * "Action required" banner. Soft policy default; configurable per-org
 * is intentionally out of scope.
 */
export const ALERT_SCORE_THRESHOLD = 40;

/** USD cost threshold for the Overview card. Soft (amber) at 1×, hard (red) at 2×. */
export const OVERVIEW_COST_ALERT = 200;

/** PII detection count threshold inside the selected range that flips the Safety card to alert. */
export const SAFETY_PII_ALERT = 10;

/**
 * Default chart palette. Ten distinct hues, slate at the end so any
 * "Other / Unknown" series doesn't visually fight with the named series.
 */
export const PALETTE = [
    '#0ea5e9', // sky-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#ec4899', // pink-500
    '#3b82f6', // blue-500
    '#ef4444', // red-500
    '#06b6d4', // cyan-500
    '#14b8a6', // teal-500
    '#f97316', // orange-500
    '#64748b', // slate-500
] as const;

/** Returns the palette entry at `i % PALETTE.length`. */
export function paletteColor(i: number): string {
    return PALETTE[i % PALETTE.length];
}

/**
 * Brand-ish colours for known cloud operators. Used to tint cards and
 * egress rows so the eye can group destinations by cloud at a glance.
 * Unknown operators fall back to slate so an unattributed entry stays
 * legible without being a noisy default.
 */
export const OPERATOR_COLORS: Record<string, string> = {
    'Google':       '#4285F4',
    'Microsoft':    '#0078D4',
    'Cloudflare':   '#F38020',
    'Amazon AWS':   '#FF9900',
    'Fastly':       '#FF282D',
    'Akamai':       '#009BAB',
    'OpenAI':       '#10A37F',
    'Anthropic':    '#D97757',
    'Unknown':      '#94a3b8',
};

export function operatorColor(name: string | null | undefined): string {
    return (name && OPERATOR_COLORS[name]) || '#64748b';
}
