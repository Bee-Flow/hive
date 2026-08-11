import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../analyticsApi', () => {
    const root = '/api/cms/admin/analytics';
    return {
        analyticsApi: {
            settings: () => `${root}/settings`,
            sites: () => `${root}/sites`,
            status: () => `${root}/status`,
            recorder: () => `${root}/recorder`,
            overview: (o = {}) => `${root}/overview?${new URLSearchParams({ range: o.range || '7d' })}`,
            query: (resource, o = {}) => `${root}/query/${resource}?${new URLSearchParams({ ...(o.params || {}) })}`,
            report: (type) => `${root}/report/${type}`,
        },
        reportBody: (o) => ({ ...o }),
        analyticsFetch: (...args) => globalThis.__afetch(...args),
        analyticsPost: (...args) => globalThis.__afetch(...args),
    };
});

import AnalyticsPanel, { toScopeRange } from './AnalyticsPanel';

const SETTINGS = { enabled: true, configured: true, consentMode: 'cookieless', url: 'https://stats.example.com' };
const SITES = { sites: [{ id: 'pj_aaaa1111', name: 'Main site', live: true, tracked: true, websiteId: 'web_1', recording: false }] };

function overviewPayload(extra = {}) {
    return {
        enabled: true, configured: true, provisioned: true,
        siteId: 'pj_aaaa1111', websiteId: 'web_1',
        range: { startAt: 1, endAt: 2, unit: 'day' },
        stats: { pageviews: 120, visitors: 40, visits: 50, bounces: 10, totaltime: 500, comparison: { pageviews: 60, visitors: 20, visits: 25, bounces: 5, totaltime: 200 } },
        pageviews: { pageviews: [{ x: '2026-07-27 10:00:00', y: 12 }], sessions: [] },
        pages: [{ x: '/solutions', y: 9 }],
        referrers: [], browsers: [], os: [], devices: [], countries: [],
        active: 3,
        partialErrors: [],
        ...extra,
    };
}

function routeTo(map) {
    globalThis.__afetch = vi.fn(async (url) => {
        const u = String(url);
        for (const [needle, value] of Object.entries(map)) {
            if (u.includes(needle)) {
                return typeof value === 'function' ? value(u) : value;
            }
        }
        return {};
    });
}

beforeEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/app/admin/website-analytics');
    routeTo({
        '/settings': SETTINGS,
        '/sites': SITES,
        '/overview': overviewPayload(),
    });
});

describe('toScopeRange', () => {
    it('passes presets straight through', () => {
        expect(toScopeRange({ preset: '30d' })).toEqual({ range: '30d' });
    });

    it('turns today/all into absolute windows the server understands', () => {
        const today = toScopeRange({ preset: 'today' });
        expect(today.range).toBe('custom');
        expect(today.end).toBeGreaterThan(today.start);

        const all = toScopeRange({ preset: 'all' });
        expect(all.range).toBe('custom');
        expect(all.end - all.start).toBeGreaterThan(1000 * 24 * 3600 * 1000);
    });

    it('falls back rather than sending an invalid custom window', () => {
        expect(toScopeRange({ preset: 'custom', customStart: 'nonsense', customEnd: 'nope' })).toEqual({ range: '30d' });
        // end before start would 400 upstream
        expect(toScopeRange({ preset: 'custom', customStart: '2026-07-27T10:00', customEnd: '2026-07-26T10:00' })).toEqual({ range: '30d' });
    });
});

describe('AnalyticsPanel', () => {
    it('renders the overview with comparison deltas', async () => {
        render(<AnalyticsPanel />);
        // "Pageviews" is both a KPI tile and a chart series, so it appears
        // more than once by design.
        expect((await screen.findAllByText('Pageviews')).length).toBeGreaterThan(0);
        expect(await screen.findByText('Top pages')).toBeInTheDocument();
        // 120 pageviews vs 60 in the previous period = +100%. TrendChip renders
        // the arrow inside the same element, so match on a substring.
        expect((await screen.findAllByText(/100%/)).length).toBeGreaterThan(0);
    });

    // The regression this whole change exists for: a dimension that fails
    // upstream must look BROKEN, never like an ordinary empty result.
    it('surfaces partialErrors instead of rendering a silently empty card', async () => {
        routeTo({
            '/settings': SETTINGS,
            '/sites': SITES,
            '/overview': overviewPayload({
                pages: [],
                partialErrors: [{ key: 'pages', message: 'Umami GET /metrics → 400: Bad request' }],
            }),
        });
        render(<AnalyticsPanel />);
        expect(await screen.findByText(/Some data could not be loaded: pages/)).toBeInTheDocument();
        expect(screen.getAllByText(/400/).length).toBeGreaterThan(0);
        expect(screen.queryByText('No page data')).toBeNull();
    });

    it('shows a retry when the whole overview fails', async () => {
        routeTo({
            '/settings': SETTINGS,
            '/sites': SITES,
            '/overview': () => { throw new Error('Failed to load analytics'); },
        });
        render(<AnalyticsPanel />);
        expect(await screen.findByText('Failed to load analytics')).toBeInTheDocument();
        expect(screen.getByTitle('Retry')).toBeInTheDocument();
    });

    it('switches sections and reflects it in the URL', async () => {
        render(<AnalyticsPanel />);
        fireEvent.click(await screen.findByText('Realtime'));
        await waitFor(() => {
            expect(new URLSearchParams(window.location.search).get('section')).toBe('realtime');
        });
    });

    it('adds a drill-down filter chip when a breakdown row is clicked', async () => {
        render(<AnalyticsPanel />);
        fireEvent.click(await screen.findByText('/solutions'));
        expect(await screen.findByText(/Page: \/solutions/)).toBeInTheDocument();
        await waitFor(() => {
            expect(new URLSearchParams(window.location.search).get('f')).toContain('path');
        });
    });

    it('restores filters from the URL on load', async () => {
        window.history.replaceState(null, '', '/app/admin/website-analytics?f=country%3ANL');
        render(<AnalyticsPanel />);
        expect(await screen.findByText(/Country: NL/)).toBeInTheDocument();
    });

    it('opens settings when analytics is not configured yet', async () => {
        routeTo({
            '/settings': { enabled: false, configured: false, consentMode: 'cookieless', url: '' },
            '/sites': { sites: [] },
            '/status': { enabled: false, configured: false, publicUrl: '', internalUrl: '', reachable: false },
        });
        render(<AnalyticsPanel />);
        expect(await screen.findByText('Analytics settings')).toBeInTheDocument();
    });

    it('explains itself when no site is tracked yet', async () => {
        routeTo({
            '/settings': SETTINGS,
            '/sites': { sites: [{ id: 'pj_bbbb2222', name: 'Draft site', live: false, tracked: false }] },
        });
        render(<AnalyticsPanel />);
        expect(await screen.findByText(/No tracked site yet/)).toBeInTheDocument();
    });
});
