import React, { useEffect, useRef, useState } from 'react';

/**
 * Minimal TopBar dropdown: trigger + anchored panel with click-outside and
 * Escape to close. No portal — the TopBar sits at the top of the builder
 * with nothing clipping descendants, so absolute positioning is enough.
 *
 * `trigger` is a render-prop receiving `{ open }` so triggers can flip their
 * chevron; `align` anchors the panel to the trigger's left or right edge.
 */
export default function Dropdown({ trigger, children, align = 'left', width = 288, panelClassName = '', onOpenChange }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);

    return (
        <div ref={rootRef} className="relative">
            <div onClick={() => setOpen(o => !o)}>{trigger({ open })}</div>
            {open && (
                <div
                    className={`absolute z-40 mt-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-xl ${align === 'right' ? 'right-0' : 'left-0'} ${panelClassName}`}
                    style={{ width, top: '100%' }}
                >
                    {children({ close: () => setOpen(false) })}
                </div>
            )}
        </div>
    );
}
