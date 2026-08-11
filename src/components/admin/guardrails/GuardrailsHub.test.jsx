/**
 * The console's routing and capability gating.
 *
 * Two properties matter here and neither is obvious from the markup:
 *
 *  1. `/app/admin/security/guardrails/<section>` is a real URL. It works only
 *     because SecurityHub threads the third admin path segment through; a
 *     FOURTH segment is not parsed by App.jsx at all, so anything deeper would
 *     appear to work in dev and break on refresh.
 *  2. Sections whose endpoint does not exist are HIDDEN, not broken. That is
 *     what lets this UI ship before presets / term libraries / PII profiles /
 *     DLP policies have routes, and light each one up on the day it lands.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/useTranslation', () => ({
    useTranslation: () => ({ t: (key, fallback) => (typeof fallback === 'string' ? fallback : key) }),
    __esModule: true,
}));

// Heavy children with their own fetches — this file is about section routing.
vi.mock('./patterns/PatternsView', () => ({ default: () => <div data-testid="view-patterns" /> }));
vi.mock('./directchat/DirectChatView', () => ({ default: () => <div data-testid="view-directchat" /> }));
vi.mock('./orgShield/OrgShieldEditor', () => ({
    default: (p) => <div data-testid="view-organisations" data-picker={String(p.allowOrgPicker)} />,
}));

const mockData = vi.hoisted(() => ({ current: null }));
vi.mock('./api/useGuardrailsData', () => ({
    default: () => mockData.current,
    __esModule: true,
}));

import GuardrailsHub from './GuardrailsHub';

const baseData = (over = {}) => ({
    loading: false,
    error: null,
    reload: vi.fn(),
    capabilities: { presets: false, termLibraries: false, piiProfiles: false, dlpPolicies: false },
    rules: [{ id: 'r1' }, { id: 'r2' }],
    setRules: vi.fn(),
    collections: [{ id: 'c1', ruleIds: ['r1'] }],
    setCollections: vi.fn(),
    directChat: { enabled: false, collectionIds: [] },
    setDirectChat: vi.fn(),
    orgs: [{ id: 'o1', name: 'Alpha' }, { id: 'o2', name: 'Beta' }],
    orgShields: {},
    guardStatus: { configured: true, reachable: true },
    staleRefs: [],
    orgsWithShieldOn: 1,
    ...over,
});

beforeEach(() => {
    mockData.current = baseData();
    window.history.replaceState({}, '', '/app/admin/security/guardrails');
});

describe('GuardrailsHub sections', () => {
    it('hides sections whose endpoint does not exist yet', async () => {
        render(<GuardrailsHub section="patterns" onNavigate={vi.fn()} />);
        // Always-on
        expect(await screen.findByRole('tab', { name: /Patterns/ })).toBeTruthy();
        expect(screen.getByRole('tab', { name: /Direct chat/ })).toBeTruthy();
        expect(screen.getByRole('tab', { name: /Organisations/ })).toBeTruthy();
        // Capability-gated, and absent on this server
        expect(screen.queryByRole('tab', { name: /Presets/ })).toBeNull();
        expect(screen.queryByRole('tab', { name: /PII profiles/ })).toBeNull();
    });

    it('shows a gated section as soon as its endpoint appears', async () => {
        mockData.current = baseData({
            capabilities: { presets: true, termLibraries: false, piiProfiles: false, dlpPolicies: false },
        });
        render(<GuardrailsHub section="patterns" onNavigate={vi.fn()} />);
        expect(await screen.findByRole('tab', { name: /Presets/ })).toBeTruthy();
    });

    it('renders the section named by the path segment', async () => {
        render(<GuardrailsHub section="directchat" onNavigate={vi.fn()} />);
        expect(await screen.findByTestId('view-directchat')).toBeTruthy();
        expect(screen.queryByTestId('view-patterns')).toBeNull();
    });

    it('falls back to a usable section for an unknown segment', async () => {
        render(<GuardrailsHub section="does-not-exist" onNavigate={vi.fn()} />);
        expect(await screen.findByTestId('view-patterns')).toBeTruthy();
    });

    it('falls back — and says so — for a section that exists but is gated off', async () => {
        render(<GuardrailsHub section="presets" onNavigate={vi.fn()} />);
        expect(await screen.findByTestId('view-patterns')).toBeTruthy();
        // Silently showing a different tab than the URL asked for is how people
        // conclude the page is broken.
        expect(screen.getByRole('status')).toBeTruthy();
    });

    it('navigates by path rather than local state, so the URL stays truthful', async () => {
        const onNavigate = vi.fn();
        render(<GuardrailsHub section="patterns" onNavigate={onNavigate} />);
        (await screen.findByRole('tab', { name: /Direct chat/ })).click();
        expect(onNavigate).toHaveBeenCalledWith('admin/security/guardrails/directchat');
    });

    it('normalises the URL when the segment does not match what is rendered', async () => {
        render(<GuardrailsHub section={undefined} onNavigate={vi.fn()} />);
        await waitFor(() => {
            expect(window.location.pathname).toBe('/app/admin/security/guardrails/patterns');
        });
    });

    it('keeps the org editor in picker mode until the read-only overview lands', async () => {
        render(<GuardrailsHub section="organisations" onNavigate={vi.fn()} />);
        const view = await screen.findByTestId('view-organisations');
        expect(view.getAttribute('data-picker')).toBe('true');
    });
});

describe('GuardrailsHub overview', () => {
    it('counts stale references, which nothing surfaced before', async () => {
        mockData.current = baseData({
            staleRefs: [
                { kind: 'org_collection', orgId: 'o1', collectionId: 'gone' },
                { kind: 'collection_rule', collectionId: 'c1', ruleId: 'gone' },
            ],
        });
        render(<GuardrailsHub section="patterns" onNavigate={vi.fn()} />);
        // The label sits next to the value inside the tile, so walk up one level.
        const tile = (await screen.findByText('Stale references')).parentElement;
        expect(tile.textContent).toContain('2');
        // Non-zero stale refs must be actionable, not just informational.
        expect(tile.tagName).toBe('BUTTON');
    });

    it('warns when the PII guard is absent, because every PII control is then inert', async () => {
        mockData.current = baseData({ guardStatus: { configured: false, reachable: false } });
        render(<GuardrailsHub section="patterns" onNavigate={vi.fn()} />);
        expect(await screen.findByText('PII Guard is not installed')).toBeTruthy();
    });

    it('stays quiet when the guard is healthy', async () => {
        render(<GuardrailsHub section="patterns" onNavigate={vi.fn()} />);
        await screen.findByTestId('view-patterns');
        expect(screen.queryByText('PII Guard is not installed')).toBeNull();
        expect(screen.queryByText('PII Guard is unreachable')).toBeNull();
    });

    it('offers a retry rather than a blank pane when loading failed', async () => {
        mockData.current = baseData({ error: new Error('boom') });
        render(<GuardrailsHub section="patterns" onNavigate={vi.fn()} />);
        expect(await screen.findByRole('alert')).toBeTruthy();
        expect(screen.getByText('Retry')).toBeTruthy();
    });
});
