import { describe, it, expect } from 'vitest';
import { sectionsWithErrors } from './sectionForIssue';

const issues = (...paths) => ({ errors: paths.map(p => ({ path: p, severity: 'error' })), warnings: [] });

describe('sectionsWithErrors', () => {
    it('maps an ai_step inputs error to the inputs section', () => {
        const step = { id: 's1', type: 'ai_step' };
        expect(sectionsWithErrors(step, issues('steps[s1].inputs.subject'))).toEqual(new Set(['inputs']));
    });

    it('maps an ai_step structured-output error to the output section', () => {
        const step = { id: 's1', type: 'ai_step' };
        expect(sectionsWithErrors(step, issues('steps[s1].outputFields'))).toEqual(new Set(['output']));
    });

    it('treats a flat field (prompt) as always-visible — no section forced', () => {
        const step = { id: 's1', type: 'ai_step' };
        expect(sectionsWithErrors(step, issues('steps[s1].prompt')).size).toBe(0);
    });

    it('maps a condition expr error to its single section', () => {
        const step = { id: 'c1', type: 'condition' };
        expect(sectionsWithErrors(step, issues('steps[c1].expr'))).toEqual(new Set(['condition']));
    });

    it('maps a forEach error on an integration_action to advanced', () => {
        const step = { id: 'i1', type: 'integration_action' };
        expect(sectionsWithErrors(step, issues('steps[i1].forEach.overRef'))).toEqual(new Set(['advanced']));
    });

    it('maps an integration_action inputs error to inputs', () => {
        const step = { id: 'i1', type: 'integration_action' };
        expect(sectionsWithErrors(step, issues('steps[i1].inputs.to'))).toEqual(new Set(['inputs']));
    });

    it('falls back to the first section for an unknown field tail (never empty)', () => {
        const step = { id: 'i1', type: 'integration_action' };
        const out = sectionsWithErrors(step, issues('steps[i1].somethingNew'));
        expect(out.has('basics')).toBe(true);
    });

    it('returns an empty set when there are no errors', () => {
        const step = { id: 's1', type: 'ai_step' };
        expect(sectionsWithErrors(step, issues()).size).toBe(0);
    });

    it('returns an empty set for an unknown step type', () => {
        const step = { id: 'x1', type: 'mystery' };
        expect(sectionsWithErrors(step, issues('steps[x1].foo')).size).toBe(0);
    });
});
