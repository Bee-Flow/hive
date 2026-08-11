import { describe, it, expect } from 'vitest';
import { markdownToAst } from '../serialization/mdToAst.js';
import { astToMarkdown } from '../serialization/astToMd.js';
import { createState, applyTransform } from './state.js';
import { textSelection, pos } from './selection.js';
import { insertText } from './transforms.js';
import { runInputRules } from './inputRules.js';

// Simulate typing a trigger char: insertText then runInputRules.
function type(state, ch) {
  return applyTransform(state, (s) => {
    const ns = insertText(s, ch);
    return runInputRules(ns, ch) || ns;
  });
}
const start = (md, offset) => ({ ...createState(markdownToAst(md)), selection: textSelection(pos([0], offset)) });
const toMd = (s) => astToMarkdown(s.doc).trim();

describe('input rules', () => {
  it('# + space → heading 1', () => {
    let s = start('#', 1);
    s = type(s, ' ');
    expect(s.doc.content[0].type).toBe('heading');
    expect(s.doc.content[0].attrs?.level ?? 1).toBe(1);
  });

  it('## + space → heading 2', () => {
    let s = start('##', 2);
    s = type(s, ' ');
    expect(s.doc.content[0].attrs.level).toBe(2);
  });

  it('- + space → bullet list', () => {
    let s = start('-', 1);
    s = type(s, ' ');
    expect(s.doc.content[0].type).toBe('bulletList');
  });

  it('1. + space → ordered list', () => {
    let s = start('1.', 2);
    s = type(s, ' ');
    expect(s.doc.content[0].type).toBe('orderedList');
  });

  it('> + space → blockquote', () => {
    let s = start('>', 1);
    s = type(s, ' ');
    expect(s.doc.content[0].type).toBe('blockquote');
  });

  it('-- → en dash', () => {
    let s = start('a-', 2);
    s = type(s, '-');
    expect(s.doc.content[0].content[0].text).toBe('a–');
  });

  it('... → ellipsis', () => {
    let s = start('a..', 3);
    s = type(s, '.');
    expect(s.doc.content[0].content[0].text).toBe('a…');
  });

  it('smart quotes open/close', () => {
    let s = start('', 0);
    s = type(s, '"');
    expect(s.doc.content[0].content[0].text).toBe('“');
  });

  it(':rocket: → 🚀 emoji shortcode', () => {
    let s = start('go :rocket', 10);
    s = type(s, ':');
    expect(s.doc.content[0].content[0].text).toBe('go 🚀');
  });

  it('collapsed setColor stores the mark for the next typed text', () => {
    const { setMarkAttrs, insertText } = require('./transforms.js');
    let s = start('', 0);
    s = applyTransform(s, (x) => setMarkAttrs(x, 'textStyle', { color: '#ef4444' }));
    s = applyTransform(s, (x) => insertText(x, 'red'));
    const textNode = s.doc.content[0].content[0];
    expect(textNode.marks.find((m) => m.type === 'textStyle')?.attrs.color).toBe('#ef4444');
  });
});

describe('table formula input rule', () => {
  // Row 1 (data): cell A holds "1", cell B is empty.
  const tableMd = '| a | b |\n| - | - |\n| 1 |  |';
  const inCell = (r, c) => ({
    ...createState(markdownToAst(tableMd)),
    selection: textSelection(pos([0, r, c, 0], 0)),
  });

  it("'=' at the start of a non-empty cell does nothing destructive", () => {
    let s = inCell(1, 0);
    s = type(s, '=');                          // caret before the "1"
    const cell = s.doc.content[0].content[1].content[0];
    expect(cell.content[0].content.some((n) => n.type === 'formula')).toBe(false);
    expect(cell.content[0].content.map((n) => n.text || '').join('')).toBe('=1');
  });

  it("'=' in an empty cell still creates the formula", () => {
    let s = inCell(1, 1);
    s = type(s, '=');
    const cell = s.doc.content[0].content[1].content[1];
    expect(cell.content[0].content[0].type).toBe('formula');
    expect(cell.content[0].content[0].attrs.src).toBe('=');
  });
});
