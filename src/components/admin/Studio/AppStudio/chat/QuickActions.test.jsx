import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import QuickActions from './QuickActions';

vi.mock('@/components/MarkdownRenderer', () => ({ default: ({ content }) => <div>{content}</div> }));
vi.mock('../studioAppsApi', () => {
    const api = { getBuilderSession: vi.fn() };
    return { studioAppsApi: api, default: api };
});
vi.mock('@/utils/helpers', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, authFetch: vi.fn() };
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authFetch } from '@/utils/helpers';
import BuilderChatPane from './BuilderChatPane';
import { EditorChromeContext } from '../editor/EditorChromeContext';
import { AppEditorProvider, useAppEditor } from '../state/AppEditorContext';
import { KITCHEN_SINK } from '../state/sampleDefinitions';
import { studioAppsApi } from '../studioAppsApi';

const enc = new TextEncoder();
const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
function sseResponse(events) {
    const stream = new ReadableStream({
        start(controller) { controller.enqueue(enc.encode(events.join(''))); controller.close(); },
    });
    return { ok: true, status: 200, body: stream };
}

describe('QuickActions (unit)', () => {
    it('fires onAction with the chip prompt', () => {
        const onAction = vi.fn();
        render(<QuickActions onAction={onAction} />);
        fireEvent.click(screen.getByText('Use my data'));
        expect(onAction).toHaveBeenCalledTimes(1);
        expect(onAction.mock.calls[0][0]).toMatch(/data/i);
    });

    it('wraps the chips and leads with "Fix errors" once there is something to repair', () => {
        const { container, rerender } = render(<QuickActions onAction={vi.fn()} hasErrors={false} />);
        const row = container.querySelector('[data-quick-actions]');
        // The pane is ~340px wide: chips wrap, they never scroll out of reach.
        expect(row.className).toContain('flex-wrap');
        expect(row.className).not.toContain('overflow-x-auto');
        expect([...row.querySelectorAll('button')].map((b) => b.textContent.trim()))
            .toEqual(['Use my data', 'New screen', 'Fix errors']);
        // The short labels keep the full wording one hover away.
        expect(screen.getByText('Use my data').closest('button')).toHaveAttribute('title', expect.stringContaining('Connect'));

        // Something is broken → the recovery chip comes first.
        rerender(<QuickActions onAction={vi.fn()} hasErrors />);
        expect([...row.querySelectorAll('button')][0]).toHaveTextContent('Fix errors');
    });

    it('disables "Fix errors" until there are errors', () => {
        const onAction = vi.fn();
        const { rerender } = render(<QuickActions onAction={onAction} hasErrors={false} />);
        fireEvent.click(screen.getByText('Fix errors'));
        expect(onAction).not.toHaveBeenCalled();

        rerender(<QuickActions onAction={onAction} hasErrors />);
        fireEvent.click(screen.getByText('Fix errors'));
        expect(onAction).toHaveBeenCalledTimes(1);
    });
});

const ctxRef = { current: null };
function Probe() {
    const ctx = useAppEditor();
    useEffect(() => { ctxRef.current = ctx; });
    return null;
}

describe('QuickActions → BuilderChatPane sends selection context', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        ctxRef.current = null;
        const notFound = new Error('no session');
        notFound.status = 404;
        studioAppsApi.getBuilderSession.mockRejectedValue(notFound);
    });

    it('threads the current selection + screen into the builder request', async () => {
        authFetch.mockResolvedValue(sseResponse([sse('done', { appId: 'app-1', finalized: true })]));
        const chrome = { flush: vi.fn().mockResolvedValue(), commitTurn: vi.fn(), markSaved: vi.fn() };

        render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <AppEditorProvider app={{ id: 'app-1', definition: KITCHEN_SINK, version: 3 }}>
                    <EditorChromeContext.Provider value={chrome}>
                        <BuilderChatPane appId="app-1" />
                        <Probe />
                    </EditorChromeContext.Provider>
                </AppEditorProvider>
            </QueryClientProvider>,
        );

        // Select a node, then click the "Use my data" quick action.
        await waitFor(() => expect(ctxRef.current).not.toBeNull());
        act(() => ctxRef.current.dispatch({ type: 'select_node', nodeId: 'cmp_headg1' }));
        fireEvent.click(screen.getByText('Use my data'));

        await waitFor(() => {
            expect(authFetch.mock.calls.some(([u]) => String(u).includes('/builder/stream'))).toBe(true);
        });
        const call = authFetch.mock.calls.find(([u]) => String(u).includes('/builder/stream'));
        const body = JSON.parse(call[1].body);
        expect(body.context).toBeTruthy();
        expect(body.context.selectedNodeIds).toContain('cmp_headg1');
        expect(body.context.screenId).toBe('scr_dash01');
        expect(body.message).toMatch(/data/i);
    });
});
