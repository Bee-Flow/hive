import { describe, it, expect } from 'vitest';
import { findNodeDropTarget, sameNodeDropTarget, distanceToSegment, nodeRect } from './nodeDropTarget';

// Cards are 240×96 and laid out left to right.
const at = (id, x, y = 0) => ({ id, position: { x, y }, measured: { width: 240, height: 96 } });

const definition = {
    trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
    steps: [
        { id: 'g1', type: 'integration_action' },
        { id: 'flt', type: 'filter' },
        { id: 'dedupe', type: 'dedupe' },   // the loose one being dragged
        { id: 'stop', type: 'stop_error' },
    ],
    edges: [
        { from: 'trg', to: 'g1' },
        { from: 'g1', to: 'flt' },
    ],
};

const renderedEdges = [
    { id: 'e0', source: 'trg', target: 'g1', data: {} },
    { id: 'e1', source: 'g1', target: 'flt', data: { defLabel: null, defCaseName: null } },
];

// trg at 0, g1 at 400, flt at 800 — so the g1→flt run is x 640…800 at y≈48.
const layout = (draggedX, draggedY = 0) => [
    at('trg', 0), at('g1', 400), at('flt', 800), at('dedupe', draggedX, draggedY), at('stop', 400, 600),
];

const resolve = (draggedX, draggedY = 0, overrides = {}) => findNodeDropTarget({
    draggedId: 'dedupe',
    nodes: layout(draggedX, draggedY),
    renderedEdges,
    definition,
    ...overrides,
});

describe('findNodeDropTarget — connections', () => {
    it('offers to splice into the connection the card is hovering over', () => {
        // Centre at x≈720, right on the g1→flt run.
        expect(resolve(600)).toEqual({
            kind: 'edge', edgeId: 'e1', sourceId: 'g1', targetId: 'flt', label: null, caseName: null,
        });
    });

    it('carries the connection\'s branch identity so the splice keeps its routing', () => {
        const branchEdges = [{ id: 'eb', source: 'g1', target: 'flt', data: { defLabel: 'case:vip', defCaseName: 'vip' } }];
        const t = resolve(600, 0, { renderedEdges: branchEdges });
        expect(t).toMatchObject({ kind: 'edge', label: 'case:vip', caseName: 'vip' });
    });

    it('lets go of the connection once the card drifts away', () => {
        expect(resolve(600, 400)?.kind).not.toBe('edge');
    });
});

describe('findNodeDropTarget — nodes', () => {
    it('chains onto the node it is sitting to the right of', () => {
        // Far from any connection (below the row), just right of `flt` at 800.
        const nodes = [at('trg', 0), at('g1', 400), at('flt', 800, 400), at('dedupe', 1100, 400)];
        expect(findNodeDropTarget({ draggedId: 'dedupe', nodes, renderedEdges, definition }))
            .toEqual({ kind: 'node', nodeId: 'flt', from: 'flt', to: 'dedupe' });
    });

    it('feeds INTO the node it is sitting to the left of', () => {
        const nodes = [at('trg', 0), at('g1', 400), at('flt', 800, 400), at('dedupe', 460, 400)];
        expect(findNodeDropTarget({ draggedId: 'dedupe', nodes, renderedEdges, definition }))
            .toEqual({ kind: 'node', nodeId: 'flt', from: 'dedupe', to: 'flt' });
    });

    it('ignores a node on another row, or one too far away', () => {
        const far = [at('flt', 800, 400), at('dedupe', 1400, 400)];
        expect(findNodeDropTarget({ draggedId: 'dedupe', nodes: far, renderedEdges: [], definition })).toBe(null);
        const offRow = [at('flt', 800, 400), at('dedupe', 1100, 900)];
        expect(findNodeDropTarget({ draggedId: 'dedupe', nodes: offRow, renderedEdges: [], definition })).toBe(null);
    });

    it('never chains after a Stop-and-Error, and never into a trigger', () => {
        const afterStop = [at('stop', 400, 600), at('dedupe', 700, 600)];
        expect(findNodeDropTarget({ draggedId: 'dedupe', nodes: afterStop, renderedEdges: [], definition })).toBe(null);
        const intoTrigger = [at('trg', 400, 600), at('dedupe', 100, 600)];
        expect(findNodeDropTarget({ draggedId: 'dedupe', nodes: intoTrigger, renderedEdges: [], definition })).toBe(null);
    });

    it('refuses a connection that already exists or would close a loop', () => {
        const withEdge = { ...definition, edges: [...definition.edges, { from: 'flt', to: 'dedupe' }] };
        // `dedupe` is no longer loose, so nothing is offered at all.
        expect(findNodeDropTarget({
            draggedId: 'dedupe', nodes: [at('flt', 800, 400), at('dedupe', 1100, 400)], renderedEdges: [], definition: withEdge,
        })).toBe(null);

        const loop = { ...definition, edges: [{ from: 'dedupe', to: 'g1' }] };
        expect(findNodeDropTarget({
            draggedId: 'g1', nodes: [at('dedupe', 400, 400), at('g1', 700, 400)], renderedEdges: [], definition: loop,
        })).toBe(null);
    });
});

describe('findNodeDropTarget — guards', () => {
    it('says nothing for a node that already has connections (that is a move)', () => {
        expect(findNodeDropTarget({
            draggedId: 'g1', nodes: layout(600), renderedEdges, definition,
        })).toBe(null);
    });

    it('says nothing without a definition or an unknown node', () => {
        expect(findNodeDropTarget({ draggedId: 'dedupe', nodes: layout(600), renderedEdges, definition: null })).toBe(null);
        expect(findNodeDropTarget({ draggedId: 'ghost', nodes: layout(600), renderedEdges, definition })).toBe(null);
    });

    it('a dragged TRIGGER is only ever a source — it never splices into a run', () => {
        const def = { ...definition, triggers: [{ id: 'hook', type: 'trigger', kind: 'webhook' }], edges: [{ from: 'g1', to: 'flt' }] };
        const nodes = [at('g1', 400), at('flt', 800), at('hook', 600)];
        expect(findNodeDropTarget({ draggedId: 'hook', nodes, renderedEdges, definition: def })?.kind).not.toBe('edge');
    });
});

describe('geometry helpers', () => {
    it('measures the distance to a segment, clamped to its ends', () => {
        expect(distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
        expect(distanceToSegment({ x: -4, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(4);
        expect(distanceToSegment({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(Math.SQRT2);
    });

    it('falls back to the canvas card size before a node has been measured', () => {
        expect(nodeRect({ position: { x: 10, y: 20 } })).toMatchObject({ w: 240, h: 96, cx: 130, cy: 68 });
    });
});

describe('sameNodeDropTarget', () => {
    it('compares what the highlight actually shows', () => {
        expect(sameNodeDropTarget({ kind: 'edge', edgeId: 'e1' }, { kind: 'edge', edgeId: 'e1' })).toBe(true);
        expect(sameNodeDropTarget({ kind: 'edge', edgeId: 'e1' }, { kind: 'edge', edgeId: 'e2' })).toBe(false);
        expect(sameNodeDropTarget({ kind: 'node', nodeId: 'a', from: 'a' }, { kind: 'node', nodeId: 'a', from: 'a' })).toBe(true);
        expect(sameNodeDropTarget({ kind: 'node', nodeId: 'a', from: 'a' }, { kind: 'node', nodeId: 'a', from: 'x' })).toBe(false);
        expect(sameNodeDropTarget(null, null)).toBe(true);
        expect(sameNodeDropTarget(null, { kind: 'node' })).toBe(false);
    });
});
