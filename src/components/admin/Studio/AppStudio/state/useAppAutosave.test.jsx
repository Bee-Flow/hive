import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../studioAppsApi', () => {
    const api = { saveDefinition: vi.fn() };
    return { studioAppsApi: api, default: api };
});

import { studioAppsApi } from '../studioAppsApi';
import useAppAutosave from './useAppAutosave';

const defA = { schemaVersion: 1, tag: 'a' };
const defB = { schemaVersion: 1, tag: 'b' };
const defC = { schemaVersion: 1, tag: 'c' };
const defD = { schemaVersion: 1, tag: 'd' };

function mount(overrides = {}) {
    const onSaved = vi.fn();
    const onConflict = vi.fn();
    const onInvalid = vi.fn();
    const initialProps = {
        appId: 'app-1',
        definition: defA,
        version: 3,
        enabled: true,
        onSaved,
        onConflict,
        onInvalid,
        ...overrides,
    };
    const hook = renderHook((props) => useAppAutosave(props), { initialProps });
    return { ...hook, onSaved, onConflict, onInvalid, initialProps };
}

const tick = (ms) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('useAppAutosave', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        studioAppsApi.saveDefinition.mockReset();
        studioAppsApi.saveDefinition.mockResolvedValue({ ok: true, version: 4, warnings: [], repairs: [] });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('debounces a burst of edits into a single save of the last definition', async () => {
        const { rerender, initialProps } = mount();

        rerender({ ...initialProps, definition: defB });
        await tick(300);
        rerender({ ...initialProps, definition: defC });
        await tick(300);
        rerender({ ...initialProps, definition: defD });
        expect(studioAppsApi.saveDefinition).not.toHaveBeenCalled();

        await tick(900);
        expect(studioAppsApi.saveDefinition).toHaveBeenCalledTimes(1);
        expect(studioAppsApi.saveDefinition).toHaveBeenCalledWith('app-1', defD, 3);
    });

    it('never saves on mount or for an unchanged reference', async () => {
        const { rerender, initialProps } = mount();
        await tick(2000);
        rerender({ ...initialProps, definition: defA }); // identical reference
        await tick(2000);
        expect(studioAppsApi.saveDefinition).not.toHaveBeenCalled();
    });

    it('reports the bumped version through onSaved and uses it as the next baseVersion', async () => {
        const { result, rerender, onSaved, initialProps } = mount();

        rerender({ ...initialProps, definition: defB });
        await tick(900);
        expect(onSaved).toHaveBeenCalledWith(4, { warnings: [], repairs: [] });
        expect(result.current.status).toBe('saved');

        // Second edit saves against the NEW version even though the caller
        // never fed the bumped version back through props.
        studioAppsApi.saveDefinition.mockResolvedValue({ ok: true, version: 5, warnings: [], repairs: [] });
        rerender({ ...initialProps, definition: defC });
        await tick(900);
        expect(studioAppsApi.saveDefinition).toHaveBeenLastCalledWith('app-1', defC, 4);
        expect(onSaved).toHaveBeenLastCalledWith(5, { warnings: [], repairs: [] });
    });

    it('hands conflicts to onConflict and never auto-retries', async () => {
        const serverDef = { schemaVersion: 1, tag: 'server' };
        studioAppsApi.saveDefinition.mockResolvedValue({
            ok: false, conflict: true, currentVersion: 9, definition: serverDef,
        });
        const { result, rerender, onConflict, initialProps } = mount();

        rerender({ ...initialProps, definition: defB });
        await tick(900);
        expect(onConflict).toHaveBeenCalledTimes(1);
        expect(onConflict).toHaveBeenCalledWith({ currentVersion: 9, definition: serverDef });
        expect(result.current.status).toBe('error');

        await tick(10000);
        expect(studioAppsApi.saveDefinition).toHaveBeenCalledTimes(1);
    });

    it('surfaces the first validation message on invalid definitions', async () => {
        studioAppsApi.saveDefinition.mockResolvedValue({
            ok: false, invalid: true, errors: [{ message: 'screens[0] is missing a name' }], warnings: [],
        });
        const { result, rerender, initialProps } = mount();
        rerender({ ...initialProps, definition: defB });
        await tick(900);
        expect(result.current.status).toBe('error');
        expect(result.current.error).toBe('screens[0] is missing a name');
    });

    it('hands the FULL server reply to onInvalid — the pill only fits one line', async () => {
        const errors = [
            { code: 'screen.name_missing', path: 'screens[0]', message: 'screens[0] is missing a name' },
            { code: 'action.unset', path: 'screens[0].sections[0].children[1]', message: 'This button has no action.', hint: 'Pick what it should do.' },
        ];
        const warnings = [{ code: 'binding.table_unset', path: 'screens[0]', message: 'A list has no table picked yet.' }];
        studioAppsApi.saveDefinition.mockResolvedValue({ ok: false, invalid: true, errors, warnings });
        const { rerender, onInvalid, initialProps } = mount();

        rerender({ ...initialProps, definition: defB });
        await tick(900);
        expect(onInvalid).toHaveBeenCalledWith({ errors, warnings });
    });

    it('flush() saves immediately without waiting for the debounce', async () => {
        const { result, rerender, initialProps } = mount();
        rerender({ ...initialProps, definition: defB });
        expect(studioAppsApi.saveDefinition).not.toHaveBeenCalled();

        await act(async () => { await result.current.flush(); });
        expect(studioAppsApi.saveDefinition).toHaveBeenCalledTimes(1);
        expect(studioAppsApi.saveDefinition).toHaveBeenCalledWith('app-1', defB, 3);

        // The debounce timer was cleared — no duplicate save later.
        await tick(2000);
        expect(studioAppsApi.saveDefinition).toHaveBeenCalledTimes(1);
    });

    it('flush() is a no-op when nothing is dirty', async () => {
        const { result } = mount();
        await act(async () => { await result.current.flush(); });
        expect(studioAppsApi.saveDefinition).not.toHaveBeenCalled();
    });

    it('flush() persists an edit that landed mid-flight and awaits it (Bug 1)', async () => {
        // First save stays pending until we release it; a second edit lands
        // while it is in flight. flush() must not resolve until BOTH the in-
        // flight save AND the follow-up save of the latest definition finish.
        let releaseFirst;
        studioAppsApi.saveDefinition
            .mockReturnValueOnce(new Promise((r) => {
                releaseFirst = () => r({ ok: true, version: 4, warnings: [], repairs: [] });
            }))
            .mockResolvedValue({ ok: true, version: 5, warnings: [], repairs: [] });

        const { result, rerender, initialProps } = mount();

        // Edit B → debounced save starts and is left in flight (unresolved).
        rerender({ ...initialProps, definition: defB });
        await tick(900);
        expect(studioAppsApi.saveDefinition).toHaveBeenCalledTimes(1);
        expect(studioAppsApi.saveDefinition).toHaveBeenLastCalledWith('app-1', defB, 3);

        // Edit C lands WHILE B's save is still in flight.
        rerender({ ...initialProps, definition: defC });

        // flush() must not resolve until both saves are done.
        let flushed = false;
        let flushPromise;
        await act(async () => {
            flushPromise = result.current.flush().then(() => { flushed = true; });
            await Promise.resolve();
        });
        expect(flushed).toBe(false);
        expect(studioAppsApi.saveDefinition).toHaveBeenCalledTimes(1); // still only B

        // Release B → the loop saves C against B's bumped version, then flush resolves.
        await act(async () => {
            releaseFirst();
            await flushPromise;
        });
        expect(flushed).toBe(true);
        expect(studioAppsApi.saveDefinition).toHaveBeenCalledTimes(2);
        expect(studioAppsApi.saveDefinition).toHaveBeenLastCalledWith('app-1', defC, 4);

        // No stray debounce save afterwards (no double-save).
        await tick(2000);
        expect(studioAppsApi.saveDefinition).toHaveBeenCalledTimes(2);
    });

    it('a pause drops the pending save of a transient definition (Bug 4)', async () => {
        // What the shell does during a drag: onDragOver writes transient
        // reparents into the draft and autosave is switched off, so a drag that
        // outlives the debounce (or gets cancelled) is never what gets stored.
        const { rerender, initialProps } = mount();

        rerender({ ...initialProps, definition: defB }); // transient drag-over draft
        await tick(300);
        rerender({ ...initialProps, definition: defB, enabled: false }); // drag in progress
        await tick(5000);
        expect(studioAppsApi.saveDefinition).not.toHaveBeenCalled();

        // Drop → the shell restores its snapshot and commits the real result.
        rerender({ ...initialProps, definition: defC, enabled: true });
        await tick(900);
        expect(studioAppsApi.saveDefinition).toHaveBeenCalledTimes(1);
        expect(studioAppsApi.saveDefinition).toHaveBeenCalledWith('app-1', defC, 3);
    });

    it('flush() resolves to the outcome instead of rejecting (Bug 2)', async () => {
        const { result, rerender, initialProps } = mount();
        rerender({ ...initialProps, definition: defB });
        await act(async () => { expect(await result.current.flush()).toEqual({ ok: true }); });

        studioAppsApi.saveDefinition.mockResolvedValue({
            ok: false, invalid: true, errors: [{ message: 'Screen name is required' }],
        });
        rerender({ ...initialProps, definition: defC });
        await act(async () => {
            expect(await result.current.flush()).toEqual({ ok: false, error: 'Screen name is required' });
        });

        studioAppsApi.saveDefinition.mockRejectedValue(new Error('Network down'));
        rerender({ ...initialProps, definition: defD });
        await act(async () => {
            expect(await result.current.flush()).toEqual({ ok: false, error: 'Network down' });
        });
    });

    it('flush() reports ok when there is nothing left to save', async () => {
        const { result } = mount();
        await act(async () => { expect(await result.current.flush()).toEqual({ ok: true }); });
    });

    it('does not save when enabled=false', async () => {
        const { result, rerender, initialProps } = mount({ enabled: false });
        rerender({ ...initialProps, enabled: false, definition: defB });
        await tick(3000);
        await act(async () => { await result.current.flush(); });
        expect(studioAppsApi.saveDefinition).not.toHaveBeenCalled();
    });

    it('markSaved() adopts a server state without saving it back', async () => {
        const { result, rerender, initialProps } = mount();
        const serverDef = { schemaVersion: 1, tag: 'server' };
        rerender({ ...initialProps, definition: serverDef });
        act(() => { result.current.markSaved(serverDef, 9); });
        await tick(3000);
        expect(studioAppsApi.saveDefinition).not.toHaveBeenCalled();

        // The adopted version becomes the base for the next real edit.
        rerender({ ...initialProps, definition: defB });
        await tick(900);
        expect(studioAppsApi.saveDefinition).toHaveBeenCalledWith('app-1', defB, 9);
    });
});
