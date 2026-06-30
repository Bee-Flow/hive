import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import BindingField from './BindingField';
import { VariablePickerProvider } from './VariablePickerContext';

const labels = new Map([['s1', 'Search web']]);

function renderField(props = {}) {
    const onChange = vi.fn();
    const utils = render(
        <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={labels}>
            <BindingField label="Sources" value={{ kind: 'ref', path: 'steps.s1.output.sources' }} onChange={onChange} {...props} />
        </VariablePickerProvider>,
    );
    return { onChange, ...utils };
}

describe('BindingField — name chips', () => {
    beforeEach(() => cleanup());

    it('shows the step name as a chip while blurred', () => {
        renderField();
        expect(screen.getByText('Search web')).toBeTruthy();
    });

    it('reveals the raw expression in the input on focus', () => {
        renderField();
        const input = screen.getByRole('textbox');
        fireEvent.focus(input);
        expect(input.value).toBe('steps.s1.output.sources');
    });

    it('still emits a ref binding when the raw text is edited', () => {
        const { onChange } = renderField();
        const input = screen.getByRole('textbox');
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: 'steps.s1.output.newsDigest' } });
        expect(onChange).toHaveBeenCalledWith({ kind: 'ref', path: 'steps.s1.output.newsDigest' });
    });

    it('updates the chip when the value prop changes without focus (AI patch / undo)', () => {
        const { rerender } = renderField();
        expect(screen.getByText('Search web')).toBeTruthy();
        act(() => {
            rerender(
                <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={labels}>
                    <BindingField label="Sources" value={{ kind: 'ref', path: 'trigger.output.keyTopics' }} onChange={() => {}} />
                </VariablePickerProvider>,
            );
        });
        expect(screen.getByText('Trigger')).toBeTruthy();
    });
});

describe('BindingField — expression behind Advanced', () => {
    beforeEach(() => cleanup());

    function renderLiteral() {
        return render(
            <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={labels}>
                <BindingField label="Amount" value={{ kind: 'literal', value: 'hello' }} onChange={vi.fn()} />
            </VariablePickerProvider>,
        );
    }

    it('hides the expression toggle until Advanced; keeps the insert button', () => {
        renderLiteral();
        expect(screen.getByLabelText('Insert variable')).toBeTruthy();
        expect(screen.queryByLabelText('Switch to expression')).toBeNull();
        fireEvent.click(screen.getByLabelText('Advanced options'));
        expect(screen.getByLabelText('Switch to expression')).toBeTruthy();
    });
});
