import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BindingField from './BindingField';
import { EditorChromeContext } from '../../editor/EditorChromeContext';

// Only the network call is stubbed; useAppTables/useDatasets fetch through it.
vi.mock('@/utils/helpers', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, authFetch: vi.fn() };
});
import { authFetch } from '@/utils/helpers';

const DEFINITION = {
    actions: { act_run1: { kind: 'run_automation', automationId: 'auto-1' } },
    screens: [],
};

const TABLES = [{
    id: 'tbl_a', key: 'tickets', name: 'Tickets',
    fields: [{ key: 'status', name: 'Status', type: 'select' }, { key: 'title', name: 'Title', type: 'text' }],
}];

function renderField(value, { appId = 'app-1', ...props } = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onChange = vi.fn();
    const chrome = appId ? { appId } : null;
    const utils = render(
        <QueryClientProvider client={client}>
            <EditorChromeContext.Provider value={chrome}>
                <BindingField label="Source" value={value} onChange={onChange} definition={DEFINITION} {...props} />
            </EditorChromeContext.Provider>
        </QueryClientProvider>,
    );
    const last = () => onChange.mock.calls.at(-1)?.[0];
    return { onChange, last, ...utils };
}

/** Open the chooser on an already-set source, then take one of its cards. */
function chooseCard(utils, cardText, { fromSet = true } = {}) {
    if (fromSet) fireEvent.click(utils.getByRole('button', { name: 'Change' }));
    fireEvent.click(utils.getByText(cardText));
}

describe('BindingField — six binding kinds', () => {
    // BindingField is controlled — the visible editor derives from the `value`
    // prop — so each transition is asserted from its own fresh render.
    it.each([
        ['Worked out on the page', { kind: 'formula', expr: '' }],
        ['A table in this app', { kind: 'records', tableId: '' }],
        ['A saved view', { kind: 'dataset', datasetId: null }],
        ['Another system', { kind: 'connector', connectorId: null, params: {} }],
        ['The result of a routine', { kind: 'actionResult', actionId: 'act_run1', path: '' }],
    ])('choosing "%s" emits the exact skeleton', (card, expected) => {
        const utils = renderField({ kind: 'static', value: 'x' });
        fireEvent.click(utils.getByRole('button', { name: 'Change' }));
        // formula/connector live behind "Something else…".
        if (utils.queryByText(card) == null) fireEvent.click(utils.getByText('Something else…'));
        fireEvent.click(utils.getByText(card));
        expect(utils.last()).toEqual(expected);
    });

    it('switching back to typed-in values emits { kind:"static", value:null }', () => {
        const utils = renderField({ kind: 'formula', expr: 'x' });
        chooseCard(utils, 'Type the values myself');
        expect(utils.last()).toEqual({ kind: 'static', value: null });
    });

    it('re-picking the card that is already active keeps what is configured', () => {
        const utils = renderField({ kind: 'records', tableId: 'tbl_a' });
        chooseCard(utils, 'A table in this app');
        expect(utils.onChange).not.toHaveBeenCalled();
    });

    // Queried by accessible name, not by role: these panels grow extra text
    // controls (a formula's inline preview, a nav param row), and
    // getByRole('textbox') throws "found multiple" the moment one lands here.
    it('static mode parses structured JSON but keeps prose as a string', () => {
        const utils = renderField({ kind: 'static', value: 'seed' });
        const input = utils.getByLabelText('Typed-in value');
        fireEvent.change(input, { target: { value: '["a","b"]' } });
        expect(utils.last()).toEqual({ kind: 'static', value: ['a', 'b'] });
        fireEvent.change(input, { target: { value: '12 items' } });
        expect(utils.last()).toEqual({ kind: 'static', value: '12 items' });
    });

    it('formula mode emits { kind:"formula", expr }', () => {
        const { last, getByLabelText } = renderField({ kind: 'formula', expr: '' });
        fireEvent.change(getByLabelText('Formula'), { target: { value: 'currentUser.id' } });
        expect(last()).toEqual({ kind: 'formula', expr: 'currentUser.id' });
    });

    it('a dataset binding keeps its saved-view select, so the picker stays reachable', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ datasets: [{ id: 'ds_1', name: 'Open tickets', descriptor: {} }] }) });
        const utils = renderField({ kind: 'dataset', datasetId: 'ds_1' });
        await utils.findByRole('option', { name: 'Open tickets' });
        expect(utils.getByRole('combobox', { name: 'Saved view' }).value).toBe('ds_1');
    });

    it('records mode: picking a table + a formula filter emits the canonical shape', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ tables: TABLES }) });
        const { onChange, last, getByRole, findByRole } = renderField({ kind: 'records', tableId: '' });

        // Table picker loads from GET /data/tables.
        const tableSelect = await findByRole('combobox', { name: 'Source table' });
        fireEvent.change(tableSelect, { target: { value: 'tbl_a' } });
        expect(last()).toEqual({ kind: 'records', tableId: 'tbl_a' });

        // Re-render with the chosen table so the filter editor appears.
        onChange.mockClear();
        const { last: last2, getByRole: g2, findByRole: f2 } = renderField({ kind: 'records', tableId: 'tbl_a' });
        await waitFor(() => expect(authFetch).toHaveBeenCalled());
        fireEvent.click(await f2('button', { name: /add filter/i }));
        // Default op 'eq' with a literal value.
        const emitted = last2();
        expect(emitted.kind).toBe('records');
        expect(emitted.tableId).toBe('tbl_a');
        expect(Array.isArray(emitted.filter)).toBe(true);
        expect(emitted.filter[0]).toMatchObject({ op: 'eq' });
        void g2;
    });

    it('records mode: "Single row" toggles kind between records and record', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ tables: TABLES }) });
        const { last, findByRole } = renderField({ kind: 'records', tableId: 'tbl_a' });
        const single = await findByRole('checkbox', { name: /single row/i });
        fireEvent.click(single);
        expect(last()).toMatchObject({ kind: 'record', tableId: 'tbl_a' });
    });

    it('connector mode: picking a connector + filling a param emits the connector binding', async () => {
        authFetch.mockResolvedValue({
            ok: true, status: 200,
            json: async () => ({ connectors: [{ id: 'conn_abc123', kind: 'rest', name: 'Items', params: [{ key: 'q', type: 'text', required: false }] }] }),
        });
        // Pick the connector (wait for the options to load first).
        const first = renderField({ kind: 'connector', connectorId: null, params: {} });
        await first.findByRole('option', { name: 'Items' });
        fireEvent.change(first.getByRole('combobox', { name: 'Connector' }), { target: { value: 'conn_abc123' } });
        expect(first.last()).toEqual({ kind: 'connector', connectorId: 'conn_abc123', params: {} });

        // Re-render with the chosen connector so its declared params appear.
        const second = renderField({ kind: 'connector', connectorId: 'conn_abc123', params: {} });
        const paramInput = await second.findByRole('textbox', { name: 'Param q' });
        fireEvent.change(paramInput, { target: { value: 'red' } });
        expect(second.last()).toEqual({ kind: 'connector', connectorId: 'conn_abc123', params: { q: 'red' } });
    });
});
