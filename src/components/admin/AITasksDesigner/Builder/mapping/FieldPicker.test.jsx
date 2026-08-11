import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import FieldPicker from './FieldPicker';

const OPTIONS = [
    { path: 'item.subject', label: 'Subject', sample: 'Nextcloud ISV contract', group: 'Fields of each item' },
    { path: 'item.from_email', label: 'From email', sample: 'a@b.nl', group: 'Fields of each item' },
    { path: 'steps.g.output.count', label: 'Count', sample: 10, group: 'gmail search' },
];

function renderPicker(props = {}) {
    const onChange = vi.fn();
    render(<FieldPicker options={OPTIONS} onChange={onChange} {...props} />);
    return { onChange };
}

const open = () => fireEvent.click(screen.getByRole('button', { name: /Choose a field|Subject|From email|Count/ }));

describe('FieldPicker', () => {
    beforeEach(cleanup);

    it('shows the field NAME and its example, never the path', () => {
        renderPicker({ value: { kind: 'ref', path: 'item.subject' } });
        expect(screen.getByText('Subject')).toBeTruthy();
        expect(screen.getByText('Nextcloud ISV contract')).toBeTruthy();
        expect(screen.queryByText('item.subject')).toBeNull();
    });

    it('falls back to a humanized name for a path that is not in the options', () => {
        renderPicker({ value: { kind: 'ref', path: 'item.message_id' } });
        expect(screen.getByText('Message id')).toBeTruthy();
    });

    it('emits a ref binding when a field is picked', () => {
        const { onChange } = renderPicker();
        open();
        fireEvent.mouseDown(screen.getByText('From email'));
        expect(onChange).toHaveBeenCalledWith({ kind: 'ref', path: 'item.from_email' });
    });

    it('groups the options by where they come from', () => {
        renderPicker();
        open();
        expect(screen.getByText('Fields of each item')).toBeTruthy();
        expect(screen.getByText('gmail search')).toBeTruthy();
    });

    it('filters as you type', () => {
        renderPicker();
        open();
        fireEvent.change(screen.getByPlaceholderText('Search fields…'), { target: { value: 'from' } });
        expect(screen.getByText('From email')).toBeTruthy();
        expect(screen.queryByText('Subject')).toBeNull();
    });

    it('accepts a typed field name when there is no sample data yet', () => {
        const { onChange } = renderPicker({ options: [], value: null });
        fireEvent.click(screen.getByRole('button', { name: /Choose a field/ }));
        expect(screen.getByText(/No sample data yet/)).toBeTruthy();
        fireEvent.change(screen.getByPlaceholderText('Search fields…'), { target: { value: 'subject' } });
        fireEvent.mouseDown(screen.getByText('Use “subject”'));
        expect(onChange).toHaveBeenCalledWith({ kind: 'ref', path: 'item.subject' });
    });

    it('resolves a typed name against the given base', () => {
        const { onChange } = renderPicker({ options: [], fallbackBase: 'trigger.output' });
        fireEvent.click(screen.getByRole('button', { name: /Choose a field/ }));
        fireEvent.change(screen.getByPlaceholderText('Search fields…'), { target: { value: 'plan' } });
        fireEvent.mouseDown(screen.getByText('Use “plan”'));
        expect(onChange).toHaveBeenCalledWith({ kind: 'ref', path: 'trigger.output.plan' });
    });

    it('offers the expression escape hatch only when the caller supports it', () => {
        const onUseExpression = vi.fn();
        renderPicker({ onUseExpression });
        open();
        fireEvent.mouseDown(screen.getByText('Use an expression instead'));
        expect(onUseExpression).toHaveBeenCalled();

        cleanup();
        renderPicker();
        open();
        expect(screen.queryByText('Use an expression instead')).toBeNull();
    });
});
