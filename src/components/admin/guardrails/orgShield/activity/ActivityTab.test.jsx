/**
 * The Privacy Shield "What happened" tab.
 *
 * The load-bearing tests are the mount-safety ones: the monitoring endpoints
 * derive the organisation from the SESSION, so the tab must not exist on
 * mounts that can pin a different organisation (admin GuardrailsHub), and
 * `?tab=activity` there must fall back to Overview. Everything else pins the
 * overview-first behaviour: fetch only on activation, licence lock, one empty
 * card when idle, drill-down refetches with the right filter.
 *
 * Run: npx vitest run src/components/admin/guardrails/orgShield/activity/ActivityTab.test.jsx
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../../utils/helpers', () => ({
    API_BASE: '',
    authFetch: vi.fn(),
}));

vi.mock('../../../../../hooks/useTranslation', () => ({
    useTranslation: () => ({ t: (key, fallback) => (typeof fallback === 'string' ? fallback : key) }),
    __esModule: true,
}));

let licensed = true;
vi.mock('../../../../LicenseContext', () => ({
    useLicenseContext: () => ({
        tier: 'enterprise',
        hasFeature: (f) => (f === 'advanced_usage_monitoring' ? licensed : true),
        hasTier: () => true,
        upgradeUrl: null,
    }),
}));

import OrgShieldEditor from '../OrgShieldEditor';
import { authFetch } from '../../../../../utils/helpers';

const ORG_ID = 'org-alpha';
const SHIELD = {
    enabled: true,
    piiDetectionCategories: ['Email'],
    piiDetectionConfidenceThreshold: 0.7,
    piiDetectionAction: 'block',
    toolPiiPolicy: { external: { blockCategories: [] }, internal: { blockCategories: [] } },
};

const GUARD_OVERVIEW = {
    summary: { total_events: 12, pii_count: 4, moderation_count: 6, regex_count: 2, unique_users: 3 },
    timeline: [
        { period: '2026-07-01', total: 5, moderation: 3, pii: 1, regex: 1 },
        { period: '2026-07-02', total: 7, moderation: 3, pii: 3, regex: 1 },
    ],
    top_categories: [{ category: 'Email', violation_type: 'pii', count: 4 }],
    by_action: [],
    top_users: [{ user_id: 'u-kim', display_name: 'Kim', total: 9 }],
    health: { last_event_at: '2026-07-02' },
};
const INTEG_OVERVIEW = {
    summary: { total_calls: 40, non_eu_count: 6, pii_non_eu_count: 0, sovereignty_score: 88, score_delta: 2, pii_events: 3 },
    timeline: [],
    top: {
        destinations: [], integrations: [], actors: [], users: [],
        non_eu_destinations: [{ dest_host: 'api.openai.com', country_name: 'United States', total: 6, pii_events: 0 }],
    },
    pii_categories: [], data_categories: [],
    health: { last_event_at: null, scan_levels: { full: 1, basic: 0, none: 0 }, unknown_operator_pct: 0 },
};
const ZERO_GUARD = { ...GUARD_OVERVIEW, summary: { total_events: 0, pii_count: 0 }, timeline: [], top_users: [], top_categories: [] };
const ZERO_INTEG = { ...INTEG_OVERVIEW, summary: { total_calls: 0, sovereignty_score: null }, top: { ...INTEG_OVERVIEW.top, non_eu_destinations: [] } };

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const PATH = '/app/settings/organisation/privacy';

let guardOverview = GUARD_OVERVIEW;
let integOverview = INTEG_OVERVIEW;

const usageCalls = () => authFetch.mock.calls.map(c => String(c[0])).filter(u => u.includes('/api/usage/'));

beforeEach(() => {
    window.history.replaceState({}, '', PATH);
    licensed = true;
    guardOverview = GUARD_OVERVIEW;
    integOverview = INTEG_OVERVIEW;
    authFetch.mockReset();
    authFetch.mockImplementation(async (url) => {
        const u = String(url);
        if (u.includes('/auth/organizations')) return ok([{ id: ORG_ID, name: 'Alpha BV' }]);
        if (u.includes('/ai/config/chat-models-eu')) return ok({});
        if (u.includes('/ai/config')) return ok({ searchProvider: 'serper' });
        if (u.includes('/api/usage/guardrails/overview')) return ok(guardOverview);
        if (u.includes('/api/usage/integrations/overview')) return ok(integOverview);
        if (u.includes('/api/usage/guardrails/recent')) return ok([{ id: 1, timestamp: '2026-07-02T10:00:00Z', user_id: 'u-kim', display_name: 'Kim', violation_type: 'pii', violation_categories: 'Email', action_taken: 'redacted' }]);
        if (u.includes('/api/usage/integrations/egress')) return ok([{ id: 7, timestamp: '2026-07-02T10:00:00Z', user_id: 'u-kim', integration_type: 'openai_images', dest_host: 'api.openai.com', is_eu: false, is_local: false, status: 'success' }]);
        if (u.includes('/api/org-privacy-shield/')) return ok(SHIELD);
        return ok({});
    });
});

const renderEditor = async (props = {}) => {
    render(<OrgShieldEditor orgId={ORG_ID} {...props} />);
    await waitFor(() => expect(screen.getByRole('tab', { name: /Overview/ })).toBeInTheDocument());
};

describe('ActivityTab mount safety', () => {
    it('is offered ONLY with showActivityTab — the admin-hub mount keeps four tabs', async () => {
        await renderEditor();
        expect(screen.getAllByRole('tab')).toHaveLength(4);
        expect(screen.queryByRole('tab', { name: /What happened/ })).toBeNull();
    });

    it('shows five tabs on the org-settings mount', async () => {
        await renderEditor({ showActivityTab: true });
        expect(screen.getAllByRole('tab')).toHaveLength(5);
        expect(screen.getByRole('tab', { name: /What happened/ })).toBeEnabled();
    });

    it('?tab=activity falls back to Overview when the tab is not offered', async () => {
        window.history.replaceState({}, '', `${PATH}?tab=activity`);
        await renderEditor();
        expect(screen.getByRole('tab', { name: /Overview/ })).toHaveAttribute('aria-selected', 'true');
        expect(usageCalls()).toHaveLength(0);
    });

    it('?tab=activity opens the tab when it IS offered', async () => {
        window.history.replaceState({}, '', `${PATH}?tab=activity`);
        await renderEditor({ showActivityTab: true });
        expect(screen.getByRole('tab', { name: /What happened/ })).toHaveAttribute('aria-selected', 'true');
        await waitFor(() => expect(screen.getByText('Times the shield stepped in')).toBeInTheDocument());
    });
});

describe('ActivityTab behaviour', () => {
    it('fetches NOTHING until the tab is activated', async () => {
        await renderEditor({ showActivityTab: true });
        expect(usageCalls()).toHaveLength(0);

        const user = userEvent.setup();
        await user.click(screen.getByRole('tab', { name: /What happened/ }));
        await waitFor(() => expect(usageCalls().length).toBeGreaterThan(0));
        // Two consolidated calls — not the 19 the old tabs fired.
        expect(usageCalls().filter(u => u.includes('overview'))).toHaveLength(2);
    });

    it('locked plan: friendly card, upgrade link, zero monitoring fetches', async () => {
        licensed = false;
        const user = userEvent.setup();
        await renderEditor({ showActivityTab: true });
        await user.click(screen.getByRole('tab', { name: /What happened/ }));
        expect(await screen.findByText('See what actually happened')).toBeInTheDocument();
        expect(usageCalls()).toHaveLength(0);
    });

    it('all-zero data collapses to ONE empty card — no KPIs, no sections', async () => {
        guardOverview = ZERO_GUARD;
        integOverview = ZERO_INTEG;
        const user = userEvent.setup();
        await renderEditor({ showActivityTab: true });
        await user.click(screen.getByRole('tab', { name: /What happened/ }));
        expect(await screen.findByText(/Nothing to show yet/)).toBeInTheDocument();
        expect(screen.queryByText('Times the shield stepped in')).toBeNull();
        expect(screen.queryByText('What to look at')).toBeNull();
    });

    it('renders the KPIs with the SERVER-computed score', async () => {
        const user = userEvent.setup();
        await renderEditor({ showActivityTab: true });
        await user.click(screen.getByRole('tab', { name: /What happened/ }));
        expect(await screen.findByText('Times the shield stepped in')).toBeInTheDocument();
        expect(screen.getByText('88/100')).toBeInTheDocument();
        expect(screen.getByText('Where data left Europe')).toBeInTheDocument();
    });

    it('a top-person drill opens the details and refetches with user=', async () => {
        const user = userEvent.setup();
        await renderEditor({ showActivityTab: true });
        await user.click(screen.getByRole('tab', { name: /What happened/ }));
        await screen.findByText('People with the most catches');
        await user.click(screen.getByText('Kim'));
        await waitFor(() => {
            const recent = usageCalls().filter(u => u.includes('guardrails/recent'));
            expect(recent.length).toBeGreaterThan(0);
            expect(recent.at(-1)).toContain('user=u-kim');
        });
        expect(await screen.findByText('What we found')).toBeInTheDocument();
    });

    it('shield off: tab stays usable and says it is showing history', async () => {
        authFetch.mockImplementation(async (url) => {
            const u = String(url);
            if (u.includes('/auth/organizations')) return ok([{ id: ORG_ID, name: 'Alpha BV' }]);
            if (u.includes('/ai/config/chat-models-eu')) return ok({});
            if (u.includes('/ai/config')) return ok({});
            if (u.includes('/api/usage/guardrails/overview')) return ok(GUARD_OVERVIEW);
            if (u.includes('/api/usage/integrations/overview')) return ok(INTEG_OVERVIEW);
            if (u.includes('/api/org-privacy-shield/')) return ok({ ...SHIELD, enabled: false });
            return ok({});
        });
        const user = userEvent.setup();
        await renderEditor({ showActivityTab: true });
        const activityTab = screen.getByRole('tab', { name: /What happened/ });
        expect(activityTab).toBeEnabled();
        expect(screen.getByRole('tab', { name: /What we look for/ })).toBeDisabled();
        await user.click(activityTab);
        expect(await screen.findByText(/You are looking at past activity/)).toBeInTheDocument();
    });

    it('keeps the pathname byte-identical when the Activity tab is clicked', async () => {
        const before = window.location.pathname;
        const user = userEvent.setup();
        await renderEditor({ showActivityTab: true });
        await user.click(screen.getByRole('tab', { name: /What happened/ }));
        expect(window.location.pathname).toBe(before);
        expect(window.location.search).toContain('tab=activity');
    });
});
