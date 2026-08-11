import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import BindingField from './BindingField';
import { VariablePickerProvider } from './VariablePickerContext';
import { editorValue, typeInEditor } from '../../../../../test/refEditor';

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

    it('shows the step name as a chip', () => {
        renderField();
        expect(screen.getByText('Search web')).toBeTruthy();
    });

    it('KEEPS the name while focused — the raw id is never put on screen', () => {
        // This used to swap the chip for `steps.s1.output.sources` the moment
        // you clicked in, so the raw id was showing exactly when someone was
        // editing. The reference is an atomic pill now, at rest and in use.
        renderField();
        const input = screen.getByRole('textbox');
        fireEvent.focus(input);
        expect(input.textContent).toContain('Search web');
        expect(input.textContent).not.toContain('steps.s1');
        // The stored value is untouched — only its presentation changed.
        expect(editorValue(input)).toBe('steps.s1.output.sources');
    });

    it('still emits a ref binding when the text is edited', () => {
        const { onChange } = renderField();
        const input = screen.getByRole('textbox');
        fireEvent.focus(input);
        typeInEditor(input, 'steps.s1.output.newsDigest');
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

/**
 * BFSF-321 — the text/expression toggle used to be two independent state
 * variables fighting each other: a "⋯" button revealed a third control, which
 * on click removed two, and nothing ever reset the reveal. Controls appearing
 * and disappearing read as a rendering bug rather than a mode switch.
 *
 * The contract now: exactly the same controls are present at all times, and
 * only their selected state changes.
 */
describe('BindingField — mode toggle stability', () => {
    beforeEach(() => cleanup());

    function renderLiteral(props = {}) {
        const onChange = vi.fn();
        const utils = render(
            <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={labels}>
                <BindingField label="Amount" value={{ kind: 'literal', value: 'hello' }} onChange={onChange} {...props} />
            </VariablePickerProvider>,
        );
        return { onChange, ...utils };
    }

    // The controls sitting beside the input — the ones whose flicker was the
    // reported bug. (The "Syntax help" disclosure below the field is a separate,
    // deliberate affordance and is asserted on its own further down.)
    const inlineControls = () => [
        ...screen.getAllByLabelText('Insert variable'),
        ...screen.getByRole('group', { name: 'Value mode' }).querySelectorAll('button'),
    ];

    it('shows the insert button and BOTH mode options up front — no "Advanced" reveal', () => {
        renderLiteral();
        expect(screen.getByLabelText('Insert variable')).toBeTruthy();
        expect(screen.getByRole('group', { name: 'Value mode' })).toBeTruthy();
        // The old three-dot reveal is gone entirely.
        expect(screen.queryByLabelText('Advanced options')).toBeNull();
    });

    it('keeps the inline controls identical across a fixed → expression → fixed round trip', () => {
        renderLiteral();
        const before = inlineControls().map(b => b.getAttribute('title'));
        expect(before).toHaveLength(3);

        fireEvent.click(screen.getByTitle(/^Expression/));
        expect(inlineControls().map(b => b.getAttribute('title'))).toEqual(before);

        fireEvent.click(screen.getByTitle(/^Plain text/));
        expect(inlineControls().map(b => b.getAttribute('title'))).toEqual(before);
    });

    it('marks exactly one mode as pressed at a time', () => {
        renderLiteral();
        const pressed = () => inlineControls().filter(b => b.getAttribute('aria-pressed') === 'true');
        expect(pressed()).toHaveLength(1);
        fireEvent.click(screen.getByTitle(/^Expression/));
        expect(pressed()).toHaveLength(1);
    });

    it('emits an expr binding when switched to expression mode', () => {
        const { onChange } = renderLiteral({ value: { kind: 'literal', value: 'a > 1' } });
        fireEvent.click(screen.getByTitle(/^Expression/));
        expect(onChange).toHaveBeenCalledWith({ kind: 'expr', value: 'a > 1' });
    });

    // Flipping the switch used to re-emit the text verbatim, which broke the
    // one thing users do most: a `{{ }}` reference became the invalid
    // expression `{{steps.s1.output.total}}` ("Unexpected character: {"), and
    // going the other way turned a live reference into the literal STRING
    // "steps.s1.output.total" — a value that saves green and runs wrong.
    it('translates a single reference between the two modes', () => {
        const { onChange } = renderLiteral({ value: { kind: 'template', value: '{{steps.s1.output.total}}' } });
        fireEvent.click(screen.getByTitle(/^Expression/));
        expect(onChange).toHaveBeenLastCalledWith({ kind: 'ref', path: 'steps.s1.output.total' });
        fireEvent.click(screen.getByTitle(/^Plain text/));
        expect(onChange).toHaveBeenLastCalledWith({ kind: 'template', value: '{{steps.s1.output.total}}' });
    });

    it('leaves anything but a lone reference exactly as typed', () => {
        const { onChange } = renderLiteral({ value: { kind: 'literal', value: 'Total: {{steps.s1.output.total}} eur' } });
        fireEvent.click(screen.getByTitle(/^Expression/));
        expect(onChange).toHaveBeenLastCalledWith({ kind: 'expr', value: 'Total: {{steps.s1.output.total}} eur' });

        cleanup();
        const plain = renderLiteral({ value: { kind: 'expr', value: 'hello' } });
        fireEvent.click(screen.getByTitle(/^Plain text/));
        expect(plain.onChange).toHaveBeenLastCalledWith({ kind: 'literal', value: 'hello' });
    });

    it('stays in expression mode when the parent echoes an empty value back', () => {
        // An EMPTY expression serialises to {kind:'literal', value:''} — there
        // is no wire shape for "expression mode, nothing typed". The field used
        // to read that echo back as fixed mode and silently flip the user out
        // of the mode they picked.
        const onChange = vi.fn();
        const { rerender } = render(
            <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={labels}>
                <BindingField label="Q" value={{ kind: 'literal', value: '' }} onChange={onChange} />
            </VariablePickerProvider>,
        );
        fireEvent.click(screen.getByTitle(/^Expression/));
        const emitted = onChange.mock.calls.at(-1)[0];

        act(() => {
            rerender(
                <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={labels}>
                    <BindingField label="Q" value={emitted} onChange={onChange} />
                </VariablePickerProvider>,
            );
        });

        const exprBtn = screen.getByTitle(/^Expression/);
        expect(exprBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('offers syntax help in expression mode, and not in plain-text mode', () => {
        renderLiteral();
        expect(screen.queryByText(/Syntax help/)).toBeNull();
        fireEvent.click(screen.getByTitle(/^Expression/));
        expect(screen.getByText(/Syntax help/)).toBeTruthy();
    });

    it('suppresses syntax help when the host opts out', () => {
        renderLiteral({ showExpressionHelp: false });
        fireEvent.click(screen.getByTitle(/^Expression/));
        expect(screen.queryByText(/Syntax help/)).toBeNull();
    });
});

/**
 * The NDV INPUT panel is a TREE now (BFSF-329), and its rows are
 * `role="button" tabIndex={0}` — so clicking one blurs the parameter field
 * first. The insert handle must survive that, or every click-to-map is a
 * silent no-op. (Not fixable with mousedown/preventDefault: that kills the
 * native dragstart the same rows rely on.)
 */
describe('BindingField — click-to-insert survives losing focus', () => {
    beforeEach(() => cleanup());

    it('the broadcast handle still splices after the input has blurred', () => {
        const onChange = vi.fn();
        let handle = null;
        render(
            <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={labels}>
                <BindingField
                    label="Sources"
                    value={{ kind: 'literal', value: '' }}
                    onChange={onChange}
                    onFocusField={(h) => { handle = h; }}
                />
            </VariablePickerProvider>,
        );

        const input = screen.getByRole('textbox');
        fireEvent.focus(input);
        expect(handle).toBeTruthy();

        // The tree row takes focus away, exactly as a real click does.
        fireEvent.blur(input);

        act(() => { handle.insert('steps.s1.output.count'); });
        expect(onChange).toHaveBeenCalled();
        const last = onChange.mock.calls.at(-1)[0];
        expect(JSON.stringify(last)).toContain('steps.s1.output.count');
    });
});
