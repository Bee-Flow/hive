import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./recordsApi', () => ({
    PAGE_SIZE: 100,
    listRecords: vi.fn(),
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
}));
vi.mock('../../../../shared/Toast', () => {
    const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    return { default: toast, toast };
});

import { createRecord, deleteRecord, listRecords, updateRecord } from './recordsApi';
import RowsTab from './RowsTab';
import toast from '../../../../shared/Toast';

/**
 * RowsTab is the only place in the product where a table's records can be seen
 * or typed. These tests pin what makes it usable rather than merely present:
 * a column edits AS ITS TYPE, one edit sends one column, and a refusal from the
 * server is shown in the server's own words instead of vanishing.
 */

const TABLE = {
    id: 'tbl_a',
    key: 'invoices',
    name: 'Invoices',
    fields: [
        { id: 'f1', key: 'client', name: 'Client', type: 'text', required: true },
        { id: 'f2', key: 'amount', name: 'Amount', type: 'number' },
        { id: 'f3', key: 'status', name: 'Status', type: 'select', options: ['Open', 'Paid'] },
        { id: 'f4', key: 'sent', name: 'Sent', type: 'bool' },
    ],
};

const ROW = { id: 'rec_1', client: 'Anna', amount: 120, status: 'Open', sent: 0, updated_at: '2026-08-07T09:00:00.000Z' };

function renderRows(props = {}) {
    return render(<RowsTab appId="app1" table={TABLE} tables={[TABLE]} {...props} />);
}

beforeEach(() => {
    vi.clearAllMocks();
    listRecords.mockResolvedValue({ records: [ROW], nextCursor: null });
    updateRecord.mockImplementation(async (appId, tableId, id, values) => ({ record: { ...ROW, ...values } }));
    createRecord.mockResolvedValue({ id: 'rec_2', record: { id: 'rec_2', client: 'Bram', amount: null, status: null, sent: 0 } });
    deleteRecord.mockResolvedValue({ success: true });
});

describe('RowsTab', () => {
    it('invites the first row or a paste instead of showing a blank box', async () => {
        listRecords.mockResolvedValue({ records: [], nextCursor: null });
        renderRows();

        expect(await screen.findByText('No rows yet.')).toBeTruthy();
        expect(screen.getByText(/paste a block straight out of Excel/i)).toBeTruthy();
        expect(screen.getAllByRole('button', { name: /add a row/i }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole('button', { name: /paste from a spreadsheet/i }).length).toBeGreaterThan(0);
    });

    it('edits a cell in place and sends only the column that changed', async () => {
        renderRows();
        fireEvent.click(await screen.findByRole('button', { name: /^Client — click to change$/ }));

        const input = screen.getByLabelText('Client');
        fireEvent.change(input, { target: { value: 'Anna de Vries' } });
        fireEvent.blur(input);

        await waitFor(() => expect(updateRecord).toHaveBeenCalledWith('app1', 'tbl_a', 'rec_1', { client: 'Anna de Vries' }, { expectedUpdatedAt: ROW.updated_at }));
        expect(await screen.findByRole('button', { name: /^Client — click to change$/ })).toHaveTextContent('Anna de Vries');
    });

    it('edits a choice as a dropdown and a yes/no as a checkbox, not as text boxes', async () => {
        renderRows();
        // The yes/no is always a checkbox — no click-to-edit step.
        const check = await screen.findByLabelText('Sent');
        expect(check.type).toBe('checkbox');
        fireEvent.click(check);
        await waitFor(() => expect(updateRecord).toHaveBeenCalledWith('app1', 'tbl_a', 'rec_1', { sent: true }, { expectedUpdatedAt: ROW.updated_at }));

        fireEvent.click(screen.getByRole('button', { name: /^Status — click to change$/ }));
        const choice = screen.getByLabelText('Status');
        expect(choice.tagName).toBe('SELECT');
        expect([...choice.options].map((o) => o.textContent)).toEqual(['—', 'Open', 'Paid']);
        fireEvent.change(choice, { target: { value: 'Paid' } });
        await waitFor(() => expect(updateRecord).toHaveBeenCalledWith('app1', 'tbl_a', 'rec_1', { status: 'Paid' }, { expectedUpdatedAt: ROW.updated_at }));
    });

    it('adds a typed row, and keeps it on screen with the server’s own reason when it is refused', async () => {
        const err = new Error('Client is required');
        err.status = 422;
        createRecord.mockRejectedValueOnce(err);
        renderRows();

        fireEvent.click((await screen.findAllByRole('button', { name: /add a row/i }))[0]);
        fireEvent.change(screen.getAllByLabelText('Amount').at(-1), { target: { value: '75' } });
        fireEvent.click(screen.getByRole('button', { name: /^Add$/ }));

        expect(await screen.findByText('Client is required')).toBeTruthy();
        // The half-typed row survives the refusal.
        expect(screen.getAllByLabelText('Amount').at(-1).value).toBe('75');

        fireEvent.change(screen.getAllByLabelText('Client').at(-1), { target: { value: 'Bram' } });
        fireEvent.click(screen.getByRole('button', { name: /^Add$/ }));
        await waitFor(() => expect(createRecord).toHaveBeenCalledWith('app1', 'tbl_a', { amount: 75, client: 'Bram' }));
        expect(await screen.findAllByRole('button', { name: /^Client — click to change$/ })).toHaveLength(2);
    });

    it('shows the winning version when someone else changed the row first', async () => {
        // Without the CAS token these two edits silently overwrote each other.
        const err = new Error('This record was changed by someone else — reload and try again.');
        err.status = 409;
        err.code = 'record_conflict';
        err.body = { record: { ...ROW, client: 'Their edit', updated_at: '2026-08-07T09:05:00.000Z' } };
        updateRecord.mockRejectedValueOnce(err);
        renderRows();

        fireEvent.click(await screen.findByRole('button', { name: /^Client — click to change$/ }));
        fireEvent.change(screen.getByLabelText('Client'), { target: { value: 'My edit' } });
        fireEvent.blur(screen.getByLabelText('Client'));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Someone else changed this row/)));
        // The row on screen is THEIRS, not the edit that lost.
        expect(await screen.findByText('Their edit')).toBeTruthy();
        expect(screen.queryByText('My edit')).toBeNull();
    });

    it('deletes a row once it is confirmed', async () => {
        renderRows();
        fireEvent.click(await screen.findByRole('button', { name: 'Delete row 1' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Delete row' }));

        await waitFor(() => expect(deleteRecord).toHaveBeenCalledWith('app1', 'tbl_a', 'rec_1'));
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Delete row 1' })).toBeNull());
    });

    it('says what went wrong when the rows cannot be loaded at all', async () => {
        listRecords.mockRejectedValue(new Error('Too many requests — limit is 60 per 60s.'));
        renderRows();
        expect(await screen.findByText(/Too many requests/)).toBeTruthy();
        expect(toast.error).not.toHaveBeenCalled();
    });
});
