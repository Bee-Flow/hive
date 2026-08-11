import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

/**
 * Ribbon dropdown: a pill trigger + a body-portalled, fixed-position panel.
 *
 * The panel is portalled to <body> because ribbons live inside headers /
 * canvases that create stacking contexts (and may clip overflow) — an in-flow
 * absolute panel ends up trapped behind the canvas or cut off. A fixed,
 * body-portalled panel escapes every ancestor.
 *
 * The panel carries `data-ribbon-dropdown`; callers owning outside-click
 * handling must ignore mousedowns inside `[data-ribbon-dropdown]`, or
 * item-selection unmounts the portal before the click registers.
 *
 * Trigger glyph: `icon` (lucide component) wins over `glyph` (pre-sized
 * ReactNode, e.g. an <IntegrationLogo/>).
 */
export default function RibbonDropdown({
    label,
    icon: Icon = null,
    glyph = null,
    open,
    onToggle,
    children,
    align = 'left',
    width = 300,
}) {
    const btnRef = useRef(null);
    const [pos, setPos] = useState(null);

    useLayoutEffect(() => {
        if (!open || !btnRef.current) return undefined;
        const place = () => {
            const r = btnRef.current.getBoundingClientRect();
            const left = align === 'right' ? r.right - width : r.left;
            const clampedLeft = Math.max(8, Math.min(left, window.innerWidth - width - 8));
            setPos({ top: r.bottom + 4, left: clampedLeft });
        };
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
    }, [open, align, width]);

    const resolvedGlyph = Icon ? <Icon size={14} /> : glyph;
    return (
        <div className="relative">
            <button
                ref={btnRef}
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition ${
                    open
                        ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                }`}
            >
                {resolvedGlyph}
                <span className="truncate max-w-[8rem]">{label}</span>
                <ChevronDown size={12} className="opacity-60" />
            </button>
            {open && pos && createPortal(
                <div
                    data-ribbon-dropdown
                    style={{ position: 'fixed', top: pos.top, left: pos.left, width }}
                    className="z-[1000] max-h-[60vh] flex flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl overflow-hidden"
                >
                    {children}
                </div>,
                document.body,
            )}
        </div>
    );
}
