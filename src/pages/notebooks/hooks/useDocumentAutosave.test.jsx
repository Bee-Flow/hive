import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./notebookApi', () => ({ notebookApi: vi.fn() }));

import useDocumentAutosave from './useDocumentAutosave';
import { notebookApi } from './notebookApi';

const putCalls = (path) => notebookApi.mock.calls.filter(
    ([p, o]) => o?.method === 'PUT' && (path === undefined || p === path)
);
const body = (call) => JSON.parse(call[1].body);

describe('useDocumentAutosave', () => {
    beforeEach(() => notebookApi.mockReset());
    afterEach(() => vi.useRealTimers());

    it('sends expectedVersion from the seeded counter and adopts the returned version', async () => {
        notebookApi.mockResolvedValue({ success: true, version: 4 });
        const { result } = renderHook(() => useDocumentAutosave({ entityId: 'nb1', initialVersion: 3 }));
        await act(async () => { await result.current.handleDocSave('<p>a</p>'); });
        expect(body(putCalls('/nb1')[0])).toEqual({ documentContent: '<p>a</p>', expectedVersion: 3 });

        notebookApi.mockResolvedValue({ success: true, version: 5 });
        await act(async () => { await result.current.handleDocSave('<p>b</p>'); });
        expect(body(putCalls('/nb1')[1]).expectedVersion).toBe(4);
    });

    it('omits expectedVersion when no version is known, then self-seeds from the response', async () => {
        notebookApi.mockResolvedValue({ success: true, version: 2 });
        const { result } = renderHook(() => useDocumentAutosave({ entityId: 'nb1' }));
        await act(async () => { await result.current.handleDocSave('<p>a</p>'); });
        expect(body(putCalls('/nb1')[0])).toEqual({ documentContent: '<p>a</p>' });

        await act(async () => { await result.current.handleDocSave('<p>b</p>'); });
        expect(body(putCalls('/nb1')[1]).expectedVersion).toBe(2);
    });

    it('setKnownVersion resyncs the counter (SSE doc_update path)', async () => {
        notebookApi.mockResolvedValue({ success: true, version: 11 });
        const { result } = renderHook(() => useDocumentAutosave({ entityId: 'nb1', initialVersion: 3 }));
        act(() => result.current.setKnownVersion(10));
        await act(async () => { await result.current.handleDocSave('<p>a</p>'); });
        expect(body(putCalls('/nb1')[0]).expectedVersion).toBe(10);
    });

    it('on 409: reloads the server copy, fires onConflict, clears pending, never auto-retries', async () => {
        vi.useFakeTimers();
        const onConflict = vi.fn();
        const conflict = Object.assign(new Error('conflict'), { status: 409 });
        notebookApi.mockImplementation((path, opts = {}) => {
            if (opts.method === 'PUT') return Promise.reject(conflict);
            return Promise.resolve({ notebook: { id: 'nb1', documentContent: '<p>server</p>', version: 7 } });
        });
        const { result } = renderHook(() => useDocumentAutosave({ entityId: 'nb1', initialVersion: 3, onConflict }));
        const setContent = vi.fn();
        result.current.editorRef.current = { setContent };

        await act(async () => { await result.current.handleDocSave('<p>mine</p>'); });
        expect(setContent).toHaveBeenCalledWith('<p>server</p>');
        expect(result.current.documentContent).toBe('<p>server</p>');
        expect(onConflict).toHaveBeenCalledTimes(1);
        expect(result.current.pendingContentRef.current).toBe(null);
        expect(result.current.dirty).toBe(false);
        expect(result.current.saveState).toBe('idle');

        expect(putCalls()).toHaveLength(1);
        await act(async () => { vi.advanceTimersByTime(10000); });
        expect(putCalls()).toHaveLength(1); // the 5s auto-retry must not fire

        // The next save uses the version adopted from the reload.
        notebookApi.mockResolvedValue({ success: true, version: 8 });
        await act(async () => { await result.current.handleDocSave('<p>again</p>'); });
        expect(body(putCalls().at(-1)).expectedVersion).toBe(7);
    });

    it('entity-switch cleanup does not re-PUT content that flush() already saved', async () => {
        notebookApi.mockResolvedValue({ success: true, version: 1 });
        const { result, rerender } = renderHook(
            ({ entityId }) => useDocumentAutosave({ entityId }),
            { initialProps: { entityId: 'a' } }
        );
        const flush = vi.fn(() => '<p>flushed</p>');
        result.current.editorRef.current = { flush };
        // Stale pending from an earlier failed save — the old cleanup re-PUT this.
        result.current.pendingContentRef.current = '<p>stale-pending</p>';

        await act(async () => { rerender({ entityId: 'b' }); });
        expect(flush).toHaveBeenCalledTimes(1);
        expect(putCalls('/a')).toHaveLength(0);
    });

    it('entity-switch cleanup PUTs remaining pending content without expectedVersion when flush had nothing', async () => {
        notebookApi.mockResolvedValue({ success: true, version: 9 });
        const { result, rerender } = renderHook(
            ({ entityId }) => useDocumentAutosave({ entityId, initialVersion: 5 }),
            { initialProps: { entityId: 'a' } }
        );
        result.current.editorRef.current = { flush: () => null };
        result.current.pendingContentRef.current = '<p>pending</p>';

        await act(async () => { rerender({ entityId: 'b' }); });
        const calls = putCalls('/a');
        expect(calls).toHaveLength(1);
        expect(body(calls[0])).toEqual({ documentContent: '<p>pending</p>' });
    });

    it('a flush-triggered save during entity switch omits expectedVersion and is not doubled', async () => {
        notebookApi.mockResolvedValue({ success: true, version: 9 });
        const { result, rerender } = renderHook(
            ({ entityId }) => useDocumentAutosave({ entityId, initialVersion: 5 }),
            { initialProps: { entityId: 'a' } }
        );
        // Mimic BeeEditor.flush(): saves through the hook's own onSave, then
        // returns the HTML it saved.
        const saveForA = result.current.handleDocSave;
        result.current.editorRef.current = {
            flush: () => { saveForA('<p>typed</p>'); return '<p>typed</p>'; },
        };

        await act(async () => { rerender({ entityId: 'b' }); });
        const calls = putCalls('/a');
        expect(calls).toHaveLength(1);
        expect(body(calls[0])).toEqual({ documentContent: '<p>typed</p>' });
    });
});
