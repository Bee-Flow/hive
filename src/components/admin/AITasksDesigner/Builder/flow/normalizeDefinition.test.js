import { describe, it, expect } from 'vitest';
import { normalizeDefinitionShape, isBlankDefinition, emptyGraph } from './normalizeDefinition';

describe('isBlankDefinition', () => {
    it('treats nullish and non-objects as blank', () => {
        expect(isBlankDefinition(null)).toBe(true);
        expect(isBlankDefinition(undefined)).toBe(true);
        expect(isBlankDefinition('nope')).toBe(true);
        expect(isBlankDefinition([])).toBe(true);
    });

    it('treats the poisoned empty object as blank (BFSF-318)', () => {
        // `{}` is truthy, which is exactly why it defeated every `def || seed`
        // fallback and had to be detected structurally instead.
        expect(isBlankDefinition({})).toBe(true);
        expect(isBlankDefinition({ steps: [], edges: [] })).toBe(true);
        expect(isBlankDefinition({ trigger: null, steps: [], edges: [] })).toBe(true);
    });

    it('treats a graph with a trigger or any step as present', () => {
        expect(isBlankDefinition({ trigger: { id: 'trg' }, steps: [], edges: [] })).toBe(false);
        expect(isBlankDefinition({ steps: [{ id: 'a' }], edges: [] })).toBe(false);
        expect(isBlankDefinition({ triggers: [{ id: 't2' }] })).toBe(false);
    });
});

describe('normalizeDefinitionShape', () => {
    it('returns null for a nullish or non-object input', () => {
        expect(normalizeDefinitionShape(null)).toBeNull();
        expect(normalizeDefinitionShape(undefined)).toBeNull();
        expect(normalizeDefinitionShape([])).toBeNull();
    });

    it('materialises missing steps/edges arrays', () => {
        expect(normalizeDefinitionShape({})).toEqual({ steps: [], edges: [] });
        expect(normalizeDefinitionShape({ trigger: { id: 'trg' } }))
            .toEqual({ trigger: { id: 'trg' }, steps: [], edges: [] });
    });

    it('preserves every other key', () => {
        const out = normalizeDefinitionShape({
            schemaVersion: 2,
            trigger: { id: 'trg' },
            triggers: [{ id: 't2' }],
            layers: { enrich: { title: 'x' } },
            vars: { a: 1 },
        });
        expect(out.schemaVersion).toBe(2);
        expect(out.triggers).toEqual([{ id: 't2' }]);
        expect(out.layers).toEqual({ enrich: { title: 'x' } });
        expect(out.vars).toEqual({ a: 1 });
    });

    it('returns the same object identity when already well-formed', () => {
        const def = { trigger: { id: 'trg' }, steps: [], edges: [] };
        expect(normalizeDefinitionShape(def)).toBe(def);
    });

    it('does not mutate its input', () => {
        const def = { trigger: { id: 'trg' } };
        normalizeDefinitionShape(def);
        expect(def.steps).toBeUndefined();
    });
});

describe('emptyGraph', () => {
    it('is a well-formed, blank graph', () => {
        const g = emptyGraph();
        expect(Array.isArray(g.steps)).toBe(true);
        expect(Array.isArray(g.edges)).toBe(true);
        expect(isBlankDefinition(g)).toBe(true);
    });
});
