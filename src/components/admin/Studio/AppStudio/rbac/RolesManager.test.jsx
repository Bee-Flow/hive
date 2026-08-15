import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./useAppRoles', () => ({ default: vi.fn(), useOrgDirectory: vi.fn() }));

import RolesManager, { describeRoleAccess } from './RolesManager';
import useAppRoles, { useOrgDirectory } from './useAppRoles';

let saveRoles; let assignMember; let removeMember;

const TABLES = [{
    id: 't1',
    key: 'absences',
    name: 'Absences',
    fields: [{ key: 'owner_id', type: 'text' }],
    access: { default: 'app', roles: {}, rowFilters: {} },
}];

const hookState = (over = {}) => ({
    roles: [{ key: 'member', label: 'Member' }],
    roleMapping: { default: 'app', byGroup: {} },
    members: [],
    tables: TABLES,
    isLoading: false,
    hasModel: true,
    saveRoles,
    assignMember,
    removeMember,
    savingRoles: false,
    savingMember: false,
    ...over,
});

beforeEach(() => {
    saveRoles = vi.fn().mockResolvedValue({});
    assignMember = vi.fn().mockResolvedValue({});
    removeMember = vi.fn().mockResolvedValue({});
    useAppRoles.mockReturnValue(hookState());
    useOrgDirectory.mockReturnValue({
        groups: [{ id: 'g1', name: 'Sales' }],
        users: [{ id: 'u1', displayName: 'Alice' }],
        isLoading: false,
        available: true,
    });
});

const emptyDef = { schemaVersion: 2, screens: [], actions: {} };

describe('RolesManager', () => {
    it('creates a role and persists it on save', async () => {
        const onCommit = vi.fn();
        const { getByText } = render(<RolesManager appId="a1" definition={emptyDef} onCommit={onCommit} />);
        fireEvent.click(getByText('Add role'));
        fireEvent.click(getByText('Save roles'));
        await waitFor(() => expect(saveRoles).toHaveBeenCalled());
        const [rolesArg] = saveRoles.mock.calls[0];
        expect(rolesArg).toHaveLength(2); // member + the new role
        // roles are mirrored into the definition for reference resolution
        await waitFor(() => expect(onCommit).toHaveBeenCalled());
        expect(Array.isArray(onCommit.mock.calls[0][0].roles)).toBe(true);
    });

    it('maps an organisation group to a role', async () => {
        const { getByLabelText, getByText } = render(<RolesManager appId="a1" definition={emptyDef} onCommit={() => {}} />);
        fireEvent.change(getByLabelText('Role for group Sales'), { target: { value: 'member' } });
        fireEvent.click(getByText('Save roles'));
        await waitFor(() => expect(saveRoles).toHaveBeenCalled());
        const [, mapping] = saveRoles.mock.calls[0];
        expect(mapping.byGroup).toEqual({ g1: 'member' });
    });

    it('assigns a specific person to a role', async () => {
        const { getByLabelText, getByText } = render(<RolesManager appId="a1" definition={emptyDef} onCommit={() => {}} />);
        fireEvent.change(getByLabelText('Person to assign'), { target: { value: 'u1' } });
        fireEvent.click(getByText('Assign'));
        await waitFor(() => expect(assignMember).toHaveBeenCalledWith('u1', 'member'));
    });

    it('persists "No access" as a blank default instead of collapsing to full access', async () => {
        const { getByLabelText, getByText } = render(<RolesManager appId="a1" definition={emptyDef} onCommit={() => {}} />);
        const select = getByLabelText('Default role');
        fireEvent.change(select, { target: { value: '__none__' } });
        fireEvent.click(getByText('Save roles'));
        await waitFor(() => expect(saveRoles).toHaveBeenCalled());
        const [, mapping] = saveRoles.mock.calls[0];
        expect(mapping.default).toBe('');
    });

    it('seeds the "No access" choice back from a blank saved default', () => {
        useAppRoles.mockReturnValue(hookState({ roleMapping: { default: '', byGroup: {} } }));
        const { getByLabelText } = render(<RolesManager appId="a1" definition={emptyDef} onCommit={() => {}} />);
        expect(getByLabelText('Default role').value).toBe('__none__');
    });

    it('spells out the live consequence of the default choice', () => {
        const { getByTestId, getByLabelText } = render(<RolesManager appId="a1" definition={emptyDef} onCommit={() => {}} />);
        expect(getByTestId('default-access-consequence').textContent)
            .toMatch(/can see, add and edit rows in Absences/i);
        fireEvent.change(getByLabelText('Default role'), { target: { value: '__none__' } });
        expect(getByTestId('default-access-consequence').textContent)
            .toMatch(/cannot open any of this app/i);
    });

    it('deleting the default role revokes access instead of promoting to full access', async () => {
        const { getByLabelText, getByText } = render(<RolesManager appId="a1" definition={emptyDef} onCommit={() => {}} />);
        fireEvent.change(getByLabelText('Default role'), { target: { value: 'member' } });
        fireEvent.click(getByLabelText('Delete role Member'));
        // The role is in use, so the consequence is confirmed first.
        fireEvent.click(getByText('Delete role'));
        fireEvent.click(getByText('Save roles'));
        await waitFor(() => expect(saveRoles).toHaveBeenCalled());
        const [rolesArg, mapping] = saveRoles.mock.calls[0];
        expect(rolesArg).toHaveLength(0);
        expect(mapping.default).toBe('');
    });

    it('does not recycle a deleted role key for a newly created role', () => {
        const { getByText, getByLabelText, queryByLabelText } = render(
            <RolesManager appId="a1" definition={emptyDef} onCommit={() => {}} />,
        );
        fireEvent.click(getByText('Add role'));
        expect(getByLabelText('Role name (role)')).toBeTruthy();
        fireEvent.click(getByLabelText('Delete role New role'));
        fireEvent.click(getByText('Add role'));
        expect(queryByLabelText('Role name (role)')).toBeNull();
        expect(getByLabelText('Role name (role_2)')).toBeTruthy();
    });

    it('does not reuse a key that still has members or row rules on the server', () => {
        useAppRoles.mockReturnValue(hookState({
            members: [{ userId: 'u1', roleKey: 'role' }],
            tables: [{ ...TABLES[0], access: { default: 'app', roles: {}, rowFilters: { role_2: 'record.owner_id == viewer.id' } } }],
        }));
        const { getByText, getByLabelText } = render(<RolesManager appId="a1" definition={emptyDef} onCommit={() => {}} />);
        fireEvent.click(getByText('Add role'));
        expect(getByLabelText('Role name (role_3)')).toBeTruthy();
    });

    it('blocks assigning a person to a role that has not been saved yet', () => {
        const { getByText, getByLabelText, getByTestId } = render(
            <RolesManager appId="a1" definition={emptyDef} onCommit={() => {}} />,
        );
        fireEvent.click(getByText('Add role'));
        fireEvent.change(getByLabelText('Person to assign'), { target: { value: 'u1' } });
        fireEvent.change(getByLabelText('Role to assign'), { target: { value: 'role' } });
        expect(getByTestId('member-role-unsaved').textContent).toMatch(/Save your roles first/i);
        expect(getByText('Assign').closest('button').disabled).toBe(true);
        expect(assignMember).not.toHaveBeenCalled();
    });
});

/**
 * The summary used to re-derive the gateway's resolution by hand, recognising
 * only a STRING read permission — so an entry of { read: true, create: true },
 * a shape normalizePerm handles and rowRuleModel.test.js pins, fell through to
 * the table's default. On a table defaulting to 'none' the panel then reported
 * no access at all for a role the gateway grants full read, and an owner
 * reading that would go and grant access that was already there.
 */
describe("describeRoleAccess — the gateway's resolution, in words", () => {
    const salaries = (access) => ({
        id: 't2', key: 'salaries', name: 'Salaries', fields: [], access,
    });

    it('reports the access a BOOLEAN permission actually grants', () => {
        // { read: true } normalises to 'all' — the shape rowRuleModel handles
        // and the gateway honours. The old resolution only recognised a STRING
        // and fell through to the table default, which here is 'none'.
        const tables = [salaries({ default: 'none', roles: { member: { read: true, create: true } }, rowFilters: {} })];
        expect(describeRoleAccess('member', tables)).toBe('can see, add and edit rows in Salaries');
    });

    it('reads a boolean false as no access, not as the default', () => {
        const tables = [salaries({ default: 'app', roles: { member: { read: false } }, rowFilters: {} })];
        expect(describeRoleAccess('member', tables)).toBe('cannot open any of this app’s data');
    });

    it('still reports genuinely absent access', () => {
        const tables = [salaries({ default: 'none', roles: {}, rowFilters: {} })];
        expect(describeRoleAccess('member', tables)).toBe('cannot open any of this app’s data');
    });

    it('still reports the ordinary string shapes', () => {
        const own = [salaries({ default: 'owner', roles: {}, rowFilters: {} })];
        expect(describeRoleAccess('member', own)).toBe('can add and see only their own rows in Salaries');
    });
});
