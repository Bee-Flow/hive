import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
// Tier selection fetches /ai/config/tiers-for-user — stub it out entirely.
vi.mock('../../../../hooks/useModelTierSelection', () => ({
    default: () => ({ modelTiers: {}, selectedTier: 'auto', setSelectedTier: vi.fn() }),
}));

import { authFetch } from '@/utils/helpers';
import CmsAssistantPane from './CmsAssistantPane';

const SITE_ID = 'pj_abc1';

function sseResponse(events) {
    const text = events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('');
    return {
        ok: true,
        status: 200,
        body: new ReadableStream({
            start(c) {
                c.enqueue(new TextEncoder().encode(text));
                c.close();
            },
        }),
    };
}

const noSession = { ok: false, status: 404, json: async () => ({}) };

function makeBridge() {
    return {
        beginTurn: vi.fn(async () => {}),
        applyExternalDraft: vi.fn(),
        endTurn: vi.fn(),
        undoTurn: vi.fn(),
        context: vi.fn(() => ({ activePageId: 'pg_1', activeBlockId: null, activeLocale: 'en' })),
        selectPage: vi.fn(),
    };
}

beforeEach(() => {
    vi.restoreAllMocks();
});

describe('CmsAssistantPane', () => {
    it('runs a turn through the bridge: beginTurn before fetch, drafts folded in, endTurn + What changed', async () => {
        const bridge = makeBridge();
        let fetchOrder = [];
        authFetch.mockImplementation(async (url) => {
            fetchOrder.push(url);
            if (String(url).includes('/session/')) return noSession;
            return sseResponse([
                ['builder_session', { sessionId: 'cbs_1', siteId: SITE_ID }],
                ['message', { content: 'Done.' }],
                ['tool_call', { name: 'cms_create_page', label: 'Created page', ok: true, summary: '/pricing' }],
                ['draft', { siteId: SITE_ID, kind: 'page', pageId: 'pg_9', page: { id: 'pg_9', blocks: [] } }],
                ['done', { siteId: SITE_ID, createdPageIds: ['pg_9'], touchedPageIds: ['pg_9'] }],
            ]);
        });

        render(
            <CmsAssistantPane
                siteId={SITE_ID}
                bridge={bridge}
                pages={[{ id: 'pg_9', slug: 'pricing', title: 'Pricing' }]}
                canUndoTurn
            />,
        );

        fireEvent.change(screen.getByPlaceholderText(/Describe what to build/), { target: { value: 'Add a pricing page' } });
        fireEvent.click(screen.getByText('Send'));

        await waitFor(() => expect(bridge.endTurn).toHaveBeenCalled());
        // beginTurn (drain + snapshot + lock) strictly before the stream POST
        expect(bridge.beginTurn).toHaveBeenCalledTimes(1);
        expect(bridge.beginTurn.mock.invocationCallOrder[0])
            .toBeLessThan(authFetch.mock.invocationCallOrder.at(-1));
        // draft folded in via the bridge — never through the autosave queue
        expect(bridge.applyExternalDraft).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'page', pageId: 'pg_9' }),
        );
        expect(bridge.endTurn).toHaveBeenCalledWith(
            expect.objectContaining({ createdPageIds: ['pg_9'] }),
        );
        // What changed chip + Undo turn affordance
        await screen.findByText('What changed');
        expect(screen.getByText('+ Pricing')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Undo turn'));
        expect(bridge.undoTurn).toHaveBeenCalled();
        // chip click focuses the page
        fireEvent.click(screen.getByText('+ Pricing'));
        expect(bridge.selectPage).toHaveBeenCalledWith('pg_9');
    });

    it('arms What changed + Undo for a header-only turn (no page ids in done)', async () => {
        const bridge = makeBridge();
        authFetch.mockImplementation(async (url) => {
            if (String(url).includes('/session/')) return noSession;
            return sseResponse([
                ['builder_session', { sessionId: 'cbs_h', siteId: SITE_ID }],
                ['tool_call', { name: 'cms_update_header_nav', label: 'Updated header menu', ok: true, summary: '3 menu items' }],
                ['draft', { siteId: SITE_ID, kind: 'site', site: { id: SITE_ID, pages: [], header: { nav: [] } } }],
                ['done', { siteId: SITE_ID, createdPageIds: [], touchedPageIds: [] }],
            ]);
        });

        render(<CmsAssistantPane siteId={SITE_ID} bridge={bridge} pages={[]} canUndoTurn />);
        fireEvent.change(screen.getByPlaceholderText(/Describe what to build/), { target: { value: 'Add pricing to the menu' } });
        fireEvent.click(screen.getByText('Send'));

        await waitFor(() => expect(bridge.endTurn).toHaveBeenCalled());
        expect(bridge.applyExternalDraft).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'site' }),
        );
        // Header-only turns still surface What changed + Undo turn
        await screen.findByText('What changed');
        expect(screen.getByText('Undo turn')).toBeInTheDocument();
        // The site chip focuses the header entry
        fireEvent.click(screen.getByText(/Header menu/));
        expect(bridge.selectPage).toHaveBeenCalledWith('__header__');
    });

    it('arms What changed + Undo for a design-only turn with a chip pointing at the Design entry', async () => {
        const bridge = makeBridge();
        authFetch.mockImplementation(async (url) => {
            if (String(url).includes('/session/')) return noSession;
            return sseResponse([
                ['builder_session', { sessionId: 'cbs_d', siteId: SITE_ID }],
                ['tool_call', { name: 'cms_update_design', label: 'Updated design', ok: true, summary: 'preset midnight-flow · theme dark' }],
                ['draft', { siteId: SITE_ID, kind: 'site', site: { id: SITE_ID, pages: [], design: { preset: 'midnight-flow' } } }],
                ['done', { siteId: SITE_ID, createdPageIds: [], touchedPageIds: [] }],
            ]);
        });

        render(<CmsAssistantPane siteId={SITE_ID} bridge={bridge} pages={[]} canUndoTurn />);
        fireEvent.change(screen.getByPlaceholderText(/Describe what to build/), { target: { value: 'Make it look like a dark dev tool' } });
        fireEvent.click(screen.getByText('Send'));

        await waitFor(() => expect(bridge.endTurn).toHaveBeenCalled());
        expect(bridge.applyExternalDraft).toHaveBeenCalledWith(expect.objectContaining({ kind: 'site' }));
        // Design-only turns (no page ids in done) still surface What changed + Undo.
        await screen.findByText('What changed');
        expect(screen.getByText('Undo turn')).toBeInTheDocument();
        expect(screen.queryByText(/Header menu/)).toBeNull();
        // …and the chip focuses the DESIGN entry, not the header one.
        fireEvent.click(screen.getByText(/Design/));
        expect(bridge.selectPage).toHaveBeenCalledWith('__design__');
    });

    it('emits one chip per touched surface when a turn rethemes AND rewrites the menu', async () => {
        const bridge = makeBridge();
        authFetch.mockImplementation(async (url) => {
            if (String(url).includes('/session/')) return noSession;
            return sseResponse([
                ['builder_session', { sessionId: 'cbs_dh', siteId: SITE_ID }],
                ['tool_call', { name: 'cms_update_design', label: 'Updated design', ok: true, summary: 'preset enterprise' }],
                ['tool_call', { name: 'cms_update_header_nav', label: 'Updated header menu', ok: true, summary: '2 menu items' }],
                ['done', { siteId: SITE_ID, createdPageIds: [], touchedPageIds: [] }],
            ]);
        });

        render(<CmsAssistantPane siteId={SITE_ID} bridge={bridge} pages={[]} canUndoTurn />);
        fireEvent.change(screen.getByPlaceholderText(/Describe what to build/), { target: { value: 'Retheme and fix the menu' } });
        fireEvent.click(screen.getByText('Send'));

        await waitFor(() => expect(bridge.endTurn).toHaveBeenCalled());
        await screen.findByText('What changed');
        fireEvent.click(screen.getByText(/Design/));
        expect(bridge.selectPage).toHaveBeenCalledWith('__design__');
        fireEvent.click(screen.getByText(/Header menu/));
        expect(bridge.selectPage).toHaveBeenCalledWith('__header__');
    });

    it('maps taxonomy error codes to product copy and unlocks via endTurn', async () => {
        const bridge = makeBridge();
        authFetch.mockImplementation(async (url) => {
            if (String(url).includes('/session/')) return noSession;
            return sseResponse([['error', { message: 'nope', code: 'budget_exhausted' }]]);
        });
        render(<CmsAssistantPane siteId={SITE_ID} bridge={bridge} pages={[]} />);
        fireEvent.change(screen.getByPlaceholderText(/Describe what to build/), { target: { value: 'go' } });
        fireEvent.click(screen.getByText('Send'));
        await screen.findByText(/hit its per-turn limit/);
        expect(bridge.endTurn).toHaveBeenCalledWith({ failed: true });
        // Retry re-sends the same turn
        authFetch.mockClear();
        fireEvent.click(screen.getByText('Try again'));
        await waitFor(() => expect(authFetch).toHaveBeenCalled());
    });

    it('disables building in translation mode with a pointer to AI translate', async () => {
        const bridge = makeBridge();
        authFetch.mockResolvedValue(noSession);
        render(
            <CmsAssistantPane
                siteId={SITE_ID}
                bridge={bridge}
                pages={[]}
                translationMode
                defaultLocaleName="English"
            />,
        );
        expect(screen.queryByPlaceholderText(/Describe what to build/)).toBeNull();
        expect(screen.getByText(/Switch back to English/)).toBeInTheDocument();
    });

    it('quick actions prefill the composer without sending', async () => {
        const bridge = makeBridge();
        authFetch.mockResolvedValue(noSession);
        render(<CmsAssistantPane siteId={SITE_ID} bridge={bridge} pages={[]} />);
        fireEvent.click(await screen.findByText(/pricing page with a hero/));
        expect(screen.getByPlaceholderText(/Describe what to build/).value).toMatch(/pricing page/);
        expect(bridge.beginTurn).not.toHaveBeenCalled();
    });
});
