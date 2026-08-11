/**
 * Inline atoms (inline math, table-cell formulas, inline images) must be
 * addressable by the node-view bridge.
 *
 * They were not: rebuildPaths stops descending at any textblock, so inline
 * atoms never entered nodeToPath, and updateAtom/selectAtom/deleteAtom all
 * early-returned on the missing path. Nothing threw — the node view's commit
 * simply did nothing and the input closed, showing the old value again. That is
 * BFSF-317 ("typing anything cancels the insertion") and it silently broke
 * table-cell formulas too.
 *
 * Run: cd agent-hub && npx vitest run src/editor/engine/inlineAtoms.test.js
 */
import { describe, it, expect, afterEach } from 'vitest';
import { markdownToAst } from '../serialization/mdToAst.js';
import { createState } from './state.js';
import { EditorView } from './view.js';
import { findInlineNode } from './transforms.js';

let views = [];
const make = (md, opts = {}) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state: createState(markdownToAst(md)), ...opts });
    views.push({ view, host });
    return { view, host };
};
afterEach(() => { views.forEach(({ view, host }) => { view.destroy(); host.remove(); }); views = []; });

const inlineMathNode = (view) => (view.state.doc.content[0].content || []).find((n) => n.type === 'mathInline');

describe('locating an inline atom', () => {
    it('finds it by identity with its block path and token offset', () => {
        const { view } = make('ab $x^2$ cd');
        const node = inlineMathNode(view);
        expect(node).toBeTruthy();
        const at = findInlineNode(view.state.doc, node);
        expect(at).toEqual({ path: [0], offset: 3 }); // after "ab "
    });

    it('returns null for a node that is not in the document', () => {
        const { view } = make('plain text');
        expect(findInlineNode(view.state.doc, { type: 'mathInline', attrs: {} })).toBe(null);
    });

    it('finds an atom nested inside a table cell', () => {
        const { view } = make('| a |\n| --- |\n| $y$ |');
        let found = null;
        const walk = (n) => {
            if (n.type === 'mathInline') { found = n; return; }
            (n.content || []).forEach(walk);
        };
        walk(view.state.doc);
        expect(found).toBeTruthy();
        expect(findInlineNode(view.state.doc, found)).toBeTruthy();
    });
});

describe('the node-view bridge reaches inline atoms', () => {
    it('updateAtom commits an edit instead of silently reverting', () => {
        const { view } = make('ab $x^2$ cd');
        const node = inlineMathNode(view);
        view.updateAtom(node, { latex: 'y^3' });
        expect(inlineMathNode(view).attrs.latex).toBe('y^3');
    });

    it('the edit is undoable', () => {
        const { view } = make('ab $x^2$ cd');
        view.updateAtom(inlineMathNode(view), { latex: 'y^3' });
        view.undo();
        expect(inlineMathNode(view).attrs.latex).toBe('x^2');
    });

    it('selectAtom selects exactly the atom', () => {
        const { view } = make('ab $x^2$ cd');
        const node = inlineMathNode(view);
        view.selectAtom(node);
        expect(view.getSelectedNode()).toBe(node);
        const sel = view.state.selection;
        expect(sel.type).toBe('text');
        expect(sel.head.offset - sel.anchor.offset).toBe(1);
    });

    it('deleteAtom removes it and leaves the surrounding text intact', () => {
        const { view } = make('ab $x^2$ cd');
        view.deleteAtom(inlineMathNode(view));
        expect(inlineMathNode(view)).toBeUndefined();
        expect(view.getText()).toBe('ab  cd');
    });

    it('block atoms keep working through the same bridge', () => {
        const { view } = make('![a](x.png)\n\nhello');
        const img = view.state.doc.content[0];
        expect(img.type).toBe('image');
        view.updateAtom(img, { width: 120 });
        expect(view.state.doc.content[0].attrs.width).toBe(120);
    });
});

describe('an atom host renders once', () => {
    it('emits no fallback children when a React portal will mount', () => {
        const { host } = make('![a](x.png)', { mountAtom: () => {}, unmountAtom: () => {}, remapAtom: () => {} });
        const atom = host.querySelector('[data-bf-atom]');
        expect(atom).toBeTruthy();
        // The portal owns the children; a fallback <img> here is the second copy
        // the user saw (BFSF-312).
        expect(atom.querySelector('img')).toBe(null);
        expect(atom.childNodes.length).toBe(0);
    });

    it('emits no placeholder text for a math atom when a portal will mount', () => {
        const { host } = make('ab $x^2$ cd', { mountAtom: () => {}, unmountAtom: () => {}, remapAtom: () => {} });
        const atom = host.querySelector('[data-bf-atom]');
        expect(atom.textContent).toBe('');
        // The identity attribute still goes on the host.
        expect(atom.getAttribute('data-latex')).toBe('x^2');
    });

    it('still emits fallback markup with no portal (export / plain DOM)', () => {
        const { host } = make('![a](x.png)');
        const atom = host.querySelector('[data-bf-atom]');
        expect(atom.querySelector('img')).toBeTruthy();
    });
});
