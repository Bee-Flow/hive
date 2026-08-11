import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ok, fail } from '@/test/http';
import OrgHealthBanner from './OrgHealthBanner';
import { authFetch } from '../../utils/helpers';

vi.mock('../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../hooks/useTranslation', () => import('@/test/useTranslationMock'));

describe('OrgHealthBanner', () => {
    beforeEach(() => { cleanup(); authFetch.mockReset(); });

    it('renders the amber pending-approval banner', async () => {
        authFetch.mockImplementation(() => ok({
            health: 'users_pending_approval',
            problems: [],
            users: { total: 8, active: 4, pending: 4 },
        }));
        render(<OrgHealthBanner />);
        expect(await screen.findByText('4 user(s) are waiting for approval and cannot use AI yet.')).toBeTruthy();
        expect(screen.getByText('Approve them in the member list below to unlock access.')).toBeTruthy();
        // No org-blocked banner without error/critical problems.
        expect(screen.queryByText(/AI chat is not available/)).toBeNull();
    });

    it('renders the rose org-blocked banner with soft wording and server-sanitized problem text', async () => {
        authFetch.mockImplementation(() => ok({
            health: 'no_subscription',
            problems: [{
                code: 'chat.subscription_blocked', severity: 'critical',
                message: 'AI chat has not been activated for your workspace.',
                remediation: 'Ask your Bee Flow contact to complete the setup.',
            }],
            users: { total: 8, active: 8, pending: 0 },
        }));
        render(<OrgHealthBanner />);
        expect(await screen.findByText('AI chat is not available for your organisation yet — a configuration step is still needed.')).toBeTruthy();
        expect(screen.getByText('AI chat has not been activated for your workspace.')).toBeTruthy();
        expect(screen.getByText('Ask your Bee Flow contact to complete the setup.')).toBeTruthy();
        // Soft wording only: never operator/billing internals in this surface.
        expect(screen.queryByText(/subscription/i)).toBeNull();
        expect(screen.queryByText(/billing/i)).toBeNull();
    });

    it('renders null when healthy', async () => {
        authFetch.mockImplementation(() => ok({ health: 'ok', problems: [], users: { total: 3, active: 3, pending: 0 } }));
        const { container } = render(<OrgHealthBanner />);
        await waitFor(() => expect(authFetch).toHaveBeenCalled());
        expect(container.innerHTML).toBe('');
    });

    it('renders null on 403 (non-connector org) — silent-fail contract', async () => {
        authFetch.mockImplementation(() => fail(403, { error: 'forbidden' }));
        const { container } = render(<OrgHealthBanner />);
        await waitFor(() => expect(authFetch).toHaveBeenCalled());
        expect(container.innerHTML).toBe('');
    });

    it('renders null on network error — silent-fail contract', async () => {
        authFetch.mockImplementation(() => Promise.reject(new Error('offline')));
        const { container } = render(<OrgHealthBanner />);
        await waitFor(() => expect(authFetch).toHaveBeenCalled());
        expect(container.innerHTML).toBe('');
    });

    it('renders null on a malformed body — silent-fail contract', async () => {
        authFetch.mockImplementation(() => Promise.resolve({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }));
        const { container } = render(<OrgHealthBanner />);
        await waitFor(() => expect(authFetch).toHaveBeenCalled());
        expect(container.innerHTML).toBe('');
    });

    it('renders null when unhealthy but with nothing actionable (no pending, no blocking problems)', async () => {
        authFetch.mockImplementation(() => ok({
            health: 'inactive',
            problems: [{ code: 'x', severity: 'info', message: 'informational' }],
            users: { total: 3, active: 3, pending: 0 },
        }));
        const { container } = render(<OrgHealthBanner />);
        await waitFor(() => expect(authFetch).toHaveBeenCalled());
        expect(container.innerHTML).toBe('');
    });
});
