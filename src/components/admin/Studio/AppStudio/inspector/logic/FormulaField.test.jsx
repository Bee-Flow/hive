import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FormulaField from './FormulaField';

const SAMPLE = { form: { quantity: 5 }, currentUser: { name: 'Zoe' } };

describe('FormulaField — live eval', () => {
    it('shows the resolved result for a valid expression', () => {
        const { container, getByText } = render(
            <FormulaField value="form.quantity * 2" onChange={() => {}} previewSample={SAMPLE} />,
        );
        expect(container.querySelector('[data-formula-preview]')).toBeTruthy();
        expect(getByText('10')).toBeTruthy();
    });

    it('shows an inline error for a broken expression (never crashes)', () => {
        const { container } = render(
            <FormulaField value="form.quantity ==" onChange={() => {}} previewSample={SAMPLE} />,
        );
        const err = container.querySelector('[data-formula-error]');
        expect(err).toBeTruthy();
        expect(err.textContent.length).toBeGreaterThan(0);
        expect(container.querySelector('[data-formula-preview]')).toBeNull();
    });

    it('emits the raw expression string on edit', () => {
        const onChange = vi.fn();
        const { getByPlaceholderText } = render(
            <FormulaField value="" onChange={onChange} previewSample={SAMPLE} placeholder="expr" />,
        );
        fireEvent.change(getByPlaceholderText('expr'), { target: { value: 'currentUser.name' } });
        expect(onChange).toHaveBeenCalledWith('currentUser.name');
    });

    it('renders nothing extra for an empty value (no preview, no error)', () => {
        const { container } = render(<FormulaField value="" onChange={() => {}} previewSample={SAMPLE} />);
        expect(container.querySelector('[data-formula-preview]')).toBeNull();
        expect(container.querySelector('[data-formula-error]')).toBeNull();
    });
});
