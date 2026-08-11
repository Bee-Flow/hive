import { describe, it, expect } from 'vitest';
import { summariseData, summariseEdgeData } from './dataSummary';

describe('summariseData', () => {
    it('counts a list of objects as records and a list of scalars as items', () => {
        expect(summariseData([{ a: 1 }, { a: 2 }])).toEqual({ count: 2, kind: 'records', label: '2 records' });
        expect(summariseData(['a', 'b', 'c'])).toEqual({ count: 3, kind: 'items', label: '3 items' });
        expect(summariseData([{ a: 1 }])).toMatchObject({ label: '1 record' });
    });

    it('looks INSIDE a result envelope — the number people actually mean', () => {
        // gmail_search returns {query, total, results:[…]}; "1 record" would be
        // true and useless.
        const out = { query: 'nextcloud', total: 2, results: [{ id: 1 }, { id: 2 }] };
        expect(summariseData(out)).toMatchObject({ count: 2, kind: 'records', label: '2 records' });
        expect(summariseData({ items: ['a'] })).toMatchObject({ label: '1 item' });
    });

    /**
     * BFSF-358A. This case used to assert the OPPOSITE — that a `total` of 201
     * next to two returned rows still reads "2 records". That is how someone
     * runs a search matching 201 mails, processes the first 10, and never
     * learns there were 201: the one number that would have told them was in
     * the payload and thrown away.
     */
    it('says "10 of 201" when the envelope reports more than it returned', () => {
        const out = { query: 'nextcloud', total: 201, results: Array.from({ length: 10 }, (_, i) => ({ id: i })) };
        const s = summariseData(out);
        expect(s.label).toBe('10 of 201 records');
        expect(s.count).toBe(10);
        expect(s.title).toMatch(/raise its result limit/i);
        // Scalars read as items, not records.
        expect(summariseData({ total: 9, items: ['a', 'b'] }).label).toBe('2 of 9 items');
    });

    it('ignores a `total` that is not a row count', () => {
        // Nothing was truncated…
        expect(summariseData({ total: 3, results: [1, 2, 3] }).label).toBe('3 items');
        expect(summariseData({ total: 1, results: [1, 2, 3] }).label).toBe('3 items');
        // …a cart total is money, not rows…
        expect(summariseData({ total: 99.95, items: [1, 2] }).label).toBe('2 items');
        // …and an unconventional list key means the sibling number is anyone's
        // guess, so it stays out of the label.
        expect(summariseData({ total: 300, attachments: [1, 2, 3] }).label).toBe('3 items');
    });

    it('falls back to a single array key when the name is unconventional', () => {
        expect(summariseData({ total: 3, attachments: [1, 2, 3] })).toMatchObject({ label: '3 items' });
    });

    it('stays at "1 record" when there is no single obvious list', () => {
        expect(summariseData({ a: [1], b: [2] })).toEqual({ count: 1, kind: 'record', label: '1 record' });
        expect(summariseData({ name: 'Tom' })).toMatchObject({ label: '1 record' });
    });

    it('reports text with a character count only when it is long', () => {
        expect(summariseData('ok')).toEqual({ count: 2, kind: 'text', label: 'text' });
        const long = 'x'.repeat(240);
        expect(summariseData(long)).toEqual({ count: 240, kind: 'text', label: 'text · 240 characters' });
    });

    it('reports scalars, and nothing at all for empty values', () => {
        expect(summariseData(42)).toMatchObject({ label: '1 value' });
        expect(summariseData(true)).toMatchObject({ label: '1 value' });
        expect(summariseData(null)).toBe(null);
        expect(summariseData(undefined)).toBe(null);
        expect(summariseData('')).toBe(null);
        expect(summariseData({})).toBe(null);
    });

    it('an empty list is still worth saying — it is a real, common result', () => {
        expect(summariseData([])).toEqual({ count: 0, kind: 'items', label: '0 items' });
    });
});

describe('summariseEdgeData', () => {
    const plain = { id: 'a', type: 'integration_action' };

    it('reports the step output on a plain connection', () => {
        const run = { status: 'success', output: { results: [{ id: 1 }, { id: 2 }, { id: 3 }] } };
        expect(summariseEdgeData(plain, run, { from: 'a', to: 'b' })).toMatchObject({ label: '3 records' });
    });

    it('reports only the rows that matched THAT case of a switch', () => {
        const step = { id: 'sw', type: 'switch' };
        const run = {
            status: 'success',
            output: { mode: 'collection', matchesByCase: { isv: [{ id: 1 }, { id: 2 }], default: [{ id: 3 }] } },
        };
        expect(summariseEdgeData(step, run, { label: 'case:isv', caseName: 'isv' })).toMatchObject({ label: '2 records' });
        expect(summariseEdgeData(step, run, { label: 'case:default', caseName: 'default' })).toMatchObject({ label: '1 record' });
        expect(summariseEdgeData(step, run, { label: 'case:ghost', caseName: 'ghost' })).toBe(null);
    });

    /**
     * BFSF-356 — a fan-out switch (matchMode 'all') takes SEVERAL ports at
     * once. `output.branches` lists them all; `output.branch` holds only the
     * first. Testing the edge against the singular value alone showed "no
     * data" on every path but the first, even though the run took them.
     */
    it('shows data on every port a fan-out switch fired, not just the first', () => {
        const step = { id: 'sw', type: 'switch' };
        const run = {
            status: 'success',
            output: {
                branch: 'case:land',
                branches: ['case:land', 'case:water'],
                matched: 'land,water',
                value: 'land and water permit',
            },
        };
        // Assert the LABEL, not merely that a chip appears. `branches` is the
        // one array on a scalar fan-out output, so the "single array value is
        // the payload" fallback claimed it and every chip read "2 items" — the
        // PORT COUNT dressed up as a record count, on a node whose sibling
        // ticket is about count honesty. One record went down each path.
        expect(summariseEdgeData(step, run, { label: 'case:land', caseName: 'land' }).label).toBe('1 record');
        expect(summariseEdgeData(step, run, { label: 'case:water', caseName: 'water' }).label).toBe('1 record');
        // A port that did NOT fire still carries nothing.
        expect(summariseEdgeData(step, run, { label: 'case:default', caseName: 'default' })).toBe(null);
        // Three ports must not become "3 items" either.
        const three = { ...run, output: { ...run.output, branches: ['case:a', 'case:b', 'case:c'] } };
        expect(summariseEdgeData(step, three, { label: 'case:a', caseName: 'a' }).label).toBe('1 record');
        // A REAL payload array alongside `branches` still wins the fallback.
        const withRows = { ...run, output: { ...run.output, rows: [{ id: 1 }, { id: 2 }] } };
        expect(summariseEdgeData(step, withRows, { label: 'case:land', caseName: 'land' }).label).toBe('2 records');
    });

    it('an EMPTY branches list means nothing matched — `branch` is the real port', () => {
        const step = { id: 'sw', type: 'switch' };
        const run = { status: 'success', output: { branch: 'case:default', branches: [], matched: null } };
        expect(summariseEdgeData(step, run, { label: 'case:default', caseName: 'default' })).not.toBe(null);
        expect(summariseEdgeData(step, run, { label: 'case:land', caseName: 'land' })).toBe(null);
    });

    it('says nothing on the branch a condition did NOT take', () => {
        const step = { id: 'c1', type: 'condition' };
        const run = { status: 'success', output: { branch: 'then', value: true } };
        expect(summariseEdgeData(step, run, { label: 'then' })).not.toBe(null);
        expect(summariseEdgeData(step, run, { label: 'else' })).toBe(null);
    });

    it('reports a filter by what it kept', () => {
        const step = { id: 'f1', type: 'filter' };
        const run = { status: 'success', output: { items: [{ id: 1 }, { id: 2 }], count: 2 } };
        expect(summariseEdgeData(step, run, { from: 'f1', to: 'b' })).toMatchObject({ label: '2 records' });
    });

    it('says "kept of total" when the runtime reports what the filter dropped', () => {
        const step = { id: 'f1', type: 'filter' };
        const run = { status: 'success', output: { items: [{ id: 1 }, { id: 2 }], count: 2, inputCount: 201, rejectedCount: 199 } };
        const s = summariseEdgeData(step, run, { from: 'f1', to: 'b' });
        expect(s.label).toBe('2 of 201 records');
        expect(s.title).toMatch(/199 did not match/);
        // Nothing dropped → the plain label, no noise.
        const all = { status: 'success', output: { items: [{ id: 1 }], count: 1, inputCount: 1, rejectedCount: 0 } };
        expect(summariseEdgeData(step, all, { from: 'f1', to: 'b' }).label).toBe('1 record');
    });

    it('says nothing when the step has not run, was skipped, or produced nothing', () => {
        expect(summariseEdgeData(plain, null, {})).toBe(null);
        expect(summariseEdgeData(plain, { status: 'skipped', output: { a: 1 } }, {})).toBe(null);
        expect(summariseEdgeData(plain, { status: 'success', output: null }, {})).toBe(null);
    });

    it('a synthetic pinned stub (no run behind it) still yields the count chip', () => {
        // flow/runStatus.js fabricates {status:'pinned', output} for pinned
        // nodes without a run row — the chip must read it like any run row.
        const stub = { stepId: 'a', status: 'pinned', output: { results: [{ id: 1 }, { id: 2 }] } };
        expect(summariseEdgeData(plain, stub, { from: 'a', to: 'b' })).toMatchObject({ label: '2 records' });
    });
});
