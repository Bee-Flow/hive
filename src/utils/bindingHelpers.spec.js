import { evaluate } from '@shared/expr/engine.mjs';
import { describe, it, expect } from 'vitest';
import { getAutocompleteToken, replaceRange, suggestKeyFromPath, renderBindingValue, buildConditionExpr } from './bindingHelpers';

// Real textarea (jsdom) so selectionStart/setSelectionRange behave like the
// inspector's inputs. Caret defaults to end-of-value.
function makeEl(value, caret = value.length) {
    const el = document.createElement('textarea');
    document.body.appendChild(el);
    el.value = value;
    el.setSelectionRange(caret, caret);
    return el;
}

describe('getAutocompleteToken — fixed (template) mode', () => {
    it('detects an unclosed {{ partial at the caret', () => {
        const el = makeEl('Hello {{su');
        expect(getAutocompleteToken(el, 'fixed')).toEqual({ start: 6, end: 10, query: 'su' });
    });

    it('returns null when the template is already closed', () => {
        const el = makeEl('Hello {{subject}} x');
        expect(getAutocompleteToken(el, 'fixed')).toBeNull();
    });

    it('a bare {{ yields an empty query', () => {
        const el = makeEl('{{');
        expect(getAutocompleteToken(el, 'fixed')).toEqual({ start: 0, end: 2, query: '' });
    });

    it('returns null for a non-pathish partial (contains "!")', () => {
        const el = makeEl('{{a b!');
        expect(getAutocompleteToken(el, 'fixed')).toBeNull();
    });
});

describe('getAutocompleteToken — expression mode', () => {
    it('detects a rooted partial path ending at the caret', () => {
        const el = makeEl('steps.s1.ou');
        expect(getAutocompleteToken(el, 'expression')).toEqual({ start: 0, end: 11, query: 'steps.s1.ou' });
    });

    it('requires a word boundary before the root (mysteps ≠ steps)', () => {
        const el = makeEl('mysteps.x');
        expect(getAutocompleteToken(el, 'expression')).toBeNull();
    });

    it('finds the rooted path inside a larger expression', () => {
        const el = makeEl('1 + trigger.output.a');
        expect(getAutocompleteToken(el, 'expression')).toEqual({ start: 4, end: 20, query: 'trigger.output.a' });
    });

    // BFSF-321: the picker used to require a COMPLETE root plus its dot, so
    // typing "st" suggested nothing and the feature looked broken. A partial
    // that could still become a root now opens it.
    it('a bare root without a dot is a token (suggests its members)', () => {
        const el = makeEl('steps');
        expect(getAutocompleteToken(el, 'expression')).toEqual({ start: 0, end: 5, query: 'steps' });
    });

    it('a partial root prefix is a token', () => {
        expect(getAutocompleteToken(makeEl('st'), 'expression')).toEqual({ start: 0, end: 2, query: 'st' });
        expect(getAutocompleteToken(makeEl('trig'), 'expression')).toEqual({ start: 0, end: 4, query: 'trig' });
    });

    it('a single character is not enough to open the picker', () => {
        expect(getAutocompleteToken(makeEl('s'), 'expression')).toBeNull();
    });

    it('a word that is not a root prefix is not a token', () => {
        expect(getAutocompleteToken(makeEl('from'), 'expression')).toBeNull();
        expect(getAutocompleteToken(makeEl('subject'), 'expression')).toBeNull();
    });

    it('finds a partial root inside a larger expression', () => {
        expect(getAutocompleteToken(makeEl('1 + tri'), 'expression')).toEqual({ start: 4, end: 7, query: 'tri' });
    });

    it('item. is a valid loop-scoped root', () => {
        const el = makeEl('item.');
        expect(getAutocompleteToken(el, 'expression')).toEqual({ start: 0, end: 5, query: 'item.' });
    });
});

// App Studio's expression scope shares none of the routine roots but item/vars,
// so the caller supplies its own list (from the server catalog). Without this
// the picker never opened on `currentUser.` / `form.` — the two roots a Studio
// author reaches for first.
describe('getAutocompleteToken — caller-supplied roots', () => {
    const STUDIO = ['currentUser', 'form', 'screen', 'vars', 'actions', 'datasets', 'item'];

    it('completes a root the default list does not have', () => {
        const el = makeEl('currentUser.em');
        expect(getAutocompleteToken(el, 'expression', STUDIO))
            .toEqual({ start: 0, end: 14, query: 'currentUser.em' });
        expect(getAutocompleteToken(makeEl('currentUser.em'), 'expression')).toBeNull();
    });

    it('completes a bare prefix of a supplied root', () => {
        expect(getAutocompleteToken(makeEl('curr'), 'expression', STUDIO))
            .toEqual({ start: 0, end: 4, query: 'curr' });
    });

    it('stops completing a default root that is not in the supplied list', () => {
        expect(getAutocompleteToken(makeEl('steps.s1.x'), 'expression', STUDIO)).toBeNull();
        expect(getAutocompleteToken(makeEl('trig'), 'expression', STUDIO)).toBeNull();
    });

    it('still completes the roots both lists share', () => {
        expect(getAutocompleteToken(makeEl('vars.q'), 'expression', STUDIO))
            .toEqual({ start: 0, end: 6, query: 'vars.q' });
    });

    // The list can come from a server catalog response, so it is untrusted:
    // a metacharacter must be dropped, never compiled into the pattern.
    it('ignores entries that are not plain identifiers', () => {
        expect(getAutocompleteToken(makeEl('a|b.x'), 'expression', ['a|b'])).toBeNull();
        expect(getAutocompleteToken(makeEl('form.q'), 'expression', ['a|b', 'form']))
            .toEqual({ start: 0, end: 6, query: 'form.q' });
    });

    it('an empty root list never opens the picker', () => {
        expect(getAutocompleteToken(makeEl('vars.q'), 'expression', [])).toBeNull();
    });
});

describe('replaceRange', () => {
    it('replaces [start,end) with the snippet and places the caret after it', () => {
        const el = makeEl('Hello {{su world');
        const snippet = '{{trigger.output.subject}}';
        const next = replaceRange(el, 6, 10, snippet);
        expect(next).toBe('Hello {{trigger.output.subject}} world');
        expect(el.value).toBe('Hello {{trigger.output.subject}} world');
        expect(el.selectionStart).toBe(6 + snippet.length);
        expect(el.selectionEnd).toBe(6 + snippet.length);
    });

    it('clamps out-of-range bounds to the value length', () => {
        const el = makeEl('abc');
        expect(replaceRange(el, 2, 99, 'Z')).toBe('abZ');
        expect(el.selectionStart).toBe(3);
    });

    it('returns null without an element', () => {
        expect(replaceRange(null, 0, 0, 'x')).toBeNull();
    });
});

describe('suggestKeyFromPath', () => {
    it('takes the last meaningful segment', () => {
        expect(suggestKeyFromPath('trigger.output.subject')).toBe('subject');
    });
    it('strips [*] wildcards before picking the segment', () => {
        expect(suggestKeyFromPath('steps.s1.output.items[*].email')).toBe('email');
    });
    it('skips a trailing "output" and uses the step id', () => {
        expect(suggestKeyFromPath('steps.s1.output')).toBe('s1');
    });
    it('falls back to "field" for empty input', () => {
        expect(suggestKeyFromPath('')).toBe('field');
    });
});

// ── renderBindingValue: template bindings ──────────────
//
// REGRESSION: a value picked in the condition builder's default "fixed" mode
// arrives as `{kind:'template', value:'{{path}}'}` (BindingField inserts
// `{{path}}` there; bindingFromInput promotes it to a template). This used to
// serialise as JSON.stringify(value), so the saved condition read
//   steps.s1.output.status == "{{trigger.output.status}}"
// — a string comparison that is false for EVERY run, silently, with a green
// status. Nothing interpolates inside an `expr`; only the binding resolver does.
describe('renderBindingValue — template bindings', () => {
    it('a whole-string {{path}} template renders as the bare path, not a quoted literal', () => {
        expect(renderBindingValue({ kind: 'template', value: '{{trigger.output.status}}' }))
            .toBe('trigger.output.status');
        expect(renderBindingValue({ kind: 'template', value: '{{  trigger.output.status  }}' }))
            .toBe('trigger.output.status');
    });

    it('buildConditionExpr no longer emits a comparison that can never match', () => {
        const expr = buildConditionExpr('steps.s1.output.status', '==', {
            kind: 'template', value: '{{trigger.output.status}}',
        });
        expect(expr).toBe('steps.s1.output.status == trigger.output.status');
        expect(expr).not.toContain('"{{');
        // …and it now actually evaluates the way the user meant it to.
        const scope = { steps: { s1: { output: { status: 'open' } } }, trigger: { output: { status: 'open' } } };
        expect(evaluate(expr, scope)).toBe(true);
        expect(evaluate(expr, { ...scope, trigger: { output: { status: 'closed' } } })).toBe(false);
    });

    it('mixed literal + interpolation becomes concat(...), not a raw quoted template', () => {
        const rendered = renderBindingValue({ kind: 'template', value: 'INV-{{trigger.output.id}}-EU' });
        expect(rendered).toBe('concat("INV-", trigger.output.id, "-EU")');
        expect(evaluate(rendered, { trigger: { output: { id: 42 } } })).toBe('INV-42-EU');
    });

    it('a `[*]` wildcard path survives the translation', () => {
        expect(renderBindingValue({ kind: 'template', value: '{{steps.s1.output.items[*].sku}}' }))
            .toBe('steps.s1.output.items[*].sku');
    });

    it('an interpolation that is not a clean path keeps the historical quoted rendering', () => {
        // The restricted grammar could not parse a bare `a + 1` fragment here,
        // so leave those exactly as they were rather than emitting a parse error.
        expect(renderBindingValue({ kind: 'template', value: '{{a + 1}}' })).toBe('"{{a + 1}}"');
        expect(renderBindingValue({ kind: 'template', value: 'no interpolation' })).toBe('"no interpolation"');
    });

    it('literal / ref / expr renderings are untouched', () => {
        expect(renderBindingValue({ kind: 'literal', value: 'file' })).toBe('"file"');
        expect(renderBindingValue({ kind: 'literal', value: 1000 })).toBe('1000');
        expect(renderBindingValue({ kind: 'ref', path: 'trigger.output.x' })).toBe('trigger.output.x');
        expect(renderBindingValue({ kind: 'expr', value: 'len(item.tags)' })).toBe('len(item.tags)');
    });
});
