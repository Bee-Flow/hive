import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

/**
 * ModalShell — the ONE dialog container for the CMS admin.
 *
 * Portals to document.body, dims the rest of the UI, and centers a card
 * that scrolls internally on small screens. Escape and backdrop click
 * close; `aria-modal` + `aria-labelledby` for screen readers. No focus
 * trap (deliberate — these dialogs are small and short-lived), but
 * children's `autoFocus` works as usual since the portal mounts synchronously.
 *
 * Grown out of PageList's local ModalOverlay (SaveTemplateDialog /
 * TemplatesManagerDialog) — same markup, plus width presets.
 *
 * Props:
 *   onClose    — called on Escape / backdrop click
 *   labelledBy — id of the dialog's heading element
 *   width      — 'sm' | 'md' | 'lg' (default 'md', the old max-w-md)
 */

const WIDTHS = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
};

export default function ModalShell({ children, onClose, labelledBy, width = 'md' }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    return ReactDOM.createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            className="fixed inset-0 z-[1100] flex items-start sm:items-center justify-center p-4 overflow-y-auto"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
            style={{ background: 'rgba(0,0,0,0.55)' }}
        >
            <div
                className={`w-full ${WIDTHS[width] || WIDTHS.md} rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-xl my-8 max-h-[calc(100vh-4rem)] overflow-y-auto`}
                onMouseDown={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}
