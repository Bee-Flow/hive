import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OrgHealthDrawer from './OrgHealthDrawer';

vi.mock('../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../../hooks/useTranslation', () => import('@/test/useTranslationMock'));
// The timeline fetches on mount and has its own colocated test.
vi.mock('./OrgEventTimeline', () => ({
    default: ({ orgId }) => <div data-testid="event-timeline" data-org={orgId} />,
}));

const ORG = {
    id: 'org-b', name: 'Blokkade BV', ncBaseUrl: 'https://nc.blokkade.nl',
    ncProvisionedAt: '2026-05-01T00:00:00Z', ncLastSyncAt: '2026-07-21T08:00:00Z',
    health: 'no_subscription',
    problems: [{
        code: 'chat.subscription_blocked', category: 'chat', severity: 'critical',
        message: 'Organisation has no active subscription', remediation: 'Assign a plan in the Subscriptions console',
        count: 12, firstSeenAt: '2026-07-01T00:00:00Z', lastSeenAt: '2026-07-22T09:00:00Z',
    }],
    users: { total: 5, active: 1, pending: 4 },
};

describe('OrgHealthDrawer', () => {
    beforeEach(() => cleanup());

    it('renders header, problem card, code chip and remediation block', () => {
        render(<OrgHealthDrawer org={ORG} onClose={() => {}} />);
        expect(screen.getByText('Blokkade BV')).toBeTruthy();
        expect(screen.getByText('https://nc.blokkade.nl')).toBeTruthy();
        expect(screen.getByText('chat.subscription_blocked')).toBeTruthy();
        expect(screen.getByText('Organisation has no active subscription')).toBeTruthy();
        expect(screen.getByText('How to fix')).toBeTruthy();
        expect(screen.getByText('Assign a plan in the Subscriptions console')).toBeTruthy();
        expect(screen.getByTestId('event-timeline').getAttribute('data-org')).toBe('org-b');
        // Privacy: no raw meta/JSON dumps in the drawer.
        expect(screen.queryByText(/\{"/)).toBeNull();
    });

    it('links chat.subscription_blocked to the subscriptions console', () => {
        const onNavigate = vi.fn();
        render(<OrgHealthDrawer org={ORG} onClose={() => {}} onNavigate={onNavigate} />);
        fireEvent.click(screen.getByText('Open subscriptions'));
        expect(onNavigate).toHaveBeenCalledWith('admin/subscriptions');
    });

    it('shows the no-problems empty state for a healthy org', () => {
        render(<OrgHealthDrawer org={{ ...ORG, health: 'ok', problems: [] }} onClose={() => {}} />);
        expect(screen.getByText('No open problems.')).toBeTruthy();
        expect(screen.queryByText('Open subscriptions')).toBeNull();
    });

    it('closes on backdrop click and on Escape', () => {
        const onClose = vi.fn();
        render(<OrgHealthDrawer org={ORG} onClose={onClose} />);
        fireEvent.click(screen.getByTestId('drawer-backdrop'));
        expect(onClose).toHaveBeenCalledTimes(1);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
