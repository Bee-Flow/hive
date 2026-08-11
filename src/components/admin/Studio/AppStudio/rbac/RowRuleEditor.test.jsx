import { render, fireEvent, waitFor } from '@testing-library/react';
import { createRequire } from 'module';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./useAppRoles', () => ({ default: vi.fn() }));

import RowRuleEditor from './RowRuleEditor';
import useAppRoles from './useAppRoles';

// The gateway that has to accept whatever the pickers produce.
const require = createRequire(import.meta.url);
const gateway = require('../../../../../../../server/appStudio/rlsGateway.js');

let saveTableAccess;

const tasks = (rowFilters = {}, extra = {}) => ({
    id: 't1',
    key: 'tasks',
    name: 'Tasks',
    fields: [
        { key: 'owner_id', name: 'Owner', type: 'text' },
        { key: 'status', name: 'Status', type: 'select', options: ['open', 'closed'] },
        { key: 'amount', name: 'Amount', type: 'number' },
    ],
    access: { default: 'app', roles: {}, rowFilters },
    ...extra,
});

function mockRoles(tables) {
    useAppRoles.mockReturnValue({
        roles: [{ key: 'member', label: 'Member' }],
        tables,
        saveTableAccess,
        savingAccess: false,
    });
}

beforeEach(() => {
    saveTableAccess = vi.fn().mockResolvedValue({});
    mockRoles([tasks()]);
});

describe('RowRuleEditor — building a rule without typing code', () => {
    it('writes the same expression the server accepts from three dropdowns', async () => {
        const { getByText, getByLabelText } = render(<RowRuleEditor appId="a1" />);
        fireEvent.click(getByText('Add a condition'));
        fireEvent.change(getByLabelText('Compare with, condition 1'), { target: { value: 'viewer.id' } });

        fireEvent.click(getByText('Save row access'));
        await waitFor(() => expect(saveTableAccess).toHaveBeenCalled());
        const [tableId, patch] = saveTableAccess.mock.calls[0];
        expect(tableId).toBe('t1');
        expect(patch.rowFilters).toEqual({ member: 'record.owner_id == viewer.id' });
        expect(patch.roles.member.read).toBe('all');
    });

    it('saves a typed value as a quoted literal', async () => {
        const { getByText, getByLabelText } = render(<RowRuleEditor appId="a1" />);
        fireEvent.click(getByText('Add a condition'));
        fireEvent.change(getByLabelText('Column, condition 1'), { target: { value: 'status' } });
        fireEvent.change(getByLabelText('Value, condition 1'), { target: { value: 'open' } });

        fireEvent.click(getByText('Save row access'));
        await waitFor(() => expect(saveTableAccess).toHaveBeenCalled());
        expect(saveTableAccess.mock.calls[0][1].rowFilters).toEqual({ member: 'record.status == "open"' });
    });

    it('shows a saved rule as picker conditions, not as text', () => {
        mockRoles([tasks({ member: 'record.owner_id == viewer.id && record.status == "open"' })]);
        const { getByLabelText, queryByLabelText } = render(<RowRuleEditor appId="a1" />);
        expect(queryByLabelText('Row rule expression')).toBeNull();
        expect(getByLabelText('Column, condition 1').value).toBe('owner_id');
        expect(getByLabelText('Compare with, condition 1').value).toBe('viewer.id');
        expect(getByLabelText('Value, condition 2').value).toBe('open');
    });

    it('produces a rule the server gateway accepts and binds every value in', async () => {
        const { getByText, getByLabelText } = render(<RowRuleEditor appId="a1" />);
        fireEvent.click(getByText('Add a condition'));
        fireEvent.change(getByLabelText('Compare with, condition 1'), { target: { value: 'viewer.id' } });
        fireEvent.click(getByText('Add a condition'));
        fireEvent.change(getByLabelText('Column, condition 2'), { target: { value: 'amount' } });
        fireEvent.change(getByLabelText('Test, condition 2'), { target: { value: '>' } });
        fireEvent.change(getByLabelText('Value, condition 2'), { target: { value: '100' } });

        fireEvent.click(getByText('Save row access'));
        await waitFor(() => expect(saveTableAccess).toHaveBeenCalled());
        const expr = saveTableAccess.mock.calls[0][1].rowFilters.member;
        expect(expr).toBe('record.owner_id == viewer.id && record.amount > 100');
        expect(gateway.validateRowFilter(expr, tasks())).toEqual({ ok: true, errors: [] });
        expect(gateway.rowFilterToSql(expr, { id: 'alice' }, tasks()))
            .toEqual({ sql: '(("owner_id" = ?) AND ("amount" > ?))', params: ['alice', 100] });
    });

    it('refuses to save a half-filled condition instead of silently widening the rule', () => {
        const { getByText } = render(<RowRuleEditor appId="a1" />);
        fireEvent.click(getByText('Add a condition'));
        expect(getByText('Fill in the value.')).toBeTruthy();
        expect(getByText('Save row access').disabled).toBe(true);
    });
});

describe('RowRuleEditor — the raw expression stays reachable', () => {
    it('carries the built rule into the raw box and back', () => {
        const { getByText, getByLabelText } = render(<RowRuleEditor appId="a1" />);
        fireEvent.click(getByText('Only rows they added themselves'));
        fireEvent.click(getByText('Write it myself'));
        expect(getByLabelText('Row rule expression').value).toBe('record.created_by == viewer.id');

        fireEvent.click(getByText('Back to the picker'));
        expect(getByLabelText('Column, condition 1').value).toBe('created_by');
    });

    it('opens a rule the pickers cannot show in the raw box, untouched', async () => {
        const expr = 'record.owner_id == viewer.id && (record.status == "open" || record.amount > 5)';
        mockRoles([tasks({ member: expr })]);
        const { getByLabelText, getByText } = render(<RowRuleEditor appId="a1" />);
        expect(getByLabelText('Row rule expression').value).toBe(expr);
        expect(getByText('Back to the picker').disabled).toBe(true);
        expect(getByText(/stays as text — it is saved exactly as written/)).toBeTruthy();

        fireEvent.click(getByText('Save row access'));
        await waitFor(() => expect(saveTableAccess).toHaveBeenCalled());
        expect(saveTableAccess.mock.calls[0][1].rowFilters).toEqual({ member: expr });
    });

    it('flags an out-of-subset rule and blocks saving', () => {
        mockRoles([tasks({ member: 'lower(record.owner_id) == "x"' })]);
        const { getByText, container } = render(<RowRuleEditor appId="a1" />);
        expect(container.querySelector('[data-rule-error]')).toBeTruthy();
        expect(getByText('Save row access').disabled).toBe(true);
    });

    it('inserts a column into the raw box', () => {
        const { getByText, getByLabelText } = render(<RowRuleEditor appId="a1" />);
        fireEvent.click(getByText('Write it myself'));
        fireEvent.click(getByText('record.owner_id'));
        expect(getByLabelText('Row rule expression').value).toContain('record.owner_id');
    });
});

describe('RowRuleEditor — who ends up seeing what', () => {
    it('spells out the rows, the writes and the owner exemption', () => {
        mockRoles([tasks({ member: 'record.owner_id == viewer.id' })]);
        const { getByTestId } = render(<RowRuleEditor appId="a1" />);
        const text = getByTestId('row-rule-outcome').textContent;
        expect(text).toContain('Member sees only the rows in Tasks where Owner is the person opening the app.');
        expect(text).toMatch(/change or delete every row they can see/);
        expect(text).toMatch(/you always see and change every row yourself/);
    });

    it('says what the "only the rows they added" preset really hands out', () => {
        const { getByText, getByTestId } = render(<RowRuleEditor appId="a1" />);
        fireEvent.click(getByText('Only the rows they added'));
        const text = getByTestId('row-rule-outcome').textContent;
        expect(text).toContain('Member sees only the rows in Tasks they added themselves.');
        expect(text).toMatch(/add new rows, and change or delete the rows they added/);
    });

    it('says a rule changes nothing when the role has no access', () => {
        const { getByText, getByTestId } = render(<RowRuleEditor appId="a1" />);
        fireEvent.click(getByText('No access'));
        expect(getByTestId('row-rule-outcome').textContent).toMatch(/cannot add any\. A row rule changes nothing here\./);
    });
});

describe('RowRuleEditor — a role set up in more detail than the presets', () => {
    // Read every row, change nothing: what the AI builder writes for a look-only role.
    const lookOnly = () => tasks({}, {
        access: {
            default: 'app',
            roles: { member: { read: 'all', create: false, update: 'none', delete: 'none' } },
            rowFilters: {},
        },
    });

    it('saves a rule without handing out changing and deleting on the way', async () => {
        mockRoles([lookOnly()]);
        const { getByText, getByLabelText } = render(<RowRuleEditor appId="a1" />);
        fireEvent.click(getByText('Add a condition'));
        fireEvent.change(getByLabelText('Compare with, condition 1'), { target: { value: 'viewer.id' } });

        fireEvent.click(getByText('Save row access'));
        await waitFor(() => expect(saveTableAccess).toHaveBeenCalled());
        const patch = saveTableAccess.mock.calls[0][1];
        expect(patch.roles.member).toEqual({ read: 'all', create: false, update: 'none', delete: 'none' });
        expect(patch.rowFilters).toEqual({ member: 'record.owner_id == viewer.id' });
    });

    it('says so instead of highlighting a preset it is not, and describes what it really is', () => {
        mockRoles([lookOnly()]);
        const { getByText, getByTestId, container } = render(<RowRuleEditor appId="a1" />);
        const checked = [...container.querySelectorAll('[role="radio"]')].filter((b) => b.getAttribute('aria-checked') === 'true');
        expect(checked).toHaveLength(0);
        expect(getByText(/more detailed mix of what it may do/)).toBeTruthy();
        expect(getByTestId('row-rule-outcome').textContent)
            .toMatch(/cannot add, change or delete anything — they can only look\./);
    });

    it('replaces the mix once a preset is picked, and only then', async () => {
        mockRoles([lookOnly()]);
        const { getByText } = render(<RowRuleEditor appId="a1" />);
        fireEvent.click(getByText('See, change and delete every row'));

        fireEvent.click(getByText('Save row access'));
        await waitFor(() => expect(saveTableAccess).toHaveBeenCalled());
        expect(saveTableAccess.mock.calls[0][1].roles.member)
            .toEqual({ read: 'all', create: true, update: 'all', delete: 'all' });
    });
});

describe('RowRuleEditor — unsaved work', () => {
    it('confirms before switching table throws away an unsaved rule', () => {
        mockRoles([tasks(), { ...tasks(), id: 't2', key: 'notes', name: 'Notes' }]);
        const { getByLabelText, getByText, queryByText } = render(<RowRuleEditor appId="a1" />);
        fireEvent.click(getByText('Only rows they added themselves'));

        fireEvent.change(getByLabelText('Table'), { target: { value: 't2' } });
        expect(getByText('Discard your unsaved changes?')).toBeTruthy();
        // Nothing switched yet, and the unsaved rule is still on screen.
        expect(getByLabelText('Column, condition 1').value).toBe('created_by');

        fireEvent.click(getByText('Keep editing'));
        expect(queryByText('Discard your unsaved changes?')).toBeNull();
        expect(getByLabelText('Table').value).toBe('t1');

        fireEvent.change(getByLabelText('Table'), { target: { value: 't2' } });
        fireEvent.click(getByText('Discard changes'));
        expect(getByLabelText('Table').value).toBe('t2');
        expect(getByText('Add a condition')).toBeTruthy();
    });

    it('switches without asking when nothing was edited', () => {
        mockRoles([tasks(), { ...tasks(), id: 't2', key: 'notes', name: 'Notes' }]);
        const { getByLabelText, queryByText } = render(<RowRuleEditor appId="a1" />);
        fireEvent.change(getByLabelText('Table'), { target: { value: 't2' } });
        expect(queryByText('Discard your unsaved changes?')).toBeNull();
        expect(getByLabelText('Table').value).toBe('t2');
    });

    it('does not claim unsaved changes for a stored rule it only re-spells', () => {
        // `===` and a flipped comparison compile to the same SQL, so reading them
        // back into pickers must not look like an edit.
        mockRoles([
            tasks({ member: 'viewer.id === record.owner_id' }),
            { ...tasks(), id: 't2', key: 'notes', name: 'Notes' },
        ]);
        const onDirtyChange = vi.fn();
        const { getByLabelText, queryByText } = render(<RowRuleEditor appId="a1" onDirtyChange={onDirtyChange} />);
        expect(onDirtyChange).not.toHaveBeenCalledWith(true);
        fireEvent.change(getByLabelText('Table'), { target: { value: 't2' } });
        expect(queryByText('Discard your unsaved changes?')).toBeNull();
    });
});
