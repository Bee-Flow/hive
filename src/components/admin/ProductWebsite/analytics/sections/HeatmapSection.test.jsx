import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../analyticsApi', () => {
    const root = '/api/cms/admin/analytics';
    return {
        analyticsApi: {
            query: (resource, o = {}) => `${root}/query/${resource}?${new URLSearchParams({ ...(o.params || {}) })}`,
            report: (type) => `${root}/report/${type}`,
        },
        reportBody: (o) => ({ ...o }),
        analyticsFetch: (...args) => globalThis.__afetch(...args),
        analyticsPost: (...args) => globalThis.__afetch(...args),
    };
});

import HeatmapSection from './HeatmapSection';

const SITE = { id: 'pj_a', name: 'Main site', websiteId: 'web_1', recording: true };
const SCOPE = { siteId: 'pj_a', range: '7d', timezone: 'UTC', filters: {}, _token: 0 };

const PAGES = [{ urlPath: '/', count: 2, sessions: 1 }];
const POINTS = [
    { x: 144, y: 36, pageX: 144, pageY: 36, pageW: 1280, pageH: 2549, viewportW: 1280, viewportH: 720, count: 2 },
];

function routeTo({ pages = PAGES, points = POINTS, scroll = null } = {}) {
    globalThis.__afetch = vi.fn(async (url, opts) => {
        const u = String(url);
        if (u.includes('/report/heatmap')) {
            const body = opts?.body ? JSON.parse(opts.body) : (opts || {});
            // The index request (no urlPath) populates the page picker.
            if (!body.urlPath) return { data: { mode: 'click', pages, points: [], scroll: null } };
            return { data: { mode: body.mode || 'click', pages, points, scroll } };
        }
        if (u.includes('/query/metrics')) return { data: [{ x: '/', y: 2 }] };
        return { data: null };
    });
}

beforeEach(() => {
    cleanup();
    routeTo();
    // jsdom cannot load the preview route, so the backdrop will never report
    // "rendered" — which is exactly the state these tests care about.
});
afterEach(() => cleanup());

describe('HeatmapSection', () => {
    it('mounts the page frame immediately, before the backdrop is ready', async () => {
        // Regression: the stage used to be hidden behind a loading skeleton
        // until the backdrop reported ready — but the backdrop completes its
        // handshake by posting INTO that frame. No frame meant no handshake,
        // which meant an 8s timeout and "The page preview did not load."
        render(<HeatmapSection scope={SCOPE} site={SITE} settings={{}} />);
        await waitFor(() => {
            expect(screen.getByTitle('Page being analysed')).toBeInTheDocument();
        });
        const frame = screen.getByTitle('Page being analysed');
        expect(frame.tagName).toBe('IFRAME');
        expect(frame.getAttribute('src')).toContain('preview=1');
        // Height must be non-zero or the frame has nothing to render into.
        expect(frame.style.height).not.toBe('0px');
    });

    it('never renders a bare 0 when nothing has been measured yet', async () => {
        // `recordedH && liveH && …` evaluates to the NUMBER 0 before anything
        // is measured, and React happily renders that as text on the page.
        const { container } = render(<HeatmapSection scope={SCOPE} site={SITE} settings={{}} />);
        await waitFor(() => expect(screen.getByTitle('Page being analysed')).toBeInTheDocument());
        const strays = [...container.querySelectorAll('*')].filter(
            el => el.children.length === 0 && el.textContent.trim() === '0',
        );
        expect(strays).toHaveLength(0);
    });

    it('reports the click count from the page index, not the current mode', async () => {
        // Scroll mode returns no points. Reading the count from them made the
        // headline say "0 clicks" beside a picker that said "2 clicks".
        routeTo({ points: [], scroll: { buckets: [{ depth: 20, sessions: 1 }], totalSessions: 1 } });
        render(<HeatmapSection scope={SCOPE} site={SITE} settings={{}} />);
        // "Clicks" is also the mode chip; the headline figure is the non-button.
        await waitFor(() => expect(screen.getAllByText('Clicks').length).toBeGreaterThan(0));
        const label = screen.getAllByText('Clicks').find(el => el.closest('button') === null);
        expect(label).toBeTruthy();
        expect(label.parentElement.textContent).toContain('2');
    });

    it('offers the recording opt-in instead of an empty canvas when recording is off', async () => {
        render(<HeatmapSection scope={SCOPE} site={{ ...SITE, recording: false }} settings={{}} />);
        expect(await screen.findByText(/need session recording/i)).toBeInTheDocument();
        expect(screen.queryByTitle('Page being analysed')).toBeNull();
    });
});
