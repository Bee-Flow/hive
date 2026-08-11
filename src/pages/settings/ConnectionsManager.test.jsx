import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ConnectionsManager from './ConnectionsManager';
import { authFetch } from '../../utils/helpers';

vi.mock('../../utils/helpers', () => ({
    API_BASE: '',
    authFetch: vi.fn(),
}));

// Mutable fixtures the authFetch mock serves; captured POST bodies for asserts.
let connections = [];
let posts = [];

function installFetchMock() {
    authFetch.mockImplementation(async (url, opts = {}) => {
        if (opts.method === 'POST') {
            posts.push(JSON.parse(opts.body));
            return { ok: true, status: 201, json: async () => ({ connection: { id: 'c-new' } }) };
        }
        if (String(url).includes('/grants')) return { ok: true, json: async () => ({ grants: [] }) };
        return { ok: true, json: async () => ({ connections }) };
    });
}

const openAddForm = async () => {
    fireEvent.click(await screen.findByText('Add a connection'));
    // Provider dropdown is the first combobox of the add form.
    const providerSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(providerSelect, { target: { value: 'http' } });
    return providerSelect;
};

const byPlaceholder = (ph) => screen.getByPlaceholderText(ph);

describe('ConnectionsManager — http provider', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        connections = [];
        posts = [];
        installFetchMock();
    });

    it('auth-type switch renders the per-type fields with secrets as password inputs', async () => {
        render(<ConnectionsManager />);
        await openAddForm();

        const authTypeSelect = screen.getByLabelText('Auth type');
        // Default: Bearer token — a single write-only secret field.
        expect(byPlaceholder('Token').type).toBe('password');

        fireEvent.change(authTypeSelect, { target: { value: 'header' } });
        expect(byPlaceholder('Header name (e.g. X-API-Key)').type).toBe('text');
        expect(byPlaceholder('Key value').type).toBe('password');

        fireEvent.change(authTypeSelect, { target: { value: 'basic' } });
        expect(byPlaceholder('Username').type).toBe('text');
        expect(byPlaceholder('Password').type).toBe('password');

        fireEvent.change(authTypeSelect, { target: { value: 'oauth2_cc' } });
        expect(byPlaceholder('Token URL').type).toBe('text');
        expect(byPlaceholder('Client ID').type).toBe('password');
        expect(byPlaceholder('Client secret').type).toBe('password');
        expect(byPlaceholder('Scopes (space-separated, optional)').type).toBe('text');
    });

    it('oauth2_cc submit splits values into secret vs secretMeta', async () => {
        render(<ConnectionsManager />);
        await openAddForm();
        fireEvent.change(screen.getByLabelText('Auth type'), { target: { value: 'oauth2_cc' } });

        fireEvent.change(byPlaceholder('Token URL'), { target: { value: 'https://auth.example.com/token' } });
        fireEvent.change(byPlaceholder('Client ID'), { target: { value: 'client-abc' } });
        fireEvent.change(byPlaceholder('Client secret'), { target: { value: 's3cr3t-value' } });
        fireEvent.change(byPlaceholder('Scopes (space-separated, optional)'), { target: { value: 'read write' } });
        fireEvent.click(screen.getByText('Create connection'));

        await waitFor(() => expect(posts.length).toBe(1));
        expect(posts[0].provider).toBe('http');
        expect(posts[0].kind).toBe('oauth2_cc');
        expect(posts[0].secret).toEqual({ client_id: 'client-abc', client_secret: 's3cr3t-value' });
        expect(posts[0].secretMeta).toEqual({ tokenUrl: 'https://auth.example.com/token', scope: 'read write' });
    });

    it('bearer submit sends the token as secret and omits secretMeta entirely', async () => {
        render(<ConnectionsManager />);
        await openAddForm();
        fireEvent.change(byPlaceholder('Token'), { target: { value: 'tok-123' } });
        fireEvent.click(screen.getByText('Create connection'));

        await waitFor(() => expect(posts.length).toBe(1));
        expect(posts[0].kind).toBe('bearer');
        expect(posts[0].secret).toEqual({ token: 'tok-123' });
        expect('secretMeta' in posts[0]).toBe(false);
    });

    it('requires all non-optional fields before posting', async () => {
        render(<ConnectionsManager />);
        await openAddForm();
        fireEvent.change(screen.getByLabelText('Auth type'), { target: { value: 'basic' } });
        fireEvent.change(byPlaceholder('Username'), { target: { value: 'svc-user' } });
        fireEvent.click(screen.getByText('Create connection')); // password missing
        expect(await screen.findByText('Fill in all required fields')).toBeTruthy();
        expect(posts.length).toBe(0);
    });

    it('cards show kind + display meta only — no secret values in the DOM', async () => {
        connections = [
            { id: 'c1', provider: 'http', label: 'Prod key', kind: 'api_key', isDefault: false, secretMeta: { headerName: 'X-API-Key' } },
            { id: 'c2', provider: 'http', label: 'Auth0 M2M', kind: 'oauth2_cc', isDefault: false, secretMeta: { tokenUrl: 'https://auth.example.com/token', clientIdHint: 'abcd…' } },
        ];
        const { container } = render(<ConnectionsManager />);
        expect(await screen.findByText('Prod key')).toBeTruthy();
        expect(screen.getByText('HTTP API (custom)')).toBeTruthy();
        expect(screen.getByText('API key (custom header) · X-API-Key')).toBeTruthy();
        expect(screen.getByText('OAuth2 (client credentials) · https://auth.example.com/token · client abcd…')).toBeTruthy();
        // The listing endpoint never returns secrets; make sure the card view
        // renders no input that could echo one either.
        expect(container.querySelectorAll('input[type="password"]').length).toBe(0);
    });

    it('the share panel warns that lending an http credential discloses its full power', async () => {
        connections = [
            { id: 'c1', provider: 'http', label: 'Prod key', kind: 'api_key', isDefault: false, secretMeta: { headerName: 'X-API-Key' } },
        ];
        render(<ConnectionsManager />);
        await screen.findByText('Prod key');
        fireEvent.click(screen.getByTitle('Share'));
        expect(screen.getByText('Sharing lends the full credential — recipients can call any URL with it.')).toBeTruthy();
    });
});

// Mutations used to ignore res.ok entirely: a rejected rename, set-default or
// delete looked like it had worked, and the row silently reverted on reload.
describe('ConnectionsManager — mutation failures are visible', () => {
    const oneConnection = () => ([
        { id: 'c1', provider: 'fireflies', label: 'Work key', kind: 'api_key', isDefault: false, secretMeta: {} },
    ]);

    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        connections = oneConnection();
        posts = [];
        installFetchMock();
    });

    it('shows the server error when set-default is rejected', async () => {
        authFetch.mockImplementation(async (url, opts = {}) => {
            if (opts.method === 'PATCH') return { ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) };
            if (String(url).includes('/grants')) return { ok: true, json: async () => ({ grants: [] }) };
            return { ok: true, json: async () => ({ connections }) };
        });
        render(<ConnectionsManager />);
        fireEvent.click(await screen.findByText('Set default'));
        expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
    });

    it('falls back to a readable message when the error body is empty', async () => {
        authFetch.mockImplementation(async (url, opts = {}) => {
            if (opts.method === 'PATCH') return { ok: false, status: 500, json: async () => { throw new Error('no body'); } };
            if (String(url).includes('/grants')) return { ok: true, json: async () => ({ grants: [] }) };
            return { ok: true, json: async () => ({ connections }) };
        });
        render(<ConnectionsManager />);
        fireEvent.click(await screen.findByText('Set default'));
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not set this as the default');
    });

    it('delete asks for confirmation and does nothing when declined', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        render(<ConnectionsManager />);
        await screen.findByText('Work key');
        const before = authFetch.mock.calls.length;
        fireEvent.click(screen.getByTitle('Delete'));
        expect(confirmSpy).toHaveBeenCalled();
        expect(authFetch.mock.calls.length).toBe(before); // no DELETE issued
        confirmSpy.mockRestore();
    });

    it('a 409 on delete asks a second time and does not force when declined', async () => {
        // First confirm (destructive) yes, second (revoke shares) no.
        const confirmSpy = vi.spyOn(window, 'confirm')
            .mockReturnValueOnce(true)
            .mockReturnValueOnce(false);
        const deleteUrls = [];
        authFetch.mockImplementation(async (url, opts = {}) => {
            if (opts.method === 'DELETE') {
                deleteUrls.push(String(url));
                return { ok: false, status: 409, json: async () => ({ error: 'Connection is shared' }) };
            }
            if (String(url).includes('/grants')) return { ok: true, json: async () => ({ grants: [] }) };
            return { ok: true, json: async () => ({ connections }) };
        });
        render(<ConnectionsManager />);
        await screen.findByText('Work key');
        fireEvent.click(screen.getByTitle('Delete'));
        await waitFor(() => expect(deleteUrls.length).toBe(1));
        expect(confirmSpy).toHaveBeenCalledTimes(2);
        expect(deleteUrls.some(u => u.includes('force=1'))).toBe(false);
        confirmSpy.mockRestore();
    });

    it('a failed list surfaces an error instead of claiming there are no connections', async () => {
        authFetch.mockImplementation(async (url) => {
            if (String(url).includes('/grants')) return { ok: true, json: async () => ({ grants: [] }) };
            return { ok: false, status: 500, json: async () => ({ error: 'Could not load connections' }) };
        });
        render(<ConnectionsManager />);
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not load connections');
        expect(screen.queryByText('No named connections yet.')).toBeNull();
    });

    it('shows the grantee email rather than a raw user id', async () => {
        authFetch.mockImplementation(async (url) => {
            if (String(url).includes('/grants')) {
                return {
                    ok: true,
                    json: async () => ({
                        grants: [{
                            id: 'g1', connection_id: 'c1', grantee_type: 'user',
                            grantee_id: '8f2c1e64-0000-4000-8000-000000000000',
                            grantee_label: 'sam@acme.test', expires_at: null,
                        }],
                    }),
                };
            }
            return { ok: true, json: async () => ({ connections }) };
        });
        render(<ConnectionsManager />);
        await screen.findByText('Work key');
        fireEvent.click(screen.getByTitle('Share'));
        expect(screen.getByText(/sam@acme\.test/)).toBeTruthy();
        expect(screen.queryByText(/8f2c1e64/)).toBeNull();
    });
});

// The panel shipped fully hardcoded in English inside an otherwise translated
// settings page. Every visible string must now resolve through t().
describe('ConnectionsManager — i18n', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        connections = [];
        posts = [];
        installFetchMock();
    });

    it('renders translated strings when the locale provides them', async () => {
        vi.resetModules();
        vi.doMock('../../hooks/useTranslation', () => ({
            useTranslation: () => ({
                t: (key, fallback) => (typeof fallback === 'string' ? `NL:${key}` : `NL:${key}`),
                locale: 'nl',
            }),
        }));
        const { default: Translated } = await import('./ConnectionsManager');
        render(<Translated />);
        // Title, description and the add button all go through t().
        expect(await screen.findByText('NL:connections.title')).toBeTruthy();
        expect(screen.getByText('NL:connections.description')).toBeTruthy();
        expect(screen.getByText(/NL:connections.add/)).toBeTruthy();
        vi.doUnmock('../../hooks/useTranslation');
        vi.resetModules();
    });
});
