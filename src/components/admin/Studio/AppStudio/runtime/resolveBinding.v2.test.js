import { describe, it, expect } from 'vitest';
import { resolveBinding, walkPath, dataCacheKey } from './resolveBinding';

describe('walkPath (v2 — dot + bracket + index)', () => {
    const obj = { rows: [{ title: 'Fix printer' }], stats: { open: 4 }, 'a-b': 7 };

    it('walks dotted and numeric-index paths', () => {
        expect(walkPath(obj, 'stats.open')).toBe(4);
        expect(walkPath(obj, 'rows.0.title')).toBe('Fix printer');
    });

    it('walks bracket + quoted-key notation', () => {
        expect(walkPath(obj, 'rows[0].title')).toBe('Fix printer');
        expect(walkPath(obj, '["a-b"]')).toBe(7);
    });

    it('returns the value itself for an empty path and undefined for dead paths', () => {
        expect(walkPath(obj, '')).toBe(obj);
        expect(walkPath(obj, 'rows.9.title')).toBeUndefined();
        expect(walkPath(null, 'a')).toBeUndefined();
        expect(walkPath(obj, 5)).toBeUndefined();
    });
});

describe('dataCacheKey', () => {
    it('is stable across filter key order and distinguishes kinds', () => {
        const a = dataCacheKey({ kind: 'records', tableId: 't1', filter: { x: 1, y: 2 }, limit: 10 });
        const b = dataCacheKey({ kind: 'records', tableId: 't1', limit: 10, filter: { y: 2, x: 1 } });
        expect(a).toBe(b);
        expect(dataCacheKey({ kind: 'record', tableId: 't1' })).not.toBe(dataCacheKey({ kind: 'records', tableId: 't1' }));
        expect(dataCacheKey({ kind: 'dataset', datasetId: 'd9' })).toBe('dataset:d9');
        expect(dataCacheKey({ kind: 'static', value: 1 })).toBeNull();
    });
});

describe('resolveBinding v2 — kinds', () => {
    it('static → the value', () => {
        expect(resolveBinding({ kind: 'static', value: 42 }, {})).toEqual({ value: 42, isLoading: false, error: null, errorCode: null });
    });

    it('actionResult → walks the result; loading/error tracked', () => {
        const actionState = {
            act1: { status: 'success', result: { rows: [{ id: 9 }] } },
            act2: { status: 'running' },
            act3: { status: 'error', error: 'boom' },
        };
        expect(resolveBinding({ kind: 'actionResult', actionId: 'act1', path: 'rows[0].id' }, { actionState }).value).toBe(9);
        expect(resolveBinding({ kind: 'actionResult', actionId: 'act2', path: 'x' }, { actionState }).isLoading).toBe(true);
        expect(resolveBinding({ kind: 'actionResult', actionId: 'act3', path: 'x' }, { actionState }).error).toBe('boom');
        expect(resolveBinding({ kind: 'actionResult', actionId: 'missing', path: 'x' }, { actionState }).value).toBeUndefined();
    });

    it('formula → tryEvaluate against the passed scope (sync, never throws)', () => {
        const scope = { form: { quantity: 3 }, currentUser: { name: 'Zoe' } };
        expect(resolveBinding({ kind: 'formula', expr: 'form.quantity * 2' }, { scope }).value).toBe(6);
        expect(resolveBinding({ kind: 'formula', expr: 'currentUser.name' }, { scope }).value).toBe('Zoe');
        const bad = resolveBinding({ kind: 'formula', expr: 'form.quantity ==' }, { scope });
        expect(bad.value).toBeUndefined();
        expect(bad.error).toBeTruthy();
        expect(bad.isLoading).toBe(false);
        expect(resolveBinding({ kind: 'formula', expr: '   ' }, { scope })).toEqual({ value: undefined, isLoading: false, error: null, errorCode: null });
    });

    it('records/record/dataset → read dataState by cache key (status → loading/value/error)', () => {
        const recBinding = { kind: 'records', tableId: 't1' };
        const dsBinding = { kind: 'dataset', datasetId: 'd1' };
        const dataState = {
            [dataCacheKey(recBinding)]: { status: 'success', result: [{ a: 1 }], tableId: 't1' },
            [dataCacheKey(dsBinding)]: { status: 'loading', result: undefined, datasetId: 'd1' },
        };
        expect(resolveBinding(recBinding, { dataState }).value).toEqual([{ a: 1 }]);
        expect(resolveBinding(dsBinding, { dataState }).isLoading).toBe(true);
        // A key with no entry has NOT STARTED — loading, so the component shows
        // its skeleton instead of flashing "No results" before the first fetch.
        expect(resolveBinding({ kind: 'record', tableId: 'nope' }, { dataState })).toEqual({ value: undefined, isLoading: true, error: null, errorCode: null });
        // A query that came back empty is loaded, not loading.
        const emptyKey = dataCacheKey({ kind: 'records', tableId: 't2' });
        expect(resolveBinding({ kind: 'records', tableId: 't2' }, { dataState: { [emptyKey]: { status: 'success', result: [], tableId: 't2' } } }))
            .toEqual({ value: [], isLoading: false, error: null, errorCode: null });
    });

    it('unknown kind / null binding → inert empty result', () => {
        expect(resolveBinding({ kind: 'mystery' }, {})).toEqual({ value: undefined, isLoading: false, error: null, errorCode: null });
        expect(resolveBinding(null, {})).toEqual({ value: undefined, isLoading: false, error: null, errorCode: null });
        expect(resolveBinding('nope', {})).toEqual({ value: undefined, isLoading: false, error: null, errorCode: null });
    });
});

describe('resolveBinding v2 — back-compat', () => {
    it('accepts a BARE actionState as the 2nd arg (v1 call sites)', () => {
        const bareActionState = { act1: { status: 'success', result: { total: 5 } } };
        // No actionState/dataState/scope key → treated as { actionState, dataState:{} }.
        expect(resolveBinding({ kind: 'actionResult', actionId: 'act1', path: 'total' }, bareActionState).value).toBe(5);
    });

    it('bare-actionState and bag forms resolve identically', () => {
        const state = { act1: { status: 'success', result: { total: 5 } } };
        const b = { kind: 'actionResult', actionId: 'act1', path: 'total' };
        expect(resolveBinding(b, state)).toEqual(resolveBinding(b, { actionState: state }));
    });
});
