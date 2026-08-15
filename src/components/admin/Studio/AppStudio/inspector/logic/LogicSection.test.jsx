import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LogicSection from './LogicSection';
import { findNode } from '../../state/definitionOps';

vi.mock('../../studioAppsApi', () => ({
    studioAppsApi: { getCatalog: vi.fn(async () => ({ components: {} })) },
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

function renderLogic(node) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const definition = defWith(node);
    const onCommit = vi.fn();
    const utils = render(
        <QueryClientProvider client={client}>
            <LogicSection node={node} definition={definition} onCommit={onCommit} disabled={false} />
        </QueryClientProvider>,
    );
    const lastDef = () => onCommit.mock.calls.at(-1)?.[0];
    return { onCommit, lastDef, definition, ...utils };
}

/**
 * Where a boolean is wanted these fields OPEN on the clickable condition
 * builder, so a test that wants the raw box has to ask for it — the same click
 * a formula-writing author makes.
 */
function writeAllAsFormula(utils) {
    for (let links = utils.queryAllByText('Write a formula'); links.length; links = utils.queryAllByText('Write a formula')) {
        fireEvent.click(links[0]);
    }
}

describe('LogicSection', () => {
    it('offers "Only show when" as a clickable condition, not a code box', () => {
        const node = { id: 'cmp_b1', type: 'button', props: { label: 'Go' }, style: {} };
        const { queryByPlaceholderText, getAllByText } = renderLogic(node);
        expect(queryByPlaceholderText("e.g. form.priority == 'high'")).toBeNull();
        // Two of them — "Only show when" and "Enabled when" — each with the
        // escape to a formula still one click away.
        expect(getAllByText('Write a formula').length).toBe(2);
    });

    it('editing "Only show when" commits node.visibleWhen', () => {
        const node = { id: 'cmp_b1', type: 'button', props: { label: 'Go' }, style: {} };
        const utils = renderLogic(node);
        const { onCommit, lastDef, getByPlaceholderText } = utils;
        writeAllAsFormula(utils);
        const field = getByPlaceholderText("e.g. form.priority == 'high'");
        fireEvent.change(field, { target: { value: 'form.ok == true' } });
        expect(onCommit).toHaveBeenCalled();
        expect(findNode(lastDef(), 'cmp_b1').node.visibleWhen).toEqual({ kind: 'formula', expr: 'form.ok == true' });
    });

    it('shows the validation editor only for input components', () => {
        const inputNode = { id: 'cmp_i1', type: 'input_text', props: { name: 'email' }, style: {} };
        const first = renderLogic(inputNode);
        expect(first.getByText('Validation')).toBeTruthy();
        expect(first.getByText('Computed values')).toBeTruthy();
        first.unmount();

        const buttonNode = { id: 'cmp_b1', type: 'button', props: { label: 'Go' }, style: {} };
        const { queryByText } = renderLogic(buttonNode);
        expect(queryByText('Validation')).toBeNull();
    });

    it('toggling Visible off commits visible:false', () => {
        const node = { id: 'cmp_b1', type: 'button', props: { label: 'Go' }, style: {} };
        const { lastDef, getAllByRole } = renderLogic(node);
        // The Visible toggle is the section's first (and only) checkbox.
        fireEvent.click(getAllByRole('checkbox')[0]);
        expect(findNode(lastDef(), 'cmp_b1').node.visible).toBe(false);
    });
});
