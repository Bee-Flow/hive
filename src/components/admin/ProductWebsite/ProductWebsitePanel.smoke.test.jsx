// Smoke test for the CMS panel container — the safety net for the builder
// redesign. Pins the load → edit → debounced-save → publish pipeline at the
// network boundary (mocked authFetch), driving the edit through the real
// cms-edit postMessage protocol rather than editor internals.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));

// Stub the AI assistant pane so tests can flip the builder stream lock via
// the real bridge (beginTurn) without dragging the streaming UI + its
// network calls into the smoke test.
vi.mock('./assistant/CmsAssistantPane', () => ({
    default: function FakeAssistantPane({ bridge }) {
        return (
            <button type="button" data-testid="begin-turn" onClick={() => bridge.beginTurn()}>
                begin turn
            </button>
        );
    },
}));

import { authFetch } from '../../../utils/helpers';
import ProductWebsitePanel from './ProductWebsitePanel';

const SITE_ID = 'pj_abc1';
const PAGE_ID = 'pg_1';

function sitePayload() {
    return {
        defaultLocale: 'en',
        locales: [
            { code: 'en', name: 'English', isDefault: true },
            { code: 'nl', name: 'Nederlands' },
        ],
        site: {
            version: 3, id: SITE_ID, name: 'Test Site',
            versionGroupId: 'vg_1', versionName: 'v1', homepageId: PAGE_ID,
            pages: [{ id: PAGE_ID, slug: 'home', title: 'Home', isHomepage: true }],
            header: { nav: [], ctas: [] },
            footer: { columns: [], socials: [] },
            cookieBanner: { enabled: false, text: {} },
            design: {},
        },
        pages: [{
            version: 1, id: PAGE_ID, slug: 'home', title: 'Home', seo: {},
            blocks: [
                { id: 'b1', type: 'hero', enabled: true, content: { lead: 'Old lead', titleParts: [{ text: 'Hi' }] }, style: {} },
                { id: 'b2', type: 'content', enabled: true, content: {}, style: {} },
            ],
        }],
        localeOverrides: { siteByLocale: {}, pagesByLocale: {} },
        publishedAt: null,
        liveSiteId: null,
    };
}

function jsonResponse(data, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => data,
        headers: { get: () => null },
    };
}

// URL+method router for the mocked network layer. Records every call so
// assertions can inspect bodies.
function installFetchRouter() {
    authFetch.mockImplementation(async (url, opts = {}) => {
        const method = (opts.method || 'GET').toUpperCase();
        if (url === '/api/cms/sites' && method === 'GET') {
            return jsonResponse({
                sites: [{ id: SITE_ID, name: 'Test Site', versionGroupId: 'vg_1', versionName: 'v1' }],
                liveSiteId: null,
            });
        }
        if (url === `/api/cms/sites/${SITE_ID}` && method === 'GET') {
            return jsonResponse(sitePayload());
        }
        if (url === '/api/cms/admin/templates' && method === 'GET') {
            return jsonResponse({ templates: [] });
        }
        if (url === `/api/cms/sites/${SITE_ID}/pages/${PAGE_ID}` && method === 'PUT') {
            return jsonResponse({ success: true, dropped: [] });
        }
        if (url === `/api/cms/sites/${SITE_ID}` && method === 'PUT') {
            return jsonResponse({ success: true });
        }
        if (url === `/api/cms/sites/${SITE_ID}/publish` && method === 'POST') {
            return jsonResponse({ success: true, publishedAt: new Date().toISOString() });
        }
        throw new Error(`Unmocked authFetch call: ${method} ${url}`);
    });
}

function callsMatching(pathPart, method) {
    return authFetch.mock.calls.filter(([url, opts]) =>
        String(url).includes(pathPart) && ((opts?.method || 'GET').toUpperCase() === method));
}

async function renderLoadedPanel() {
    render(<ProductWebsitePanel />);
    // Loaded = the TopBar publish control + the site trigger are on screen.
    await screen.findByText('Publish');
    await screen.findByText('Test Site');
    return screen.getByTitle('Product website preview');
}

// Dispatch a message the way the preview iframe would — the panel's listener
// checks BOTH e.origin and e.source, so the test must satisfy the real guards.
function postFromIframe(iframe, data) {
    fireEvent(window, new MessageEvent('message', {
        data,
        origin: window.location.origin,
        source: iframe.contentWindow,
    }));
}

beforeEach(() => {
    vi.restoreAllMocks();
    // restoreAllMocks doesn't touch vi.fn()s from vi.mock factories — clear
    // authFetch's call history explicitly so per-test callsMatching counts
    // never see the previous test's traffic.
    authFetch.mockClear();
    installFetchRouter();
    localStorage.clear();
});

describe('ProductWebsitePanel smoke', () => {
    it('loads the site payload and renders the editor surfaces', async () => {
        await renderLoadedPanel();
        expect(callsMatching(`/api/cms/sites/${SITE_ID}`, 'GET').length).toBeGreaterThan(0);
        // Navigator Site group entries
        expect(screen.getByText('Design')).toBeInTheDocument();
        expect(screen.getByText('Header')).toBeInTheDocument();
        expect(screen.getByText('Footer')).toBeInTheDocument();
        expect(screen.getByText('Cookie banner')).toBeInTheDocument();
        expect(screen.getAllByText('Home').length).toBeGreaterThan(0);
        // First block auto-selected → hero editor header visible
        expect(screen.getAllByText(/hero/i).length).toBeGreaterThan(0);
    });

    it('applies a cms-edit from the preview and flushes it via the debounced PUT', async () => {
        const iframe = await renderLoadedPanel();
        postFromIframe(iframe, { type: 'cms-preview-ready' });
        postFromIframe(iframe, { type: 'cms-edit', path: 'hero.lead', value: 'New lead', blockId: 'b1' });

        // The 800ms debounce fires on real timers; wait for the PUT.
        await waitFor(() => {
            expect(callsMatching(`/pages/${PAGE_ID}`, 'PUT').length).toBeGreaterThan(0);
        }, { timeout: 3000 });

        const [, opts] = callsMatching(`/pages/${PAGE_ID}`, 'PUT').at(-1);
        const body = JSON.parse(opts.body);
        expect(body.page.blocks[0].content.lead).toBe('New lead');
        // Save pipeline surfaced success
        await screen.findByText('✓ Saved');
    });

    // ── WS3-P1 on-canvas chrome protocol ──────────────────────────────

    it('mirrors selection to the iframe via cms-active after the ready handshake', async () => {
        const iframe = await renderLoadedPanel();
        const postSpy = vi.spyOn(iframe.contentWindow, 'postMessage');
        postFromIframe(iframe, { type: 'cms-preview-ready' });
        await waitFor(() => {
            const active = postSpy.mock.calls.filter(([m]) => m?.type === 'cms-active');
            expect(active.length).toBeGreaterThan(0);
            const [msg] = active.at(-1);
            expect(msg.blockId).toBe('b1');       // first block auto-selected
            expect(msg.locked).toBe(false);
            expect(msg.labels.hero).toBe('Hero'); // catalogue labels ride along
        });
    });

    it('applies a canvas move-down (cms-block-action) through the reorder + autosave path', async () => {
        const iframe = await renderLoadedPanel();
        postFromIframe(iframe, { type: 'cms-block-action', blockId: 'b1', action: 'move-down' });
        await waitFor(() => {
            expect(callsMatching(`/pages/${PAGE_ID}`, 'PUT').length).toBeGreaterThan(0);
        }, { timeout: 3000 });
        const [, opts] = callsMatching(`/pages/${PAGE_ID}`, 'PUT').at(-1);
        const body = JSON.parse(opts.body);
        expect(body.page.blocks.map(b => b.id)).toEqual(['b2', 'b1']);
    });

    it('opens the Add-block dialog from cms-insert-at and inserts at that index', async () => {
        const iframe = await renderLoadedPanel();
        postFromIframe(iframe, { type: 'cms-insert-at', index: 0 });
        const search = await screen.findByPlaceholderText(/Search blocks/);
        // Narrow to a single match, then Enter adds the focused block.
        fireEvent.change(search, { target: { value: 'Stats' } });
        fireEvent.keyDown(search, { key: 'Enter' });
        // Dialog closes; the new block is spliced at index 0 and persisted.
        expect(screen.queryByPlaceholderText(/Search blocks/)).toBeNull();
        await waitFor(() => {
            expect(callsMatching(`/pages/${PAGE_ID}`, 'PUT').length).toBeGreaterThan(0);
        }, { timeout: 3000 });
        const [, opts] = callsMatching(`/pages/${PAGE_ID}`, 'PUT').at(-1);
        const body = JSON.parse(opts.body);
        expect(body.page.blocks).toHaveLength(3);
        expect(body.page.blocks[0].type).toBe('techStats');
        expect(body.page.blocks.slice(1).map(b => b.id)).toEqual(['b1', 'b2']);
    });

    it('refuses canvas mutations while the AI builder turn is running (stream lock)', async () => {
        const iframe = await renderLoadedPanel();
        // Open the (stubbed) assistant and start a turn via the real bridge.
        fireEvent.click(screen.getByTitle('Build pages with the AI assistant'));
        fireEvent.click(await screen.findByTestId('begin-turn'));
        await screen.findAllByText('AI is editing — Stop to take over'); // lock scrim up
        postFromIframe(iframe, { type: 'cms-block-action', blockId: 'b1', action: 'move-down' });
        // Refusal is loud (toast) …
        await screen.findAllByText('The AI assistant is editing — press Stop in the assistant to take over.');
        // … and silent on the wire: no mutation reaches the network even
        // after the debounce window would have fired.
        await new Promise(r => setTimeout(r, 1100));
        expect(callsMatching(`/pages/${PAGE_ID}`, 'PUT').length).toBe(0);
        // The insert-between "+" is gated at the same choke point — the
        // Add-block dialog must not open mid-turn.
        postFromIframe(iframe, { type: 'cms-insert-at', index: 0 });
        expect(screen.queryByPlaceholderText(/Search blocks/)).toBeNull();
    });

    it('publishes after draining saves and updates the status pill', async () => {
        await renderLoadedPanel();
        expect(screen.getByText('Draft — never published')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Publish'));
        await waitFor(() => {
            expect(callsMatching('/publish', 'POST').length).toBe(1);
        }, { timeout: 3000 });
        await screen.findByText(/Published just now/);
        expect(screen.queryByText('Draft — never published')).toBeNull();
    });
});
