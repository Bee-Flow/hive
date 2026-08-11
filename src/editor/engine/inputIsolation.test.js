/**
 * Input isolation (S1): native events originating INSIDE an atom host — the
 * formula editor's <input> is portalled into a [data-bf-atom] wrapper inside a
 * table cell — must never be handled by the EditorView's document-level input
 * loop. Before the guard, every keystroke typed into the formula input was
 * preventDefault()ed (never appeared in the input) and dispatched as document
 * text at a stale caret: the swallowed formula text and the stray "k".
 *
 * Run: cd agent-hub && npx vitest run src/editor/engine/inputIsolation.test.js
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createState } from './state.js';
import { EditorView } from './view.js';

const cell = (text, attrs = null) => ({
    type: 'tableCell',
    attrs,
    content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
});
const formulaCell = (src) => ({
    type: 'tableCell',
    content: [{ type: 'paragraph', content: [{ type: 'formula', attrs: { src } }] }],
});
const row = (...cells) => ({ type: 'tableRow', content: cells });
const doc = () => ({
    type: 'doc',
    content: [{
        type: 'table',
        content: [
            row(cell('Item', { header: true }), cell('Qty', { header: true })),
            row(cell('Bolt'), cell('4')),
            row(formulaCell('=B2'), cell('10')),
        ],
    }],
});

let views = [];
const make = () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state: createState(doc()) });
    views.push({ view, host });
    return { view, host };
};
afterEach(() => { views.forEach(({ view, host }) => { view.destroy(); host.remove(); }); views = []; });

/** An <input> living inside the formula atom's [data-bf-atom] wrapper. */
function mountAtomInput(host) {
    const atomEl = host.querySelector('[data-bf-atom="formula"]');
    expect(atomEl).toBeTruthy();
    const input = document.createElement('input');
    atomEl.appendChild(input);
    return input;
}

/** beforeinput with inputType/data even where jsdom's InputEvent lacks them. */
function beforeInputEvent(data) {
    let e;
    try {
        e = new InputEvent('beforeinput', { data, inputType: 'insertText', bubbles: true, cancelable: true });
    } catch (_) {
        e = new Event('beforeinput', { bubbles: true, cancelable: true });
    }
    if (e.inputType !== 'insertText') Object.defineProperty(e, 'inputType', { value: 'insertText' });
    if (e.data !== data) Object.defineProperty(e, 'data', { value: data });
    return e;
}

function pasteEvent() {
    try {
        return new ClipboardEvent('paste', { bubbles: true, cancelable: true });
    } catch (_) {
        return new Event('paste', { bubbles: true, cancelable: true });
    }
}

describe('events from inside an atom never touch the document', () => {
    it('keydown Enter is ignored (no hard break, not defaultPrevented)', () => {
        const { view, host } = make();
        const input = mountAtomInput(host);
        const before = view.state.doc;
        const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        input.dispatchEvent(e);
        expect(view.state.doc).toBe(before);
        expect(e.defaultPrevented).toBe(false);
    });

    it('beforeinput insertText "k" is ignored (no stray character in the doc)', () => {
        const { view, host } = make();
        const input = mountAtomInput(host);
        const before = view.state.doc;
        const e = beforeInputEvent('k');
        input.dispatchEvent(e);
        expect(view.state.doc).toBe(before);
        expect(e.defaultPrevented).toBe(false);
        expect(JSON.stringify(view.state.doc)).not.toContain('"k"');
    });

    it('paste is left to the atom input (not defaultPrevented)', () => {
        const { view, host } = make();
        const input = mountAtomInput(host);
        const before = view.state.doc;
        const e = pasteEvent();
        input.dispatchEvent(e);
        expect(view.state.doc).toBe(before);
        expect(e.defaultPrevented).toBe(false);
    });

    it('mousedown inside the input picks NO reference while ref-picking is armed', () => {
        const { view, host } = make();
        const input = mountAtomInput(host);
        const before = view.state.doc;
        const picked = [];
        view.beginRefPick({ tablePath: [0], onPick: (r) => picked.push(r) });
        const e = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        input.dispatchEvent(e);
        expect(picked).toEqual([]);                 // no self-reference inserted
        expect(e.defaultPrevented).toBe(false);     // the input keeps its caret
        expect(view.state.doc).toBe(before);
    });

    // Control: the same event dispatched from NORMAL cell content still reaches
    // the editor — proves the isolation assertions above are not vacuous.
    it('beforeinput from regular cell content is still handled by the editor', () => {
        const { view, host } = make();
        const before = view.state.doc;
        const p = host.querySelector('th p, td p');
        expect(p).toBeTruthy();
        const e = beforeInputEvent('k');
        p.dispatchEvent(e);
        expect(e.defaultPrevented).toBe(true);
        expect(view.state.doc).not.toBe(before);
    });
});
