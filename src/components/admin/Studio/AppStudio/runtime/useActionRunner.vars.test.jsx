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

/**
 * WHAT THE ACTION CAN SEE.
 *
 * Two scope roots the runner did not carry, both of which the authoring side
 * teaches people to use:
 *
 *   `item` — the row that triggered the action. Every row-click component hands
 *     the row over, the binding picker offers `item.<field>`, and the shipped
 *     templates wire "open THIS record" as a navigate param of `item.id`. The
 *     runner never set it, so that param resolved to undefined and the detail
 *     screen opened on nothing.
 *
 *   `screen` / `forms` — in every scope the RENDERER builds. A step formula
 *     reading `screen.params.id` — how a detail screen learns which record it
 *     is showing — resolved to undefined, so the delete button on that screen
 *     deleted nothing.
 */
describe('useActionRunner — the scope an action runs against', () => {
    const navAction = (params) => ({
        schemaVersion: 2,
        screens: [{ id: 'scr_a', name: 'A', sections: [] }, { id: 'scr_b', name: 'B', sections: [] }],
        actions: { act_open: { kind: 'navigate', screenId: 'scr_b', params } },
    });

    it('resolves a navigate param from the row that was clicked', async () => {
        const onNavigate = vi.fn();
        const { result } = renderHook(() => useActionRunner('app1', navAction({
            recordId: { kind: 'formula', expr: 'item.id' },
        }), { onNavigate }));

        await act(async () => {
            await result.current.runAction('act_open', { formValues: { id: 42 }, item: { id: 42 } });
        });
        expect(onNavigate).toHaveBeenCalledWith('scr_b', { recordId: 42 });
    });

    it('resolves a navigate param from the screen it is already on', async () => {
        const onNavigate = vi.fn();
        const { result } = renderHook(() => useActionRunner('app1', navAction({
            parentId: { kind: 'formula', expr: 'screen.params.id' },
        }), { onNavigate, screen: { id: 'scr_a', params: { id: 'ticket-7' } } }));

        await act(async () => {
            await result.current.runAction('act_open', {});
        });
        expect(onNavigate).toHaveBeenCalledWith('scr_b', { parentId: 'ticket-7' });
    });

    it('resolves a SEQUENCE step against the same roots', async () => {
        const onNavigate = vi.fn();
        const def = {
            schemaVersion: 2,
            screens: [{ id: 'scr_a', name: 'A', sections: [] }, { id: 'scr_b', name: 'B', sections: [] }],
            actions: {
                act_flow: {
                    kind: 'sequence',
                    steps: [
                        { kind: 'set_variable', name: 'picked', value: { kind: 'formula', expr: 'item.id' } },
                        { kind: 'set_variable', name: 'onScreen', value: { kind: 'formula', expr: 'screen.params.id' } },
                        { kind: 'navigate', screenId: 'scr_b', params: { a: { kind: 'formula', expr: 'vars.picked' }, b: { kind: 'formula', expr: 'vars.onScreen' } } },
                    ],
                },
            },
        };
        const { result } = renderHook(() => useActionRunner('app1', def, {
            onNavigate,
            screen: { id: 'scr_a', params: { id: 'ticket-7' } },
        }));

        await act(async () => {
            await result.current.runAction('act_flow', { formValues: { id: 9 }, item: { id: 9 } });
        });
        expect(onNavigate).toHaveBeenCalledWith('scr_b', { a: 9, b: 'ticket-7' });
    });
});

/**
 * `stepIndex` is never stored: the browser derives it from the definition it
 * holds and the server from the one it HAS — and with ?draft=1 that is the
 * SAVED draft. In the editor those are not the same document, because autosave
 * is debounced, so previewing an action inside that window had the server
 * resolve the ordinal to a different step than the one on screen. On a
 * delete_record that is not a cosmetic difference.
 */
describe('useActionRunner — a server step waits for the draft to be saved', () => {
    beforeEach(() => { authFetch.mockReset(); toast.error.mockReset(); });

    const serverSeq = {
        schemaVersion: 2,
        screens: [{ id: 'scr_a', name: 'A', sections: [] }],
        actions: {
            act_write: { kind: 'sequence', steps: [{ kind: 'create_record', tableId: 'tbl_a', values: {} }] },
        },
    };
    const clientSeq = {
        schemaVersion: 2,
        screens: [{ id: 'scr_a', name: 'A', sections: [] }],
        actions: { act_say: { kind: 'sequence', steps: [{ kind: 'toast', message: 'hi' }] } },
    };

    it('flushes before dispatching a step the server resolves by ordinal', async () => {
        const order = [];
        const beforeServerStep = vi.fn(async () => { order.push('flush'); return { ok: true }; });
        authFetch.mockImplementation(async () => { order.push('dispatch'); return resp(200, { ok: true, result: {} }); });

        const { result } = renderHook(() => useActionRunner('app1', serverSeq, { beforeServerStep }));
        await act(async () => { await result.current.runAction('act_write', {}); });

        expect(beforeServerStep).toHaveBeenCalledTimes(1);
        expect(order[0]).toBe('flush');
        expect(order).toContain('dispatch');
    });

    it('does not run the step at all when the draft could not be saved', async () => {
        const beforeServerStep = vi.fn(async () => ({ ok: false, error: 'Saving failed.' }));
        authFetch.mockImplementation(async () => resp(200, { ok: true }));

        const { result } = renderHook(() => useActionRunner('app1', serverSeq, { beforeServerStep }));
        await act(async () => { await result.current.runAction('act_write', {}); });

        // Dispatching against a draft the server has not got is the one thing
        // that must not happen.
        expect(authFetch).not.toHaveBeenCalled();
    });

    it('leaves a purely client-side sequence alone', async () => {
        const beforeServerStep = vi.fn(async () => ({ ok: true }));
        const { result } = renderHook(() => useActionRunner('app1', clientSeq, { beforeServerStep }));
        await act(async () => { await result.current.runAction('act_say', {}); });
        expect(beforeServerStep).not.toHaveBeenCalled();
    });
});
