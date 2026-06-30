import { describe, it, expect } from 'vitest';
import { walkSteps, structuralSignature, hasFillableStep, applyLabels } from './useAutoLabelSteps';

describe('useAutoLabelSteps — structuralSignature', () => {
    it('is stable when only label / icon / position / prompt differ', () => {
        const a = { steps: [{ id: 's1', type: 'tool', tool: 'gmail_send', label: '', icon: '', position: { x: 0, y: 0 }, prompt: 'hi' }] };
        const b = { steps: [{ id: 's1', type: 'tool', tool: 'gmail_send', label: 'Send the email', icon: 'mail', position: { x: 999, y: 12 }, prompt: 'totally different prompt text' }] };
        expect(structuralSignature(a)).toBe(structuralSignature(b));
    });

    it('changes when a step is added', () => {
        const a = { steps: [{ id: 's1', type: 'tool', tool: 'gmail_send' }] };
        const b = { steps: [{ id: 's1', type: 'tool', tool: 'gmail_send' }, { id: 's2', type: 'ai', tool: '' }] };
        expect(structuralSignature(a)).not.toBe(structuralSignature(b));
    });

    it('changes when a step type or tool changes', () => {
        const base = { steps: [{ id: 's1', type: 'tool', tool: 'gmail_send' }] };
        const retyped = { steps: [{ id: 's1', type: 'ai', tool: 'gmail_send' }] };
        const retooled = { steps: [{ id: 's1', type: 'tool', tool: 'gmail_search' }] };
        expect(structuralSignature(base)).not.toBe(structuralSignature(retyped));
        expect(structuralSignature(base)).not.toBe(structuralSignature(retooled));
    });

    it('is order-independent (sorts parts)', () => {
        const a = { steps: [{ id: 's1', type: 'tool', tool: 't1' }, { id: 's2', type: 'ai' }] };
        const b = { steps: [{ id: 's2', type: 'ai' }, { id: 's1', type: 'tool', tool: 't1' }] };
        expect(structuralSignature(a)).toBe(structuralSignature(b));
    });

    it('descends into loop body and parallel branches', () => {
        const without = { steps: [{ id: 'loop1', type: 'loop', body: [] }] };
        const withInner = { steps: [{ id: 'loop1', type: 'loop', body: [{ id: 'inner', type: 'tool', tool: 'x' }] }] };
        expect(structuralSignature(without)).not.toBe(structuralSignature(withInner));

        const par = { steps: [{ id: 'p1', type: 'parallel', branches: [[{ id: 'pa', type: 'ai' }], [{ id: 'pb', type: 'tool', tool: 't' }]] }] };
        const parMissingBranch = { steps: [{ id: 'p1', type: 'parallel', branches: [[{ id: 'pa', type: 'ai' }]] }] };
        expect(structuralSignature(par)).not.toBe(structuralSignature(parMissingBranch));
    });
});

describe('useAutoLabelSteps — hasFillableStep', () => {
    it('is true when a step has an empty unlocked label', () => {
        const def = { steps: [{ id: 's1', type: 'tool', label: '', icon: 'mail' }] };
        expect(hasFillableStep(def)).toBe(true);
    });

    it('is true when a step has an empty unlocked icon', () => {
        const def = { steps: [{ id: 's1', type: 'tool', label: 'Has label', icon: '' }] };
        expect(hasFillableStep(def)).toBe(true);
    });

    it('is false when label and icon are both filled', () => {
        const def = { steps: [{ id: 's1', type: 'tool', label: 'Send', icon: 'mail' }] };
        expect(hasFillableStep(def)).toBe(false);
    });

    it('is false when the only empty fields are locked (labelManual + iconManual)', () => {
        const def = { steps: [{ id: 's1', type: 'tool', label: '', icon: '', labelManual: true, iconManual: true }] };
        expect(hasFillableStep(def)).toBe(false);
    });

    it('ignores layer_output steps', () => {
        const def = { steps: [{ id: 'out', type: 'layer_output', label: '', icon: '' }] };
        expect(hasFillableStep(def)).toBe(false);
    });

    it('ignores steps with no id', () => {
        const def = { steps: [{ type: 'tool', label: '', icon: '' }] };
        expect(hasFillableStep(def)).toBe(false);
    });

    it('detects a nested empty-label step inside a loop body', () => {
        const def = {
            steps: [{
                id: 'loop1', type: 'loop', label: 'Loop', icon: 'repeat',
                body: [{ id: 'inner', type: 'tool', label: '', icon: 'mail' }],
            }],
        };
        expect(hasFillableStep(def)).toBe(true);
    });

    it('treats whitespace-only labels as empty', () => {
        const def = { steps: [{ id: 's1', type: 'tool', label: '   ', icon: 'mail' }] };
        expect(hasFillableStep(def)).toBe(true);
    });
});

describe('useAutoLabelSteps — applyLabels', () => {
    it('fills empty unlocked label and icon', () => {
        const def = { steps: [{ id: 's1', type: 'tool', label: '', icon: '' }] };
        const out = applyLabels(def, { s1: { label: 'Send email', icon: 'mail' } });
        expect(out.steps[0].label).toBe('Send email');
        expect(out.steps[0].icon).toBe('mail');
    });

    it('does not overwrite a non-empty existing label or icon', () => {
        const def = { steps: [{ id: 's1', type: 'tool', label: 'My label', icon: 'star' }] };
        const out = applyLabels(def, { s1: { label: 'AI label', icon: 'mail' } });
        expect(out.steps[0].label).toBe('My label');
        expect(out.steps[0].icon).toBe('star');
    });

    it('does not overwrite locked fields even if empty', () => {
        const def = { steps: [{ id: 's1', type: 'tool', label: '', icon: '', labelManual: true, iconManual: true }] };
        const out = applyLabels(def, { s1: { label: 'AI label', icon: 'mail' } });
        expect(out.steps[0].label).toBe('');
        expect(out.steps[0].icon).toBe('');
    });

    it('recurses into loop body', () => {
        const def = {
            steps: [{
                id: 'loop1', type: 'loop', label: '', icon: '',
                body: [{ id: 'inner', type: 'tool', label: '', icon: '' }],
            }],
        };
        const out = applyLabels(def, {
            loop1: { label: 'Loop over rows', icon: 'repeat' },
            inner: { label: 'Process row', icon: 'cog' },
        });
        expect(out.steps[0].label).toBe('Loop over rows');
        expect(out.steps[0].body[0].label).toBe('Process row');
        expect(out.steps[0].body[0].icon).toBe('cog');
    });

    it('recurses into parallel branches', () => {
        const def = {
            steps: [{
                id: 'p1', type: 'parallel', label: '', icon: '',
                branches: [
                    [{ id: 'pa', type: 'ai', label: '', icon: '' }],
                    [{ id: 'pb', type: 'tool', label: '', icon: '' }],
                ],
            }],
        };
        const out = applyLabels(def, {
            pa: { label: 'Summarize', icon: 'sparkles' },
            pb: { label: 'Notify', icon: 'bell' },
        });
        expect(out.steps[0].branches[0][0].label).toBe('Summarize');
        expect(out.steps[0].branches[1][0].label).toBe('Notify');
        expect(out.steps[0].branches[1][0].icon).toBe('bell');
    });

    it('returns a new object and does not mutate the input', () => {
        const def = { steps: [{ id: 's1', type: 'tool', label: '', icon: '' }] };
        const out = applyLabels(def, { s1: { label: 'New', icon: 'mail' } });
        expect(out).not.toBe(def);
        expect(out.steps).not.toBe(def.steps);
        expect(out.steps[0]).not.toBe(def.steps[0]);
        // original untouched
        expect(def.steps[0].label).toBe('');
        expect(def.steps[0].icon).toBe('');
    });

    it('leaves steps not present in the labels map untouched', () => {
        const def = { steps: [{ id: 's1', type: 'tool', label: '', icon: '' }] };
        const out = applyLabels(def, { other: { label: 'nope' } });
        expect(out.steps[0].label).toBe('');
    });
});

describe('useAutoLabelSteps — walkSteps', () => {
    it('visits top-level, loop body, and parallel branch steps', () => {
        const steps = [
            { id: 'top', type: 'tool' },
            { id: 'loop1', type: 'loop', body: [{ id: 'inner', type: 'tool' }] },
            { id: 'p1', type: 'parallel', branches: [[{ id: 'pa', type: 'ai' }], [{ id: 'pb', type: 'tool' }]] },
        ];
        const seen = [];
        walkSteps(steps, (s) => seen.push(s.id));
        expect(seen).toEqual(['top', 'loop1', 'inner', 'p1', 'pa', 'pb']);
    });

    it('is a no-op for non-array input', () => {
        const seen = [];
        walkSteps(undefined, (s) => seen.push(s));
        walkSteps(null, (s) => seen.push(s));
        expect(seen).toEqual([]);
    });

    it('skips null / non-object entries', () => {
        const seen = [];
        walkSteps([null, undefined, 'x', { id: 'ok', type: 'tool' }], (s) => seen.push(s.id));
        expect(seen).toEqual(['ok']);
    });
});
