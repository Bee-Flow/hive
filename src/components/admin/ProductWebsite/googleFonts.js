/**
 * Curated list of Google Fonts surfaced in the Design tab.
 *
 * Kept short and intentional — too many choices makes the dropdown
 * useless. Mix of sans/serif/display so users can build a typographic
 * pair (e.g. heading: Playfair Display, body: Lora).
 *
 * If you add a font here, it'll show up in BOTH the heading and body
 * pickers automatically. The Design tab also preloads the regular
 * weight (400) of every entry on mount so the in-panel previews are
 * actually rendered in the chosen face.
 */
export const GOOGLE_FONTS = [
    // Sans-serif (system-style)
    'Inter',
    'Roboto',
    'Open Sans',
    'Lato',
    'Montserrat',
    'Poppins',
    'Nunito',
    'Source Sans 3',
    'Work Sans',
    'IBM Plex Sans',
    'DM Sans',
    'Manrope',
    'Space Grotesk',
    'Karla',
    'Raleway',
    // Serif
    'Roboto Slab',
    'Source Serif 4',
    'Merriweather',
    'Playfair Display',
    'Lora',
    'IBM Plex Serif',
];

/**
 * Build a Google Fonts CSS2 URL for the given family list.
 * Pass a `weights` array (e.g. [400, 600, 800]) to load specific
 * weights — defaults to just regular (400) which is enough for
 * dropdown previews.
 */
export function buildFontsHref(families, weights = [400]) {
    const familyList = Array.from(new Set(families)).filter(Boolean);
    if (familyList.length === 0) return '';
    const wghtPart = weights.join(';');
    const familyParam = familyList
        .map(f => `family=${encodeURIComponent(f)}:wght@${wghtPart}`)
        .join('&');
    return `https://fonts.googleapis.com/css2?${familyParam}&display=swap`;
}

/**
 * Build a CSS font-family stack with a system fallback. Quotes the
 * family name when it contains spaces. Mirrors the behavior in
 * agent-hub/src/marketing/ProductWebsite.jsx so the panel previews
 * resolve the same way the iframe will.
 */
export function fontStack(name) {
    const safe = String(name || '').replace(/"/g, '');
    if (!safe) return 'system-ui, sans-serif';
    const quoted = /\s/.test(safe) ? `"${safe}"` : safe;
    return `${quoted}, system-ui, -apple-system, sans-serif`;
}
