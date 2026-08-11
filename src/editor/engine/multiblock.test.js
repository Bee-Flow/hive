/**
 * Formatting commands must act on the whole selection.
 *
 * Several of them read only `selection.anchor` and quietly ignored the rest of
 * the range, so the user selected four lines, clicked a button, and got one line
 * formatted with no error (BFSF-315, BFSF-313).
 *
 * Run: cd agent-hub && npx vitest run src/editor/engine/multiblock.test.js
 */
import { describe, it, expect } from 'vitest';
import { markdownToAst } from '../serialization/mdToAst.js';
import { createState, applyTransform } from './state.js';
import { textSelection, pos } from './selection.js';
import { toggleList, setMarkAttrs } from './transforms.js';

const FOUR = 'one\n\ntwo\n\nthree\n\nfour';

const select = (s, fromPath, fromOff, toPath, toOff) => (
    { ...s, selection: textSelection(pos(fromPath, fromOff), pos(toPath, toOff)) }
);
const lists = (doc, type) => (doc.content || []).filter((n) => n.type === type);
const itemTexts = (list) => (list.content || []).map((it) => (
    (it.content?.[0]?.content || []).map((n) => n.text || '').join('')
));

describe('BFSF-315 — numbered list over a multi-line selection', () => {
    it('converts every selected line, not just the first', () => {
        let s = createState(markdownToAst(FOUR));
        s = select(s, [0], 0, [2], 5);
        s = applyTransform(s, (x) => toggleList(x, 'orderedList'));
        const ols = lists(s.doc, 'orderedList');
        expect(ols).toHaveLength(1);
        expect(itemTexts(ols[0])).toEqual(['one', 'two', 'three']);
    });

    it('produces ONE list, so numbering does not restart at 1 per line', () => {
        let s = createState(markdownToAst(FOUR));
        s = select(s, [0], 0, [3], 4);
        s = applyTransform(s, (x) => toggleList(x, 'orderedList'));
        expect(lists(s.doc, 'orderedList')).toHaveLength(1);
        expect(s.doc.content.filter((n) => n.type === 'paragraph' && n.content?.length)).toHaveLength(0);
    });

    it('re-applying to the following lines extends the same list', () => {
        let s = createState(markdownToAst(FOUR));
        s = select(s, [0], 0, [1], 3);
        s = applyTransform(s, (x) => toggleList(x, 'orderedList'));
        expect(itemTexts(lists(s.doc, 'orderedList')[0])).toEqual(['one', 'two']);

        // "three" is now the block right after the list.
        const threeIdx = s.doc.content.findIndex((n) => n.type === 'paragraph' && n.content?.[0]?.text === 'three');
        s = select(s, [threeIdx], 0, [threeIdx], 5);
        s = applyTransform(s, (x) => toggleList(x, 'orderedList'));

        const ols = lists(s.doc, 'orderedList');
        expect(ols).toHaveLength(1);
        expect(itemTexts(ols[0])).toEqual(['one', 'two', 'three']);
    });

    it('merges into a following list too', () => {
        let s = createState(markdownToAst(FOUR));
        s = select(s, [2], 0, [3], 4);
        s = applyTransform(s, (x) => toggleList(x, 'orderedList'));
        s = select(s, [1], 0, [1], 3);
        s = applyTransform(s, (x) => toggleList(x, 'orderedList'));
        const ols = lists(s.doc, 'orderedList');
        expect(ols).toHaveLength(1);
        expect(itemTexts(ols[0])).toEqual(['two', 'three', 'four']);
    });

    it('toggles the whole selection back off', () => {
        let s = createState(markdownToAst(FOUR));
        s = select(s, [0], 0, [2], 5);
        s = applyTransform(s, (x) => toggleList(x, 'orderedList'));
        s = select(s, [0, 0, 0], 0, [0, 2, 0], 5);
        s = applyTransform(s, (x) => toggleList(x, 'orderedList'));
        expect(lists(s.doc, 'orderedList')).toHaveLength(0);
        const paras = s.doc.content.filter((n) => n.type === 'paragraph');
        expect(paras.map((p) => p.content?.[0]?.text)).toContain('one');
        expect(paras.map((p) => p.content?.[0]?.text)).toContain('three');
    });

    it('converts a bullet list to a numbered list instead of nesting one inside it', () => {
        let s = createState(markdownToAst('- alpha\n- beta'));
        s = { ...s, selection: textSelection(pos([0, 0, 0], 0)) };
        s = applyTransform(s, (x) => toggleList(x, 'orderedList'));
        expect(lists(s.doc, 'orderedList')).toHaveLength(1);
        expect(lists(s.doc, 'bulletList')).toHaveLength(0);
        // The old fall-through spliced <ol> inside the <li>, one level deeper.
        expect(JSON.stringify(s.doc)).not.toContain('"bulletList"');
        expect(itemTexts(lists(s.doc, 'orderedList')[0])).toEqual(['alpha', 'beta']);
    });

    it('a single-line selection still works', () => {
        let s = createState(markdownToAst(FOUR));
        s = { ...s, selection: textSelection(pos([1], 1)) };
        s = applyTransform(s, (x) => toggleList(x, 'bulletList'));
        expect(itemTexts(lists(s.doc, 'bulletList')[0])).toEqual(['two']);
    });
});

describe('BFSF-313 — colour and font across a multi-block selection', () => {
    const colouredTokens = (block) => (block.content || []).filter((n) => (
        n.type === 'text' && (n.marks || []).some((m) => m.type === 'textStyle' && m.attrs?.color)
    ));

    it('applies a colour to every selected paragraph', () => {
        let s = createState(markdownToAst(FOUR));
        s = select(s, [0], 0, [2], 5);
        s = applyTransform(s, (x) => setMarkAttrs(x, 'textStyle', { color: '#ff0000' }));
        expect(colouredTokens(s.doc.content[0]).length).toBeGreaterThan(0);
        expect(colouredTokens(s.doc.content[1]).length).toBeGreaterThan(0);
        expect(colouredTokens(s.doc.content[2]).length).toBeGreaterThan(0);
        // Not the paragraph outside the selection.
        expect(colouredTokens(s.doc.content[3])).toHaveLength(0);
    });

    it('applies a font family across blocks', () => {
        let s = createState(markdownToAst(FOUR));
        s = select(s, [0], 0, [1], 3);
        s = applyTransform(s, (x) => setMarkAttrs(x, 'textStyle', { fontFamily: 'Georgia' }));
        const fonts = JSON.stringify(s.doc).match(/"fontFamily":"Georgia"/g) || [];
        expect(fonts.length).toBeGreaterThan(0);
        expect(JSON.stringify(s.doc.content[1])).toContain('Georgia');
    });

    it('honours the partial range at each end of the selection', () => {
        let s = createState(markdownToAst(FOUR));
        s = select(s, [0], 1, [1], 2);
        s = applyTransform(s, (x) => setMarkAttrs(x, 'textStyle', { color: '#00ff00' }));
        // "o|ne" — the first character keeps no colour.
        const first = s.doc.content[0].content;
        expect(first[0].text).toBe('o');
        expect((first[0].marks || []).some((m) => m.type === 'textStyle')).toBe(false);
    });

    it('clearing an attribute removes it across blocks', () => {
        let s = createState(markdownToAst(FOUR));
        s = select(s, [0], 0, [1], 3);
        s = applyTransform(s, (x) => setMarkAttrs(x, 'textStyle', { color: '#ff0000' }));
        s = select(s, [0], 0, [1], 3);
        s = applyTransform(s, (x) => setMarkAttrs(x, 'textStyle', { color: null }));
        expect(JSON.stringify(s.doc)).not.toContain('#ff0000');
    });

    it('a single-block selection still works', () => {
        let s = createState(markdownToAst(FOUR));
        s = select(s, [0], 0, [0], 3);
        s = applyTransform(s, (x) => setMarkAttrs(x, 'textStyle', { color: '#123456' }));
        expect(JSON.stringify(s.doc.content[0])).toContain('#123456');
    });
});
