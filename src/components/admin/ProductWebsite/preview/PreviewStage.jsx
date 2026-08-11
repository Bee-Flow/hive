import React, { useEffect, useRef, useState } from 'react';
import AppIcon from '../../../AppIcon';
import { useStageViewport, toggleStageRotate } from '../shell/DeviceToggle';

/**
 * Center stage — the always-mounted preview iframe plus the Sitemap and AI
 * views. The iframe node is BUILT BY THE CONTAINER (it owns iframeRef and
 * the `key={activeLocale}` remount semantics) and passed in as a slot; this
 * component only decides what is visible. The iframe keeps its state across
 * view switches via the `hidden` class, exactly like the old Pane C.
 *
 * `deviceWidth` (px, null = full) narrows the iframe wrapper for the
 * tablet/mobile preview — a pure max-width, no protocol change.
 *
 * WS3-P5 stage viewport:
 *   - Zoom (Fit/50/75/100%, from the DeviceToggle store) scales the iframe
 *     wrapper with a CSS transform; the wrapper keeps a fixed logical width
 *     (device width, or 1280 for desktop) and compensates height by 1/scale
 *     so the full stage height stays usable. Desktop at 100% keeps the
 *     legacy fill-the-stage behaviour byte-for-byte.
 *   - Device frame v2: width badge under the frame, a subtle rounded bezel
 *     + notch bar for the mobile preset, and a rotate button swapping
 *     390 ↔ 844 (store-backed, session-only).
 */

const DESKTOP_FRAME_WIDTH = 1280;
const MOBILE_PORTRAIT = 390;
const MOBILE_LANDSCAPE = 844;

export default function PreviewStage({
    view,               // 'preview' | 'sitemap'
    statusText,         // context string, preview only
    iframe,             // the <iframe> node (container-owned ref/key)
    sitemap,            // <SitemapView> node — mounted only while view==='sitemap'
    deviceWidth = null,
    overlay = null,     // empty-state overlay node (no pages / no blocks)
    errorText = null,   // panel-level error surfaced as a dismissible strip
    onDismissError,
}) {
    const { zoom, rotated } = useStageViewport();

    // Measure the scroll area so 'fit' can compute its scale and the
    // scaled wrapper can fill the visible height.
    const areaRef = useRef(null);
    const [area, setArea] = useState({ w: 0, h: 0 });
    useEffect(() => {
        const el = areaRef.current;
        if (!el) return undefined;
        const measure = () => setArea({ w: el.clientWidth, h: el.clientHeight });
        measure();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', measure);
            return () => window.removeEventListener('resize', measure);
        }
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [view]);

    const isMobile = deviceWidth === MOBILE_PORTRAIT;
    const effectiveWidth = isMobile && rotated ? MOBILE_LANDSCAPE : deviceWidth;
    const frameWidth = effectiveWidth || DESKTOP_FRAME_WIDTH;

    const fitScale = area.w > 24 ? Math.min(1, (area.w - 24) / frameWidth) : 1;
    const scale = zoom === 'fit' ? fitScale : (parseFloat(zoom) || 1);

    // Desktop at 100% zoom — the legacy fill-everything path (no fixed
    // 1280 frame, no badge): identical markup to the pre-zoom stage.
    const plainDesktop = !effectiveWidth && scale === 1;

    // Visible height for the scaled frame: the measured area minus the
    // badge row; the inner (unscaled) wrapper compensates by 1/scale.
    const chromePad = isMobile ? 56 : 32;
    const visibleHeight = Math.max(200, area.h - chromePad);

    return (
        <div className="flex-1 min-w-0 h-full flex flex-col bg-[var(--bg-primary)]">
            {errorText ? (
                <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border-b border-red-500/30">
                    <span className="flex-1 text-xs text-red-400 truncate" title={errorText}>{errorText}</span>
                    {onDismissError && (
                        <button
                            type="button"
                            onClick={onDismissError}
                            className="text-xs text-red-400 hover:text-red-300 px-1"
                            title="Dismiss"
                        >
                            ✕
                        </button>
                    )}
                </div>
            ) : null}
            {/* status strip */}
            {view === 'preview' && statusText ? (
                <div className="h-6 shrink-0 flex items-center justify-end px-3">
                    <span className="text-[10px] text-[var(--text-muted)]">{statusText}</span>
                </div>
            ) : null}

            {/* preview — kept mounted so iframe state survives view switches */}
            <div className={`flex-1 min-h-0 flex-col ${view === 'preview' ? 'flex' : 'hidden'}`}>
                {plainDesktop ? (
                    <div ref={areaRef} className="flex-1 min-h-0 flex justify-center px-0">
                        <div className="relative flex-1 min-h-0 flex flex-col">
                            {iframe}
                            {overlay}
                        </div>
                    </div>
                ) : (
                    <div ref={areaRef} className="flex-1 min-h-0 overflow-auto">
                        <div className="min-h-full flex flex-col items-center pt-1 pb-2">
                            {/* Device frame */}
                            <div
                                className={`relative shrink-0 overflow-hidden ${isMobile
                                    ? 'rounded-[1.4rem] border-[5px] border-[color:var(--border-default)] shadow-xl bg-[var(--bg-secondary)]'
                                    : effectiveWidth
                                        ? 'border border-[var(--border-subtle)] shadow-lg'
                                        : 'border border-[var(--border-subtle)] shadow-sm'}`}
                                style={{ width: Math.round(frameWidth * scale) }}
                            >
                                {/* Notch bar (mobile bezel only) */}
                                {isMobile ? (
                                    <div className="h-5 flex items-center justify-center bg-[var(--bg-tertiary)]">
                                        <div className="w-14 h-2 rounded-full bg-[var(--border-default)]" />
                                    </div>
                                ) : null}
                                {/* Scaled viewport: fixed logical width, height
                                    compensated by 1/scale so the frame shows a
                                    full stage-height of page. */}
                                <div style={{ width: Math.round(frameWidth * scale), height: visibleHeight, overflow: 'hidden' }}>
                                    <div
                                        className="relative flex flex-col"
                                        style={{
                                            width: frameWidth,
                                            height: Math.ceil(visibleHeight / scale),
                                            transform: `scale(${scale})`,
                                            transformOrigin: 'top left',
                                        }}
                                    >
                                        {iframe}
                                    </div>
                                </div>
                                {/* Empty-state overlay stays unscaled, over the frame */}
                                {overlay ? <div className="absolute inset-0">{overlay}</div> : null}
                            </div>
                            {/* Width badge + rotate */}
                            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                                <span>{frameWidth}px</span>
                                {scale !== 1 ? <span>· {Math.round(scale * 100)}%</span> : null}
                                {isMobile ? (
                                    <button
                                        type="button"
                                        onClick={toggleStageRotate}
                                        title={rotated ? 'Rotate to portrait (390px)' : 'Rotate to landscape (844px)'}
                                        aria-label="Rotate device preview"
                                        className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                                    >
                                        <AppIcon name="RotateCw" className="w-3 h-3" />
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* sitemap */}
            {view === 'sitemap' && (
                <div className="flex-1 min-h-0 flex flex-col">{sitemap}</div>
            )}
        </div>
    );
}
