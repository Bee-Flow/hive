import { describe, it, expect } from 'vitest';
import { partitionInputs, isEmptyBinding } from './partitionInputs';

describe('isEmptyBinding', () => {
    it('treats null/empty literal/empty ref as empty', () => {
        expect(isEmptyBinding(null)).toBe(true);
        expect(isEmptyBinding({ kind: 'literal', value: '' })).toBe(true);
        expect(isEmptyBinding({ kind: 'ref', path: '' })).toBe(true);
        expect(isEmptyBinding({ kind: 'expr', value: '' })).toBe(true);
    });
    it('treats populated bindings as non-empty', () => {
        expect(isEmptyBinding({ kind: 'literal', value: 'x' })).toBe(false);
        expect(isEmptyBinding({ kind: 'ref', path: 'trigger.output.x' })).toBe(false);
    });
});

describe('partitionInputs', () => {
    const props = {
        query: { type: 'string' },          // common-name → essential
        mode: { type: 'string' },           // → advanced
        max_results: { type: 'integer' },   // → advanced
        token: { type: 'string', 'x-advanced': true },
        prio: { type: 'string', 'x-primary': true }, // → essential
    };

    it('puts required and common fields in essential, the rest in advanced', () => {
        const { essentialKeys, advancedKeys } = partitionInputs(props, new Set(['mode']), {});
        expect(essentialKeys).toContain('query');   // common allowlist
        expect(essentialKeys).toContain('mode');    // required wins
        expect(essentialKeys).toContain('prio');    // x-primary
        expect(advancedKeys).toContain('max_results');
        expect(advancedKeys).toContain('token');    // x-advanced
    });

    it('keeps a populated field essential even if it would be advanced', () => {
        const inputs = { max_results: { kind: 'literal', value: '5' } };
        const { essentialKeys, advancedKeys } = partitionInputs(props, new Set(), inputs);
        expect(essentialKeys).toContain('max_results'); // already-set wins
        expect(advancedKeys).not.toContain('max_results');
    });

    it('preserves declaration order within each bucket', () => {
        const { essentialKeys } = partitionInputs(props, new Set(['mode']), {});
        // query before mode before prio (declaration order)
        expect(essentialKeys.indexOf('query')).toBeLessThan(essentialKeys.indexOf('mode'));
        expect(essentialKeys.indexOf('mode')).toBeLessThan(essentialKeys.indexOf('prio'));
    });

    it('promotes the first property when nothing else is essential (floor)', () => {
        const onlyAdvanced = { a: { type: 'string' }, b: { type: 'string' } };
        const { essentialKeys } = partitionInputs(onlyAdvanced, new Set(), {});
        expect(essentialKeys).toEqual(['a']);
    });

    it('handles missing properties gracefully', () => {
        expect(partitionInputs(null, new Set(), {})).toEqual({ essentialKeys: [], advancedKeys: [] });
    });
});
