import React, { useCallback, useState } from 'react';
import ConfirmDialog from '../../../../shared/ConfirmDialog';

/**
 * App Studio runtime — a styled, promise-based confirm for action sequences.
 *
 * useActionRunner awaits an injectable `confirm(step) → Promise<boolean>` for a
 * `confirm` step (default is window.confirm). This hook provides a house-style
 * modal instead: `confirm(step)` shows the dialog and resolves true (Continue)
 * or false (Cancel — which ABORTS the remaining sequence). Mount `dialog`
 * wherever the runner runs (the editor preview canvas + the standalone run
 * page) and pass `confirm` to useActionRunner.
 *
 *   const { confirm, dialog } = useConfirmDialog();
 *   const { runAction } = useActionRunner(appId, def, { confirm, … });
 *   return (<>{ …app… }{dialog}</>);
 */
export default function useConfirmDialog() {
    // { step, resolve } while a confirm is pending, else null.
    const [pending, setPending] = useState(null);

    const confirm = useCallback((step) => new Promise((resolve) => {
        setPending({ step: step && typeof step === 'object' ? step : {}, resolve });
    }), []);

    const settle = useCallback((ok) => {
        setPending((prev) => {
            if (prev) prev.resolve(ok);
            return null;
        });
    }, []);

    const step = pending?.step || {};
    const dialog = (
        <ConfirmDialog
            open={!!pending}
            title={step.title || step.heading || 'Please confirm'}
            description={step.message || 'Are you sure you want to continue?'}
            confirmLabel={step.confirmLabel || 'Continue'}
            cancelLabel={step.cancelLabel || 'Cancel'}
            destructive={!!step.destructive}
            onConfirm={() => settle(true)}
            onCancel={() => settle(false)}
        />
    );

    return { confirm, dialog };
}
