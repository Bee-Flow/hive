import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Undo/redo stack for the automation draft. Owns:
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

export default function useRoutineDraftHistory({ currentDraft, apply }) {
    const [{ past, future }, setStacks] = useState({ past: [], future: [] });
    const lastCommitAtRef = useRef(0);

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

    const commit = useCallback((nextDef) => {
        const current = currentRef.current;
        if (sameDraft(current, nextDef)) return;

        const now = Date.now();
        const coalesced = (now - lastCommitAtRef.current) < COALESCE_MS;
        lastCommitAtRef.current = now;

        setStacks(({ past: p, future: _f }) => {
            if (coalesced && p.length > 0) {
                // Within the burst window — keep the pre-burst snapshot on
                // top; just clear the redo stack and let `apply` write the
                // newest state.
                return { past: p, future: [] };
            }
            const nextPast = p.length >= CAP ? p.slice(p.length - CAP + 1) : p.slice();
            nextPast.push(safeClone(current));
            return { past: nextPast, future: [] };
        });

        applyRef.current?.(nextDef);
    }, []);

    const undo = useCallback(() => {
        let popped = null;
        setStacks(({ past: p, future: f }) => {
            if (p.length === 0) return { past: p, future: f };
            popped = p[p.length - 1];
            return {
                past: p.slice(0, -1),
                future: [...f, safeClone(currentRef.current)],
            };
        });
        // setState is async — schedule the apply for after the state update.
        // queueMicrotask gives us "next tick" semantics without leaving the
        // current event loop turn, so the canvas paints once.
        queueMicrotask(() => {
            if (popped !== null) applyRef.current?.(popped);
        });
    }, []);

    const redo = useCallback(() => {
        let popped = null;
        setStacks(({ past: p, future: f }) => {
            if (f.length === 0) return { past: p, future: f };
            popped = f[f.length - 1];
            return {
                past: [...p, safeClone(currentRef.current)],
                future: f.slice(0, -1),
            };
        });
        queueMicrotask(() => {
            if (popped !== null) applyRef.current?.(popped);
        });
    }, []);

    const reset = useCallback(() => {
        setStacks({ past: [], future: [] });
        lastCommitAtRef.current = 0;
    }, []);

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
