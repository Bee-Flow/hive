import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import LoopOverPicker from './LoopOverPicker';
import { VariablePickerProvider } from './VariablePickerContext';

const groups = [
    { id: 's1', label: 'Search web', basePath: 'steps.s1.output', fields: [
        { key: 'results', path: 'steps.s1.output.results', sample: [{ a: 1 }, { a: 2 }] },
    ] },
];
const labels = new Map([['s1', 'Search web']]);

function renderPicker(props = {}) {
    const onChange = vi.fn();
    const utils = render(
        <VariablePickerProvider groups={groups} previewSample={null} stepLabelById={labels}>
            <LoopOverPicker overRef="steps.s1.output.results" itemVar="result" onChange={onChange} groups={groups} {...props} />
        </VariablePickerProvider>,
    );
    return { onChange, ...utils };
}

describe('LoopOverPicker — friendly labels', () => {
    beforeEach(() => cleanup());

    it('shows the step name, not the raw steps.* path', () => {
        renderPicker();
        expect(screen.getAllByText(/Search web/).length).toBeGreaterThan(0);
        // The raw path appears only in title attributes, never as visible text.
        expect(screen.queryByText('steps.s1.output.results')).toBeNull();
    });

    it('keeps the raw path input behind Advanced', () => {
        renderPicker();
        expect(screen.queryByPlaceholderText('steps.s1.output.results')).toBeNull();
        fireEvent.click(screen.getByText('Advanced'));
        expect(screen.getByPlaceholderText('steps.s1.output.results')).toBeTruthy();
    });

    it('picking a list emits its path', () => {
        const { onChange } = renderPicker({ overRef: '', itemVar: 'item' });
        fireEvent.click(screen.getByText(/Search web/));
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ overRef: 'steps.s1.output.results' }));
    });
});
