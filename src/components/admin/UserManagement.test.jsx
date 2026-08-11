import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserManagement from './UserManagement';
import { authFetch } from '../../utils/helpers';

// UserManagement talks to the network through raw authFetch (not apiClient), so
// mocking utils/helpers is the single seam for the whole panel.
vi.mock('../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../hooks/useTranslation', () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

const jsonRes = (body, status = 200) => Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
});

const SYSTEM_ROW = {
    id: 'admin',
    username: 'admin',
    displayName: 'Administrator (System)',
    role: 'admin',
    isSystem: true,
};
const JAN = {
    id: 'u1',
    username: 'jan',
    displayName: 'Jan de Vries',
    email: 'jan@acme.nl',
    role: 'user',
    orgRole: 'org_admin',
    groups: ['g1'],
    organizationId: 'o1',
};

const FIXTURES = {
    '/auth/users': [SYSTEM_ROW, JAN],
    '/auth/groups': [{ id: 'g1', name: 'Finance', organizationId: 'o1', permissions: [], roles: [] }],
    '/auth/roles': [{ id: 'org_admin', name: 'Org admin', description: '', permissions: [] }],
    '/auth/permissions': [{ id: 'manage_users', name: 'Manage users', category: 'actions' }],
    '/auth/organizations': [
        { id: 'o1', name: 'Acme B.V.', description: 'Test org', registrationSource: 'nextcloud_connector' },
        { id: 'o2', name: 'Legacy Org', description: 'Pre-BFSF-286 org' }, // no registrationSource
    ],
};

const LIST_ENDPOINTS = Object.keys(FIXTURES);

const fullAdmin = { id: 'me', permissions: ['all'], isAdmin: true, organizations: ['o1'] };
const orgScoped = { id: 'me', permissions: ['page_chat'], isAdmin: false, organizations: ['o1'] };

describe('UserManagement', () => {
    beforeEach(() => {
        cleanup();
        authFetch.mockReset();
        authFetch.mockImplementation((url) => {
            const hit = LIST_ENDPOINTS.find((p) => url === p);
            return jsonRes(hit ? FIXTURES[hit] : {});
        });
    });

    it('fires the five list endpoints on mount', async () => {
        render(<UserManagement user={fullAdmin} />);
        await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(5));
        expect(authFetch.mock.calls.map(([url]) => url).sort()).toEqual([...LIST_ENDPOINTS].sort());
    });

    // Changed in P1: the old table rendered the synthetic 'admin' row
    // (adminRoutes.js:133-139) with its actions suppressed. PeopleDirectory drops
    // system rows entirely — it groups by organisation, and a system account has
    // none, so it would sit alone under "No organisation" forever.
    it('leaves the synthetic system admin row out of the directory', async () => {
        render(<UserManagement user={fullAdmin} />);
        await screen.findByText('Jan de Vries');
        expect(screen.queryByText('Administrator (System)')).not.toBeInTheDocument();
    });

    it('gives a real person the three row actions', async () => {
        render(<UserManagement user={fullAdmin} />);
        const janRow = (await screen.findByText('Jan de Vries')).closest('[data-testid="people-row"]');
        // edit / reset-2FA / delete — always rendered, not hover-revealed.
        expect(within(janRow).getAllByRole('button')).toHaveLength(3);
    });

    // t() is stubbed to the identity here, so assertions match the key rather
    // than the English copy.
    it('shows Add user to someone who can manage users', async () => {
        render(<UserManagement user={fullAdmin} />);
        expect(await screen.findAllByText('admin.sec_people_add')).not.toHaveLength(0);
    });

    it('hides Add user from someone who cannot manage users', async () => {
        render(<UserManagement user={orgScoped} />);
        await screen.findByText('Jan de Vries');
        expect(screen.queryByText('admin.sec_people_add')).not.toBeInTheDocument();
    });

    it('offers the full-admin section set to a full admin', async () => {
        render(<UserManagement user={fullAdmin} />);
        for (const key of ['users', 'organizations', 'nextcloud', 'groups', 'roles', 'permissions']) {
            expect(await screen.findByText(`admin.users_tab_${key}`)).toBeInTheDocument();
        }
        expect(screen.queryByText('admin.users_tab_my_org')).not.toBeInTheDocument();
    });

    it('offers the org-scoped section set to an org-scoped user', async () => {
        render(<UserManagement user={orgScoped} />);
        expect(await screen.findByText('admin.users_tab_users')).toBeInTheDocument();
        expect(screen.getByText('admin.users_tab_groups')).toBeInTheDocument();
        expect(screen.getByText('admin.users_tab_my_org')).toBeInTheDocument();
        expect(screen.queryByText('admin.users_tab_roles')).not.toBeInTheDocument();
        expect(screen.queryByText('admin.users_tab_organizations')).not.toBeInTheDocument();
    });

    it('navigates on section switch instead of holding local tab state', async () => {
        const onNavigate = vi.fn();
        render(<UserManagement user={fullAdmin} onNavigate={onNavigate} />);
        fireEvent.click(await screen.findByText('admin.users_tab_groups'));
        expect(onNavigate).toHaveBeenCalledWith('admin/security/users/groups');
    });

    it('falls back to the users section for an unknown activeSection', async () => {
        render(<UserManagement user={fullAdmin} activeSection="nope" />);
        expect(await screen.findByText('admin.sec_people_title')).toBeInTheDocument();
    });

    // Regression: the my-organization form used to be seeded by a
    // `setTimeout(() => setOrgData(editData), 0)` called from inside the render
    // path, which re-fired on every render until the state landed.
    it('seeds the my-organization form from the caller org, without a render-time side effect', async () => {
        render(<UserManagement user={orgScoped} activeSection="my-organization" />);
        expect(await screen.findByDisplayValue('Acme B.V.')).toBeInTheDocument();
    });

    // BFSF-286: every org card shows its registration source; orgs from before
    // the backfill (no registrationSource) surface as "unknown" instead of
    // being silently mislabelled. Connector orgs also name their terms channel.
    it('labels each organization with its registration source', async () => {
        render(<UserManagement user={fullAdmin} activeSection="organizations" />);
        await screen.findByText('Acme B.V.');
        expect(screen.getAllByText(/admin\.org_source_label/)).toHaveLength(2);
        expect(screen.getByText(/admin\.org_source_nextcloud_connector/)).toBeInTheDocument();
        expect(screen.getByText(/admin\.org_source_unknown/)).toBeInTheDocument();
        expect(screen.getByText(/admin\.org_terms_channel_connector/)).toBeInTheDocument();
    });

    it('reports a load failure rather than rendering an empty table', async () => {
        authFetch.mockReset();
        authFetch.mockRejectedValue(new Error('offline'));
        render(<UserManagement user={fullAdmin} />);
        expect(await screen.findByText('Failed to load data. Ensure you are admin.')).toBeInTheDocument();
    });
});
