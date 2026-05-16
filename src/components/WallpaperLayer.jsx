import React from 'react';

/**
 * Fixed full-bleed backdrop + the singleton SVG <filter> used by
 * `backdrop-filter: url(#glass-lens)` when admin's [data-lens="on"] is set.
 *
 * Layers (z-stack):
 *   1. Optional photo background (--wallpaper-image on .wallpaper-layer)
 *   2. Drifting chromatic blobs (CSS ::before)
 *   3. White-wash overlay (CSS ::after, --wallpaper-overlay)
 *
 * The hidden SVG holds the displacement filter referenced from CSS; mounting
 * it once globally means every glass surface shares the same filter ID.
 */
export default function WallpaperLayer({ wallpaperUrl }) {
    const className = wallpaperUrl
        ? 'wallpaper-layer has-image'
        : 'wallpaper-layer fallback';
    return (
        <>
            <div className={className} aria-hidden="true" />
            <GlassLensFilter />
        </>
    );
}

/**
 * Hidden inline SVG holding the lens displacement filter.
 *
 * The filter has TWO inputs:
 *  - feTurbulence generates a fractal-noise texture (the "ripples")
 *  - feDisplacementMap warps the source by the R/G channels of that noise
 *
 * backdrop-filter: url(#glass-lens) applies the filter to whatever is BEHIND
 * the surface, so the wallpaper visibly refracts at the glass edges — the
 * iOS Liquid Glass signature. Scale stays modest (6) so content stays readable.
 */
function GlassLensFilter() {
    return (
        <svg
            width="0"
            height="0"
            aria-hidden="true"
            style={{ position: 'absolute', pointerEvents: 'none', width: 0, height: 0 }}
        >
            <defs>
                <filter id="glass-lens" x="-10%" y="-10%" width="120%" height="120%">
                    <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.014"
                        numOctaves="2"
                        seed="2"
                        result="turb"
                    />
                    <feDisplacementMap
                        in="SourceGraphic"
                        in2="turb"
                        scale="6"
                        xChannelSelector="R"
                        yChannelSelector="G"
                    />
                </filter>
            </defs>
        </svg>
    );
}
