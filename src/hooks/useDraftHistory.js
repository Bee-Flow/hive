import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Undo/redo stack for a JSON draft (automation definitions, App Studio
 * app definitions, ...). Promoted from
 * components/admin/AITasksDesigner/Builder/flow/useRoutineDraftHistory.js —
 * that path re-exports this hook, so the routines builder is untouched.
 *
 * Owns:
 *   - past[]   — snapshots predecessor states (most recent at end)
 *   - future[] — redo stack (most-recently-undone at end)
 *
 * `commit(nextDef)` is the local-edit entry point: it captures the
 * current draft into past, clears future (the user took a new path), and
 * applies the new draft via the caller-supplied `apply` setter.
 *
 * Coalescing: rapid successive commits within COALESCE_MS share one
 * history entry so typing "hello" into a field doesn't fill the stack
 * with five snapshots — Cmd+Z reverts the whole word at once, the way
 * users expect from Figma/Miro/n8n. The first commit in a burst pushes
 * the pre-edit state; later commits in the burst skip the push.
 *
 * Cap the past stack at CAP entries to keep memory bounded; older
 * entries roll off the bottom of the stack.
 *
 * Identity short-circuit: a commit with a structurally identical draft
 * is a no-op (no apply, no push) so duplicate paint/effect cycles can't
 * pollute history.
 *
 * Inputs:
 *   currentDraft — the live draft (read at commit-time via ref, so
 *                  consumers don't have to chase a stale closure).
 *   apply(next)  — the underlying draft setter. Called by commit, undo,
 *                  redo. Should NOT itself call back into commit.
 *
 * Returns:
 *   commit(next)  — push current → apply next
 *   undo()        — pop past → push current to future → apply popped
 *   redo()        — pop future → push current to past → apply popped
 *   canUndo       — past.length > 0
 *   canRedo       — future.length > 0
 *   reset()       — clear both stacks (used after server-confirmed loads)
 */
const COALESCE_MS = 600;
const CAP = 50;

export default function useDraftHistory({ currentDraft, apply }) {
    const [{ past, future }, setStacks] = useState({ past: [], future: [] });
    const lastCommitAtRef = useRef(0);
    // Synchronous mirror of the stacks so undo/redo can read the top of a stack
    // WITHOUT doing an impure read of a value written inside a setState updater
    // (that pattern double-runs under StrictMode/concurrent React and can apply
    // the wrong snapshot when undos fire rapidly). We update it alongside every
    // setStacks call and treat it as the source of truth for pop operations.
    const stacksRef = useRef({ past: [], future: [] });

    // Always read the freshest current draft via a ref so the commit /
    // undo / redo functions don't capture a stale snapshot — consumers
    // call them from event handlers that close over an old render.
    const currentRef = useRef(currentDraft);
    useEffect(() => {
        currentRef.current = currentDraft;
    }, [currentDraft]);

    const applyRef = useRef(apply);
    useEffect(() => {
        applyRef.current = apply;
    }, [apply]);

    const setStacksBoth = useCallback((next) => {
        stacksRef.current = next;
        setStacks(next);
    }, []);

    const commit = useCallback((nextDef) => {
        const current = currentRef.current;
        if (sameDraft(current, nextDef)) return;

        const now = Date.now();
        const coalesced = (now - lastCommitAtRef.current) < COALESCE_MS;
        lastCommitAtRef.current = now;

        const { past: p } = stacksRef.current;
        if (coalesced && p.length > 0) {
            // Within the burst window — keep the pre-burst snapshot on top; just
            // clear the redo stack and let `apply` write the newest state.
            setStacksBoth({ past: p, future: [] });
        } else if (current == null) {
            // A nullish baseline is "no draft yet" — the state before the very
            // first edit on a fresh routine. Undoing to it would apply `null`
            // as a definition, which the save path then persisted as an empty
            // object and wedged the builder (BFSF-318). There is nothing
            // meaningful to undo TO, so never push it.
            setStacksBoth({ past: p, future: [] });
        } else {
            const nextPast = p.length >= CAP ? p.slice(p.length - CAP + 1) : p.slice();
            nextPast.push(safeClone(current));
            setStacksBoth({ past: nextPast, future: [] });
        }

        applyRef.current?.(nextDef);
    }, [setStacksBoth]);

    const undo = useCallback(() => {
        const { past: p, future: f } = stacksRef.current;
        if (p.length === 0) return;
        const popped = p[p.length - 1];
        setStacksBoth({ past: p.slice(0, -1), future: [...f, safeClone(currentRef.current)] });
        // Reset the coalesce window so the next edit after an undo starts a
        // FRESH history entry — otherwise a commit within COALESCE_MS would
        // coalesce and drop the just-undone-to state from history.
        lastCommitAtRef.current = 0;
        applyRef.current?.(popped);
    }, [setStacksBoth]);

    const redo = useCallback(() => {
        const { past: p, future: f } = stacksRef.current;
        if (f.length === 0) return;
        const popped = f[f.length - 1];
        setStacksBoth({ past: [...p, safeClone(currentRef.current)], future: f.slice(0, -1) });
        lastCommitAtRef.current = 0;
        applyRef.current?.(popped);
    }, [setStacksBoth]);

    const reset = useCallback(() => {
        setStacksBoth({ past: [], future: [] });
        lastCommitAtRef.current = 0;
    }, [setStacksBoth]);

    return {
        commit,
        undo,
        redo,
        canUndo: past.length > 0,
        canRedo: future.length > 0,
        reset,
    };
}

function safeClone(v) {
    if (v == null) return v;
    try {
        return JSON.parse(JSON.stringify(v));
    } catch {
        return v;
    }
}

function sameDraft(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return false;
    }
}
