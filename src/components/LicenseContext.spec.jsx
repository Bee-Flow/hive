import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { LicenseProvider, useLicenseContext, TIER_HIERARCHY, TIER_RANK } from './LicenseContext';

// Mock the translation hook — it's not part of what we're testing here.
vi.mock('../hooks/useTranslation', () => ({
    useTranslation: () => ({ t: (_, fallback) => fallback }),
}));

function HarnessReader({ onRead }) {
    const ctx = useLicenseContext();
    React.useEffect(() => { onRead(ctx); }, [ctx, onRead]);
    return <div data-testid="harness">tier={ctx.tier}</div>;
}

describe('LicenseContext', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('exports a hierarchy that matches the rank map', () => {
        // Sanity: the rank object derived from the hierarchy array must agree.
        expect(TIER_HIERARCHY).toEqual(['community', 'enterprise', 'full']);
        expect(TIER_RANK).toEqual({ community: 0, enterprise: 1, full: 2 });
    });

    it('starts in loading state and flips to community on a no-license response', async () => {
        global.fetch = vi.fn().mockImplementation(async () => ({
            ok: true,
            status: 200,
            json: async () => ({ tier: 'community', source: 'default', features: [], limits: {} }),
        }));

        let captured;
        render(
            <LicenseProvider>
                <HarnessReader onRead={(ctx) => { captured = ctx; }} />
            </LicenseProvider>,
        );

        await waitFor(() => expect(captured?.loading).toBe(false));
        expect(captured.tier).toBe('community');
        expect(captured.hasTier('community')).toBe(true);
        expect(captured.hasTier('enterprise')).toBe(false);
    });

    it('normalises a legacy pro-tier response to enterprise', async () => {
        let next = { tier: 'community', source: 'default', features: [], limits: {} };
        global.fetch = vi.fn().mockImplementation(async () => ({
            ok: true,
            status: 200,
            json: async () => next,
        }));

        let captured;
        render(
            <LicenseProvider>
                <HarnessReader onRead={(ctx) => { captured = ctx; }} />
            </LicenseProvider>,
        );

        await waitFor(() => expect(captured?.loading).toBe(false));
        expect(captured.hasTier('enterprise')).toBe(false);
        expect(captured.hasFeature('sso_saml')).toBe(false);

        // Server returns a legacy pro-tier status — provider must normalise it.
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
        expect(captured.hasFeature('sso_saml')).toBe(true);
        expect(captured.hasFeature('not_a_feature')).toBe(false);
    });

    it('surfaces a fetch error without crashing', async () => {
        global.fetch = vi.fn().mockImplementation(async () => ({ ok: false, status: 500, json: async () => ({}) }));

        let captured;
        render(
            <LicenseProvider>
                <HarnessReader onRead={(ctx) => { captured = ctx; }} />
            </LicenseProvider>,
        );

        await waitFor(() => expect(captured?.loading).toBe(false));
        expect(captured.error).toMatch(/HTTP 500/);
        // We still expose a usable tier (the default before fetch resolved).
        expect(captured.tier).toBe('community');
    });
});
