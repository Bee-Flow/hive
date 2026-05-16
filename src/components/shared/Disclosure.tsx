import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Disclosure — animated collapsible. Used for "Advanced options" panels and
 * any settings section that's not load-bearing at a glance.
 *
 * Controlled (`open` + `onOpenChange`) or uncontrolled (`defaultOpen`).
 */

export interface DisclosureProps {
    title: React.ReactNode;
    hint?: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    className?: string;
    /** Visual variant — 'inline' (chevron + label) or 'card' (bordered panel). */
    variant?: 'inline' | 'card';
}

export default function Disclosure({
    title,
    hint,
    children,
    defaultOpen = false,
    open: controlledOpen,
    onOpenChange,
    className = '',
    variant = 'inline',
}: DisclosureProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const open = controlledOpen ?? uncontrolledOpen;
    const setOpen = (next: boolean) => {
        if (controlledOpen === undefined) setUncontrolledOpen(next);
        onOpenChange?.(next);
    };
    const headerId = useId();
    const panelId = useId();

    const wrapperBase =
        variant === 'card'
            ? 'rounded-xl border'
            : '';
    const wrapperStyle: React.CSSProperties =
        variant === 'card'
            ? { borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }
            : {};

    return (
        <div className={`${wrapperBase} ${className}`} style={wrapperStyle}>
            <button
                id={headerId}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen(!open)}
                className={
                    'w-full flex items-center gap-2 text-left transition-colors ' +
                    (variant === 'card' ? 'px-4 py-3 hover:bg-[var(--bg-tertiary)]/30 rounded-xl' : 'py-1')
                }
                style={{ color: 'var(--text-secondary)' }}
            >
                <ChevronDown
                    className="w-3.5 h-3.5 transition-transform shrink-0"
                    style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                />
                <span className="text-xs font-semibold uppercase tracking-wider flex-1 min-w-0 truncate">
                    {title}
                </span>
                {hint != null && (
                    <span className="text-[11px] text-[var(--text-muted)] shrink-0">{hint}</span>
                )}
            </button>
            {open && (
                <div
                    id={panelId}
                    role="region"
                    aria-labelledby={headerId}
                    className={variant === 'card' ? 'px-4 pb-4 pt-1' : 'mt-3'}
                >
                    {children}
                </div>
            )}
        </div>
    );
}
