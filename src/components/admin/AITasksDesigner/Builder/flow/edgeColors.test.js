import { describe, it, expect } from 'vitest';
import { STATUS_COLORS, CHART_SERIES } from '../../../../../constants/palette';
import { autoCaseColor, dominantPiiGroup, EDGE_COLOR_KEYS, PII_GROUP_COLORS, resolveEdgeColor } from './edgeColors';

describe('edgeColors', () => {
    it('resolves exactly the eight palette keys, nothing else', () => {
        expect(EDGE_COLOR_KEYS).toHaveLength(8);
        for (const k of EDGE_COLOR_KEYS) expect(resolveEdgeColor(k)).toBe(STATUS_COLORS[k]);
        expect(resolveEdgeColor('purple')).toBe(null);
        expect(resolveEdgeColor('#ff0000')).toBe(null);
        expect(resolveEdgeColor('')).toBe(null);
        expect(resolveEdgeColor(null)).toBe(null);
        expect(resolveEdgeColor(3)).toBe(null);
    });

    it('autoCaseColor is stable, wraps, and tolerates negatives/junk', () => {
        expect(autoCaseColor(0)).toBe(CHART_SERIES[0]);
        expect(autoCaseColor(CHART_SERIES.length)).toBe(CHART_SERIES[0]);
        expect(autoCaseColor(-1)).toBe(CHART_SERIES[CHART_SERIES.length - 1]);
        expect(autoCaseColor(undefined)).toBe(CHART_SERIES[0]);
    });

    it('covers all seven PII groups with a colour', () => {
        expect(Object.keys(PII_GROUP_COLORS)).toEqual([
            'Personal', 'Contact', 'Financial', 'Identity', 'Digital', 'Organization', 'EU / Netherlands',
        ]);
    });

    it('dominantPiiGroup picks the highest count; ties break deterministically', () => {
        expect(dominantPiiGroup({ Contact: 3, Personal: 1 })).toBe('Contact');
        expect(dominantPiiGroup({ Contact: 2, Personal: 2 })).toBe('Personal'); // declaration order
        expect(dominantPiiGroup({ Unknown: 9 })).toBe(null);
        expect(dominantPiiGroup({})).toBe(null);
        expect(dominantPiiGroup(null)).toBe(null);
    });

    it('never emits a banned colour (project rule: no purple/violet/indigo)', () => {
        // The banned families by name and by their common Tailwind hexes.
        const banned = /purple|violet|indigo|fuchsia|magenta|#(8b5cf6|a855f7|6366f1|d946ef|7c3aed|9333ea|4f46e5|c026d3)/i;
        const everyHex = [
            ...EDGE_COLOR_KEYS.map(resolveEdgeColor),
            ...Object.values(PII_GROUP_COLORS),
            ...Array.from({ length: 10 }, (_, i) => autoCaseColor(i)),
        ];
        for (const hex of everyHex) {
            expect(typeof hex).toBe('string');
            expect(banned.test(hex)).toBe(false);
        }
    });
});
