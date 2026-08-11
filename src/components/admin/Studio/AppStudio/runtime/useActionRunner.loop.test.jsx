import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * App Studio runtime — useActionRunner BINDING BAG + loop scoping.
 *
 * A step's binding (loop `source`, set_variable `value`) resolves through
 * resolveBinding, which needs the FULL bag ({ actionState, dataState, scope }) —
 * a scope-only bag silently resolves every record/records/dataset/connector/
 * actionResult source to undefined. Real resolveBinding + buildScope + @shared/
 * expr; authFetch and Toast are mocked.
 */

vi.mock('../../../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));
vi.mock('../../../../shared/Toast', () => {
    const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    return { default: toast, toast };
});
vi.mock('./components/AppModal', () => ({ openAppModal: vi.fn(), closeAppModal: vi.fn() }));

import { dataCacheKey } from './resolveBinding';
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

// A dataState keyed exactly like the fetch layer stores it (DataContext).
function dataStateFor(binding, result, extra) {
    return { [dataCacheKey(binding)]: { status: 'success', result, error: null, ...extra } };
}

describe('useActionRunner — bindings resolve against the full bag', () => {
    beforeEach(() => {
        authFetch.mockReset();
        toast.success.mockReset();
        toast.error.mockReset();
        toast.info.mockReset();
    });

    it('a loop over a records binding iterates the fetched rows (one server step per row)', async () => {
        authFetch.mockResolvedValue(resp(200, { ok: true, result: { id: 'rec_new' } }));
        const source = { kind: 'records', tableId: 'tbl_a' };
        const dataState = dataStateFor(source, [{ id: 'a' }, { id: 'b' }], { tableId: 'tbl_a' });
        const definition = def({
            seq: {
                kind: 'sequence',
                steps: [{
                    kind: 'loop', source, itemVar: 'row',
                    steps: [{ kind: 'create_record', tableId: 'tbl_b', values: {} }],
                }],
            },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, { dataState }));

        await act(async () => { await result.current.runAction('seq'); });

        expect(authFetch).toHaveBeenCalledTimes(2);
        expect(bodyOfCall(0).vars.row).toEqual({ id: 'a' });
        expect(bodyOfCall(1).vars.row).toEqual({ id: 'b' });
        expect(bodyOfCall(0).item).toEqual({ id: 'a' });
        expect(result.current.actionState.seq.status).toBe('success');
    });

    it('set_variable from a records binding stores the rows, not undefined', async () => {
        authFetch.mockResolvedValue(resp(200, { ok: true, result: { id: 'rec_new' } }));
        const source = { kind: 'records', tableId: 'tbl_a' };
        const dataState = dataStateFor(source, [{ id: 'a' }, { id: 'b' }], { tableId: 'tbl_a' });
        const definition = def({
            seq: {
                kind: 'sequence',
                steps: [
                    { kind: 'set_variable', name: 'rows', value: source },
                    { kind: 'create_record', tableId: 'tbl_b', values: {} },
                ],
            },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, { dataState }));

        await act(async () => { await result.current.runAction('seq'); });

        expect(bodyOfCall(0).vars.rows).toEqual([{ id: 'a' }, { id: 'b' }]);
        expect(result.current.vars.rows).toEqual([{ id: 'a' }, { id: 'b' }]);
    });

    it('a loop over a connector binding iterates the connector rows', async () => {
        authFetch.mockResolvedValue(resp(200, { ok: true, result: { id: 'rec_new' } }));
        const source = { kind: 'connector', connectorId: 'conn_1' };
        const dataState = dataStateFor(source, [{ id: 'x' }], { connectorId: 'conn_1' });
        const definition = def({
            seq: {
                kind: 'sequence',
                steps: [{
                    kind: 'loop', source, itemVar: 'row',
                    steps: [{ kind: 'create_record', tableId: 'tbl_b', values: {} }],
                }],
            },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, { dataState }));

        await act(async () => { await result.current.runAction('seq'); });

        expect(authFetch).toHaveBeenCalledTimes(1);
        expect(bodyOfCall(0).vars.row).toEqual({ id: 'x' });
    });

    it('a loop over an actionResult binding sees the earlier action\'s result', async () => {
        authFetch.mockResolvedValue(resp(200, { ok: true, result: { rows: [{ id: 'p' }, { id: 'q' }] } }));
        const definition = def({
            prev: { kind: 'sequence', steps: [{ kind: 'create_record', tableId: 'tbl_a', values: {} }] },
            seq: {
                kind: 'sequence',
                steps: [{
                    kind: 'loop', source: { kind: 'actionResult', actionId: 'prev', path: 'rows' }, itemVar: 'row',
                    steps: [{ kind: 'create_record', tableId: 'tbl_b', values: {} }],
                }],
            },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, {}));

        await act(async () => { await result.current.runAction('prev'); });
        authFetch.mockClear();
        await act(async () => { await result.current.runAction('seq'); });

        expect(authFetch).toHaveBeenCalledTimes(2);
        expect(bodyOfCall(0).vars.row).toEqual({ id: 'p' });
        expect(bodyOfCall(1).vars.row).toEqual({ id: 'q' });
    });
});

describe('useActionRunner — loop variable scoping', () => {
    beforeEach(() => {
        authFetch.mockReset();
        toast.error.mockReset();
    });

    it('itemVar/indexVar do NOT survive the loop (a later step never sees the last row)', async () => {
        authFetch.mockResolvedValue(resp(200, { ok: true, result: { id: 'rec_new' } }));
        const definition = def({
            seq: {
                kind: 'sequence',
                steps: [
                    { kind: 'loop', source: { kind: 'static', value: ['a', 'b'] }, itemVar: 'row', indexVar: 'i', steps: [] },
                    { kind: 'create_record', tableId: 'tbl_b', values: {} },
                ],
            },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, {}));

        await act(async () => { await result.current.runAction('seq'); });

        const vars = bodyOfCall(0).vars;
        expect(vars).not.toHaveProperty('row');
        expect(vars).not.toHaveProperty('i');
    });

    it('an itemVar shadowing an existing var restores the outer value after the loop', async () => {
        authFetch.mockResolvedValue(resp(200, { ok: true, result: { id: 'rec_new' } }));
        const definition = def({
            seq: {
                kind: 'sequence',
                steps: [
                    { kind: 'loop', source: { kind: 'static', value: ['a', 'b'] }, itemVar: 'row', steps: [] },
                    { kind: 'create_record', tableId: 'tbl_b', values: {} },
                ],
            },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, {}));

        act(() => { result.current.setVar('row', 'outer'); });
        await act(async () => { await result.current.runAction('seq'); });

        expect(bodyOfCall(0).vars.row).toBe('outer');
    });

    it('a set_variable inside the loop body still carries forward past the loop', async () => {
        authFetch.mockResolvedValue(resp(200, { ok: true, result: { id: 'rec_new' } }));
        const definition = def({
            seq: {
                kind: 'sequence',
                steps: [
                    {
                        kind: 'loop', source: { kind: 'static', value: ['a', 'b'] }, itemVar: 'row',
                        steps: [{ kind: 'set_variable', name: 'seen', value: { kind: 'formula', expr: 'vars.row' } }],
                    },
                    { kind: 'create_record', tableId: 'tbl_b', values: {} },
                ],
            },
        });
        const { result } = renderHook(() => useActionRunner('app1', definition, {}));

        await act(async () => { await result.current.runAction('seq'); });

        expect(bodyOfCall(0).vars.seen).toBe('b');
        expect(bodyOfCall(0).vars).not.toHaveProperty('row');
    });
});
