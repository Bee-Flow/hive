/**
 * App Design v2 — client runtime for the OPTIONAL definition.design / nav.
 *
 * Sits NEXT TO themeVars.js (which is pinned and byte-stable): themeVars keeps
 * emitting the five classic vars, appDesignProps() adds the design layer as
 * { className, style } merged by the three roots (AppShell, AppRenderer,
 * AppRunPage). IDENTITY DISCIPLINE: a missing design, or one holding only
 * default values, yields an empty className and no style keys — byte-identical
 * rendering with today. All tokens live in app-tokens.css under the
 * .app-shell/.app-runtime hooks with `var(--token, <today's literal>)`
 * fallbacks.
 *
 * Enum mirrors of server/appStudio/appDesignSpec.js (AUTHORITATIVE) — keep in
 * lockstep; runtime/catalogLockstep.test.js pins them.
 */

// ── Mirrors (server/appStudio/appDesignSpec.js is authoritative) ────────────
export const DESIGN_ENUMS = {
    preset: ['custom', 'classic', 'cloud', 'atlas', 'midnight', 'field', 'paper', 'mono'],
    font: ['system', 'inter', 'satoshi', 'general-sans', 'cabinet', 'geist', 'plex'],
    surface: ['hairline', 'flat', 'soft', 'elevated'],
    motion: ['none', 'subtle', 'full'],
    chartPalette: ['classic', 'brand'],
};

export const DESIGN_DEFAULTS = {
    preset: 'custom',
    font: 'system',
    surface: 'hairline',
    motion: 'subtle',
    chartPalette: 'classic',
    logoUrl: null,
};

export const NAV_STYLES = ['tabs', 'sidebar', 'mega', 'rail'];
export const NAV_DEFAULT_STYLE = 'tabs';

// Pairing id → CSS stack. `system` is identity (no fontFamily emitted). The
// self-hosted families load via marketing/self-hosted-fonts.css; Google
// families via buildFontsHrefs at the run/preview roots.
export const FONT_STACKS = {
    system: null,
    inter: "'Inter', system-ui, -apple-system, sans-serif",
    satoshi: "'Satoshi', system-ui, -apple-system, sans-serif",
    'general-sans': "'General Sans', system-ui, -apple-system, sans-serif",
    cabinet: "'Cabinet Grotesk', system-ui, -apple-system, sans-serif",
    geist: "'Geist', system-ui, -apple-system, sans-serif",
    plex: "'IBM Plex Sans', system-ui, -apple-system, sans-serif",
};

// Families that need a Google Fonts <link> (the rest are self-hosted or system).
export const GOOGLE_FONT_FAMILIES = {
    inter: 'Inter',
    geist: 'Geist',
    plex: 'IBM Plex Sans',
};

/**
 * design → { className, style } for the app roots. Identity in, nothing out.
 */
export function appDesignProps(definition) {
    const d = definition?.design;
    const classes = [];
    const style = {};
    if (d && typeof d === 'object') {
        if (d.surface && d.surface !== DESIGN_DEFAULTS.surface && DESIGN_ENUMS.surface.includes(d.surface)) {
            classes.push(`app-design--surface-${d.surface}`);
        }
        if (d.motion === 'none') classes.push('app-motion--none');
        else if (d.motion === 'full') classes.push('app-motion--full');
        const stack = FONT_STACKS[d.font];
        if (stack) style.fontFamily = stack;
    }
    return { className: classes.join(' '), style };
}

// ── Brand chart palette ─────────────────────────────────────────────────────
// Derived from theme.primary by hue rotation. The 255–305° hue window is
// HARD-SKIPPED so the house color rule (AppStudio.noPurple.test.jsx) can never
// be violated, whatever primary the owner picks.

const BANNED_HUE_LO = 255;
const BANNED_HUE_HI = 305;

function hexToHsl(hex) {
    const m = /^#([0-9a-fA-F]{6})$/.exec(String(hex || '').trim());
    if (!m) return { h: 175, s: 0.77, l: 0.26 }; // teal default
    const n = parseInt(m[1], 16);
    const r = ((n >> 16) & 0xff) / 255;
    const g = ((n >> 8) & 0xff) / 255;
    const b = (n & 0xff) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const dlt = max - min;
    const s = l > 0.5 ? dlt / (2 - max - min) : dlt / (max + min);
    let h;
    if (max === r) h = ((g - b) / dlt + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / dlt + 2;
    else h = (r - g) / dlt + 4;
    return { h: h * 60, s, l };
}

function hslToHex({ h, s, l }) {
    const hue = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = l - c / 2;
    let rgb;
    if (hue < 60) rgb = [c, x, 0];
    else if (hue < 120) rgb = [x, c, 0];
    else if (hue < 180) rgb = [0, c, x];
    else if (hue < 240) rgb = [0, x, c];
    else if (hue < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    const to255 = (v) => Math.round((v + m) * 255);
    return '#' + rgb.map((v) => to255(v).toString(16).padStart(2, '0')).join('');
}

function skipBannedHue(hue) {
    const h = ((hue % 360) + 360) % 360;
    if (h < BANNED_HUE_LO || h > BANNED_HUE_HI) return h;
    // Land past the window, preserving how far in we were so rotations stay
    // distinct rather than piling up on one edge.
    return (BANNED_HUE_HI + (h - BANNED_HUE_LO)) % 360;
}

/**
 * Eight categorical colors anchored on the primary. Deterministic; series 0
 * IS the primary, later series rotate the hue wheel around the banned window
 * with mild lightness alternation for adjacent-series contrast.
 */
export function brandPalette(primaryHex) {
    const base = hexToHsl(primaryHex);
    const s = Math.min(Math.max(base.s, 0.35), 0.85);
    const out = [];
    for (let i = 0; i < 8; i++) {
        if (i === 0) { out.push(hslToHex(base)); continue; }
        const h = skipBannedHue(base.h + i * 41);
        const l = Math.min(Math.max(base.l + (i % 2 === 0 ? 0.08 : -0.06), 0.28), 0.62);
        out.push(hslToHex({ h, s, l }));
    }
    return out;
}

export function isBannedHue(hex) {
    const { h, s } = hexToHsl(hex);
    if (s < 0.12) return false; // greys have no meaningful hue
    const hue = ((h % 360) + 360) % 360;
    return hue >= BANNED_HUE_LO && hue <= BANNED_HUE_HI;
}
