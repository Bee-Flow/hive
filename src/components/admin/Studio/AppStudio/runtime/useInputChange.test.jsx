import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AppInputSelect from './components/AppInputSelect';
import AppInputCheckbox from './components/AppInputCheckbox';
import AppInputText from './components/AppInputText';
import { RuntimeProvider, DEFAULT_RUNTIME } from './RuntimeContext';

/**
 * `onChange` is what turns a row of dropdowns into a triage bar: pick a status
 * and it saves. The two rules worth pinning are that it hands over the NEW
 * value (not the previous one) and that it is not offered on text fields.
 */

const OPTIONS = [
    { value: 'open', label: 'Open' },
    { value: 'resolved', label: 'Resolved' },
];

function renderInput(Component, node, runtime = {}) {
    return render(
        <RuntimeProvider value={{ ...DEFAULT_RUNTIME, mode: 'run', ...runtime }}>
            <Component node={node} />
        </RuntimeProvider>,
    );
}

const selectNode = (extra = {}) => ({
    id: 'cmp_s', type: 'input_select',
    props: { name: 'status', label: 'Status', options: OPTIONS },
    style: { span: 3 },
    ...extra,
});

describe('onChange on discrete inputs', () => {
    it('runs the action with the NEW value', () => {
        // setValue is async state, so reading the form back on the same tick
        // would hand the action the value the user picked *before* this one.
        const runAction = vi.fn();
        const { container } = renderInput(AppInputSelect, selectNode({ onChange: 'act_status' }), { runAction });

        fireEvent.change(container.querySelector('select'), { target: { value: 'resolved' } });

        expect(runAction).toHaveBeenCalledTimes(1);
        const [actionId, payload] = runAction.mock.calls[0];
        expect(actionId).toBe('act_status');
        expect(payload.formValues.status).toBe('resolved');
    });

    it('does nothing without an onChange wired', () => {
        const runAction = vi.fn();
        const { container } = renderInput(AppInputSelect, selectNode(), { runAction });
        fireEvent.change(container.querySelector('select'), { target: { value: 'open' } });
        expect(runAction).not.toHaveBeenCalled();
    });

    it('never fires while designing', () => {
        // Clicking through a dropdown in the editor must not write records.
        const runAction = vi.fn();
        const { container } = renderInput(AppInputSelect, selectNode({ onChange: 'act_status' }), { runAction, mode: 'edit' });
        fireEvent.change(container.querySelector('select'), { target: { value: 'open' } });
        expect(runAction).not.toHaveBeenCalled();
    });

    it('works on a checkbox too, passing the boolean', () => {
        const runAction = vi.fn();
        const { container } = renderInput(
            AppInputCheckbox,
            { id: 'cmp_c', type: 'input_checkbox', props: { name: 'urgent', label: 'Urgent' }, style: {}, onChange: 'act_flag' },
            { runAction },
        );
        fireEvent.click(container.querySelector('input[type="checkbox"]'));
        expect(runAction.mock.calls[0][1].formValues.urgent).toBe(true);
    });

    it('a text input never fires it, even if one is wired', () => {
        // The spec does not declare the event there — a write per keystroke is
        // not a feature. This guards the component against a stray wiring.
        const runAction = vi.fn();
        const { container } = renderInput(
            AppInputText,
            { id: 'cmp_t', type: 'input_text', props: { name: 'q', label: 'Search' }, style: {}, onChange: 'act_nope' },
            { runAction },
        );
        fireEvent.change(container.querySelector('input'), { target: { value: 'hello' } });
        expect(runAction).not.toHaveBeenCalled();
    });
});
