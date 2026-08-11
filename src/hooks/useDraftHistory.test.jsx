import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StrictMode, useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import useDraftHistory from './useDraftHistory';

/**
 * Harness: a tiny stateful consumer mirroring how the editors use the hook —
 * `draft` state + commit/undo/redo driving it via `apply`.
 */
function useHarness(initial) {
    const [draft, setDraft] = useState(initial);
    const history = useDraftHistory({ currentDraft: draft, apply: setDraft });
    return { draft, history };
}

const wrapperStrict = ({ children }) => <StrictMode>{children}</StrictMode>;

describe('useDraftHistory', () => {
    let now;
    beforeEach(() => {
        now = 1_000_000;
        vi.spyOn(Date, 'now').mockImplementation(() => now);
    });
    afterEach(() => vi.restoreAllMocks());

    // Commits spaced beyond the 600ms coalesce window.
    const tick = (ms = 1000) => { now += ms; };

    it('commit applies the next draft and enables undo', () => {
        const { result } = renderHook(() => useHarness({ v: 0 }));
        act(() => { tick(); result.current.history.commit({ v: 1 }); });
        expect(result.current.draft).toEqual({ v: 1 });
        expect(result.current.history.canUndo).toBe(true);
        expect(result.current.history.canRedo).toBe(false);
    });

    it('undo/redo round-trips', () => {
        const { result } = renderHook(() => useHarness({ v: 0 }));
        act(() => { tick(); result.current.history.commit({ v: 1 }); });
        act(() => { tick(); result.current.history.commit({ v: 2 }); });
        act(() => result.current.history.undo());
        expect(result.current.draft).toEqual({ v: 1 });
        act(() => result.current.history.undo());
        expect(result.current.draft).toEqual({ v: 0 });
        expect(result.current.history.canUndo).toBe(false);
        act(() => result.current.history.redo());
        act(() => result.current.history.redo());
        expect(result.current.draft).toEqual({ v: 2 });
        expect(result.current.history.canRedo).toBe(false);
    });

    it('coalesces rapid commits (a slider drag) into one history entry', () => {
        const { result } = renderHook(() => useHarness({ v: 0 }));
        // Burst: three commits within 600ms of each other — one entry whose
        // snapshot is the PRE-burst state.
        act(() => { tick(); result.current.history.commit({ v: 1 }); });
        act(() => { tick(100); result.current.history.commit({ v: 2 }); });
        act(() => { tick(100); result.current.history.commit({ v: 3 }); });
        // A later, separate edit gets its own entry.
        act(() => { tick(1000); result.current.history.commit({ v: 4 }); });
        expect(result.current.draft).toEqual({ v: 4 });
        act(() => result.current.history.undo());
        expect(result.current.draft).toEqual({ v: 3 });   // back to end-of-burst
        act(() => result.current.history.undo());
        expect(result.current.draft).toEqual({ v: 0 });   // one jump over the burst
        expect(result.current.history.canUndo).toBe(false);
    });

    it('a commit after undo clears the redo stack', () => {
        const { result } = renderHook(() => useHarness({ v: 0 }));
        act(() => { tick(); result.current.history.commit({ v: 1 }); });
        act(() => result.current.history.undo());
        act(() => { tick(); result.current.history.commit({ v: 9 }); });
        expect(result.current.history.canRedo).toBe(false);
        expect(result.current.draft).toEqual({ v: 9 });
    });

    it('an edit right after undo starts a fresh entry (no coalesce across undo)', () => {
        const { result } = renderHook(() => useHarness({ v: 0 }));
        act(() => { tick(); result.current.history.commit({ v: 1 }); });
        act(() => result.current.history.undo());          // back to v:0
        act(() => { tick(50); result.current.history.commit({ v: 2 }); }); // within 600ms
        act(() => result.current.history.undo());
        expect(result.current.draft).toEqual({ v: 0 });    // v:0 preserved in history
    });

    it('structurally identical commits are no-ops', () => {
        const { result } = renderHook(() => useHarness({ v: 0 }));
        act(() => { tick(); result.current.history.commit({ v: 0 }); });
        expect(result.current.history.canUndo).toBe(false);
    });

    it('caps the past stack at 50 entries', () => {
        const { result } = renderHook(() => useHarness({ v: 0 }));
        for (let i = 1; i <= 60; i++) {
            act(() => { tick(); result.current.history.commit({ v: i }); });
        }
        let undos = 0;
        while (result.current.history.canUndo && undos < 100) {
            act(() => result.current.history.undo());
            undos++;
        }
        expect(undos).toBe(50);
        // Oldest 10 rolled off: the floor is v:10, not v:0.
        expect(result.current.draft).toEqual({ v: 10 });
    });

    it('reset clears both stacks', () => {
        const { result } = renderHook(() => useHarness({ v: 0 }));
        act(() => { tick(); result.current.history.commit({ v: 1 }); });
        act(() => result.current.history.undo());
        act(() => result.current.history.reset());
        expect(result.current.history.canUndo).toBe(false);
        expect(result.current.history.canRedo).toBe(false);
    });

    it('survives StrictMode double-invocation', () => {
        const { result } = renderHook(() => useHarness({ v: 0 }), { wrapper: wrapperStrict });
        act(() => { tick(); result.current.history.commit({ v: 1 }); });
        act(() => { tick(); result.current.history.commit({ v: 2 }); });
        act(() => result.current.history.undo());
        expect(result.current.draft).toEqual({ v: 1 });
        act(() => result.current.history.undo());
        expect(result.current.draft).toEqual({ v: 0 });
        expect(result.current.history.canUndo).toBe(false);
        act(() => result.current.history.redo());
        expect(result.current.draft).toEqual({ v: 1 });
    });
});
