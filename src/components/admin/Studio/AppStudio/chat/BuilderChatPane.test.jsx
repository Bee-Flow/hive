import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Markdown rendering is a heavy, separately-tested tree (katex/hljs/mermaid);
// the pane only needs the content to land in the DOM.
vi.mock('@/components/MarkdownRenderer', () => ({
    default: ({ content }) => <div>{content}</div>,
}));

vi.mock('../studioAppsApi', () => {
    const api = { getBuilderSession: vi.fn() };
    return { studioAppsApi: api, default: api };
});

// Keep the real API_BASE etc.; only the network call is stubbed.
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

const clone = (v) => JSON.parse(JSON.stringify(v));

// KITCHEN_SINK plus one extra button on the dashboard — what the AI "built".
const DRAFT = clone(KITCHEN_SINK);
DRAFT.screens[0].sections[0].children.push({
    id: 'cmp_newbtn', type: 'button', visible: true,
    props: { label: 'Ping', variant: 'primary', role: 'button' },
    style: { span: 3, size: 'md', align: 'start' },
});

// A draft whose only addition lives on the (non-active) form screen.
const DRAFT_OTHER_SCREEN = clone(KITCHEN_SINK);
DRAFT_OTHER_SCREEN.screens[1].sections[0].children.push({
    id: 'cmp_formex', type: 'text', visible: true,
    props: { text: 'Extra hint', muted: true },
    style: { span: 12, align: 'start', color: null, weight: 'regular' },
});

const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const enc = new TextEncoder();

/** SSE body that emits `first`, waits for release(), then emits `second`. */
function gatedStream(first, second) {
    let release;
    const gate = new Promise((r) => { release = r; });
    const stream = new ReadableStream({
        async start(controller) {
            controller.enqueue(enc.encode(first.join('')));
            await gate;
            controller.enqueue(enc.encode(second.join('')));
            controller.close();
        },
    });
    return { stream, release: () => release() };
}

function sseResponse(events) {
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(enc.encode(events.join('')));
            controller.close();
        },
    });
    return { ok: true, status: 200, body: stream };
}

// The pane fetches /ai/config/tiers-for-user on mount (model tier selector),
// so order-based once-mocks would be consumed by the tier fetch. Route by URL
// instead: tier calls get an empty tier list; /builder/stream calls are served
// `streams` in order (the last one repeats).
function mockAuthFetchStreams(...streams) {
    let i = 0;
    authFetch.mockImplementation((url) => {
        if (String(url).includes('/ai/config/tiers-for-user')) {
            return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
        }
        return Promise.resolve(streams[Math.min(i++, streams.length - 1)]);
    });
}
const streamCalls = () => authFetch.mock.calls.filter(([u]) => String(u).includes('/builder/stream'));

// Captures the live editor context so tests can assert reducer state.
const ctxRef = { current: null };
function Probe() {
    const ctx = useAppEditor();
    useEffect(() => { ctxRef.current = ctx; });
    return null;
}

function renderPane({ chrome, queryClient } = {}) {
    const c = chrome || { commitTurn: vi.fn(), markSaved: vi.fn() };
    const qc = queryClient || new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
        <QueryClientProvider client={qc}>
            <AppEditorProvider app={{ id: 'app-1', definition: KITCHEN_SINK, version: 3 }}>
                <EditorChromeContext.Provider value={c}>
                    <BuilderChatPane appId="app-1" />
                    <Probe />
                </EditorChromeContext.Provider>
            </AppEditorProvider>
        </QueryClientProvider>,
    );
    return c;
}

async function sendMessage(text) {
    const textarea = screen.getByLabelText('Message the AI builder');
    fireEvent.change(textarea, { target: { value: text } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    // The turn waits for the pre-turn flush, so the request (and the lock that
    // rides with it) lands a microtask later — resolve once it is really away.
    await waitFor(() => expect(streamCalls().length).toBeGreaterThan(0));
    return textarea;
}

beforeEach(() => {
    vi.clearAllMocks();
    ctxRef.current = null;
    const notFound = new Error('no session');
    notFound.status = 404;
    studioAppsApi.getBuilderSession.mockRejectedValue(notFound);
});

describe('BuilderChatPane', () => {
    it('shows the empty state and header before any conversation', () => {
        renderPane();
        expect(screen.getByText('AI builder')).toBeInTheDocument();
        expect(
            screen.getByText("Describe the app you want — I'll build it on the canvas"),
        ).toBeInTheDocument();
    });

    it('runs a full AI turn: lock → transient drafts + pulses → one commit + markSaved → unlock', async () => {
        const { stream, release } = gatedStream(
            [
                sse('builder_session', { sessionId: 'bs-1', appId: 'app-1' }),
                sse('thinking_start', {}),
                sse('thinking', { delta: 'Planning the layout' }),
                sse('thinking_stop', {}),
                sse('tool_call', { name: 'app_add_components', label: 'app_add_components', ok: true, summary: '1 button on Dashboard' }),
                sse('draft', { appId: 'app-1', definition: DRAFT, version: 4 }),
                sse('validation_errors', {
                    errors: [{ message: 'Button missing label' }, { message: 'Table has no source' }],
                    warnings: [],
                }),
                sse('message', { content: 'Added a Ping button to the dashboard.' }),
            ],
            [sse('done', { appId: 'app-1', finalized: true })],
        );
        authFetch.mockResolvedValue({ ok: true, status: 200, body: stream });
        const chrome = renderPane();

        const textarea = await sendMessage('Add a ping button');

        // Stream lock flips on for the whole turn; the composer is disabled.
        await waitFor(() => expect(ctxRef.current.streamLock).toBe(true));
        expect(textarea).toBeDisabled();

        // The draft applied to the context definition (transiently — no commit yet)…
        await waitFor(() => {
            expect(JSON.stringify(ctxRef.current.definition)).toContain('cmp_newbtn');
        });
        expect(chrome.commitTurn).not.toHaveBeenCalled();
        expect(chrome.markSaved).not.toHaveBeenCalled();

        // …and the added node pulses.
        expect(ctxRef.current.recentlyAddedIds.has('cmp_newbtn')).toBe(true);

        // Tool chip in product language + live validation banner + reasoning.
        expect(screen.getByText('Added components')).toBeInTheDocument();
        expect(screen.getByText('The AI is fixing 2 issues…')).toBeInTheDocument();
        expect(screen.getByText('Button missing label')).toBeInTheDocument();
        expect(screen.getByText(/Planning the layout/)).toBeInTheDocument();

        release();

        // Unlock + exactly ONE history commit for the whole turn.
        await waitFor(() => expect(ctxRef.current.streamLock).toBe(false));
        expect(chrome.commitTurn).toHaveBeenCalledTimes(1);
        expect(chrome.commitTurn.mock.calls[0][0]).toEqual(DRAFT);

        // The server persisted every draft — adopt it, never re-save it.
        expect(chrome.markSaved).toHaveBeenCalledTimes(1);
        expect(chrome.markSaved.mock.calls[0][0]).toBe(chrome.commitTurn.mock.calls[0][0]);
        expect(chrome.markSaved.mock.calls[0][1]).toBe(4);
        expect(ctxRef.current.version).toBe(4);

        // Transcript settled; composer usable again.
        expect(screen.getByText('Added a Ping button to the dashboard.')).toBeInTheDocument();
        expect(textarea).not.toBeDisabled();
    });

    it('follows the AI to a non-active screen when additions land only there', async () => {
        authFetch.mockResolvedValue(sseResponse([
            sse('builder_session', { sessionId: 'bs-2', appId: 'app-1' }),
            sse('draft', { appId: 'app-1', definition: DRAFT_OTHER_SCREEN, version: 5 }),
            sse('message', { content: 'Added a hint to the request form.' }),
            sse('done', { appId: 'app-1', finalized: true }),
        ]));
        renderPane();
        expect(ctxRef.current.screenId).toBe('scr_dash01');

        await sendMessage('Add a hint to the form');

        await waitFor(() => expect(ctxRef.current.screenId).toBe('scr_form01'));
        await waitFor(() => expect(ctxRef.current.streamLock).toBe(false));
    });

    it('on error: unlocks, keeps the last draft, marks it saved and leaves a chat error item', async () => {
        authFetch.mockResolvedValue(sseResponse([
            sse('builder_session', { sessionId: 'bs-3', appId: 'app-1' }),
            sse('draft', { appId: 'app-1', definition: DRAFT, version: 4 }),
            sse('error', { message: 'The model gave up.' }),
        ]));
        const chrome = renderPane();

        await sendMessage('Break please');

        await waitFor(() => expect(ctxRef.current.streamLock).toBe(false));
        // Last draft stays on the canvas, adopted as saved.
        expect(JSON.stringify(ctxRef.current.definition)).toContain('cmp_newbtn');
        // BUG 5: the applied draft is committed to history as ONE entry (like a
        // successful turn) so the first Cmd+Z lands on the pre-turn state.
        expect(chrome.commitTurn).toHaveBeenCalledTimes(1);
        expect(chrome.commitTurn.mock.calls[0][0]).toEqual(DRAFT);
        expect(chrome.markSaved).toHaveBeenCalledTimes(1);
        expect(chrome.markSaved.mock.calls[0][1]).toBe(4);
        // The failure stays in the transcript.
        expect(screen.getByRole('alert')).toHaveTextContent('The model gave up.');
    });

    it('unlocks when the stream drops without a done event', async () => {
        authFetch.mockResolvedValue(sseResponse([
            sse('builder_session', { sessionId: 'bs-4', appId: 'app-1' }),
            sse('message', { content: 'Working on it' }),
            // …connection cut: no done/error.
        ]));
        const chrome = renderPane();

        await sendMessage('Do something');

        await waitFor(() => expect(ctxRef.current.streamLock).toBe(false));
        expect(chrome.commitTurn).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent(/connection to the AI builder dropped/i);
    });

    it('rehydrates a prior session transcript from the server snapshot', async () => {
        studioAppsApi.getBuilderSession.mockResolvedValue({
            snapshot: {
                sessionId: 'bs-old',
                messages: [
                    { role: 'user', content: 'Make me a tracker' },
                    { role: 'assistant', content: 'Built a tracker with two screens.' },
                ],
                lastValidation: null,
                summary: '',
            },
        });
        renderPane();

        expect(await screen.findByText('Make me a tracker')).toBeInTheDocument();
        expect(screen.getByText('Built a tracker with two screens.')).toBeInTheDocument();
        expect(studioAppsApi.getBuilderSession).toHaveBeenCalledWith('app-1');
    });

    it('data_model events invalidate every data cache family so the canvas reflects AI tables live', async () => {
        authFetch.mockResolvedValue(sseResponse([
            sse('builder_session', { sessionId: 'bs-dm', appId: 'app-1' }),
            sse('tool_call', { name: 'app_upsert_table', ok: true, summary: 'Table "tasks" (tbl_abc123)' }),
            sse('data_model', {
                modelVersion: 1,
                tables: [{ id: 'tbl_abc123', key: 'tasks', name: 'Tasks', fieldCount: 2, rowCount: 0 }],
                datasets: [],
            }),
            sse('tool_call', { name: 'app_seed_records', ok: true, summary: 'Inserted 3 row(s)' }),
            sse('data_model', {
                modelVersion: 1,
                tables: [{ id: 'tbl_abc123', key: 'tasks', name: 'Tasks', fieldCount: 2, rowCount: 3 }],
                datasets: [{ id: 'ds_1', name: 'By status' }],
            }),
            sse('message', { content: 'Created the tasks table with sample data.' }),
            sse('done', { appId: 'app-1', finalized: true }),
        ]));
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
        renderPane({ queryClient });

        await sendMessage('Build a task tracker with data');
        await waitFor(() => expect(ctxRef.current.streamLock).toBe(false));

        // One invalidation per family, per data_model event (2 events × 5 families).
        const families = [
            ['studio-app-tables', 'app-1'],
            ['studio-app-datasets', 'app-1'],
            ['studio-app-schema', 'app-1'],
            ['studio-app-members', 'app-1'],
            ['studio-app-data', 'app-1'],
        ];
        for (const queryKey of families) {
            expect(invalidate).toHaveBeenCalledWith({ queryKey });
        }
        expect(invalidate).toHaveBeenCalledTimes(families.length * 2);

        // Data tool chips render in product language.
        expect(screen.getByText('Created table')).toBeInTheDocument();
        expect(screen.getByText('Added sample data')).toBeInTheDocument();
    });

    it('Shift+Enter inserts a newline instead of sending', async () => {
        renderPane();
        const textarea = screen.getByLabelText('Message the AI builder');
        fireEvent.change(textarea, { target: { value: 'line one' } });
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
        expect(streamCalls()).toHaveLength(0);
        expect(ctxRef.current.streamLock).toBe(false);
    });

    it('renders the editable PlanCard when the AI proposes a plan (awaitingPlan → no commit)', async () => {
        authFetch.mockResolvedValue(sseResponse([
            sse('builder_session', { sessionId: 'bs-plan', appId: 'app-1' }),
            sse('plan', {
                planId: 'pl-1',
                plan: { title: 'Tracker', tables: [{ name: 'Tasks', fields: [] }], roles: [], datasets: [], screens: [] },
            }),
            sse('message', { content: 'Here is a plan.' }),
            sse('done', { appId: 'app-1', awaitingPlan: true }),
        ]));
        const chrome = renderPane();

        await sendMessage('Build a big project tracker');
        await waitFor(() => expect(ctxRef.current.streamLock).toBe(false));

        // The editable plan card is in the transcript…
        expect(await screen.findByText('Build it')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Tracker')).toBeInTheDocument();
        // …and a plan is NOT a draft — no history commit for it.
        expect(chrome.commitTurn).not.toHaveBeenCalled();
    });

    it('Build it on the plan card sends the EDITED approval turn', async () => {
        mockAuthFetchStreams(
            sseResponse([
                sse('builder_session', { sessionId: 'bs-plan', appId: 'app-1' }),
                sse('plan', {
                    planId: 'pl-1',
                    plan: { title: 'Tracker', tables: [], roles: [], datasets: [], screens: [] },
                }),
                sse('done', { appId: 'app-1', awaitingPlan: true }),
            ]),
            sseResponse([sse('done', { appId: 'app-1', finalized: true })]),
        );
        renderPane({ chrome: { flush: vi.fn().mockResolvedValue(), commitTurn: vi.fn(), markSaved: vi.fn() } });

        await sendMessage('Build a tracker');
        const title = await screen.findByDisplayValue('Tracker');
        fireEvent.change(title, { target: { value: 'My Tracker' } });
        fireEvent.click(screen.getByText('Build it'));

        await waitFor(() => expect(streamCalls().length).toBe(2));
        const body = JSON.parse(streamCalls()[1][1].body);
        expect(body.plan).toEqual(expect.objectContaining({ planId: 'pl-1', action: 'approve' }));
        expect(body.plan.plan.title).toBe('My Tracker');
    });

    it('shows a "What changed" chip after a turn: click-to-select + Undo turn', async () => {
        authFetch.mockResolvedValue(sseResponse([
            sse('builder_session', { sessionId: 'bs-wc', appId: 'app-1' }),
            sse('draft', { appId: 'app-1', definition: DRAFT, version: 4 }),
            sse('message', { content: 'Added a button.' }),
            sse('done', { appId: 'app-1', finalized: true }),
        ]));
        const undoTurn = vi.fn();
        renderPane({ chrome: { flush: vi.fn().mockResolvedValue(), commitTurn: vi.fn(), markSaved: vi.fn(), undoTurn } });

        await sendMessage('Add a button');
        await waitFor(() => expect(ctxRef.current.streamLock).toBe(false));

        // Collapsible summary appears; expand it.
        fireEvent.click(await screen.findByText('What changed'));
        // The added node is listed by its type — clicking selects it on the canvas.
        fireEvent.click(screen.getByText('button'));
        await waitFor(() => expect(ctxRef.current.selectedNodeId).toBe('cmp_newbtn'));
        // "Undo turn" reuses the shell's single history.undo.
        fireEvent.click(screen.getByText('Undo turn'));
        expect(undoTurn).toHaveBeenCalledTimes(1);
    });

    it('maps a retryable error code to friendly copy + a Try again button that re-runs the turn', async () => {
        mockAuthFetchStreams(
            sseResponse([
                sse('builder_session', { sessionId: 'bs-e1', appId: 'app-1' }),
                sse('error', { message: 'raw provider text', code: 'transient_upstream' }),
            ]),
            sseResponse([sse('done', { appId: 'app-1', finalized: true })]),
        );
        renderPane({ chrome: { flush: vi.fn().mockResolvedValue(), commitTurn: vi.fn(), markSaved: vi.fn() } });

        await sendMessage('Build a thing');
        await waitFor(() => expect(ctxRef.current.streamLock).toBe(false));

        // Friendly copy replaces the raw server message for a known code.
        expect(screen.getByRole('alert')).toHaveTextContent(/brief hiccup/i);
        expect(screen.queryByText('raw provider text')).not.toBeInTheDocument();

        // "Try again" re-runs the last turn verbatim (a second stream fires).
        fireEvent.click(screen.getByText('Try again'));
        await waitFor(() => expect(streamCalls().length).toBe(2));
        expect(JSON.parse(streamCalls()[1][1].body).message).toBe('Build a thing');
    });

    it('a non-retryable error code (subscription_limit) shows an upgrade hint with no retry', async () => {
        authFetch.mockResolvedValue(sseResponse([
            sse('builder_session', { sessionId: 'bs-e2', appId: 'app-1' }),
            sse('error', { message: 'limit', code: 'subscription_limit' }),
        ]));
        renderPane({ chrome: { flush: vi.fn().mockResolvedValue(), commitTurn: vi.fn(), markSaved: vi.fn() } });

        await sendMessage('Build a thing');
        await waitFor(() => expect(ctxRef.current.streamLock).toBe(false));

        expect(screen.getByRole('alert')).toHaveTextContent(/upgrade your plan/i);
        expect(screen.queryByText('Try again')).not.toBeInTheDocument();
    });

    it('waits for the pending edit to save before locking the canvas and sending the turn', async () => {
        authFetch.mockResolvedValue(sseResponse([sse('done', { appId: 'app-1', finalized: true })]));
        let finishFlush;
        const flush = vi.fn(() => new Promise((r) => { finishFlush = r; }));
        renderPane({ chrome: { flush, commitTurn: vi.fn(), markSaved: vi.fn() } });

        const textarea = screen.getByLabelText('Message the AI builder');
        fireEvent.change(textarea, { target: { value: 'Add a ping button' } });
        fireEvent.keyDown(textarea, { key: 'Enter' });

        // The edit is still saving: the lock would pause autosave and strand it,
        // so nothing is locked and no turn has started yet…
        await waitFor(() => expect(flush).toHaveBeenCalledTimes(1));
        expect(ctxRef.current.streamLock).toBe(false);
        expect(streamCalls()).toHaveLength(0);
        // …but the composer is already closed, so no second turn can slip in.
        expect(textarea).toBeDisabled();

        await act(async () => { finishFlush(); });
        await waitFor(() => expect(streamCalls()).toHaveLength(1));
        await waitFor(() => expect(ctxRef.current.streamLock).toBe(false));
    });

    it('adopts the draft version of an awaiting-plan turn so the next save does not conflict', async () => {
        authFetch.mockResolvedValue(sseResponse([
            sse('builder_session', { sessionId: 'bs-pv', appId: 'app-1' }),
            sse('draft', { appId: 'app-1', definition: DRAFT, version: 7 }),
            sse('plan', { planId: 'pl-1', plan: { title: 'Tracker', tables: [], roles: [], datasets: [], screens: [] } }),
            sse('done', { appId: 'app-1', awaitingPlan: true }),
        ]));
        const chrome = renderPane({ chrome: { flush: vi.fn().mockResolvedValue(), commitTurn: vi.fn(), markSaved: vi.fn() } });

        await sendMessage('Build a big project tracker');
        await waitFor(() => expect(ctxRef.current.streamLock).toBe(false));

        // A plan is not a draft — still no history entry…
        expect(chrome.commitTurn).not.toHaveBeenCalled();
        // …but the draft the AI did persist is adopted, version and all.
        expect(chrome.markSaved).toHaveBeenCalledTimes(1);
        expect(chrome.markSaved.mock.calls[0][1]).toBe(7);
        expect(ctxRef.current.version).toBe(7);
    });

    it('"Undo turn" retires with the summary — one click, never a second', async () => {
        authFetch.mockResolvedValue(sseResponse([
            sse('draft', { appId: 'app-1', definition: DRAFT, version: 4 }),
            sse('done', { appId: 'app-1', finalized: true }),
        ]));
        const undoTurn = vi.fn();
        renderPane({ chrome: { flush: vi.fn().mockResolvedValue(), commitTurn: vi.fn(), markSaved: vi.fn(), undoTurn } });

        await sendMessage('Add a button');
        await waitFor(() => expect(ctxRef.current.streamLock).toBe(false));
        fireEvent.click(await screen.findByText('What changed'));
        fireEvent.click(screen.getByText('Undo turn'));

        expect(undoTurn).toHaveBeenCalledTimes(1);
        // The turn is gone: a second click would eat the user's OWN prior edit.
        expect(screen.queryByText('Undo turn')).not.toBeInTheDocument();
        expect(screen.queryByText('What changed')).not.toBeInTheDocument();
    });

    it('asks for the builder tier list, not the direct-chat one', async () => {
        renderPane();
        await waitFor(() => expect(
            authFetch.mock.calls.some(([u]) => String(u).includes('/ai/config/tiers-for-user')),
        ).toBe(true));
        const [url] = authFetch.mock.calls.find(([u]) => String(u).includes('/ai/config/tiers-for-user'));
        expect(String(url)).not.toContain('direct_chat');
    });

    it('offers Stop while building: the run ends, the work so far is kept and it says so', async () => {
        const { stream, release } = gatedStream(
            [
                sse('builder_session', { sessionId: 'bs-stop', appId: 'app-1' }),
                sse('draft', { appId: 'app-1', definition: DRAFT, version: 4 }),
                sse('message', { content: 'Adding the button…' }),
            ],
            [sse('done', { appId: 'app-1', finalized: true })],
        );
        authFetch.mockResolvedValue({ ok: true, status: 200, body: stream });
        const chrome = renderPane({ chrome: { flush: vi.fn().mockResolvedValue(), commitTurn: vi.fn(), markSaved: vi.fn() } });

        await sendMessage('Build a huge app');
        await waitFor(() => expect(ctxRef.current.streamLock).toBe(true));

        // Everything else is disabled mid-build, so Stop takes the Send slot.
        expect(screen.queryByLabelText('Send')).not.toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Stop'));

        // The editor is usable again and the drafts that landed are kept + adopted.
        await waitFor(() => expect(ctxRef.current.streamLock).toBe(false));
        expect(JSON.stringify(ctxRef.current.definition)).toContain('cmp_newbtn');
        expect(chrome.commitTurn).toHaveBeenCalledTimes(1);
        expect(chrome.markSaved).toHaveBeenCalledTimes(1);
        expect(screen.getByText(/You stopped the build/)).toBeInTheDocument();
        expect(screen.getByLabelText('Send')).toBeInTheDocument();
        release();
    });

    it('says what a validation issue means, with the validator wording one click deeper', async () => {
        authFetch.mockResolvedValue(sseResponse([
            sse('validation_errors', {
                errors: [{
                    code: 'binding.filter_invalid',
                    message: 'A filter value must be a literal, an array of literals (for in/between), or {kind:"formula", expr}.',
                    hint: 'Wrap dynamic values as a formula.',
                }, {
                    code: 'prop.required',
                }],
                warnings: [],
            }),
            sse('done', { appId: 'app-1', finalized: true }),
        ]));
        renderPane({ chrome: { flush: vi.fn().mockResolvedValue(), commitTurn: vi.fn(), markSaved: vi.fn() } });

        await sendMessage('Filter the table');
        await waitFor(() => expect(ctxRef.current.streamLock).toBe(false));

        // The plain-English hint leads; the validator's own wording is tucked
        // behind a disclosure instead of being the headline.
        expect(screen.getByText('Wrap dynamic values as a formula.')).toBeInTheDocument();
        expect(screen.getByText(/must be a literal/).closest('details')).not.toBeNull();
        expect(screen.getAllByText('Technical detail').length).toBeGreaterThan(0);
        // A record with nothing but a code never shows the code as the message —
        // the code itself stays available as the technical detail.
        expect(screen.getByText('Something here needs attention')).toBeInTheDocument();
        expect(screen.getByText('prop.required').closest('details')).not.toBeNull();
    });

    it('quick actions force planMode:"never" (small asks skip the plan)', async () => {
        authFetch.mockResolvedValue(sseResponse([sse('done', { appId: 'app-1', finalized: true })]));
        renderPane({ chrome: { flush: vi.fn().mockResolvedValue(), commitTurn: vi.fn(), markSaved: vi.fn() } });

        await waitFor(() => expect(ctxRef.current).not.toBeNull());
        fireEvent.click(screen.getByText('New screen'));

        await waitFor(() => expect(
            authFetch.mock.calls.some(([u]) => String(u).includes('/builder/stream')),
        ).toBe(true));
        const call = authFetch.mock.calls.find(([u]) => String(u).includes('/builder/stream'));
        expect(JSON.parse(call[1].body).planMode).toBe('never');
    });
});
