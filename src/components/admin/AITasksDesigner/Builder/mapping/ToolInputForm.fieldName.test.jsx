import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ToolInputForm from './ToolInputForm';
import { VariablePickerProvider } from './VariablePickerContext';

/**
 * Set/layer_output field-NAME editing — node-audit B12 + user report.
 *
 * The old name input renamed the map key on every keystroke (row remount →
 * focus loss per character) and accepted native text drops, which landed the
 * FULL binding path as the field name — dots make the resulting output key
 * unbindable downstream, and the value stayed bound to the wrong thing.
 */
function renderSetFields(fields, onChange = vi.fn()) {
    const utils = render(
        <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={new Map()}>
            <ToolInputForm inputs={fields} onChange={onChange} keepEmptyFields allowExtraFields />
        </VariablePickerProvider>,
    );
    return { onChange, ...utils };
}

const nameInput = (value) => screen.getByDisplayValue(value);

describe('ToolInputForm — field name commit-on-blur', () => {
    beforeEach(() => cleanup());

    it('typing does NOT rename per keystroke; blur commits once', () => {
        const { onChange } = renderSetFields({ greeting: { kind: 'literal', value: 'hi' } });
        const input = nameInput('greeting');
        fireEvent.change(input, { target: { value: 'salutation' } });
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.blur(input);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(Object.keys(onChange.mock.calls[0][0])).toEqual(['salutation']);
    });

    it('clearing the name reverts on blur instead of committing an empty key', () => {
        const { onChange } = renderSetFields({ greeting: { kind: 'literal', value: 'hi' } });
        const input = nameInput('greeting');
        fireEvent.change(input, { target: { value: '' } });
        fireEvent.blur(input);
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByDisplayValue('greeting')).toBeTruthy();
        expect(screen.getByText(/Name required/)).toBeTruthy();
    });

    it('renaming onto an existing sibling shows an error and commits nothing', () => {
        const { onChange } = renderSetFields({
            a: { kind: 'literal', value: '1' },
            b: { kind: 'literal', value: '2' },
        });
        const input = nameInput('a');
        fireEvent.change(input, { target: { value: 'b' } });
        fireEvent.blur(input);
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByText(/already exists/)).toBeTruthy();
    });

    it('reserved names are refused (the __proto__ silent-vanish trap)', () => {
        const { onChange } = renderSetFields({ a: { kind: 'literal', value: '1' } });
        const input = nameInput('a');
        fireEvent.change(input, { target: { value: '__proto__' } });
        fireEvent.blur(input);
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByText(/reserved name/)).toBeTruthy();
    });

    it('a typed PATH on an empty row adopts it: name = last segment, value = ref (user report)', () => {
        const { onChange } = renderSetFields({ field_1: { kind: 'literal', value: '' } });
        const input = nameInput('field_1');
        fireEvent.change(input, { target: { value: 'steps.act_4d4307a4.output.results[*].subject' } });
        fireEvent.blur(input);
        expect(onChange).toHaveBeenCalledTimes(1);
        const next = onChange.mock.calls[0][0];
        expect(next).toEqual({ subject: { kind: 'ref', path: 'steps.act_4d4307a4.output.results[*].subject' } });
    });

    it('a typed PATH on a row with a configured value renames only (never clobbers the binding)', () => {
        const bound = { kind: 'ref', path: 'trigger.output.x' };
        const { onChange } = renderSetFields({ field_1: bound });
        const input = nameInput('field_1');
        fireEvent.change(input, { target: { value: 'steps.s9.output.rows[*].email' } });
        fireEvent.blur(input);
        const next = onChange.mock.calls[0][0];
        expect(next.email).toEqual(bound);
        expect(next.field_1).toBeUndefined();
    });

    it('a non-rooted dotted name is de-pathed to its last segment', () => {
        const { onChange } = renderSetFields({ a: { kind: 'literal', value: '1' } });
        const input = nameInput('a');
        fireEvent.change(input, { target: { value: 'some.dotted thing' } });
        fireEvent.blur(input);
        const next = onChange.mock.calls[0][0];
        // suggestKeyFromPath('some.dotted thing') → identifier-safe tail.
        expect(Object.keys(next)).toHaveLength(1);
        expect(Object.keys(next)[0]).toMatch(/^[A-Za-z0-9_]+$/);
    });
});
