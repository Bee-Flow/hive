import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import BindingField from './BindingField';
import { EditorChromeContext } from '../../editor/EditorChromeContext';

const TABLES = [
    { id: 'tbl_orders', name: 'Orders', fields: [
        { key: 'total', name: 'Total', type: 'number' },
        { key: 'status', name: 'Status', type: 'text' },
        { key: 'placed_at', name: 'Placed at', type: 'date' },
    ] },
];

vi.mock('../../../../../../utils/helpers', () => ({
    API_BASE: '',
    authFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ tables: TABLES, datasets: [], connectors: [] }) })),
}));

/**
 * "A count or total" committed an aggregate binding and then rendered nothing —
 * no editor, and a summary line that called it "values typed in here". Picking
 * it was a dead end you could not even see you were in.
 */

function renderField(initial) {
    const onChange = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Harness() {
        const [value, setValue] = useState(initial);
        return (
            <QueryClientProvider client={client}>
                <EditorChromeContext.Provider value={{ appId: 'app-1' }}>
                    <BindingField
                        label="Source"
                        value={value}
                        onChange={(next) => { setValue(next); onChange(next); }}
                        definition={{ screens: [] }}
                    />
                </EditorChromeContext.Provider>
            </QueryClientProvider>
        );
    }
    const utils = render(<Harness />);
    return { onChange, last: () => onChange.mock.calls.at(-1)?.[0], ...utils };
}

const AGG = { kind: 'aggregate', tableId: 'tbl_orders', aggregates: [{ fn: 'count', as: 'count' }] };

describe('BindingField — the aggregate editor', () => {
    it('says what it is, instead of claiming values were typed in', async () => {
        renderField(AGG);
        expect(await screen.findByText(/Showing: the count of/)).toBeTruthy();
    });

    it('asks for the table before anything else', async () => {
        renderField({ kind: 'aggregate', tableId: '', aggregates: [{ fn: 'count', as: 'count' }] });
        expect(await screen.findByLabelText('Table to count')).toBeTruthy();
        expect(screen.getByText(/pick the table below/i)).toBeTruthy();
    });

    it('offers what to work out, and asks for a column once it needs one', async () => {
        const { last } = renderField(AGG);
        // count needs no column…
        expect(await screen.findByLabelText('What to work out')).toBeTruthy();
        expect(screen.queryByLabelText('Which column')).toBeNull();

        // …sum does, and one is pre-picked so the binding stays valid.
        fireEvent.change(screen.getByLabelText('What to work out'), { target: { value: 'sum' } });
        expect(last().aggregates[0]).toMatchObject({ fn: 'sum', field: 'total' });
        expect(await screen.findByLabelText('Which column')).toBeTruthy();
    });

    it('splits by a column, and drops the key again when set back', async () => {
        const { last } = renderField(AGG);
        fireEvent.change(await screen.findByLabelText('Split by'), { target: { value: 'status' } });
        expect(last().groupBy).toEqual([{ field: 'status' }]);

        fireEvent.change(screen.getByLabelText('Split by'), { target: { value: '' } });
        expect(last().groupBy).toBeUndefined();
    });

    it('offers date buckets only for a date column', async () => {
        const { last } = renderField(AGG);
        fireEvent.change(await screen.findByLabelText('Split by'), { target: { value: 'status' } });
        expect(screen.queryByLabelText('Group dates')).toBeNull();

        fireEvent.change(screen.getByLabelText('Split by'), { target: { value: 'placed_at' } });
        expect(await screen.findByLabelText('Group dates')).toBeTruthy();
        fireEvent.change(screen.getByLabelText('Group dates'), { target: { value: 'month' } });
        expect(last().groupBy[0]).toMatchObject({ field: 'placed_at', bucket: 'month' });
    });

    it('carries the filter rows, so a count can be scoped', async () => {
        renderField(AGG);
        expect(await screen.findByText('Filters')).toBeTruthy();
    });
});
