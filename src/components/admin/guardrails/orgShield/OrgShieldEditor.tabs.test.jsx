/**
 * The Privacy Shield editor's tab strip.
 *
 * The load-bearing test here is the routing one. This component is mounted on
 * TWO unrelated routes — the org settings page and the admin console — so a
 * tab that writes a PATH segment would navigate the admin console out of
 * itself, and would also fight AdvancedSettings, which pushState's its own
 * 3-segment URL whenever the pathname differs. The tab therefore lives in a
 * query parameter, and "the pathname does not move" is the assertion that
 * keeps it that way.
 *
 * Run: npx vitest run src/components/admin/guardrails/orgShield/OrgShieldEditor.tabs.test.jsx
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../utils/helpers', () => ({
    API_BASE: '',
    authFetch: vi.fn(),
}));

vi.mock('../../../../hooks/useTranslation', () => ({
    useTranslation: () => ({ t: (key, fallback) => (typeof fallback === 'string' ? fallback : key) }),
    __esModule: true,
}));

vi.mock('../../../LicenseContext', () => ({
    useLicenseContext: () => ({ tier: 'enterprise', hasFeature: () => true, hasTier: () => true }),
}));

import OrgShieldEditor from './OrgShieldEditor';
import { authFetch } from '../../../../utils/helpers';

const ORG_ID = 'org-alpha';
const SHIELD = {
    enabled: true,
    piiDetectionCategories: ['Email'],
    piiDetectionConfidenceThreshold: 0.7,
    piiDetectionAction: 'block',
    toolPiiPolicy: { external: { blockCategories: [] }, internal: { blockCategories: [] } },
};

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

const PATH = '/app/settings/organisation/privacy';

beforeEach(() => {
    window.history.replaceState({}, '', PATH);
    authFetch.mockReset();
    authFetch.mockImplementation(async (url, opts) => {
        if (url.includes('/auth/organizations')) return ok([{ id: ORG_ID, name: 'Alpha BV' }]);
        if (url.includes('/ai/config/chat-models-eu')) return ok({});
        if (url.includes('/ai/config')) return ok({ searchProvider: 'serper' });
        if (url.includes('/api/org-privacy-shield/')) {
            if (opts?.method === 'PUT') return ok({ ok: true, config: SHIELD });
            return ok(SHIELD);
        }
        return ok({});
    });
});

const renderEditor = async (props = {}) => {
    render(<OrgShieldEditor orgId={ORG_ID} {...props} />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Overview/ })).toBeInTheDocument());
};

describe('OrgShieldEditor tabs', () => {
    it('offers exactly four tabs and lands on Overview', async () => {
        await renderEditor();
        const tabs = screen.getAllByRole('tab');
        expect(tabs.map(t => t.textContent)).toEqual(['Overview', 'What we look for', 'What happens', 'Leaving your org']);
        expect(screen.getByRole('tab', { name: /Overview/ })).toHaveAttribute('aria-selected', 'true');
    });

    it('keeps the pathname byte-identical when a tab is clicked', async () => {
        // THE regression test for the routing decision. A path-segment tab
        // would rewrite this to /app/settings/organisation/privacy/detection —
        // and on the admin console mount it would navigate away entirely.
        const user = userEvent.setup();
        await renderEditor();

        await user.click(screen.getByRole('tab', { name: /Leaving your org/ }));

        expect(window.location.pathname).toBe(PATH);
        expect(new URLSearchParams(window.location.search).get('tab')).toBe('outbound');
    });

    it('honours ?tab= on mount', async () => {
        window.history.replaceState({}, '', `${PATH}?tab=processing`);
        await renderEditor();
        expect(screen.getByRole('tab', { name: /What happens/ })).toHaveAttribute('aria-selected', 'true');
    });

    it('falls back to Overview for an unknown tab rather than rendering nothing', async () => {
        window.history.replaceState({}, '', `${PATH}?tab=nonsense`);
        await renderEditor();
        expect(screen.getByRole('tab', { name: /Overview/ })).toHaveAttribute('aria-selected', 'true');
    });

    it('does not write the default tab into the URL on mount', async () => {
        // Normalising on mount would litter the admin console's URL and race
        // its own replaceState.
        await renderEditor();
        expect(window.location.search).toBe('');
    });

    it('puts each control on exactly one tab', async () => {
        const user = userEvent.setup();
        await renderEditor();

        // Overview is a read-only summary plus the master switch.
        expect(screen.getByText('Kinds of data we look for')).toBeInTheDocument();
        expect(screen.queryByText('What happens when we find personal data')).toBeNull();

        await user.click(screen.getByRole('tab', { name: /What we look for/ }));
        expect(screen.getByRole('radio', { name: /Balanced/ })).toBeInTheDocument();
        expect(screen.queryByText('What happens when we find personal data')).toBeNull();

        await user.click(screen.getByRole('tab', { name: /What happens/ }));
        expect(screen.getByText('What happens when we find personal data')).toBeInTheDocument();
        expect(screen.queryByRole('radio', { name: /Balanced/ })).toBeNull();

        await user.click(screen.getByRole('tab', { name: /Leaving your org/ }));
        expect(screen.getByText('One last check before an outside AI')).toBeInTheDocument();
    });

    it('disables the control tabs while the shield is off', async () => {
        authFetch.mockImplementation(async (url) => {
            if (url.includes('/auth/organizations')) return ok([{ id: ORG_ID, name: 'Alpha BV' }]);
            if (url.includes('/ai/config/chat-models-eu')) return ok({});
            if (url.includes('/ai/config')) return ok({});
            if (url.includes('/api/org-privacy-shield/')) return ok({ ...SHIELD, enabled: false });
            return ok({});
        });
        await renderEditor();

        // Three panes of inert switches would be worse than saying why.
        expect(screen.getByRole('tab', { name: /What we look for/ })).toBeDisabled();
        expect(screen.getByRole('tab', { name: /What happens/ })).toBeDisabled();
        expect(screen.getByRole('tab', { name: /Leaving your org/ })).toBeDisabled();
        expect(screen.getByRole('tab', { name: /Overview/ })).toBeEnabled();
        expect(screen.getByText(/Protection is off/i)).toBeInTheDocument();
    });

    it('lets the Overview summary jump to the tab that owns a setting', async () => {
        const user = userEvent.setup();
        await renderEditor();
        // The summary never duplicates a control; it points at one.
        const changeLinks = screen.getAllByRole('button', { name: /Change/ });
        await user.click(changeLinks[0]);
        expect(screen.getByRole('tab', { name: /What we look for/ })).toHaveAttribute('aria-selected', 'true');
    });

    it('does not touch the URL at all when the host opts out', async () => {
        // GuardrailsHub owns its own URL; a tab click there must not write one.
        const user = userEvent.setup();
        await renderEditor({ urlParam: null });
        await user.click(screen.getByRole('tab', { name: /Leaving your org/ }));
        expect(window.location.search).toBe('');
        expect(screen.getByRole('tab', { name: /Leaving your org/ })).toHaveAttribute('aria-selected', 'true');
    });
});
