import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/admin/Studio/AppStudio/studioAppsApi', () => {
    const api = { getBuilderSession: vi.fn() };
    return { studioAppsApi: api, default: api };
});
vi.mock('@/utils/helpers', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, authFetch: vi.fn() };
});

import { studioAppsApi } from '@/components/admin/Studio/AppStudio/studioAppsApi';
import { authFetch } from '@/utils/helpers';
import useAppBuilderStream from './useAppBuilderStream';

const enc = new TextEncoder();
const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function sseResponse(events) {
    const stream = new ReadableStream({
        start(controller) { controller.enqueue(enc.encode(events.join(''))); controller.close(); },
    });
    return { ok: true, status: 200, body: stream };
}

const bodyOf = (call) => JSON.parse(call[1].body);

beforeEach(() => {
    vi.clearAllMocks();
    const notFound = new Error('no session');
    notFound.status = 404;
    studioAppsApi.getBuilderSession.mockRejectedValue(notFound);
});

describe('useAppBuilderStream — plan-first UX', () => {
    it('parses a plan proposal and awaitingPlan suppresses a normal completion', async () => {
        authFetch.mockResolvedValue(sseResponse([
            sse('builder_session', { sessionId: 'bs-1', appId: 'app-1' }),
            sse('plan', { planId: 'pl-1', plan: { title: 'Tracker', tables: [{ name: 'Tasks' }] } }),
            sse('done', { appId: 'app-1', awaitingPlan: true }),
        ]));
        const onPlan = vi.fn();
        const onDone = vi.fn();
        const onDraft = vi.fn();
        const { result } = renderHook(() => useAppBuilderStream({ appId: 'app-1', onPlan, onDone, onDraft }));

        await act(async () => { await result.current.send('Build a big project tracker'); });

        expect(result.current.pendingPlan).toEqual({ planId: 'pl-1', plan: { title: 'Tracker', tables: [{ name: 'Tasks' }] } });
        expect(onPlan).toHaveBeenCalledTimes(1);
        // done carried awaitingPlan → the caller is told NOT to commit.
        expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ awaitingPlan: true }));
        expect(onDraft).not.toHaveBeenCalled();
    });

    it('parses phase and checkpoint events during a build turn', async () => {
        authFetch.mockResolvedValue(sseResponse([
            sse('builder_session', { sessionId: 'bs-2', appId: 'app-1' }),
            sse('phase', { index: 1, total: 3, label: 'Data model' }),
            sse('checkpoint', { versionId: 'v10', summary: 'AI checkpoint — Data model' }),
            sse('phase', { index: 2, total: 3, label: 'Screens' }),
            sse('done', { appId: 'app-1', finalized: false }),
        ]));
        const onPhase = vi.fn();
        const onCheckpoint = vi.fn();
        const { result } = renderHook(() => useAppBuilderStream({ appId: 'app-1', onPhase, onCheckpoint }));

        await act(async () => { await result.current.send('Build it'); });

        expect(result.current.phases).toEqual([
            { index: 1, total: 3, label: 'Data model' },
            { index: 2, total: 3, label: 'Screens' },
        ]);
        expect(result.current.checkpoints).toEqual([{ versionId: 'v10', summary: 'AI checkpoint — Data model' }]);
        expect(onPhase).toHaveBeenCalledTimes(2);
        expect(onCheckpoint).toHaveBeenCalledTimes(1);
    });

    it('auto-continues a budget-exhausted phased build, capped at 3 chained turns', async () => {
        // Every leg reports it still has more to do — the hook must stop at the cap.
        authFetch.mockImplementation(() => Promise.resolve(sseResponse([
            sse('done', { appId: 'app-1', continuation: { token: 'ct-next', nextPhase: 2 } }),
        ])));
        const onDone = vi.fn();
        const { result } = renderHook(() => useAppBuilderStream({ appId: 'app-1', onDone }));

        await act(async () => { await result.current.send('Build a huge app'); });

        // 1 user turn + 3 auto-continuations = 4 fetches, then it stops.
        expect(authFetch).toHaveBeenCalledTimes(4);
        // The continuation legs carry the continueToken and no user message.
        const contCalls = authFetch.mock.calls.slice(1);
        for (const call of contCalls) {
            const b = bodyOf(call);
            expect(b.continueToken).toBe('ct-next');
            expect(b.message).toBeUndefined();
        }
        // A capped continuation is treated as terminal — onDone fires once.
        expect(onDone).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(result.current.running).toBe(false));
        expect(result.current.continuation).toBeNull();
    });

    it('threads planMode and a plan approval into the request body', async () => {
        authFetch.mockResolvedValue(sseResponse([sse('done', { appId: 'app-1', finalized: true })]));
        const { result } = renderHook(() => useAppBuilderStream({ appId: 'app-1' }));

        // Quick-action style: planMode never.
        await act(async () => { await result.current.send('Wire it', { planMode: 'never' }); });
        expect(bodyOf(authFetch.mock.calls[0]).planMode).toBe('never');

        // Approval turn: object-first call with a plan approval, textless.
        authFetch.mockResolvedValue(sseResponse([sse('done', { appId: 'app-1', finalized: true })]));
        await act(async () => {
            await result.current.send({ plan: { planId: 'pl-1', action: 'approve', plan: { title: 'X' } } });
        });
        const approvalBody = bodyOf(authFetch.mock.calls[authFetch.mock.calls.length - 1]);
        expect(approvalBody.plan).toEqual({ planId: 'pl-1', action: 'approve', plan: { title: 'X' } });
        expect(approvalBody.message).toBeUndefined();
    });

    it('forwards the SSE error taxonomy code to onError and onto the error item', async () => {
        authFetch.mockResolvedValue(sseResponse([
            sse('builder_session', { sessionId: 'bs-err', appId: 'app-1' }),
            sse('error', { message: 'The AI provider had a temporary problem.', code: 'transient_upstream' }),
        ]));
        const onError = vi.fn();
        const { result } = renderHook(() => useAppBuilderStream({ appId: 'app-1', onError }));

        await act(async () => { await result.current.send('Do a thing'); });

        expect(onError).toHaveBeenCalledWith('The AI provider had a temporary problem.', 'transient_upstream');
        const errorItem = result.current.messages.find((m) => m.kind === 'error');
        expect(errorItem).toEqual({ kind: 'error', message: 'The AI provider had a temporary problem.', code: 'transient_upstream' });
    });

    it('a raw connection drop reports no code (undefined) to onError', async () => {
        // Stream closes with no done/error → drop path, which has no server code.
        authFetch.mockResolvedValue(sseResponse([
            sse('builder_session', { sessionId: 'bs-drop', appId: 'app-1' }),
            sse('message', { content: 'working' }),
        ]));
        const onError = vi.fn();
        const { result } = renderHook(() => useAppBuilderStream({ appId: 'app-1', onError }));

        await act(async () => { await result.current.send('Do a thing'); });

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError.mock.calls[0][1]).toBeUndefined();
    });

    it('stop() ends the run, notes it in plain language and reports the turn as finished', async () => {
        // A build that never sends a terminal event — the user stops it.
        let release;
        const gate = new Promise((r) => { release = r; });
        authFetch.mockResolvedValue({
            ok: true,
            status: 200,
            body: new ReadableStream({
                async start(controller) {
                    controller.enqueue(enc.encode(sse('message', { content: 'Building…' })));
                    await gate;
                    controller.close();
                },
            }),
        });
        const onDone = vi.fn();
        const onError = vi.fn();
        const { result } = renderHook(() => useAppBuilderStream({ appId: 'app-1', onDone, onError }));

        let sending;
        await act(async () => { sending = result.current.send('Build a huge app'); });
        await waitFor(() => expect(result.current.running).toBe(true));

        act(() => { result.current.stop(); });

        expect(result.current.running).toBe(false);
        expect(result.current.messages.some((m) => /You stopped the build/.test(m.content || ''))).toBe(true);
        expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ stopped: true }));

        // The stream closing afterwards is not a connection drop — no error.
        release();
        await act(async () => { await sending; });
        expect(onError).not.toHaveBeenCalled();
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('stop() does nothing when no build is running', async () => {
        authFetch.mockResolvedValue(sseResponse([sse('done', { appId: 'app-1', finalized: true })]));
        const onDone = vi.fn();
        const { result } = renderHook(() => useAppBuilderStream({ appId: 'app-1', onDone }));

        await act(async () => { await result.current.send('Build it'); });
        onDone.mockClear();

        act(() => { result.current.stop(); });
        expect(onDone).not.toHaveBeenCalled();
        expect(result.current.messages.some((m) => /You stopped the build/.test(m.content || ''))).toBe(false);
    });

    it('a late session rehydration is prepended to a turn that already started', async () => {
        // The snapshot resolves only after the user fired a turn.
        let resolveSnapshot;
        studioAppsApi.getBuilderSession.mockReturnValue(new Promise((r) => { resolveSnapshot = r; }));
        authFetch.mockResolvedValue(sseResponse([
            sse('message', { content: 'On it.' }),
            sse('done', { appId: 'app-1', finalized: true }),
        ]));
        const { result } = renderHook(() => useAppBuilderStream({ appId: 'app-1' }));

        await act(async () => { await result.current.send('Add a button'); });
        expect(result.current.messages[0]).toEqual(expect.objectContaining({ role: 'user', content: 'Add a button' }));

        await act(async () => {
            resolveSnapshot({ snapshot: { sessionId: 'bs-old', messages: [{ role: 'user', content: 'Make me a tracker' }] } });
        });

        // The restored history lands IN FRONT of the live turn, never over it.
        expect(result.current.messages.map((m) => m.content)).toEqual([
            'Make me a tracker', 'Add a button', 'On it.',
        ]);
    });

    it('rehydrates a pending plan and checkpoints from the session snapshot', async () => {
        studioAppsApi.getBuilderSession.mockResolvedValue({
            snapshot: {
                sessionId: 'bs-old',
                messages: [],
                pendingPlan: { planId: 'pl-9', plan: { title: 'Saved plan' } },
                checkpoints: [{ versionId: 'v3', summary: 'AI checkpoint — Screens' }],
            },
        });
        const { result } = renderHook(() => useAppBuilderStream({ appId: 'app-1' }));

        await waitFor(() => expect(result.current.pendingPlan).toEqual({ planId: 'pl-9', plan: { title: 'Saved plan' } }));
        expect(result.current.checkpoints).toEqual([{ versionId: 'v3', summary: 'AI checkpoint — Screens' }]);
    });
});
