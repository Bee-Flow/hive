import { describe, it, expect } from 'vitest';
import { resolveBinding, resolveBindingParams, dataCacheKey } from './resolveBinding';

/**
 * Wave 6a — CONNECTOR bindings. { kind:'connector', connectorId, params? }
 * where a param value is a JSON literal OR { kind:'formula', expr } resolved
 * client-side against the live scope before the run (resolveBindingParams). The
 * request carries only literals; the cache key hashes the RESOLVED params.
 */

const SCOPE = {
    currentUser: { id: 'u-1', name: 'Vera' },
    vars: { filters: { q: 'red', done: false } },
    screen: { params: { recordId: 'rec_9' } },
};

const formula = (expr) => ({ kind: 'formula', expr });

describe('resolveBindingParams', () => {
    it('returns non-connector kinds and param-less connectors AS-IS', () => {
        const records = { kind: 'records', tableId: 't1' };
        expect(resolveBindingParams(records, SCOPE)).toBe(records);
        const noParams = { kind: 'connector', connectorId: 'conn_a' };
        expect(resolveBindingParams(noParams, SCOPE)).toBe(noParams);
    });

    it('literal-only params are returned AS-IS (identity-stable fast path)', () => {
        const binding = { kind: 'connector', connectorId: 'conn_a', params: { q: 'red', page: 2 } };
        expect(resolveBindingParams(binding, SCOPE)).toBe(binding);
    });

    it('resolves {kind:formula} params against the scope; literals pass through', () => {
        const binding = {
            kind: 'connector', connectorId: 'conn_a',
            params: { q: formula('vars.filters.q'), user: formula('currentUser.id'), fixed: 'x' },
        };
        const out = resolveBindingParams(binding, SCOPE);
        expect(out.params).toEqual({ q: 'red', user: 'u-1', fixed: 'x' });
    });

    it('omits a param whose formula resolves to undefined; keeps null/false/0/""', () => {
        const binding = {
            kind: 'connector', connectorId: 'conn_a',
            params: { gone: formula('vars.filters.missing'), off: false, empty: '' },
        };
        const out = resolveBindingParams(binding, SCOPE);
        expect(out.params).toEqual({ off: false, empty: '' });
        expect('gone' in out.params).toBe(false);
    });
});

describe('dataCacheKey — connector', () => {
    it('keys on connectorId + a stable hash of the (resolved) params', () => {
        const a = dataCacheKey({ kind: 'connector', connectorId: 'conn_a', params: { q: 'red', p: 1 } });
        const b = dataCacheKey({ kind: 'connector', connectorId: 'conn_a', params: { p: 1, q: 'red' } });
        expect(a).toBe(b); // key order does not matter
        const c = dataCacheKey({ kind: 'connector', connectorId: 'conn_a', params: { q: 'blue' } });
        expect(c).not.toBe(a);
        expect(dataCacheKey({ kind: 'connector', connectorId: 'conn_a' })).toBe('connector:conn_a:null');
    });
});

describe('resolveBinding — connector', () => {
    it('reads the dataState entry stored under the RESOLVED-params key', () => {
        const binding = { kind: 'connector', connectorId: 'conn_a', params: { q: formula('vars.filters.q') } };
        const key = dataCacheKey(resolveBindingParams(binding, SCOPE));
        const dataState = { [key]: { status: 'success', result: [{ id: 'x' }], connectorId: 'conn_a' } };
        const out = resolveBinding(binding, { dataState, scope: SCOPE });
        expect(out.value).toEqual([{ id: 'x' }]);
        expect(out.isLoading).toBe(false);

        // A different scope → different resolved params → different key → miss.
        const other = resolveBinding(binding, { dataState, scope: { vars: { filters: { q: 'green' } } } });
        expect(other.value).toBeUndefined();
    });

    it('surfaces loading and error entry states', () => {
        const binding = { kind: 'connector', connectorId: 'conn_a', params: { q: 'red' } };
        const key = dataCacheKey(binding);
        expect(resolveBinding(binding, { dataState: { [key]: { status: 'loading' } } }).isLoading).toBe(true);
        const err = resolveBinding(binding, { dataState: { [key]: { status: 'error', error: 'boom' } } });
        expect(err.error).toBe('boom');
    });
});
