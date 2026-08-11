import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));

import { authFetch } from '@/utils/helpers';
import useCmsBuilderStream from './useCmsBuilderStream';

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

beforeEach(() => {
    vi.restoreAllMocks();
});

describe('useCmsBuilderStream', () => {
    it('rehydrates the site-scoped session snapshot on mount', async () => {
        authFetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                snapshot: {
                    sessionId: 'cbs_1',
                    messages: [{ role: 'user', content: 'earlier' }, { role: 'assistant', content: 'done that' }],
                    lastValidation: { errors: [], warnings: [] },
                },
            }),
        });
        const { result } = renderHook(() => useCmsBuilderStream({ siteId: SITE_ID }));
        await waitFor(() => expect(result.current.sessionId).toBe('cbs_1'));
        expect(result.current.messages).toHaveLength(2);
        expect(authFetch).toHaveBeenCalledWith(`/api/cms/builder/session/${SITE_ID}`);
    });

    it('streams a turn: deltas, tool chips, drafts, validation and done', async () => {
        const onDraft = vi.fn();
        const onToolCall = vi.fn();
        const onDone = vi.fn();
        authFetch.mockResolvedValueOnce(noSession); // rehydrate
        authFetch.mockResolvedValueOnce(sseResponse([
            ['builder_session', { sessionId: 'cbs_2', siteId: SITE_ID }],
            ['model_selected', { modelId: 'm', tier: 'thinking' }],
            ['message', { content: 'Creating ' }],
            ['message', { content: 'the page…' }],
            ['tool_call', { name: 'cms_create_page', label: 'Created page', ok: true, summary: '/pricing' }],
            ['draft', { siteId: SITE_ID, kind: 'site', site: { id: SITE_ID, pages: [] } }],
            ['draft', { siteId: SITE_ID, kind: 'page', pageId: 'pg_9', page: { id: 'pg_9', blocks: [] } }],
            ['validation_errors', { errors: [{ code: 'empty_page', message: 'Page is empty' }], warnings: [] }],
            ['done', { siteId: SITE_ID, createdPageIds: ['pg_9'], touchedPageIds: ['pg_9'] }],
        ]));

        const { result } = renderHook(() => useCmsBuilderStream({ siteId: SITE_ID, onDraft, onToolCall, onDone }));
        await act(async () => {
            await result.current.send('Add a pricing page', { modelTier: 'thinking', context: { activePageId: null } });
        });

        const [, opts] = authFetch.mock.calls.at(-1);
        const body = JSON.parse(opts.body);
        expect(body).toMatchObject({ message: 'Add a pricing page', siteId: SITE_ID, modelTier: 'thinking' });

        const assistant = result.current.messages.find(m => m.role === 'assistant');
        expect(assistant.content).toBe('Creating the page…');
        expect(assistant.autoSelectedTier).toBe('thinking');
        expect(result.current.messages.some(m => m.kind === 'tool' && m.label === 'Created page')).toBe(true);
        expect(onToolCall).toHaveBeenCalledTimes(1);
        expect(onDraft).toHaveBeenCalledTimes(2);
        expect(onDraft.mock.calls[1][0]).toMatchObject({ kind: 'page', pageId: 'pg_9' });
        expect(result.current.lastValidation.errors).toHaveLength(1);
        expect(onDone).toHaveBeenCalledWith({ siteId: SITE_ID, createdPageIds: ['pg_9'], touchedPageIds: ['pg_9'] });
        expect(result.current.running).toBe(false);
    });

    it('maps gateway drops to the friendly saved-progress message', async () => {
        const onError = vi.fn();
        authFetch.mockResolvedValueOnce(noSession);
        authFetch.mockResolvedValueOnce({ ok: false, status: 504, json: async () => ({}) });
        const { result } = renderHook(() => useCmsBuilderStream({ siteId: SITE_ID, onError }));
        await act(async () => { await result.current.send('hi'); });
        const err = result.current.messages.find(m => m.kind === 'error');
        expect(err.message).toMatch(/pages are already saved/i);
        expect(onError).toHaveBeenCalled();
    });

    it('surfaces in-stream taxonomy errors with their code', async () => {
        const onError = vi.fn();
        authFetch.mockResolvedValueOnce(noSession);
        authFetch.mockResolvedValueOnce(sseResponse([
            ['error', { message: 'limit reached', code: 'subscription_limit' }],
        ]));
        const { result } = renderHook(() => useCmsBuilderStream({ siteId: SITE_ID, onError }));
        await act(async () => { await result.current.send('hi'); });
        expect(onError).toHaveBeenCalledWith('limit reached', 'subscription_limit');
        expect(result.current.messages.at(-1)).toMatchObject({ kind: 'error', code: 'subscription_limit' });
    });
});
