import React, { useState } from 'react';
import Modal from './Modal';
import Spinner from './Spinner';

/**
 * ConfirmDialog — small wrapper around <Modal/> for the "are you sure?"
 * pattern. Replaces the inline window.confirm() / ad-hoc inline modal
 * blocks scattered across admin panels.
 *
 *   const [confirmDelete, setConfirmDelete] = useState(false);
 *   <ConfirmDialog
 *     open={confirmDelete}
 *     title="Delete plan?"
 *     description="This cannot be undone."
 *     destructive
 *     onConfirm={async () => { await del(planId); setConfirmDelete(false); }}
 *     onCancel={() => setConfirmDelete(false)}
 *   />
 *
 * If onConfirm returns a Promise the confirm button shows a spinner while
 * it resolves and stays disabled to prevent double-submits.
 */

export interface ConfirmDialogProps {
    open: boolean;
    title: React.ReactNode;
    description?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    /** When true, the confirm button uses a rose/danger tint. */
    destructive?: boolean;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
}

export default function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const [busy, setBusy] = useState(false);

    const handleConfirm = async () => {
        try {
            setBusy(true);
            await onConfirm();
        } finally {
            setBusy(false);
        }
    };

    const confirmClasses =
        'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ' +
        (destructive ? 'bg-rose-600' : 'bg-[var(--accent-primary)]');

    return (
        <Modal
            open={open}
            onClose={() => { if (!busy) onCancel(); }}
            title={title}
            description={description}
            size="sm"
            disableBackdropClose={busy}
            disableEscapeClose={busy}
            footer={
                <>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="px-4 py-2 rounded-lg text-sm text-[var(--text-primary)] bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={busy}
                        className={confirmClasses}
                    >
                        {busy && <Spinner size="xs" />}
                        {confirmLabel}
                    </button>
                </>
            }
        />
    );
}
