import { describe, it, expect } from 'vitest';
import { markdownToAst } from '../serialization/mdToAst.js';
import { astToMarkdown } from '../serialization/astToMd.js';
import { createState, applyTransform } from './state.js';
import { textSelection, pos } from './selection.js';
import * as T from './transforms.js';
import { makeTable } from './tables.js';

const stateFrom = (md) => createState(markdownToAst(md));
const toMd = (state) => astToMarkdown(state.doc).trim();
const sel = (state, anchor, head) => ({ ...state, selection: textSelection(anchor, head || anchor) });

describe('insertText', () => {
  it('inserts at the caret', () => {
    let s = sel(stateFrom('ab'), pos([0], 1));
    s = applyTransform(s, (x) => T.insertText(x, 'X'));
    expect(toMd(s)).toBe('aXb');
  });

  it('replaces a selection', () => {
    let s = sel(stateFrom('abcd'), pos([0], 1), pos([0], 3));
    s = applyTransform(s, (x) => T.insertText(x, 'X'));
    expect(toMd(s)).toBe('aXd');
  });

  it('applies a stored mark to typed text', () => {
    let s = sel(stateFrom('x'), pos([0], 1));
    s = applyTransform(s, (x) => T.toggleMark(x, 'bold'));
    s = applyTransform(s, (x) => T.insertText(x, 'Y'));
    expect(toMd(s)).toBe('x**Y**');
  });
});

describe('splitBlock (Enter)', () => {
  it('splits a paragraph', () => {
    let s = sel(stateFrom('abc'), pos([0], 1));
    s = applyTransform(s, T.splitBlock);
    expect(toMd(s)).toBe('a\n\nbc');
  });

  it('heading splits into heading + paragraph', () => {
    let s = sel(stateFrom('# Title'), pos([0], 5));
    s = applyTransform(s, T.splitBlock);
    expect(s.doc.content).toHaveLength(2);
    expect(s.doc.content[0].type).toBe('heading');
    expect(s.doc.content[1].type).toBe('paragraph');
    expect(s.selection.anchor.path).toEqual([1]);
  });

  it('splits a list item into two items', () => {
    let s = sel(stateFrom('- one'), pos([0, 0, 0], 3));
    s = applyTransform(s, T.splitBlock);
    expect(toMd(s)).toBe('- one\n-');
  });
});

describe('deletion & merging', () => {
  it('backspace at block start merges with the previous block', () => {
    let s = sel(stateFrom('a\n\nb'), pos([1], 0));
    s = applyTransform(s, T.deleteBackward);
    expect(toMd(s)).toBe('ab');
  });

  it('deletes a multi-block selection (same parent)', () => {
    let s = sel(stateFrom('hello\n\nworld'), pos([0], 2), pos([1], 3));
    s = applyTransform(s, T.deleteSelection);
    expect(toMd(s)).toBe('held');
  });

  it('backspace deletes one character', () => {
    let s = sel(stateFrom('abc'), pos([0], 2));
    s = applyTransform(s, T.deleteBackward);
    expect(toMd(s)).toBe('ac');
  });
});

describe('marks', () => {
  it('toggles bold over a range', () => {
    let s = sel(stateFrom('hello'), pos([0], 0), pos([0], 5));
    s = applyTransform(s, (x) => T.toggleMark(x, 'bold'));
    expect(toMd(s)).toBe('**hello**');
  });

  it('toggles bold off when the range is already bold', () => {
    let s = sel(stateFrom('**hello**'), pos([0], 0), pos([0], 5));
    s = applyTransform(s, (x) => T.toggleMark(x, 'bold'));
    expect(toMd(s)).toBe('hello');
  });
});

describe('block types', () => {
  it('sets a heading', () => {
    let s = sel(stateFrom('hello'), pos([0], 1));
    s = applyTransform(s, (x) => T.setBlockType(x, 'heading', { level: 2 }));
    expect(toMd(s)).toBe('## hello');
  });

  it('toggles a heading back to paragraph', () => {
    let s = sel(stateFrom('## hello'), pos([0], 1));
    s = applyTransform(s, (x) => T.toggleBlockType(x, 'heading', { level: 2 }));
    expect(toMd(s)).toBe('hello');
  });

  it('sets text alignment', () => {
    let s = sel(stateFrom('hello'), pos([0], 1));
    s = applyTransform(s, (x) => T.setTextAlign(x, 'center'));
    expect(toMd(s)).toBe('hello {align=center}');
  });
});

describe('lists & blockquote', () => {
  it('wraps a paragraph into a bullet list', () => {
    let s = sel(stateFrom('item'), pos([0], 1));
    s = applyTransform(s, (x) => T.toggleList(x, 'bulletList'));
    expect(toMd(s)).toBe('- item');
  });

  it('lifts a list item back to a paragraph', () => {
    let s = sel(stateFrom('- item'), pos([0, 0, 0], 1));
    s = applyTransform(s, (x) => T.toggleList(x, 'bulletList'));
    expect(toMd(s)).toBe('item');
  });

  it('wraps into a blockquote', () => {
    let s = sel(stateFrom('quote'), pos([0], 1));
    s = applyTransform(s, T.toggleBlockquote);
    expect(toMd(s)).toBe('> quote');
  });

  it('sinks a second list item under the first', () => {
    let s = sel(stateFrom('- a\n- b'), pos([0, 1, 0], 1));
    s = applyTransform(s, T.sinkListItem);
    expect(toMd(s)).toBe('- a\n  - b');
  });
});

describe('atom insertion', () => {
  it('inserts a block image and selects it', () => {
    let s = sel(stateFrom('text'), pos([0], 4));
    s = applyTransform(s, (x) => T.insertBlockNode(x, { type: 'image', attrs: { src: 'x.png' } }));
    expect(s.selection.type).toBe('node');
    expect(toMd(s)).toContain('![](x.png)');
  });
});

describe('tables inserted inside a cell route after the host table (S8)', () => {
  const tableMd = '| a | b |\n| - | - |\n| 1 | 2 |';
  const cellsContainType = (tblNode, type) => (tblNode.content || []).some(
    (r) => (r.content || []).some((c) => JSON.stringify(c).includes(`"${type}"`)),
  );

  it('insideTableCell detects cell descendants only', () => {
    const s = stateFrom(tableMd);
    expect(T.insideTableCell(s.doc, [0, 1, 0, 0])).toBe(true);   // paragraph in a cell
    expect(T.insideTableCell(s.doc, [0])).toBe(false);           // the table itself
    const p = stateFrom('plain');
    expect(T.insideTableCell(p.doc, [0])).toBe(false);
  });

  it('insertBlockNode(table) with the caret in a cell lands after the table', () => {
    let s = sel(stateFrom(tableMd), pos([0, 1, 0, 0], 1));
    s = applyTransform(s, (x) => T.insertBlockNode(x, makeTable(2, 2, true)));
    expect(s.doc.content.filter((n) => n.type === 'table')).toHaveLength(2);
    expect(cellsContainType(s.doc.content[0], 'table')).toBe(false);  // no nesting
    expect(s.doc.content[1].type).toBe('table');
    // Caret continues inside the NEW table, not in the host cell.
    expect(s.selection.type).toBe('text');
    expect(s.selection.anchor.path[0]).toBe(1);
  });

  it('insertBlocks with a table among the blocks routes ALL of them after the table', () => {
    let s = sel(stateFrom(tableMd), pos([0, 1, 0, 0], 1));
    const blocks = [
      { type: 'paragraph', content: [{ type: 'text', text: 'caption' }] },
      makeTable(2, 2, false),
    ];
    s = applyTransform(s, (x) => T.insertBlocks(x, blocks));
    expect(s.doc.content.slice(0, 3).map((n) => n.type)).toEqual(['table', 'paragraph', 'table']);
    expect(cellsContainType(s.doc.content[0], 'table')).toBe(false);
    // The host cell kept its own text; the caption did not leak into it.
    expect(JSON.stringify(s.doc.content[0])).not.toContain('caption');
    expect(s.doc.content[1].content[0].text).toBe('caption');
  });

  it('a table insert with the caret OUTSIDE any cell is unchanged behaviour', () => {
    let s = sel(stateFrom('para'), pos([0], 4));
    s = applyTransform(s, (x) => T.insertBlockNode(x, makeTable(2, 2, true)));
    expect(s.doc.content[1].type).toBe('table');
  });
});
