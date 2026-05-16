// Shared chart / status color palette.
//
// Pulled out of the two settings panels (OrgTerminationsPanel,
// OrgFeedbackPanel) and SubscriptionsPanel where the same hex values were
// duplicated. CSS-var equivalents are preferred where the colour reads
// from the theme; raw hexes are kept for chart series where Recharts /
// Vega need a literal.
//
// PROJECT RULE: no purple/violet/indigo. Don't add fuchsia/magenta/etc.
// either — they read as purple in low-saturation themes.

export const STATUS_COLORS = {
    blue: '#3b82f6',
    green: '#10b981',
    amber: '#f59e0b',
    orange: '#f97316',
    rose: '#f43f5e',
    red: '#ef4444',
    cyan: '#06b6d4',
    slate: '#64748b',
};

// Chart-series order — used as the default when a chart doesn't specify
// per-series colours. Keep it sorted by visual contrast so adjacent series
// are easy to distinguish.
export const CHART_SERIES = [
    STATUS_COLORS.blue,
    STATUS_COLORS.green,
    STATUS_COLORS.amber,
    STATUS_COLORS.rose,
    STATUS_COLORS.cyan,
    STATUS_COLORS.orange,
    STATUS_COLORS.slate,
];

// Semantic aliases that read better at call sites than raw colour names.
export const SEMANTIC = {
    success: STATUS_COLORS.green,
    warning: STATUS_COLORS.amber,
    danger: STATUS_COLORS.red,
    info: STATUS_COLORS.blue,
    neutral: STATUS_COLORS.slate,
};
