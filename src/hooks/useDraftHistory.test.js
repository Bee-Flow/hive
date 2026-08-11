import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useDraftHistory from './useDraftHistory';

/**
 * Undo/redo stack for JSON drafts.
 *
 * The `null` baseline case is BFSF-318: a brand-new routine starts with no
 * definition, so the first commit used to push `null` onto the past stack. One
 * click of Undo then applied `null` as a definition, which the save path PUT to
 * the server, which stored it as `{}` — and that truthy-but-empty object went
 * on to defeat every `def || seed` fallback in the builder, leaving the user
 * unable to save a Schedule trigger ever again.
 */
function setup(initialDraft) {
    const draft = { current: initialDraft };
    const apply = vi.fn((next) => { draft.current = next; });
    const view = renderHook(
        ({ currentDraft }) => useDraftHistory({ currentDraft, apply }),
        { initialProps: { currentDraft: initialDraft } },
    );
    // Keep the hook's `currentDraft` in step with what `apply` wrote, the way
    // the real consumer (BuilderShell) does via its own state.
    const sync = () => view.rerender({ currentDraft: draft.current });
    return { ...view, apply, draft, sync };
}

const A = { trigger: { id: 'trg' }, steps: [], edges: [] };
const B = { trigger: { id: 'trg' }, steps: [{ id: 's1' }], edges: [] };

describe('useDraftHistory — null baseline (BFSF-318)', () => {
    it('does not make the pre-first-edit null state undoable', () => {
        const { result, apply, sync } = setup(null);

        act(() => { result.current.commit(A); });
        sync();

        expect(apply).toHaveBeenCalledWith(A);
        // Nothing meaningful to undo TO — the state before this was "no draft".
        expect(result.current.canUndo).toBe(false);
    });

    it('never applies null via undo after a null start', () => {
        const { result, apply, sync } = setup(null);

        act(() => { result.current.commit(A); });
        sync();
        act(() => { result.current.undo(); });

        expect(apply).not.toHaveBeenCalledWith(null);
    });

    it('still records history normally once a real draft exists', async () => {
        const { result, apply, sync } = setup(null);

        act(() => { result.current.commit(A); });
        sync();
        // COALESCE_MS is 600ms — wait it out so B pushes a fresh entry.
        await new Promise(r => setTimeout(r, 650));
        act(() => { result.current.commit(B); });
        sync();

        expect(result.current.canUndo).toBe(true);

        act(() => { result.current.undo(); });
        sync();
        expect(apply).toHaveBeenLastCalledWith(A);
        expect(result.current.canRedo).toBe(true);

        act(() => { result.current.redo(); });
        sync();
        expect(apply).toHaveBeenLastCalledWith(B);
    });
});
