/**
 * Small info icon with a click-to-reveal help popover.
 *
 * Replaces the scattered `<span className="text-xs text-muted">…</span>`
 * pattern across GuardrailsPanel so every knob can have concise inline help
 * without cluttering the default view.
 */

import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';

export default function Info({ children, title, className = '', placement = 'top' }) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const popoverPos = placement === 'bottom'
        ? 'top-full mt-1.5'
        : 'bottom-full mb-1.5';

    return (
        <span ref={wrapRef} className={`relative inline-flex align-middle ${className}`}>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                className="p-0.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                aria-label={title || 'More info'}
                title={title}
            >
                <HelpCircle className="w-3.5 h-3.5" />
            </button>
            {open && (
                <span
                    role="tooltip"
                    className={`absolute left-0 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-lg border shadow-lg p-3 text-xs leading-relaxed ${popoverPos}`}
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                >
                    {title && <div className="font-semibold mb-1">{title}</div>}
                    <div style={{ color: 'var(--text-secondary)' }}>{children}</div>
                </span>
            )}
        </span>
    );
}
