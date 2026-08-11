// Two-step confirm-delete control — replaces the
//
//   const [confirmDelete, setConfirmDelete] = useState(false);
//   {hasKey && !confirmDelete && <button onClick={() => setConfirmDelete(true)}>🗑️</button>}
//   {confirmDelete && <><button onClick={handleDelete}>Confirm</button><button>✕</button></>}
//
// pattern that was copy-pasted across the provider API-key cards,
// AzureCard, GoogleVertexCard and RerankerConfig. Render it conditionally
// ({hasKey && <DeleteConfirmButtons ... />}) — unmounting after a successful
// delete resets the confirm state; on a failed delete it stays in the
// confirm state so the user can retry, matching the old behavior.
//
// `size` picks the button scale: 'sm' (the standalone 🗑️ icon button in the
// single-key cards) or 'xs' (the labelled "🗑️ Key" / "🗑️ Endpoint" buttons
// in the multi-field cards).

import React, { useState } from 'react';

const SIZE_CLASSES = {
    sm: {
        trigger: 'px-3 py-2.5 rounded-lg text-sm transition-all hover:bg-red-500/20',
        confirm: 'px-3 py-2.5 rounded-lg text-sm font-medium transition-all bg-red-500/20 text-red-400 hover:bg-red-500/30',
        cancel: 'px-3 py-2.5 rounded-lg text-sm transition-all'
    },
    xs: {
        trigger: 'px-3 py-2 rounded-lg text-xs transition-all hover:bg-red-500/20',
        confirm: 'px-3 py-2 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30',
        cancel: 'px-2 py-2 rounded-lg text-xs'
    }
};

const DeleteConfirmButtons = ({ onConfirm, label = '🗑️', title, size = 'sm' }) => {
    const [confirming, setConfirming] = useState(false);
    const classes = SIZE_CLASSES[size] || SIZE_CLASSES.sm;

    if (!confirming) {
        return (
            <button
                onClick={() => setConfirming(true)}
                className={classes.trigger}
                style={{ color: 'var(--text-muted)' }}
                title={title}
            >
                {label}
            </button>
        );
    }

    return (
        <>
            <button onClick={onConfirm} className={classes.confirm}>
                Confirm
            </button>
            <button
                onClick={() => setConfirming(false)}
                className={classes.cancel}
                style={{ color: 'var(--text-muted)' }}
            >
                ✕
            </button>
        </>
    );
};

export default DeleteConfirmButtons;
