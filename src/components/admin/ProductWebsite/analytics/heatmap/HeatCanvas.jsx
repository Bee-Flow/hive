/**
 * Click density, drawn over the real page.
 *
 * This is the one place in the app that uses canvas 2d. It is here because a
 * density field genuinely cannot be expressed with the SVG/div charts the rest
 * of the dashboard uses, and because the thing it replaces — a 24x32 grid of
 * coloured squares floating on nothing — could show THAT clicks happened but
 * never WHAT was clicked.
 *
 * It is decorative by construction: `aria-hidden`, no pointer events, and the
 * block-ranking table beside it carries the same information in text. jsdom has
 * no 2d context, so the component simply renders an empty canvas under test.
 *
 * Technique: draw each point as a greyscale radial gradient into an offscreen
 * alpha buffer (so overlapping clicks accumulate), then map the accumulated
 * intensity through a colour ramp in one pass. Painting coloured blobs directly
 * would make overlaps muddy instead of hot.
 */
import React, { useEffect, useRef } from 'react';

// Teal → green → amber → red. No purple/violet/indigo (house rule), and the
// ramp is monotonic in lightness so it survives greyscale printing.
const RAMP = [
    { at: 0.00, rgb: [20, 184, 166] },
    { at: 0.35, rgb: [16, 185, 129] },
    { at: 0.60, rgb: [245, 158, 11] },
    { at: 0.80, rgb: [249, 115, 22] },
    { at: 1.00, rgb: [239, 68, 68] },
];

function rampAt(t) {
    const x = Math.max(0, Math.min(1, t));
    for (let i = 1; i < RAMP.length; i++) {
        if (x <= RAMP[i].at) {
            const a = RAMP[i - 1];
            const b = RAMP[i];
            const k = (x - a.at) / (b.at - a.at || 1);
            return [
                Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * k),
                Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * k),
                Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * k),
            ];
        }
    }
    return RAMP[RAMP.length - 1].rgb;
}

/** 256-entry lookup table so the per-pixel loop does no interpolation. */
function buildLut() {
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
        const [r, g, b] = rampAt(i / 255);
        lut[i * 3] = r; lut[i * 3 + 1] = g; lut[i * 3 + 2] = b;
    }
    return lut;
}
const LUT = buildLut();

/**
 * @param points  [{ x, y, count }] in PAGE coordinates (same space as width/height)
 * @param width   page width the points were captured at
 * @param height  full page height
 * @param radius  blob radius in page px
 * @param opacity overall layer opacity
 */
export default function HeatCanvas({ points, width, height, radius = 28, opacity = 0.72 }) {
    const ref = useRef(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas || !width || !height) return;
        // jsdom (and any browser with canvas disabled) returns null here.
        const ctx = canvas.getContext?.('2d');
        if (!ctx) return;

        // Cap the backing store: a 1280x12000 page at devicePixelRatio 2 would
        // otherwise allocate ~120M pixels and stall the tab.
        const MAX_PIXELS = 8_000_000;
        const dpr = Math.min(
            window.devicePixelRatio || 1,
            Math.sqrt(MAX_PIXELS / Math.max(1, width * height)),
        );
        const w = Math.max(1, Math.round(width * dpr));
        const h = Math.max(1, Math.round(height * dpr));
        canvas.width = w;
        canvas.height = h;

        ctx.clearRect(0, 0, w, h);
        if (!points?.length) return;

        let peak = 1;
        for (const p of points) if (p.count > peak) peak = p.count;

        // Pass 1 — accumulate intensity as alpha.
        const r = Math.max(4, radius * dpr);
        for (const p of points) {
            const cx = p.x * dpr;
            const cy = p.y * dpr;
            if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue;
            // sqrt keeps a single click visible next to a hotspot of 50 without
            // letting the hotspot saturate everything around it.
            const weight = Math.sqrt((p.count || 1) / peak);
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            g.addColorStop(0, `rgba(0,0,0,${0.85 * weight})`);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Pass 2 — recolour by accumulated alpha.
        const img = ctx.getImageData(0, 0, w, h);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const a = d[i + 3];
            if (a === 0) continue;
            const o = a * 3;
            d[i] = LUT[o];
            d[i + 1] = LUT[o + 1];
            d[i + 2] = LUT[o + 2];
            // Ease the alpha up so faint tails stay visible without a hard edge.
            d[i + 3] = Math.min(255, Math.round(Math.sqrt(a / 255) * 255 * opacity));
        }
        ctx.putImageData(img, 0, 0);
    }, [points, width, height, radius, opacity]);

    return (
        <canvas
            ref={ref}
            aria-hidden="true"
            data-testid="heat-canvas"
            style={{
                position: 'absolute', top: 0, left: 0,
                width: width ? `${width}px` : '100%',
                height: height ? `${height}px` : '100%',
                pointerEvents: 'none',
            }}
        />
    );
}
