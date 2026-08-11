import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChartInspector from './ChartInspector';
import DataGridInspector from './DataGridInspector';
import StatInspector from './StatInspector';
import { EditorChromeContext } from '../../editor/EditorChromeContext';
import { findNode } from '../../state/definitionOps';

vi.mock('@/utils/helpers', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, authFetch: vi.fn() };
});
import { authFetch } from '@/utils/helpers';

// Stand-in for the query builder modal: one button that saves the view a chart
// would get back, so the wiring is asserted without driving the whole modal.
vi.mock('../../bi/QueryBuilder', () => ({
    default: ({ open, onSave }) => (open ? (
        <button
            type="button"
            onClick={() => onSave({ datasetId: 'ds_new', chart: { chartType: 'line', xKey: 'month', series: [{ key: 'open_count', label: 'Open', color: '#22c55e' }] } })}
        >
            save built view
        </button>
    ) : null),
    ConfigureDataButton: () => null,
}));

/**
 * Chart / data grid / stat used to stack a "Configure data" modal button on top
 * of a separate Source binding — two controls writing the SAME prop. These pin
 * the merged single Data block, and the stat's one-number choice.
 */

function defWith(node) {
    return {
        schemaVersion: 2,
        meta: { name: 'T', description: '', icon: 'LayoutGrid' },
        theme: { primary: '#0F766E', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'auto' },
        homeScreenId: 'scr_t',
        screens: [{ id: 'scr_t', name: 'T', icon: null, showInNav: true, maxWidth: 'medium', sections: [{ id: 'sec_t', style: {}, children: [node] }] }],
        actions: {},
    };
}

const NODES = {
    chart: { id: 'cmp_ch', type: 'chart', visible: true, props: { chartType: 'bar', source: { kind: 'static', value: [] }, title: null, xKey: 'label', series: [], showLegend: true, showGrid: true, valueFormat: 'number' }, style: { span: 6, height: 'md' } },
    grid: { id: 'cmp_dg', type: 'data_grid', visible: true, props: { source: { kind: 'static', value: [] }, columns: [], pageSize: 25, selectable: 'none', searchable: false, rowActions: [], density: 'comfortable', emptyText: 'x' }, style: { span: 12 } },
    stat: { id: 'cmp_st', type: 'stat', visible: true, props: { label: 'Open', value: { kind: 'static', value: '0' }, caption: null, icon: null }, style: { span: 3 } },
};

function renderInspector(Comp, node, { appId = 'app-1' } = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onCommit = vi.fn();
    const utils = render(
        <QueryClientProvider client={client}>
            <EditorChromeContext.Provider value={appId ? { appId } : null}>
                <Comp node={node} definition={defWith(node)} onCommit={onCommit} disabled={false} />
            </EditorChromeContext.Provider>
        </QueryClientProvider>,
    );
    const props = () => findNode(onCommit.mock.calls.at(-1)[0], node.id).node.props;
    return { onCommit, props, ...utils };
}

describe('chart / data grid — one Data block', () => {
    it.each([
        ['ChartInspector', ChartInspector, NODES.chart],
        ['DataGridInspector', DataGridInspector, NODES.grid],
    ])('%s offers no rival "Configure data" button', (_name, Comp, node) => {
        const { queryByText, getByText } = renderInspector(Comp, node);
        expect(queryByText('Configure data')).toBeNull();
        expect(getByText('Data')).toBeTruthy();
        // Building a query is a card inside the chooser, not a competing button.
        expect(getByText('A saved view')).toBeTruthy();
    });

    it('an empty chart opens on the chooser instead of a literal to hand-type', () => {
        const { getByText, queryByPlaceholderText } = renderInspector(ChartInspector, NODES.chart);
        expect(getByText('No data yet — choose where this comes from.')).toBeTruthy();
        expect(queryByPlaceholderText('[{"label":"Jan","value":10}]')).toBeNull();
    });

    it('a view built from the chooser also prefills the chart, in one commit', () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ datasets: [] }) });
        const node = { ...NODES.chart, props: { ...NODES.chart.props, source: { kind: 'dataset', datasetId: null } } };
        const { getByText, props, onCommit } = renderInspector(ChartInspector, node);
        fireEvent.click(getByText('Build a new view…'));
        fireEvent.click(getByText('save built view'));
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(props()).toMatchObject({
            source: { kind: 'dataset', datasetId: 'ds_new' },
            chartType: 'line',
            xKey: 'month',
            series: [{ key: 'open_count', label: 'Open', color: '#22c55e' }],
        });
    });

    it('picking a table writes the source binding', () => {
        const { getByText, props } = renderInspector(DataGridInspector, NODES.grid);
        fireEvent.click(getByText('A table in this app'));
        expect(props().source).toEqual({ kind: 'records', tableId: '' });
    });
});

describe('stat — one number, not a row array', () => {
    const DATASETS = [{
        id: 'ds_1', name: 'Tickets per month',
        descriptor: { groupBy: [{ field: 'created_at', bucket: 'month' }], aggregates: [{ fn: 'count', as: 'open_count' }] },
    }];

    it('a saved view carries which single value the tile shows', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ datasets: DATASETS }) });
        const node = { ...NODES.stat, props: { ...NODES.stat.props, value: { kind: 'dataset', datasetId: 'ds_1' } } };
        const utils = renderInspector(StatInspector, node);
        const select = await utils.findByRole('combobox', { name: 'Which column' });
        fireEvent.change(select, { target: { value: 'created_at_month' } });
        expect(utils.props().value).toEqual({
            kind: 'dataset', datasetId: 'ds_1', pick: { row: 'first', column: 'created_at_month' },
        });
    });

    it('a plain typed-in value is untouched by any of this', () => {
        const node = { ...NODES.stat, props: { ...NODES.stat.props, value: { kind: 'static', value: '42' } } };
        const { queryByRole, getByDisplayValue } = renderInspector(StatInspector, node);
        expect(getByDisplayValue('42')).toBeTruthy();
        expect(queryByRole('combobox', { name: 'Which column' })).toBeNull();
    });
});
