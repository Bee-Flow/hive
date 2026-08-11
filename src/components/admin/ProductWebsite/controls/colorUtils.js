/**
 * colorUtils.js — pure color helpers shared by the CMS admin controls.
 *
 * parseRgbaOverlay / composeRgba moved here verbatim from
 * BlockStyleEditor.jsx (which re-imports them); contrastRatio backs the
 * upcoming contrast badges (WCAG 2.x relative-luminance formula).
 */

// Convert "rgba(r,g,b,a)" → { hex, opacity }; defaults to black/0.5.
export function parseRgbaOverlay(rgba) {
    if (!rgba || typeof rgba !== 'string') return { hex: '', opacity: 0.5 };
    const m = rgba.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
    if (!m) return { hex: '', opacity: 0.5 };
    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);
    const a = m[4] != null ? parseFloat(m[4]) : 1;
    const hex = '#' + [r, g, b].map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('');
    return { hex, opacity: Math.max(0, Math.min(1, a)) };
}

export function composeRgba(hex, opacity) {
    const m = (hex || '').match(/^#([0-9a-fA-F]{6})$/);
    if (!m) return null;
    const h = m[1];
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = Math.max(0, Math.min(1, typeof opacity === 'number' ? opacity : 0.5));
    return `rgba(${r}, ${g}, ${b}, ${Math.round(a * 100) / 100})`;
}

// "#rgb" / "#rrggbb" (leading # optional) → [r, g, b] 0-255, or null.
function parseHexColor(hex) {
    if (typeof hex !== 'string') return null;
    const h = hex.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(h)) {
        return [h[0] + h[0], h[1] + h[1], h[2] + h[2]].map(p => parseInt(p, 16));
    }
    if (/^[0-9a-fA-F]{6}$/.test(h)) {
        return [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map(p => parseInt(p, 16));
    }
    return null;
}

// WCAG 2.x relative luminance of an sRGB hex color, or null.
function relativeLuminance(hex) {
    const rgb = parseHexColor(hex);
    if (!rgb) return null;
    const [r, g, b] = rgb.map(n => {
        const c = n / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio between two hex colors (1..21). Tolerates #rgb and
 * #rrggbb (with or without the leading #); returns null when either side
 * is unparseable so callers can skip the badge instead of lying.
 */
export function contrastRatio(hexA, hexB) {
    const la = relativeLuminance(hexA);
    const lb = relativeLuminance(hexB);
    if (la === null || lb === null) return null;
    const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
}
