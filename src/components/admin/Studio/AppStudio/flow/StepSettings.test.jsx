import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import StepSettings from './StepSettings';
import { EditorChromeContext } from '../editor/EditorChromeContext';

/**
 * A reference is a PICK, never a typed id.
 *
 * The server types every reference field as a plain `string`, so the spec-driven
 * panel rendered five of the six as free text: "Add a row" asked for a table id,
 * "Open a dialog" for a node id, "Run routine" for a uuid. Only `screenId` had
 * been special-cased. These pin that each one is a picker sourced from the app
 * itself — and that a reference whose target is GONE keeps its id and says so
 * rather than quietly blanking.
 */

const STEP_SPECS_STUB = {
    create_record: {
        fields: {
            tableId: { type: 'string', required: true },
            values: { type: 'recordValues', required: true },
        },
    },
    open_modal: { fields: { modalId: { type: 'string', required: true } } },
    run_automation: {
        fields: {
            automationId: { type: 'string', nullable: true, required: true },
            resultVar: { type: 'string', maxLen: 60 },
        },
    },
    refresh: {
        fields: {
            tableId: { type: 'string' },
            datasetId: { type: 'string' },
            actionId: { type: 'string' },   // deprecated, ignored by the runtime
        },
    },
    navigate: { fields: { screenId: { type: 'string', required: true }, params: { type: 'navParams' } } },
};

vi.mock('../studioAppsApi', () => ({
    studioAppsApi: { getCatalog: vi.fn(async () => ({ components: {}, actions: { stepSpecs: STEP_SPECS_STUB } })) },
}));

vi.mock('@/utils/helpers', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, authFetch: vi.fn() };
});
import { authFetch } from '@/utils/helpers';

const listAutomations = vi.fn(async () => ({
    automations: [{ id: 'auto-1', title: 'Send the invoice' }, { id: 'auto-2', title: 'Chase the payment' }],
}));
vi.mock('@/hooks/useAutomationApi', () => ({ default: () => ({ listAutomations }) }));

const TABLES = [
    { id: 'tbl_inv', key: 'invoices', name: 'Invoices', fields: [
        { id: 'f1', key: 'customer', name: 'Customer', type: 'text', required: true },
        { id: 'f2', key: 'amount_due', name: 'Amount due', type: 'number' },
    ] },
    { id: 'tbl_cus', key: 'customers', name: 'Customers', fields: [] },
];

const DEFINITION = {
    schemaVersion: 2,
    meta: { name: 'T' },
    homeScreenId: 'scr_a',
    screens: [
        { id: 'scr_a', name: 'List', sections: [{ id: 'sec_a', children: [
            { id: 'nd_modal', type: 'modal', props: { title: 'Confirm delete' }, children: [] },
            { id: 'nd_modal2', type: 'modal', props: {}, children: [] },
        ] }] },
        { id: 'scr_b', name: 'Detail', sections: [{ id: 'sec_b', children: [] }] },
    ],
    actions: {},
};

function jsonRes(body) {
    return { ok: true, status: 200, json: async () => body };
}

beforeEach(() => {
    vi.clearAllMocks();
    authFetch.mockImplementation(async (url) => {
        if (String(url).includes('/data/tables')) return jsonRes({ tables: TABLES });
        if (String(url).includes('/data/connectors')) return jsonRes({ connectors: [{ id: 'con_mail', name: 'Support mailbox' }] });
        if (String(url).includes('/datasets')) return jsonRes({ datasets: [{ id: 'ds_1', name: 'Overdue invoices' }] });
        return jsonRes({});
    });
});

function renderStep(step, { appId = 'app-1' } = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onChange = vi.fn();
    const utils = render(
        <QueryClientProvider client={client}>
            <EditorChromeContext.Provider value={appId ? { appId } : null}>
                <StepSettings
                    step={step}
                    onChange={onChange}
                    definition={DEFINITION}
                    screens={DEFINITION.screens}
                />
            </EditorChromeContext.Provider>
        </QueryClientProvider>,
    );
    return { onChange, last: () => onChange.mock.calls.at(-1)?.[0], ...utils };
}

/** Option texts of a <select>, minus its placeholder row. */
const optionsOf = (el) => [...el.options].map((o) => o.textContent);

describe('StepSettings — a reference is picked, never typed', () => {
    it('offers the app’s tables by name instead of a table id box', async () => {
        renderStep({ kind: 'create_record', tableId: '', values: {} });
        const control = await screen.findByLabelText('Table');
        expect(control.tagName).toBe('SELECT');
        expect(optionsOf(control)).toEqual(expect.arrayContaining(['Invoices', 'Customers']));
    });

    it('offers the app’s dialogs by their title', async () => {
        renderStep({ kind: 'open_modal', modalId: '' });
        const control = await screen.findByLabelText('Dialog');
        expect(control.tagName).toBe('SELECT');
        // A dialog with a title is named by it; one without falls back to its id
        // so it is still tellable apart.
        expect(optionsOf(control)).toEqual(expect.arrayContaining(['Confirm delete', 'nd_modal2']));
    });

    it('names the routine rather than showing its id', async () => {
        renderStep({ kind: 'run_automation', automationId: 'auto-2' });
        const control = await screen.findByLabelText('Routine');
        await waitFor(() => expect(control.textContent).toContain('Chase the payment'));
        // Not a text box: the id is never something to type.
        expect(control.tagName).toBe('BUTTON');
    });

    it('offers saved views for a narrowed refresh', async () => {
        renderStep({ kind: 'refresh', datasetId: '' });
        const control = await screen.findByLabelText('Saved view');
        expect(optionsOf(control)).toEqual(expect.arrayContaining(['Overdue invoices']));
    });

    it('keeps the screen picker it already had', async () => {
        renderStep({ kind: 'navigate', screenId: 'scr_b' });
        const control = await screen.findByLabelText('Screen');
        expect(control.tagName).toBe('SELECT');
        expect(optionsOf(control)).toContain('Detail');
    });
});

describe('StepSettings — a reference whose target is gone', () => {
    it('keeps the id and says it is missing, rather than blanking it', async () => {
        renderStep({ kind: 'create_record', tableId: 'tbl_deleted', values: {} });
        const control = await screen.findByLabelText('Table');
        // The value survives, so the person can see what the step used to do.
        await waitFor(() => expect(control.value).toBe('tbl_deleted'));
        expect(await screen.findByText(/no longer exists/i)).toBeTruthy();
        expect(control.getAttribute('aria-invalid')).toBe('true');
    });

    it('says nothing while the list has not loaded yet', () => {
        // appId null → no lists at all. An unknown id here is "not known yet",
        // never "broken" — warning on it would cry wolf on every mount.
        renderStep({ kind: 'create_record', tableId: 'tbl_inv', values: {} }, { appId: null });
        expect(screen.queryByText(/no longer exists/i)).toBeNull();
    });
});

describe('StepSettings — the values a row is written with', () => {
    it('offers the chosen table’s columns instead of asking for a spelling', async () => {
        renderStep({ kind: 'create_record', tableId: 'tbl_inv', values: { customer: { kind: 'static', value: 'x' } } });
        const control = await screen.findByLabelText('Values 1 name');
        await waitFor(() => expect(control.tagName).toBe('SELECT'));
        expect(optionsOf(control)).toEqual(expect.arrayContaining(['Customer *', 'Amount due']));
    });

    it('falls back to a typed name when the table is not known', async () => {
        renderStep({ kind: 'create_record', tableId: '', values: { whatever: { kind: 'static', value: 'x' } } });
        const control = await screen.findByLabelText('Values 1 name');
        expect(control.tagName).toBe('INPUT');
    });
});

describe('StepSettings — fields the runtime ignores', () => {
    it('does not render an editor for refresh.actionId', async () => {
        renderStep({ kind: 'refresh' });
        // The two live fields are there…
        expect(await screen.findByLabelText('Table')).toBeTruthy();
        // …and the deprecated one, which the runtime has always ignored, is not
        // offered as something to fill in.
        expect(screen.queryByLabelText('Action')).toBeNull();
    });
});

/**
 * The stored shape is an OBJECT keyed by name, so two rows cannot share one.
 * Resolving that with a plain Object.fromEntries — which is what this did —
 * keeps the last row and throws the other away without a word.
 */
describe('StepSettings — a map of name → value cannot silently eat a row', () => {
    it('does not commit a second blank row over the first', async () => {
        const { onChange } = renderStep({ kind: 'navigate', screenId: 'scr_b', params: {} });
        await screen.findByLabelText('Screen');
        fireEvent.click(screen.getByRole('button', { name: /add one/i }));
        fireEvent.click(screen.getByRole('button', { name: /add one/i }));

        // Two unnamed rows are on screen…
        expect(screen.getByLabelText('Params 1 name')).toBeTruthy();
        expect(screen.getByLabelText('Params 2 name')).toBeTruthy();
        // …and neither has been written into the step, because neither has a
        // name yet. Nothing was destroyed to make room.
        const last = onChange.mock.calls.at(-1)?.[0];
        expect(last?.params ?? {}).toEqual({});
        expect(screen.getAllByText(/not saved until you do/i).length).toBe(2);
    });

    it('refuses a rename onto a name already in use, and says why', async () => {
        const { onChange } = renderStep({
            kind: 'navigate',
            screenId: 'scr_b',
            params: { recordId: { kind: 'static', value: '1' }, tab: { kind: 'static', value: 'notes' } },
        });
        await screen.findByLabelText('Screen');
        fireEvent.change(screen.getByLabelText('Params 2 name'), { target: { value: 'recordId' } });

        expect(screen.getByText(/already used above/i)).toBeTruthy();
        // The first row's value survived — the whole point.
        const last = onChange.mock.calls.at(-1)?.[0];
        expect(last === undefined || last.params.recordId).toBeTruthy();
        expect(screen.getByLabelText('Params 1 name').value).toBe('recordId');
    });

    it('commits the row once it is named', async () => {
        const { last } = renderStep({ kind: 'navigate', screenId: 'scr_b', params: {} });
        await screen.findByLabelText('Screen');
        fireEvent.click(screen.getByRole('button', { name: /add one/i }));
        fireEvent.change(screen.getByLabelText('Params 1 name'), { target: { value: 'recordId' } });
        expect(last().params).toEqual({ recordId: { kind: 'static', value: '' } });
    });
});

/**
 * `values` is REQUIRED on create_record. Emptying it to `undefined` is a hard
 * validation error, so removing the last column mapping made the whole
 * definition unsaveable — and the error surfaced far from the step that caused
 * it. An empty map is a shape the schema accepts.
 */
describe('StepSettings — emptying a required map keeps the app saveable', () => {
    it('empties create_record values to {} rather than dropping the field', async () => {
        const { last } = renderStep({
            kind: 'create_record',
            tableId: 'tbl_inv',
            values: { customer: { kind: 'static', value: 'x' } },
        });
        await screen.findByLabelText('Table');
        fireEvent.click(screen.getByRole('button', { name: /remove values 1/i }));
        expect(last().values).toEqual({});
    });

    it('drops an optional map entirely when it is emptied', async () => {
        const { last } = renderStep({
            kind: 'navigate',
            screenId: 'scr_b',
            params: { recordId: { kind: 'static', value: '1' } },
        });
        await screen.findByLabelText('Screen');
        fireEvent.click(screen.getByRole('button', { name: /remove params 1/i }));
        expect(last().params).toBeUndefined();
    });
});

/**
 * Only `recordValues` takes a full binding. `inputMapping` accepts
 * static|field (INPUT_MAPPING_KINDS) and `navParams` accepts static|formula —
 * anything else is a hard validation error. All three used the full
 * BindingField, which offers a table, a saved view, a connector, a routine's
 * result and an aggregate, so picking one made every later autosave 422 about a
 * mapping kind chosen from a list that offered it.
 */
describe('StepSettings — a keyed row offers only the kinds the server takes', () => {
    it('navigate params offer a fixed value or a formula, not a data source', async () => {
        renderStep({ kind: 'navigate', screenId: 'scr_b', params: { recordId: { kind: 'static', value: '1' } } });
        await screen.findByLabelText('Screen');
        expect(screen.getByLabelText('Where this value comes from')).toBeTruthy();
        expect(screen.getByLabelText('Fixed value')).toBeTruthy();
        // The binding chooser's cards are the tell that the wrong editor is up.
        expect(screen.queryByText('A table in this app')).toBeNull();
        expect(screen.queryByText('A saved view')).toBeNull();
    });

    it('switching a navigate param to a formula commits the formula shape', async () => {
        const { last } = renderStep({ kind: 'navigate', screenId: 'scr_b', params: { recordId: { kind: 'static', value: '1' } } });
        await screen.findByLabelText('Screen');
        fireEvent.click(screen.getByRole('radio', { name: /worked out/i }));
        expect(last().params.recordId).toEqual({ kind: 'formula', expr: '' });
    });

    it('a record’s values still get the full binding chooser', async () => {
        renderStep({ kind: 'create_record', tableId: 'tbl_inv', values: { customer: { kind: 'static', value: '' } } });
        await screen.findByLabelText('Table');
        // A blank static IS the chooser's "nothing picked yet" state.
        expect(await screen.findByText('A table in this app')).toBeTruthy();
    });
});
