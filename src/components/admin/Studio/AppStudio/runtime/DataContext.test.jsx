import { render, act } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, it, expect } from 'vitest';
import { DataProvider, useDataContext, useDataState } from './DataContext';

function Probe({ onReady }) {
    const ctx = useDataContext();
    const dataState = useDataState();
    onReady(ctx);
    return <div data-testid="probe">{JSON.stringify(dataState)}</div>;
}

describe('DataContext', () => {
    it('exposes an initial dataState and stores entries by key', () => {
        let ctx = null;
        const { getByTestId } = render(
            <DataProvider appId="app_1" initialState={{ seed: { status: 'success', result: 1 } }}>
                <Probe onReady={(c) => { ctx = c; }} />
            </DataProvider>,
        );
        expect(ctx.appId).toBe('app_1');
        expect(getByTestId('probe').textContent).toContain('seed');

        act(() => ctx.setEntry('records:t1', { status: 'loading' }));
        expect(getByTestId('probe').textContent).toContain('records:t1');

        act(() => ctx.removeEntry('seed'));
        expect(getByTestId('probe').textContent).not.toContain('seed');
    });

    it('bounds the store — the oldest entries drop out instead of growing forever', () => {
        let ctx = null;
        render(
            <DataProvider appId="app_1">
                <Probe onReady={(c) => { ctx = c; }} />
            </DataProvider>,
        );
        act(() => {
            for (let i = 0; i < 260; i++) ctx.setEntry(`records:t${i}`, { status: 'success', result: i });
        });
        const keys = Object.keys(ctx.dataState);
        expect(keys.length).toBe(200);
        expect(keys).toContain('records:t259');
        expect(keys).not.toContain('records:t0');
    });

    it('degrades to an empty map outside a provider', () => {
        let ctx = null;
        render(<Probe onReady={(c) => { ctx = c; }} />);
        expect(ctx.dataState).toEqual({});
        expect(ctx.appId).toBeNull();
    });
});

/**
 * A cache key is SHARED: two fetchers with the same binding hold the same
 * entry. Eviction used to be unconditional, so one of them unmounting deleted
 * the entry the other was still reading — and the survivor never wrote it back
 * (its mirror effect's deps are unchanged and react-query answers from cache),
 * so it showed "Loading…" for the rest of the screen's life.
 *
 * Reachable without doing anything unusual: AppInputRelation mounts its own
 * loader outside AppDataScope's deduped scan, so two relation pickers over the
 * same table produce byte-identical bindings — and a visibleWhen on one of them
 * is all it takes to unmount it.
 */
describe('DataProvider — an entry outlives its other holders', () => {
    function Holder({ cacheKey, value }) {
        const { setEntry, retainEntry, releaseEntry } = useDataContext();
        useEffect(() => {
            retainEntry(cacheKey);
            setEntry(cacheKey, value);
            return () => releaseEntry(cacheKey);
        }, [cacheKey, value, setEntry, retainEntry, releaseEntry]);
        return null;
    }

    function StateProbe({ onState }) {
        const { dataState } = useDataContext();
        useEffect(() => { onState(dataState); });
        return null;
    }

    const ENTRY = { status: 'success', result: [{ id: 1 }], tableId: 'tbl_a' };

    it('keeps the entry while another holder is still reading it', () => {
        const seen = { current: null };
        const tree = (both) => (
            <DataProvider appId="app-1">
                <Holder cacheKey="k1" value={ENTRY} />
                {both ? <Holder cacheKey="k1" value={ENTRY} /> : null}
                <StateProbe onState={(s) => { seen.current = s; }} />
            </DataProvider>
        );
        const { rerender } = render(tree(true));
        expect(seen.current.k1).toBeTruthy();

        // One of the two goes away — the other is still on screen.
        rerender(tree(false));
        expect(seen.current.k1).toBeTruthy();
    });

    it('drops the entry once the last holder goes', () => {
        const seen = { current: null };
        const tree = (any) => (
            <DataProvider appId="app-1">
                {any ? <Holder cacheKey="k1" value={ENTRY} /> : null}
                <StateProbe onState={(s) => { seen.current = s; }} />
            </DataProvider>
        );
        const { rerender } = render(tree(true));
        expect(seen.current.k1).toBeTruthy();

        rerender(tree(false));
        expect(seen.current.k1).toBeUndefined();
    });
});
