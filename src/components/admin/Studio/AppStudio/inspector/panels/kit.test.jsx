import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import KanbanInspector from './KanbanInspector';
import { FieldKeyField, IconField } from './kit';
import { EditorChromeContext } from '../../editor/EditorChromeContext';

/**
 * The two shared fields a non-technical builder meets everywhere: the icon
 * name (was a bare text box hinting at a library they have never heard of)
 * and a data field name (was typed from memory in six panels).
 */

vi.mock('@/utils/helpers', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, authFetch: vi.fn() };
});
import { authFetch } from '@/utils/helpers';

const TASKS = {
    id: 'tbl_task', key: 'tasks', name: 'Tasks',
    fields: [
        { id: 'f1', key: 'title', name: 'Title', type: 'text' },
        { id: 'f2', key: 'status', name: 'Status', type: 'select' },
    ],
};

beforeEach(() => {
    authFetch.mockReset();
    authFetch.mockImplementation(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ tables: [TASKS] }) }));
});

const ROWS = { kind: 'static', value: [{ title: 'Ship it', status: 'open' }] };

describe('IconField', () => {
    it('browses the shared icon picker and stores the picked name', () => {
        const onChange = vi.fn();
        const { getByLabelText, getByText, getByTitle } = render(
            <IconField label="Icon" value={null} onChange={onChange} />,
        );
        fireEvent.click(getByLabelText('Icon — browse icons'));
        expect(getByText('Choose an icon')).toBeTruthy();
        fireEvent.click(getByTitle('Activity'));
        expect(onChange).toHaveBeenCalledWith('Activity');
    });

    it('keeps the free-text input as the power-user path', () => {
        const onChange = vi.fn();
        const { getByPlaceholderText } = render(<IconField label="Icon" value={null} onChange={onChange} />);
        fireEvent.change(getByPlaceholderText('Activity'), { target: { value: 'Rocket' } });
        expect(onChange).toHaveBeenCalledWith('Rocket');
    });
});

describe('FieldKeyField', () => {
    it('lists the fields it can see on a static source', () => {
        const onChange = vi.fn();
        const { getByLabelText } = render(
            <FieldKeyField label="Title field" value="" onChange={onChange} source={ROWS} ariaLabel="Title field" />,
        );
        const select = getByLabelText('Title field');
        expect(Array.from(select.options).map((o) => o.textContent))
            .toEqual(['Pick a field…', 'title', 'status', 'Type a name myself…']);
        fireEvent.change(select, { target: { value: 'status' } });
        expect(onChange).toHaveBeenCalledWith('status');
    });

    it('reveals the text input behind "Type a name myself…"', () => {
        const { getByLabelText, queryByLabelText, getByText } = render(
            <FieldKeyField label="Title field" value="" onChange={vi.fn()} source={ROWS} ariaLabel="Title field" />,
        );
        expect(queryByLabelText('Title field name')).toBeNull();
        fireEvent.change(getByLabelText('Title field'), { target: { value: getByText('Type a name myself…').value } });
        expect(getByLabelText('Title field name')).toBeTruthy();
    });

    it('shows a name the source does not know as typed-in', () => {
        const { getByLabelText } = render(
            <FieldKeyField label="Title field" value="fromElsewhere" onChange={vi.fn()} source={ROWS} ariaLabel="Title field" />,
        );
        expect(getByLabelText('Title field name').value).toBe('fromElsewhere');
    });

    it('degrades to the plain text input when nothing can be detected', () => {
        const { getByLabelText, queryByLabelText } = render(
            <FieldKeyField label="Title field" value="title" onChange={vi.fn()} source={{ kind: 'dataset', datasetId: 'ds1' }} ariaLabel="Title field" />,
        );
        expect(queryByLabelText('Title field')).toBeNull();
        expect(getByLabelText('Title field name').value).toBe('title');
    });

    it('resolves a table source through the app data model', async () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const { findByLabelText } = render(
            <QueryClientProvider client={client}>
                <EditorChromeContext.Provider value={{ appId: 'app-1' }}>
                    <FieldKeyField
                        label="Group by field"
                        value=""
                        onChange={vi.fn()}
                        source={{ kind: 'records', tableId: 'tbl_task' }}
                        ariaLabel="Group by field"
                    />
                </EditorChromeContext.Provider>
            </QueryClientProvider>,
        );
        const select = await findByLabelText('Group by field');
        await vi.waitFor(() => {
            expect(Array.from(select.options).map((o) => o.value)).toContain('status');
        });
    });
});

describe('FieldKeyField — reuse in the data panels', () => {
    it('kanban "Group by" is a field list, not a remembered name', () => {
        const node = {
            id: 'cmp_kan1', type: 'kanban', visible: true,
            props: { source: ROWS, columns: [], groupByField: '', titleKey: '', allowDrag: true },
            style: { span: 12 },
        };
        const definition = {
            schemaVersion: 2, meta: { name: 'T' }, theme: {}, homeScreenId: 'scr_k',
            screens: [{ id: 'scr_k', name: 'T', showInNav: true, maxWidth: 'medium', sections: [{ id: 'sec_k', style: {}, children: [node] }] }],
            actions: {},
        };
        const onCommit = vi.fn();
        const { getByLabelText } = render(
            <KanbanInspector node={node} definition={definition} onCommit={onCommit} disabled={false} />,
        );
        fireEvent.change(getByLabelText('Group by field'), { target: { value: 'status' } });
        expect(onCommit.mock.calls.at(-1)[0].screens[0].sections[0].children[0].props.groupByField).toBe('status');
    });
});
