/**
 * applyTheme — the single function that writes a theme state into the document.
 *
 * Called from ThemeContext's useLayoutEffect on every state change. Keeping
 * this pure (no React, no module-level state) makes it unit-testable with a
 * JSDOM root and keeps the provider effect body trivial.
 *
 *   applyThemeToDocument(state)
 *     ├─ applyCoreVars       preset, accent, accent-fg, radius, font
 *     ├─ applyWallpaperVars  image url, overlay, [data-wallpaper-on]
 *     ├─ applyGlassVars      intensity, tint, lens, anim, grain, border
 *     └─ applyGlassTierOverrides    subtle/default/opaque per-tier values
 *
 * The `--accent-primary-fg` derivation uses a relative-luminance test so the
 * value reads as the WCAG-AA foreground colour for the chosen accent. Chat
 * bubbles, primary buttons, and any badge using `color: var(--accent-primary-fg)`
 * now stay readable when admins pick light accents (amber) or dark accents
 * (red) without each consumer hardcoding `text-black` or `text-white`.
 */

export const FONT_STACKS = {
    system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    inter: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    plex: "'IBM Plex Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    geist: "'Geist', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

export function applyThemeToDocument(state, root = document.documentElement) {
    applyCoreVars(root, state);
    applyWallpaperVars(root, state);
    applyGlassVars(root, state);
    applyGlassTierOverrides(root, state);
}

function applyCoreVars(root, state) {
    root.setAttribute('data-theme', state.preset || 'light');
    if (state.accent) {
        root.style.setProperty('--accent-primary', state.accent);
        root.style.setProperty('--accent-primary-fg', readableForeground(state.accent));
    }
    if (state.radiusScale) {
        root.style.setProperty('--radius-scale', String(state.radiusScale));
    }
    if (state.font && FONT_STACKS[state.font]) {
        root.style.setProperty('--font-sans', FONT_STACKS[state.font]);
    }
}

function applyWallpaperVars(root, state) {
    if (state.wallpaperOverlay !== undefined && state.wallpaperOverlay !== null) {
        root.style.setProperty('--wallpaper-overlay', `rgba(255, 255, 255, ${state.wallpaperOverlay})`);
    }
    if (state.wallpaperUrl) {
        root.style.setProperty('--wallpaper-image', `url("${state.wallpaperUrl}")`);
        root.setAttribute('data-wallpaper-on', 'image');
    } else {
        root.style.setProperty('--wallpaper-image', 'none');
        root.removeAttribute('data-wallpaper-on');
    }
}

function applyGlassVars(root, state) {
    if (state.glassIntensity !== undefined && state.glassIntensity !== null) {
        root.style.setProperty('--glass-intensity', String(state.glassIntensity));
    }
    if (state.wallpaperPreset) root.setAttribute('data-wallpaper', state.wallpaperPreset);
    if (state.glassTint)       root.setAttribute('data-glass-tint', state.glassTint);
    if (state.glassLens)       root.setAttribute('data-lens', state.glassLens);
    if (state.glassAnimation)  root.setAttribute('data-anim', state.glassAnimation);
    if (state.glassGrain)      root.setAttribute('data-glass-grain', state.glassGrain);
    if (state.glassBorder)     root.setAttribute('data-glass-border', state.glassBorder);
}

function applyGlassTierOverrides(root, state) {
    writeTier(root, 'subtle',  state.glassTierSubtle);
    writeTier(root, 'default', state.glassTierDefault);
    writeTier(root, 'opaque',  state.glassTierOpaque);
}

function writeTier(root, key, tier) {
    if (tier && typeof tier === 'object') {
        root.style.setProperty(`--glass-tier-${key}-blur`, `${tier.blur}px`);
        root.style.setProperty(`--glass-tier-${key}-saturate`, `${tier.saturate}%`);
        root.style.setProperty(`--glass-tier-${key}-brightness`, String(tier.brightness));
    } else {
        root.style.removeProperty(`--glass-tier-${key}-blur`);
        root.style.removeProperty(`--glass-tier-${key}-saturate`);
        root.style.removeProperty(`--glass-tier-${key}-brightness`);
    }
}

/**
 * Pick the most-readable foreground colour (#000 or #fff) for an arbitrary
 * background hex. Uses the relative-luminance formula from the WCAG spec —
 * the same test browsers use for AA contrast.
 *
 * Accepts `#rgb`, `#rrggbb`, or `#rrggbbaa`. Returns `#fff` for unknown input.
 */
export function readableForeground(hex) {
    if (typeof hex !== 'string' || !hex.startsWith('#')) return '#ffffff';
    const stripped = hex.slice(1);
    let r, g, b;
    if (stripped.length === 3) {
        r = parseInt(stripped[0] + stripped[0], 16);
        g = parseInt(stripped[1] + stripped[1], 16);
        b = parseInt(stripped[2] + stripped[2], 16);
    } else if (stripped.length === 6 || stripped.length === 8) {
        r = parseInt(stripped.slice(0, 2), 16);
        g = parseInt(stripped.slice(2, 4), 16);
        b = parseInt(stripped.slice(4, 6), 16);
    } else {
        return '#ffffff';
    }
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#ffffff';
    const lin = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    // Crossover where black text starts beating white under the WCAG contrast
    // formula: (L+0.05)/0.05 > 1.05/(L+0.05) → L > √0.0525 − 0.05 ≈ 0.179.
    // The previous midpoint test (L > 0.5) chose WHITE for every mid-luminance
    // accent — the default grey #9ca3af (L ≈ 0.36) got white at 2.54:1 when
    // black measures 8.3:1, which is the exact failure this function's doc
    // comment promises to prevent.
    return L > 0.179 ? '#000000' : '#ffffff';
}
