import { createRequire } from 'node:module';
import { render, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import ActionsSection from './ActionsSection';
import { findNode } from '../state/definitionOps';

/**
 * Deleting an action and renaming a routine parameter — the two places where
 * the inspector used to leave the app in a state it could not save (a dangling
 * event reference) or silently destroy work (a mapping renamed onto another).
 */
const require = createRequire(import.meta.url);
const { canonicalizeAppDefinition } = require('../../../../../../../server/appStudio/canonicalize.js');
const { validateAppDefinition } = require('../../../../../../../server/appStudio/validate.js');

vi.mock('../../../../../hooks/useAutomationApi', () => ({
    default: () => ({ listAutomations: vi.fn(async () => ({ automations: [] })) }),
    safeText: vi.fn(async () => ''),
}));

function defWith(node, actions = {}) {
    return {
        schemaVersion: 2,
        meta: { name: 'T' },
        theme: {},
        homeScreenId: 'scr_act',
        screens: [{
            id: 'scr_act', name: 'T', showInNav: true, maxWidth: 'medium',
            sections: [{ id: 'sec_act', style: {}, children: [node] }],
        }],
        actions,
    };
}

function saveErrors(def) {
    const { def: canon } = canonicalizeAppDefinition(def);
    return validateAppDefinition(canon).errors;
}

/** ActionsSection is controlled by the shell — feed its commits back in. */
function Harness({ initial, nodeId, onCommit }) {
    const [definition, setDefinition] = useState(initial);
    return (
        <ActionsSection
            node={findNode(definition, nodeId).node}
            definition={definition}
            onCommit={(next) => { setDefinition(next); onCommit(next); }}
            disabled={false}
        />
    );
}

function renderActions(node, actions) {
    const onCommit = vi.fn();
    const utils = render(<Harness initial={defWith(node, actions)} nodeId={node.id} onCommit={onCommit} />);
    const lastDef = () => onCommit.mock.calls.at(-1)?.[0];
    return { onCommit, lastDef, ...utils };
}

const MAPPED_FORM = {
    id: 'cmp_form1', type: 'form', props: { name: 'f' }, style: {}, onSubmit: 'act1', children: [],
};
const MAPPED_ACTION = {
    act1: {
        kind: 'run_automation', automationId: 'auto1',
        inputMapping: { alpha: { kind: 'static', value: '1' }, beta: { kind: 'static', value: '2' } },
    },
};

describe('ActionsSection — deleting an action', () => {
    it('clears the grid/kanban/calendar event that pointed at it', () => {
        const node = { id: 'cmp_grid1', type: 'data_grid', props: {}, style: {}, onRowClick: 'act1' };
        const { lastDef, getByLabelText } = renderActions(node, { act1: { kind: 'toast', message: 'hi', tone: 'info' } });

        fireEvent.click(getByLabelText('Delete action'));
        const next = lastDef();
        expect(next.actions.act1).toBeUndefined();
        expect(findNode(next, 'cmp_grid1').node.onRowClick).toBeUndefined();
        expect(saveErrors(next)).toEqual([]);
    });

    it('a left-behind reference is invalid, and the server rewrites it away behind the app', () => {
        const dangling = defWith({ id: 'cmp_grid1', type: 'data_grid', props: {}, style: {}, onRowClick: 'act1' }, {});
        expect(validateAppDefinition(dangling).errors.some((e) => e.code === 'event.action_unresolved')).toBe(true);
        const { def: canon } = canonicalizeAppDefinition(dangling);
        expect(canon.screens[0].sections[0].children[0].onRowClick).toBeUndefined();
    });
});

describe('ActionsSection — renaming a routine parameter', () => {
    it('keeps focus in the field across a keystroke', () => {
        const { getAllByLabelText } = renderActions(MAPPED_FORM, MAPPED_ACTION);
        const field = getAllByLabelText('Parameter name')[0];
        field.focus();
        fireEvent.change(field, { target: { value: 'alphax' } });
        expect(document.activeElement).toBe(getAllByLabelText('Parameter name')[0]);
        expect(getAllByLabelText('Parameter name')[0].value).toBe('alphax');
    });

    it('commits the rename', () => {
        const { lastDef, getAllByLabelText } = renderActions(MAPPED_FORM, MAPPED_ACTION);
        fireEvent.change(getAllByLabelText('Parameter name')[0], { target: { value: 'alphax' } });
        expect(Object.keys(lastDef().actions.act1.inputMapping)).toEqual(['alphax', 'beta']);
    });

    it('refuses to rename onto another parameter instead of deleting it', () => {
        const { onCommit, getAllByLabelText, getByText } = renderActions(MAPPED_FORM, MAPPED_ACTION);
        fireEvent.change(getAllByLabelText('Parameter name')[0], { target: { value: 'beta' } });
        expect(onCommit).not.toHaveBeenCalled();
        expect(getByText(/already a parameter called/)).toBeTruthy();
    });
});
