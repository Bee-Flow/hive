import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ActionsSection from './ActionsSection';
import { findNode } from '../state/definitionOps';

vi.mock('../../../../../hooks/useAutomationApi', () => ({
    default: () => ({ listAutomations: vi.fn(async () => ({ automations: [] })) }),
    safeText: vi.fn(async () => ''),
}));

function defWith(node) {
    return {
        schemaVersion: 2,
        meta: { name: 'T' },
        theme: {},
        homeScreenId: 'scr_t',
        screens: [{ id: 'scr_t', name: 'T', showInNav: true, maxWidth: 'medium', sections: [{ id: 'sec_t', style: {}, children: [node] }] }],
        actions: {},
    };
}

function renderActions(node) {
    const definition = defWith(node);
    const onCommit = vi.fn();
    const utils = render(
        <ActionsSection node={node} definition={definition} onCommit={onCommit} disabled={false} />,
    );
    return { onCommit, definition, ...utils };
}

describe('ActionsSection — multi-event wiring', () => {
    it('renders one wiring row per event a data_grid supports', () => {
        const node = { id: 'cmp_grid1', type: 'data_grid', props: {}, style: {} };
        const { getByText, getByRole } = renderActions(node);
        expect(getByText('When a row is clicked')).toBeTruthy();
        expect(getByText('When a row is selected')).toBeTruthy();
        expect(getByRole('combobox', { name: 'Action for onRowClick' })).toBeTruthy();
        expect(getByRole('combobox', { name: 'Action for onRowSelect' })).toBeTruthy();
    });

    it('wiring a new action to onRowClick writes the event key on the node', () => {
        const node = { id: 'cmp_grid1', type: 'data_grid', props: {}, style: {} };
        const { onCommit, getByRole } = renderActions(node);
        fireEvent.change(getByRole('combobox', { name: 'Action for onRowClick' }), { target: { value: '__new' } });
        expect(onCommit).toHaveBeenCalled();
        const nextDef = onCommit.mock.calls.at(-1)[0];
        const wired = findNode(nextDef, 'cmp_grid1').node.onRowClick;
        expect(wired).toBeTruthy();
        // A run_automation action was created and bound to that id.
        expect(nextDef.actions[wired]?.kind).toBe('run_automation');
    });

    it('kanban exposes onCardMove wiring', () => {
        const node = { id: 'cmp_kan1', type: 'kanban', props: { groupByField: 'status' }, style: {} };
        const { getByText, getByRole } = renderActions(node);
        expect(getByText('When a card is moved')).toBeTruthy();
        expect(getByRole('combobox', { name: 'Action for onCardMove' })).toBeTruthy();
    });

    it('renders nothing for a type with no events', () => {
        const node = { id: 'cmp_h1', type: 'heading', props: { text: 'Hi' }, style: {} };
        const { container } = renderActions(node);
        expect(container.querySelector('select')).toBeNull();
    });
});
