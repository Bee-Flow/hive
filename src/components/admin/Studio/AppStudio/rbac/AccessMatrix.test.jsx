import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./useAppRoles', () => ({ default: vi.fn() }));

import AccessMatrix from './AccessMatrix';
import useAppRoles from './useAppRoles';
import { getVisibleToRoles } from '../state/definitionOps';

const definition = {
    schemaVersion: 2,
    homeScreenId: 'scr_a',
    screens: [{
        id: 'scr_a',
        name: 'Home',
        sections: [{
            id: 'sec_a',
            children: [{ id: 'cmp_h', type: 'heading', props: { text: 'Title', level: 2 }, style: { span: 12 } }],
        }],
    }],
    actions: {},
};

beforeEach(() => {
    useAppRoles.mockReturnValue({
        roles: [{ key: 'admin', label: 'Admin' }, { key: 'member', label: 'Member' }],
    });
});

describe('AccessMatrix', () => {
    it('starts every cell checked (empty gate = visible to all)', () => {
        const { getByLabelText } = render(<AccessMatrix appId="a1" definition={definition} onCommit={() => {}} />);
        expect(getByLabelText(/Title visible to Member/i).getAttribute('aria-checked')).toBe('true');
        expect(getByLabelText(/Home visible to Admin/i).getAttribute('aria-checked')).toBe('true');
    });

    it('unchecking a role writes an allow-list of the others into visibleToRoles', () => {
        const onCommit = vi.fn();
        const { getByLabelText } = render(<AccessMatrix appId="a1" definition={definition} onCommit={onCommit} />);
        fireEvent.click(getByLabelText(/Title visible to Member/i));
        expect(onCommit).toHaveBeenCalledTimes(1);
        const nextDef = onCommit.mock.calls[0][0];
        expect(getVisibleToRoles(nextDef, 'cmp_h')).toEqual(['admin']);
    });

    it('clearing the last role hides the item from everyone instead of re-showing it', () => {
        const onCommit = vi.fn();
        const { getByLabelText, rerender } = render(<AccessMatrix appId="a1" definition={definition} onCommit={onCommit} />);
        fireEvent.click(getByLabelText(/Title visible to Member/i));
        const oneRole = onCommit.mock.calls[0][0];

        rerender(<AccessMatrix appId="a1" definition={oneRole} onCommit={onCommit} />);
        fireEvent.click(getByLabelText(/Title visible to Admin/i));
        const noRole = onCommit.mock.calls[1][0];
        expect(getVisibleToRoles(noRole, 'cmp_h')).toEqual(['__nobody__']);

        // …and the grid reads back as "nobody", not "everyone".
        rerender(<AccessMatrix appId="a1" definition={noRole} onCommit={onCommit} />);
        expect(getByLabelText(/Title visible to Admin/i).getAttribute('aria-checked')).toBe('false');
        expect(getByLabelText(/Title visible to Member/i).getAttribute('aria-checked')).toBe('false');
    });

    it('re-checking a role from the "nobody" state drops the sentinel', () => {
        const onCommit = vi.fn();
        const hidden = structuredClone(definition);
        hidden.screens[0].sections[0].children[0].visibleToRoles = ['__nobody__'];
        const { getByLabelText } = render(<AccessMatrix appId="a1" definition={hidden} onCommit={onCommit} />);
        fireEvent.click(getByLabelText(/Title visible to Admin/i));
        expect(getVisibleToRoles(onCommit.mock.calls[0][0], 'cmp_h')).toEqual(['admin']);
    });

    it('shows an empty state when the app has no roles', () => {
        useAppRoles.mockReturnValue({ roles: [] });
        const { queryByTestId, getByText } = render(<AccessMatrix appId="a1" definition={definition} onCommit={() => {}} />);
        expect(queryByTestId('access-matrix')).toBeNull();
        expect(getByText(/No roles yet/i)).toBeTruthy();
    });
});
