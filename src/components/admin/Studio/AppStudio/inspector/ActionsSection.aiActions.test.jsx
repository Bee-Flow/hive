import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ActionsSection from './ActionsSection';
import { EditorChromeContext } from '../editor/EditorChromeContext';

/**
 * The native AI action kinds in the inspector: kind switching + the
 * ai_extract / ai_generate / kb_query editors (AiActionEditors.jsx).
 * Only the network is stubbed — the KB list, the model-tier list and the
 * write-to table catalogue all fetch through authFetch.
 */

vi.mock('@/utils/helpers', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, authFetch: vi.fn() };
});
import { authFetch } from '@/utils/helpers';

vi.mock('../../../../../hooks/useAutomationApi', () => ({
    default: () => ({ listAutomations: vi.fn(async () => ({ automations: [] })) }),
    safeText: vi.fn(async () => ''),
}));

const json = (body) => Promise.resolve({ ok: true, status: 200, json: async () => body });

// One data table whose columns are what the write-to editor matches against.
const INVOICES = {
    id: 'tbl_inv', key: 'invoices', name: 'Invoices',
    fields: [
        { id: 'f1', key: 'invoice_number', name: 'Invoice Number', type: 'text' },
        { id: 'f2', key: 'amount', name: 'Amount', type: 'number' },
        { id: 'f3', key: 'status', name: 'Status', type: 'select', options: ['open', 'paid'] },
        { id: 'f4', key: 'total', name: 'Total', type: 'computed' },
    ],
};
let tables = [INVOICES];

beforeEach(() => {
    tables = [INVOICES];
    authFetch.mockReset();
    authFetch.mockImplementation((url) => {
        const u = String(url);
        if (u.includes('/api/kb')) return json([{ id: 'kb1', name: 'Handbook' }]);
        if (u.includes('tiers-for-user')) return json({ auto: {}, fast: { modelId: 'm-fast' }, standard: { modelId: 'm-std' } });
        if (u.includes('/data/tables')) return json({ tables });
        return json({});
    });
});

const formNode = {
    id: 'cmp_form1', type: 'form', props: { name: 'f' }, style: {},
    onSubmit: 'act1',
    children: [
        { id: 'cmp_t', type: 'input_text', props: { name: 'title' }, style: {} },
        { id: 'cmp_f', type: 'input_file', props: { name: 'upload', multiple: false }, style: {} },
    ],
};

function defWith(node, actions = {}) {
    return {
        schemaVersion: 2,
        meta: { name: 'T' },
        theme: {},
        homeScreenId: 'scr_t',
        screens: [{ id: 'scr_t', name: 'T', showInNav: true, maxWidth: 'medium', sections: [{ id: 'sec_t', style: {}, children: [node] }] }],
        actions,
    };
}

function renderActions(node, actions) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const definition = defWith(node, actions);
    const onCommit = vi.fn();
    const utils = render(
        <QueryClientProvider client={client}>
            <EditorChromeContext.Provider value={{ appId: 'app-1' }}>
                <ActionsSection node={node} definition={definition} onCommit={onCommit} disabled={false} />
            </EditorChromeContext.Provider>
        </QueryClientProvider>,
    );
    const lastAction = () => onCommit.mock.calls.at(-1)[0].actions.act1;
    return { onCommit, lastAction, ...utils };
}

/** Same, but the commits feed back in — needed to see an edit take effect. */
function renderControlled(node, actions) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onCommit = vi.fn();
    function Harness() {
        const [definition, setDefinition] = useState(defWith(node, actions));
        return (
            <ActionsSection
                node={node}
                definition={definition}
                onCommit={(next) => { setDefinition(next); onCommit(next); }}
                disabled={false}
            />
        );
    }
    const utils = render(
        <QueryClientProvider client={client}>
            <EditorChromeContext.Provider value={{ appId: 'app-1' }}>
                <Harness />
            </EditorChromeContext.Provider>
        </QueryClientProvider>,
    );
    const lastAction = () => onCommit.mock.calls.at(-1)[0].actions.act1;
    return { onCommit, lastAction, ...utils };
}

describe('ActionsSection — native AI actions', () => {
    it('offers the AI kinds and commits their defaults on switch', () => {
        const { getByRole, lastAction } = renderActions(formNode, { act1: { kind: 'run_automation', automationId: null } });
        const kindSelect = getByRole('combobox', { name: 'Action kind' });
        const options = Array.from(kindSelect.options).map((o) => o.value);
        expect(options).toEqual(expect.arrayContaining(['ai_extract', 'ai_generate', 'kb_query']));

        fireEvent.change(kindSelect, { target: { value: 'ai_generate' } });
        expect(lastAction()).toEqual({ kind: 'ai_generate', prompt: '', output: 'text', resultVar: 'result' });
    });

    it('ai_generate: edits the prompt and shows the schema editor only for structured output', () => {
        const { getByLabelText, lastAction, queryByText } = renderActions(formNode, {
            act1: { kind: 'ai_generate', prompt: '', output: 'text', resultVar: 'result' },
        });
        expect(queryByText('Fields to return')).toBeNull(); // text output → no schema

        fireEvent.change(getByLabelText('AI prompt'), { target: { value: 'Summarize {{form.title}}' } });
        expect(lastAction().prompt).toBe('Summarize {{form.title}}');
    });

    it('ai_generate (structured): renders the declared-fields editor and adds a field', () => {
        const { getByText, lastAction } = renderActions(formNode, {
            act1: { kind: 'ai_generate', prompt: 'x', output: 'structured', schema: [], resultVar: 'r' },
        });
        expect(getByText('Fields to return')).toBeTruthy();
        fireEvent.click(getByText('+ Add field'));
        expect(lastAction().schema).toEqual([{ name: 'field', type: 'string', description: '', required: false }]);
    });

    it('ai_extract: the document picker offers only file inputs and stores a formula binding', () => {
        const { getByLabelText, lastAction } = renderActions(formNode, {
            act1: { kind: 'ai_extract', schema: [{ name: 'vendor', type: 'string' }] },
        });
        const select = getByLabelText('Document input field');
        const values = Array.from(select.options).map((o) => o.value).filter(Boolean);
        expect(values).toEqual(['upload']); // the input_text is filtered out

        fireEvent.change(select, { target: { value: 'upload' } });
        // A formula binding is the only kind that both validates and resolves a
        // raw form value server-side.
        expect(lastAction().source).toEqual({ kind: 'formula', expr: 'form.upload' });
    });

    it('ai_extract: a fresh step points at the form\'s file input rather than erroring on a missing source', () => {
        const { getByRole, lastAction } = renderActions(formNode, { act1: { kind: 'run_automation', automationId: null } });
        fireEvent.change(getByRole('combobox', { name: 'Action kind' }), { target: { value: 'ai_extract' } });
        // `source` is required — defaulting it empty greets the builder with a
        // red "missing required `source`" before they have touched anything.
        expect(lastAction().source).toEqual({ kind: 'formula', expr: 'form.upload' });
    });

    it('ai_extract: clearing the document input leaves it cleared', () => {
        const { getByLabelText, lastAction } = renderControlled(formNode, {
            act1: {
                kind: 'ai_extract', source: { kind: 'formula', expr: 'form.upload' },
                schema: [{ name: 'vendor', type: 'string' }],
            },
        });
        // The one-file-input shortcut may only ever seed an UNSET source; re-running
        // it here would refill the field before another one can be chosen.
        fireEvent.change(getByLabelText('Document input field'), { target: { value: '' } });
        expect(lastAction().source).toBeNull();
        expect(getByLabelText('Document input field').value).toBe('');
    });

    it('ai_extract: an untouched schema adopts the table\'s columns and maps them on write-to', async () => {
        const { findByLabelText, getByLabelText, lastAction } = renderActions(formNode, {
            act1: {
                kind: 'ai_extract', source: { kind: 'formula', expr: 'form.upload' },
                schema: [{ name: 'field1', type: 'string', description: '', required: false }],
            },
        });
        // The toggle stays disabled until the table catalogue lands.
        const toggle = await findByLabelText('Write extracted rows to a data table');
        await waitFor(() => expect(toggle.disabled).toBe(false));
        fireEvent.click(toggle);

        const action = lastAction();
        // The placeholder schema is replaced by the table's own columns — typed,
        // described, and matched 1:1. `total` is computed, so it is not offered.
        expect(action.schema).toEqual([
            { name: 'invoice_number', type: 'string', description: 'Invoice Number', required: false },
            { name: 'amount', type: 'number', description: 'Amount', required: false },
            { name: 'status', type: 'string', description: 'Status. One of: open, paid', required: false },
        ]);
        expect(action.writeTo).toEqual({
            tableId: 'tbl_inv',
            mapping: { invoice_number: 'invoice_number', amount: 'amount', status: 'status' },
        });
    });

    it('ai_extract: an authored schema is kept and matched to columns by name', async () => {
        const { findByLabelText, getByLabelText, lastAction } = renderActions(formNode, {
            act1: {
                kind: 'ai_extract', source: { kind: 'formula', expr: 'form.upload' },
                schema: [
                    { name: 'invoiceNumber', type: 'string', description: 'the number' },
                    { name: 'amount', type: 'number', description: 'the total' },
                    { name: 'vendor', type: 'string', description: 'who sent it' },
                ],
            },
        });
        // The toggle stays disabled until the table catalogue lands.
        const toggle = await findByLabelText('Write extracted rows to a data table');
        await waitFor(() => expect(toggle.disabled).toBe(false));
        fireEvent.click(toggle);

        const action = lastAction();
        expect(action.schema).toHaveLength(3); // the builder's own fields survive
        // invoiceNumber ↔ invoice_number matches once case and punctuation are
        // normalized; vendor has no column and is simply left unmapped.
        expect(action.writeTo.mapping).toEqual({ invoice_number: 'invoiceNumber', amount: 'amount' });
    });

    it('ai_extract: renaming an output field carries its column across', async () => {
        const { findByLabelText, getByLabelText, lastAction } = renderActions(formNode, {
            act1: {
                kind: 'ai_extract', source: { kind: 'formula', expr: 'form.upload' },
                schema: [{ name: 'amount', type: 'number', description: 'x' }],
                writeTo: { tableId: 'tbl_inv', mapping: { amount: 'amount' } },
            },
        });
        await findByLabelText('Column for amount');
        fireEvent.change(getByLabelText('Field 1 name'), { target: { value: 'total_due' } });
        // Without this the mapping still names `amount`, which no longer exists,
        // and the column silently writes null.
        expect(lastAction().writeTo.mapping).toEqual({ amount: 'total_due' });
    });

    it('ai_extract: warns when nothing would be saved', async () => {
        const { findByText } = renderActions(formNode, {
            act1: {
                kind: 'ai_extract', source: { kind: 'formula', expr: 'form.upload' },
                schema: [{ name: 'vendor', type: 'string', description: 'x' }],
                writeTo: { tableId: 'tbl_inv', mapping: {} },
            },
        });
        expect(await findByText(/nothing would be saved/i)).toBeTruthy();
    });

    it('kb_query: lists knowledge bases and toggling one commits its id', async () => {
        const { findByLabelText, lastAction } = renderActions(formNode, {
            act1: { kind: 'kb_query', query: { kind: 'static', value: '' }, knowledgeBaseIds: [], resultVar: 'results' },
        });
        const cb = await findByLabelText('Ground in Handbook');
        fireEvent.click(cb);
        expect(lastAction().knowledgeBaseIds).toEqual(['kb1']);
    });
});
