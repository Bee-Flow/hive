import { describe, it, expect } from 'vitest';
import {
    parseRefTokens,
    serializeRefTokens,
    classifyRef,
    resolveChipLabel,
    hasRefTokens,
} from './refTokens';

const roundTrip = (s, mode) => serializeRefTokens(parseRefTokens(s, { mode }));

describe('refTokens — parse/serialize round-trip', () => {
    const cases = [
        ['bare steps ref (expr)', 'steps.ai_87e358.output.sources', 'expression'],
        ['bare trigger ref (expr)', 'trigger.output.keyTopics', 'expression'],
        ['bare loop ref (expr)', 'loop.item.amount', 'expression'],
        ['expr with operators', 'steps.s1.output.amount > 1000 ? "high" : "low"', 'expression'],
        ['nested + bracket path', 'steps.s1.output.results[0].subject', 'expression'],
        ['plain literal in fixed mode', 'just some text, no refs', 'fixed'],
        ['steps-looking text stays literal in fixed mode', 'steps.s1.output.x', 'fixed'],
        ['multi-ref template', 'From: {{trigger.output.from}} / {{steps.s1.output.subject}}', 'fixed'],
        ['template with a non-ref interpolation', 'Hi {{name}} — {{steps.s1.output.count}} items', 'fixed'],
        ['empty', '', 'expression'],
    ];
    for (const [name, input, mode] of cases) {
        it(`round-trips: ${name}`, () => {
            expect(roundTrip(input, mode)).toBe(input);
        });
    }
});

describe('refTokens — token structure', () => {
    it('extracts a steps ref with stepId + fieldPath', () => {
        const [tok] = parseRefTokens('steps.ai_87e358.output.sources', { mode: 'expression' });
        expect(tok).toMatchObject({ type: 'ref', source: 'steps', stepId: 'ai_87e358', fieldPath: 'sources' });
    });

    it('extracts a trigger ref fieldPath', () => {
        const [tok] = parseRefTokens('trigger.output.keyTopics', { mode: 'expression' });
        expect(tok).toMatchObject({ type: 'ref', source: 'trigger', fieldPath: 'keyTopics' });
    });

    it('extracts a loop ref itemVar + fieldPath', () => {
        const [tok] = parseRefTokens('loop.row.email', { mode: 'expression' });
        expect(tok).toMatchObject({ type: 'ref', source: 'loop', itemVar: 'row', fieldPath: 'email' });
    });

    it('keeps bracket-indexed nested paths in fieldPath', () => {
        const [tok] = parseRefTokens('steps.s1.output.results[0].subject', { mode: 'expression' });
        expect(tok.fieldPath).toBe('results[0].subject');
    });

    it('does not chip lookalike identifiers', () => {
        const toks = parseRefTokens('mysteps.x + vars.trigger.y', { mode: 'expression' });
        expect(toks.some(t => t.type === 'ref')).toBe(false);
    });

    it('splits an expression into literal + ref tokens', () => {
        const toks = parseRefTokens('steps.s1.output.amount > 1000', { mode: 'expression' });
        expect(toks.map(t => t.type)).toEqual(['ref', 'literal']);
        expect(toks[1].text).toBe(' > 1000');
    });
});

describe('classifyRef', () => {
    it('classifies each source and rejects non-refs', () => {
        expect(classifyRef('steps.a.output.b')).toMatchObject({ source: 'steps', stepId: 'a' });
        expect(classifyRef('trigger.output.b')).toMatchObject({ source: 'trigger' });
        expect(classifyRef('loop.it.b')).toMatchObject({ source: 'loop', itemVar: 'it' });
        expect(classifyRef('amount > 1000')).toBeNull();
        expect(classifyRef('"a literal"')).toBeNull();
    });
});

describe('resolveChipLabel', () => {
    const map = new Map([['ai_87e358', 'Search web & compile news digest']]);

    it('resolves a known step id to its label', () => {
        const tok = { source: 'steps', stepId: 'ai_87e358', fieldPath: 'sources' };
        expect(resolveChipLabel(tok, map)).toEqual({ name: 'Search web & compile news digest', suffix: 'sources', missing: false });
    });

    it('falls back to the id and flags missing for a deleted step', () => {
        const tok = { source: 'steps', stepId: 'gone_123', fieldPath: 'x' };
        const r = resolveChipLabel(tok, map);
        expect(r).toMatchObject({ name: 'gone_123', missing: true });
    });

    it('labels trigger and loop sources', () => {
        expect(resolveChipLabel({ source: 'trigger', fieldPath: 'subject' }, map)).toMatchObject({ name: 'Trigger', missing: false });
        expect(resolveChipLabel({ source: 'loop', itemVar: 'row', fieldPath: 'email' }, map)).toMatchObject({ name: 'Loop item · row', missing: false });
    });
});

describe('hasRefTokens', () => {
    it('is true only when a renderable ref is present', () => {
        expect(hasRefTokens('steps.s1.output.x', 'expression')).toBe(true);
        expect(hasRefTokens('Hello {{trigger.output.x}}', 'fixed')).toBe(true);
        expect(hasRefTokens('just text', 'fixed')).toBe(false);
        expect(hasRefTokens('steps.s1.output.x', 'fixed')).toBe(false); // literal in fixed mode
    });
});
