import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { LicenseProvider, useLicenseContext, TIER_HIERARCHY, TIER_RANK } from './LicenseContext';
import { EntitlementsProvider } from './EntitlementsContext';

// Mock the translation hook — it's not part of what we're testing here.
vi.mock('../hooks/useTranslation', () => ({
    useTranslation: () => ({ t: (_, fallback) => fallback }),
}));

const EMPTY = { core: [], beta: [], integration: [] };

// URL-aware fetch mock: LicenseProvider reads /api/license/status (tier +
// licence-management state) while EntitlementsProvider reads /auth/my-entitlements
// (the unified resolver snapshot that now drives hasFeature). Both go through the
// same global.fetch.
function mockFetch({ licenseStatus, entitlements, licenseError = false } = {}) {
    return vi.fn(async (url) => {
        const u = String(url);
        if (u.includes('/api/license/status')) {
            if (licenseError) return { ok: false, status: 500, json: async () => ({}) };
            return { ok: true, status: 200, json: async () => (licenseStatus || { tier: 'community', source: 'default', features: [], limits: {} }) };
        }
        if (u.includes('/auth/my-entitlements')) {
            return { ok: true, status: 200, json: async () => (entitlements || { tier: 'community', mode: 'cloud', effective: EMPTY, ceiling: EMPTY, registry: [], degraded: false }) };
        }
        if (u.includes('/auth/setup-status')) {
            return { ok: true, status: 200, json: async () => ({ deploymentMode: 'cloud' }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
    });
}

function HarnessReader({ onRead }) {
    const ctx = useLicenseContext();
    React.useEffect(() => { onRead(ctx); }, [ctx, onRead]);
    return <div data-testid="harness">tier={ctx.tier}</div>;
}

// EntitlementsProvider must wrap LicenseProvider — LicenseContext.hasFeature
// delegates to the entitlements snapshot (mirrors App.jsx provider order).
function renderHarness(onRead) {
    return render(
        <EntitlementsProvider>
            <LicenseProvider>
                <HarnessReader onRead={onRead} />
            </LicenseProvider>
        </EntitlementsProvider>,
    );
}

describe('LicenseContext', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('exports a hierarchy that matches the rank map', () => {
        expect(TIER_HIERARCHY).toEqual(['community', 'enterprise', 'full']);
        expect(TIER_RANK).toEqual({ community: 0, enterprise: 1, full: 2 });
    });

    it('starts in loading state and flips to community on a no-license response', async () => {
        global.fetch = mockFetch({ licenseStatus: { tier: 'community', source: 'default', features: [], limits: {} } });

        let captured;
        renderHarness((ctx) => { captured = ctx; });

        await waitFor(() => expect(captured?.loading).toBe(false));
        expect(captured.tier).toBe('community');
        expect(captured.hasTier('community')).toBe(true);
        expect(captured.hasTier('enterprise')).toBe(false);
    });

    it('normalises a legacy pro-tier response to enterprise (tier is licence-driven)', async () => {
        let next = { tier: 'community', source: 'default', features: [], limits: {} };
        global.fetch = mockFetch({});
        // Re-point the license-status branch at the mutable `next`.
        global.fetch.mockImplementation(async (url) => {
            const u = String(url);
            if (u.includes('/api/license/status')) return { ok: true, status: 200, json: async () => next };
            if (u.includes('/auth/my-entitlements')) return { ok: true, status: 200, json: async () => ({ tier: 'community', mode: 'cloud', effective: EMPTY, ceiling: EMPTY, registry: [], degraded: false }) };
            return { ok: true, status: 200, json: async () => ({ deploymentMode: 'cloud' }) };
        });

        let captured;
        renderHarness((ctx) => { captured = ctx; });

        await waitFor(() => expect(captured?.loading).toBe(false));
        expect(captured.hasTier('enterprise')).toBe(false);

        next = {
            tier: 'pro',
            source: 'license_key',
            features: ['automations', 'meeting_notes', 'sso_saml'],
            limits: {},
            license: { id: 'lic_legacy_pro', tier: 'pro' },
        };
        await act(async () => { await captured.reload(); });

        expect(captured.tier).toBe('enterprise');
        expect(captured.license).toEqual({ id: 'lic_legacy_pro', tier: 'enterprise' });
        expect(captured.hasTier('enterprise')).toBe(true);
        expect(captured.hasTier('full')).toBe(false);
    });

    it('hasFeature delegates to the entitlements snapshot (capability id AND licence-feature name)', async () => {
        global.fetch = mockFetch({
            licenseStatus: { tier: 'enterprise', source: 'license_key', features: [], limits: {} },
            entitlements: {
                tier: 'enterprise',
                mode: 'cloud',
                degraded: false,
                effective: { core: ['sso_saml'], beta: ['webpages', 'itil_ticket_assistant'], integration: [] },
                ceiling: { core: ['sso_saml'], beta: ['webpages', 'itil_ticket_assistant'], integration: [] },
                // registry carries licenseFeature so the SPA can resolve a legacy
                // licence-feature name ('ticket_assistant') to its capability id.
                registry: [
                    { id: 'sso_saml', kind: 'core', licenseFeature: 'sso_saml' },
                    { id: 'webpages', kind: 'beta', licenseFeature: 'webpages' },
                    { id: 'itil_ticket_assistant', kind: 'beta', licenseFeature: 'ticket_assistant' },
                ],
            },
        });

        let captured;
        renderHarness((ctx) => { captured = ctx; });

        await waitFor(() => expect(captured?.loading).toBe(false));
        await waitFor(() => expect(captured.entLoading).toBe(false));

        // Granted capabilities resolve true; ungranted resolve false — NOT the
        // licence-status features array (which is empty here).
        expect(captured.hasFeature('sso_saml')).toBe(true);
        expect(captured.hasFeature('webpages')).toBe(true);
        expect(captured.hasFeature('not_a_feature')).toBe(false);
        // Legacy licence-feature name maps to its capability id.
        expect(captured.hasFeature('itil_ticket_assistant')).toBe(true);
        expect(captured.hasFeature('ticket_assistant')).toBe(true);
    });

    it('surfaces a licence fetch error without crashing', async () => {
        global.fetch = mockFetch({ licenseError: true });

        let captured;
        renderHarness((ctx) => { captured = ctx; });

        await waitFor(() => expect(captured?.loading).toBe(false));
        expect(captured.error).toMatch(/HTTP 500/);
        // We still expose a usable tier (the default before fetch resolved).
        expect(captured.tier).toBe('community');
    });
});
