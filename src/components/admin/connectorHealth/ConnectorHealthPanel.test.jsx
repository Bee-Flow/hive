import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, fail } from '@/test/http';
import ConnectorHealthPanel from './ConnectorHealthPanel';
import { authFetch } from '../../../utils/helpers';

vi.mock('../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../../hooks/useTranslation', () => import('@/test/useTranslationMock'));
// The drawer mounts its own timeline fetch; stub it so this file stays about
// the fleet table. The drawer has its own colocated test.
vi.mock('./OrgHealthDrawer', () => ({
    default: ({ org }) => <div data-testid="org-drawer" data-org={org.id} />,
}));

const HEALTHY_ORG = {
    id: 'org-a', name: 'Acme BV', ncBaseUrl: 'https://nc.acme.nl', ncInstanceId: 'inst-a',
    ncProvisionedAt: '2026-06-01T00:00:00Z', ncLastSyncAt: '2026-07-20T08:00:00Z',
    health: 'ok', problems: [],
    users: { total: 10, active: 9, pending: 0 },
    messages30d: 42, messagesTotal: 900, lastMessageAt: '2026-07-22T10:00:00Z',
};
const BLOCKED_ORG = {
    id: 'org-b', name: 'Blokkade BV', ncBaseUrl: 'https://nc.blokkade.nl', ncInstanceId: 'inst-b',
    ncProvisionedAt: '2026-05-01T00:00:00Z', ncLastSyncAt: '2026-07-21T08:00:00Z',
    health: 'no_subscription',
    problems: [{
        code: 'chat.subscription_blocked', category: 'chat', severity: 'critical',
        message: 'Organisation has no active subscription', remediation: 'Assign a plan in the Subscriptions console',
        count: 12, firstSeenAt: '2026-07-01T00:00:00Z', lastSeenAt: '2026-07-22T09:00:00Z',
    }],
    users: { total: 5, active: 1, pending: 4 },
    messages30d: 0, messagesTotal: 0, lastMessageAt: null,
};
const FLEET = { generatedAt: '2026-07-23T00:00:00Z', orgs: [HEALTHY_ORG, BLOCKED_ORG] };

const mockFleet = (body = FLEET) => {
    authFetch.mockImplementation((url) => {
        if (String(url).includes('/connector-health/fleet')) return ok(body);
        return ok({ events: [], nextCursor: null });
    });
};

describe('ConnectorHealthPanel', () => {
    beforeEach(() => { cleanup(); authFetch.mockReset(); });

    it('renders fleet rows with status chips, worst-first, and no export button', async () => {
        mockFleet();
        render(<ConnectorHealthPanel />);
        expect(await screen.findByText('Blokkade BV')).toBeTruthy();
        expect(screen.getByText('Acme BV')).toBeTruthy();
        // Worst-first: the blocked org's row comes before the healthy one.
        const rows = screen.getAllByRole('row').slice(1); // drop header row
        expect(within(rows[0]).getByText('Blokkade BV')).toBeTruthy();
        expect(within(rows[0]).getByText('No subscription')).toBeTruthy();
        expect(within(rows[1]).getByText('Healthy')).toBeTruthy();
        // Top problem message surfaces in the row.
        expect(screen.getByText('Organisation has no active subscription')).toBeTruthy();
        // Project rule: no CSV/JSON export on audit/health dashboards.
        expect(screen.queryByText(/export/i)).toBeNull();
    });

    it('shows the rose blocked banner iff an org has an error/critical problem', async () => {
        mockFleet();
        render(<ConnectorHealthPanel />);
        expect(await screen.findByText('1 organisation(s) cannot send AI messages right now')).toBeTruthy();

        cleanup();
        authFetch.mockReset();
        mockFleet({ generatedAt: 'x', orgs: [HEALTHY_ORG] });
        render(<ConnectorHealthPanel />);
        await screen.findByText('Acme BV');
        expect(screen.queryByText(/cannot send AI messages right now/)).toBeNull();
    });

    it('narrows rows with the status filter pills', async () => {
        mockFleet();
        render(<ConnectorHealthPanel />);
        await screen.findByText('Blokkade BV');
        fireEvent.click(screen.getByTestId('ch-pill-ok'));
        expect(screen.queryByText('Blokkade BV')).toBeNull();
        expect(screen.getByText('Acme BV')).toBeTruthy();
        // Clicking the same pill again clears the filter.
        fireEvent.click(screen.getByTestId('ch-pill-ok'));
        expect(screen.getByText('Blokkade BV')).toBeTruthy();
    });

    it('narrows rows with the search box', async () => {
        mockFleet();
        render(<ConnectorHealthPanel />);
        await screen.findByText('Blokkade BV');
        fireEvent.change(screen.getByPlaceholderText('Search by name or URL…'), { target: { value: 'acme' } });
        expect(screen.queryByText('Blokkade BV')).toBeNull();
        expect(screen.getByText('Acme BV')).toBeTruthy();
    });

    it('shows a load-failed banner with a working Retry on failure', async () => {
        authFetch.mockImplementation(() => fail(500));
        render(<ConnectorHealthPanel />);
        expect(await screen.findByText('Failed to load connector health')).toBeTruthy();
        mockFleet();
        fireEvent.click(screen.getByText('Retry'));
        expect(await screen.findByText('Blokkade BV')).toBeTruthy();
        expect(screen.queryByText('Failed to load connector health')).toBeNull();
    });

    it('shows the empty state when there are no connected orgs', async () => {
        mockFleet({ generatedAt: 'x', orgs: [] });
        render(<ConnectorHealthPanel />);
        expect(await screen.findByText('No Nextcloud-connected organisations yet.')).toBeTruthy();
    });

    it('opens the drawer and navigates on row click', async () => {
        mockFleet();
        const onNavigate = vi.fn();
        render(<ConnectorHealthPanel onNavigate={onNavigate} />);
        fireEvent.click(await screen.findByText('Blokkade BV'));
        expect(onNavigate).toHaveBeenCalledWith('admin/security/connector-health/org-b');
        expect(screen.getByTestId('org-drawer').getAttribute('data-org')).toBe('org-b');
    });

    it('opens the drawer for initialOrgId (deep link drill-in)', async () => {
        mockFleet();
        render(<ConnectorHealthPanel initialOrgId="org-b" />);
        expect((await screen.findByTestId('org-drawer')).getAttribute('data-org')).toBe('org-b');
    });
});
