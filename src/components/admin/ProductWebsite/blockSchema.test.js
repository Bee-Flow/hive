/**
 * Unit — client block validation/normalization for JSON import (Workstream B).
 *
 * Pins: conforming import round-trips clean; unknown block types are dropped
 * and reported (never a silent empty page); aliased type strings resolve;
 * top-level fields get wrapped into `content`; a non-array `blocks` is
 * reported. `./editors` is mocked to the 15 canonical type keys so the test
 * doesn't pull the whole (React) editor tree.
 *
 * Run: cd agent-hub && npx vitest run src/components/admin/ProductWebsite/blockSchema.test.js
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('./editors', () => ({
    BLOCK_CATALOGUE: {
        hero: {}, socialProof: {}, content: {}, 'media-text': {}, features: {},
        steps: {}, security: {}, integrations: {}, architecture: {}, techStats: {},
        cta: {}, 'cta-banner': {}, 'live-component': {}, pricing: {}, 'customer-support': {},
    },
}));

const { validateBlocks, describeDropped, KNOWN_BLOCK_TYPES } = await import('./blockSchema');

describe('validateBlocks', () => {
    it('round-trips conforming blocks with zero drops', () => {
        const r = validateBlocks([
            { id: 'b1', type: 'hero', content: { eyebrow: 'Hi' }, style: {} },
            { id: 'b2', type: 'features', content: {} },
        ]);
        expect(r.ok).toBe(true);
        expect(r.dropped).toHaveLength(0);
        expect(r.normalizedBlocks).toHaveLength(2);
        expect(r.normalizedBlocks[0].content.eyebrow).toBe('Hi');
    });

    it('drops unknown block types and reports index + original type', () => {
        const r = validateBlocks([
            { id: 'b1', type: 'landing', content: {} },
            { id: 'b2', type: 'hero', content: {} },
        ]);
        expect(r.ok).toBe(false);
        expect(r.normalizedBlocks).toHaveLength(1);
        expect(r.dropped[0]).toMatchObject({ index: 0, type: 'landing', reason: 'unknown-type' });
        expect(describeDropped(r.dropped)).toContain('landing');
    });

    it('resolves aliased type strings', () => {
        const r = validateBlocks([{ id: 'b1', type: 'social-proof', content: {} }]);
        expect(r.ok).toBe(true);
        expect(r.normalizedBlocks[0].type).toBe('socialProof');
        expect(r.warnings.some(w => w.code === 'aliased-type')).toBe(true);
    });

    it('wraps top-level fields into content', () => {
        const r = validateBlocks([{ id: 'b1', type: 'hero', eyebrow: 'Hi', lead: 'x' }]);
        expect(r.normalizedBlocks[0].content).toMatchObject({ eyebrow: 'Hi', lead: 'x' });
        expect(r.warnings.some(w => w.code === 'wrapped-top-level-content')).toBe(true);
    });

    it('generates a missing id', () => {
        const r = validateBlocks([{ type: 'hero', content: {} }]);
        expect(r.normalizedBlocks[0].id).toMatch(/^blk_/);
        expect(r.warnings.some(w => w.code === 'generated-id')).toBe(true);
    });

    it('reports a non-array blocks input', () => {
        const r = validateBlocks(null);
        expect(r.ok).toBe(false);
        expect(r.dropped[0].reason).toBe('blocks-not-array');
    });

    it('exposes all 15 canonical types', () => {
        expect(KNOWN_BLOCK_TYPES).toHaveLength(15);
    });
});
