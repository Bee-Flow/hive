import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

/**
 * WebpageAppsPanel — the IDE "Apps & data" pane. authFetch and the automation
 * API hook are mocked; the catalog/grants fixtures mirror the server contracts
 * (routes/webpagesGrants.js + routes/automation/catalog.js).
 */

const CATALOG = {
    apps: [
        {
            id: 'gmail', label: 'Gmail', available: true,
            actions: [{ name: 'gmail_search', label: 'gmail search', integrationId: 'gmail' }],
        },
        {
            id: 'youtrack', label: 'YouTrack', available: false,
            actions: [{ name: 'youtrack_get_issue', label: 'youtrack get issue', integrationId: 'youtrack' }],
        },
    ],
};

const GRANTS = {
    ai: { enabled: true },
    integrations: [
        { tool: 'gmail_search', label: null, hasFixedArgs: true, integrationId: 'gmail', integrationLabel: 'Gmail', available: true },
        { tool: 'slack_post', label: 'Team ping', hasFixedArgs: false, integrationId: 'slack', integrationLabel: 'Slack', available: false },
    ],
    automations: [{ automationId: 'auto-1', label: 'Nightly sync' }],
    discoveryFailed: false,
};

const authFetch = vi.fn();
vi.mock('../../utils/helpers', () => ({
    API_BASE: 'https://host.example',
    authFetch: (...args) => authFetch(...args),
}));

const getCatalog = vi.fn(async () => CATALOG);
const listAutomations = vi.fn(async () => ({ automations: [{ id: 'auto-2', title: 'Weekly report' }] }));
vi.mock('../../hooks/useAutomationApi', () => ({
    default: () => ({ getCatalog, listAutomations }),
}));

import WebpageAppsPanel from './WebpageAppsPanel';

function grantsResponse(body = GRANTS, ok = true, status = 200) {
    return { ok, status, json: async () => body };
}

beforeEach(() => {
    authFetch.mockReset();
    getCatalog.mockClear();
    listAutomations.mockClear();
    authFetch.mockImplementation(async (url) => {
        if (String(url).includes('/grants')) return grantsResponse();
        throw new Error(`unexpected fetch: ${url}`);
    });
});

describe('WebpageAppsPanel', () => {
    it('lists granted apps with their live status and routines', async () => {
        render(<WebpageAppsPanel webpageId="wp1" />);
        await waitFor(() => expect(screen.getByText('gmail search')).toBeTruthy());
        expect(screen.getByText('Connected')).toBeTruthy();
        expect(screen.getByText('Needs reconnect')).toBeTruthy();
        expect(screen.getByText('Team ping')).toBeTruthy();
        expect(screen.getByText('Nightly sync')).toBeTruthy();
    });

    it('offers a reconnect deep link (with return URL) for a disconnected grant', async () => {
        render(<WebpageAppsPanel webpageId="wp1" />);
        const link = await screen.findByRole('link', { name: 'Reconnect' });
        expect(link.getAttribute('href')).toBe(
            '/app/settings/integrations?return=%2Fapp%2Fstudio%2Fwebpages%2Fwp1',
        );
    });

    it('revokes an integration grant via DELETE', async () => {
        render(<WebpageAppsPanel webpageId="wp1" />);
        const btn = await screen.findByRole('button', { name: 'Remove gmail_search' });
        fireEvent.click(btn);
        await waitFor(() => expect(authFetch).toHaveBeenCalledWith(
            'https://host.example/api/webpages/wp1/grants/integrations/gmail_search',
            { method: 'DELETE' },
        ));
    });

    it('greys out unconnected apps in the picker and points at Settings', async () => {
        render(<WebpageAppsPanel webpageId="wp1" />);
        fireEvent.click(await screen.findByRole('button', { name: /Add an app/ }));
        const appSelect = await screen.findByLabelText('App');
        const youtrackOption = [...appSelect.options].find(o => o.value === 'youtrack');
        expect(youtrackOption.disabled).toBe(true);
        // Select it anyway (programmatically) → the inline connect guidance appears.
        fireEvent.change(appSelect, { target: { value: 'youtrack' } });
        const link = await screen.findByRole('link', { name: /Connect it in Settings → Integrations/ });
        expect(link.getAttribute('href')).toContain('/app/settings/integrations?return=');
    });

    it('grants a connected app action via POST', async () => {
        render(<WebpageAppsPanel webpageId="wp1" />);
        fireEvent.click(await screen.findByRole('button', { name: /Add an app/ }));
        fireEvent.change(await screen.findByLabelText('App'), { target: { value: 'gmail' } });
        fireEvent.change(await screen.findByLabelText('Action'), { target: { value: 'gmail_search' } });
        fireEvent.click(screen.getByRole('button', { name: /Add to page/ }));
        await waitFor(() => expect(authFetch).toHaveBeenCalledWith(
            'https://host.example/api/webpages/wp1/grants/integrations',
            expect.objectContaining({ method: 'POST' }),
        ));
        const body = JSON.parse(authFetch.mock.calls.find(c => String(c[0]).endsWith('/integrations'))[1].body);
        expect(body).toEqual({ tool: 'gmail_search' });
    });

    it('surfaces the server connection_required error when the grant is refused', async () => {
        authFetch.mockImplementation(async (url, opts) => {
            if (opts?.method === 'POST') {
                return { ok: false, status: 409, json: async () => ({ error: 'Connect YouTrack first.', code: 'connection_required', provider: 'youtrack' }) };
            }
            return grantsResponse();
        });
        render(<WebpageAppsPanel webpageId="wp1" />);
        fireEvent.click(await screen.findByRole('button', { name: /Add an app/ }));
        fireEvent.change(await screen.findByLabelText('App'), { target: { value: 'gmail' } });
        fireEvent.change(await screen.findByLabelText('Action'), { target: { value: 'gmail_search' } });
        fireEvent.click(screen.getByRole('button', { name: /Add to page/ }));
        await waitFor(() => expect(screen.getByText('Connect YouTrack first.')).toBeTruthy());
        expect(screen.getByRole('link', { name: 'Reconnect it' }).getAttribute('href')).toContain('/app/settings/integrations');
    });

    it('renders the owner-only note for read-only viewers', () => {
        render(<WebpageAppsPanel webpageId="wp1" readOnly />);
        expect(screen.getByText(/Only the page owner/)).toBeTruthy();
        expect(authFetch).not.toHaveBeenCalled();
    });
});
