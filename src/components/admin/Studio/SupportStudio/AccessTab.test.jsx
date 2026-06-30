import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import AccessTab from './AccessTab';
import { authFetch } from '../../../../utils/helpers';

vi.mock('../../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../../../hooks/useTranslation', () => ({
    default: () => ({ t: (_k, fallback) => fallback || _k }),
}));

const ok = (body) => Promise.resolve({ ok: true, json: async () => body });
const INBOX = { id: 'i1', organization_id: 'org1' };
const ADMIN = { isAdmin: true };

describe('AccessTab', () => {
    beforeEach(() => { cleanup(); authFetch.mockReset(); vi.useRealTimers(); });

    function mockAccess(over = {}) {
        authFetch.mockImplementation((url, opts) => {
            if (String(url).endsWith('/access') && (!opts || opts.method !== 'PUT')) {
                return ok({ mode: 'everyone', sharedGroups: [], availableGroups: [{ id: 'g1', name: 'Tier-1' }, { id: 'g2', name: 'Billing' }], resolvedMembers: [{ id: 'u1', name: 'Ana' }], ...over });
            }
            // PUT /access
            return ok({ mode: 'groups', sharedGroups: ['g1'], resolvedMembers: [{ id: 'u1', name: 'Ana' }] });
        });
    }

    it('defaults to "Everyone" and hides group chips', async () => {
        mockAccess();
        render(<AccessTab inbox={INBOX} user={ADMIN} />);
        expect(await screen.findByText('Everyone with support access')).toBeTruthy();
        expect(screen.queryByText('Tier-1')).toBeNull();
    });

    it('reveals group chips after switching to "Restricted"', async () => {
        mockAccess();
        render(<AccessTab inbox={INBOX} user={ADMIN} />);
        fireEvent.click(await screen.findByText('Restricted to specific groups'));
        expect(await screen.findByText('Tier-1')).toBeTruthy();
        expect(screen.getByText('Billing')).toBeTruthy();
    });

    it('autosaves selected groups via PUT', async () => {
        mockAccess();
        render(<AccessTab inbox={INBOX} user={ADMIN} />);
        fireEvent.click(await screen.findByText('Restricted to specific groups'));
        fireEvent.click(await screen.findByText('Tier-1'));
        // Debounced autosave (700ms) — wait for the PUT to fire.
        await waitFor(() => {
            const putCall = authFetch.mock.calls.find(([url, opts]) => opts && opts.method === 'PUT');
            expect(putCall).toBeTruthy();
            expect(JSON.parse(putCall[1].body)).toEqual({ sharedGroups: ['g1'] });
        }, { timeout: 2000 });
    });

    it('is read-only for non-admins', async () => {
        mockAccess();
        render(<AccessTab inbox={INBOX} user={{ role: 'user', permissions: [] }} />);
        expect(await screen.findByText('Only an organisation admin can change inbox access.')).toBeTruthy();
    });
});
