/**
 * useFloatingRect — tracks the DOM rect of the current non-collapsed text
 * selection for a floating bubble, and (unlike the old useSelectionRect) keeps
 * it anchored while the document scrolls or the window resizes. Returns
 * `{ top, left, bottom }` in viewport coords, or null when there's no usable
 * selection.
 */
import { useState, useEffect } from 'react';

export default function useFloatingRect(view, { enabled = true } = {}) {
    const [rect, setRect] = useState(null);

    useEffect(() => {
        if (!view) { setRect(null); return undefined; }
        const update = () => {
            if (!enabled) { setRect(null); return; }
            const sel = view.state.selection;
            const collapsed = sel.type === 'text'
                && sel.anchor.offset === sel.head.offset
                && sel.anchor.path.join() === sel.head.path.join();
            if (sel.type !== 'text' || collapsed) { setRect(null); return; }
            const dsel = window.getSelection();
            if (!dsel || dsel.rangeCount === 0) { setRect(null); return; }
            const r = dsel.getRangeAt(0).getBoundingClientRect();
            if (r.width === 0 && r.height === 0) { setRect(null); return; }
            setRect({ top: r.top, left: r.left, bottom: r.bottom });
        };
        update();
        document.addEventListener('selectionchange', update);
        const scroller = view.host?.closest('.overflow-y-auto') || window;
        scroller.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        return () => {
            document.removeEventListener('selectionchange', update);
            scroller.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
        };
    }, [view, enabled]);

    return rect;
}
