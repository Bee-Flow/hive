import { describe, it, expect } from 'vitest';
import {
    toPoints, groupByWidth, attributeToBlocks, blockLabel, toScrollReach, reachAt,
} from './model';

// Shapes copied from a live Umami 3.2 response.
const POINT = (over = {}) => ({
    x: 640, y: 174, pageX: 640, pageY: 174,
    pageW: 1280, pageH: 2549, viewportW: 1280, viewportH: 720, count: 2,
    ...over,
});

describe('toPoints', () => {
    it('reads absolute page coordinates and the capture size', () => {
        const [p] = toPoints({ points: [POINT()] });
        expect(p).toMatchObject({ x: 640, y: 174, pageW: 1280, pageH: 2549, count: 2 });
    });

    it('defaults a missing count to one click, not zero', () => {
        const [p] = toPoints({ points: [POINT({ count: undefined })] });
        expect(p.count).toBe(1);
    });

    it('drops points with unusable coordinates', () => {
        const pts = toPoints({ points: [POINT(), { pageX: 'nope', pageY: null }] });
        expect(pts).toHaveLength(1);
    });
});

describe('groupByWidth', () => {
    it('never mixes capture widths, and leads with the most-used one', () => {
        // A 390px mobile click and a 1280px desktop click at the same pageX are
        // in completely different places; normalising them together is the bug
        // this replaces.
        const pts = toPoints({
            points: [
                POINT({ pageW: 390, pageH: 4000, count: 9 }),
                POINT({ pageW: 1280, count: 2 }),
                POINT({ pageW: 1280, count: 1 }),
            ],
        });
        const groups = groupByWidth(pts);
        expect(groups.map(g => g.width)).toEqual([390, 1280]);
        expect(groups[0].clicks).toBe(9);
        expect(groups[1].clicks).toBe(3);
        expect(Math.round(groups[0].share)).toBe(75);
        expect(groups[0].pageH).toBe(4000);
    });
});

describe('attributeToBlocks', () => {
    const blocks = [
        { id: 'blk_hero', type: 'hero', top: 0, height: 600 },
        { id: 'blk_price', type: 'pricing', top: 600, height: 400 },
    ];

    it('assigns each click to the block it landed in', () => {
        const pts = toPoints({
            points: [POINT({ pageY: 100, count: 3 }), POINT({ pageY: 700, count: 1 })],
        });
        const { rows, total } = attributeToBlocks(pts, blocks);
        expect(total).toBe(4);
        expect(rows[0]).toMatchObject({ id: 'blk_hero', clicks: 3 });
        expect(Math.round(rows[0].share)).toBe(75);
    });

    it('reports clicks outside every block as site chrome rather than dropping them', () => {
        // Silently discarding header/footer clicks would make every other
        // share on the panel wrong.
        const pts = toPoints({ points: [POINT({ pageY: 100 }), POINT({ pageY: 5000 })] });
        const { rows, chrome, total } = attributeToBlocks(pts, blocks);
        expect(chrome).toBe(2);
        expect(total).toBe(4);
        expect(rows.at(-1)).toMatchObject({ id: '__chrome__', type: 'chrome', clicks: 2 });
    });

    it('normalises by views so a block low on the page is comparable', () => {
        const pts = toPoints({ points: [POINT({ pageY: 700, count: 14 })] });
        const { rows } = attributeToBlocks(pts, blocks, { views: 100 });
        expect(rows[0].per100).toBeCloseTo(14, 5);
    });

    it('leaves per100 null when the view count is unknown', () => {
        const { rows } = attributeToBlocks(toPoints({ points: [POINT()] }), blocks);
        expect(rows[0].per100).toBeNull();
    });

    it('attributes to the innermost of two overlapping blocks', () => {
        const nested = [
            { id: 'outer', type: 'content', top: 0, height: 1000 },
            { id: 'inner', type: 'cta', top: 400, height: 200 },
        ];
        const { rows } = attributeToBlocks(toPoints({ points: [POINT({ pageY: 500 })] }), nested);
        expect(rows[0].id).toBe('inner');
    });
});

describe('blockLabel', () => {
    it('uses friendly names and falls back readably', () => {
        expect(blockLabel('customer-support')).toBe('Support form');
        expect(blockLabel('media-text')).toBe('Media & text');
        expect(blockLabel('some_new_type')).toBe('Some new type');
    });
});

describe('toScrollReach', () => {
    it('accumulates from the bottom up — reaching 60% means you passed 20%', () => {
        const reach = toScrollReach({
            buckets: [
                { depth: 20, sessions: 5 },
                { depth: 60, sessions: 3 },
                { depth: 100, sessions: 2 },
            ],
            totalSessions: 10,
        });
        expect(reach.steps.map(s => s.sessions)).toEqual([10, 5, 2]);
        expect(reach.steps.map(s => Math.round(s.reach))).toEqual([100, 50, 20]);
    });

    it('is empty rather than fabricated when nothing was recorded', () => {
        expect(toScrollReach({ buckets: [], totalSessions: 0 }).steps).toEqual([]);
        expect(toScrollReach(undefined).steps).toEqual([]);
    });

    it('handles the single-bucket case a quiet site actually produces', () => {
        const reach = toScrollReach({ buckets: [{ depth: 20, sessions: 2 }], totalSessions: 2 });
        expect(reach.steps).toEqual([{ depth: 20, sessions: 2, reach: 100 }]);
    });
});

describe('reachAt', () => {
    const steps = toScrollReach({
        buckets: [{ depth: 0, sessions: 0 }, { depth: 50, sessions: 5 }, { depth: 100, sessions: 5 }],
        totalSessions: 10,
    }).steps;

    it('interpolates between measured depths', () => {
        expect(reachAt(steps, 75)).toBeCloseTo(75, 5);
    });

    it('is 100% above the first measured depth and never null for a known curve', () => {
        expect(reachAt(steps, 0)).toBe(100);
        expect(reachAt(steps, 100)).toBe(50);
    });

    it('returns null with no data instead of guessing', () => {
        expect(reachAt([], 50)).toBeNull();
    });
});
