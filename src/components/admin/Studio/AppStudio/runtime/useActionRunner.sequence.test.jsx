import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * App Studio runtime — useActionRunner as a v2 SEQUENCE COORDINATOR.
 *
 * Real @shared/expr + resolveBinding + buildScope; authFetch and Toast are
 * mocked, and openAppModal is spied. Covers: confirm-gate abort, set_variable
 * threading, condition branch selection, server-step dispatch + result
 * threading, open_modal wiring, and v1 single-action back-compat (the legacy
 * /run bridge must be untouched).
 */

vi.mock('../../../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../../../shared/Toast', () => {
    const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    return { default: toast, toast };
});
vi.mock('./components/AppModal', () => ({ openAppModal: vi.fn(), closeAppModal: vi.fn() }));

import { openAppModal } from './components/AppModal';
import useActionRunner from './useActionRunner';
import { authFetch } from '../../../../../utils/helpers';
import toast from '../../../../shared/Toast';

const resp = (status, body, ok = status >= 200 && status < 300) => ({ ok, status, json: async () => body });

// Parse the JSON body of the Nth authFetch POST.
function bodyOfCall(i = 0) {
    const call = authFetch.mock.calls[i];
    return JSON.parse(call[1].body);
}
function urlOfCall(i = 0) {
    return String(authFetch.mock.calls[i][0]);
}

function def(actions) {
    return { schemaVersion: 2, actions };
}

describe('useActionRunner — v2 sequence coordinator', () => {
    beforeEach(() => {
        authFetch.mockReset();
        toast.success.mockReset();
        toast.error.mockReset();
        toast.info.mockReset();
        openAppModal.mockReset();
    });
    afterEach(() => { vi.useRealTimers(); });

    it('confirm gate: a declined confirm ABORTS the sequence — the later server step never dispatches', async () => {
        authFetch.mockResolvedValue(resp(200, { ok: true, result: { id: 'rec_new' } }));
        const confirmMock = vi.fn(() => Promise.resolve(false));
        const definition = def({
            seq: {
                kind: 'sequence',
                steps: [
                    { kind: 'confirm', message: 'Sure?' },
                    { kind: 'create_record', tableId: 't', values: {} },
                ],
            },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, { confirm: confirmMock }));

        await act(async () => { await result.current.runAction('seq'); });

        expect(confirmMock).toHaveBeenCalledTimes(1);
        expect(authFetch).not.toHaveBeenCalled();           // create_record never dispatched
        expect(result.current.actionState.seq?.status).not.toBe('error');
        expect(toast.error).not.toHaveBeenCalled();
    });

    it('confirm gate: an accepted confirm lets the sequence proceed to the server step', async () => {
        authFetch.mockResolvedValue(resp(200, { ok: true, result: { id: 'rec_new' } }));
        const definition = def({
            seq: {
                kind: 'sequence',
                steps: [
                    { kind: 'confirm', message: 'Sure?' },
                    { kind: 'create_record', tableId: 't', values: {} },
                ],
            },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, { confirm: () => Promise.resolve(true) }));

        await act(async () => { await result.current.runAction('seq'); });

        expect(authFetch).toHaveBeenCalledTimes(1);
        expect(urlOfCall(0)).toContain('/actions/seq/step');
        expect(result.current.actionState.seq.status).toBe('success');
    });

    it('set_variable threads into a later server step body', async () => {
        authFetch.mockResolvedValue(resp(200, { ok: true, result: { id: 'rec_new' } }));
        const definition = def({
            seq: {
                kind: 'sequence',
                steps: [
                    { kind: 'set_variable', name: 'priority', value: { kind: 'static', value: 5 } },
                    { kind: 'create_record', tableId: 't', values: {} },
                ],
            },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, {}));

        await act(async () => { await result.current.runAction('seq', { formValues: { a: 1 } }); });

        expect(authFetch).toHaveBeenCalledTimes(1);
        const body = bodyOfCall(0);
        expect(body.stepIndex).toBe(1);
        expect(body.vars).toEqual({ priority: 5 });
        expect(body.formValues).toEqual({ a: 1 });
    });

    it('condition: only the taken branch runs — the else branch server step never dispatches', async () => {
        authFetch.mockResolvedValue(resp(200, { ok: true, result: { id: 'rec_new' } }));
        const definition = def({
            seq: {
                kind: 'sequence',
                steps: [{
                    kind: 'condition', expr: 'form.go == true',
                    then: [{ kind: 'create_record', tableId: 't', values: {} }],   // pre-order index 1
                    else: [{ kind: 'delete_record', tableId: 't', recordId: { kind: 'static', value: 'r' } }], // index 2
                }],
            },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, {}));

        await act(async () => { await result.current.runAction('seq', { formValues: { go: true } }); });

        expect(authFetch).toHaveBeenCalledTimes(1);
        // The dispatched step is the `then` branch's create_record at index 1.
        expect(bodyOfCall(0).stepIndex).toBe(1);
    });

    it('server step dispatch: the result threads into vars for a later server step', async () => {
        authFetch.mockResolvedValue(resp(200, { ok: true, result: { id: 'rec_new' } }));
        const definition = def({
            seq: {
                kind: 'sequence',
                steps: [
                    { kind: 'create_record', tableId: 't', values: {}, resultVar: 'created' }, // index 0
                    { kind: 'update_record', tableId: 't', recordId: { kind: 'formula', expr: 'vars.created.id' }, values: {} }, // index 1
                ],
            },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, {}));

        await act(async () => { await result.current.runAction('seq'); });

        expect(authFetch).toHaveBeenCalledTimes(2);
        expect(bodyOfCall(0).stepIndex).toBe(0);
        // The second dispatch carries the first step's result threaded under `created`.
        const second = bodyOfCall(1);
        expect(second.stepIndex).toBe(1);
        expect(second.vars.created).toEqual({ id: 'rec_new' });
        expect(result.current.actionState.seq.status).toBe('success');
        expect(result.current.actionState.seq.result).toEqual({ id: 'rec_new' });
    });

    it('a failing server step aborts the sequence, sets error state and toasts', async () => {
        authFetch.mockImplementation((url) => {
            if (String(url).includes('/step')) {
                if (authFetch.mock.calls.length === 1) return Promise.resolve(resp(200, { ok: false, error: 'Record not found' }));
            }
            return Promise.resolve(resp(200, { ok: true, result: { id: 'rec_2' } }));
        });
        const definition = def({
            seq: {
                kind: 'sequence',
                steps: [
                    { kind: 'create_record', tableId: 't', values: {} },       // fails
                    { kind: 'create_record', tableId: 't', values: {} },       // must NOT run
                ],
            },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, {}));

        await act(async () => { await result.current.runAction('seq'); });

        expect(authFetch).toHaveBeenCalledTimes(1);   // aborted after the first failure
        expect(result.current.actionState.seq.status).toBe('error');
        expect(result.current.actionState.seq.error).toMatch(/not found/i);
        expect(toast.error).toHaveBeenCalled();
    });

    it('open_modal calls openAppModal (pure-client sequence, no dispatch, no spinner)', async () => {
        const definition = def({ seq: { kind: 'sequence', steps: [{ kind: 'open_modal', modalId: 'mod_1' }] } });
        const { result } = renderHook(() => useActionRunner('app1', definition, {}));

        await act(async () => { await result.current.runAction('seq'); });

        expect(openAppModal).toHaveBeenCalledWith('mod_1');
        expect(authFetch).not.toHaveBeenCalled();
        expect(result.current.actionState.seq).toBeUndefined(); // no running state for pure-client work
    });

    it('navigate step calls onNavigate; a bare v1 open_modal action still works', async () => {
        const onNavigate = vi.fn();
        const definition = def({
            seq: { kind: 'sequence', steps: [{ kind: 'navigate', screenId: 'scr_2' }] },
            bareModal: { kind: 'open_modal', modalId: 'mod_bare' },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, { onNavigate }));

        await act(async () => { await result.current.runAction('seq'); });
        expect(onNavigate).toHaveBeenCalledWith('scr_2', {});

        await act(async () => { await result.current.runAction('bareModal'); });
        expect(openAppModal).toHaveBeenCalledWith('mod_bare');
    });

    // ── v1 back-compat: the legacy /run bridge is untouched ─────────────────────
    it('v1 single-action back-compat: a bare run_automation still POSTs to /run and applies onSuccess', async () => {
        authFetch.mockResolvedValue(resp(200, { status: 'success', result: { count: 3 } }));
        const definition = def({
            act_run: {
                kind: 'run_automation',
                automationId: 'auto-1',
                onSuccess: { toast: { tone: 'success', message: 'Done' } },
            },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, {}));

        await act(async () => { await result.current.runAction('act_run'); });

        expect(authFetch).toHaveBeenCalledTimes(1);
        expect(urlOfCall(0)).toContain('/actions/act_run/run');   // legacy /run, NOT /step
        expect(urlOfCall(0)).not.toContain('/step');
        expect(result.current.actionState.act_run.status).toBe('success');
        expect(result.current.actionState.act_run.result).toEqual({ count: 3 });
        expect(toast.success).toHaveBeenCalledWith('Done');
    });

    it('a bare run_automation as a SEQUENCE step dispatches to /step (not /run)', async () => {
        authFetch.mockResolvedValue(resp(200, { ok: true, result: { runId: 'r1', output: { ok: 1 } } }));
        const definition = def({
            seq: { kind: 'sequence', steps: [{ kind: 'run_automation', automationId: 'auto-1', resultVar: 'out' }] },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, {}));

        await act(async () => { await result.current.runAction('seq'); });

        expect(urlOfCall(0)).toContain('/actions/seq/step');
        expect(result.current.actionState.seq.status).toBe('success');
    });
});
