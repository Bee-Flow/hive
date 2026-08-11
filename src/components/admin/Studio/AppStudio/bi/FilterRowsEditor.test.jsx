import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import FilterRowsEditor from './FilterRowsEditor';

/**
 * The filter row is a controlled { field, op, value } shape. These tests pin
 * the VALUE control to the chosen field's type — a yes/no field can only be
 * matched with a real boolean, and a choice field must offer its choices —
 * plus the free-text escape that keeps every value reachable.
 */

const FIELDS = [
    { key: 'title', name: 'Title', type: 'text' },
    { key: 'done', name: 'Done', type: 'bool' },
    { key: 'due', name: 'Due', type: 'date' },
    { key: 'amount', name: 'Amount', type: 'number' },
    { key: 'status', name: 'Status', type: 'select', options: ['Open', { value: 'closed', label: 'Closed' }] },
];

function renderEditor(filters) {
    const onChange = vi.fn();
    const utils = render(<FilterRowsEditor fields={FIELDS} filters={filters} onChange={onChange} />);
    const last = () => onChange.mock.calls.at(-1)?.[0];
    return { onChange, last, ...utils };
}

describe('FilterRowsEditor value control', () => {
    it('matches a yes/no field with a real boolean', () => {
        const first = renderEditor([{ field: 'done', op: 'eq', value: '' }]);
        fireEvent.click(first.getByRole('radio', { name: 'Yes' }));
        expect(first.last()[0]).toEqual({ field: 'done', op: 'eq', value: true });
        first.unmount();

        const second = renderEditor([{ field: 'done', op: 'eq', value: true }]);
        fireEvent.click(second.getByRole('radio', { name: 'No' }));
        expect(second.last()[0].value).toBe(false);
    });

    it('offers a date picker for a date field and a decimal-friendly box for a number', () => {
        const dated = renderEditor([{ field: 'due', op: 'eq', value: '' }]);
        expect(dated.getByLabelText('Filter value').type).toBe('date');
        dated.unmount();

        const numeric = renderEditor([{ field: 'amount', op: 'gt', value: '' }]);
        const box = numeric.getByLabelText('Filter value');
        // type="number" would reject the Dutch decimal comma outright.
        expect(box.type).toBe('text');
        expect(box.inputMode).toBe('decimal');
    });

    it("lists a choice field's own choices", () => {
        const { last, getByRole, getAllByRole } = renderEditor([{ field: 'status', op: 'eq', value: '' }]);
        const select = getByRole('combobox', { name: 'Filter value' });
        expect(getAllByRole('option').map((o) => o.textContent)).toEqual(
            expect.arrayContaining(['Open', 'Closed']),
        );
        fireEvent.change(select, { target: { value: 'closed' } });
        expect(last()[0].value).toBe('closed');
    });

    it('keeps a free-text escape for anything the picker cannot express', () => {
        const { getByLabelText, getByRole } = renderEditor([{ field: 'done', op: 'eq', value: true }]);
        fireEvent.click(getByRole('button', { name: /type any value/i }));
        expect(getByLabelText('Filter value').tagName).toBe('INPUT');
        expect(getByRole('button', { name: /back to the simple picker/i })).toBeTruthy();
    });

    it('falls back to free text for a plain text field', () => {
        const { last, getByLabelText } = renderEditor([{ field: 'title', op: 'contains', value: '' }]);
        fireEvent.change(getByLabelText('Filter value'), { target: { value: 'invoice' } });
        expect(last()[0]).toEqual({ field: 'title', op: 'contains', value: 'invoice' });
    });
});
