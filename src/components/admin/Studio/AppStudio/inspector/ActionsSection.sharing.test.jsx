import { render, fireEvent, screen, within } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import ActionsSection from './ActionsSection';
import { findNode } from '../state/definitionOps';

vi.mock('../../../../../hooks/useAutomationApi', () => ({
    default: () => ({ listAutomations: vi.fn(async () => ({ automations: [] })) }),
    safeText: vi.fn(async () => ''),
}));

/**
 * One action object can be wired to many components. These tests pin the
 * consequences the UI has to state out loud: which entries in the list are
 * already in use, that editing a shared one reaches the others, that "Only for
 * this one" stops that, and that deleting names what it breaks first.
 */

function button(id, label, extra = {}) {
    return { id, type: 'button', props: { label }, style: {}, ...extra };
}

function defWith(children, actions = {}) {
    return {
        schemaVersion: 2,
        meta: { name: 'T' },
        theme: {},
        homeScreenId: 'scr_t',
        screens: [{ id: 'scr_t', name: 'T', showInNav: true, maxWidth: 'medium', sections: [{ id: 'sec_t', style: {}, children }] }],
        actions,
    };
}

// The real inspector re-renders from the committed definition, so the harness
// does too — a fork/delete assertion is only meaningful on the next render.
function renderActions(definition, nodeId) {
    const onCommit = vi.fn();
    function Harness() {
        const [def, setDef] = useState(definition);
        return (
            <ActionsSection
                node={findNode(def, nodeId).node}
                definition={def}
                onCommit={(next) => { onCommit(next); setDef(next); }}
                disabled={false}
            />
        );
    }
    const utils = render(<Harness />);
    const lastDef = () => onCommit.mock.calls.at(-1)?.[0];
    return { onCommit, lastDef, ...utils };
}

const TOAST = { kind: 'toast', message: 'Saved', tone: 'success' };

describe('ActionsSection — shared actions', () => {
    it('offers a new action first and leaves the slot empty by default', () => {
        const def = defWith([button('cmp_a', 'A')]);
        const { getByRole } = renderActions(def, 'cmp_a');
        const select = getByRole('combobox', { name: 'Action for onClick' });
        expect(select.value).toBe('');
        expect(within(select).getByRole('option', { name: 'Choose what happens…' })).toBeTruthy();
        expect(within(select).getByRole('option', { name: 'New action…' })).toBeTruthy();
    });

    it('marks how many other components already run each listed action', () => {
        const def = defWith(
            [button('cmp_a', 'A'), button('cmp_b', 'B', { onClick: 'act_1' }), button('cmp_c', 'C', { onClick: 'act_1' })],
            { act_1: TOAST },
        );
        const { getByRole } = renderActions(def, 'cmp_a');
        const select = getByRole('combobox', { name: 'Action for onClick' });
        expect(within(select).getByRole('option', { name: /Show a message: “Saved” \(also used by 2 other components\)/ })).toBeTruthy();
    });

    it('says an action is shared, and by whom, above its editor', () => {
        const def = defWith(
            [button('cmp_a', 'Save', { onClick: 'act_1' }), button('cmp_b', 'Send', { onClick: 'act_1' })],
            { act_1: TOAST },
        );
        const { getByText } = renderActions(def, 'cmp_a');
        expect(getByText(/shared with 1 other component/i)).toBeTruthy();
        expect(getByText(/Button “Send”/)).toBeTruthy();
    });

    it('says nothing about sharing when only this component runs the action', () => {
        const def = defWith([button('cmp_a', 'Save', { onClick: 'act_1' })], { act_1: TOAST });
        const { queryByText } = renderActions(def, 'cmp_a');
        expect(queryByText(/shared with/i)).toBeNull();
    });

    it('"Only for this one" forks a copy and leaves the other component on the original', () => {
        const def = defWith(
            [button('cmp_a', 'Save', { onClick: 'act_1' }), button('cmp_b', 'Send', { onClick: 'act_1' })],
            { act_1: TOAST },
        );
        const { getByRole, lastDef, queryByText } = renderActions(def, 'cmp_a');
        fireEvent.click(getByRole('button', { name: /only for this one/i }));

        const next = lastDef();
        const forkedId = findNode(next, 'cmp_a').node.onClick;
        expect(forkedId).not.toBe('act_1');
        expect(next.actions[forkedId]).toEqual(TOAST);
        expect(next.actions.act_1).toEqual(TOAST);
        expect(findNode(next, 'cmp_b').node.onClick).toBe('act_1');
        // The copy is this component's alone, so the warning is gone.
        expect(queryByText(/shared with/i)).toBeNull();
    });

    it('editing a forked action no longer reaches the component it was shared with', () => {
        const def = defWith(
            [button('cmp_a', 'Save', { onClick: 'act_1' }), button('cmp_b', 'Send', { onClick: 'act_1' })],
            { act_1: TOAST },
        );
        const { getByRole, getByPlaceholderText, lastDef } = renderActions(def, 'cmp_a');
        fireEvent.click(getByRole('button', { name: /only for this one/i }));
        fireEvent.change(getByPlaceholderText(/what should the message say/i), { target: { value: 'Sent!' } });

        const next = lastDef();
        expect(next.actions.act_1.message).toBe('Saved');
        expect(next.actions[findNode(next, 'cmp_a').node.onClick].message).toBe('Sent!');
    });

    it('deletes a lone action without stopping to ask', () => {
        const def = defWith([button('cmp_a', 'Save', { onClick: 'act_1' })], { act_1: TOAST });
        const { getByRole, lastDef } = renderActions(def, 'cmp_a');
        fireEvent.click(getByRole('button', { name: /delete action/i }));
        expect(lastDef().actions.act_1).toBeUndefined();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('names the other components before deleting a shared action', () => {
        const def = defWith(
            [button('cmp_a', 'Save', { onClick: 'act_1' }), button('cmp_b', 'Send', { onClick: 'act_1' })],
            { act_1: TOAST },
        );
        const { getByRole, onCommit, lastDef } = renderActions(def, 'cmp_a');
        fireEvent.click(getByRole('button', { name: /delete action/i }));

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText(/stops happening on Button “Send”/i)).toBeTruthy();
        expect(onCommit).not.toHaveBeenCalled();

        fireEvent.click(within(dialog).getByRole('button', { name: /delete everywhere/i }));
        const next = lastDef();
        expect(next.actions.act_1).toBeUndefined();
        expect('onClick' in findNode(next, 'cmp_b').node).toBe(false);
    });

    it('warns about components that show what the action produced', () => {
        const def = defWith(
            [
                button('cmp_a', 'Save', { onClick: 'act_1' }),
                { id: 'cmp_t', type: 'text', props: { text: { kind: 'actionResult', actionId: 'act_1', path: 'summary' } }, style: {} },
            ],
            { act_1: TOAST },
        );
        const { getByRole } = renderActions(def, 'cmp_a');
        fireEvent.click(getByRole('button', { name: /delete action/i }));
        expect(within(screen.getByRole('dialog')).getByText(/will be left empty/i)).toBeTruthy();
    });

    it('cancelling the warning leaves the wiring alone', () => {
        const def = defWith(
            [button('cmp_a', 'Save', { onClick: 'act_1' }), button('cmp_b', 'Send', { onClick: 'act_1' })],
            { act_1: TOAST },
        );
        const { getByRole, onCommit } = renderActions(def, 'cmp_a');
        fireEvent.click(getByRole('button', { name: /delete action/i }));
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /cancel/i }));
        expect(onCommit).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
