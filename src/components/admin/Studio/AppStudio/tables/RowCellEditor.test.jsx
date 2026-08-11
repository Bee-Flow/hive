import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import RowCellEditor from './RowCellEditor';

/**
 * The cell editor is where a column's declared type has to survive contact with
 * typing. These tests pin the three behaviours that make it safe to edit a live
 * row: a date offers a date picker, ticking a second choice does not end the
 * edit after the first, and Escape leaves the value alone.
 */

function renderCell(field, value, props = {}) {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const utils = render(
        <RowCellEditor field={field} value={value} onCommit={onCommit} onCancel={onCancel} {...props} />,
    );
    return { onCommit, onCancel, ...utils };
}

describe('RowCellEditor', () => {
    it('offers a date picker for a date column, seeded with the stored day', () => {
        renderCell({ key: 'due', name: 'Due date', type: 'date' }, '2026-03-14T00:00:00');
        const input = screen.getByLabelText('Due date');
        expect(input.type).toBe('date');
        expect(input.value).toBe('2026-03-14');
    });

    it('commits a typed number as a number on blur, and not at all on Escape', () => {
        const { onCommit, onCancel } = renderCell({ key: 'amount', name: 'Amount', type: 'number' }, 12);
        const input = screen.getByLabelText('Amount');

        fireEvent.change(input, { target: { value: '18.5' } });
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(onCancel).toHaveBeenCalled();
        expect(onCommit).not.toHaveBeenCalled();

        fireEvent.blur(input);
        expect(onCommit).toHaveBeenCalledWith(18.5);
    });

    it('lets a multi-select collect several choices before it hands them over', () => {
        const field = { key: 'tags', name: 'Tags', type: 'multiselect', options: ['Open', 'Urgent', 'Late'] };
        const { onCommit } = renderCell(field, '["Open"]');

        fireEvent.click(screen.getByRole('checkbox', { name: 'Urgent' }));
        expect(onCommit).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(onCommit).toHaveBeenCalledWith(['Open', 'Urgent']);
    });

    it('keeps a choice the column no longer offers instead of blanking it', () => {
        const field = { key: 'status', name: 'Status', type: 'select', options: ['Open'] };
        renderCell(field, 'Retired');
        expect([...screen.getByLabelText('Status').options].map((o) => o.value)).toEqual(['', 'Open', 'Retired']);
        expect(screen.getByLabelText('Status').value).toBe('Retired');
    });
});
