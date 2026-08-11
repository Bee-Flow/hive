import { describe, it, expect } from 'vitest';
import { effectiveRunByStep } from './runStatus';

const DEF = {
    trigger: { id: 'trg', kind: 'manual' },
    steps: [
        { id: 's1', type: 'integration_action' },
        { id: 's2', type: 'set', pinnedOutput: { results: [1, 2, 3] } },
    ],
};

describe('effectiveRunByStep', () => {
    it('keeps primary run rows and drops layer sub-rows', () => {
        const m = effectiveRunByStep(DEF, [
            { stepId: 's1', status: 'success', output: { a: 1 } },
            { stepId: 's1', parentStepId: 'cl1', status: 'success', output: { sub: 1 } },
        ]);
        expect(m.get('s1').output).toEqual({ a: 1 });
    });

    it('synthesises a pinned stub for a pinned node with no run row', () => {
        const m = effectiveRunByStep(DEF, []);
        expect(m.get('s2')).toEqual({ stepId: 's2', status: 'pinned', output: { results: [1, 2, 3] } });
        expect(m.has('s1')).toBe(false);
    });

    it('a real run row wins over the pin stub', () => {
        const m = effectiveRunByStep(DEF, [{ stepId: 's2', status: 'success', output: { fresh: true } }]);
        expect(m.get('s2').status).toBe('success');
    });

    it('a truncated pin produces no stub', () => {
        const def = { ...DEF, steps: [{ id: 's2', pinnedOutput: { __truncated__: true } }] };
        expect(effectiveRunByStep(def, []).size).toBe(0);
    });

    it('handles empty inputs', () => {
        expect(effectiveRunByStep(null, null).size).toBe(0);
    });
});
