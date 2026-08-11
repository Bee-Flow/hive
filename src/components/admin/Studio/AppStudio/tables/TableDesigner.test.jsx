import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import TableDesigner from './TableDesigner';

/**
 * TableDesigner is a controlled editor over ONE model table. These tests pin
 * the two things that cost data: a saved field's column name may not drift
 * when its label is edited, and a choice field must be able to carry the
 * choices the server demands (dataModel.js: select/multiselect need options[]).
 */

const SAVED_FIELD = { id: 'fld_aaa111', key: 'amount', name: 'Amount', type: 'number' };

function renderDesigner({ fields = [SAVED_FIELD], savedTable = { id: 'tbl_a', fields: [SAVED_FIELD] } } = {}) {
    const onChange = vi.fn();
    const table = { id: 'tbl_a', key: 'invoices', name: 'Invoices', fields };
    const utils = render(
        <TableDesigner table={table} tables={[table]} savedTable={savedTable} onChange={onChange} />,
    );
    const last = () => onChange.mock.calls.at(-1)?.[0];
    // Field rows render collapsed — open the first one's editor.
    fireEvent.click(utils.getAllByRole('button', { expanded: false })[0]);
    return { onChange, last, ...utils };
}

describe('TableDesigner', () => {
    it('renaming a SAVED field only changes its label, never its column name', () => {
        const { last, getByPlaceholderText, queryByPlaceholderText, getByText } = renderDesigner();

        // The column name is shown, not editable, until it is explicitly unlocked.
        expect(queryByPlaceholderText('amount')).toBeNull();
        expect(getByText('amount')).toBeTruthy();

        fireEvent.change(getByPlaceholderText('Amount'), { target: { value: 'Total amount' } });
        expect(last().fields[0].name).toBe('Total amount');
        expect(last().fields[0].key).toBe('amount');
    });

    it('still allows a deliberate rename, behind a warning', () => {
        const { last, getByRole, getByPlaceholderText, getByText } = renderDesigner();
        fireEvent.click(getByRole('button', { name: /change/i }));
        expect(getByText(/stops every form, list and chart/i)).toBeTruthy();

        fireEvent.change(getByPlaceholderText('amount'), { target: { value: 'Total amount' } });
        expect(last().fields[0].key).toBe('total_amount');
    });

    it('still derives the column name from the label for a NEW field', () => {
        const draft = { id: 'fld_bbb222', key: '', name: '', type: 'text' };
        const { last, getByPlaceholderText } = renderDesigner({ fields: [draft], savedTable: null });
        fireEvent.change(getByPlaceholderText('Amount'), { target: { value: 'Invoice date' } });
        expect(last().fields[0].key).toBe('invoice_date');
    });

    it('lets a choice field carry its choices (the shape the server requires)', () => {
        const draft = { id: 'fld_ccc333', key: 'status', name: 'Status', type: 'text' };
        const first = renderDesigner({ fields: [draft], savedTable: null });

        fireEvent.change(first.getByLabelText('Field type'), { target: { value: 'select' } });
        const seeded = first.last().fields[0];
        expect(seeded.type).toBe('select');
        expect(seeded.options).toEqual(['', '', '']);
        first.unmount();

        const second = renderDesigner({ fields: [seeded], savedTable: null });
        const boxes = second.getAllByLabelText(/^Choice \d+$/);
        expect(boxes).toHaveLength(3);
        fireEvent.change(boxes[0], { target: { value: 'Open' } });
        expect(second.last().fields[0].options).toEqual(['Open', '', '']);
    });
});
