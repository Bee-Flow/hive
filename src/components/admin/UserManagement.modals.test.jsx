import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserManagement from './UserManagement';
import { authFetch } from '../../utils/helpers';

/**
 * P2 coherence pass: the four hand-rolled modals were `fixed inset-0 z-50` divs
 * with no focus trap, no ESC handling and no focus restoration, and every
 * destructive action went through window.confirm() — unstyled, unthemeable,
 * blocking, and untestable.
 *
 * These tests pin the properties that replacement bought. They are the reason
 * the swap is safe to make in a 1200-line file with no prior coverage.
 */

vi.mock('../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../hooks/useTranslation', () => ({
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

const jsonRes = (body, status = 200) => Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
});

const JAN = { id: 'u_jan', username: 'jan', displayName: 'Jan de Vries', email: 'jan@acme.nl', orgRole: 'org_admin', organizationId: 'o1', groups: [], status: 'active' };

const FIXTURES = {
    '/auth/users': [JAN],
    '/auth/groups': [],
    '/auth/roles': [],
    '/auth/permissions': [],
    '/auth/organizations': [{ id: 'o1', name: 'Acme B.V.' }],
};

const fullAdmin = { id: 'me', permissions: ['all'], isAdmin: true, organizations: ['o1'] };

const renderPanel = async () => {
    render(<UserManagement user={fullAdmin} />);
    await screen.findByText('Jan de Vries');
};

describe('UserManagement — modals and confirmations', () => {
    beforeEach(() => {
        cleanup();
        authFetch.mockReset();
        authFetch.mockImplementation((url) => {
            const hit = Object.keys(FIXTURES).find((p) => url === p);
            return jsonRes(hit ? FIXTURES[hit] : {});
        });
    });

    it('opens the user modal as a real dialog', async () => {
        await renderPanel();
        fireEvent.click(screen.getByText('Add user'));
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('Add new user')).toBeInTheDocument();
    });

    it('closes the user modal on ESC — impossible with the old inline div', async () => {
        await renderPanel();
        fireEvent.click(screen.getByText('Add user'));
        expect(await screen.findByRole('dialog')).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('closes the user modal on Cancel', async () => {
        await renderPanel();
        fireEvent.click(screen.getByText('Add user'));
        const dialog = await screen.findByRole('dialog');
        fireEvent.click(within(dialog).getByText('Cancel'));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('moves focus into the dialog when it opens', async () => {
        await renderPanel();
        fireEvent.click(screen.getByText('Add user'));
        const dialog = await screen.findByRole('dialog');
        await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    });

    it('opens the edit modal seeded with the user', async () => {
        await renderPanel();
        fireEvent.click(screen.getByLabelText('Edit Jan de Vries'));
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('Edit user')).toBeInTheDocument();
        expect(within(dialog).getByDisplayValue('Jan de Vries')).toBeInTheDocument();
    });

    it('asks before deleting a user, and does nothing until confirmed', async () => {
        await renderPanel();
        fireEvent.click(screen.getByLabelText('Delete Jan de Vries'));

        expect(await screen.findByText('Delete this user?')).toBeInTheDocument();
        expect(authFetch.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    });

    it('cancelling the confirm leaves the user alone', async () => {
        await renderPanel();
        fireEvent.click(screen.getByLabelText('Delete Jan de Vries'));
        const dialog = await screen.findByRole('dialog');

        fireEvent.click(within(dialog).getByText('Cancel'));
        await waitFor(() => expect(screen.queryByText('Delete this user?')).not.toBeInTheDocument());
        expect(authFetch.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    });

    it('confirming the delete issues the DELETE', async () => {
        await renderPanel();
        fireEvent.click(screen.getByLabelText('Delete Jan de Vries'));
        const dialog = await screen.findByRole('dialog');

        fireEvent.click(within(dialog).getByText('Delete'));
        await waitFor(() =>
            expect(authFetch).toHaveBeenCalledWith('/auth/users/u_jan', expect.objectContaining({ method: 'DELETE' })),
        );
    });

    it('asks before resetting 2FA, naming the person', async () => {
        await renderPanel();
        fireEvent.click(screen.getByLabelText('Reset 2FA for Jan de Vries'));

        expect(await screen.findByText('Reset two-factor authentication?')).toBeInTheDocument();
        expect(screen.getByText(/Reset two-factor authentication for Jan de Vries\?/)).toBeInTheDocument();
        expect(authFetch.mock.calls.some(([url]) => String(url).includes('/mfa/reset'))).toBe(false);
    });

    it('confirming the 2FA reset posts to the reset endpoint', async () => {
        await renderPanel();
        fireEvent.click(screen.getByLabelText('Reset 2FA for Jan de Vries'));
        const dialog = await screen.findByRole('dialog');

        fireEvent.click(within(dialog).getByText('Reset 2FA'));
        await waitFor(() =>
            expect(authFetch).toHaveBeenCalledWith('/auth/users/u_jan/mfa/reset', expect.objectContaining({ method: 'POST' })),
        );
    });

    it('never falls back to window.confirm', async () => {
        // The whole point of the pass: a blocking native dialog cannot be themed,
        // cannot be translated by t(), and silently no-ops in some embedded views.
        const confirmSpy = vi.spyOn(window, 'confirm');
        await renderPanel();
        fireEvent.click(screen.getByLabelText('Delete Jan de Vries'));
        await screen.findByRole('dialog');
        expect(confirmSpy).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });
});
