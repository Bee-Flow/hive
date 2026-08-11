import { describe, it, expect } from 'vitest';
import { buildStepLabelMap, resolveOwningStepId, humanizeIssueText, humanizeFieldKey, describeRuleExpr } from './displayHelpers';

const def = {
    trigger: { id: 'trg', label: 'Manual trigger' },
    steps: [
        { id: 'cond_7f748746', type: 'condition', label: 'If' },
        { id: 'a_af2f5b', type: 'integration_action', label: 'Search Gmail' },
        { id: 'noLabel1', type: 'wait' },
    ],
};

describe('buildStepLabelMap', () => {
    it('maps every trigger + step id to its label, falling back to id when unlabeled', () => {
        const m = buildStepLabelMap(def);
        expect(m.get('trg')).toBe('Manual trigger');
        expect(m.get('cond_7f748746')).toBe('If');
        expect(m.get('noLabel1')).toBe('noLabel1');
    });

    it('returns an empty map for a missing definition', () => {
        expect(buildStepLabelMap(null).size).toBe(0);
    });
});

describe('resolveOwningStepId', () => {
    it('finds the step id embedded in a validation record path', () => {
        expect(resolveOwningStepId({ path: 'steps[cond_7f748746].expr' }, def)).toBe('cond_7f748746');
    });

    it('prefers the LONGEST matching id so a short id cannot shadow a longer one', () => {
        const longDef = { trigger: null, steps: [{ id: 'a' }, { id: 'a_af2f5b' }] };
        expect(resolveOwningStepId({ path: 'steps[a_af2f5b].inputs.to' }, longDef)).toBe('a_af2f5b');
    });

    it('returns null when the path references no known step (or is missing)', () => {
        expect(resolveOwningStepId({ path: 'steps[gone].expr' }, def)).toBeNull();
        expect(resolveOwningStepId({}, def)).toBeNull();
        expect(resolveOwningStepId({ path: 'steps[cond_7f748746].expr' }, null)).toBeNull();
    });
});

describe('humanizeIssueText', () => {
    const labelById = buildStepLabelMap(def);

    it('replaces a known raw step id embedded in free text with its quoted label', () => {
        expect(humanizeIssueText('Step cond_7f748746: unknown type "foo".', labelById))
            .toBe('Step "If": unknown type "foo".');
        expect(humanizeIssueText('runPartial: step cond_7f748746 not found in definition', labelById))
            .toBe('runPartial: step "If" not found in definition');
    });

    it('does not partially match a longer id sharing a short id as a prefix', () => {
        // 'a_af2f5b' must not be matched by a hypothetical shorter id 'a' first.
        expect(humanizeIssueText('refers to a_af2f5b', labelById)).toBe('refers to "Search Gmail"');
    });

    it('leaves unknown ids (e.g. a stale reference to a deleted step) untouched', () => {
        expect(humanizeIssueText('refers to non-existent step "gone_123"', labelById))
            .toBe('refers to non-existent step "gone_123"');
    });

    it('is a no-op for empty text or an empty label map', () => {
        expect(humanizeIssueText('', labelById)).toBe('');
        expect(humanizeIssueText('Step cond_7f748746', new Map())).toBe('Step cond_7f748746');
        expect(humanizeIssueText(null, labelById)).toBe(null);
    });
});

describe('humanizeFieldKey', () => {
    it('renders a data field as a plain English label', () => {
        expect(humanizeFieldKey('subject')).toBe('Subject');
        expect(humanizeFieldKey('from_email')).toBe('From email');
        expect(humanizeFieldKey('messageId')).toBe('Message id');
        expect(humanizeFieldKey('')).toBe('');
    });

    it('keeps curated proper nouns', () => {
        expect(humanizeFieldKey('pdf')).toBe('PDF');
        expect(humanizeFieldKey('gmail_id')).toBe('Gmail id');
    });
});

describe('describeRuleExpr', () => {
    it('reads a rule as a sentence — never a raw path', () => {
        expect(describeRuleExpr('contains(item.subject, "isv")')).toBe('Subject contains “isv”');
        expect(describeRuleExpr('item.amount > 1000')).toBe('Amount greater than 1000');
        expect(describeRuleExpr('isEmpty(item.body)')).toBe('Body is empty');
    });

    it('joins multiple conditions with and / or', () => {
        expect(describeRuleExpr('item.a > 1 && item.b == "x"')).toBe('A greater than 1 and B equals “x”');
        expect(describeRuleExpr('item.a > 1 || item.b > 2')).toBe('A greater than 1 or B greater than 2');
    });

    it('falls back to the step-label humanizer for expressions it cannot model', () => {
        const labels = new Map([['ai_1', 'Classify']]);
        expect(describeRuleExpr('len(steps.ai_1.output.tags) > 2', labels)).toBe('len(‹Classify›.tags) > 2');
        expect(describeRuleExpr('')).toBe('');
    });
});
