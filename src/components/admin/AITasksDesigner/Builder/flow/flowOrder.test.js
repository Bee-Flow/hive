import { describe, it, expect } from 'vitest';
import { flowOrder, flowPosition } from './flowOrder';

const trigger = { id: 'trg', type: 'trigger', kind: 'manual' };
const step = (id, over = {}) => ({ id, type: 'ai_step', ...over });

describe('flowOrder', () => {
    it('follows the edges, not the order steps were dropped on the canvas', () => {
        const def = {
            trigger,
            // authoring order is deliberately the reverse of execution order
            steps: [step('c'), step('b'), step('a')],
            edges: [{ from: 'trg', to: 'a' }, { from: 'a', to: 'b' }, { from: 'b', to: 'c' }],
        };
        expect(flowOrder(def)).toEqual(['trg', 'a', 'b', 'c']);
    });

    it('orders a branch by the edges that created it', () => {
        const def = {
            trigger,
            steps: [step('yes'), step('no'), step('route', { type: 'switch' })],
            edges: [
                { from: 'trg', to: 'route' },
                { from: 'route', to: 'yes' },
                { from: 'route', to: 'no' },
            ],
        };
        expect(flowOrder(def)).toEqual(['trg', 'route', 'yes', 'no']);
    });

    it('includes secondary triggers as entry points', () => {
        const def = {
            trigger,
            triggers: [{ id: 'hook', type: 'trigger', kind: 'webhook' }],
            steps: [step('a')],
            edges: [{ from: 'hook', to: 'a' }],
        };
        expect(flowOrder(def)).toEqual(['trg', 'hook', 'a']);
    });

    it('still lists a node nothing points at', () => {
        // A loose card the user parked off to the side is still pageable.
        const def = { trigger, steps: [step('a'), step('loose')], edges: [{ from: 'trg', to: 'a' }] };
        expect(flowOrder(def)).toEqual(['trg', 'a', 'loose']);
    });

    it('terminates on a cycle and still returns every node exactly once', () => {
        const def = {
            trigger,
            steps: [step('a'), step('b')],
            edges: [{ from: 'trg', to: 'a' }, { from: 'a', to: 'b' }, { from: 'b', to: 'a' }],
        };
        const order = flowOrder(def);
        expect(order.sort()).toEqual(['a', 'b', 'trg']);
    });

    it('ignores edges that point at nothing', () => {
        const def = { trigger, steps: [step('a')], edges: [{ from: 'trg', to: 'a' }, { from: 'a', to: 'ghost' }] };
        expect(flowOrder(def)).toEqual(['trg', 'a']);
    });

    it('does not descend into loop bodies — those are edited in their parent', () => {
        const def = {
            trigger,
            steps: [step('lp', { type: 'loop', body: [step('inner')] })],
            edges: [{ from: 'trg', to: 'lp' }],
        };
        expect(flowOrder(def)).toEqual(['trg', 'lp']);
    });

    it('tolerates an empty or malformed definition', () => {
        expect(flowOrder(null)).toEqual([]);
        expect(flowOrder({})).toEqual([]);
        expect(flowOrder({ trigger, steps: null, edges: null })).toEqual(['trg']);
    });
});

describe('flowPosition', () => {
    const def = {
        trigger,
        steps: [step('a'), step('b')],
        edges: [{ from: 'trg', to: 'a' }, { from: 'a', to: 'b' }],
    };

    it('reports a 1-based position with both neighbours', () => {
        expect(flowPosition(def, 'a')).toEqual({ index: 2, total: 3, prevId: 'trg', nextId: 'b' });
    });

    it('has no previous at the trigger and no next at the end', () => {
        expect(flowPosition(def, 'trg')).toMatchObject({ index: 1, prevId: null, nextId: 'a' });
        expect(flowPosition(def, 'b')).toMatchObject({ index: 3, nextId: null });
    });

    it('reports index 0 for a step that is not in this graph', () => {
        expect(flowPosition(def, 'nope')).toEqual({ index: 0, total: 3, prevId: null, nextId: null });
    });
});
