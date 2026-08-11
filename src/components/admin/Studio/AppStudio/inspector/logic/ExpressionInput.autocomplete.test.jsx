import { render, fireEvent, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import ExpressionInput from './ExpressionInput';
import { VariablePickerProvider } from '../../../../AITasksDesigner/Builder/mapping/VariablePickerContext';

/**
 * Inline autocomplete is what catches the typo the picker never would.
 * `vars.statusfilter` (for `vars.filters.status`) is not a mis-click — it is
 * something a person types from memory, and it resolves to undefined in
 * silence. Completing while typing is the only affordance that reaches it.
 *
 * It is also the reason getAutocompleteTokenFromPrefix takes a `roots`
 * argument: the routine builder's roots (steps/trigger/loop) share nothing with
 * App Studio's but item and vars, so with the default list the picker never
 * opened on `currentUser.` or `form.` — the two an app author reaches for first.
 */

const SAMPLE = {
    currentUser: { name: 'Zoe', email: 'zoe@example.com' },
    vars: { filters: { q: 'acme' }, statusFilter: 'new' },
};

const GROUPS = [
    {
        id: 'currentUser',
        label: 'Current user',
        kind: 'trigger',
        basePath: 'currentUser',
        fields: [
            { key: 'name', path: 'currentUser.name', sample: 'Zoe' },
            { key: 'email', path: 'currentUser.email', sample: 'zoe@example.com' },
        ],
    },
    {
        id: 'vars',
        label: 'Variables',
        kind: 'code',
        basePath: 'vars',
        fields: [{ key: 'statusFilter', path: 'vars.statusFilter', sample: 'new' }],
    },
];

/**
 * CONTROLLED, like every real call site: the inspector commits the emitted
 * string and feeds it straight back. A harness that swallows the value instead
 * lets React reset the DOM input on every render, which silently turns a
 * token REPLACEMENT into "whatever the snippet was" and hides the bug the
 * "keeps the text around the token" case exists to catch.
 */
function renderInput({ value: initial = '', onChange, ...props } = {}) {
    function Harness() {
        const [value, setValue] = useState(initial);
        return (
            <VariablePickerProvider groups={GROUPS} previewSample={SAMPLE}>
                <ExpressionInput
                    variant="inline"
                    ariaLabel="Formula"
                    previewSample={SAMPLE}
                    value={value}
                    onChange={(next) => { setValue(next); onChange?.(next); }}
                    {...props}
                />
            </VariablePickerProvider>
        );
    }
    return render(<Harness />);
}

/** Type into the field the way a person does: value plus a caret at the end. */
function type(text) {
    const field = screen.getByLabelText('Formula');
    fireEvent.change(field, { target: { value: text } });
    return field;
}

const pickerOpen = () => !!document.querySelector('[data-variable-picker]');

describe('ExpressionInput — inline autocomplete', () => {
    it('opens the picker on a rooted prefix App Studio owns', () => {
        renderInput({ value: '' });
        expect(pickerOpen()).toBe(false);
        type('currentUser.');
        expect(pickerOpen()).toBe(true);
    });

    it('opens on a bare partial that could still become a root', () => {
        renderInput({ value: '' });
        type('curr');
        expect(pickerOpen()).toBe(true);
    });

    it('stays shut for ordinary expression text', () => {
        renderInput({ value: '' });
        type('1 + 2');
        expect(pickerOpen()).toBe(false);
    });

    it('closes again once the text stops looking like a path', () => {
        renderInput({ value: '' });
        type('currentUser.');
        expect(pickerOpen()).toBe(true);
        type('1 + 2');
        expect(pickerOpen()).toBe(false);
    });

    // The bug this whole parameter exists for.
    it('completes a root the routine builder does not have', () => {
        const onChange = vi.fn();
        renderInput({ value: '', onChange });
        type('currentUser.');
        fireEvent.click(document.querySelector('[title="currentUser.email"]'));
        expect(onChange).toHaveBeenLastCalledWith('currentUser.email');
    });

    it('REPLACES what was typed rather than appending to it', () => {
        const onChange = vi.fn();
        renderInput({ value: '', onChange });
        type('vars.stat');
        fireEvent.click(document.querySelector('[title="vars.statusFilter"]'));
        // Not 'vars.statvars.statusFilter'.
        expect(onChange).toHaveBeenLastCalledWith('vars.statusFilter');
    });

    it('keeps the text around the token intact', () => {
        const onChange = vi.fn();
        renderInput({ value: '', onChange });
        type('1 + vars.stat');
        fireEvent.click(document.querySelector('[title="vars.statusFilter"]'));
        expect(onChange).toHaveBeenLastCalledWith('1 + vars.statusFilter');
    });

    it('the {} button inserts at the caret instead of replacing', () => {
        const onChange = vi.fn();
        renderInput({ value: 'len(', onChange });
        fireEvent.click(screen.getByLabelText('Insert a variable'));
        fireEvent.click(document.querySelector('[title="currentUser.name"]'));
        expect(onChange).toHaveBeenLastCalledWith('len(currentUser.name');
    });
});
