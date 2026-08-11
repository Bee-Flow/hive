import React, { createContext, useContext } from 'react';

/**
 * The builder's one confirmation dialog, reachable from anywhere in the tree.
 *
 * The routines builder asks for confirmation from half a dozen places —
 * replacing a trigger, deleting a flowlet, rotating a webhook secret or a
 * form link, restoring a version — and every one of them used `window.confirm`.
 * That renders as a browser box titled "localhost:5176 says": unstyled, unable
 * to mark a destructive action as destructive, and reading as something
 * happening TO the app rather than a question the app is asking.
 *
 * BuilderShell mounts one `useConfirm()` and publishes its promise-based
 * `confirm` here; `useBuilderConfirm()` hands it to any descendant, including
 * hooks that render no dialog of their own.
 *
 * The fallback matters: a surface mounted outside the provider (a stand-alone
 * panel, a test) still gets a working confirm rather than an action that
 * silently proceeds — the failure mode of a missing provider must never be
 * "skip the question".
 */
const BuilderConfirmContext = createContext(null);

export const BuilderConfirmProvider = BuilderConfirmContext.Provider;

export function useBuilderConfirm() {
    const ctx = useContext(BuilderConfirmContext);
    return ctx || nativeConfirm;
}

async function nativeConfirm({ title, description } = {}) {
    if (typeof window === 'undefined') return true;
    return window.confirm([title, description].filter(Boolean).join('\n\n'));
}
