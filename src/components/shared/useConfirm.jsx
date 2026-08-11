import React, { useCallback, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

/**
 * Promise-based confirm — ONE dialog paradigm for every destructive or
 * consequential action, in the product's own chrome.
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   …
 *   const ok = await confirm({
 *       title: 'Delete page?',
 *       description: 'This cannot be undone.',
 *       confirmLabel: 'Delete',
 *       destructive: true,
 *   });
 *   if (!ok) return;
 *   …
 *   return <>{…}{confirmDialog}</>;   // mount once, at the shell root
 *
 * Replaces `window.confirm`, which renders as "localhost:5176 says" in a
 * browser-styled box — it reads as something happening TO the app rather than
 * a decision the app is asking you to make, and it can't carry a destructive
 * accent or an app-worded button.
 *
 * Only one confirm can be open at a time (matching window.confirm semantics);
 * a second call while one is open resolves the first as cancelled.
 */
export default function useConfirm() {
    const [pending, setPending] = useState(null); // { title, description, confirmLabel, cancelLabel, destructive }
    const resolveRef = useRef(null);

    const settle = useCallback((ok) => {
        const resolve = resolveRef.current;
        resolveRef.current = null;
        setPending(null);
        if (resolve) resolve(ok);
    }, []);

    const confirm = useCallback((opts) => {
        // Cancel any confirm already on screen — mirrors the "one native
        // dialog at a time" behavior callers were written against.
        if (resolveRef.current) resolveRef.current(false);
        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setPending(opts || {});
        });
    }, []);

    const confirmDialog = (
        <ConfirmDialog
            open={!!pending}
            title={pending?.title || 'Are you sure?'}
            description={pending?.description}
            confirmLabel={pending?.confirmLabel || 'Confirm'}
            cancelLabel={pending?.cancelLabel || 'Cancel'}
            destructive={!!pending?.destructive}
            onConfirm={() => settle(true)}
            onCancel={() => settle(false)}
        />
    );

    return { confirm, confirmDialog };
}
