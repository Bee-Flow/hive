import React, { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modal — accessible dialog with backdrop, focus trap, ESC-to-close, and
 * focus restoration on unmount.
 *
 * Replaces the ad-hoc inline "[showX, setShowX] + fixed div + click-outside"
 * patterns across the admin panels and chat pickers. Pair with the existing
 * useModal() hook for open/close state.
 *
 *   const modal = useModal();
 *   <Modal open={modal.isOpen} onClose={modal.close} title="Edit">
 *     ...body
 *   </Modal>
 *
 * Three size presets cover the common cases; pass className to escape the
 * preset when you need a custom width.
 */

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    description?: React.ReactNode;
    /** Optional element rendered in the header's right slot (e.g. close X). */
    headerActions?: React.ReactNode;
    /** Optional footer slot (typically action buttons). */
    footer?: React.ReactNode;
    size?: ModalSize;
    /** Disables backdrop-click-to-close (use for destructive confirmations). */
    disableBackdropClose?: boolean;
    /** Disables ESC-to-close (rare; mostly for nested modals). */
    disableEscapeClose?: boolean;
    children?: React.ReactNode;
    /** Extra classes for the panel container. */
    className?: string;
    /** ID of the element that labels the dialog. Falls back to internal id. */
    labelledBy?: string;
}

const SIZE: Record<ModalSize, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw] max-h-[95vh]',
};

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({
    open,
    onClose,
    title,
    description,
    headerActions,
    footer,
    size = 'md',
    disableBackdropClose = false,
    disableEscapeClose = false,
    children,
    className = '',
    labelledBy,
}: ModalProps) {
    const panelRef = useRef<HTMLDivElement | null>(null);
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);
    const internalLabelId = useId();
    const titleId = labelledBy ?? (title != null ? internalLabelId : undefined);

    // ESC-to-close. Listener is attached to the document so the dialog can
    // be closed regardless of which inner element has focus.
    useEffect(() => {
        if (!open || disableEscapeClose) return undefined;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, disableEscapeClose, onClose]);

    // Focus management: save previously-focused element on open, focus the
    // first interactive element inside the dialog (or the panel itself
    // if none), and restore focus on close.
    useEffect(() => {
        if (!open) return undefined;
        previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
        const panel = panelRef.current;
        if (panel) {
            const focusable = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
            (focusable ?? panel).focus();
        }
        return () => {
            previouslyFocusedRef.current?.focus?.();
        };
    }, [open]);

    // Minimal focus trap: keep Tab/Shift+Tab inside the panel.
    const onPanelKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'Tab') return;
        const panel = panelRef.current;
        if (!panel) return;
        const items = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (items.length === 0) {
            e.preventDefault();
            return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && active === last) {
            e.preventDefault();
            first.focus();
        }
    }, []);

    if (!open) return null;
    if (typeof document === 'undefined') return null;

    const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (disableBackdropClose) return;
        // Only close on direct clicks of the backdrop itself.
        if (e.target === e.currentTarget) onClose();
    };

    return createPortal(
        <div
            role="presentation"
            onMouseDown={onBackdropClick}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                onKeyDown={onPanelKeyDown}
                className={
                    `relative w-full ${SIZE[size]} rounded-xl border border-[var(--border-subtle)] ` +
                    'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-2xl outline-none ' +
                    'flex flex-col max-h-[90vh] ' +
                    className
                }
            >
                {(title != null || description != null || headerActions != null) && (
                    <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border-subtle)]">
                        <div className="min-w-0">
                            {title != null && (
                                <h2 id={titleId} className="text-base font-semibold">{title}</h2>
                            )}
                            {description != null && (
                                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{description}</p>
                            )}
                        </div>
                        {headerActions != null && (
                            <div className="flex-shrink-0">{headerActions}</div>
                        )}
                    </header>
                )}
                <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
                {footer != null && (
                    <footer className="px-5 py-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
                        {footer}
                    </footer>
                )}
            </div>
        </div>,
        document.body,
    );
}
