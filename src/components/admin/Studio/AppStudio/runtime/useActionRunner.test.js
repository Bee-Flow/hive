import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../../../shared/Toast', () => {
    const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    return { default: toast, toast };
});

import useActionRunner from './useActionRunner';
import { authFetch } from '../../../../../utils/helpers';
import toast from '../../../../shared/Toast';

// Matches POLL_INTERVAL_MS in useActionRunner.js (not exported).
const POLL_INTERVAL_MS = 2000;

// A minimal fetch Response stub.
const resp = (status, body, ok = status >= 200 && status < 300) => ({
    ok,
    status,
    json: async () => body,
});

function actionDef(overrides = {}) {
    return {
        actions: {
            act_run: {
                kind: 'run_automation',
                onSuccess: { toast: { tone: 'success', message: 'Done' } },
                onError: { toast: { tone: 'danger', message: 'It failed' }, navigateTo: 'scr_err' },
                ...overrides,
            },
        },
    };
}

describe('useActionRunner', () => {
    beforeEach(() => {
        authFetch.mockReset();
        toast.success.mockReset();
        toast.error.mockReset();
        toast.info.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ---- BUG 6: unmount cancellation must not fire onError effects ----------
    it('does NOT fire the onError toast/navigate when unmounted mid-poll', async () => {
        vi.useFakeTimers();
        authFetch.mockImplementation((url) => {
            if (String(url).includes('/actions/runs/')) {
                // poll GET — never reached (we unmount before the sleep fires)
                return Promise.resolve(resp(200, { status: 'running' }));
            }
            // A pending 202 that DOES carry a run id — only that shape polls.
            return Promise.resolve(resp(202, { status: 'pending', runId: 'r1' }));
        });

        const onNavigate = vi.fn();
        const { result, unmount } = renderHook(() => useActionRunner('app1', actionDef(), { onNavigate }));

        let runPromise;
        await act(async () => {
            runPromise = result.current.runAction('act_run');
            for (let i = 0; i < 6; i++) await Promise.resolve();
        });
        // Parked inside pollRun's sleep — only the POST has fired so far.
        expect(authFetch).toHaveBeenCalledTimes(1);

        // Leave run mode / unmount → aliveRef flips false.
        act(() => { unmount(); });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
        });
        await runPromise;

        expect(toast.error).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
        expect(onNavigate).not.toHaveBeenCalled();
    });

    it('a genuine failure DOES fire the onError toast', async () => {
        authFetch.mockResolvedValue(resp(500, { error: 'boom' }));
        const onNavigate = vi.fn();
        const { result } = renderHook(() => useActionRunner('app1', actionDef(), { onNavigate }));

        await act(async () => { await result.current.runAction('act_run'); });

        expect(toast.error).toHaveBeenCalledWith('It failed');
        expect(onNavigate).toHaveBeenCalledWith('scr_err');
        expect(result.current.actionState.act_run.status).toBe('error');
    });

    // ---- BUG 8: a 202 without a pending marker or runId is not success ------
    it('treats a 202 without status:pending or a runId as a failure', async () => {
        authFetch.mockResolvedValue(resp(202, { result: { rows: [] } }));
        const { result } = renderHook(() => useActionRunner('app1', actionDef(), {}));

        await act(async () => { await result.current.runAction('act_run'); });

        // No poll attempted (single call), and it did NOT render as success.
        expect(authFetch).toHaveBeenCalledTimes(1);
        expect(result.current.actionState.act_run.status).toBe('error');
        expect(toast.error).toHaveBeenCalledWith('It failed');
        expect(toast.success).not.toHaveBeenCalled();
    });

    // ---- a 202 WITHOUT a run id: nothing to poll, and no false failure ------
    it('a pending 202 with runId:null does not poll and does not report a failure', async () => {
        // The shape the /run bridge answers when the sync wait times out.
        authFetch.mockResolvedValue(resp(202, { runId: null, status: 'pending' }));
        const onNavigate = vi.fn();
        const { result } = renderHook(() => useActionRunner('app1', actionDef(), { onNavigate }));

        await act(async () => { await result.current.runAction('act_run'); });

        // Only the POST — no GET on /actions/runs/undefined.
        expect(authFetch).toHaveBeenCalledTimes(1);
        expect(result.current.actionState.act_run.status).toBe('idle');
        expect(toast.error).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
        expect(onNavigate).not.toHaveBeenCalled();   // onError effects must NOT fire
        expect(toast.info).toHaveBeenCalledWith(expect.stringMatching(/still running/i));
    });

    it('a pending 202 WITH a runId polls that run to a terminal result', async () => {
        vi.useFakeTimers();
        authFetch.mockImplementation((url) => {
            if (String(url).includes('/actions/runs/')) {
                return Promise.resolve(resp(200, { status: 'succeeded', result: { ok: 1 } }));
            }
            return Promise.resolve(resp(202, { runId: 'run_7', status: 'pending' }));
        });

        const { result } = renderHook(() => useActionRunner('app1', actionDef(), {}));

        let runPromise;
        await act(async () => {
            runPromise = result.current.runAction('act_run');
            for (let i = 0; i < 6; i++) await Promise.resolve();
        });
        await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS); });
        await act(async () => { await runPromise; });

        expect(String(authFetch.mock.calls[1][0])).toContain('/actions/runs/run_7');
        expect(result.current.actionState.act_run.status).toBe('success');
        expect(toast.success).toHaveBeenCalledWith('Done');
    });

    it('a 202 carrying a runId re-polls to a terminal result', async () => {
        vi.useFakeTimers();
        authFetch.mockImplementation((url) => {
            if (String(url).includes('/actions/runs/')) {
                return Promise.resolve(resp(200, { status: 'succeeded', result: { ok: 1 } }));
            }
            return Promise.resolve(resp(202, { runId: 'r9' })); // no status field
        });

        const { result } = renderHook(() => useActionRunner('app1', actionDef(), {}));

        let runPromise;
        await act(async () => {
            runPromise = result.current.runAction('act_run');
            for (let i = 0; i < 6; i++) await Promise.resolve();
        });
        await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS); });
        await act(async () => { await runPromise; });

        expect(result.current.actionState.act_run.status).toBe('success');
        expect(result.current.actionState.act_run.result).toEqual({ ok: 1 });
        expect(toast.success).toHaveBeenCalledWith('Done');
    });

    it('a synchronous 200 result resolves to success', async () => {
        authFetch.mockResolvedValue(resp(200, { result: { count: 3 } }));
        const { result } = renderHook(() => useActionRunner('app1', actionDef(), {}));

        await act(async () => { await result.current.runAction('act_run'); });

        expect(result.current.actionState.act_run.status).toBe('success');
        expect(result.current.actionState.act_run.result).toEqual({ count: 3 });
        expect(toast.success).toHaveBeenCalledWith('Done');
    });
});
