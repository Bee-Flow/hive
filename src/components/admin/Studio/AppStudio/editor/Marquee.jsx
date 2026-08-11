import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppEditor } from '../state/AppEditorContext';

/**
 * App Studio editor — rubber-band (marquee) multi-select overlay.
 *
 * Pointer-dragging on EMPTY canvas draws a selection rectangle; every node
 * whose client rect intersects it is selected (select_many). It deliberately
 * never starts on a node cell (those own their own drag/select via
 * useSortable, and stop pointer propagation) — the guard is a
 * `closest('[data-node-id]')` check so a drag that begins on a component is
 * left entirely to dnd-kit.
 *
 * Geometry is done in VIEWPORT coordinates (getBoundingClientRect + a fixed,
 * portaled rectangle) so canvas scroll never needs to be reconciled. Only
 * transform/opacity are animated — no layout thrash. Disabled while the AI
 * streams (streamLock) or in preview mode.
 */

const DRAG_THRESHOLD = 4; // px before a click becomes a marquee drag

/** Axis-aligned rectangle overlap test (viewport coords). */
export function rectsIntersect(a, b) {
    if (!a || !b) return false;
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** Normalize a drag (anchor → pointer) into a {left,top,right,bottom} rect. */
export function marqueeRect(x0, y0, x1, y1) {
    return {
        left: Math.min(x0, x1),
        top: Math.min(y0, y1),
        right: Math.max(x0, x1),
        bottom: Math.max(y0, y1),
    };
}

/**
 * Pure selection resolver — the node ids whose rect intersects `rect`.
 * `nodeRects` is [{ id, rect }]; returned order follows input order.
 */
export function idsInMarquee(nodeRects, rect) {
    const out = [];
    for (const { id, rect: r } of nodeRects || []) {
        if (id && rectsIntersect(r, rect)) out.push(id);
    }
    return out;
}

export default function Marquee({ surfaceRef }) {
    const { mode, streamLock, dispatch } = useAppEditor();
    const [box, setBox] = useState(null); // active marquee rect (viewport) or null
    const dragRef = useRef(null);

    // Read live mode/lock via a ref so the once-attached listener stays fresh.
    const gateRef = useRef({ mode, streamLock, dispatch });
    useEffect(() => { gateRef.current = { mode, streamLock, dispatch }; });

    useEffect(() => {
        const surface = surfaceRef?.current;
        if (!surface) return undefined;

        const onMove = (e) => {
            const d = dragRef.current;
            if (!d) return;
            if (!d.active) {
                if (Math.abs(e.clientX - d.x0) < DRAG_THRESHOLD && Math.abs(e.clientY - d.y0) < DRAG_THRESHOLD) return;
                d.active = true;
            }
            const rect = marqueeRect(d.x0, d.y0, e.clientX, e.clientY);
            setBox(rect);
            const nodeRects = [];
            for (const el of surface.querySelectorAll('[data-node-id]')) {
                nodeRects.push({ id: el.getAttribute('data-node-id'), rect: el.getBoundingClientRect() });
            }
            gateRef.current.dispatch({ type: 'select_many', ids: idsInMarquee(nodeRects, rect) });
        };

        const finish = () => {
            dragRef.current = null;
            setBox(null);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', finish);
            window.removeEventListener('pointercancel', finish);
        };

        const onDown = (e) => {
            const { mode: m, streamLock: locked } = gateRef.current;
            if (m !== 'edit' || locked || e.button !== 0) return;
            // A drag that begins on a node belongs to dnd-kit, not the marquee.
            if (e.target?.closest?.('[data-node-id]')) return;
            dragRef.current = { x0: e.clientX, y0: e.clientY, active: false };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', finish);
            window.addEventListener('pointercancel', finish);
        };

        surface.addEventListener('pointerdown', onDown);
        return () => {
            surface.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', finish);
            window.removeEventListener('pointercancel', finish);
        };
    }, [surfaceRef]);

    if (!box || typeof document === 'undefined') return null;
    return createPortal(
        <div
            aria-hidden="true"
            data-marquee="true"
            style={{
                position: 'fixed',
                left: box.left,
                top: box.top,
                width: Math.max(0, box.right - box.left),
                height: Math.max(0, box.bottom - box.top),
                zIndex: 40,
                pointerEvents: 'none',
                border: '1px solid var(--editor-accent)',
                background: 'color-mix(in srgb, var(--editor-accent) 12%, transparent)',
                borderRadius: 2,
            }}
        />,
        document.body,
    );
}
