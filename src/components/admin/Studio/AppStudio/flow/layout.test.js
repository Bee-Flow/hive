import { describe, it, expect } from 'vitest';
import { INDENT, ROW_H, containerBounds, layoutGraph } from './layout';
import { stepsToGraph, withStepIds } from './stepGraph';

const seq = (steps) => withStepIds({ kind: 'sequence', steps });

describe('layoutGraph', () => {
    it('stacks a flat sequence straight down, one column', () => {
        const { nodes } = stepsToGraph(seq([{ kind: 'toast' }, { kind: 'toast' }, { kind: 'toast' }]));
        const pos = layoutGraph(nodes);
        const ys = nodes.map((n) => pos.get(n.id).y);
        expect(new Set(nodes.map((n) => pos.get(n.id).x)).size).toBe(1);
        expect(ys).toEqual([0, ROW_H, ROW_H * 2]);
    });

    it('indents a branch, so reading downward still tells the story', () => {
        const { nodes } = stepsToGraph(seq([
            { kind: 'condition', expr: 'x', then: [{ kind: 'toast' }], else: [] },
            { kind: 'toast' },
        ]));
        const pos = layoutGraph(nodes);
        const cond = nodes.find((n) => n.kind === 'condition');
        const inThen = nodes.find((n) => n.scopeKey === 'then' && !n.isEntry);

        expect(pos.get(inThen.id).x).toBe(pos.get(cond.id).x + INDENT);
        // And the step AFTER the condition is back in the outer column.
        const after = nodes.filter((n) => n.prefix === '')[1];
        expect(pos.get(after.id).x).toBe(pos.get(cond.id).x);
        expect(pos.get(after.id).y).toBeGreaterThan(pos.get(inThen.id).y);
    });

    it('nests a branch inside a branch one step further', () => {
        const { nodes } = stepsToGraph(seq([{
            kind: 'condition',
            expr: 'x',
            then: [{ kind: 'condition', expr: 'y', then: [{ kind: 'toast' }], else: [] }],
            else: [],
        }]));
        const pos = layoutGraph(nodes);
        const depths = nodes.filter((n) => !n.isEntry).map((n) => pos.get(n.id).x);
        expect(depths).toEqual([0, INDENT, INDENT * 2]);
    });

    it('gives every node a position, entry pills included', () => {
        const { nodes } = stepsToGraph(seq([
            { kind: 'switch', expr: 'x', cases: [{ name: 'a', steps: [{ kind: 'toast' }] }], default: [{ kind: 'toast' }] },
        ]));
        const pos = layoutGraph(nodes);
        for (const n of nodes) expect(pos.get(n.id), n.id).toBeTruthy();
    });

    it('never puts two nodes in the same spot', () => {
        const { nodes } = stepsToGraph(seq([
            { kind: 'toast' },
            { kind: 'loop', source: { kind: 'static', value: [] }, steps: [{ kind: 'toast' }, { kind: 'toast' }] },
            { kind: 'condition', expr: 'x', then: [{ kind: 'toast' }], else: [{ kind: 'toast' }] },
        ]));
        const pos = layoutGraph(nodes);
        const seen = new Set(nodes.map((n) => `${pos.get(n.id).x},${pos.get(n.id).y}`));
        expect(seen.size).toBe(nodes.length);
    });

    it('handles an empty action', () => {
        expect(layoutGraph([]).size).toBe(0);
    });
});

describe('containerBounds', () => {
    it('frames a container around everything inside it', () => {
        const { nodes } = stepsToGraph(seq([{ kind: 'condition', expr: 'x', then: [{ kind: 'toast' }], else: [{ kind: 'toast' }] }]));
        const pos = layoutGraph(nodes);
        const cond = nodes.find((n) => n.kind === 'condition');
        const box = containerBounds(cond, nodes, pos);

        expect(box).toBeTruthy();
        const inside = nodes.filter((n) => n.id.startsWith(`${cond.id}/`));
        for (const n of inside) {
            const p = pos.get(n.id);
            expect(p.y).toBeGreaterThanOrEqual(box.y);
            expect(p.y).toBeLessThanOrEqual(box.y + box.height);
        }
    });

    it('is null for a step that holds nothing', () => {
        const { nodes } = stepsToGraph(seq([{ kind: 'toast' }]));
        const pos = layoutGraph(nodes);
        expect(containerBounds(nodes[0], nodes, pos)).toBeNull();
    });
});
