import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OrgUsersPanel from './OrgUsersPanel';
import { authFetch } from '../../utils/helpers';

/**
 * Parity harness for the member-list filter bar.
 *
 * OrgUsersPanel had the only working people filter in the product, so the
 * Security People directory reuses it rather than growing a second one. These
 * tests were written against the ORIGINAL inline implementation and must keep
 * passing, unchanged, after it is rewired onto hooks/useUserFilters.js +
 * components/admin/shared/UserFilterBar.jsx. That is the proof the extraction
 * is behaviour-preserving — the caller that already works stays working before
 * Security depends on the extracted parts.
 */

vi.mock('../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../hooks/useTranslation', () => ({
    useTranslation: () => ({
        // Mirrors the real t(): key, optional string fallback, optional params.
        t: (key, fallbackOrParams, maybeParams) => {
            const params = typeof fallbackOrParams === 'object' ? fallbackOrParams : maybeParams;
            if (params) return `${key}:${JSON.stringify(params)}`;
            return typeof fallbackOrParams === 'string' ? fallbackOrParams : key;
        },
    }),
}));
vi.mock('../../hooks/useUrlTab', () => ({ useUrlTab: () => ['users', vi.fn()] }));
vi.mock('./OrgCustomTiersPanel', () => ({ default: () => <div /> }));
vi.mock('./NextcloudSyncPanel', () => ({ default: () => <div /> }));

const jsonRes = (body, status = 200) => Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
});

const GROUPS = [
    { id: 'g_fin', name: 'Finance', organizationId: 'orgA', permissions: [], roles: [] },
    { id: 'g_sup', name: 'Support', organizationId: 'orgA', permissions: [], roles: [] },
];

// Jan is a direct member; Eva reaches orgA only through Finance; Piet is pending.
const USERS = [
    { id: 'u_jan', username: 'jan', displayName: 'Jan de Vries', email: 'jan@acme.nl', role: 'user', orgRole: 'org_admin', groups: ['g_fin'], organizationId: 'orgA', status: 'active' },
    { id: 'u_eva', username: 'eva', displayName: 'Eva Bakker', email: 'eva@acme.nl', role: 'user', orgRole: 'member', groups: ['g_fin'], organizationId: null, status: 'active' },
    { id: 'u_piet', username: 'piet', displayName: 'Piet Jansen', email: 'piet@acme.nl', role: 'user', orgRole: 'agent_admin', groups: ['g_sup'], organizationId: 'orgA', status: 'pending' },
];

const FIXTURES = {
    '/auth/users': USERS,
    '/auth/groups': GROUPS,
    '/auth/roles': [],
    '/auth/organizations': [{ id: 'orgA', name: 'Acme B.V.' }],
    '/auth/invitations': [],
};

const currentUser = { id: 'u_jan', organizationId: 'orgA', groups: ['g_fin'], permissions: ['org_admin'] };

const names = () => screen.getAllByText(/Jan de Vries|Eva Bakker|Piet Jansen/).map((n) => n.textContent);

describe('OrgUsersPanel — member filter bar', () => {
    beforeEach(() => {
        cleanup();
        authFetch.mockReset();
        authFetch.mockImplementation((url) => {
            const hit = Object.keys(FIXTURES).find((p) => url.startsWith(p));
            return jsonRes(hit ? FIXTURES[hit] : []);
        });
    });

    const renderPanel = async () => {
        render(<OrgUsersPanel user={currentUser} />);
        await screen.findByText('Jan de Vries');
    };

    it('lists every org member before any filter is applied', async () => {
        await renderPanel();
        expect(names()).toEqual(['Jan de Vries', 'Eva Bakker', 'Piet Jansen']);
    });

    it('filters by name', async () => {
        await renderPanel();
        fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), { target: { value: 'eva' } });
        await waitFor(() => expect(names()).toEqual(['Eva Bakker']));
    });

    it('filters by email, case-insensitively', async () => {
        await renderPanel();
        fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), { target: { value: 'PIET@ACME' } });
        await waitFor(() => expect(names()).toEqual(['Piet Jansen']));
    });

    it('filters by org role', async () => {
        await renderPanel();
        fireEvent.change(screen.getByDisplayValue('admin.org_all_roles'), { target: { value: 'org_admin' } });
        await waitFor(() => expect(names()).toEqual(['Jan de Vries']));
    });

    it('filters by group', async () => {
        await renderPanel();
        fireEvent.change(screen.getByDisplayValue('admin.org_all_groups'), { target: { value: 'g_sup' } });
        await waitFor(() => expect(names()).toEqual(['Piet Jansen']));
    });

    it('filters by status', async () => {
        await renderPanel();
        fireEvent.change(screen.getByDisplayValue('admin.org_all_statuses'), { target: { value: 'pending' } });
        await waitFor(() => expect(names()).toEqual(['Piet Jansen']));
    });

    it('composes filters rather than replacing them', async () => {
        await renderPanel();
        fireEvent.change(screen.getByDisplayValue('admin.org_all_groups'), { target: { value: 'g_fin' } });
        await waitFor(() => expect(names()).toEqual(['Jan de Vries', 'Eva Bakker']));
        fireEvent.change(screen.getByDisplayValue('admin.org_all_roles'), { target: { value: 'member' } });
        await waitFor(() => expect(names()).toEqual(['Eva Bakker']));
    });

    it('shows the filtered count against the total', async () => {
        await renderPanel();
        expect(screen.getByText('admin.org_showing_count:{"count":3,"total":3}')).toBeInTheDocument();
        fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), { target: { value: 'eva' } });
        await waitFor(() =>
            expect(screen.getByText('admin.org_showing_count:{"count":1,"total":3}')).toBeInTheDocument(),
        );
    });

    it('distinguishes "no matches" from "no users yet"', async () => {
        await renderPanel();
        fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), { target: { value: 'zzzz' } });
        expect(await screen.findByText('No users match the current filters.')).toBeInTheDocument();
        expect(screen.queryByText('No users yet')).not.toBeInTheDocument();
    });

    it('offers Clear only once a filter is active, and resets every axis', async () => {
        await renderPanel();
        expect(screen.queryByText('Clear')).not.toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), { target: { value: 'eva' } });
        fireEvent.change(screen.getByDisplayValue('admin.org_all_roles'), { target: { value: 'member' } });
        const clear = await screen.findByText('Clear');

        fireEvent.click(clear);
        await waitFor(() => expect(names()).toEqual(['Jan de Vries', 'Eva Bakker', 'Piet Jansen']));
        expect(screen.getByPlaceholderText('Search by name or email…')).toHaveValue('');
        expect(screen.queryByText('Clear')).not.toBeInTheDocument();
    });

    it('renders a colour-coded chip for a known org role', async () => {
        await renderPanel();
        const janRow = screen.getByText('Jan de Vries').closest('div.px-5');
        expect(within(janRow).getByText('Organisation Admin')).toBeInTheDocument();
    });
});
