import { beforeEach, describe, expect, it } from 'vitest';
import {
    buildFragment, buildPill, ensureTrailingFiller, FILLER_ATTR,
    PILL_SELECTOR, renderInto, serializeHost,
} from './refEditorDom';

/**
 * The one invariant that matters: the editor is a different PRESENTATION of the
 * stored value, never a rewrite of it. `serialize(build(v)) === v` for every v.
 *
 * A bug here silently corrupts someone's saved automation — the runtime resolves
 * an id path, so a lost bracket or a swallowed newline is a step that stops
 * finding its data with nothing on screen to explain why.
 */

const STEP_LABELS = new Map([['act_f9aaff0e', 'gmail read'], ['ai_1', 'Summarise']]);

let host;
beforeEach(() => {
    host = document.createElement('div');
    document.body.replaceChildren(host);
});

function roundTrip(value, mode = 'fixed') {
    host.replaceChildren(buildFragment(value, { mode, stepLabelById: STEP_LABELS }));
    return serializeHost(host);
}

describe('round-trip', () => {
    const CASES = {
        'plain text': ['Make a short summary:', 'fixed'],
        'empty': ['', 'fixed'],
        'a single reference': ['{{steps.act_f9aaff0e.output.results[*].output}}', 'fixed'],
        'text around a reference': ['Summarise {{steps.act_f9aaff0e.output.body}} please', 'fixed'],
        'two references': ['{{trigger.output.subject}} — {{steps.ai_1.output}}', 'fixed'],
        'newlines': ['Make a short summary:\n{{steps.act_f9aaff0e.output.body}}', 'fixed'],
        'a trailing newline': ['line one\n', 'fixed'],
        'consecutive newlines': ['a\n\n\nb', 'fixed'],
        'inner spacing kept verbatim': ['{{ steps.ai_1.output.total }}', 'fixed'],
        'a reference to a deleted step': ['{{steps.gone_99.output.x}}', 'fixed'],
        'a bare expression path': ['steps.act_f9aaff0e.output.total', 'expression'],
        'an expression that computes': ['steps.ai_1.output.total > 100', 'expression'],
        'a loop item': ['{{loop.item.name}}', 'fixed'],
        'braces that are not a reference': ['{{ not.a.ref }}', 'fixed'],
        'a lone brace': ['a { b', 'fixed'],
    };

    for (const [name, [value, mode]] of Object.entries(CASES)) {
        it(name, () => expect(roundTrip(value, mode)).toBe(value));
    }
});

describe('pills', () => {
    it('shows the step NAME and the field, never the id path', () => {
        host.replaceChildren(buildFragment('{{steps.act_f9aaff0e.output.results[*].output}}', {
            mode: 'fixed', stepLabelById: STEP_LABELS,
        }));
        const pill = host.querySelector(PILL_SELECTOR);
        expect(pill.textContent).toBe('gmail read▸ Output');
        expect(pill.textContent).not.toMatch(/act_f9aaff0e/);
        // The raw path stays reachable — on the tooltip, and in the data the
        // serializer reads back.
        expect(pill.title).toBe('steps.act_f9aaff0e.output.results[*].output');
        expect(pill.dataset.raw).toBe('{{steps.act_f9aaff0e.output.results[*].output}}');
    });

    it('is atomic — the caret cannot get inside it', () => {
        host.replaceChildren(buildFragment('{{trigger.output.subject}}', { mode: 'fixed' }));
        expect(host.querySelector(PILL_SELECTOR).getAttribute('contenteditable')).toBe('false');
    });

    it('names the trigger and the loop item rather than falling back to a path', () => {
        expect(buildPill({ source: 'trigger', fieldPath: 'subject', raw: '{{trigger.output.subject}}', path: 'trigger.output.subject' }).textContent)
            .toBe('Trigger▸ Subject');
        expect(buildPill({ source: 'loop', itemVar: 'item', fieldPath: '', raw: '{{loop.item}}', path: 'loop.item' }).textContent)
            .toBe('Loop item · item');
    });

    it('marks a reference to a deleted step instead of hiding it', () => {
        host.replaceChildren(buildFragment('{{steps.gone_99.output.x}}', { mode: 'fixed', stepLabelById: STEP_LABELS }));
        const pill = host.querySelector(PILL_SELECTOR);
        expect(pill.className).toMatch(/border-dashed/);
        expect(pill.title).toMatch(/no longer exists/);
    });
});

describe('serializeHost tolerates what a browser leaves behind', () => {
    it('skips the filler <br> that only exists to make a trailing line visible', () => {
        renderInto(host, 'one\n', { mode: 'fixed' });
        expect(host.querySelectorAll(`br[${FILLER_ATTR}]`)).toHaveLength(1);
        expect(serializeHost(host)).toBe('one\n');
    });

    it('gives a value ending in a pill somewhere to put the caret', () => {
        renderInto(host, 'Summarise {{steps.ai_1.output}}', { mode: 'fixed', stepLabelById: STEP_LABELS });
        expect(host.lastChild.nodeType).toBe(3);
        expect(serializeHost(host)).toBe('Summarise {{steps.ai_1.output}}');
    });

    it('reads a pasted <div> wrapper as a line break, not as lost text', () => {
        host.innerHTML = 'first<div>second</div><div>third</div>';
        expect(serializeHost(host)).toBe('first\nsecond\nthird');
    });

    it('does not open with a phantom newline when the whole value is wrapped', () => {
        host.innerHTML = '<div>only line</div>';
        expect(serializeHost(host)).toBe('only line');
    });

    it('keeps the text of an unrecognised wrapper', () => {
        host.innerHTML = 'plain <b>bold</b> text';
        expect(serializeHost(host)).toBe('plain bold text');
    });

    it('ensureTrailingFiller is idempotent', () => {
        renderInto(host, 'x\n', { mode: 'fixed' });
        ensureTrailingFiller(host);
        ensureTrailingFiller(host);
        expect(host.querySelectorAll(`br[${FILLER_ATTR}]`)).toHaveLength(1);
        expect(serializeHost(host)).toBe('x\n');
    });
});
