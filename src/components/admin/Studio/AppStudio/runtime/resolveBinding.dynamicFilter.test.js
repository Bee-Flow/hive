import { describe, it, expect } from 'vitest';
import { resolveBinding, resolveBindingFilters, dataCacheKey } from './resolveBinding';

/**
 * Wave 2B2 — DYNAMIC binding filters. A record/records filter entry's value
 * may be a JSON literal OR { kind:'formula', expr } resolved client-side
 * against the live scope (buildScope shape) before the fetch. The request
 * carries only literals; the cache key hashes the RESOLVED filter.
 */

const SCOPE = {
    currentUser: { id: 'u-1', name: 'Vera' },
    vars: { filters: { q: 'red', done: false, count: 0, empty: '' } },
    forms: {},
    screen: { id: 'scr_1', params: { recordId: 'rec_9' } },
};

const formula = (expr) => ({ kind: 'formula', expr });

describe('resolveBindingFilters', () => {
    it('returns literal-only bindings AS-IS (identity-stable fast path)', () => {
        const binding = {
            kind: 'records',
            tableId: 't1',
            filter: [{ field: 'status', op: 'eq', value: 'open' }],
        };
        expect(resolveBindingFilters(binding, SCOPE)).toBe(binding);
    });

    it('passes through non-record kinds, missing filters and legacy object filters', () => {
        const dataset = { kind: 'dataset', datasetId: 'd1' };
        expect(resolveBindingFilters(dataset, SCOPE)).toBe(dataset);
        const noFilter = { kind: 'records', tableId: 't1' };
        expect(resolveBindingFilters(noFilter, SCOPE)).toBe(noFilter);
        const legacy = { kind: 'records', tableId: 't1', filter: { status: 'open' } };
        expect(resolveBindingFilters(legacy, SCOPE)).toBe(legacy);
        expect(resolveBindingFilters(null, SCOPE)).toBeNull();
    });

    it('resolves {kind:formula} values against the scope', () => {
        const binding = {
            kind: 'records',
            tableId: 'tickets',
            filter: [
                { field: 'owner_id', op: 'eq', value: formula('currentUser.id') },
                { field: 'title', op: 'contains', value: formula('vars.filters.q') },
                { field: 'status', op: 'eq', value: 'open' },
            ],
        };
        const resolved = resolveBindingFilters(binding, SCOPE);
        expect(resolved.filter).toEqual([
            { field: 'owner_id', op: 'eq', value: 'u-1' },
            { field: 'title', op: 'contains', value: 'red' },
            { field: 'status', op: 'eq', value: 'open' },
        ]);
        // The original binding is never mutated.
        expect(binding.filter[0].value).toEqual(formula('currentUser.id'));
    });

    it('OMITS entries resolving to undefined/null; "" / 0 / false are kept', () => {
        const binding = {
            kind: 'records',
            tableId: 't1',
            filter: [
                { field: 'a', op: 'eq', value: formula('vars.filters.nope') }, // undefined → omit
                { field: 'b', op: 'eq', value: formula('vars.filters.done') }, // false → keep
                { field: 'c', op: 'eq', value: formula('vars.filters.count') }, // 0 → keep
                { field: 'd', op: 'eq', value: formula('vars.filters.empty') }, // '' → keep
            ],
        };
        expect(resolveBindingFilters(binding, SCOPE).filter).toEqual([
            { field: 'b', op: 'eq', value: false },
            { field: 'c', op: 'eq', value: 0 },
            { field: 'd', op: 'eq', value: '' },
        ]);
    });

    it('omits literal null/undefined values too (a half-configured filter is normal)', () => {
        const binding = {
            kind: 'record',
            tableId: 't1',
            filter: [
                { field: 'a', op: 'eq', value: null },
                { field: 'b', op: 'eq', value: 'kept' },
            ],
        };
        expect(resolveBindingFilters(binding, SCOPE).filter).toEqual([
            { field: 'b', op: 'eq', value: 'kept' },
        ]);
    });

    it('a broken/blank formula resolves to undefined and the entry is omitted (never throws)', () => {
        const binding = {
            kind: 'records',
            tableId: 't1',
            filter: [
                { field: 'a', op: 'eq', value: formula('vars.filters.q ==') }, // parse error
                { field: 'b', op: 'eq', value: { kind: 'formula' } }, // no expr
                { field: 'c', op: 'eq', value: 'kept' },
            ],
        };
        expect(resolveBindingFilters(binding, SCOPE).filter).toEqual([
            { field: 'c', op: 'eq', value: 'kept' },
        ]);
    });

    it('isNull / isNotNull entries pass through untouched (no value to resolve)', () => {
        const isNull = { field: 'closed_at', op: 'isNull' };
        const isNotNull = { field: 'owner_id', op: 'isNotNull', value: formula('never.evaluated') };
        const binding = { kind: 'records', tableId: 't1', filter: [isNull, isNotNull] };
        const resolved = resolveBindingFilters(binding, SCOPE);
        expect(resolved).toBe(binding); // nothing changed → same object
        expect(resolved.filter[0]).toBe(isNull);
        expect(resolved.filter[1]).toBe(isNotNull);
    });

    it('drops the filter entirely when every entry is omitted (key == no-filter key)', () => {
        const binding = {
            kind: 'records',
            tableId: 't1',
            filter: [{ field: 'a', op: 'eq', value: formula('vars.filters.nope') }],
        };
        const resolved = resolveBindingFilters(binding, SCOPE);
        expect(resolved.filter).toBeUndefined();
        expect(dataCacheKey(resolved)).toBe(dataCacheKey({ kind: 'records', tableId: 't1' }));
    });

    it('resolves against an EMPTY scope when none is given (entries omitted, RLS still applies)', () => {
        const binding = {
            kind: 'records',
            tableId: 't1',
            filter: [
                { field: 'owner_id', op: 'eq', value: formula('currentUser.id') },
                { field: 'status', op: 'eq', value: 'open' },
            ],
        };
        expect(resolveBindingFilters(binding, undefined).filter).toEqual([
            { field: 'status', op: 'eq', value: 'open' },
        ]);
    });
});

describe('dataCacheKey over resolved filters', () => {
    const binding = {
        kind: 'records',
        tableId: 'tickets',
        filter: [{ field: 'title', op: 'contains', value: formula('vars.filters.q') }],
    };

    it('changes when the resolved value changes (a vars change refetches)', () => {
        const red = dataCacheKey(resolveBindingFilters(binding, { vars: { filters: { q: 'red' } } }));
        const blue = dataCacheKey(resolveBindingFilters(binding, { vars: { filters: { q: 'blue' } } }));
        expect(red).not.toBe(blue);
        expect(red).toContain('"title"');
    });

    it('is stable when the scope changes but the resolved value does not', () => {
        const a = dataCacheKey(resolveBindingFilters(binding, { vars: { filters: { q: 'red' } }, forms: { f: { x: 1 } } }));
        const b = dataCacheKey(resolveBindingFilters(binding, { vars: { filters: { q: 'red' } }, forms: { f: { x: 2 } } }));
        expect(a).toBe(b);
    });
});

describe('resolveBinding — record/records with dynamic filters', () => {
    it('reads dataState under the RESOLVED cache key (the key the fetch layer stored under)', () => {
        const binding = {
            kind: 'records',
            tableId: 'tickets',
            filter: [{ field: 'owner_id', op: 'eq', value: formula('currentUser.id') }],
        };
        const resolvedKey = dataCacheKey(resolveBindingFilters(binding, SCOPE));
        const dataState = {
            [resolvedKey]: { status: 'success', result: [{ id: 'r1' }], tableId: 'tickets' },
        };
        const out = resolveBinding(binding, { dataState, scope: SCOPE });
        expect(out.value).toEqual([{ id: 'r1' }]);
        expect(out.isLoading).toBe(false);

        // A different scope resolves to a different key → entry not found.
        const other = resolveBinding(binding, { dataState, scope: { currentUser: { id: 'u-2' } } });
        expect(other.value).toBeUndefined();
    });

    it('literal-filter bindings behave exactly as before (raw key)', () => {
        const binding = { kind: 'records', tableId: 't1', filter: [{ field: 's', op: 'eq', value: 'x' }] };
        const dataState = { [dataCacheKey(binding)]: { status: 'success', result: [1], tableId: 't1' } };
        expect(resolveBinding(binding, { dataState }).value).toEqual([1]);
    });
});

// ── required filters ────────────────────────────────────────────────────────
// Omitting an unresolved filter is right for an OPTIONAL one (a filter_bar
// field nobody filled in). It is exactly wrong for one that SCOPES a component
// to a selection: drop "belongs to the open ticket" and the component happily
// lists every row in the table. The support desk showed every attachment in the
// mailbox before a ticket was even picked.

describe('required filters', () => {
    const scoped = (expr) => ({
        kind: 'records',
        tableId: 'tbl_att',
        filter: [{ field: 'thread_key', op: 'eq', value: formula(expr), required: true }],
    });

    it('no value → no query at all, rather than an unfiltered one', () => {
        expect(resolveBindingFilters(scoped('vars.nothing'), SCOPE)).toBeNull();
        // Both layers agree: no cache key, so the fetcher is disabled and the
        // read side returns undefined instead of a full table.
        expect(dataCacheKey(resolveBindingFilters(scoped('vars.nothing'), SCOPE))).toBeNull();
    });

    it('a value resolves normally and the flag never reaches the wire', () => {
        const scope = { ...SCOPE, vars: { ...SCOPE.vars, thread: 'T-1' } };
        const out = resolveBindingFilters(scoped('vars.thread'), scope);
        expect(out.filter).toEqual([{ field: 'thread_key', op: 'eq', value: 'T-1' }]);
        expect('required' in out.filter[0]).toBe(false);
    });

    it('an OPTIONAL unresolved filter is still just omitted', () => {
        const binding = {
            kind: 'records',
            tableId: 'tbl_att',
            filter: [{ field: 'q', op: 'contains', value: formula('vars.filters.missing') }],
        };
        const out = resolveBindingFilters(binding, SCOPE);
        expect(out).not.toBeNull();
        expect(out.filter).toBeUndefined();
    });

    it('one missing required filter kills the query even if others resolve', () => {
        const binding = {
            kind: 'records',
            tableId: 'tbl_att',
            filter: [
                { field: 'status', op: 'eq', value: 'open' },
                { field: 'thread_key', op: 'eq', value: formula('vars.nothing'), required: true },
            ],
        };
        expect(resolveBindingFilters(binding, SCOPE)).toBeNull();
    });
});
