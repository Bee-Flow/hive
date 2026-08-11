import { render, act } from '@testing-library/react';
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
