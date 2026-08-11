import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import VariablesManager from './VariablesManager';
import { MAX_VARIABLES } from '../runtime/appVariables';

/**
 * The manager is the only place a person can SEE what `vars` an app has. These
 * pin the three things that make it trustworthy: an edit commits straight
 * through (no staged draft to lose), a name in use cannot be renamed out from
 * under the formulas that read it, and deleting something in use says what will
 * break rather than doing it quietly.
 */

const decl = (name, over = {}) => ({ name, label: '', type: 'text', default: '', description: '', ...over });

function baseDef(variables, extra = {}) {
    return {
        schemaVersion: 2,
        meta: { name: 'T' },
        homeScreenId: 'scr_a',
        screens: [{ id: 'scr_a', name: 'Home', sections: [{ id: 'sec_a', children: [] }] }],
        actions: {},
        ...(variables ? { variables } : {}),
        ...extra,
    };
}

/** Controlled, like the header: a commit feeds straight back in. */
function renderManager(definition) {
    const onCommit = vi.fn();
    function Harness() {
        const [def, setDef] = useState(definition);
        return <VariablesManager definition={def} onCommit={(next) => { setDef(next); onCommit(next); }} />;
    }
    const utils = render(<Harness />);
    return { onCommit, last: () => onCommit.mock.calls.at(-1)?.[0], ...utils };
}

describe('VariablesManager — the list', () => {
    it('renders each declared variable', () => {
        renderManager(baseDef([decl('statusFilter', { label: 'Status' }), decl('mine', { type: 'yesno', default: false })]));
        expect(screen.getByLabelText('Name of statusFilter').value).toBe('statusFilter');
        expect(screen.getByLabelText('Name of mine').value).toBe('mine');
    });

    it('adding one commits a definition with the new variable', () => {
        const { last } = renderManager(baseDef());
        fireEvent.click(screen.getByRole('button', { name: /new variable/i }));
        expect(last().variables).toHaveLength(1);
        expect(last().variables[0].type).toBe('text');
    });

    it('stops at the ceiling and says why', () => {
        const many = Array.from({ length: MAX_VARIABLES }, (_, i) => decl(`v${i}`));
        renderManager(baseDef(many));
        const add = screen.getByRole('button', { name: /new variable/i });
        expect(add.disabled).toBe(true);
        expect(add.getAttribute('title')).toMatch(new RegExp(String(MAX_VARIABLES)));
    });
});

describe('VariablesManager — types and starting values', () => {
    it('changing the type re-coerces the starting value', () => {
        // Otherwise a text default survives onto a number variable and the
        // server rejects the save with a type error the user never asked for.
        const { last } = renderManager(baseDef([decl('a', { default: 'abc' })]));
        fireEvent.change(screen.getByLabelText('Type of a'), { target: { value: 'number' } });
        expect(last().variables[0]).toMatchObject({ type: 'number', default: 0 });
    });

    it('a yes/no variable gets a switch, not a text box', () => {
        const { last } = renderManager(baseDef([decl('mine', { type: 'yesno', default: false })]));
        const control = screen.getByLabelText('Starting value of mine');
        expect(control.type).toBe('checkbox');
        fireEvent.click(control);
        // A real boolean, not the string "true" — the filter compares against it.
        expect(last().variables[0].default).toBe(true);
    });

    it('a date variable gets a date picker and can be left empty', () => {
        const { last } = renderManager(baseDef([decl('due', { type: 'date', default: '2026-08-10' })]));
        const input = screen.getByLabelText('Starting value of due');
        expect(input.type).toBe('date');
        fireEvent.change(input, { target: { value: '' } });
        expect(last().variables[0].default).toBe(null);
    });

    it('a JSON starting value only commits once it parses', () => {
        const { last, onCommit } = renderManager(baseDef([decl('cfg', { type: 'record', default: {} })]));
        const input = screen.getByLabelText('Starting value of cfg');
        fireEvent.change(input, { target: { value: '{"a"' } });
        expect(screen.getByText(/not valid json yet/i)).toBeTruthy();
        expect(onCommit).not.toHaveBeenCalled();
        fireEvent.change(input, { target: { value: '{"a":1}' } });
        expect(last().variables[0].default).toEqual({ a: 1 });
    });
});

describe('VariablesManager — names', () => {
    it('renames an unused variable', () => {
        const { last } = renderManager(baseDef([decl('old')]));
        const input = screen.getByLabelText('Name of old');
        fireEvent.change(input, { target: { value: 'renamed' } });
        fireEvent.blur(input);
        expect(last().variables[0].name).toBe('renamed');
    });

    it('refuses a name no formula could read, and says what is wrong', () => {
        const { onCommit } = renderManager(baseDef([decl('ok')]));
        const input = screen.getByLabelText('Name of ok');
        fireEvent.change(input, { target: { value: 'my var' } });
        fireEvent.blur(input);
        expect(onCommit).not.toHaveBeenCalled();
        expect(screen.getByText(/one word/i)).toBeTruthy();
    });

    it('refuses the filter bar’s reserved name with an explanation', () => {
        const { onCommit } = renderManager(baseDef([decl('ok')]));
        const input = screen.getByLabelText('Name of ok');
        fireEvent.change(input, { target: { value: 'filters' } });
        fireEvent.blur(input);
        expect(onCommit).not.toHaveBeenCalled();
        expect(screen.getByText(/belongs to the filter bar/i)).toBeTruthy();
    });

    // No rename/rewrite subsystem: the formulas reading it are not rewritten,
    // so the name is fixed the moment anything depends on it.
    it('locks the name once something uses it', () => {
        const def = baseDef([decl('used')]);
        def.screens[0].sections[0].children = [
            { id: 'cmp_a', type: 'text', props: {}, computed: { text: { kind: 'formula', expr: 'vars.used' } } },
        ];
        renderManager(def);
        expect(screen.getByLabelText('Name of used').disabled).toBe(true);
        expect(screen.getByText('used 1×')).toBeTruthy();
    });
});

describe('VariablesManager — deleting', () => {
    it('an unused variable goes straight away', () => {
        const { last } = renderManager(baseDef([decl('idle')]));
        fireEvent.click(screen.getByRole('button', { name: 'Delete idle' }));
        expect(last()).not.toHaveProperty('variables');
    });

    it('one in use asks first, and names where it is used', () => {
        const def = baseDef([decl('used')]);
        def.screens[0].sections[0].children = [
            { id: 'cmp_a', type: 'text', props: {}, computed: { text: { kind: 'formula', expr: 'vars.used' } } },
        ];
        const { onCommit } = renderManager(def);
        fireEvent.click(screen.getByRole('button', { name: 'Delete used' }));
        expect(onCommit).not.toHaveBeenCalled();
        expect(screen.getByText(/still use it/i)).toBeTruthy();
        expect(screen.getByText(/Screen “Home”/)).toBeTruthy();
    });

    it('removing the last one drops the key entirely', () => {
        const { last } = renderManager(baseDef([decl('only')]));
        fireEvent.click(screen.getByRole('button', { name: 'Delete only' }));
        expect('variables' in last()).toBe(false);
    });
});

describe('VariablesManager — the unknown-variable banner', () => {
    // The direct answer to the typo: a formula reading vars.statusfilter where
    // vars.statusFilter was meant.
    function defWithTypo() {
        const def = baseDef([decl('statusFilter')]);
        def.screens[0].sections[0].children = [
            { id: 'cmp_a', type: 'text', props: {}, computed: { text: { kind: 'formula', expr: 'vars.statusfilter' } } },
        ];
        return def;
    }

    it('names what nothing gives a value', () => {
        renderManager(defWithTypo());
        expect(screen.getByText(/vars\.statusfilter/)).toBeTruthy();
    });

    it('offers to declare it in one click', () => {
        const { last } = renderManager(defWithTypo());
        fireEvent.click(screen.getByRole('button', { name: /declare it/i }));
        expect(last().variables.map((v) => v.name).sort()).toEqual(['statusFilter', 'statusfilter']);
    });

    it('stays quiet when every read resolves', () => {
        const def = baseDef([decl('statusFilter')]);
        def.screens[0].sections[0].children = [
            { id: 'cmp_a', type: 'text', props: {}, computed: { text: { kind: 'formula', expr: 'vars.statusFilter' } } },
        ];
        const { container } = renderManager(def);
        expect(container.querySelector('[data-unknown-vars]')).toBeNull();
    });

    it('does not count vars.filters as unknown', () => {
        const def = baseDef([decl('a')]);
        def.screens[0].sections[0].children = [
            { id: 'cmp_a', type: 'text', props: {}, computed: { text: { kind: 'formula', expr: 'vars.filters.q' } } },
        ];
        const { container } = renderManager(def);
        expect(container.querySelector('[data-unknown-vars]')).toBeNull();
    });
});
