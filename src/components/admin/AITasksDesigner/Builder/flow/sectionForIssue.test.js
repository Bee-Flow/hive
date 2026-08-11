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

    it('maps a condition expr error to the unified Rules section', () => {
        const step = { id: 'c1', type: 'condition' };
        expect(sectionsWithErrors(step, issues('steps[c1].expr'))).toEqual(new Set(['rules']));
    });

    // This used to expect 'source' — a section RouteFields has never rendered.
    // The Source-list control (CollectionArrayRefField) sits inside Advanced,
    // and the Rules section papered over the mismatch by force-opening itself
    // on a 'source' error: the wrong band opened while the offending control
    // stayed collapsed one band below.
    it('maps a list-mode source error to Advanced, where the Source list actually is', () => {
        for (const type of ['filter', 'switch', 'condition']) {
            const step = { id: 'f1', type };
            expect(sectionsWithErrors(step, issues('steps[f1].arrayRef')), type).toEqual(new Set(['advanced']));
            expect(sectionsWithErrors(step, issues('steps[f1].maxItems')), type).toEqual(new Set(['advanced']));
        }
    });

    // guard / tokenize / untokenize had NO taxonomy entry at all, so this
    // returned an empty set: nothing force-opened, and at quick density the
    // Advanced band holding the category pills and the confidence threshold is
    // not rendered — the error was reported and the fix was unreachable.
    it('routes the privacy nodes, which used to have no entry at all', () => {
        expect(sectionsWithErrors({ id: 'g1', type: 'guard' }, issues('steps[g1].confidence'))).toEqual(new Set(['advanced']));
        expect(sectionsWithErrors({ id: 'g1', type: 'guard' }, issues('steps[g1].sourceRef'))).toEqual(new Set(['config']));
        expect(sectionsWithErrors({ id: 't1', type: 'tokenize' }, issues('steps[t1].categories'))).toEqual(new Set(['advanced']));
        expect(sectionsWithErrors({ id: 'u1', type: 'untokenize' }, issues('steps[u1].sourceRef'))).toEqual(new Set(['config']));
    });

    it('routes a reusable Step, which also had no entry', () => {
        expect(sectionsWithErrors({ id: 'b1', type: 'call_block' }, issues('steps[b1].inputs.to'))).toEqual(new Set(['inputs']));
        expect(sectionsWithErrors({ id: 'b1', type: 'call_block' }, issues('steps[b1].blockId'))).toEqual(new Set(['step']));
    });

    // The trigger has ONE 'config' section holding every kind-specific form.
    // The map used to name phantom 'event' and 'schedule' sections; a bad cron
    // therefore left the schedule builder collapsed.
    it('routes schedule and app-event trigger errors to the config section', () => {
        const step = { id: 'trg', type: 'trigger' };
        expect(sectionsWithErrors(step, issues('trigger.scheduleCron'))).toEqual(new Set(['config']));
        expect(sectionsWithErrors(step, issues('trigger.appEvent.provider'))).toEqual(new Set(['config']));
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
