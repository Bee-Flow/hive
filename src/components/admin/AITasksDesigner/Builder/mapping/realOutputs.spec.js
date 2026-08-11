import { describe, it, expect } from 'vitest';
import { buildRealOutputMap, buildSampleRoot, deepOverlay, isTruncatedOutput } from './realOutputs';
import { walkPath } from '../../../../../utils/bindingHelpers';

/**
 * The rules here are load-bearing for everything that consumes real run/pinned
 * data: pinned beats run, sub-rows and deleted steps never leak in, and the
 * server's truncation sentinel is never mistaken for data.
 */

const DEF = {
    trigger: { id: 'trg', kind: 'manual' },
    steps: [
        { id: 's1', type: 'integration_action', tool: 'gmail_search' },
        { id: 's2', type: 'set', fields: {} },
    ],
    edges: [{ from: 'trg', to: 's1' }, { from: 's1', to: 's2' }],
};

describe('isTruncatedOutput', () => {
    it('recognises only the server sentinel', () => {
        expect(isTruncatedOutput({ __truncated__: true, originalBytes: 999 })).toBe(true);
        expect(isTruncatedOutput({ __truncated__: false })).toBe(false);
        expect(isTruncatedOutput({ items: [] })).toBe(false);
        expect(isTruncatedOutput(null)).toBe(false);
        expect(isTruncatedOutput('text')).toBe(false);
    });
});

describe('buildRealOutputMap', () => {
    it('collects run outputs for known steps; first row wins', () => {
        const map = buildRealOutputMap(DEF, [
            { stepId: 's1', output: { results: [1, 2] } },
            { stepId: 's1', output: { results: [9] } },
        ]);
        expect(map.get('s1')).toEqual({ results: [1, 2] });
    });

    it('pinned output beats a run row', () => {
        const def = { ...DEF, steps: [{ ...DEF.steps[0], pinnedOutput: { results: ['pinned'] } }, DEF.steps[1]] };
        const map = buildRealOutputMap(def, [{ stepId: 's1', output: { results: ['run'] } }]);
        expect(map.get('s1')).toEqual({ results: ['pinned'] });
    });

    it('drops sub-rows, deleted-step rows, null and truncated outputs', () => {
        const map = buildRealOutputMap(DEF, [
            { stepId: 's1', parentStepId: 'cl1', output: { sub: true } },   // layer sub-row
            { stepId: 'ghost', output: { boo: 1 } },                        // deleted step
            { stepId: 's1', output: null },
            { stepId: 's2', output: { __truncated__: true, originalBytes: 1e6 } },
        ]);
        expect(map.size).toBe(0);
    });

    it('a truncated pin is not data either', () => {
        const def = { ...DEF, steps: [{ ...DEF.steps[0], pinnedOutput: { __truncated__: true } }, DEF.steps[1]] };
        expect(buildRealOutputMap(def, []).size).toBe(0);
    });

    it('includes the trigger and secondary triggers', () => {
        const def = { ...DEF, triggers: [{ id: 'hook', kind: 'webhook', pinnedOutput: { body: 1 } }] };
        const map = buildRealOutputMap(def, [{ stepId: 'trg', output: { fired: true } }]);
        expect(map.get('trg')).toEqual({ fired: true });
        expect(map.get('hook')).toEqual({ body: 1 });
    });
});

describe('deepOverlay', () => {
    it('real scalar/array replaces the sample subtree wholesale', () => {
        expect(deepOverlay({ body: '<response body>' }, { body: [1, 2] })).toEqual({ body: [1, 2] });
        expect(deepOverlay({ a: { deep: 1 } }, { a: 'x' })).toEqual({ a: 'x' });
        expect(deepOverlay('placeholder', { real: 1 })).toEqual({ real: 1 });
    });

    it('merges objects key by key; sample-only keys survive', () => {
        expect(deepOverlay({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 9 } })).toEqual({ a: 1, b: { c: 9, d: 3 } });
    });

    it('reuses real references instead of cloning (perf contract)', () => {
        const rows = [{ big: 'data' }];
        const out = deepOverlay({ results: 'sample' }, { results: rows });
        expect(out.results).toBe(rows);
    });
});

describe('buildSampleRoot', () => {
    it('assembles trigger/steps/loop slots from groups', () => {
        const root = buildSampleRoot([
            { id: 'trg', kind: 'trigger', basePath: 'trigger.output', sample: { fired: 1 } },
            { id: 's1', kind: 'integration_action', basePath: 'steps.s1.output', sample: { results: [1] } },
            { id: 'loop-item', kind: 'loop', basePath: 'loop.item', sample: { subject: 'x' } },
        ]);
        expect(root.trigger.output).toEqual({ fired: 1 });
        expect(root.steps.s1.output).toEqual({ results: [1] });
        expect(root.loop.item).toEqual({ subject: 'x' });
    });

    it('a trigger group with real data is not clobbered by a later placeholder trigger', () => {
        const root = buildSampleRoot([
            { id: 'trg', kind: 'trigger', basePath: 'trigger.output', sample: { fired: 1 }, hasRealData: true },
            { id: 'hook', kind: 'trigger', basePath: 'trigger.output', sample: { placeholder: true } },
        ]);
        expect(root.trigger.output).toEqual({ fired: 1 });
    });

    it('without real data the last trigger still wins (legacy behaviour)', () => {
        const root = buildSampleRoot([
            { id: 'trg', kind: 'trigger', basePath: 'trigger.output', sample: { a: 1 } },
            { id: 'hook', kind: 'trigger', basePath: 'trigger.output', sample: { b: 2 } },
        ]);
        expect(root.trigger.output).toEqual({ b: 2 });
    });
});

// REGRESSION: buildSampleRoot dispatched on `g.kind`, and TWO very different
// groups carry kind:'loop' — the per-item scope (`loop.<itemVar>`) and a Loop
// STEP seen from downstream (`steps.<id>.output`, execLoop's
// `{iterations, results:[…]}` envelope). The Loop step landed in
// `root.loop['<id>.output']`, so `root.steps.<id>` stayed empty and NOTHING
// wired after a Loop resolved in any preview, picker or auto-map.
describe('buildSampleRoot — a Loop STEP is not the loop scope', () => {
    const loopStepGroup = {
        id: 'loop1', kind: 'loop', basePath: 'steps.loop1.output',
        sample: { iterations: 0, results: [{ index: 0, item: { subject: 'Invoice' }, output: {} }] },
    };

    it("files a Loop step's envelope under steps.<id>.output", () => {
        const root = buildSampleRoot([loopStepGroup]);
        expect(root.steps.loop1.output).toEqual(loopStepGroup.sample);
        expect(root.loop['loop1.output']).toBeUndefined();
    });

    it('a downstream ref into the loop envelope now resolves in the preview', () => {
        const root = buildSampleRoot([loopStepGroup]);
        expect(walkPath('steps.loop1.output.results[*].item.subject', root)).toEqual(['Invoice']);
        expect(walkPath('steps.loop1.output.iterations', root)).toBe(0);
    });

    it('the per-item loop scope still lands in root.loop', () => {
        const root = buildSampleRoot([
            loopStepGroup,
            { id: 's2__foreach', kind: 'loop', basePath: 'loop.item', sample: { subject: 'x' } },
        ]);
        expect(root.loop.item).toEqual({ subject: 'x' });
        expect(root.steps.loop1.output.iterations).toBe(0);
    });
});
