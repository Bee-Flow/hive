import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import FilterRowsEditor from './FilterRowsEditor';

/**
 * The four defects the filter row carried, each pinned by the case that
 * exposes it. All of them share a cause: state the editor remembered ON THE
 * SIDE, keyed by position, instead of reading what the saved row actually says.
 */

const FIELDS = [
    { key: 'title', name: 'Title', type: 'text' },
    { key: 'done', name: 'Done', type: 'bool' },
    { key: 'due', name: 'Due', type: 'date' },
    { key: 'amount', name: 'Amount', type: 'number' },
    { key: 'status', name: 'Status', type: 'select', options: ['open', 'closed'] },
];

/** Controlled, like both real call sites — rows must survive a re-render. */
function Harness({ initial, onChange, ...props }) {
    const [filters, setFilters] = useState(initial);
    return (
        <FilterRowsEditor
            fields={FIELDS}
            filters={filters}
            onChange={(next) => { setFilters(next); onChange?.(next); }}
            {...props}
        />
    );
}

function renderRows(initial, props = {}) {
    const onChange = vi.fn();
    const utils = render(<Harness initial={initial} onChange={onChange} {...props} />);
    return { onChange, last: () => onChange.mock.calls.at(-1)?.[0], ...utils };
}

const escapeButtons = () => screen.queryAllByRole('button', { name: /type any value/i });
const restoreButtons = () => screen.queryAllByRole('button', { name: /back to the simple picker/i });

describe('FilterRowsEditor — the free-text escape follows the ROW, not its index', () => {
    it('deleting an earlier row leaves the escaped row escaped', () => {
        renderRows([
            { field: 'done', op: 'eq', value: true },
            { field: 'status', op: 'eq', value: 'open' },
        ]);

        // Escape row 1 (the select), leaving row 0 on its typed control.
        fireEvent.click(escapeButtons()[1]);
        expect(restoreButtons()).toHaveLength(1);

        // Remove row 0. Under index-keyed state the marker followed the
        // POSITION, so the surviving row snapped back to its picker.
        fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[0]);

        expect(restoreButtons()).toHaveLength(1);
        expect(screen.queryByRole('combobox', { name: 'Filter value' })).toBeNull();
    });

    it('reordering keeps the escape on the row that was escaped', () => {
        renderRows([
            { field: 'done', op: 'eq', value: true },
            { field: 'status', op: 'eq', value: 'open' },
        ]);
        fireEvent.click(escapeButtons()[1]);

        fireEvent.click(screen.getByRole('button', { name: 'Move item 2 up' }));

        // Still exactly one escaped row, and it is the select that moved — not
        // whichever row now happens to sit at index 1.
        expect(restoreButtons()).toHaveLength(1);
        const controls = screen.getAllByLabelText('Filter value');
        expect(controls[0].tagName).toBe('INPUT');       // the moved select, in free text
        expect(controls[0].value).toBe('open');
        expect(controls[1].getAttribute('role')).toBe('radiogroup'); // the bool, untouched
    });

    it('editing an escaped row keeps it escaped', () => {
        renderRows([{ field: 'title', op: 'eq', value: '' }, { field: 'done', op: 'eq', value: true }]);
        fireEvent.click(escapeButtons()[0]);
        const box = screen.getAllByLabelText('Filter value')[1];
        fireEvent.change(box, { target: { value: 'maybe' } });
        expect(restoreButtons()).toHaveLength(1);
    });
});

describe('FilterRowsEditor — a saved value the picker cannot show stays visible', () => {
    // The data-loss case: the escape did not survive a reload, so this row
    // rendered as an empty yes/no control with 'maybe' nowhere on screen, and
    // the first click wrote over it.
    it('drops to free text for a bool column holding a non-boolean', () => {
        const { onChange } = renderRows([{ field: 'done', op: 'eq', value: 'maybe' }]);
        const box = screen.getByLabelText('Filter value');
        expect(box.tagName).toBe('INPUT');
        expect(box.value).toBe('maybe');
        // And nothing was silently rewritten on the way in.
        expect(onChange).not.toHaveBeenCalled();
    });

    it('drops to free text for a choice no longer among the options', () => {
        renderRows([{ field: 'status', op: 'eq', value: 'archived' }]);
        expect(screen.getByLabelText('Filter value').value).toBe('archived');
        expect(screen.queryByRole('combobox', { name: 'Filter value' })).toBeNull();
    });

    it('drops to free text for a date that is not ISO', () => {
        renderRows([{ field: 'due', op: 'eq', value: '31-12-2026' }]);
        const box = screen.getByLabelText('Filter value');
        expect(box.type).toBe('text');
        expect(box.value).toBe('31-12-2026');
    });

    it('keeps the typed control when the saved value IS representable', () => {
        renderRows([{ field: 'done', op: 'eq', value: true }]);
        expect(screen.getByRole('radio', { name: 'Yes' })).toBeTruthy();
    });

    it('going back to the picker keeps a value the picker can show', () => {
        const { last } = renderRows([{ field: 'status', op: 'eq', value: 'open' }]);
        fireEvent.click(escapeButtons()[0]);
        fireEvent.click(restoreButtons()[0]);
        // 'open' is a real choice, so it must not have been wiped.
        expect(last()?.[0]?.value ?? 'open').toBe('open');
        expect(screen.getByRole('combobox', { name: 'Filter value' }).value).toBe('open');
    });
});

describe('FilterRowsEditor — the operator follows the column', () => {
    it('resets an op the new column cannot carry', () => {
        const { last } = renderRows([{ field: 'title', op: 'contains', value: 'x' }]);
        fireEvent.change(screen.getByLabelText('Filter field'), { target: { value: 'done' } });
        // `contains` on a yes/no column used to survive and force a text box.
        expect(last()[0].op).toBe('eq');
    });

    it('keeps an op the new column can carry', () => {
        const { last } = renderRows([{ field: 'title', op: 'eq', value: 'x' }]);
        fireEvent.change(screen.getByLabelText('Filter field'), { target: { value: 'status' } });
        expect(last()[0].op).toBe('eq');
    });

    it('offers only the ops a column supports, but always re-offers the saved one', () => {
        renderRows([{ field: 'done', op: 'startsWith', value: '' }]);
        const ops = screen.getByLabelText('Filter operator');
        const labels = [...ops.options].map((o) => o.value);
        expect(labels).toContain('startsWith');   // saved → still round-trips
        expect(labels).not.toContain('gt');       // never suggested for a bool
    });
});

describe('FilterRowsEditor — the ops the server implements are all reachable', () => {
    it('“is one of” collects a list', () => {
        const { last } = renderRows([{ field: 'status', op: 'in', value: [] }]);
        fireEvent.change(screen.getByLabelText('Filter values'), { target: { value: 'open, closed' } });
        expect(last()[0].value).toEqual(['open', 'closed']);
    });

    it('“is between” collects a [min, max] pair', () => {
        const { last } = renderRows([{ field: 'amount', op: 'between', value: ['', ''] }]);
        fireEvent.change(screen.getByLabelText('Filter value from'), { target: { value: '10' } });
        fireEvent.change(screen.getByLabelText('Filter value to'), { target: { value: '20' } });
        expect(last()[0].value).toEqual(['10', '20']);
    });

    it('switching to a list op discards a scalar value rather than sending it', () => {
        const { last } = renderRows([{ field: 'amount', op: 'eq', value: '5' }]);
        fireEvent.change(screen.getByLabelText('Filter operator'), { target: { value: 'between' } });
        expect(last()[0].value).toEqual(['', '']);
    });
});

describe('FilterRowsEditor — required', () => {
    // The server has honoured `required` all along and no editor wrote it, so
    // the only reachable behaviour was fail-open: an unresolved scoping filter
    // is dropped and the component lists the whole table.
    it('is offered where a value can fail to resolve, and writes the flag', () => {
        const { last } = renderRows([{ field: 'title', op: 'eq', value: '' }], { allowFormula: true });
        fireEvent.click(screen.getByLabelText('Filter 1 required'));
        expect(last()[0].required).toBe(true);
    });

    it('omits the key entirely when switched back off', () => {
        const { last } = renderRows([{ field: 'title', op: 'eq', value: '', required: true }], { allowFormula: true });
        fireEvent.click(screen.getByLabelText('Filter 1 required'));
        expect(last()[0]).not.toHaveProperty('required');
    });

    it('is not offered for a literal-only filter list', () => {
        renderRows([{ field: 'title', op: 'eq', value: '' }]);
        expect(screen.queryByLabelText('Filter 1 required')).toBeNull();
    });
});

describe('FilterRowsEditor — the formula row is a real expression editor', () => {
    it('validates and previews instead of accepting anything', () => {
        const { container } = renderRows(
            [{ field: 'title', op: 'eq', value: { kind: 'formula', expr: 'currentUser.' } }],
            { allowFormula: true },
        );
        expect(screen.getByLabelText('Filter formula')).toBeTruthy();
        expect(container.querySelector('[data-formula-error]')).toBeTruthy();
    });

    it('still emits the { kind:"formula", expr } shape', () => {
        const { last } = renderRows(
            [{ field: 'title', op: 'eq', value: { kind: 'formula', expr: '' } }],
            { allowFormula: true },
        );
        fireEvent.change(screen.getByLabelText('Filter formula'), { target: { value: 'currentUser.id' } });
        expect(last()[0].value).toEqual({ kind: 'formula', expr: 'currentUser.id' });
    });
});

describe('FilterRowsEditor — Literal ↔ Formula carries the value across', () => {
    // Switching modes used to write '' over whatever was in the box, so one
    // click on the wrong icon lost a hand-written expression and the only way
    // back was the editor-wide undo — nowhere near these two buttons.
    const useFormula = () => screen.getByRole('button', { name: /use a formula/i });
    const useFixed = () => screen.getByRole('button', { name: /use a fixed value/i });

    it('writes a literal as the expression that yields it', () => {
        const { last } = renderRows([{ field: 'title', op: 'eq', value: 'open' }], { allowFormula: true });
        fireEvent.click(useFormula());
        expect(last()[0].value).toEqual({ kind: 'formula', expr: '"open"' });
    });

    it('reads a simple expression back as the literal', () => {
        const { last } = renderRows(
            [{ field: 'amount', op: 'eq', value: { kind: 'formula', expr: '42' } }],
            { allowFormula: true },
        );
        fireEvent.click(useFixed());
        expect(last()[0].value).toBe('42');
    });

    it('hands back the expression it was given when you switch and switch again', () => {
        const { last } = renderRows(
            [{ field: 'title', op: 'eq', value: { kind: 'formula', expr: 'currentUser.id' } }],
            { allowFormula: true },
        );
        fireEvent.click(useFixed());
        expect(last()[0].value).toBe('');          // not expressible as a literal
        fireEvent.click(useFormula());
        expect(last()[0].value).toEqual({ kind: 'formula', expr: 'currentUser.id' });
    });

    it('remembers a list value that no expression could carry', () => {
        const { last } = renderRows(
            [{ field: 'status', op: 'in', value: ['open', 'closed'] }],
            { allowFormula: true },
        );
        fireEvent.click(useFormula());
        expect(last()[0].value).toEqual({ kind: 'formula', expr: '' });
        fireEvent.click(useFixed());
        expect(last()[0].value).toEqual(['open', 'closed']);
    });
});
