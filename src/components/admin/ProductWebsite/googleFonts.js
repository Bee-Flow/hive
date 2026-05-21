/**
 * Curated font library surfaced in the Design tab and every per-field
 * font picker in the website builder.
 *
 * The file is still named `googleFonts.js` for compatibility with
 * existing imports, but the library now spans multiple providers:
 *
 *   - `google`     — https://fonts.google.com           (CSS2 API)
 *   - `fontshare`  — https://fontshare.com              (CSS API)
 *
 * Each entry knows its source so the URL builder can route it to the
 * right CDN. Mix sans / serif / display so users can build a typographic
 * pair (e.g. heading: Cabinet Grotesk, body: Inter).
 *
 * Adding a font: append an entry below and it shows up in BOTH the
 * heading and body pickers automatically, plus every per-field picker
 * built on the same dropdown. The Design tab preloads the regular
 * weight (400) of every entry on mount so the in-panel previews render
 * in the chosen face.
 */

// Internal registry — `name` is what users see / what's stored in the
// SiteDoc; `source` controls which CDN we hit; `slug` is the URL token
// for Fontshare (lowercase + hyphens). Google uses `name` directly.
const FONT_LIBRARY = [
    // ── Sans-serif (system-style) ──
    { name: 'Inter',           source: 'google' },
    { name: 'Roboto',          source: 'google' },
    { name: 'Open Sans',       source: 'google' },
    { name: 'Lato',            source: 'google' },
    { name: 'Montserrat',      source: 'google' },
    { name: 'Poppins',         source: 'google' },
    { name: 'Nunito',          source: 'google' },
    { name: 'Source Sans 3',   source: 'google' },
    { name: 'Work Sans',       source: 'google' },
    { name: 'IBM Plex Sans',   source: 'google' },
    { name: 'DM Sans',         source: 'google' },
    { name: 'Manrope',         source: 'google' },
    { name: 'Space Grotesk',   source: 'google' },
    { name: 'Karla',           source: 'google' },
    { name: 'Raleway',         source: 'google' },
    // ── Serif ──
    { name: 'Roboto Slab',     source: 'google' },
    { name: 'Source Serif 4',  source: 'google' },
    { name: 'Merriweather',    source: 'google' },
    { name: 'Playfair Display',source: 'google' },
    { name: 'Lora',            source: 'google' },
    { name: 'IBM Plex Serif',  source: 'google' },
    // ── Self-hosted (Fontshare originals, served from /public/fonts/) ──
    // Variable WOFF2s under agent-hub/public/fonts/<slug>/ and loaded
    // via the @font-face block in agent-hub/src/marketing/
    // self-hosted-fonts.css. No CDN dependency.
    { name: 'Satoshi',         source: 'self' },
    { name: 'Cabinet Grotesk', source: 'self' },
    { name: 'General Sans',    source: 'self' },
    { name: 'Clash Display',   source: 'self' },
    { name: 'Clash Grotesk',   source: 'self' },
];

// Flat list of every available font name. Misnamed for historical
// reasons (was just Google before Fontshare landed) — kept exported as
// `GOOGLE_FONTS` so existing imports keep working. New code should
// prefer the alias `FONT_NAMES`.
export const GOOGLE_FONTS = FONT_LIBRARY.map(f => f.name);
export const FONT_NAMES   = GOOGLE_FONTS;

// Lookup: lowercase font name → registry entry. Used by the URL builder
// to figure out which CDN to send each picked font to.
const BY_NAME = new Map(FONT_LIBRARY.map(f => [f.name.toLowerCase(), f]));

/**
 * Build the stylesheet URLs needed to load the given families.
 *
 * Returns an array of `{ id, source, href }` — one entry per source
 * (`'google'` or `'fontshare'`) that has at least one family in the
 * input list. Callers should render one `<link rel="stylesheet">` per
 * returned entry, keyed by `id`, so the network requests live on the
 * appropriate CDN.
 *
 * Unknown family names are routed to Google by default — preserves the
 * previous behaviour for any caller that picked a Google font that
 * happens to not be in the curated list.
 */
export function buildFontsHrefs(families, weights = [400]) {
    const familyList = Array.from(new Set(families)).filter(Boolean);
    if (familyList.length === 0) return [];

    const byHost = { google: [], fontshare: [] };
    for (const name of familyList) {
        const entry = BY_NAME.get(name.toLowerCase());
        const source = entry?.source || 'google';
        if (source === 'self') {
            // Self-hosted fonts are loaded once at build time via the
            // @font-face block in agent-hub/src/marketing/
            // self-hosted-fonts.css — no <link> needed here.
            continue;
        }
        if (source === 'fontshare') {
            byHost.fontshare.push(entry);
        } else {
            byHost.google.push(entry?.name || name);
        }
    }

    const out = [];

    if (byHost.google.length > 0) {
        const wghtPart = weights.join(';');
        const familyParam = byHost.google
            .map(f => `family=${encodeURIComponent(f)}:wght@${wghtPart}`)
            .join('&');
        out.push({
            id: 'cms-fonts-google',
            source: 'google',
            href: `https://fonts.googleapis.com/css2?${familyParam}&display=swap`,
        });
    }

    if (byHost.fontshare.length > 0) {
        // Fontshare's API uses repeated `f[]=` params with a comma-separated
        // weight list per family. The slug must be lowercase + hyphenated.
        const wghtPart = weights.join(',');
        const familyParam = byHost.fontshare
            .map(f => `f[]=${encodeURIComponent(f.slug)}@${wghtPart}`)
            .join('&');
        out.push({
            id: 'cms-fonts-fontshare',
            source: 'fontshare',
            href: `https://api.fontshare.com/v2/css?${familyParam}&display=swap`,
        });
    }

    return out;
}

/**
 * Back-compat shim. Returns only the Google URL (or empty string)
 * — preserves the original single-URL contract for any caller that
 * predates the multi-source rewrite. New code should call
 * `buildFontsHrefs` (plural) and render one <link> per returned entry.
 */
export function buildFontsHref(families, weights = [400]) {
    const hrefs = buildFontsHrefs(families, weights);
    return hrefs.find(h => h.source === 'google')?.href || '';
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
