import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useAgentAutosave from './useAgentAutosave';

const snapA = { name: 'A' };
const snapB = { name: 'B' };

function mount(overrides = {}) {
    const saveFn = vi.fn().mockResolvedValue({ ok: true, updated: { rev: 4 }, version: 4, warnings: [] });
    const onSaved = vi.fn();
    const onConflict = vi.fn();
    const onLimit = vi.fn();
    let snapshot = snapA;
    const getSnapshot = vi.fn(() => snapshot);
    const setSnapshot = (s) => { snapshot = s; };
    const initialProps = {
        agentId: 'a1', getSnapshot, baseVersion: 3, enabled: true,
        saveFn, onSaved, onConflict, onLimit, ...overrides,
    };
    const hook = renderHook((props) => useAgentAutosave(props), { initialProps });
    return { ...hook, saveFn, onSaved, onConflict, onLimit, setSnapshot, initialProps };
}

const tick = (ms) => act(() => vi.advanceTimersByTimeAsync(ms));
const flushMicro = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('useAgentAutosave', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('debounces a burst of queueSave into one save of the latest snapshot', async () => {
        const { result, saveFn, setSnapshot } = mount();
        act(() => result.current.queueSave());
        await tick(300);
        setSnapshot(snapB);
        act(() => result.current.queueSave());
        await tick(300);
        expect(saveFn).not.toHaveBeenCalled();
        await tick(700);
        expect(saveFn).toHaveBeenCalledTimes(1);
        expect(saveFn).toHaveBeenCalledWith('a1', snapB, 3);
    });

    it('never saves on mount or when nothing is dirty', async () => {
        const { saveFn } = mount();
        await tick(2000);
        expect(saveFn).not.toHaveBeenCalled();
    });

    it('reports the version via onSaved and uses it as the next base version', async () => {
        const { result, saveFn, onSaved } = mount();
        act(() => result.current.queueSave(true));
        await flushMicro();
        expect(saveFn).toHaveBeenLastCalledWith('a1', snapA, 3);
        expect(onSaved).toHaveBeenCalledWith({ rev: 4 }, 4, { warnings: [] });
        act(() => result.current.queueSave(true));
        await flushMicro();
        expect(saveFn).toHaveBeenLastCalledWith('a1', snapA, 4);
    });

    it('on conflict calls onConflict, sets error, and does NOT auto-retry', async () => {
        const { result, saveFn, onConflict } = mount();
        saveFn.mockResolvedValue({ ok: false, conflict: true, currentVersion: 7, agent: { id: 'a1', rev: 7 } });
        act(() => result.current.queueSave(true));
        await flushMicro();
        expect(onConflict).toHaveBeenCalledWith({ currentVersion: 7, agent: { id: 'a1', rev: 7 } });
        expect(result.current.status).toBe('error');
        await tick(2000);
        expect(saveFn).toHaveBeenCalledTimes(1); // no auto-retry
    });

    it('on a generic error keeps dirty so the next edit retries', async () => {
        const { result, saveFn } = mount();
        saveFn.mockResolvedValueOnce({ ok: false });
        act(() => result.current.queueSave(true));
        await flushMicro();
        expect(result.current.status).toBe('error');
        saveFn.mockResolvedValue({ ok: true, updated: { rev: 5 }, version: 5, warnings: [] });
        act(() => result.current.queueSave(true));
        await flushMicro();
        expect(saveFn).toHaveBeenCalledTimes(2);
    });

    it('flush() saves immediately, cancelling the debounce', async () => {
        const { result, saveFn } = mount();
        act(() => result.current.queueSave()); // debounced
        expect(saveFn).not.toHaveBeenCalled();
        await act(async () => { await result.current.flush(); });
        expect(saveFn).toHaveBeenCalledTimes(1);
    });

    it('re-saves an edit that landed mid-flight (not dropped)', async () => {
        const { result, saveFn, setSnapshot } = mount();
        let resolve1;
        saveFn.mockReturnValueOnce(new Promise((r) => { resolve1 = r; }))
            .mockResolvedValue({ ok: true, updated: { rev: 5 }, version: 5, warnings: [] });
        act(() => result.current.queueSave(true)); // save #1 (snapA, base 3) in flight
        setSnapshot(snapB);
        act(() => result.current.queueSave(true)); // queued while in flight
        await act(async () => { resolve1({ ok: true, updated: { rev: 4 }, version: 4, warnings: [] }); });
        await flushMicro();
        expect(saveFn).toHaveBeenCalledTimes(2);
        expect(saveFn).toHaveBeenNthCalledWith(1, 'a1', snapA, 3);
        expect(saveFn).toHaveBeenNthCalledWith(2, 'a1', snapB, 4);
    });

    it('does not save when disabled', async () => {
        const { result, saveFn } = mount({ enabled: false });
        act(() => result.current.queueSave(true));
        await tick(2000);
        expect(saveFn).not.toHaveBeenCalled();
    });

    it('markSaved adopts a version without saving; it becomes the next base', async () => {
        const { result, saveFn } = mount();
        act(() => result.current.markSaved({ rev: 9 }, 9));
        await tick(2000);
        expect(saveFn).not.toHaveBeenCalled();
        act(() => result.current.queueSave(true));
        await flushMicro();
        expect(saveFn).toHaveBeenLastCalledWith('a1', snapA, 9);
    });

    it('on a plan limit calls onLimit and keeps dirty', async () => {
        const { result, saveFn, onLimit } = mount();
        saveFn.mockResolvedValue({ ok: false, limit: true, message: 'Agent limit reached', resource: 'agents' });
        act(() => result.current.queueSave(true));
        await flushMicro();
        expect(onLimit).toHaveBeenCalledWith({ message: 'Agent limit reached', resource: 'agents' });
        expect(result.current.status).toBe('error');
    });
});
