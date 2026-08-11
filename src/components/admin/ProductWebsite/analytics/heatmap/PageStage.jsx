/**
 * The stage: the real page, with the heat on top of it.
 *
 * Coordinate system — the reason this is simpler than it looks. The frame is
 * rendered at exactly the CSS width the clicks were captured at (`width`), so
 * every recorded pageX/pageY is already in the frame's own coordinate space and
 * needs no conversion. Only then is the whole stage scaled down to fit the
 * column, via a CSS transform on the wrapper — the canvas scales with it.
 *
 *   .scroller   overflow, bounded height
 *     .scaler   width*s x height*s          ← reserves the on-screen footprint
 *       .stage  width x height, scale(s)    ← everything inside is 1:1 with the page
 *         iframe / canvas / block outlines / pointer trap
 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import HeatCanvas from './HeatCanvas';
import { blockLabel } from './model';
import { ACCENT } from '../ui';

export default function PageStage({
    frameRef, src, width, height, points, blocks,
    highlightId, onHighlight, mode = 'click', scroll = null, maxHeight = 640,
}) {
    const scrollerRef = useRef(null);
    const [scale, setScale] = useState(1);

    // Fit-to-column. Measured rather than assumed: the side panel and the
    // window can both change the available width.
    useLayoutEffect(() => {
        const el = scrollerRef.current;
        if (!el || !width) return undefined;
        const fit = () => {
            const avail = el.clientWidth - 2;
            setScale(avail > 0 ? Math.min(1, avail / width) : 1);
        };
        fit();
        if (typeof ResizeObserver !== 'function') return undefined;
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        return () => ro.disconnect();
    }, [width]);

    // The frame is mounted before the page has been measured, so it needs a
    // height to occupy in the meantime — otherwise the scroller collapses and
    // the iframe has nothing to render into.
    const h = height || 640;

    return (
        <div
            ref={scrollerRef}
            style={{
                position: 'relative', overflow: 'auto', maxHeight,
                borderRadius: 10, border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
                background: '#fff',
            }}
        >
            <div style={{ width: width * scale, height: h * scale, position: 'relative' }}>
                <div style={{
                    width, height: h || undefined,
                    transform: `scale(${scale})`, transformOrigin: 'top left',
                    position: 'relative',
                }}>
                    <iframe
                        ref={frameRef}
                        src={src}
                        title="Page being analysed"
                        // The frame renders its full height and never scrolls;
                        // the outer scroller does. That keeps document-Y and
                        // on-screen-Y the same number, which is what lets a
                        // recorded pageY land where it was actually clicked.
                        scrolling="no"
                        style={{ width, height: h, border: 0, display: 'block', background: '#fff' }}
                    />

                    {mode === 'click' && (
                        <HeatCanvas points={points} width={width} height={h} />
                    )}

                    {mode === 'scroll' && scroll?.steps?.length > 0 && (
                        <ScrollShade steps={scroll.steps} height={h} width={width} viewportH={scroll.viewportH} />
                    )}

                    {/* Block outlines: hover-linked to the ranking table. */}
                    {blocks?.map(b => (
                        <div
                            key={b.id}
                            aria-hidden="true"
                            style={{
                                position: 'absolute', left: 0, right: 0,
                                top: b.top, height: b.height,
                                pointerEvents: 'none',
                                outline: highlightId === b.id ? `2px solid ${ACCENT}` : 'none',
                                outlineOffset: -2,
                                background: highlightId === b.id ? `${ACCENT}14` : 'transparent',
                                transition: 'background 120ms ease',
                            }}
                        />
                    ))}

                    {/*
                      Pointer trap. Everything below the frame is inert: no link
                      navigation, no hover chrome, no focus stealing. It also
                      gives us hover-to-highlight without touching the frame.
                    */}
                    <div
                        onMouseLeave={() => onHighlight?.(null)}
                        onMouseMove={(e) => {
                            if (!onHighlight || !blocks?.length) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const y = (e.clientY - rect.top) / scale;
                            let hit = null;
                            for (const b of blocks) if (y >= b.top && y < b.top + b.height) hit = b;
                            onHighlight(hit?.id || null);
                        }}
                        style={{ position: 'absolute', inset: 0, cursor: 'crosshair' }}
                    />
                </div>
            </div>
        </div>
    );
}

/**
 * Scroll reach as progressive dimming: the further down the page, the fewer
 * people saw it, the darker it gets. The fold line marks the first screen.
 */
function ScrollShade({ steps, height, width, viewportH }) {
    const bands = [];
    for (let i = 0; i < steps.length; i++) {
        const from = (steps[i].depth / 100) * height;
        const to = i + 1 < steps.length ? (steps[i + 1].depth / 100) * height : height;
        if (to <= from) continue;
        bands.push({
            top: from, height: to - from,
            // 100% reach → no shade; 0% → nearly black.
            alpha: Math.max(0, Math.min(0.78, (1 - steps[i].reach / 100) * 0.82)),
            reach: steps[i].reach,
        });
    }
    return (
        <>
            {bands.map((b, i) => (
                <div key={i} aria-hidden="true" style={{
                    position: 'absolute', left: 0, width, top: b.top, height: b.height,
                    background: `rgba(2,6,23,${b.alpha})`,
                }} />
            ))}
            {viewportH > 0 && viewportH < height && (
                <div style={{ position: 'absolute', left: 0, width, top: viewportH, pointerEvents: 'none' }}>
                    <div style={{ borderTop: `2px dashed ${ACCENT}`, opacity: 0.9 }} />
                    <span style={{
                        display: 'inline-block', marginTop: 4, marginLeft: 8, padding: '2px 8px',
                        borderRadius: 6, background: ACCENT, color: '#06241f',
                        fontSize: 11, fontWeight: 800,
                    }}>
                        The fold — everything below this needs a scroll
                    </span>
                </div>
            )}
        </>
    );
}

export { blockLabel };
