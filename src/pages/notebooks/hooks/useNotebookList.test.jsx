import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./notebookApi', () => ({ notebookApi: vi.fn() }));

import useNotebookList from './useNotebookList';
import { notebookApi } from './notebookApi';

const nb = (id, extra = {}) => ({ id, name: `NB ${id}`, pinned: false, version: 1, ...extra });
const listParams = (call) => new URLSearchParams(String(call[0]).replace(/^\?/, ''));

describe('useNotebookList', () => {
    beforeEach(() => notebookApi.mockReset());
    afterEach(() => vi.useRealTimers());

    it('debounces search and refetches once at offset 0 with all params', async () => {
        vi.useFakeTimers();
        notebookApi.mockResolvedValue({ notebooks: [nb('a')], hasMore: false });
        const { result } = renderHook(() => useNotebookList());
        await act(async () => {}); // settle the initial fetch
        expect(notebookApi).toHaveBeenCalledTimes(1);

        act(() => result.current.setSearch('b'));
        act(() => result.current.setSearch('be'));
        act(() => result.current.setSearch('bee'));
        await act(async () => { vi.advanceTimersByTime(299); });
        expect(notebookApi).toHaveBeenCalledTimes(1); // still inside the debounce

        await act(async () => { vi.advanceTimersByTime(1); });
        expect(notebookApi).toHaveBeenCalledTimes(2);
        const params = listParams(notebookApi.mock.calls[1]);
        expect(params.get('search')).toBe('bee');
        expect(params.get('sort')).toBe('activity');
        expect(params.get('filter')).toBe('all');
        expect(params.get('limit')).toBe('60');
        expect(params.get('offset')).toBe('0');
    });

    it('keeps stale items visible while a refetch is in flight', async () => {
        vi.useFakeTimers();
        notebookApi.mockResolvedValueOnce({ notebooks: [nb('a')], hasMore: false });
        const { result } = renderHook(() => useNotebookList());
        await act(async () => {});
        notebookApi.mockImplementationOnce(() => new Promise(() => {})); // never resolves
        act(() => result.current.setSearch('x'));
        await act(async () => { vi.advanceTimersByTime(300); });
        expect(result.current.loading).toBe(true);
        expect(result.current.items.map(n => n.id)).toEqual(['a']);
    });

    it('togglePin flips optimistically and reverts when the PUT fails', async () => {
        notebookApi.mockResolvedValueOnce({ notebooks: [nb('a')], hasMore: false });
        const { result } = renderHook(() => useNotebookList());
        await waitFor(() => expect(result.current.loading).toBe(false));

        let rejectPut;
        notebookApi.mockImplementationOnce(() => new Promise((_, rej) => { rejectPut = rej; }));
        act(() => { result.current.togglePin('a'); });
        expect(result.current.items[0].pinned).toBe(true); // optimistic flip

        await act(async () => { rejectPut(new Error('nope')); });
        expect(result.current.items[0].pinned).toBe(false); // reverted
        const put = notebookApi.mock.calls[1];
        expect(put[0]).toBe('/a');
        expect(JSON.parse(put[1].body)).toEqual({ pinned: true });
    });

    it('loadMore fetches the next offset and appends', async () => {
        notebookApi.mockResolvedValueOnce({ notebooks: [nb('a'), nb('b')], hasMore: true });
        const { result } = renderHook(() => useNotebookList());
        await waitFor(() => expect(result.current.loading).toBe(false));

        notebookApi.mockResolvedValueOnce({ notebooks: [nb('c')], hasMore: false });
        await act(async () => { result.current.loadMore(); });
        expect(listParams(notebookApi.mock.calls[1]).get('offset')).toBe('60');
        expect(result.current.items.map(n => n.id)).toEqual(['a', 'b', 'c']);
        expect(result.current.hasMore).toBe(false);
    });

    it('create is re-entrancy-guarded: two synchronous calls make one POST', async () => {
        notebookApi.mockImplementation((path, opts = {}) => {
            if (opts.method === 'POST') return Promise.resolve({ notebook: nb('new') });
            return Promise.resolve({ notebooks: [nb('new')], hasMore: false });
        });
        const { result } = renderHook(() => useNotebookList());
        await waitFor(() => expect(result.current.loading).toBe(false));

        let created;
        await act(async () => {
            const p1 = result.current.create('test');
            const p2 = result.current.create('test'); // Enter hammered twice
            created = await p1;
            expect(await p2).toBe(null);
        });
        const posts = notebookApi.mock.calls.filter(([, o]) => o?.method === 'POST');
        expect(posts).toHaveLength(1);
        expect(JSON.parse(posts[0][1].body)).toEqual({ name: 'test' });
        expect(created).toEqual(nb('new'));
    });
});
