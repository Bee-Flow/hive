import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import PathField from './PathField';
import { VariablePickerProvider } from './VariablePickerContext';
import { editorValue, typeInEditor } from '../../../../../test/refEditor';

function dndEvent(path) {
    return { getData: vi.fn((type) => (type === 'application/x-binding-path' ? path : '')), types: ['application/x-binding-path'] };
}

function renderField(props = {}, { groups = [], previewSample = null } = {}) {
    const onChange = vi.fn();
    const utils = render(
        <VariablePickerProvider groups={groups} previewSample={previewSample} stepLabelById={new Map()}>
            <PathField value="" onChange={onChange} {...props} />
        </VariablePickerProvider>,
    );
    return { onChange, ...utils };
}

describe('PathField — value handling', () => {
    beforeEach(() => cleanup());

    it('emits the raw string as typed (plain path, not a binding)', () => {
        const { onChange } = renderField();
        typeInEditor(screen.getByRole('textbox'), 'trigger.output.subject');
        expect(onChange).toHaveBeenCalledWith('trigger.output.subject');
    });

    it('renders a saved odd path byte-identical on mount (no normalization)', () => {
        renderField({ value: 'steps.deleted.output.x' });
        // What is STORED is untouched; what is SHOWN is a pill, muted because
        // the step is gone — a raw id would tell the author nothing.
        expect(editorValue(screen.getByRole('textbox'))).toBe('steps.deleted.output.x');
    });

    it('drop REPLACES the whole value instead of splicing', () => {
        const { onChange } = renderField({ value: 'old.path' });
        const input = screen.getByRole('textbox');
        fireEvent.drop(input, { dataTransfer: dndEvent('steps.s1.output.results') });
        expect(onChange).toHaveBeenCalledWith('steps.s1.output.results');
    });

    it('onFocusField broadcast insert() replaces the whole value', () => {
        const onFocusField = vi.fn();
        const { onChange } = renderField({ value: 'old.path', onFocusField });
        const input = screen.getByRole('textbox');
        fireEvent.focus(input);
        expect(onFocusField).toHaveBeenCalled();
        const { insert } = onFocusField.mock.calls[0][0];
        insert('trigger.output.a');
        expect(onChange).toHaveBeenCalledWith('trigger.output.a');
    });
});

describe('PathField — sample preview and warnings', () => {
    beforeEach(() => cleanup());

    it('expectArray + a scalar sample shows the "not a list" warning', () => {
        renderField(
            { value: 'steps.s1.output.name', expectArray: true },
            { previewSample: { steps: { s1: { output: { name: 'Alice' } } } } },
        );
        expect(screen.getByText(/isn't a list in the sample data/)).toBeTruthy();
    });

    it('expectArray + an array sample shows an example preview, no warning', () => {
        renderField(
            { value: 'steps.s1.output.items', expectArray: true },
            { previewSample: { steps: { s1: { output: { items: [1, 2, 3] } } } } },
        );
        expect(screen.queryByText(/isn't a list/)).toBeNull();
        expect(screen.getByText('example')).toBeTruthy();
        expect(screen.getByText('[3 items]')).toBeTruthy();
    });

    it('unresolvable path with a previewSample shows "no sample data" warning', () => {
        renderField(
            { value: 'steps.gone.output.x' },
            { previewSample: { steps: { s1: { output: {} } } } },
        );
        expect(screen.getByText(/No sample data found at this path/)).toBeTruthy();
    });

    it('allowLiteral="date" suppresses the warning for a fixed parseable date', () => {
        renderField(
            { value: '2026-07-01', allowLiteral: 'date' },
            { previewSample: { steps: { s1: { output: {} } } } },
        );
        expect(screen.queryByText(/No sample data found/)).toBeNull();
        expect(screen.getByText(/Fixed date/)).toBeTruthy();
    });
});

describe('PathField — quick picks', () => {
    beforeEach(() => cleanup());

    it('renders quickPicks and clicking one replaces the value', () => {
        const { onChange } = renderField({
            value: '',
            quickPicks: [{ key: 'results', path: 'steps.s1.output.results', sample: [{ a: 1 }] }],
        });
        expect(screen.getByText(/Lists found in previous steps/)).toBeTruthy();
        fireEvent.click(screen.getByTitle('steps.s1.output.results'));
        expect(onChange).toHaveBeenCalledWith('steps.s1.output.results');
    });
});
