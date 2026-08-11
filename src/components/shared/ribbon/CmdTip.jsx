import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * An Office-style screen tip for a ribbon command: the command's FULL name in
 * bold, what it does underneath, and how else you can use it.
 *
 * Why not the native `title` attribute it replaces: it takes about a second to
 * appear, cannot be styled or line-broken, is invisible on touch, and never
 * shows on keyboard focus. So the one-line description of every step in the
 * catalog was written, shipped, and effectively unreadable — on the ribbon,
 * which is the DEFAULT add surface. Non-technical authors were picking steps by
 * name alone, and the names were also being clipped at 8rem.
 *
 * Why not render the description inline on the button instead: RibbonCluster is
 * a `grid-rows-2` grid, so a two-line button doubles the height of every ribbon
 * group on the page.
 *
 * Portalled to <body> and positioned from the button's own rect, so it is not
 * clipped by the ribbon's horizontal scroll container. Safe where a node-card
 * popover was not (see StepNodeBase): nothing sits under the ribbon but empty
 * canvas, and any pointer movement off the button dismisses it.
 */

const GAP = 8;

export default function CmdTip({ anchorRef, title, desc, footer, open }) {
    const tipRef = useRef(null);

    // Position by writing to the node's own style rather than through state:
    // measuring and then setting state would render the tip twice, and the
    // first pass would paint it in the wrong place.
    useLayoutEffect(() => {
        const tip = tipRef.current;
        const anchor = anchorRef?.current;
        if (!open || !tip || !anchor) return;
        const a = anchor.getBoundingClientRect();
        const { width, height } = tip.getBoundingClientRect();
        // Below the button by default; above it when there is no room, so a
        // ribbon near the bottom of a short window still shows its tips.
        const below = a.bottom + GAP + height <= window.innerHeight;
        tip.style.top = `${below ? a.bottom + GAP : Math.max(GAP, a.top - GAP - height)}px`;
        tip.style.left = `${Math.min(Math.max(GAP, a.left), Math.max(GAP, window.innerWidth - width - GAP))}px`;
        tip.style.visibility = 'visible';
    }, [open, anchorRef, title, desc, footer]);

    // Escape dismisses without moving the pointer. The tip is not focusable, so
    // the key lands on whatever is (usually the button itself).
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') anchorRef?.current?.blur?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, anchorRef]);

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div
            ref={tipRef}
            role="tooltip"
            className="fixed z-[60] pointer-events-none max-w-[17rem] rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2.5 py-2 shadow-lg"
            // Hidden (but laid out, so it can be measured) until the effect
            // above places it.
            style={{ top: 0, left: 0, visibility: 'hidden' }}
        >
            <div className="text-xs font-semibold text-[var(--text-primary)]">{title}</div>
            {desc && <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">{desc}</div>}
            {footer && <div className="mt-1 text-[10px] text-[var(--text-tertiary)]">{footer}</div>}
        </div>,
        document.body,
    );
}
