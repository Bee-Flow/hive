import { describe, it, expect } from 'vitest';
import { summarizeDefinitionDiff, summarizeDefinitionDiffLine } from './diffSummary';

describe('summarizeDefinitionDiff', () => {
    it('returns no phrases when definitions are equal', () => {
        const def = { steps: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b' }] };
        expect(summarizeDefinitionDiff(def, def)).toEqual([]);
    });

    it('ignores key reordering', () => {
        const prev = { description: 'x', trigger: { kind: 'manual' } };
        const next = { trigger: { kind: 'manual' }, description: 'x' };
        expect(summarizeDefinitionDiff(prev, next)).toEqual([]);
    });

    it('counts steps added / removed / changed by id', () => {
        const prev = { steps: [{ id: 'a', t: 1 }, { id: 'b' }, { id: 'c' }] };
        const next = { steps: [{ id: 'a', t: 2 }, { id: 'b' }, { id: 'd' }] };
        const phrases = summarizeDefinitionDiff(prev, next);
        expect(phrases).toContain('1 step added');
        expect(phrases).toContain('1 step removed');
        expect(phrases).toContain('1 step changed');
    });

    it('pluralizes counts', () => {
        const next = { steps: [{ id: 'a' }, { id: 'b' }] };
        expect(summarizeDefinitionDiff({ steps: [] }, next)).toEqual(['2 steps added']);
    });

    it('counts connection (edge) changes', () => {
        const prev = { edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }] };
        const next = { edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'd' }] };
        const phrases = summarizeDefinitionDiff(prev, next);
        expect(phrases).toContain('1 connection added');
        expect(phrases).toContain('1 connection removed');
    });

    it('reports scalar/object field changes', () => {
        const prev = { description: 'old', notificationSettings: { onError: { enabled: true } } };
        const next = { description: 'new', notificationSettings: { onError: { enabled: false } } };
        const phrases = summarizeDefinitionDiff(prev, next);
        expect(phrases).toContain('Description changed');
        expect(phrases).toContain('Notification settings changed');
    });

    it('tolerates null / malformed definitions', () => {
        expect(summarizeDefinitionDiff(null, undefined)).toEqual([]);
        expect(summarizeDefinitionDiff({ steps: 'nope' }, {})).toEqual([]);
    });
});

describe('summarizeDefinitionDiffLine', () => {
    it('joins phrases with a separator', () => {
        const prev = { steps: [{ id: 'a' }], edges: [{ from: 'a', to: 'b' }], description: 'x' };
        const next = { steps: [{ id: 'a' }, { id: 'b' }], edges: [], description: 'y' };
        expect(summarizeDefinitionDiffLine(prev, next)).toBe('1 step added · 1 connection removed · Description changed');
    });

    it('falls back to a formatting-only note', () => {
        const def = { steps: [{ id: 'a' }] };
        expect(summarizeDefinitionDiffLine(def, def)).toBe('No structural changes (formatting only)');
    });
});
