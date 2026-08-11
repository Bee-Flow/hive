import { describe, it, expect } from 'vitest';
import { reconcileRouteEdges } from './routeEdges';
import { mergeStepPatchIntoDefinition } from './switchCaseOps';
import { readRoute, writeRoute } from './routeModel';

const IF_STEP = { id: 'r1', type: 'condition', expr: 'a > 1' };

function defWith(step, edges) {
    return {
        trigger: { id: 'trg', kind: 'manual' },
        steps: [step, { id: 'yes', type: 'notification' }, { id: 'no', type: 'notification' }],
        edges: [{ from: 'trg', to: step.id }, ...edges],
    };
}

describe('reconcileRouteEdges', () => {
    it('carries then/else onto the first rule and the otherwise port when an If becomes a Switch', () => {
        const def = defWith(IF_STEP, [
            { from: 'r1', to: 'yes', label: 'then' },
            { from: 'r1', to: 'no', label: 'else' },
        ]);
        const next = { ...IF_STEP, type: 'switch', cases: [{ name: 'big', expr: 'a > 1' }, { name: 'huge', expr: 'a > 9' }] };
        const out = reconcileRouteEdges({ ...def, steps: def.steps.map(s => (s.id === 'r1' ? next : s)) }, 'r1', IF_STEP, next);
        expect(out.edges).toEqual([
            { from: 'trg', to: 'r1' },
            { from: 'r1', to: 'yes', label: 'case:big', caseName: 'big' },
            { from: 'r1', to: 'no', label: 'case:default', caseName: 'default' },
        ]);
    });

    it('carries the first case and the default back onto then/else when a Switch becomes an If', () => {
        const prev = { id: 'r1', type: 'switch', cases: [{ name: 'big', expr: 'a > 1' }, { name: 'mid', expr: 'a > 0' }] };
        const def = defWith(prev, [
            { from: 'r1', to: 'yes', label: 'case:big', caseName: 'big' },
            { from: 'r1', to: 'no', label: 'case:default', caseName: 'default' },
        ]);
        const next = { id: 'r1', type: 'condition', expr: 'a > 1' };
        const out = reconcileRouteEdges(def, 'r1', prev, next);
        expect(out.edges).toEqual([
            { from: 'trg', to: 'r1' },
            { from: 'r1', to: 'yes', label: 'then' },
            { from: 'r1', to: 'no', label: 'else' },
        ]);
    });

    it('drops the edges of rules that no longer exist instead of leaving them dangling', () => {
        // A dangling `case:<name>` is a BLOCKING validation error, so it would
        // lock every later save of the whole routine.
        const prev = { id: 'r1', type: 'switch', cases: [{ name: 'a', expr: '1' }, { name: 'b', expr: '2' }, { name: 'c', expr: '3' }] };
        const def = defWith(prev, [
            { from: 'r1', to: 'yes', label: 'case:a', caseName: 'a' },
            { from: 'r1', to: 'no', label: 'case:c', caseName: 'c' },
        ]);
        const next = { ...prev, type: 'condition', expr: '1' };
        const out = reconcileRouteEdges(def, 'r1', prev, next);
        expect(out.edges).toEqual([
            { from: 'trg', to: 'r1' },
            { from: 'r1', to: 'yes', label: 'then' },
        ]);
    });

    it('flattens branch edges to one plain connection when the node becomes a Filter', () => {
        const def = defWith(IF_STEP, [
            { from: 'r1', to: 'yes', label: 'then' },
            { from: 'r1', to: 'no', label: 'else' },
        ]);
        const next = { id: 'r1', type: 'filter', arrayRef: 'steps.g.output.items', expr: 'item.x' };
        const out = reconcileRouteEdges(def, 'r1', IF_STEP, next);
        expect(out.edges).toEqual([
            { from: 'trg', to: 'r1' },
            { from: 'r1', to: 'yes' },
        ]);
    });

    it('collapses two ports that merge onto the same target into one edge row', () => {
        const def = defWith(IF_STEP, [
            { from: 'r1', to: 'yes', label: 'then' },
            { from: 'r1', to: 'yes', label: 'else' },
        ]);
        const next = { id: 'r1', type: 'filter', arrayRef: '', expr: '' };
        const out = reconcileRouteEdges(def, 'r1', IF_STEP, next);
        expect(out.edges).toEqual([{ from: 'trg', to: 'r1' }, { from: 'r1', to: 'yes' }]);
    });

    it('leaves incoming edges and other nodes\' edges alone', () => {
        const def = defWith(IF_STEP, [
            { from: 'r1', to: 'yes', label: 'then' },
            { from: 'yes', to: 'no' },
        ]);
        const next = { ...IF_STEP, type: 'switch', cases: [{ name: 'x', expr: '1' }, { name: 'y', expr: '2' }] };
        const out = reconcileRouteEdges(def, 'r1', IF_STEP, next);
        expect(out.edges).toContainEqual({ from: 'trg', to: 'r1' });
        expect(out.edges).toContainEqual({ from: 'yes', to: 'no' });
    });

    it('is a no-op (same object) when the shape did not change', () => {
        const def = defWith(IF_STEP, [{ from: 'r1', to: 'yes', label: 'then' }]);
        expect(reconcileRouteEdges(def, 'r1', IF_STEP, { ...IF_STEP, expr: 'a > 2' })).toBe(def);
    });

    it('drops an on_error edge when the node stops being able to carry one', () => {
        const prev = { id: 'r1', type: 'filter', arrayRef: 'x', expr: 'y' };
        const def = defWith(prev, [{ from: 'r1', to: 'no', label: 'on_error' }]);
        const kept = reconcileRouteEdges(def, 'r1', prev, { ...prev, arrayRef: 'z' });
        expect(kept).toBe(def); // filter → filter: nothing to do
        const flipped = reconcileRouteEdges(def, 'r1', prev, { id: 'r1', type: 'condition', expr: 'y' });
        expect(flipped.edges).toEqual([{ from: 'trg', to: 'r1' }]);
    });
});

describe('mergeStepPatchIntoDefinition — shape change is atomic with its edges', () => {
    it('adding a rule renames the ports and re-points the edges in ONE commit', () => {
        const def = defWith(IF_STEP, [
            { from: 'r1', to: 'yes', label: 'then' },
            { from: 'r1', to: 'no', label: 'else' },
        ]);
        const route = readRoute(IF_STEP);
        route.rules = [...route.rules, { name: 'rule2', expr: 'a > 9', value: '' }];
        const patch = writeRoute(route);

        const next = mergeStepPatchIntoDefinition(def, IF_STEP, patch);
        const step = next.steps.find(s => s.id === 'r1');
        expect(step.type).toBe('switch');
        expect(next.edges).toEqual([
            { from: 'trg', to: 'r1' },
            { from: 'r1', to: 'yes', label: 'case:rule1', caseName: 'rule1' },
            { from: 'r1', to: 'no', label: 'case:default', caseName: 'default' },
        ]);
        // Every case edge names a declared case — the invariant whose breach
        // used to 400 every subsequent save.
        const declared = new Set(step.cases.map(c => c.name).concat('default'));
        for (const e of next.edges.filter(e => e.from === 'r1')) {
            expect(declared.has(e.caseName)).toBe(true);
        }
    });
});

describe('edge colour survives a shape change', () => {
    it('an explicit color key rides the re-pointed edge', () => {
        // if → switch flip: the then edge becomes case:<first rule>.
        const prev = { id: 'r1', type: 'condition', expr: 'x == 1' };
        const next = {
            id: 'r1', type: 'switch', expr: 'x',
            cases: [{ name: 'one', value: 1 }, { name: 'two', value: 2 }],
        };
        const def = {
            trigger: { id: 'trg', kind: 'manual' },
            steps: [next],
            edges: [
                { from: 'trg', to: 'r1' },
                { from: 'r1', to: 'trg2', label: 'then', color: 'orange' },
            ],
        };
        const out = reconcileRouteEdges(def, 'r1', prev, next);
        const repointed = out.edges.find(e => e.from === 'r1');
        expect(repointed.label).toBe('case:one');
        expect(repointed.color).toBe('orange');
    });
});
