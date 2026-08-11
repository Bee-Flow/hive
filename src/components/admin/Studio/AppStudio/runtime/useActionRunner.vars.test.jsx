import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * App Studio runtime — useActionRunner LIFTED VARS + navigate-with-params +
 * quota surfacing (Wave 1a).
 *
 * Covers: vars as hook state (set_variable/resultVar persist across
 * sequences; setVar writes directly; sequences start from hook vars),
 * navigate params resolved against live scope for both bare v1 actions and
 * sequence steps, and the distinct quota_exceeded toast. Real @shared/expr +
 * resolveBinding + buildScope; authFetch and Toast are mocked.
 */

vi.mock('../../../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../../../shared/Toast', () => {
    const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    return { default: toast, toast };
});
vi.mock('./components/AppModal', () => ({ openAppModal: vi.fn(), closeAppModal: vi.fn() }));

import useActionRunner from './useActionRunner';
import { authFetch } from '../../../../../utils/helpers';
import toast from '../../../../shared/Toast';

const resp = (status, body, ok = status >= 200 && status < 300) => ({ ok, status, json: async () => body });

function bodyOfCall(i = 0) {
    return JSON.parse(authFetch.mock.calls[i][1].body);
}

function def(actions) {
    return { schemaVersion: 2, actions };
}

describe('useActionRunner — lifted vars', () => {
    beforeEach(() => {
        authFetch.mockReset();
        toast.success.mockReset();
        toast.error.mockReset();
        toast.info.mockReset();
    });

    it('returns { actionState, runAction, vars, setVar } — old destructuring stays valid', () => {
        const { result } = renderHook(() => useActionRunner('app1', def({}), {}));
        expect(typeof result.current.runAction).toBe('function');
        expect(typeof result.current.setVar).toBe('function');
        expect(result.current.actionState).toEqual({});
        expect(result.current.vars).toEqual({});
    });

    it('set_variable in a pure client sequence persists into hook vars', async () => {
        const definition = def({
            seq: { kind: 'sequence', steps: [{ kind: 'set_variable', name: 'x', value: { kind: 'static', value: 'Zap' } }] },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, {}));

        await act(async () => { await result.current.runAction('seq'); });

        expect(result.current.vars).toEqual({ x: 'Zap' });
    });

    it('sequences START from hook vars: setVar feeds a later server-step body', async () => {
        authFetch.mockResolvedValue(resp(200, { ok: true, result: { id: 'rec_1' } }));
        const definition = def({
            seq: { kind: 'sequence', steps: [{ kind: 'create_record', tableId: 't', values: {} }] },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, {}));

        act(() => { result.current.setVar('priority', 7); });
        await act(async () => { await result.current.runAction('seq'); });

        expect(bodyOfCall(0).vars).toEqual({ priority: 7 });
    });

    it('resultVar persists into hook vars after the sequence completes', async () => {
        authFetch.mockResolvedValue(resp(200, { ok: true, result: { id: 'rec_9' } }));
        const definition = def({
            seq: { kind: 'sequence', steps: [{ kind: 'create_record', tableId: 't', values: {}, resultVar: 'created' }] },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, {}));

        await act(async () => { await result.current.runAction('seq'); });

        expect(result.current.vars.created).toEqual({ id: 'rec_9' });
    });

    it('vars set by one sequence are visible to formulas in the next', async () => {
        const onNavigate = vi.fn();
        const definition = def({
            setIt: { kind: 'sequence', steps: [{ kind: 'set_variable', name: 'rowId', value: { kind: 'static', value: 'r42' } }] },
            goSeq: {
                kind: 'sequence',
                steps: [{ kind: 'navigate', screenId: 'scr_2', params: { recordId: { kind: 'formula', expr: 'vars.rowId' } } }],
            },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, { onNavigate }));

        await act(async () => { await result.current.runAction('setIt'); });
        await act(async () => { await result.current.runAction('goSeq'); });

        expect(onNavigate).toHaveBeenCalledWith('scr_2', { recordId: 'r42' });
    });
});

describe('useActionRunner — navigate with params', () => {
    beforeEach(() => {
        authFetch.mockReset();
        toast.error.mockReset();
    });

    it('a bare v1 navigate action resolves static + formula params against hook state', async () => {
        const onNavigate = vi.fn();
        const definition = def({
            go: {
                kind: 'navigate',
                screenId: 'scr_detail',
                params: {
                    recordId: { kind: 'formula', expr: 'vars.rowId' },
                    mode: { kind: 'static', value: 'view' },
                },
            },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, { onNavigate }));

        act(() => { result.current.setVar('rowId', 'rec_7'); });
        await act(async () => { await result.current.runAction('go'); });

        expect(onNavigate).toHaveBeenCalledWith('scr_detail', { recordId: 'rec_7', mode: 'view' });
    });

    it('a navigate without params passes an empty params object (back-compat callers unaffected)', async () => {
        const onNavigate = vi.fn();
        const definition = def({ go: { kind: 'navigate', screenId: 'scr_2' } });
        const { result } = renderHook(() => useActionRunner('app1', definition, { onNavigate }));

        await act(async () => { await result.current.runAction('go'); });

        expect(onNavigate).toHaveBeenCalledWith('scr_2', {});
    });

    it('a navigate step resolves params from sequence-local scope (item/set_variable)', async () => {
        const onNavigate = vi.fn();
        const definition = def({
            seq: {
                kind: 'sequence',
                steps: [
                    { kind: 'set_variable', name: 'picked', value: { kind: 'static', value: 'rec_3' } },
                    { kind: 'navigate', screenId: 'scr_d', params: { recordId: { kind: 'formula', expr: 'vars.picked' } } },
                ],
            },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, { onNavigate }));

        await act(async () => { await result.current.runAction('seq'); });

        expect(onNavigate).toHaveBeenCalledWith('scr_d', { recordId: 'rec_3' });
    });
});

describe('useActionRunner — quota_exceeded surfacing', () => {
    beforeEach(() => {
        authFetch.mockReset();
        toast.error.mockReset();
    });

    it('a 409 quota body maps to the distinct storage-limit toast', async () => {
        authFetch.mockResolvedValue(resp(409, { error: 'Row quota exceeded', code: 'quota_exceeded', limit: 5000, used: 5000 }));
        const definition = def({
            seq: { kind: 'sequence', steps: [{ kind: 'create_record', tableId: 't', values: {} }] },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, {}));

        await act(async () => { await result.current.runAction('seq'); });

        expect(toast.error).toHaveBeenCalledWith('Storage limit reached — delete rows or attachments to continue');
        expect(result.current.actionState.seq.status).toBe('error');
    });

    it('an ok:false step result carrying the code maps to the same toast', async () => {
        authFetch.mockResolvedValue(resp(200, { ok: false, error: 'quota', code: 'quota_exceeded' }));
        const definition = def({
            seq: { kind: 'sequence', steps: [{ kind: 'create_record', tableId: 't', values: {} }] },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, {}));

        await act(async () => { await result.current.runAction('seq'); });

        expect(toast.error).toHaveBeenCalledWith('Storage limit reached — delete rows or attachments to continue');
    });

    it('a plain server failure keeps its own error message (no quota copy)', async () => {
        authFetch.mockResolvedValue(resp(200, { ok: false, error: 'Record not found' }));
        const definition = def({
            seq: { kind: 'sequence', steps: [{ kind: 'delete_record', tableId: 't', recordId: { kind: 'static', value: 'r' } }] },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, {}));

        await act(async () => { await result.current.runAction('seq'); });

        expect(toast.error).toHaveBeenCalledWith('Record not found');
    });
});
