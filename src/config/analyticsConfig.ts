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

/**
 * Shared semantic colours for the monitoring dashboards. Deliberately
 * excludes purple/violet/indigo (project styling rule) — the old per-file
 * `C` palettes (including the latent indigo `#6366f1`) are replaced by this.
 */
export const SEMANTIC = {
    in: '#3b82f6',      // input tokens / sent
    out: '#f59e0b',     // output tokens / received-ish
    eu: '#10b981',      // EU/EEA
    local: '#14b8a6',   // on-prem / local
    nonEu: '#f59e0b',   // non-EU egress
    ok: '#10b981',
    good: '#84cc16',
    watch: '#f59e0b',
    risk: '#f97316',
    crit: '#ef4444',
    blue: '#3b82f6',
    green: '#10b981',
    amber: '#f59e0b',
    orange: '#f97316',
    rose: '#f43f5e',
    cyan: '#06b6d4',
    sky: '#0ea5e9',
    teal: '#14b8a6',
    pink: '#ec4899',
    slate: '#64748b',
    muted: '#94a3b8',
} as const;

/**
 * 5-band score → colour, higher-is-better. Shared by the Integrations
 * sovereignty hero and SovereigntyRow (previously redefined identically in
 * both). Other heroes with different semantics (feedback positive-rate,
 * terminations clean-completion) use `pickBand` with their own thresholds.
 */
export function scoreColor(score: number): string {
    if (score >= 80) return SEMANTIC.ok;
    if (score >= 60) return SEMANTIC.good;
    if (score >= 40) return SEMANTIC.watch;
    if (score >= 20) return SEMANTIC.risk;
    return SEMANTIC.crit;
}

export function scoreLabel(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Watch';
    if (score >= 20) return 'Risky';
    return 'Critical';
}

export interface ScoreBand {
    min: number;
    color: string;
    label: string;
}

/**
 * Generic descending-threshold band picker. `bands` must be sorted high→low
 * by `min`; returns the first band whose `min` the value meets, else the last.
 * Lets feedback/terminations express their own thresholds without re-deriving
 * colour ladders inline.
 */
export function pickBand(value: number | null | undefined, bands: ScoreBand[]): ScoreBand {
    if (value != null) {
        for (const b of bands) if (value >= b.min) return b;
    }
    return bands[bands.length - 1];
}
