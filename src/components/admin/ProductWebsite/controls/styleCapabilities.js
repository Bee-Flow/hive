/**
 * styleCapabilities.js — which v2 per-block style knobs each block type
 * supports. BlockStyleEditor consults this to decide whether to render
 * the Columns segmented control and the Motion (reveal/glow) toggles.
 *
 * Renderer support (blockWrapClasses/blockWrapStyle in marketing/
 * ProductWebsite.jsx + tokens.css): style.columns re-templates the four
 * card grids via --cms-cols; style.reveal/glow work on every type via
 * the wrapper (reveal 'off' also forces internal reveals visible).
 *
 * Knobs:
 *   columns — style.columns (2|3|4) → the block's card grid column count
 *   motion  — style.reveal ('on'|'off') + style.glow (boolean)
 */

export const STYLE_CAPABILITIES = {
    hero:               { columns: false, motion: true },
    socialProof:        { columns: false, motion: true },
    content:            { columns: false, motion: true },
    'media-text':       { columns: false, motion: true },
    features:           { columns: true,  motion: true },
    steps:              { columns: true,  motion: true },
    security:           { columns: true,  motion: true },
    integrations:       { columns: false, motion: true },
    architecture:       { columns: false, motion: true },
    techStats:          { columns: true,  motion: true },
    cta:                { columns: false, motion: true },
    'cta-banner':       { columns: false, motion: true },
    'live-component':   { columns: false, motion: true },
    pricing:            { columns: false, motion: true },
    'customer-support': { columns: false, motion: true },
    roadmap:            { columns: true,  motion: true },
};

// Unknown/absent types support nothing — the Style tab then shows only the
// universal controls (colors, spacing, background, layout).
export function getCapabilities(type) {
    return STYLE_CAPABILITIES[type] || {};
}
