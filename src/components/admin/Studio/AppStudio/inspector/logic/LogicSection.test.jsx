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

describe('LogicSection', () => {
    it('editing "Only show when" commits node.visibleWhen', () => {
        const node = { id: 'cmp_b1', type: 'button', props: { label: 'Go' }, style: {} };
        const { onCommit, lastDef, getByPlaceholderText } = renderLogic(node);
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
