import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * AnchoredMenu — a dropdown panel that is anchored to a trigger element but
 * rendered in a PORTAL to <body>, so no ancestor can clip it.
 *
 * Why this exists (BFSF-328). Menus inside the node-config modal were plain
 * `absolute … top-full` panels. Three things went wrong at once:
 *
 *   1. Clipping. The modal is a clip chain — SettingsForm's `overflow-y-auto`
 *      inside NodeDetailView's `rounded-xl overflow-hidden` — so a menu opened
 *      near the bottom was simply cut off. The overlay also has
 *      `backdrop-blur-sm`, which makes it a containing block for `fixed`
 *      descendants, so even `position: fixed` could not escape it. Only a
 *      portal out of the subtree can.
 *   2. The click-away backdrop (`fixed inset-0`) covered the modal's own
 *      scrollbar, so pressing or dragging the scrollbar closed the menu AND
 *      never reached the scroller.
 *   3. That same backdrop was `position: fixed`, so its scroll chain was the
 *      viewport rather than the modal's scroller — the wheel only worked when
 *      the pointer sat exactly over the menu.
 *
 * The fix is one primitive: portal + measure-and-flip + a document-level
 * mousedown that ignores presses on a scrollbar. It generalises the placement
 * logic already proven by the notebook editor's toolbar Dropdown
 * (src/editor/react/toolbarPrimitives.jsx, BFSF-313/314).
 *
 * Controlled on purpose: every caller already owns `open` (they tie it to
 * focus, to a shared "which menu is open" key, or to a search query).
 *
 * Props:
 *   open        — render the panel
 *   onClose()   — asked to close (outside press, Escape, resize)
 *   anchorRef   — ref to the element the panel hangs off
 *   align       — 'stretch' (match the anchor's width, the default for a
 *                 field-shaped control), 'left' or 'right'
 *   width       — fixed px width; overrides `align: stretch`
 *   minWidth    — px floor (default 180)
 *   maxHeight   — px cap on top of the room-in-the-viewport cap
 *   closeOnEscape — default true
 *   className / style — merged onto the panel
 */
const MENU_MARGIN = 8;
const MENU_GAP = 4;

/**
 * Was this mousedown on an element's SCROLLBAR rather than its content?
 *
 * A scrollbar press must never dismiss the menu — that was the worst half of
 * BFSF-328: the click-away backdrop covered the modal's scrollbar, so grabbing
 * it closed the dropdown and the scroller never even got the press.
 *
 * The border box (getBoundingClientRect) includes the scrollbar gutter; the
 * client box (clientWidth/clientHeight) does not. A point past the client edge
 * but still inside the border box is therefore in the gutter.
 */
export function isScrollbarPress(e) {
    const el = e.target;
    if (!(el instanceof Element)) return false;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (!cw || !ch) return false; // no layout (jsdom) or a zero-size target
    const rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) return false;
    return (e.clientX > rect.left + cw && e.clientX <= rect.right)
        || (e.clientY > rect.top + ch && e.clientY <= rect.bottom);
}

export default function AnchoredMenu({
    open = false,
    onClose,
    anchorRef,
    align = 'stretch',
    width = null,
    minWidth = 180,
    maxHeight = null,
    closeOnEscape = true,
    className = '',
    style = null,
    role = 'listbox',
    children,
    ...rest
}) {
    const panelRef = useRef(null);
    const [placement, setPlacement] = useState(null);

    const position = useCallback(() => {
        const anchor = anchorRef?.current;
        const panel = panelRef.current;
        if (!anchor || !panel) return;
        const rect = anchor.getBoundingClientRect();
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

        const w = Math.max(minWidth, width ?? (align === 'stretch' ? rect.width : panel.offsetWidth || minWidth));
        const natural = panel.scrollHeight || 0;

        const below = vh - rect.bottom - MENU_MARGIN - MENU_GAP;
        const above = rect.top - MENU_MARGIN - MENU_GAP;
        // Prefer opening downwards; flip only when it genuinely does not fit
        // below AND there is more room above.
        const flip = natural > below && above > below;
        let cap = Math.max(120, Math.floor(flip ? above : below));
        if (maxHeight) cap = Math.min(cap, maxHeight);
        const height = Math.min(natural || cap, cap);

        const top = flip
            ? Math.max(MENU_MARGIN, Math.round(rect.top - MENU_GAP - height))
            : Math.round(rect.bottom + MENU_GAP);
        const left = align === 'right'
            ? Math.max(MENU_MARGIN, Math.round(rect.right - w))
            : Math.max(MENU_MARGIN, Math.min(Math.round(rect.left), Math.round(vw - w - MENU_MARGIN)));

        setPlacement(prev => (prev && prev.top === top && prev.left === left && prev.width === w && prev.maxHeight === cap
            ? prev
            : { top, left, width: w, maxHeight: cap }));
    }, [anchorRef, align, width, minWidth, maxHeight]);

    // Measure before paint so the panel never flashes at the wrong spot, and
    // re-measure whenever the content changes size (a filtered list shrinks).
    useLayoutEffect(() => {
        if (!open) { setPlacement(null); return undefined; }
        position();
        if (typeof ResizeObserver === 'undefined' || !panelRef.current) return undefined;
        const ro = new ResizeObserver(() => position());
        ro.observe(panelRef.current);
        return () => ro.disconnect();
    }, [open, position, children]);

    useEffect(() => {
        if (!open) return undefined;

        const onDown = (e) => {
            if (panelRef.current?.contains(e.target)) return;
            if (anchorRef?.current?.contains(e.target)) return;
            if (isScrollbarPress(e)) return;
            onClose?.();
        };
        const onKey = (e) => { if (closeOnEscape && e.key === 'Escape') onClose?.(); };
        // Reposition rather than close when the surrounding page scrolls — the
        // author is usually scrolling the very form the menu belongs to. The
        // panel's own scrolling never reaches here (it is `overscroll-contain`
        // and this listener skips targets inside the panel).
        const onScroll = (e) => { if (panelRef.current?.contains(e.target)) return; position(); };
        const onResize = () => position();

        document.addEventListener('mousedown', onDown, true);
        document.addEventListener('keydown', onKey);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        return () => {
            document.removeEventListener('mousedown', onDown, true);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
        };
    }, [open, onClose, anchorRef, closeOnEscape, position]);

    if (!open || typeof document === 'undefined') return null;

    const panelStyle = {
        position: 'fixed',
        // First paint happens off-screen so the measuring pass can read the
        // natural height without the user seeing the panel in the wrong place.
        top: placement ? placement.top : -9999,
        left: placement ? placement.left : -9999,
        width: placement ? placement.width : (width || minWidth),
        maxHeight: placement ? placement.maxHeight : undefined,
        zIndex: 10050,
        overflowY: 'auto',
        // Keeps a wheel that reaches the end of the list from scrolling the
        // modal behind it.
        overscrollBehavior: 'contain',
        ...(style || null),
    };

    return createPortal(
        <div
            ref={panelRef}
            role={role}
            data-anchored-menu=""
            className={`rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-lg custom-scrollbar ${className}`}
            style={panelStyle}
            {...rest}
        >
            {children}
        </div>,
        document.body,
    );
}
