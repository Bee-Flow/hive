import { describe, it, expect } from 'vitest';
import {
    bridgeEdges, applyDeleteNodes, applyDuplicateNode, applyDetachNode,
    canDeleteNode, canDuplicateNode, canDetachNode,
} from './nodeOps';

/**
 * BFSF-319 — canvas node delete/duplicate.
 *
 * Delete already worked via the Delete key, but only PRUNED edges: removing a
 * mid-graph node severed the flow and stranded everything downstream. Duplicate
 * did not exist.
 */
const step = (id, extra = {}) => ({ id, type: 'notification', label: id, title: id, body: 'x', channels: ['notification'], position: { x: 0, y: 0 }, ...extra });

function chainDef() {
    // trg → a → b → c
    return {
        trigger: { id: 'trg', type: 'trigger', kind: 'manual', position: { x: 0, y: 0 } },
        steps: [step('a'), step('b'), step('c')],
        edges: [
            { from: 'trg', to: 'a' },
            { from: 'a', to: 'b' },
            { from: 'b', to: 'c' },
        ],
    };
}

describe('bridgeEdges', () => {
    it('reconnects predecessor to successor across the removed node', () => {
        const out = bridgeEdges(chainDef().edges, 'b');
        expect(out).toContainEqual({ from: 'a', to: 'c' });
        expect(out.some(e => e.from === 'b' || e.to === 'b')).toBe(false);
    });

    it('preserves the branch label from the incoming edge', () => {
        // cond -then-> mid -> tail  ⇒  cond -then-> tail
        const edges = [
            { from: 'cond', to: 'mid', label: 'then' },
            { from: 'mid', to: 'tail' },
        ];
        expect(bridgeEdges(edges, 'mid')).toContainEqual({ from: 'cond', to: 'tail', label: 'then' });
    });

    it('preserves a switch caseName', () => {
        const edges = [
            { from: 'sw', to: 'mid', label: 'case:vip', caseName: 'vip' },
            { from: 'mid', to: 'tail' },
        ];
        expect(bridgeEdges(edges, 'mid')).toContainEqual({ from: 'sw', to: 'tail', label: 'case:vip', caseName: 'vip' });
    });

    it('fans out across every predecessor/successor pair', () => {
        const edges = [
            { from: 'p1', to: 'm' }, { from: 'p2', to: 'm' },
            { from: 'm', to: 's1' }, { from: 'm', to: 's2' },
        ];
        const out = bridgeEdges(edges, 'm');
        expect(out).toHaveLength(4);
        for (const from of ['p1', 'p2']) for (const to of ['s1', 's2']) {
            expect(out).toContainEqual({ from, to });
        }
    });

    it('drops the node cleanly when it is a leaf or a root', () => {
        expect(bridgeEdges(chainDef().edges, 'c')).toEqual([{ from: 'trg', to: 'a' }, { from: 'a', to: 'b' }]);
    });

    it('never creates a self-loop', () => {
        const edges = [{ from: 'a', to: 'm' }, { from: 'm', to: 'a' }];
        expect(bridgeEdges(edges, 'm')).toEqual([]);
    });

    it('does not duplicate an edge that already exists', () => {
        const edges = [{ from: 'a', to: 'm' }, { from: 'm', to: 'c' }, { from: 'a', to: 'c' }];
        const out = bridgeEdges(edges, 'm');
        expect(out.filter(e => e.from === 'a' && e.to === 'c')).toHaveLength(1);
    });

    it('tolerates a missing edge list', () => {
        expect(bridgeEdges(undefined, 'x')).toEqual([]);
    });
});

describe('applyDeleteNodes', () => {
    it('removes the step and heals the graph', () => {
        const next = applyDeleteNodes(chainDef(), 'b');
        expect(next.steps.map(s => s.id)).toEqual(['a', 'c']);
        expect(next.edges).toContainEqual({ from: 'a', to: 'c' });
    });

    it('refuses to remove the primary trigger', () => {
        const def = chainDef();
        expect(applyDeleteNodes(def, 'trg')).toBe(def);
        expect(applyDeleteNodes(def, ['trg']).trigger).toBeTruthy();
    });

    it('still removes other nodes in a batch that includes the primary trigger', () => {
        const next = applyDeleteNodes(chainDef(), ['trg', 'b']);
        expect(next.trigger.id).toBe('trg');
        expect(next.steps.map(s => s.id)).toEqual(['a', 'c']);
    });

    it('removes secondary triggers like any other node', () => {
        const def = { ...chainDef(), triggers: [{ id: 't2', type: 'trigger', kind: 'webhook' }] };
        expect(applyDeleteNodes(def, 't2').triggers).toEqual([]);
    });

    it('deletes several nodes at once and bridges across the whole run', () => {
        const next = applyDeleteNodes(chainDef(), ['a', 'b']);
        expect(next.steps.map(s => s.id)).toEqual(['c']);
        expect(next.edges).toContainEqual({ from: 'trg', to: 'c' });
    });

    it('does not mutate the input definition', () => {
        const def = chainDef();
        applyDeleteNodes(def, 'b');
        expect(def.steps).toHaveLength(3);
        expect(def.edges).toHaveLength(3);
    });
});

describe('applyDetachNode', () => {
    it('keeps the step but takes it out of the chain, healing the gap', () => {
        const next = applyDetachNode(chainDef(), 'b');
        expect(next.steps.map(s => s.id)).toEqual(['a', 'b', 'c']);   // still there
        expect(next.edges).toContainEqual({ from: 'a', to: 'c' });     // gap healed
        expect(next.edges.some(e => e.from === 'b' || e.to === 'b')).toBe(false);
    });

    it('parks the card below its old spot so it reads as off the flow', () => {
        const def = chainDef();
        def.steps[1].position = { x: 400, y: 100 };
        const moved = applyDetachNode(def, 'b').steps.find(s => s.id === 'b');
        expect(moved.position).toEqual({ x: 400, y: 260 });
    });

    it('leaves a branch label on the bridged edge, like delete does', () => {
        const def = {
            trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
            steps: [step('cond', { type: 'condition' }), step('mid'), step('tail')],
            edges: [{ from: 'cond', to: 'mid', label: 'then' }, { from: 'mid', to: 'tail' }],
        };
        expect(applyDetachNode(def, 'mid').edges).toContainEqual({ from: 'cond', to: 'tail', label: 'then' });
    });

    it('does nothing for a trigger, an unknown id, or a step that is already loose', () => {
        const def = chainDef();
        expect(applyDetachNode(def, 'trg')).toBe(def);
        expect(applyDetachNode(def, 'ghost')).toBe(def);
        const loose = { ...def, steps: [...def.steps, step('free')] };
        expect(applyDetachNode(loose, 'free')).toBe(loose);
    });

    it('does not mutate its input', () => {
        const def = chainDef();
        const before = JSON.stringify(def);
        applyDetachNode(def, 'b');
        expect(JSON.stringify(def)).toBe(before);
    });
});

describe('applyDuplicateNode', () => {
    it('adds a copy with a fresh, non-colliding id', () => {
        const def = chainDef();
        const { definition: next, newStepId } = applyDuplicateNode(def, 'b');
        expect(newStepId).toBeTruthy();
        expect(newStepId).not.toBe('b');
        const ids = next.steps.map(s => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain(newStepId);
    });

    it('keeps the original configuration', () => {
        const def = { ...chainDef(), steps: [step('a', { title: 'Important', channels: ['email'] })] };
        const { definition: next, newStepId } = applyDuplicateNode(def, 'a');
        const copy = next.steps.find(s => s.id === newStepId);
        expect(copy.title).toBe('Important');
        expect(copy.channels).toEqual(['email']);
    });

    it('labels the copy and offsets its position', () => {
        const def = { ...chainDef(), steps: [step('a', { label: 'Notify team', position: { x: 100, y: 50 } })] };
        const { definition: next, newStepId } = applyDuplicateNode(def, 'a');
        const copy = next.steps.find(s => s.id === newStepId);
        expect(copy.label).toBe('Notify team (copy)');
        expect(copy.position).not.toEqual({ x: 100, y: 50 });
    });

    it('deep-clones so edits to the copy do not touch the original', () => {
        const def = { ...chainDef(), steps: [step('a', { inputs: { to: { kind: 'literal', value: 'x' } } })] };
        const { definition: next, newStepId } = applyDuplicateNode(def, 'a');
        next.steps.find(s => s.id === newStepId).inputs.to.value = 'CHANGED';
        expect(def.steps[0].inputs.to.value).toBe('x');
    });

    it('wires the copy from the same predecessors, preserving branch labels', () => {
        const def = {
            trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
            steps: [step('cond', { type: 'condition', expr: 'true' }), step('b')],
            edges: [{ from: 'trg', to: 'cond' }, { from: 'cond', to: 'b', label: 'then' }],
        };
        const { definition: next, newStepId } = applyDuplicateNode(def, 'b');
        expect(next.edges).toContainEqual({ from: 'cond', to: newStepId, label: 'then' });
    });

    it('does not copy outgoing edges (that would double every downstream path)', () => {
        const { definition: next, newStepId } = applyDuplicateNode(chainDef(), 'b');
        expect(next.edges.some(e => e.from === newStepId)).toBe(false);
    });

    it('drops a pinned output so the copy actually executes', () => {
        const def = { ...chainDef(), steps: [step('a', { pinnedOutput: { ok: 1 }, pinnedAt: '2026-01-01' })] };
        const { definition: next, newStepId } = applyDuplicateNode(def, 'a');
        const copy = next.steps.find(s => s.id === newStepId);
        expect(copy.pinnedOutput).toBeUndefined();
        expect(copy.pinnedAt).toBeUndefined();
    });

    it('refuses to duplicate a trigger', () => {
        const def = chainDef();
        expect(applyDuplicateNode(def, 'trg')).toEqual({ definition: def, newStepId: null });
    });

    it('is a no-op for an unknown id', () => {
        const def = chainDef();
        expect(applyDuplicateNode(def, 'ghost')).toEqual({ definition: def, newStepId: null });
    });

    it('does not mutate the input definition', () => {
        const def = chainDef();
        applyDuplicateNode(def, 'b');
        expect(def.steps).toHaveLength(3);
    });
});

describe('capability predicates', () => {
    it('canDeleteNode is false only for the primary trigger', () => {
        const def = chainDef();
        expect(canDeleteNode(def, 'trg')).toBe(false);
        expect(canDeleteNode(def, 'b')).toBe(true);
    });

    it('canDetachNode wants a step that is actually wired to something', () => {
        const def = chainDef();
        expect(canDetachNode(def, 'b')).toBe(true);
        expect(canDetachNode(def, 'trg')).toBe(false);   // not in steps[]
        expect(canDetachNode(def, 'ghost')).toBe(false);
        const loose = { ...def, steps: [...def.steps, step('free')] };
        expect(canDetachNode(loose, 'free')).toBe(false); // already off the flow
    });

    it('canDuplicateNode is true for steps only', () => {
        const def = chainDef();
        expect(canDuplicateNode(def, 'trg')).toBe(false);
        expect(canDuplicateNode(def, 'b')).toBe(true);
        expect(canDuplicateNode(def, 'ghost')).toBe(false);
    });
});

describe('edge colour survives delete-bridge and duplicate', () => {
    it('bridgeEdges carries the incoming edge\'s colour onto the bridged edge', () => {
        const edges = [
            { from: 'a', to: 'mid', label: 'then', color: 'red' },
            { from: 'mid', to: 'b' },
        ];
        const next = bridgeEdges(edges, 'mid');
        expect(next).toEqual([{ from: 'a', to: 'b', label: 'then', color: 'red' }]);
    });

    it('applyDuplicateNode keeps the colour on inherited incoming edges', () => {
        const def = {
            trigger: { id: 'trg', kind: 'manual', position: { x: 0, y: 0 } },
            steps: [{ id: 's1', type: 'notification', title: 'x', position: { x: 100, y: 0 } }],
            edges: [{ from: 'trg', to: 's1', color: 'cyan' }],
        };
        const { definition: next, newStepId } = applyDuplicateNode(def, 's1');
        const inherited = next.edges.find(e => e.to === newStepId);
        expect(inherited.color).toBe('cyan');
    });
});
