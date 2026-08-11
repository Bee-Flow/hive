import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PeopleDirectory from './PeopleDirectory';

vi.mock('../../../../hooks/useTranslation', () => ({
    useTranslation: () => ({
        t: (key, fallbackOrParams, maybeParams) => {
            const fallback = typeof fallbackOrParams === 'string' ? fallbackOrParams : null;
            const params = typeof fallbackOrParams === 'object' ? fallbackOrParams : maybeParams;
            let out = fallback || key;
            if (params) for (const [k, v] of Object.entries(params)) out = out.replaceAll(`{${k}}`, String(v));
            return out;
        },
    }),
}));

const ORGS = [
    { id: 'orgA', name: 'Acme B.V.', status: 'active' },
    { id: 'orgB', name: 'Beta N.V.', status: 'suspended' },
];
const GROUPS = [
    { id: 'g_fin', name: 'Finance', organizationId: 'orgA' },
    { id: 'g_beta', name: 'Beta team', organizationId: 'orgB' },
    { id: 'g_glob', name: 'Everyone', organizationId: null },
];

const JAN = { id: 'u_jan', username: 'jan', displayName: 'Jan de Vries', email: 'jan@acme.nl', orgRole: 'org_admin', organizationId: 'orgA', groups: ['g_fin'], status: 'active' };
// Eva has NO organizationId — she reaches Acme only through Finance.
const EVA = { id: 'u_eva', username: 'eva', displayName: 'Eva Bakker', email: 'eva@acme.nl', orgRole: 'member', organizationId: null, groups: ['g_fin'], status: 'active' };
const MULTI = { id: 'u_multi', username: 'multi', displayName: 'Multi Org', email: 'm@acme.nl', orgRole: 'member', organizationId: 'orgA', groups: ['g_beta'], status: 'active' };
const LOOSE = { id: 'u_loose', username: 'loose', displayName: 'Loose Leaf', email: 'l@x.nl', orgRole: 'member', organizationId: '', groups: [], status: 'active' };
const SYSTEM = { id: 'admin', username: 'admin', displayName: 'Administrator (System)', role: 'admin', isSystem: true };

const renderDir = (props = {}) =>
    render(
        <PeopleDirectory
            users={[JAN, EVA, MULTI, LOOSE, SYSTEM]}
            groups={GROUPS}
            organizations={ORGS}
            canManageUsers
            {...props}
        />,
    );

// Section headers are <h3>. The org/group filter <option>s carry the same text,
// so these must be queried by role rather than by text.
const heading = (name) => screen.getByRole('heading', { name });

const rowNames = () => screen.queryAllByTestId('people-row').map((r) => within(r).getByText(/de Vries|Bakker|Multi Org|Loose Leaf/).textContent);

describe('PeopleDirectory', () => {
    beforeEach(cleanup);

    it('shows a skeleton while loading and no rows', () => {
        renderDir({ loading: true });
        expect(screen.getByTestId('user-list-skeleton')).toBeInTheDocument();
        expect(screen.queryAllByTestId('people-row')).toHaveLength(0);
    });

    it('groups people under their organisation by default', () => {
        renderDir();
        expect(heading('Acme B.V.')).toBeInTheDocument();
        expect(heading('Beta N.V.')).toBeInTheDocument();
    });

    // The trap, end-to-end: Eva has no organizationId at all.
    it('files a group-only member under their org, and Via=Direct removes them', () => {
        renderDir();
        expect(rowNames()).toContain('Eva Bakker');

        fireEvent.change(screen.getByLabelText('Any membership'), { target: { value: 'direct' } });
        expect(rowNames()).not.toContain('Eva Bakker');
        expect(rowNames()).toContain('Jan de Vries');

        fireEvent.change(screen.getByLabelText('Any membership'), { target: { value: 'group' } });
        expect(rowNames()).toContain('Eva Bakker');
    });

    it('lists a two-org person under both headers and says so in the footnote', () => {
        renderDir({ users: [MULTI] });
        expect(heading('Acme B.V.')).toBeInTheDocument();
        expect(heading('Beta N.V.')).toBeInTheDocument();
        expect(screen.getAllByTestId('people-row')).toHaveLength(2);
        expect(
            screen.getByText(/1 people belong to more than one organisation and are listed under each/),
        ).toBeInTheDocument();
    });

    it('omits the multi-org footnote when nobody is in two orgs', () => {
        renderDir({ users: [JAN] });
        expect(screen.queryByText(/belong to more than one organisation/)).not.toBeInTheDocument();
    });

    it('buckets people with no organisation instead of hiding them', () => {
        renderDir();
        expect(heading('No organisation')).toBeInTheDocument();
    });

    it('drops the synthetic system account', () => {
        renderDir();
        expect(screen.queryByText('Administrator (System)')).not.toBeInTheDocument();
    });

    it('flags a suspended organisation on its header', () => {
        renderDir();
        const betaHeader = heading('Beta N.V.').closest('button');
        expect(within(betaHeader).getByText('Suspended')).toBeInTheDocument();
        // Active is the norm and carries no chip.
        const acmeHeader = heading('Acme B.V.').closest('button');
        expect(within(acmeHeader).queryByText('Suspended')).not.toBeInTheDocument();
    });

    it('filters by search across name and email', () => {
        renderDir();
        fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), { target: { value: 'eva@' } });
        expect(rowNames()).toEqual(['Eva Bakker']);
    });

    it('filters by organisation', () => {
        renderDir();
        fireEvent.change(screen.getByLabelText('All organisations'), { target: { value: 'orgB' } });
        expect(rowNames()).toEqual(['Multi Org']);
    });

    it('filters to people with no organisation', () => {
        renderDir();
        fireEvent.change(screen.getByLabelText('All organisations'), { target: { value: '__none__' } });
        expect(rowNames()).toEqual(['Loose Leaf']);
    });

    it('regroups by group on demand, and a global group is marked as such', () => {
        renderDir({ users: [{ ...LOOSE, groups: ['g_glob'] }] });
        fireEvent.click(screen.getByText('By group'));
        expect(heading('Everyone')).toBeInTheDocument();
        expect(screen.getByText('Global')).toBeInTheDocument();
    });

    it('distinguishes "no people yet" from "no matches"', () => {
        cleanup();
        renderDir({ users: [SYSTEM] });
        expect(screen.getByText('No people yet')).toBeInTheDocument();
        expect(screen.queryByText('No people match the current filters')).not.toBeInTheDocument();

        cleanup();
        renderDir();
        fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), { target: { value: 'zzzz' } });
        expect(screen.getByText('No people match the current filters')).toBeInTheDocument();
        expect(screen.queryByText('No people yet')).not.toBeInTheDocument();
    });

    it('offers Clear once filtering and resets every axis', () => {
        renderDir();
        const before = rowNames().length;
        fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), { target: { value: 'eva' } });
        fireEvent.change(screen.getByLabelText('Any membership'), { target: { value: 'group' } });
        expect(rowNames().length).toBeLessThan(before);

        fireEvent.click(screen.getAllByText('Clear')[0]);
        expect(rowNames().length).toBe(before);
        expect(screen.getByPlaceholderText('Search by name or email…')).toHaveValue('');
    });

    it('reports the filtered count against the total', () => {
        renderDir();
        expect(screen.getByText('4 of 4 people')).toBeInTheDocument();
        fireEvent.change(screen.getByPlaceholderText('Search by name or email…'), { target: { value: 'eva' } });
        expect(screen.getByText('1 of 4 people')).toBeInTheDocument();
    });

    it('collapses and expands a section', () => {
        renderDir();
        const header = heading('Acme B.V.').closest('button');
        expect(header).toHaveAttribute('aria-expanded', 'true');
        fireEvent.click(header);
        expect(header).toHaveAttribute('aria-expanded', 'false');
        expect(rowNames()).not.toContain('Jan de Vries');
    });

    it('renders row actions without hover, with real labels', () => {
        renderDir();
        const janRow = screen.getByText('Jan de Vries').closest('[data-testid="people-row"]');
        expect(within(janRow).getByLabelText('Edit Jan de Vries')).toBeVisible();
        expect(within(janRow).getByLabelText('Reset 2FA for Jan de Vries')).toBeVisible();
        expect(within(janRow).getByLabelText('Delete Jan de Vries')).toBeVisible();
    });

    it('hides actions and Add user from a read-only viewer', () => {
        renderDir({ canManageUsers: false });
        const janRow = screen.getByText('Jan de Vries').closest('[data-testid="people-row"]');
        expect(within(janRow).queryAllByRole('button')).toHaveLength(0);
        expect(screen.queryByText('Add user')).not.toBeInTheDocument();
    });

    it('wires the row actions to their callbacks', () => {
        const onEditUser = vi.fn();
        const onResetMfa = vi.fn();
        const onDeleteUser = vi.fn();
        renderDir({ onEditUser, onResetMfa, onDeleteUser });

        fireEvent.click(screen.getByLabelText('Edit Jan de Vries'));
        fireEvent.click(screen.getByLabelText('Reset 2FA for Jan de Vries'));
        fireEvent.click(screen.getByLabelText('Delete Jan de Vries'));

        expect(onEditUser).toHaveBeenCalledWith(JAN);
        expect(onResetMfa).toHaveBeenCalledWith(JAN);
        expect(onDeleteUser).toHaveBeenCalledWith(JAN);
    });

    it('names each section for screen readers', () => {
        renderDir();
        expect(screen.getByRole('group', { name: /Acme B\.V\./ })).toBeInTheDocument();
    });
});
