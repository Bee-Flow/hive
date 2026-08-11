import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../../../shared/Toast', () => {
    const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    return { default: toast, toast };
});

import { deriveChartMapping } from './ChartDataPanel';
import QueryBuilder, { buildDescriptor, parseUserNumber } from './QueryBuilder';
import { authFetch } from '../../../../../utils/helpers';

const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

const TASK_TABLE = {
    id: 'tbl_tasks0', key: 'tasks', name: 'Tasks',
    fields: [
        { id: 'fld_region', key: 'region', name: 'Region', type: 'text' },
        { id: 'fld_amount', key: 'amount', name: 'Amount', type: 'number' },
        { id: 'fld_created', key: 'created', name: 'Created', type: 'date' },
    ],
};

const ORDER_TABLE = {
    id: 'tbl_orders', key: 'orders', name: 'Orders',
    fields: [{ id: 'fld_country', key: 'country', name: 'Country', type: 'text' }],
};

// Captured POST /data/query bodies (the built descriptors).
let queryBodies;

function installFetch() {
    queryBodies = [];
    authFetch.mockImplementation(async (url, options = {}) => {
        const method = options.method || 'GET';
        if (url.endsWith('/data/tables')) return resp(200, { tables: [TASK_TABLE, ORDER_TABLE] });
        if (url.endsWith('/data/query') && method === 'POST') {
            const body = JSON.parse(options.body);
            queryBodies.push(body);
            // A summed measure answers with a DIFFERENT value column, so a
            // series key from an earlier result cannot silently survive.
            if ((body.aggregate.aggregates || []).some((a) => a.fn === 'sum')) {
                return resp(200, { rows: [{ region: 'EU', revenue: 90 }] });
            }
            return resp(200, { rows: [{ region: 'EU', total: 30 }, { region: 'US', total: 12 }] });
        }
        if (url.endsWith('/datasets') && method === 'POST') {
            return resp(200, { success: true, dataset: { id: 'ds_new', name: 'Tasks dataset' } });
        }
        if (url.endsWith('/datasets')) return resp(200, { datasets: [] }); // list GET
        return resp(404, {});
    });
}

function renderBuilder(props = {}) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onSave = props.onSave || vi.fn();
    const onClose = props.onClose || vi.fn();
    const utils = render(
        <QueryClientProvider client={qc}>
            <QueryBuilder open appId="app1" componentType="chart" onSave={onSave} onClose={onClose} {...props} />
        </QueryClientProvider>,
    );
    return { onSave, onClose, ...utils };
}

const FORBIDDEN = [/#6366f1/i, /#4f46e5/i, /#818cf8/i, /#7c3aed/i, /#a855f7/i, /indigo/i, /violet/i, /purple/i, /99\s*,\s*102\s*,\s*241/i];

describe('QueryBuilder', () => {
    beforeEach(() => {
        authFetch.mockReset();
        installFetch();
    });

    it('auto-selects the table, builds a VALID descriptor and runs the live preview', async () => {
        renderBuilder();

        // Table auto-selected → a Count measure seeded → preview POST fires.
        await waitFor(() => expect(queryBodies.length).toBeGreaterThan(0));
        const body = queryBodies[queryBodies.length - 1];
        expect(body.tableId).toBe('tbl_tasks0');
        expect(Array.isArray(body.aggregate.aggregates)).toBe(true);
        expect(body.aggregate.aggregates[0]).toMatchObject({ fn: 'count', as: 'count' });
        expect(Array.isArray(body.aggregate.groupBy)).toBe(true);
        expect(Array.isArray(body.aggregate.filters)).toBe(true);

        // Live preview rows rendered (also appears in the chart — allow many).
        await waitFor(() => expect(screen.getAllByText('EU').length).toBeGreaterThan(0));
        expect(screen.getAllByText('30').length).toBeGreaterThan(0);
    });

    it('saves the dataset and returns its id + chart mapping to the caller', async () => {
        const { onSave } = renderBuilder();

        await waitFor(() => expect(screen.getAllByText('EU').length).toBeGreaterThan(0));
        fireEvent.click(screen.getByText('Use this'));

        await waitFor(() => expect(onSave).toHaveBeenCalled());
        const arg = onSave.mock.calls.at(-1)[0];
        expect(arg.datasetId).toBe('ds_new');
        // chart mapping prefilled from the result columns (region → x, total → series).
        expect(arg.chart.xKey).toBe('region');
        expect(arg.chart.series.map((s) => s.key)).toContain('total');

        // The saved dataset carried the descriptor to POST /datasets.
        const postCall = authFetch.mock.calls.find(([url, opt]) => url.endsWith('/datasets') && opt?.method === 'POST');
        expect(postCall).toBeTruthy();
        const saved = JSON.parse(postCall[1].body);
        expect(saved.tableId).toBe('tbl_tasks0');
        expect(saved.descriptor.aggregates[0].fn).toBe('count');
    });

    it('drops rows that named the OLD table when the source table changes', async () => {
        renderBuilder();
        await waitFor(() => expect(screen.getAllByText('EU').length).toBeGreaterThan(0));

        // Break the count down by a Tasks-only column…
        fireEvent.click(screen.getByText(/add a breakdown/i));
        fireEvent.change(screen.getByRole('combobox', { name: 'Break down by' }), { target: { value: 'region' } });
        await waitFor(() => expect(queryBodies.at(-1).aggregate.groupBy).toEqual([{ field: 'region' }]));

        // …then switch tables: nothing may still point at `region`.
        fireEvent.change(screen.getByRole('combobox', { name: 'Which table' }), { target: { value: 'tbl_orders' } });
        await waitFor(() => expect(queryBodies.at(-1).tableId).toBe('tbl_orders'));
        expect(queryBodies.at(-1).aggregate.groupBy).toEqual([]);
        expect(screen.queryByRole('combobox', { name: 'Break down by' })).toBeNull();
    }, 15_000); // several debounced preview round-trips

    it('drops the measure field when the measure becomes Count (so NULLs still count)', async () => {
        renderBuilder();
        await waitFor(() => expect(screen.getAllByText('EU').length).toBeGreaterThan(0));

        fireEvent.change(screen.getByRole('combobox', { name: 'What to work out' }), { target: { value: 'sum' } });
        fireEvent.change(screen.getByRole('combobox', { name: 'Which column' }), { target: { value: 'amount' } });
        await waitFor(() => expect(queryBodies.at(-1).aggregate.aggregates[0].field).toBe('amount'));

        fireEvent.change(screen.getByRole('combobox', { name: 'What to work out' }), { target: { value: 'count' } });
        expect(screen.getByRole('combobox', { name: 'Which column' }).value).toBe('');
        fireEvent.change(screen.getByPlaceholderText(/call it something else/i), { target: { value: 'Rows' } });

        await waitFor(() => expect(queryBodies.at(-1).aggregate.aggregates[0].as).toBe('rows'));
        expect(queryBodies.at(-1).aggregate.aggregates[0].fn).toBe('count');
        expect('field' in queryBodies.at(-1).aggregate.aggregates[0]).toBe(false);
    }, 15_000); // several debounced preview round-trips

    it('sends a number filter typed with a decimal comma as a NUMBER', async () => {
        renderBuilder();
        await waitFor(() => expect(screen.getAllByText('EU').length).toBeGreaterThan(0));

        fireEvent.click(screen.getByText(/add filter/i));
        fireEvent.change(screen.getByRole('combobox', { name: 'Filter field' }), { target: { value: 'amount' } });
        fireEvent.change(screen.getByRole('combobox', { name: 'Filter operator' }), { target: { value: 'gt' } });
        fireEvent.change(screen.getByRole('textbox', { name: 'Filter value' }), { target: { value: '1.234,56' } });

        await waitFor(() => expect(queryBodies.at(-1).aggregate.filters.length).toBe(1));
        expect(queryBodies.at(-1).aggregate.filters[0]).toEqual({ field: 'amount', op: 'gt', value: 1234.56 });
    });

    it('never saves a series key that the current result no longer has', async () => {
        const { onSave } = renderBuilder();
        await waitFor(() => expect(screen.getAllByText('EU').length).toBeGreaterThan(0));

        // Pin the mapping explicitly on the first result's `total` column.
        const totalPill = screen.getByRole('button', { name: 'total' });
        fireEvent.click(totalPill);
        fireEvent.click(screen.getByRole('button', { name: 'total' }));

        // A summed measure answers with `revenue` instead of `total`.
        fireEvent.change(screen.getByRole('combobox', { name: 'What to work out' }), { target: { value: 'sum' } });
        fireEvent.change(screen.getByRole('combobox', { name: 'Which column' }), { target: { value: 'amount' } });
        await waitFor(() => expect(screen.getAllByText('revenue').length).toBeGreaterThan(0));

        fireEvent.click(screen.getByText('Use this'));
        await waitFor(() => expect(onSave).toHaveBeenCalled());
        expect(onSave.mock.calls.at(-1)[0].chart.series.map((s) => s.key)).toEqual(['revenue']);
    }, 15_000); // several debounced preview round-trips

    it('cannot be saved while the preview for the current query is still coming', async () => {
        const { onSave } = renderBuilder();
        await waitFor(() => expect(screen.getAllByText('EU').length).toBeGreaterThan(0));

        // Editing the measure invalidates the preview; the mapping is only real
        // once the new result lands, so saving must wait for it.
        fireEvent.change(screen.getByRole('combobox', { name: 'What to work out' }), { target: { value: 'sum' } });
        const useThis = screen.getByText('Use this');
        expect(useThis.disabled).toBe(true);
        fireEvent.click(useThis);
        expect(onSave).not.toHaveBeenCalled();
    });

    it('offers a way OUT of the no-tables empty state', async () => {
        const onOpenTables = vi.fn();
        authFetch.mockImplementation(async (url) => (url.endsWith('/data/tables') ? resp(200, { tables: [] }) : resp(404, {})));
        const { onClose } = renderBuilder({ onOpenTables });

        const button = await screen.findByRole('button', { name: /add a table/i });
        fireEvent.click(button);
        expect(onOpenTables).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });

    it('renders no purple/violet/indigo', async () => {
        renderBuilder();
        await waitFor(() => expect(screen.getAllByText('EU').length).toBeGreaterThan(0));
        const html = document.body.innerHTML;
        for (const re of FORBIDDEN) {
            expect(re.test(html), `builder must not contain ${re}`).toBe(false);
        }
    });
});

describe('parseUserNumber', () => {
    it('reads the Dutch decimal comma as well as the dot form', () => {
        expect(parseUserNumber('1,5')).toBe(1.5);
        expect(parseUserNumber('1.234,56')).toBe(1234.56);
        expect(parseUserNumber('1,234.56')).toBe(1234.56);
        expect(parseUserNumber('1234')).toBe(1234);
        expect(parseUserNumber('-2,5')).toBe(-2.5);
        expect(parseUserNumber('twelve')).toBeNull();
        expect(parseUserNumber('')).toBeNull();
    });
});

describe('buildDescriptor', () => {
    const fields = TASK_TABLE.fields;

    it('refuses a descriptor that names a field the table does not have', () => {
        const stale = buildDescriptor('tbl_tasks0', fields, [{ field: 'ghost' }], [{ agg: 'count' }], []);
        expect(stale.unknownFields).toEqual(['ghost']);
        expect(stale.valid).toBe(false);

        const ok = buildDescriptor('tbl_tasks0', fields, [{ field: 'region' }], [{ agg: 'count' }], []);
        expect(ok.unknownFields).toEqual([]);
        expect(ok.valid).toBe(true);
    });
});

describe('deriveChartMapping', () => {
    it('maps the first column to x and numeric columns to series', () => {
        const m = deriveChartMapping(['region', 'total'], [{ region: 'EU', total: 30 }]);
        expect(m.xKey).toBe('region');
        expect(m.series.map((s) => s.key)).toEqual(['total']);
        expect(m.series[0].color).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('keeps a single value series for pie', () => {
        const m = deriveChartMapping(['label', 'a', 'b'], [{ label: 'x', a: 1, b: 2 }], 'pie');
        expect(m.series).toHaveLength(1);
    });
});
