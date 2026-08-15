import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ConditionBuilder from './ConditionBuilder';
import { VariablePickerProvider } from './VariablePickerContext';

function renderBuilder(props = {}, { previewSample = null } = {}) {
    const onChange = vi.fn();
    const utils = render(
        <VariablePickerProvider groups={[]} previewSample={previewSample} stepLabelById={new Map()}>
            <ConditionBuilder value="" onChange={onChange} context="condition" previewSample={previewSample} {...props} />
        </VariablePickerProvider>,
    );
    return { onChange, ...utils };
}

describe('ConditionBuilder — typed ValueSlot', () => {
    beforeEach(() => cleanup());

    const previewSample = { steps: { s1: { output: { amount: 5 } } } };

    it('renders a number input for a numeric-typed field and a matching operator label', () => {
        renderBuilder({ value: 'steps.s1.output.amount > 1000' }, { previewSample });
        const numberInputs = document.querySelectorAll('input[type="number"]');
        expect(numberInputs.length).toBe(1);
        expect(numberInputs[0].value).toBe('1000');
        expect(screen.getByText('greater than')).toBeTruthy();
    });

    it('editing the number input re-serialises the expression', () => {
        const { onChange } = renderBuilder({ value: 'steps.s1.output.amount > 1000' }, { previewSample });
        const numberInput = document.querySelector('input[type="number"]');
        fireEvent.change(numberInput, { target: { value: '2000' } });
        expect(onChange).toHaveBeenCalledWith('steps.s1.output.amount > 2000');
    });

    it('unary operator (is empty) hides the value slot', () => {
        renderBuilder({ value: 'isEmpty(steps.s1.output.amount)' }, { previewSample });
        expect(screen.getByText('no value needed')).toBeTruthy();
    });

    it('"Use a variable instead" swaps the typed slot back to a free BindingField', () => {
        renderBuilder({ value: 'steps.s1.output.amount > 1000' }, { previewSample });
        expect(document.querySelector('input[type="number"]')).toBeTruthy();
        fireEvent.click(screen.getByLabelText('Use a variable instead'));
        expect(document.querySelector('input[type="number"]')).toBeNull();
        expect(screen.getByPlaceholderText('value')).toBeTruthy();
    });
});

describe('ConditionBuilder — trivial values open visual, not raw', () => {
    beforeEach(() => cleanup());

    it('a bare `true` (a fresh Filter/If step\'s default) opens visual mode with an empty row', () => {
        renderBuilder({ value: 'true' });
        // Visual mode affordances present; NOT the raw textarea.
        expect(screen.getByText('Add condition')).toBeTruthy();
        expect(screen.getByText('Write raw expression')).toBeTruthy();
        expect(screen.queryByText(/What can I write here\?/)).toBeNull();
    });

    it('a bare `false` also opens visual mode with an empty row', () => {
        renderBuilder({ value: 'false' });
        expect(screen.getByText('Add condition')).toBeTruthy();
    });

    it('a bare path with no operator (e.g. an AI-authored default) opens visual mode with "has a value" selected', () => {
        renderBuilder({ value: 'steps.a_af2f5b.output.results[*].to' });
        expect(screen.getByText('Add condition')).toBeTruthy();
        expect(screen.getByText('has a value')).toBeTruthy();
        expect(screen.getByText('no value needed')).toBeTruthy();
    });

    it('the [*] wildcard warning is suppressed for a "has a value" row', () => {
        renderBuilder({ value: 'steps.a_af2f5b.output.results[*].to' });
        expect(screen.queryByText(/Add a Filter step to work through items/)).toBeNull();
        expect(screen.queryByText(/current element is bound as `item`/)).toBeNull();
    });

    it('an external re-sync to a trivial value also opens visual, not raw', () => {
        const onChange = vi.fn();
        const { rerender } = render(
            <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={new Map()}>
                <ConditionBuilder value="foo(bar) &&& x" onChange={onChange} context="condition" />
            </VariablePickerProvider>,
        );
        expect(screen.getByRole('textbox').value).toBe('foo(bar) &&& x'); // starts raw (unparseable)
        rerender(
            <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={new Map()}>
                <ConditionBuilder value="true" onChange={onChange} context="condition" />
            </VariablePickerProvider>,
        );
        expect(screen.getByText('Add condition')).toBeTruthy();
    });
});

describe('ConditionBuilder — raw mode', () => {
    beforeEach(() => cleanup());

    it('an unparseable saved expr stays in raw mode with the exact text', () => {
        renderBuilder({ value: 'foo(bar) &&& x' });
        const textarea = screen.getByRole('textbox');
        expect(textarea.value).toBe('foo(bar) &&& x');
    });

    it('the help disclosure reveals the whitelisted functions', () => {
        renderBuilder({ value: 'foo(bar) &&& x' });
        fireEvent.click(screen.getByText(/What can I write here\?/));
        expect(screen.getByText('contains(text, part)')).toBeTruthy();
        expect(screen.getByText('isEmpty(value)')).toBeTruthy();
    });
});
