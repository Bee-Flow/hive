/**
 * walkRelativePath parity suite — mirrors the SERVER fixtures in
 * server/automation/bind.walkRelativePath.test.js byte-for-byte (same
 * inputs, same expectations), so the parse_json design-time preview can
 * never drift from what the runtime extracts.
 */
import { describe, it, expect } from 'vitest';
import { walkPath, walkRelativePath } from './bindingHelpers';

describe('walkRelativePath — server parity', () => {
    it('empty path, "$", and nullish path return the whole source', () => {
        const src = { a: 1 };
        expect(walkRelativePath('', src)).toBe(src);
        expect(walkRelativePath('$', src)).toBe(src);
        expect(walkRelativePath(null, src)).toBe(src);
        expect(walkRelativePath(undefined, src)).toBe(src);
    });

    it('dotted object paths resolve', () => {
        const src = { order: { customer: { email: 'a@b.c' } } };
        expect(walkRelativePath('order.customer.email', src)).toBe('a@b.c');
    });

    it('numeric index and quoted-key segments resolve', () => {
        const src = { items: [{ sku: 'X1' }, { sku: 'X2' }], 'key with spaces': { v: 7 } };
        expect(walkRelativePath('items[0].sku', src)).toBe('X1');
        expect(walkRelativePath('items[1].sku', src)).toBe('X2');
        expect(walkRelativePath('["key with spaces"].v', src)).toBe(7);
        expect(walkRelativePath("['key with spaces'].v", src)).toBe(7);
    });

    it('leading bracket segment supports root-array sources', () => {
        const src = [{ id: 'a' }, { id: 'b' }];
        expect(walkRelativePath('[0].id', src)).toBe('a');
        expect(walkRelativePath('[*].id', src)).toEqual(['a', 'b']);
    });

    it('[*] maps + flattens one level (server resolveTokens semantics)', () => {
        const src = { orders: [{ lines: [{ sku: 'A' }, { sku: 'B' }] }, { lines: [{ sku: 'C' }] }] };
        expect(walkRelativePath('orders[*].lines', src)).toEqual([{ sku: 'A' }, { sku: 'B' }, { sku: 'C' }]);
        expect(walkRelativePath('orders[*].lines[*].sku', src)).toEqual(['A', 'B', 'C']);
    });

    it('missing paths resolve to undefined (tolerant intermediates)', () => {
        expect(walkRelativePath('a.b.c', { a: {} })).toBeUndefined();
        expect(walkRelativePath('items[5].x', { items: [] })).toBeUndefined();
        expect(walkRelativePath('x', null)).toBeUndefined();
    });

    it('prototype-chain members are blocked (own properties only)', () => {
        const src = { a: 1 };
        expect(walkRelativePath('constructor', src)).toBeUndefined();
        expect(walkRelativePath('__proto__', src)).toBeUndefined();
        expect(walkRelativePath('a.toFixed', src)).toBeUndefined();
        // Array indices / .length ARE own properties — legitimate access works.
        expect(walkRelativePath('list.length', { list: [1, 2] })).toBe(2);
    });

    it('non-string weirdness is rejected safely', () => {
        // A bare-digit key fails REF_RE's identifier rule — bracket form works.
        expect(walkRelativePath(0, { 0: 'zero' })).toBeUndefined();
        expect(walkRelativePath('[0]', ['zero'])).toBe('zero');
        // A malformed path (unclosed bracket) → undefined, no throw.
        expect(walkRelativePath('items[0', { items: ['x'] })).toBeUndefined();
    });
});

describe('walkPath — prototype guard (the fixed FE gap)', () => {
    it('blocks prototype-chain access like the server resolver', () => {
        expect(walkPath('steps.s1.output.constructor', { steps: { s1: { output: {} } } })).toBeUndefined();
        expect(walkPath('trigger.output.__proto__', { trigger: { output: {} } })).toBeUndefined();
    });

    it('still resolves legitimate own-property paths', () => {
        const root = { steps: { s1: { output: { items: ['a', 'b'] } } } };
        expect(walkPath('steps.s1.output.items.length', root)).toBe(2);
        expect(walkPath('steps.s1.output.items[1]', root)).toBe('b');
    });
});
