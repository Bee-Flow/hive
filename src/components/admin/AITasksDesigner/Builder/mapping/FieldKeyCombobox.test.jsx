import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import FieldKeyCombobox from './FieldKeyCombobox';

function dndEvent(path) {
    return { getData: vi.fn((type) => (type === 'application/x-binding-path' ? path : '')), types: ['application/x-binding-path'] };
}

describe('FieldKeyCombobox', () => {
    beforeEach(() => cleanup());

    const options = [
        { key: 'email', sample: 'a@b.c' },
        { key: 'amount', sample: 5 },
    ];

    it('opens the dropdown on focus and picking an option calls onChange', () => {
        const onChange = vi.fn();
        render(<FieldKeyCombobox value="" onChange={onChange} options={options} />);
        fireEvent.focus(screen.getByRole('textbox'));
        expect(screen.getByText(/Fields of each item/)).toBeTruthy();
        fireEvent.mouseDown(screen.getByText('email'));
        expect(onChange).toHaveBeenCalledWith('email');
    });

    it('free text emits through onChange', () => {
        const onChange = vi.fn();
        render(<FieldKeyCombobox value="" onChange={onChange} options={options} />);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'customKey' } });
        expect(onChange).toHaveBeenCalledWith('customKey');
    });

    it('warns on a dotted value ("nested paths aren\'t supported")', () => {
        render(<FieldKeyCombobox value="meta.tag" onChange={vi.fn()} options={options} />);
        expect(screen.getByText(/Nested paths aren't supported here/)).toBeTruthy();
    });

    it('warns when a non-empty value is not among the known options', () => {
        render(<FieldKeyCombobox value="unknownField" onChange={vi.fn()} options={options} />);
        expect(screen.getByText(/Not seen in the sample items/)).toBeTruthy();
    });

    it('shows no warning when the value matches a known option', () => {
        render(<FieldKeyCombobox value="email" onChange={vi.fn()} options={options} />);
        expect(screen.queryByText(/Not seen in the sample items/)).toBeNull();
        expect(screen.queryByText(/Nested paths/)).toBeNull();
    });

    it('drop of a full path keeps only the last segment', () => {
        const onChange = vi.fn();
        render(<FieldKeyCombobox value="" onChange={onChange} options={options} />);
        const input = screen.getByRole('textbox');
        fireEvent.drop(input, { dataTransfer: dndEvent('steps.s1.output.items[*].email') });
        expect(onChange).toHaveBeenCalledWith('email');
    });
});
