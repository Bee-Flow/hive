import React, { useEffect, useRef } from 'react';

/**
 * Lightweight click-outside-to-close popover anchored at an absolute
 * (clientX, clientY) — the natural shape for a right-click row menu.
 *
 * Caller controls visibility via the `position` prop:
 *   - position === null → closed
 *   - position === { x, y } → open at that viewport-relative point
 *
 * Items: `{ label, icon?, onClick, danger?, separator? }`. A separator
 * item just renders a hairline divider — no click handler.
 */
export default function ContextMenu({ position, items, onClose }) {
    const ref = useRef(null);

    useEffect(() => {
        if (!position) return;
        const onDoc = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onClose();
        };
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [position, onClose]);

    if (!position) return null;

    // Avoid spilling off the right/bottom edges of the viewport.
    const x = Math.min(position.x, window.innerWidth - 220);
    const y = Math.min(position.y, window.innerHeight - 220);

    return (
        <div
            ref={ref}
            className="fixed z-[2000] min-w-[200px] rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl py-1 text-sm"
            style={{ left: x, top: y }}
        >
            {items.map((item, i) => {
                if (item.separator) {
                    return <div key={`sep-${i}`} className="my-1 border-t border-[var(--border-default)]" />;
                }
                return (
                    <button
                        key={i}
                        onClick={() => { item.onClick?.(); onClose(); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition ${
                            item.danger
                                ? 'text-red-500 hover:bg-red-500/10'
                                : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                        }`}
                    >
                        {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.shortcut && (
                            <span className="text-[10px] text-[var(--text-tertiary)] font-mono">{item.shortcut}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
