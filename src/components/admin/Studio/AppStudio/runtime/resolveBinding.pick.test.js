import { describe, it, expect } from 'vitest';
import { resolveBinding, dataCacheKey } from './resolveBinding';

// A saved view answers with ROWS; a stat tile means one value out of them.
const ROWS = [
    { month: '2026-01', open_count: 12 },
    { month: '2026-02', open_count: 7 },
];

function stateFor(binding, entry) {
    return { dataState: { [dataCacheKey(binding)]: entry } };
}

describe('resolveBinding — pick (one value out of a row-shaped result)', () => {
    const base = { kind: 'dataset', datasetId: 'ds_1' };
    const loaded = { status: 'success', result: ROWS, datasetId: 'ds_1' };

    it('without pick the dataset still resolves to the whole row array', () => {
        expect(resolveBinding(base, stateFor(base, loaded)))
            .toEqual({ value: ROWS, isLoading: false, error: null, errorCode: null });
    });

    it('first/last row × column', () => {
        const first = { ...base, pick: { row: 'first', column: 'open_count' } };
        const last = { ...base, pick: { row: 'last', column: 'open_count' } };
        expect(resolveBinding(first, stateFor(base, loaded)).value).toBe(12);
        expect(resolveBinding(last, stateFor(base, loaded)).value).toBe(7);
    });

    it('an unnamed column yields the whole row, so a half-set pick is harmless', () => {
        const noColumn = { ...base, pick: { row: 'first' } };
        expect(resolveBinding(noColumn, stateFor(base, loaded)).value).toEqual(ROWS[0]);
        const emptyColumn = { ...base, pick: { row: 'first', column: '' } };
        expect(resolveBinding(emptyColumn, stateFor(base, loaded)).value).toEqual(ROWS[0]);
    });

    it('a column that is not in the answer resolves to undefined, never throws', () => {
        const gone = { ...base, pick: { row: 'first', column: 'nope' } };
        expect(resolveBinding(gone, stateFor(base, loaded)).value).toBeUndefined();
    });

    it('an empty answer picks nothing', () => {
        const b = { ...base, pick: { row: 'first', column: 'open_count' } };
        expect(resolveBinding(b, stateFor(base, { status: 'success', result: [], datasetId: 'ds_1' })).value).toBeUndefined();
    });

    it('loading and error pass through untouched', () => {
        const b = { ...base, pick: { row: 'first', column: 'open_count' } };
        expect(resolveBinding(b, stateFor(base, { status: 'loading' })))
            .toEqual({ value: undefined, isLoading: true, error: null, errorCode: null });
        expect(resolveBinding(b, stateFor(base, { status: 'error', error: 'boom' })))
            .toEqual({ value: undefined, isLoading: false, error: 'boom', errorCode: null });
        // No entry at all is "not started", exactly as without a pick.
        expect(resolveBinding(b, { dataState: {} }))
            .toEqual({ value: undefined, isLoading: true, error: null, errorCode: null });
    });

    it('a single-row source needs no row step', () => {
        const rec = { kind: 'record', tableId: 't1' };
        const picked = { ...rec, pick: { row: 'first', column: 'open_count' } };
        expect(resolveBinding(picked, stateFor(rec, { status: 'success', result: ROWS[0], tableId: 't1' })).value).toBe(12);
    });

    it('a malformed pick is ignored rather than fatal', () => {
        for (const pick of [null, 'first', 42, ['open_count']]) {
            expect(resolveBinding({ ...base, pick }, stateFor(base, loaded)).value).toEqual(ROWS);
        }
    });

    it('pick is a read-side lens: two tiles over one view share a cache key', () => {
        const a = { ...base, pick: { row: 'first', column: 'open_count' } };
        const b = { ...base, pick: { row: 'last', column: 'month' } };
        expect(dataCacheKey(a)).toBe(dataCacheKey(base));
        expect(dataCacheKey(b)).toBe(dataCacheKey(base));
    });
});
