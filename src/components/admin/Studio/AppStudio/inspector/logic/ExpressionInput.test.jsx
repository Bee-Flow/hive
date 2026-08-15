import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ExpressionInput from './ExpressionInput';
import { VariablePickerProvider } from '../../../../AITasksDesigner/Builder/mapping/VariablePickerContext';

/**
 * The inline variant is the whole point of the extraction: a filter row has no
 * vertical space, so it used to get a bare <input> with no picker, no parse
 * check and no preview — the exact field in which `vars.statusfilter` (for
 * `vars.filters.status`) silently resolved to undefined and the filter was
 * dropped. These tests pin that the same information survives in one line.
 */

const SAMPLE = {
    form: { quantity: 5 },
    currentUser: { name: 'Zoe', email: 'zoe@example.com' },
    vars: { filters: { q: 'acme' } },
};

const GROUPS = [
    {
        id: 'currentUser',
        label: 'Current user',
        kind: 'trigger',
        basePath: 'currentUser',
        fields: [
            { key: 'name', path: 'currentUser.name', sample: 'Zoe' },
            { key: 'email', path: 'currentUser.email', sample: 'zoe@example.com' },
        ],
    },
];

function renderInput(props = {}) {
    return render(
        <VariablePickerProvider groups={GROUPS} previewSample={SAMPLE}>
            <ExpressionInput onChange={() => {}} previewSample={SAMPLE} {...props} />
        </VariablePickerProvider>,
    );
}

describe('ExpressionInput — inline variant', () => {
    it('is one line: an input, never a textarea', () => {
        const { container } = renderInput({ variant: 'inline', value: 'form.quantity' });
        expect(container.querySelectorAll('textarea')).toHaveLength(0);
        expect(container.querySelector('input[type="text"]')).toBeTruthy();
    });

    it('marks a parse error on the control itself and keeps the message reachable', () => {
        const { container } = renderInput({ variant: 'inline', value: 'form.quantity ==' });
        const field = container.querySelector('input[type="text"]');
        expect(field.getAttribute('aria-invalid')).toBe('true');

        const err = container.querySelector('[data-formula-error]');
        expect(err).toBeTruthy();
        // The message cannot be a visible line here, so it must survive as the
        // tooltip AND for screen readers.
        expect(err.getAttribute('title').length).toBeGreaterThan(0);
        expect(err.textContent.length).toBeGreaterThan(0);
        expect(container.querySelector('[data-formula-preview]')).toBeNull();
    });

    it('shows the resolved value inside the field when the expression is valid', () => {
        const { container } = renderInput({ variant: 'inline', value: 'form.quantity * 2' });
        const preview = container.querySelector('[data-formula-preview]');
        expect(preview).toBeTruthy();
        expect(preview.textContent).toContain('10');
        expect(container.querySelector('input[type="text"]').getAttribute('aria-invalid')).toBeNull();
    });

    it('never offers the condition builder, even when a boolean is expected', () => {
        renderInput({
            variant: 'inline',
            value: 'form.quantity > 0',
            expectsBoolean: true,
            definition: { screens: [] },
            node: { id: 'cmp_a', type: 'text' },
        });
        expect(screen.queryByText('Use the condition builder')).toBeNull();
    });

    it('emits the raw string on edit', () => {
        const onChange = vi.fn();
        renderInput({ variant: 'inline', value: '', onChange, ariaLabel: 'Filter formula' });
        fireEvent.change(screen.getByLabelText('Filter formula'), { target: { value: 'currentUser.name' } });
        expect(onChange).toHaveBeenCalledWith('currentUser.name');
    });
});

describe('ExpressionInput — the condition builder is offered only where a boolean fits', () => {
    const withNode = {
        definition: { screens: [{ id: 'scr_a', name: 'S', sections: [{ id: 'sec_a', children: [{ id: 'cmp_a', type: 'text' }] }] }] },
        node: { id: 'cmp_a', type: 'text' },
    };

    /**
     * The clickable builder is what OPENS where a boolean is wanted. It used to
     * be the other way round — a monospace textarea first, the builder behind a
     * link underneath — so the first thing somebody met when asked "when should
     * this show?" was an empty code box.
     */
    it('opens on the condition builder when a boolean is wanted', () => {
        renderInput({ value: 'form.quantity > 0', expectsBoolean: true, ...withNode });
        expect(screen.getByText('Write a formula')).toBeTruthy();
        expect(screen.queryByText('Use the condition builder')).toBeNull();
    });

    it('opens on the builder for an unset boolean field too', () => {
        renderInput({ value: '', expectsBoolean: true, ...withNode });
        expect(screen.getByText('Write a formula')).toBeTruthy();
    });

    it('leaves an expression the builder cannot hold in the formula box', () => {
        // Mixed AND/OR is not a flat list of rows joined one way, so the row
        // model refuses it. Opening the builder on it would only strand the
        // author in the builder's OWN raw textarea, a click further from the
        // picker and the live preview this one has.
        renderInput({
            value: "form.a == 1 && form.b == 2 || form.c == 3",
            expectsBoolean: true,
            ...withNode,
        });
        expect(screen.getByText('Use the condition builder')).toBeTruthy();
    });

    // Regression: it used to appear wherever a definition and a node were
    // passed, which included computed props and chart data — clicking it there
    // rewrote a working value expression into a comparison.
    it('does not offer it for a value expression', () => {
        renderInput({ value: "item.status == 'done' ? 'Done' : 'Open'", ...withNode });
        expect(screen.queryByText('Use the condition builder')).toBeNull();
    });
});

describe('ExpressionInput — variable picker', () => {
    it('the {} button opens the picker and a pick inserts at the caret', () => {
        const onChange = vi.fn();
        renderInput({ value: '', onChange });

        fireEvent.click(screen.getByLabelText('Insert a variable'));
        fireEvent.click(document.querySelector('[title="currentUser.email"]'));

        expect(onChange).toHaveBeenCalledWith('currentUser.email');
    });

    it('a dropped binding path lands in the field', () => {
        const onChange = vi.fn();
        renderInput({ value: '', onChange, ariaLabel: 'Formula' });

        const data = { 'application/x-binding-path': 'currentUser.name' };
        fireEvent.drop(screen.getByLabelText('Formula'), {
            dataTransfer: { getData: (t) => data[t] || '', types: Object.keys(data) },
        });

        expect(onChange).toHaveBeenCalledWith('currentUser.name');
    });

    it('can be suppressed where there is no scope to pick from', () => {
        renderInput({ value: '', showPicker: false });
        expect(screen.queryByLabelText('Insert a variable')).toBeNull();
    });
});
