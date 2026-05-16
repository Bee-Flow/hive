import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

export function Modal({ open, onClose, title, subtitle, children, footer, width = 'max-w-md' }) {
    useEffect(() => {
        if (!open) return;
        const onKey = e => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}
        >
            <div className={`w-full ${width} bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}>
                <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[var(--border-default)]">
                    <div className="min-w-0">
                        {title && <h3 className="text-base font-bold text-[var(--text-primary)] truncate">{title}</h3>}
                        {subtitle && <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{subtitle}</p>}
                    </div>
                    <IconButton icon={X} size="sm" onClick={onClose} title="Close" />
                </div>
                <div className="px-5 py-4 overflow-y-auto">{children}</div>
                {footer && (
                    <div className="px-5 py-3 border-t border-[var(--border-default)] bg-[var(--bg-tertiary)]/40 flex justify-end gap-2">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', confirmTone = 'danger', busy = false }) {
    return (
        <Modal
            open={open}
            onClose={busy ? undefined : onClose}
            title={title}
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="px-3.5 py-2 rounded-lg text-[13px] font-semibold border border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                        className={`px-3.5 py-2 rounded-lg text-[13px] font-semibold border ${
                            confirmTone === 'danger'
                                ? 'bg-rose-600 hover:bg-rose-500 text-white border-transparent'
                                : 'bg-blue-600 hover:bg-blue-500 text-white border-transparent'
                        } disabled:opacity-50`}
                    >
                        {busy ? 'Working…' : confirmLabel}
                    </button>
                </>
            }
        >
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{message}</p>
        </Modal>
    );
}
