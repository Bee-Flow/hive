import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok } from '@/test/http';
import OrgEventTimeline from './OrgEventTimeline';
import { authFetch } from '../../../utils/helpers';

vi.mock('../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../../hooks/useTranslation', () => import('@/test/useTranslationMock'));

const EVENTS = [
    {
        id: 'e1', code: 'chat.subscription_blocked', category: 'chat', severity: 'critical',
        actorKind: 'system', message: 'Chat blocked',
        meta: { reason: 'no_subscription', token: 'SECRET-XYZ' },
        createdAt: '2026-07-22T10:00:00Z',
    },
    {
        id: 'e2', code: 'auth.user_auto_provisioned', category: 'auth', severity: 'info',
        actorKind: 'connector', message: 'User provisioned',
        meta: { status: 'pending' },
        createdAt: '2026-07-22T09:00:00Z',
    },
];

describe('OrgEventTimeline', () => {
    beforeEach(() => { cleanup(); authFetch.mockReset(); });

    it('renders events with whitelisted meta only — never raw meta values', async () => {
        authFetch.mockImplementation(() => ok({ events: EVENTS, nextCursor: null }));
        render(<OrgEventTimeline orgId="org-b" />);
        expect(await screen.findByText('Chat blocked: subscription')).toBeTruthy();
        expect(screen.getByText('User auto-provisioned')).toBeTruthy();
        expect(screen.getByText(/reason: no_subscription/)).toBeTruthy();
        expect(screen.getByText(/status: pending/)).toBeTruthy();
        // Privacy: the non-whitelisted meta key never reaches the DOM.
        expect(screen.queryByText(/SECRET-XYZ/)).toBeNull();
        // Project rule: no export button.
        expect(screen.queryByText(/export/i)).toBeNull();
    });

    it('paginates with the cursor on "Load more"', async () => {
        authFetch.mockImplementation((url) => {
            if (String(url).includes('cursor=')) {
                return ok({ events: [{ id: 'e9', code: 'onboarding.completed', severity: 'info', meta: {}, createdAt: '2026-07-21T08:00:00Z' }], nextCursor: null });
            }
            return ok({ events: EVENTS, nextCursor: 'CUR1' });
        });
        render(<OrgEventTimeline orgId="org-b" />);
        fireEvent.click(await screen.findByText('Load more'));
        expect(await screen.findByText('Onboarding completed')).toBeTruthy();
        // Earlier events stay appended above the new page.
        expect(screen.getByText('Chat blocked: subscription')).toBeTruthy();
        const cursorCall = authFetch.mock.calls.find(([url]) => String(url).includes('cursor=CUR1'));
        expect(cursorCall).toBeTruthy();
        expect(String(cursorCall[0])).toContain('/auth/admin/connector-health/org-b/events');
    });

    it('refetches with the severity filter param', async () => {
        authFetch.mockImplementation(() => ok({ events: EVENTS, nextCursor: null }));
        render(<OrgEventTimeline orgId="org-b" />);
        await screen.findByText('Chat blocked: subscription');
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'error' } });
        await waitFor(() => {
            expect(authFetch.mock.calls.some(([url]) => String(url).includes('severity=error'))).toBe(true);
        });
    });

    it('shows the empty state when there are no events', async () => {
        authFetch.mockImplementation(() => ok({ events: [], nextCursor: null }));
        render(<OrgEventTimeline orgId="org-b" />);
        expect(await screen.findByText('No events recorded yet.')).toBeTruthy();
        expect(screen.queryByText('Load more')).toBeNull();
    });
});
