import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BindingField, { datasetColumns } from './BindingField';
import { EditorChromeContext } from '../../editor/EditorChromeContext';

vi.mock('@/utils/helpers', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, authFetch: vi.fn() };
});
import { authFetch } from '@/utils/helpers';

const DEFINITION = { actions: { act_run1: { kind: 'run_automation', automationId: 'auto-1' } }, screens: [] };

function renderField(value, { appId = 'app-1', ...props } = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onChange = vi.fn();
    const tree = (v) => (
        <QueryClientProvider client={client}>
            <EditorChromeContext.Provider value={appId ? { appId } : null}>
                <BindingField label="Data" value={v} onChange={onChange} definition={DEFINITION} {...props} />
            </EditorChromeContext.Provider>
        </QueryClientProvider>
    );
    const utils = render(tree(value));
    // The inspector keeps ONE panel instance per component type, so selecting
    // another node of that type re-renders this field instead of remounting it.
    const selectOtherNode = (v) => utils.rerender(tree(v));
    return { onChange, last: () => onChange.mock.calls.at(-1)?.[0], ...utils, selectOtherNode };
}

describe('BindingField — nothing chosen yet', () => {
    // The catalog default for a freshly dropped table/chart/list.
    it.each([
        ['the catalog default', { kind: 'static', value: [] }],
        ['an empty literal', { kind: 'static', value: '' }],
        ['no binding at all', undefined],
    ])('opens on the chooser, not a hand-typed value (%s)', (_label, value) => {
        const { getByText, queryByRole } = renderField(value);
        expect(getByText('No data yet — choose where this comes from.')).toBeTruthy();
        expect(getByText('A table in this app')).toBeTruthy();
        expect(getByText('A saved view')).toBeTruthy();
        expect(getByText('The result of a routine')).toBeTruthy();
        expect(getByText('Type the values myself')).toBeTruthy();
        expect(queryByRole('textbox')).toBeNull();
    });

    it('"Type the values myself" is the escape hatch back to the raw value', () => {
        const utils = renderField({ kind: 'static', value: [] }, { placeholder: '[{"title":"…"}]' });
        fireEvent.click(utils.getByText('Type the values myself'));
        expect(utils.last()).toEqual({ kind: 'static', value: null });
        // The empty literal it commits still READS as unset — the box must not
        // bounce the user straight back to the chooser.
        expect(utils.getByPlaceholderText('[{"title":"…"}]')).toBeTruthy();
    });

    it('formula and connector are one click deeper, never gone', () => {
        const { getByText, queryByText } = renderField({ kind: 'static', value: [] });
        expect(queryByText('Worked out on the page')).toBeNull();
        fireEvent.click(getByText('Something else…'));
        expect(getByText('Worked out on the page')).toBeTruthy();
        expect(getByText('Another system')).toBeTruthy();
    });

    it('nothing is chosen yet, so there is no way to back out', () => {
        const { queryByText } = renderField({ kind: 'static', value: [] });
        expect(queryByText('Keep what’s there')).toBeNull();
    });

    it('the next empty component of the same type gets its own chooser', () => {
        const utils = renderField({ kind: 'static', value: [] });
        fireEvent.click(utils.getByText('Type the values myself'));
        expect(utils.queryByText('No data yet — choose where this comes from.')).toBeNull();
        utils.selectOtherNode({ kind: 'static', value: [] });
        expect(utils.getByText('No data yet — choose where this comes from.')).toBeTruthy();
    });

    it('a half-opened Change does not follow the user to the next component', () => {
        const utils = renderField({ kind: 'formula', expr: 'x' });
        fireEvent.click(utils.getByRole('button', { name: 'Change' }));
        utils.selectOtherNode({ kind: 'formula', expr: 'y' });
        expect(utils.queryByText('Where should this come from?')).toBeNull();
        expect(utils.getByText(/Showing: a value worked out on the page/)).toBeTruthy();
    });

    it('editing the value keeps the chooser shut, even back to empty', () => {
        const utils = renderField({ kind: 'static', value: [] });
        fireEvent.click(utils.getByText('Type the values myself'));
        const box = utils.getByLabelText('Typed-in value');
        fireEvent.change(box, { target: { value: 'a' } });
        utils.selectOtherNode(utils.last());
        fireEvent.change(utils.getByLabelText('Typed-in value'), { target: { value: '' } });
        utils.selectOtherNode(utils.last());
        expect(utils.queryByText('No data yet — choose where this comes from.')).toBeNull();
    });
});

describe('BindingField — a source that is set', () => {
    it('states the table as a sentence with a Change link', async () => {
        authFetch.mockResolvedValue({
            ok: true, status: 200,
            json: async () => ({ tables: [{ id: 'tbl_a', key: 'tickets', name: 'Tickets', fields: [] }] }),
        });
        const { findByText, getByRole } = renderField({ kind: 'records', tableId: 'tbl_a' });
        expect(await findByText(/Showing: rows from/)).toBeTruthy();
        expect(await findByText('“Tickets”')).toBeTruthy();
        expect(getByRole('button', { name: 'Change' })).toBeTruthy();
    });

    it('names the saved view a chart is showing', async () => {
        authFetch.mockResolvedValue({
            ok: true, status: 200,
            json: async () => ({ datasets: [{ id: 'ds_1', name: 'Open tickets', descriptor: {} }] }),
        });
        const { findByText } = renderField({ kind: 'dataset', datasetId: 'ds_1' });
        expect(await findByText(/Showing: the saved view/)).toBeTruthy();
        expect(await findByText('“Open tickets”')).toBeTruthy();
    });

    it('Change reopens the chooser and can be backed out of', () => {
        const { getByRole, getByText, queryByText, onChange } = renderField({ kind: 'formula', expr: 'x' });
        fireEvent.click(getByRole('button', { name: 'Change' }));
        expect(getByText('Where should this come from?')).toBeTruthy();
        fireEvent.click(getByText('Keep what’s there'));
        expect(queryByText('Where should this come from?')).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('BindingField — one value out of a saved view', () => {
    const DATASETS = [{
        id: 'ds_1', name: 'Tickets per month',
        descriptor: { groupBy: [{ field: 'created_at', bucket: 'month' }], aggregates: [{ fn: 'count', as: 'open_count' }] },
    }];

    it('datasetColumns lists the numbers first, then the breakdowns', () => {
        expect(datasetColumns(DATASETS[0])).toEqual(['open_count', 'created_at_month']);
        expect(datasetColumns(null)).toEqual([]);
        expect(datasetColumns({ descriptor: {} })).toEqual([]);
    });

    it('a stat picks the column its number comes from', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ datasets: DATASETS }) });
        const utils = renderField({ kind: 'dataset', datasetId: 'ds_1', pick: { row: 'first', column: '' } }, { singleValue: true });
        const select = await utils.findByRole('combobox', { name: 'Which column' });
        fireEvent.change(select, { target: { value: 'open_count' } });
        expect(utils.last()).toEqual({ kind: 'dataset', datasetId: 'ds_1', pick: { row: 'first', column: 'open_count' } });
    });

    it('the last row is reachable too', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ datasets: DATASETS }) });
        const utils = renderField({ kind: 'dataset', datasetId: 'ds_1', pick: { row: 'first', column: 'open_count' } }, { singleValue: true });
        const select = await utils.findByRole('combobox', { name: 'Which row' });
        fireEvent.change(select, { target: { value: 'last' } });
        expect(utils.last()).toEqual({ kind: 'dataset', datasetId: 'ds_1', pick: { row: 'last', column: 'open_count' } });
    });

    it('a hand-typed column name stays possible', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ datasets: DATASETS }) });
        const utils = renderField({ kind: 'dataset', datasetId: 'ds_1', pick: { row: 'first', column: 'open_count' } }, { singleValue: true });
        const select = await utils.findByRole('combobox', { name: 'Which column' });
        fireEvent.change(select, { target: { value: '__own' } });
        fireEvent.change(utils.getByRole('textbox', { name: 'Column name' }), { target: { value: 'total' } });
        expect(utils.last()).toEqual({ kind: 'dataset', datasetId: 'ds_1', pick: { row: 'first', column: 'total' } });
    });

    it('a view arriving with no column chosen fills in its first number', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ datasets: DATASETS }) });
        const utils = renderField({ kind: 'dataset', datasetId: 'ds_1' }, { singleValue: true });
        await utils.findByRole('combobox', { name: 'Which column' });
        expect(utils.last()).toEqual({ kind: 'dataset', datasetId: 'ds_1', pick: { row: 'first', column: 'open_count' } });
    });

    it('a column cleared on purpose stays cleared', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ datasets: DATASETS }) });
        const utils = renderField({ kind: 'dataset', datasetId: 'ds_1', pick: { row: 'first', column: '' } }, { singleValue: true });
        await utils.findByRole('combobox', { name: 'Which column' });
        expect(utils.onChange).not.toHaveBeenCalled();
    });

    it('the next tile on the same view still gets its own first number', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ datasets: DATASETS }) });
        const utils = renderField({ kind: 'dataset', datasetId: 'ds_1' }, { singleValue: true });
        await utils.findByRole('combobox', { name: 'Which column' });
        expect(utils.onChange).toHaveBeenCalledTimes(1);
        utils.selectOtherNode({ kind: 'dataset', datasetId: 'ds_1' });
        expect(utils.onChange).toHaveBeenCalledTimes(2);
        expect(utils.last()).toEqual({ kind: 'dataset', datasetId: 'ds_1', pick: { row: 'first', column: 'open_count' } });
    });

    it('a component that shows a list never asks which column', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ datasets: DATASETS }) });
        const utils = renderField({ kind: 'dataset', datasetId: 'ds_1' });
        await utils.findByRole('option', { name: 'Tickets per month' });
        expect(utils.queryByRole('combobox', { name: 'Which column' })).toBeNull();
        expect(utils.onChange).not.toHaveBeenCalled();
    });
});
