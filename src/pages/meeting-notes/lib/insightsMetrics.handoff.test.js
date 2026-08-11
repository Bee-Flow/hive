import { describe, expect, it } from 'vitest';
import { buildHandoffPairs } from './insightsMetrics';

/**
 * REGRESSION: handoff pairs were round-tripped through a space-joined string
 * key (`${from} ${to}`) and split back on the FIRST space. Speaker ids are
 * display names, and the default label is "Spreker 1" / "Speaker 1", so this
 * misfired on essentially every meeting — multi-word names were rendered as
 * fragments of two different people, and distinct pairs collided into
 * duplicate rows.
 */

/** n alternating turns between two speakers, 10s each. */
function alternating(a, b, n) {
    return Array.from({ length: n }, (_, i) => ({
        speaker: i % 2 === 0 ? a : b,
        start: i * 10,
        end: (i * 10) + 10,
        text: `turn ${i}`,
    }));
}

describe('buildHandoffPairs', () => {
    it('keeps multi-word names intact', () => {
        const pairs = buildHandoffPairs(alternating('Tom Kooy', 'Ans Bakker', 12));
        expect(pairs.length).toBeGreaterThan(0);
        const names = new Set(pairs.flatMap(p => [p.from, p.to]));
        expect(names).toEqual(new Set(['Tom Kooy', 'Ans Bakker']));
        // The old code produced 'Tom' → 'Kooy'.
        expect([...names].some(n => n === 'Tom' || n === 'Kooy')).toBe(false);
    });

    it('does not collide distinct pairs that share a name prefix', () => {
        // 'Spreker 1'→'Spreker 2' and 'Spreker 1'→'Spreker 3' both used to
        // reduce to the same mangled row.
        const segments = [];
        for (let i = 0; i < 12; i++) {
            segments.push({ speaker: 'Spreker 1', start: i * 20, end: i * 20 + 10, text: 'a' });
            segments.push({ speaker: i % 2 ? 'Spreker 2' : 'Spreker 3', start: i * 20 + 10, end: i * 20 + 20, text: 'b' });
        }
        const pairs = buildHandoffPairs(segments, { limit: 10 });
        const keys = pairs.map(p => `${p.from}|${p.to}`);
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys).toContain('Spreker 1|Spreker 2');
        expect(keys).toContain('Spreker 1|Spreker 3');
    });

    it('counts each direction separately and sorts by frequency', () => {
        const pairs = buildHandoffPairs(alternating('A', 'B', 12));
        expect(pairs.map(p => `${p.from}->${p.to}`).sort()).toEqual(['A->B', 'B->A']);
        expect(pairs[0].count).toBeGreaterThanOrEqual(pairs[1].count);
    });

    it('stays empty for a meeting with too few switches', () => {
        expect(buildHandoffPairs(alternating('A', 'B', 2))).toEqual([]);
        expect(buildHandoffPairs([])).toEqual([]);
    });
});
