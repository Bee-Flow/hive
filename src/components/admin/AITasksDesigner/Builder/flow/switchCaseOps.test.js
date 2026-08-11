import { describe, it, expect } from 'vitest';
import { reconcileSwitchEdges, uniqueCaseName, mergeStepPatchIntoDefinition } from './switchCaseOps';

/**
 * Node-audit C1 — renaming/deleting a switch case orphaned its `case:<name>`
 * edges, and `switch.case_edge_unknown` is a blocking validation error, so
 * every subsequent save of the whole routine 400'd. The reconcile keeps the
 * case list and the edge labels in one atomic definition update.
 */
const def = () => ({
    trigger: { id: 'trg', type: 'trigger', kind: 'manual' },
    steps: [
        { id: 'sw', type: 'switch', expr: 'trigger.output.kind', cases: [{ name: 'vip', value: 'v' }, { name: 'normal', value: 'n' }], defaultBranch: null },
        { id: 'send', type: 'notification', title: 't' },
        { id: 'other', type: 'notification', title: 'o' },
    ],
    edges: [
        { from: 'trg', to: 'sw' },
        { from: 'sw', to: 'send', label: 'case:vip', caseName: 'vip' },
        { from: 'sw', to: 'other', label: 'case:normal', caseName: 'normal' },
        { from: 'sw', to: 'other', label: 'case:default', caseName: 'default' },
    ],
});

const cases = (...names) => names.map(n => ({ name: n, value: n }));

describe('reconcileSwitchEdges — rename', () => {
    it('re-points the renamed case edge (label AND caseName)', () => {
        const next = reconcileSwitchEdges(def(), 'sw', cases('vip', 'normal'), cases('urgent', 'normal'));
        expect(next.edges).toContainEqual({ from: 'sw', to: 'send', label: 'case:urgent', caseName: 'urgent' });
        expect(next.edges.some(e => e.caseName === 'vip')).toBe(false);
        // Sibling and default edges untouched.
        expect(next.edges).toContainEqual({ from: 'sw', to: 'other', label: 'case:normal', caseName: 'normal' });
        expect(next.edges).toContainEqual({ from: 'sw', to: 'other', label: 'case:default', caseName: 'default' });
    });

    it('heals legacy label-only and caseName-only edge shapes on rename', () => {
        const d = def();
        d.edges[1] = { from: 'sw', to: 'send', label: 'case:vip' };            // label-only
        d.edges[2] = { from: 'sw', to: 'other', caseName: 'normal' };          // caseName-only
        const next = reconcileSwitchEdges(d, 'sw', cases('vip', 'normal'), cases('urgent', 'later'));
        expect(next.edges).toContainEqual({ from: 'sw', to: 'send', label: 'case:urgent', caseName: 'urgent' });
        expect(next.edges).toContainEqual({ from: 'sw', to: 'other', label: 'case:later', caseName: 'later' });
    });

    it('handles an A↔B swap in one pass without chaining', () => {
        const next = reconcileSwitchEdges(def(), 'sw', cases('vip', 'normal'), cases('normal', 'vip'));
        // vip-edge (→send) must now be normal; normal-edge (→other) must now be vip.
        expect(next.edges).toContainEqual({ from: 'sw', to: 'send', label: 'case:normal', caseName: 'normal' });
        expect(next.edges).toContainEqual({ from: 'sw', to: 'other', label: 'case:vip', caseName: 'vip' });
    });

    it('dedupes when a rename lands on an identically-wired name', () => {
        const d = def();
        // Both cases already wired to the SAME target; renaming vip→normal
        // would create two identical case:normal edges to `other`… but vip
        // points at send here, so craft the collision explicitly:
        d.edges[1] = { from: 'sw', to: 'other', label: 'case:vip', caseName: 'vip' };
        const next = reconcileSwitchEdges(d, 'sw', cases('vip', 'normal'), cases('normal_2', 'normal')
            .map((c, i) => (i === 0 ? { ...c, name: 'normal' } : c)));
        const normalEdges = next.edges.filter(e => e.from === 'sw' && e.caseName === 'normal');
        expect(normalEdges).toHaveLength(1);
    });

    it('follows defaultBranch through a rename', () => {
        const d = def();
        d.steps[0].defaultBranch = 'vip';
        const next = reconcileSwitchEdges(d, 'sw', cases('vip', 'normal'), cases('urgent', 'normal'));
        expect(next.steps[0].defaultBranch).toBe('urgent');
    });

    it('renaming only affects edges from THIS switch', () => {
        const d = def();
        d.steps.push({ id: 'sw2', type: 'switch', expr: 'x', cases: cases('vip') });
        d.edges.push({ from: 'sw2', to: 'send', label: 'case:vip', caseName: 'vip' });
        const next = reconcileSwitchEdges(d, 'sw', cases('vip', 'normal'), cases('urgent', 'normal'));
        expect(next.edges).toContainEqual({ from: 'sw2', to: 'send', label: 'case:vip', caseName: 'vip' });
    });
});

describe('reconcileSwitchEdges — delete', () => {
    it('drops the removed case\'s edges; default and siblings survive', () => {
        const next = reconcileSwitchEdges(def(), 'sw', cases('vip', 'normal'), cases('normal'));
        expect(next.edges.some(e => e.caseName === 'vip')).toBe(false);
        expect(next.edges).toContainEqual({ from: 'sw', to: 'other', label: 'case:normal', caseName: 'normal' });
        expect(next.edges).toContainEqual({ from: 'sw', to: 'other', label: 'case:default', caseName: 'default' });
    });

    it('clears defaultBranch when its case is removed', () => {
        const d = def();
        d.steps[0].defaultBranch = 'vip';
        const next = reconcileSwitchEdges(d, 'sw', cases('vip', 'normal'), cases('normal'));
        expect(next.steps[0].defaultBranch).toBeNull();
    });

    it('is a no-op (same object) when nothing changed', () => {
        const d = def();
        expect(reconcileSwitchEdges(d, 'sw', cases('vip', 'normal'), cases('vip', 'normal'))).toBe(d);
    });

    it('does not mutate its input', () => {
        const d = def();
        reconcileSwitchEdges(d, 'sw', cases('vip', 'normal'), cases('normal'));
        expect(d.edges).toHaveLength(4);
        expect(d.steps[0].cases).toHaveLength(2);
    });
});

describe('uniqueCaseName', () => {
    it('reproduces the audit repro without a collision', () => {
        // add, add, remove-first, add: naive `case${length+1}` minted case2 twice.
        const after = cases('case2');
        expect(uniqueCaseName(after, 'case2')).toBe('case2_2');
    });

    it('returns the base when free', () => {
        expect(uniqueCaseName(cases('a'), 'b')).toBe('b');
        expect(uniqueCaseName([], undefined)).toBe('case');
    });

    it('matches the legacy slug-collision suffix pattern', () => {
        expect(uniqueCaseName(cases('paid', 'paid_2'), 'paid')).toBe('paid_3');
    });
});

describe('mergeStepPatchIntoDefinition', () => {
    it('replaces a plain step without touching edges', () => {
        const d = def();
        const next = mergeStepPatchIntoDefinition(d, d.steps[1], { title: 'renamed' });
        expect(next.steps.find(s => s.id === 'send').title).toBe('renamed');
        expect(next.edges).toEqual(d.edges);
    });

    it('routes a trigger patch to definition.trigger', () => {
        const d = def();
        const next = mergeStepPatchIntoDefinition(d, d.trigger, { kind: 'webhook' });
        expect(next.trigger.kind).toBe('webhook');
        expect(next.steps).toEqual(d.steps);
    });

    it('routes a secondary-trigger patch into triggers[], not steps[]', () => {
        const d = { ...def(), triggers: [{ id: 't2', type: 'trigger', kind: 'webhook', label: 'Hook' }] };
        const next = mergeStepPatchIntoDefinition(d, d.triggers[0], { label: 'Hook 2' });
        expect(next.triggers[0].label).toBe('Hook 2');
        expect(next.steps.some(s => s.id === 't2')).toBe(false);
    });

    it('reconciles switch edges when the patch renames a case (the C1 scenario)', () => {
        const d = def();
        const next = mergeStepPatchIntoDefinition(d, d.steps[0], { cases: cases('urgent', 'normal') });
        expect(next.steps[0].cases.map(c => c.name)).toEqual(['urgent', 'normal']);
        expect(next.edges).toContainEqual({ from: 'sw', to: 'send', label: 'case:urgent', caseName: 'urgent' });
        expect(next.edges.some(e => e.caseName === 'vip')).toBe(false);
    });

    it('leaves edges alone when a switch patch does not touch cases', () => {
        const d = def();
        const next = mergeStepPatchIntoDefinition(d, d.steps[0], { label: 'My switch' });
        expect(next.edges).toEqual(d.edges);
    });
});
