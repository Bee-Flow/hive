/**
 * App Studio runtime — the categorical chart palette + shared value formatting.
 *
 * The palette is copied verbatim from the notebook ChartView
 * (src/editor/nodeviews/ChartView.jsx): blues / greens / warm / teal / pink,
 * with NO violet or indigo hues (hard house rule — see AppStudio.noPurple.test).
 * AppChart (and AppStat's sparkline) draw ONLY from here so a chart never emits
 * a banned colour, and the axes / grid / tooltip stay on platform tokens.
 */

// Categorical palette — no purple/violet/indigo by house rule.
export const CHART_COLORS = [
    '#3b82f6', // blue
    '#22c55e', // green
    '#f97316', // orange
    '#eab308', // yellow
    '#14b8a6', // teal
    '#ef4444', // red
    '#06b6d4', // cyan
    '#ec4899', // pink
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Nth palette colour, wrapping (and tolerant of negative indexes). */
export function chartColorAt(index) {
    const n = CHART_COLORS.length;
    const i = Number.isFinite(index) ? ((Math.trunc(index) % n) + n) % n : 0;
    return CHART_COLORS[i];
}

/**
 * A series' colour: an explicit #rrggbb literal on the series wins; anything
 * else (empty / a name / a bad value) falls back to the palette slot for its
 * index. We only honour a literal hex — role names could resolve to a banned
 * hue and there is no purple in the palette, so this can never emit one.
 */
export function resolveSeriesColor(color, index, palette = null) {
    if (typeof color === 'string' && HEX_RE.test(color.trim())) return color.trim();
    // A brand palette (App Design v2, design.chartPalette:'brand') is derived
    // from the app's primary colour — charts then belong to the app instead of
    // looking like every other chart. Absent = the classic categorical set.
    if (Array.isArray(palette) && palette.length) {
        const n = palette.length;
        const i = Number.isFinite(index) ? ((Math.trunc(index) % n) + n) % n : 0;
        return palette[i];
    }
    return chartColorAt(index);
}

// Axis / grid / tooltip styling — platform tokens only (mirrors ChartView).
export const CHART_AXIS = { fontSize: 11, stroke: 'var(--text-tertiary)' };
export const CHART_GRID_STROKE = 'var(--border-subtle)';
export const CHART_TOOLTIP_STYLE = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-default)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--text-primary)',
};

/**
 * A number formatter for tick / tooltip values. `valueFormat` is the chart's
 * enum: 'number' | 'percent' | 'currency'. Non-finite input passes through
 * untouched so labels/strings still render.
 */
export function makeValueFormatter(valueFormat) {
    return (raw) => {
        const n = Number(raw);
        if (!Number.isFinite(n)) return raw == null ? '' : String(raw);
        if (valueFormat === 'percent') {
            return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
        }
        if (valueFormat === 'currency') {
            return n.toLocaleString(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
        }
        return n.toLocaleString();
    };
}

// A neutral sample series used in edit mode when a chart has no bound data yet,
// so the canvas never shows an empty box. Deterministic (no randomness) so the
// preview is stable across renders.
export const PLACEHOLDER_XKEY = 'label';
export const PLACEHOLDER_SERIES_KEY = 'value';
export const PLACEHOLDER_DATA = [
    { label: 'Mon', value: 12 },
    { label: 'Tue', value: 18 },
    { label: 'Wed', value: 9 },
    { label: 'Thu', value: 22 },
    { label: 'Fri', value: 16 },
];

export default CHART_COLORS;
