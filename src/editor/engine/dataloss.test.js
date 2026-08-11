/**
 * Regression tests for the editor's data-loss and data-leak bugs.
 *
 * These are grouped deliberately: every case here is one where the editor
 * silently destroyed or exported content the user never asked it to touch, so
 * nothing failed loudly and nothing showed up in the other suites.
 *
 * Run: cd agent-hub && npx vitest run src/editor/engine/dataloss.test.js
 */
import { describe, it, expect, afterEach } from 'vitest';
import { markdownToAst } from '../serialization/mdToAst.js';
import { astToHtml } from '../serialization/astToHtml.js';
import { createState } from './state.js';
import { textSelection, pos } from './selection.js';
import { insertText } from './transforms.js';
import { EditorView } from './view.js';

let views = [];
const make = (md, opts = {}) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state: createState(markdownToAst(md)), ...opts });
    views.push({ view, host });
    return { view, host };
};
afterEach(() => { views.forEach(({ view, host }) => { view.destroy(); host.remove(); }); views = []; });

/** Minimal ClipboardEvent stand-in: records what the handler wrote. */
const clipboardEvent = () => {
    const data = {};
    return {
        written: data,
        preventDefault() { this.defaultPrevented = true; },
        defaultPrevented: false,
        clipboardData: { setData: (k, v) => { data[k] = v; }, getData: (k) => data[k] || '' },
    };
};

describe('undo history is scoped to the loaded document', () => {
    it('does not restore the previous document after setDoc', () => {
        const { view } = make('notebook A content');
        view.state = { ...view.state, selection: textSelection(pos([0], 18)) };
        view.dispatch((s) => insertText(s, '!'));
        expect(view.getText()).toContain('notebook A content!');

        // Switching notebooks replaces the document.
        view.setDoc(markdownToAst('notebook B content'), { emitUpdate: false });
        expect(view.getText()).toBe('notebook B content');

        view.undo();
        // Before the fix this restored notebook A's document — and the autosave,
        // which captures the notebook id AFTER the switch, then persisted it
        // over notebook B.
        expect(view.getText()).toBe('notebook B content');
        expect(view.getText()).not.toContain('notebook A');
    });

    it('reports nothing to undo straight after a document swap', () => {
        const { view } = make('first');
        view.state = { ...view.state, selection: textSelection(pos([0], 5)) };
        view.dispatch((s) => insertText(s, 'x'));
        expect(view.can().undo()).toBe(true);
        view.setDoc(markdownToAst('second'), { emitUpdate: false });
        expect(view.can().undo()).toBe(false);
    });

    it('still supports undo for edits made after the swap', () => {
        const { view } = make('first');
        view.setDoc(markdownToAst('second'), { emitUpdate: false });
        view.state = { ...view.state, selection: textSelection(pos([0], 6)) };
        view.dispatch((s) => insertText(s, '!'));
        expect(view.getText()).toBe('second!');
        view.undo();
        expect(view.getText()).toBe('second');
    });
});

describe('copy carries the selection, not the document', () => {
    const doc = 'alpha\n\nbravo\n\ncharlie\n\ndelta';

    it('a cross-paragraph selection copies only the selected blocks', () => {
        const { view } = make(doc);
        // from "bravo" through "charlie"
        view.state = { ...view.state, selection: textSelection(pos([1], 0), pos([2], 7)) };
        const e = clipboardEvent();
        view.onCopyCut(e, false);
        const text = e.written['text/plain'];
        expect(text).toContain('bravo');
        expect(text).toContain('charlie');
        // The whole-document leak: these must NOT be on the clipboard.
        expect(text).not.toContain('alpha');
        expect(text).not.toContain('delta');
    });

    it('truncates the first and last block to the selected range', () => {
        const { view } = make(doc);
        view.state = { ...view.state, selection: textSelection(pos([1], 2), pos([2], 4)) };
        const e = clipboardEvent();
        view.onCopyCut(e, false);
        expect(e.written['text/plain']).toBe('avo\nchar');
    });

    it('emits text/html for a cross-block selection too', () => {
        const { view } = make(doc);
        view.state = { ...view.state, selection: textSelection(pos([1], 0), pos([2], 7)) };
        const e = clipboardEvent();
        view.onCopyCut(e, false);
        const html = e.written['text/html'];
        expect(html).toContain('bravo');
        expect(html).not.toContain('alpha');
    });

    it('a single-block selection is unchanged', () => {
        const { view } = make(doc);
        view.state = { ...view.state, selection: textSelection(pos([0], 0), pos([0], 5)) };
        const e = clipboardEvent();
        view.onCopyCut(e, false);
        expect(e.written['text/plain']).toBe('alpha');
    });

    it('cut removes exactly what it copied', () => {
        const { view } = make(doc);
        view.state = { ...view.state, selection: textSelection(pos([0], 0), pos([0], 5)) };
        const e = clipboardEvent();
        view.onCopyCut(e, true);
        expect(e.written['text/plain']).toBe('alpha');
        expect(view.getText()).toContain('bravo');
        expect(view.getText()).toContain('delta');
    });
});

describe('inline formulas survive serialization', () => {
    const cell = (inline) => ({
        type: 'doc',
        content: [{
            type: 'table',
            content: [{ type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: inline }] }] }],
        }],
    });

    it('keeps a formula that shares its cell with text', () => {
        const html = astToHtml(cell([
            { type: 'formula', attrs: { src: '=A1*B1', value: '42' } },
            { type: 'text', text: ' total' },
        ]));
        expect(html).toContain('=A1*B1');
        expect(html).toContain('total');
    });

    it('keeps a formula followed by a hard break', () => {
        const html = astToHtml(cell([
            { type: 'formula', attrs: { src: '=SUM(A1:A3)', value: '9' } },
            { type: 'hardBreak' },
        ]));
        expect(html).toContain('=SUM(A1:A3)');
    });

    it('escapes the formula source into the attribute', () => {
        const html = astToHtml(cell([
            { type: 'formula', attrs: { src: '=A1&"<script>"', value: 'x' } },
            { type: 'text', text: '!' },
        ]));
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });
});
