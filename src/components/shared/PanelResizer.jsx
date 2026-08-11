import React, { useCallback, useRef } from 'react';

/**
 * PanelResizer — a 5px vertical drag strip between a shell's panels and its
 * stage. Written for the CMS builder (WS3-P5) and shared since: the App Studio
 * editor needs exactly this, and a second implementation would be a second set
 * of keyboard bugs. Pointer-event based (works for mouse,
 * pen and touch via setPointerCapture); double-click resets to the
 * panel's default width; arrow keys nudge by 16px for keyboard users.
 *
 * Controlled: the parent owns the width. `edge` says which side of the
 * strip the panel being resized sits on:
 *   'start' — panel is LEFT of the strip (navigator): dragging right grows it
 *   'end'   — panel is RIGHT of the strip (inspector): dragging left grows it
 *
 * Props:
 *   width          — current panel width (px)
 *   min / max      — clamp bounds
 *   defaultWidth   — double-click reset target
 *   edge           — 'start' | 'end'
 *   onResize(w)    — every move during a drag (parent sets state)
 *   onResizeEnd(w) — pointer released (parent persists)
 *   label          — aria-label for the separator
 */
export default function PanelResizer({
    width,
    min,
    max,
    defaultWidth,
    edge = 'start',
    onResize,
    onResizeEnd,
    label = 'Resize panel',
}) {
    const dragRef = useRef(null); // { startX, startWidth }
    const clamp = useCallback(
        (w) => Math.max(min, Math.min(max, Math.round(w))),
        [min, max]);

    const onPointerDown = (e) => {
        // Primary button / touch only.
        if (e.button !== undefined && e.button !== 0) return;
        dragRef.current = { startX: e.clientX, startWidth: width };
        e.currentTarget.setPointerCapture?.(e.pointerId);
        e.preventDefault();
    };
    const onPointerMove = (e) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = e.clientX - drag.startX;
        const next = clamp(drag.startWidth + (edge === 'start' ? dx : -dx));
        if (next !== width) onResize?.(next);
    };
    const endDrag = (e) => {
        if (!dragRef.current) return;
        dragRef.current = null;
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        onResizeEnd?.(width);
    };
    const onKeyDown = (e) => {
        const grow = edge === 'start' ? 'ArrowRight' : 'ArrowLeft';
        const shrink = edge === 'start' ? 'ArrowLeft' : 'ArrowRight';
        let next = null;
        if (e.key === grow) next = clamp(width + 16);
        else if (e.key === shrink) next = clamp(width - 16);
        else if (e.key === 'Home') next = min;
        else if (e.key === 'End') next = max;
        if (next !== null) {
            e.preventDefault();
            onResize?.(next);
            onResizeEnd?.(next);
        }
    };

    return (
        <div
            role="separator"
            aria-orientation="vertical"
            aria-label={label}
            aria-valuenow={width}
            aria-valuemin={min}
            aria-valuemax={max}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => {
                onResize?.(clamp(defaultWidth));
                onResizeEnd?.(clamp(defaultWidth));
            }}
            onKeyDown={onKeyDown}
            className="shrink-0 h-full w-[5px] cursor-col-resize -mx-[2px] z-10 relative
                bg-transparent hover:bg-[var(--editor-accent,var(--accent-primary))]/30 focus-visible:bg-[var(--editor-accent,var(--accent-primary))]/40
                focus:outline-none transition-colors"
            style={{ touchAction: 'none' }}
        />
    );
}
