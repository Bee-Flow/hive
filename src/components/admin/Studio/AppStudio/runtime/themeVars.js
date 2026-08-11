/**
 * App Studio runtime — theme → scoped CSS custom properties.
 *
 * The theme schema (keys, enum values, defaults, presets) is owned by
 * server/appStudio/componentSpecs.js (THEME_SPEC / THEME_PRIMARY_PRESETS —
 * AUTHORITATIVE). The maps below are mirrored verbatim; keep them in lockstep.
 *
 * Components always use the platform tokens (--bg-primary/--text-primary/…)
 * for text and surfaces; the --app-* vars only drive accent color, radius and
 * spacing, so one theme picker restyles the whole app without fighting the
 * host light/dark theme. appearance:'auto' therefore needs no work at all —
 * the platform vars already flip; 'light'/'dark' are stamped as a
 * data-app-appearance attribute (plus color-scheme) for targeted overrides.
 */

// Mirror of THEME_PRIMARY_PRESETS in server/appStudio/componentSpecs.js
// (authoritative — no purple/violet/indigo hues by house rule).
export const APP_COLOR_PRESETS = [
    '#0F766E', // teal (default)
    '#0369A1', // sky
    '#1D4ED8', // blue
    '#0891B2', // cyan
    '#047857', // emerald
    '#4D7C0F', // lime
    '#B45309', // amber
    '#C2410C', // orange
    '#B91C1C', // red
    '#BE185D', // pink
    '#334155', // slate
    '#57534E', // stone
];

export const RADIUS_PX = { none: '0px', sm: '4px', md: '8px', lg: '12px', xl: '16px' };
export const DENSITY_MULT = { compact: '0.75', comfortable: '1', spacious: '1.25' };
export const FONT_SCALE_PX = { sm: '14px', md: '15px', lg: '16px' };

const DEFAULT_PRIMARY = APP_COLOR_PRESETS[0];

function parseHex(hex) {
    if (typeof hex !== 'string') return null;
    const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/**
 * Pick black or white text for a given background hex via WCAG relative
 * luminance. Unparseable input assumes a dark background (white text).
 */
export function bestContrast(hex) {
    const rgb = parseHex(hex);
    if (!rgb) return '#ffffff';
    const channel = (v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const luminance = 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
    // Compare the two ratios rather than guessing a crossover. The old 0.4
    // threshold sat far above the real one (~0.179), so every mid-luminance
    // primary — most brand colours — got white text where black reads better.
    const onWhite = 1.05 / (luminance + 0.05);
    const onBlack = (luminance + 0.05) / 0.05;
    return onBlack >= onWhite ? '#000000' : '#ffffff';
}

/** ~10% alpha tint of the primary, for soft backgrounds (badges, tint fills). */
function softTint(hex) {
    const rgb = parseHex(hex) || parseHex(DEFAULT_PRIMARY);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`;
}

/**
 * themeVars(theme) → inline-style object to spread onto the app root.
 * Every value falls back to the schema default so a partial/absent theme
 * still renders sanely.
 */
export function themeVars(theme) {
    const t = theme || {};
    const primary = parseHex(t.primary) ? t.primary : DEFAULT_PRIMARY;
    const vars = {
        '--app-primary': primary,
        '--app-primary-soft': softTint(primary),
        '--app-primary-contrast': bestContrast(primary),
        '--app-radius': RADIUS_PX[t.radius] || RADIUS_PX.md,
        '--app-space': DENSITY_MULT[t.density] || DENSITY_MULT.comfortable,
        fontSize: FONT_SCALE_PX[t.fontScale] || FONT_SCALE_PX.md,
    };
    // 'light'/'dark' pin the browser color-scheme for form controls etc.;
    // 'auto' (default) simply inherits whatever the platform is doing.
    if (t.appearance === 'light' || t.appearance === 'dark') {
        vars.colorScheme = t.appearance;
    }
    return vars;
}

export default themeVars;
