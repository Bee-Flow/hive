import { describe, expect, it } from 'vitest';
import { hopPath, HOP_RADIUS, parsePath, pathSegments } from './edgeHops';

/**
 * Where two connections cross, one bridges over the other. The rules are
 * asymmetric on purpose — only horizontals hop, and always upward — because a
 * symmetric rule draws two bridges into each other, and a rule that reads the
 * local geometry flips direction whenever a node moves.
 */

const H = (x1, x2, y) => ({ x1, y1: y, x2, y2: y, horizontal: true });
const V = (x, y1, y2) => ({ x1: x, y1, x2: x, y2, horizontal: false });

describe('pathSegments', () => {
    it('keeps the straight pieces and drops the curved corners', () => {
        // What getSmoothStepPath emits: straight runs joined by quadratic bends.
        const d = 'M0,0 L40,0 Q50,0 50,10 L50,90 Q50,100 60,100 L100,100';
        expect(pathSegments(d)).toEqual([
            { x1: 0, y1: 0, x2: 40, y2: 0, horizontal: true },
            { x1: 50, y1: 10, x2: 50, y2: 90, horizontal: false },
            { x1: 60, y1: 100, x2: 100, y2: 100, horizontal: true },
        ]);
    });

    it('ignores a diagonal — a crossing there is not a clean bridge', () => {
        expect(pathSegments('M0,0 L100,60')).toEqual([]);
    });

    it('survives a path it does not understand instead of inventing segments', () => {
        expect(pathSegments('')).toEqual([]);
        expect(pathSegments('C0,0 1,1 2,2')).toEqual([]);
        expect(parsePath(null)).toEqual([]);
    });
});

describe('hopPath', () => {
    const straight = 'M0,50 L200,50';

    it('bridges over a line that crosses it', () => {
        const d = hopPath(straight, [V(100, 0, 100)]);
        expect(d).toContain(`A${HOP_RADIUS},${HOP_RADIUS} 0 0 0 106,50`);
        expect(d).toBe('M0,50L94,50A6,6 0 0 0 106,50L200,50');
    });

    it('arcs UP whichever way the line runs', () => {
        // SVG's y axis points down, so "up" is sweep 0 going right and 1 going
        // left. Getting this wrong dips the bridge under the line it crosses.
        expect(hopPath('M0,50 L200,50', [V(100, 0, 100)])).toContain('0 0 0 106,50');
        expect(hopPath('M200,50 L0,50', [V(100, 0, 100)])).toContain('0 0 1 94,50');
    });

    it('bridges every crossing, in the order the line travels', () => {
        const d = hopPath(straight, [V(60, 0, 100), V(140, 0, 100)]);
        expect(d.indexOf('54,50')).toBeLessThan(d.indexOf('134,50'));
        expect(d.match(/A/g)).toHaveLength(2);
    });

    it('leaves the path untouched when nothing crosses it', () => {
        // Same string back, so an unchanged path stays referentially identical
        // and React Flow re-renders nothing.
        expect(hopPath(straight, [V(100, 200, 300)])).toBe(straight);
        expect(hopPath(straight, [H(0, 200, 80)])).toBe(straight);
        expect(hopPath(straight, [])).toBe(straight);
    });

    it('does not hop where the crossing sits on a corner', () => {
        // The corner is a curve; a bridge there reads as a kink, not a hop.
        const corner = 'M0,50 L100,50 Q110,50 110,60 L110,150';
        expect(hopPath(corner, [V(98, 0, 100)])).toBe(corner);
    });

    it('does not hop where the OTHER line merely ends at ours', () => {
        // A vertical that stops on our line is a junction, not a crossing —
        // bridging over a connection point would be a lie about the topology.
        expect(hopPath(straight, [V(100, 0, 50)])).toBe(straight);
        expect(hopPath(straight, [V(100, 50, 120)])).toBe(straight);
    });

    it('merges crossings too close together into one bridge', () => {
        const d = hopPath(straight, [V(100, 0, 100), V(104, 0, 100)]);
        expect(d.match(/A/g)).toHaveLength(1);
    });

    it('refuses a bridge that would overshoot its own segment', () => {
        const short = 'M96,50 L108,50';
        expect(hopPath(short, [V(102, 0, 100)])).toBe(short);
    });

    it('preserves the corners and the destination exactly', () => {
        const d = 'M0,50 L100,50 Q110,50 110,60 L110,150';
        const out = hopPath(d, [V(50, 0, 100)]);
        expect(out).toContain('Q110,50 110,60');
        expect(out.endsWith('L110,150')).toBe(true);
    });
});
