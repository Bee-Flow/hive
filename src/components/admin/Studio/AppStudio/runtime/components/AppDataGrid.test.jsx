import { fireEvent, render, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AppDataGrid from './AppDataGrid';
import { RuntimeProvider, buildScope, DEFAULT_RUNTIME } from '../RuntimeContext';

function withRuntime(ui, overrides = {}) {
    const value = {
        ...DEFAULT_RUNTIME,
        scope: buildScope({ now: '2020-01-01T00:00:00.000Z' }),
        mode: 'run',
        ...overrides,
    };
    return render(<RuntimeProvider value={value}>{ui}</RuntimeProvider>);
}

const ROWS = [
    { id: 1, name: 'Zoe', score: 30, status: 'open' },
    { id: 2, name: 'Amy', score: 10, status: 'done' },
    { id: 3, name: 'Max', score: 20, status: 'open' },
    { id: 4, name: 'Bea', score: 40, status: 'done' },
    { id: 5, name: 'Cy', score: 50, status: 'open' },
];

function gridNode(overrides = {}, propOverrides = {}) {
    return {
        id: 'cmp_grid', type: 'data_grid', visible: true,
        props: {
            source: { kind: 'static', value: ROWS },
            columns: [
                { key: 'name', label: 'Name', format: 'text', sortable: true },
                { key: 'score', label: 'Score', format: 'number', sortable: true },
                { key: 'status', label: 'Status', format: 'badge' },
            ],
            pageSize: 25, selectable: 'none', searchable: false, rowActions: [],
            density: 'comfortable', emptyText: 'Nothing to show yet.',
            ...propOverrides,
        },
        style: { span: 12 },
        ...overrides,
    };
}

function bodyRowTexts(container) {
    const rows = container.querySelectorAll('tbody tr');
    return Array.from(rows)
        .filter((tr) => !tr.getAttribute('aria-hidden') && tr.querySelector('td'))
        .map((tr) => tr.querySelector('td')?.textContent);
}

describe('AppDataGrid', () => {
    it('renders bound rows', () => {
        const { getByText } = withRuntime(<AppDataGrid node={gridNode()} />);
        expect(getByText('Zoe')).toBeTruthy();
        expect(getByText('Bea')).toBeTruthy();
    });

    it('shows the empty state when unbound', () => {
        const { getByText } = withRuntime(
            <AppDataGrid node={gridNode({}, { source: { kind: 'static', value: [] } })} />,
        );
        expect(getByText('Nothing to show yet.')).toBeTruthy();
    });

    it('sorts ascending then descending on header click', () => {
        const { container, getByRole } = withRuntime(<AppDataGrid node={gridNode()} />);
        const nameHeader = getByRole('button', { name: /Name/ });
        fireEvent.click(nameHeader);
        expect(bodyRowTexts(container)[0]).toBe('Amy');
        fireEvent.click(nameHeader);
        expect(bodyRowTexts(container)[0]).toBe('Zoe');
    });

    it('filters rows via the search box', () => {
        const { container, getByLabelText } = withRuntime(
            <AppDataGrid node={gridNode({}, { searchable: true })} />,
        );
        fireEvent.change(getByLabelText('Search rows'), { target: { value: 'Amy' } });
        const texts = bodyRowTexts(container);
        expect(texts).toEqual(['Amy']);
    });

    it('paginates with a small page size', () => {
        const { container, getByLabelText } = withRuntime(
            <AppDataGrid node={gridNode({}, { pageSize: 2 })} />,
        );
        expect(bodyRowTexts(container).length).toBe(2);
        const firstPage = bodyRowTexts(container).join(',');
        fireEvent.click(getByLabelText('Next page'));
        expect(bodyRowTexts(container).join(',')).not.toBe(firstPage);
    });

    it('fires a row action via runAction', () => {
        const runAction = vi.fn();
        const { getAllByText } = withRuntime(
            <AppDataGrid node={gridNode({}, { rowActions: [{ label: 'Open', actionId: 'act_open' }] })} />,
            { runAction },
        );
        fireEvent.click(getAllByText('Open')[0]);
        expect(runAction).toHaveBeenCalledWith('act_open', expect.objectContaining({ formValues: expect.any(Object) }));
    });

    it('fires an update via runAction on inline edit', () => {
        const runAction = vi.fn();
        const node = gridNode(
            { onRowSelect: 'act_update' },
            { columns: [{ key: 'name', label: 'Name', format: 'text', editable: true }] },
        );
        const { getAllByLabelText } = withRuntime(<AppDataGrid node={node} />, { runAction });
        const input = getAllByLabelText('Edit cell')[0];
        fireEvent.change(input, { target: { value: 'Zed' } });
        fireEvent.blur(input);
        expect(runAction).toHaveBeenCalledWith('act_update', expect.objectContaining({
            formValues: expect.objectContaining({ name: 'Zed', __edited: 'name' }),
        }));
    });

    it('selects rows and notifies onRowSelect', () => {
        const runAction = vi.fn();
        const { getAllByLabelText } = withRuntime(
            <AppDataGrid node={gridNode({ onRowSelect: 'act_sel' }, { selectable: 'multi' })} />,
            { runAction },
        );
        fireEvent.click(getAllByLabelText('Select row')[0]);
        expect(runAction).toHaveBeenCalledWith('act_sel', expect.objectContaining({
            formValues: expect.objectContaining({ selected: expect.any(Array) }),
        }));
    });

    it('rolls the inline-edit overlay back when the update action fails', () => {
        const node = gridNode(
            { onRowSelect: 'act_update' },
            { columns: [{ key: 'name', label: 'Name', format: 'text', editable: true }] },
        );
        const ui = (actionState) => (
            <RuntimeProvider value={{
                ...DEFAULT_RUNTIME, scope: buildScope({ now: '2020-01-01T00:00:00.000Z' }),
                mode: 'run', runAction: vi.fn(), actionState,
            }}
            >
                <AppDataGrid node={node} />
            </RuntimeProvider>
        );
        const { getAllByLabelText, rerender } = render(ui({}));
        const input = getAllByLabelText('Edit cell')[0];
        fireEvent.change(input, { target: { value: 'Zed' } });
        fireEvent.blur(input);
        expect(getAllByLabelText('Edit cell')[0].value).toBe('Zed');

        rerender(ui({ act_update: { status: 'running', result: undefined, error: null } }));
        rerender(ui({ act_update: { status: 'error', result: undefined, error: 'Could not save' } }));
        expect(getAllByLabelText('Edit cell')[0].value).toBe('Zoe');
    });

    it('queues a second inline edit while a commit is running and dispatches it on settle', () => {
        // useActionRunner's re-entry guard silently drops a run of an action
        // that is still 'running' — the grid must queue instead, or the second
        // cell of a fast Tab-through entry is never saved.
        const runAction = vi.fn();
        const node = gridNode(
            { onRowSelect: 'act_update' },
            { columns: [{ key: 'name', label: 'Name', format: 'text', editable: true }] },
        );
        const ui = (actionState) => (
            <RuntimeProvider value={{
                ...DEFAULT_RUNTIME, scope: buildScope({ now: '2020-01-01T00:00:00.000Z' }),
                mode: 'run', runAction, actionState,
            }}
            >
                <AppDataGrid node={node} />
            </RuntimeProvider>
        );
        const { getAllByLabelText, rerender } = render(ui({}));
        const first = getAllByLabelText('Edit cell')[0];
        fireEvent.change(first, { target: { value: 'Zed' } });
        fireEvent.blur(first);
        expect(runAction).toHaveBeenCalledTimes(1);

        rerender(ui({ act_update: { status: 'running', result: undefined, error: null } }));
        const second = getAllByLabelText('Edit cell')[1];
        fireEvent.change(second, { target: { value: 'Ann' } });
        fireEvent.blur(second);
        // Not dispatched while the first commit is live — queued, and its
        // optimistic value stays on screen.
        expect(runAction).toHaveBeenCalledTimes(1);
        expect(getAllByLabelText('Edit cell')[1].value).toBe('Ann');

        rerender(ui({ act_update: { status: 'success', result: undefined, error: null } }));
        expect(runAction).toHaveBeenCalledTimes(2);
        expect(runAction.mock.calls[1][1].formValues).toMatchObject({ name: 'Ann', __edited: 'name' });
    });

    it('drops the inline-edit overlay once refetched rows arrive', () => {
        const columns = [{ key: 'name', label: 'Name', format: 'text', editable: true }];
        const served = [{ ...ROWS[0], name: 'Server' }, ...ROWS.slice(1)];
        const ui = (rows) => (
            <RuntimeProvider value={{
                ...DEFAULT_RUNTIME, scope: buildScope({ now: '2020-01-01T00:00:00.000Z' }),
                mode: 'run', runAction: vi.fn(),
            }}
            >
                <AppDataGrid node={gridNode({ onRowSelect: 'act_update' }, { columns, source: { kind: 'static', value: rows } })} />
            </RuntimeProvider>
        );
        const { getAllByLabelText, rerender } = render(ui(ROWS));
        const input = getAllByLabelText('Edit cell')[0];
        fireEvent.change(input, { target: { value: 'Zed' } });
        fireEvent.blur(input);
        expect(getAllByLabelText('Edit cell')[0].value).toBe('Zed');

        rerender(ui(served));
        expect(getAllByLabelText('Edit cell')[0].value).toBe('Server');
    });

    it('renders in edit mode from sampled rows without firing actions', () => {
        const runAction = vi.fn();
        const { getByText } = withRuntime(<AppDataGrid node={gridNode()} />, { mode: 'edit', runAction });
        expect(getByText('Zoe')).toBeTruthy();
        expect(runAction).not.toHaveBeenCalled();
    });
});
