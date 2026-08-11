import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ValueBuilder from './ValueBuilder';
import { VariablePickerProvider } from './VariablePickerContext';
import { editor, editorValue } from '../../../../../test/refEditor';

/**
 * The visual value editor. Its contract in one line: a user who has never seen
 * `{{ }}` can build every common value, and an internal step id
 * (`steps.act_4d4307a`) never reaches the screen.
 */

const RESULTS = [{ subject: 'ISV contract', from_email: 'a@b.nl' }];
const GROUPS = [{
    id: 'act_4d4307a',
    label: 'gmail search',
    kind: 'integration_action',
    basePath: 'steps.act_4d4307a.output',
    sample: { total: 201, results: RESULTS },
    fields: [
        { key: 'total', path: 'steps.act_4d4307a.output.total', sample: 201 },
        { key: 'results', path: 'steps.act_4d4307a.output.results', sample: RESULTS },
    ],
}];
const SAMPLE = { steps: { act_4d4307a: { output: { total: 201, results: RESULTS } } } };
const LABELS = new Map([['act_4d4307a', 'gmail search']]);

function renderBuilder(value, props = {}) {
    const onChange = vi.fn();
    render(
        <VariablePickerProvider groups={GROUPS} previewSample={SAMPLE} stepLabelById={LABELS}>
            <ValueBuilder value={value} onChange={onChange} label="total" {...props} />
        </VariablePickerProvider>,
    );
    return { onChange };
}

describe('ValueBuilder', () => {
    beforeEach(cleanup);

    it('shows a picked value as a named chip with its example — no path anywhere', () => {
        renderBuilder({ kind: 'ref', path: 'steps.act_4d4307a.output.total' });
        expect(screen.getByText('gmail search')).toBeTruthy();
        expect(screen.getByText('▸ Total')).toBeTruthy();
        expect(screen.getByText('201')).toBeTruthy();
        expect(screen.queryByText(/act_4d4307a/)).toBeNull();
        expect(screen.queryByText(/\{\{/)).toBeNull();
    });

    it('typing plain text writes a literal', () => {
        const { onChange } = renderBuilder(null);
        fireEvent.change(screen.getByPlaceholderText('Type a value…'), { target: { value: 'open' } });
        expect(onChange).toHaveBeenCalledWith({ kind: 'literal', value: 'open' });
    });

    it('picking data from a step writes the ref', () => {
        const { onChange } = renderBuilder(null);
        fireEvent.click(screen.getByText('Use data from a step'));
        fireEvent.click(screen.getByText('total'));
        expect(onChange).toHaveBeenCalledWith({ kind: 'ref', path: 'steps.act_4d4307a.output.total' });
    });

    it('text plus data becomes a template, built by clicking — not by typing braces', () => {
        const { onChange } = renderBuilder({ kind: 'literal', value: 'Order ' });
        fireEvent.click(screen.getByText('Use data from a step'));
        fireEvent.click(screen.getByText('total'));
        expect(onChange).toHaveBeenCalledWith({
            kind: 'template', value: 'Order {{steps.act_4d4307a.output.total}}',
        });
    });

    it('“Adjust it” writes the formula for the user', () => {
        const { onChange } = renderBuilder({ kind: 'ref', path: 'steps.act_4d4307a.output.total' });
        fireEvent.change(screen.getByLabelText('Adjust the value'), { target: { value: 'round' } });
        expect(onChange).toHaveBeenCalledWith({
            kind: 'expr', value: 'round(steps.act_4d4307a.output.total)',
        });
        // …and reads back as that same adjustment, not as an opaque formula.
        cleanup();
        renderBuilder({ kind: 'expr', value: 'round(steps.act_4d4307a.output.total)' });
        expect(screen.getByLabelText('Adjust the value').value).toBe('round');
    });

    it('the adjust control is hidden once the value is a combination', () => {
        renderBuilder({ kind: 'template', value: 'Order {{steps.act_4d4307a.output.total}}' });
        expect(screen.queryByLabelText('Adjust the value')).toBeNull();
        expect(screen.getByText('▸ Total')).toBeTruthy();
    });

    it('removing a chip clears the value', () => {
        const { onChange } = renderBuilder({ kind: 'ref', path: 'steps.act_4d4307a.output.total' });
        fireEvent.click(screen.getByLabelText('Remove this value'));
        expect(onChange).toHaveBeenCalledWith({ kind: 'literal', value: '' });
    });

    it('a hand-written formula is shown with step NAMES and never rewritten', () => {
        const src = 'concat(steps.act_4d4307a.output.total, " eur")';
        const { onChange } = renderBuilder({ kind: 'expr', value: src });
        expect(screen.getByText('Custom formula')).toBeTruthy();
        expect(screen.getByText('gmail search')).toBeTruthy();
        expect(screen.queryByText(/act_4d4307a/)).toBeNull();
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText('Edit the formula'));
        // Editing keeps the formula byte-identical; the step reference inside it
        // still reads as a name, so even the raw editor never shows the id.
        const box = editor(document.body);
        expect(editorValue(box)).toBe(src);
        expect(box.textContent).not.toContain('act_4d4307a');
    });

    it('a JSON pick is a chip too, and offers nothing to combine it with', () => {
        renderBuilder({ kind: 'expr', value: 'parseJson(steps.act_4d4307a.output.total, "order.id")' });
        expect(screen.getByText('gmail search')).toBeTruthy();
        expect(screen.getByText('· from the JSON: order.id')).toBeTruthy();
        expect(screen.queryByText('Custom formula')).toBeNull();
        expect(screen.queryByText('Use data from a step')).toBeNull();
        expect(screen.queryByText('Add data')).toBeNull();
    });

    it('the quick view offers no formula escape at all', () => {
        renderBuilder({ kind: 'ref', path: 'steps.act_4d4307a.output.total' }, { allowRaw: false });
        expect(screen.queryByLabelText('Write this value as a formula')).toBeNull();
        expect(screen.getByText('gmail search')).toBeTruthy();
    });
});
