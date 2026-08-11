import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// t() interpolates so price/awaiting labels are assertable by their key prefix.
const t = (key, a, b) => {
    const params = (a && typeof a === 'object') ? a : (b && typeof b === 'object' ? b : null);
    return params ? `${key} ${Object.values(params).join(' ')}` : key;
};

vi.mock('../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t, locale: 'en' }) }));
vi.mock('../../EntitlementsContext', () => ({ useEntitlements: () => ({ tier: 'enterprise' }) }));
vi.mock('../../../moduleRuntime/registry', () => ({ reloadRemoteModules: vi.fn() }));

import { authFetch } from '../../../utils/helpers';
import MarketplaceTab from './MarketplaceTab';

const jsonRes = (body, status = 200) => Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
});

const paidModule = (over = {}) => ({
    id: 'pro',
    name: 'Pro Module',
    description: 'A paid module.',
    category: 'ops',
    icon: 'gauge',
    latestVersion: '1.0.0',
    // Server-derived typed pricing (v3.1 shape).
    pricing: { type: 'subscription', amount: 900, currency: 'EUR', interval: 'month' },
    entitled: false,
    installed: false,
    updateAvailable: false,
    status: 'available',
    ...over,
});

const renderTab = (extraProps = {}) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
        <QueryClientProvider client={qc}>
            <MarketplaceTab flash={vi.fn()} reloadEntitlements={vi.fn()} {...extraProps} />
        </QueryClientProvider>,
    );
};

describe('MarketplaceTab', () => {
    beforeEach(() => {
        cleanup();
        authFetch.mockReset();
        vi.stubGlobal('open', vi.fn());
        // Reset the jsdom URL — the Checkout-return tests mutate it.
        window.history.replaceState(null, '', '/');
    });
    afterEach(() => vi.unstubAllGlobals());

    it('shows the connect banner when the install is not connected', async () => {
        authFetch.mockImplementation((url) => {
            if (String(url).includes('/marketplace')) return jsonRes({ connected: false, modules: [] });
            return jsonRes({});
        });
        renderTab();
        expect(await screen.findByTestId('connect-hub-banner')).toBeInTheDocument();

        // Connect CTA opens the confirm dialog (its Cancel button is unique to it).
        fireEvent.click(screen.getByText('modules.connect_cta'));
        expect(screen.getByText('modules.cancel')).toBeInTheDocument();
    });

    it('surfaces a hub_unavailable (502) as a red banner', async () => {
        authFetch.mockImplementation((url) => {
            if (String(url).includes('/marketplace')) return jsonRes({ error: 'hub_unavailable', detail: 'timeout' }, 502);
            return jsonRes({});
        });
        renderTab();
        expect(await screen.findByTestId('marketplace-hub-unavailable')).toBeInTheDocument();
    });

    it('renders a price badge for a paid module', async () => {
        authFetch.mockImplementation((url) => {
            if (String(url).includes('/marketplace')) {
                return jsonRes({ connected: true, hubUrl: 'https://hub.beeflow.nl', modules: [paidModule()], nextCursor: null });
            }
            return jsonRes({});
        });
        renderTab();
        expect(await screen.findByText(/modules\.price_per_month/)).toBeInTheDocument();
        expect(screen.getByText(/modules\.connected_to/)).toBeInTheDocument();
    });

    it('buys → awaiting payment → I-have-paid refresh → entitled Install', async () => {
        let entitled = false;
        let purchaseBody = null;
        authFetch.mockImplementation((url, init = {}) => {
            const u = String(url);
            const m = init.method || 'GET';
            if (u.includes('/marketplace')) {
                return jsonRes({
                    connected: true,
                    hubUrl: 'https://hub.beeflow.nl',
                    modules: [paidModule({ entitled, status: entitled ? 'entitled' : 'available' })],
                    nextCursor: null,
                });
            }
            if (m === 'POST' && u.endsWith('/pro/purchase')) {
                purchaseBody = JSON.parse(init.body);
                return jsonRes({ ok: true, checkoutUrl: 'https://checkout.stripe/x', purchaseId: 'p1', status: 'pending' });
            }
            if (m === 'POST' && u.endsWith('/entitlements/refresh')) {
                entitled = true;
                return jsonRes({ ok: true, entitledModuleIds: ['pro'] });
            }
            return jsonRes({});
        });
        renderTab();

        // Buy → opens Checkout, flips to awaiting.
        fireEvent.click(await screen.findByRole('button', { name: 'modules.buy' }));
        expect(await screen.findByTestId('awaiting-pro')).toBeInTheDocument();
        expect(window.open).toHaveBeenCalledWith('https://checkout.stripe/x', '_blank', 'noopener,noreferrer');

        // The purchase carried Checkout return URLs derived from the page URL.
        const base = `${window.location.origin}${window.location.pathname}`;
        expect(purchaseBody).toEqual({
            successUrl: `${base}?tab=marketplace&purchase=success&module=pro`,
            cancelUrl: `${base}?tab=marketplace&purchase=cancel&module=pro`,
        });

        // "I've paid — refresh" flips the entitlement and the card offers Install.
        fireEvent.click(screen.getByText('modules.paid_refresh'));
        expect(await screen.findByRole('button', { name: 'modules.install' })).toBeInTheDocument();
    });

    it('handles a ?purchase=success return: flash, entitlement refresh, params stripped', async () => {
        window.history.replaceState(null, '', '/admin/modules?tab=marketplace&purchase=success&module=pro');
        let refreshed = false;
        authFetch.mockImplementation((url, init = {}) => {
            const u = String(url);
            const m = init.method || 'GET';
            if (u.includes('/marketplace')) {
                return jsonRes({
                    connected: true,
                    hubUrl: 'https://hub.beeflow.nl',
                    modules: [paidModule({ entitled: true, status: 'entitled' })],
                    nextCursor: null,
                });
            }
            if (m === 'POST' && u.endsWith('/entitlements/refresh')) {
                refreshed = true;
                return jsonRes({ ok: true, entitledModuleIds: ['pro'] });
            }
            return jsonRes({});
        });
        const flash = vi.fn();
        renderTab({ flash });

        await waitFor(() => expect(refreshed).toBe(true));
        expect(flash).toHaveBeenCalledWith({ type: 'success', text: 'modules.purchase_return_success' });
        // purchase/module stripped, tab kept.
        expect(window.location.pathname).toBe('/admin/modules');
        expect(window.location.search).toBe('?tab=marketplace');
    });

    it('handles a ?purchase=cancel return: info flash, no refresh, params stripped', async () => {
        window.history.replaceState(null, '', '/admin/modules?tab=marketplace&purchase=cancel&module=pro');
        authFetch.mockImplementation((url) => {
            if (String(url).includes('/marketplace')) {
                return jsonRes({ connected: true, hubUrl: 'https://hub.beeflow.nl', modules: [paidModule()], nextCursor: null });
            }
            return jsonRes({});
        });
        const flash = vi.fn();
        renderTab({ flash });

        await screen.findByText(/modules\.connected_to/);
        expect(flash).toHaveBeenCalledWith({ type: 'info', text: 'modules.purchase_return_cancel' });
        expect(window.location.search).toBe('?tab=marketplace');
        expect(authFetch.mock.calls.some(([u]) => String(u).endsWith('/entitlements/refresh'))).toBe(false);
    });

    it('update → 409 consent_required → accept retries with acceptedPermissions', async () => {
        const updateBodies = [];
        authFetch.mockImplementation((url, init = {}) => {
            const u = String(url);
            const m = init.method || 'GET';
            if (u.includes('/marketplace')) {
                return jsonRes({
                    connected: true,
                    hubUrl: 'https://hub.beeflow.nl',
                    modules: [paidModule({ entitled: true, installed: true, status: 'installed', updateAvailable: true })],
                    nextCursor: null,
                });
            }
            if (m === 'POST' && u.endsWith('/pro/update')) {
                updateBodies.push(JSON.parse(init.body));
                if (updateBodies.length === 1) {
                    return jsonRes({ error: 'consent_required', missingPermissions: ['db', 'http:*'] }, 409);
                }
                return jsonRes({ ok: true, version: '2.0.0', requiresRestart: false });
            }
            return jsonRes({});
        });
        renderTab();

        fireEvent.click(await screen.findByRole('button', { name: 'modules.update' }));

        // Consent dialog opens seeded with the missing permissions…
        expect(await screen.findByTestId('permission-consent-dialog')).toBeInTheDocument();
        expect(screen.getByTestId('perm-db')).toBeInTheDocument();
        expect(screen.getByTestId('perm-http:*')).toBeInTheDocument();

        // …and accepting retries the update with acceptedPermissions set.
        fireEvent.click(screen.getByTestId('consent-accept'));
        await waitFor(() => expect(updateBodies).toHaveLength(2));
        expect(updateBodies[1]).toEqual({ acceptedPermissions: ['db', 'http:*'] });
        await waitFor(() => expect(screen.queryByTestId('permission-consent-dialog')).toBeNull());
    });

    it('shows quarantine and restart chips from the health join, with Re-enable', async () => {
        let reactivated = false;
        authFetch.mockImplementation((url, init = {}) => {
            const u = String(url);
            const m = init.method || 'GET';
            if (u.includes('/marketplace')) {
                return jsonRes({
                    connected: true,
                    hubUrl: 'https://hub.beeflow.nl',
                    modules: [paidModule({ entitled: true, installed: true, status: 'installed' })],
                    nextCursor: null,
                });
            }
            if (u.endsWith('/api/admin/modules/health')) {
                return jsonRes({
                    hub: {}, refresher: {}, runtime: {},
                    modules: [{
                        moduleId: 'pro', ledgerStatus: reactivated ? 'active' : 'quarantined', version: '1.0.0',
                        running: reactivated, pendingRestart: false, source: 'hub',
                        entitlement: { state: 'active', kind: 'subscription', exp: null },
                        lastActivationError: reactivated ? null : 'boom', crashesInWindow: 3,
                        disposeTimeouts: 0, restartAdvised: false, capabilityConflicts: [], healTerminal: null,
                    }],
                });
            }
            if (m === 'POST' && u.endsWith('/pro/reactivate')) {
                reactivated = true;
                return jsonRes({ ok: true, version: '1.0.0' });
            }
            return jsonRes({});
        });
        renderTab();

        expect(await screen.findByTestId('quarantined-pro')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('reactivate-pro'));
        await waitFor(() => expect(authFetch.mock.calls.some(([u, i]) =>
            String(u).endsWith('/pro/reactivate') && (i?.method === 'POST'))).toBe(true));
    });

    it('marks sideloaded modules and suppresses hub Buy/Update actions', async () => {
        authFetch.mockImplementation((url) => {
            const u = String(url);
            if (u.includes('/marketplace')) {
                return jsonRes({
                    connected: true,
                    hubUrl: 'https://hub.beeflow.nl',
                    modules: [paidModule({ entitled: false, installed: true, status: 'installed', updateAvailable: true })],
                    nextCursor: null,
                });
            }
            if (u.endsWith('/api/admin/modules/health')) {
                return jsonRes({
                    hub: {}, refresher: {}, runtime: {},
                    modules: [{
                        moduleId: 'pro', ledgerStatus: 'active', version: '1.0.0', running: true,
                        pendingRestart: true, source: 'sideload', entitlement: null,
                        lastActivationError: null, crashesInWindow: 0, disposeTimeouts: 0,
                        restartAdvised: false, capabilityConflicts: [], healTerminal: null,
                    }],
                });
            }
            return jsonRes({});
        });
        renderTab();

        expect(await screen.findByTestId('sideloaded-pro')).toBeInTheDocument();
        expect(screen.getByTestId('restart-required-pro')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'modules.update' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'modules.buy' })).toBeNull();
    });

    it('opens the detail drawer from a ?module= deep link and strips it on close', async () => {
        window.history.replaceState(null, '', '/admin/modules?tab=marketplace&module=pro');
        authFetch.mockImplementation((url) => {
            const u = String(url);
            if (u.includes('/marketplace/pro')) {
                return jsonRes({
                    ...paidModule(),
                    readme: null,
                    media: [],
                    permissions: ['db'],
                    versions: [{ version: '1.0.0', channel: 'stable', changelog: null, yanked: false }],
                    ledgerVersions: [],
                });
            }
            if (u.includes('/marketplace')) {
                return jsonRes({ connected: true, hubUrl: 'https://hub.beeflow.nl', modules: [paidModule()], nextCursor: null });
            }
            return jsonRes({});
        });
        renderTab();

        expect(await screen.findByTestId('module-detail-drawer')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('drawer-close'));
        expect(screen.queryByTestId('module-detail-drawer')).toBeNull();
        expect(window.location.search).toBe('?tab=marketplace');
    });

    it('installs an entitled module and shows the download progress phase', async () => {
        authFetch.mockImplementation((url, init = {}) => {
            const u = String(url);
            const m = init.method || 'GET';
            if (u.includes('/marketplace')) {
                return jsonRes({
                    connected: true,
                    hubUrl: 'https://hub.beeflow.nl',
                    modules: [paidModule({ entitled: true, status: 'entitled' })],
                    nextCursor: null,
                });
            }
            if (m === 'POST' && u.endsWith('/pro/install')) return jsonRes({ ok: true }, 202);
            if (u.endsWith('/pro/install-progress')) return jsonRes({ phase: 'downloading', pct: 40 });
            return jsonRes({});
        });
        renderTab();

        fireEvent.click(await screen.findByRole('button', { name: 'modules.install' }));
        expect(await screen.findByTestId('install-progress-pro')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByTestId('install-progress-pro')).toHaveTextContent('modules.installing_download'));
    });
});
