import { ChevronRight } from 'lucide-react';
import React, { useState } from 'react';
import scopedStorage from '../../../../../utils/scopedStorage';

/**
 * Dense, inspector-scoped disclosure used to hide advanced/optional fields
 * behind a "Show N more options" toggle. Keeps the default config view
 * compact (the screenshot's wall of fields was the original complaint).
 *
 * Modes:
 *   - Uncontrolled (default): manages its own open state. Pass `persistKey`
 *     to remember the state per-user via scopedStorage.
 *   - Controlled: pass `open` + `onToggle`.
 *
 * `count` (optional) renders the n8n-style "Show N more options" /
 * "Fewer options" label and an optional `badge` (e.g. number of
 * auto-mapped fields) so collapsed content never silently hides state.
 */
export default function CollapsibleSection({
    title = 'Advanced',
    count = null,
    badge = null,
    defaultOpen = false,
    open: controlledOpen,
    onToggle,
    persistKey = null,
    children,
}) {
    const isControlled = controlledOpen != null && typeof onToggle === 'function';
    const [internalOpen, setInternalOpen] = useState(() => {
        if (persistKey) return scopedStorage.getItem(`collapse.${persistKey}`) === '1';
        return defaultOpen;
    });
    const open = isControlled ? controlledOpen : internalOpen;

    const toggle = () => {
        if (isControlled) { onToggle(!open); return; }
        const next = !open;
        setInternalOpen(next);
        if (persistKey) scopedStorage.setItem(`collapse.${persistKey}`, next ? '1' : '0');
    };

    const label = count != null
        ? (open ? 'Fewer options' : `Show ${count} more option${count === 1 ? '' : 's'}`)
        : title;

    return (
        <div className="border-t border-[var(--border-default)]/60 pt-1.5">
            <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                className="w-full flex items-center gap-1.5 py-1 text-[11px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition"
            >
                <ChevronRight
                    size={12}
                    className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
                />
                <span>{label}</span>
                {badge != null && (
                    <span className="ml-1 normal-case tracking-normal text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">
                        {badge}
                    </span>
                )}
            </button>
            {open && <div className="pt-1 space-y-3">{children}</div>}
        </div>
    );
}
