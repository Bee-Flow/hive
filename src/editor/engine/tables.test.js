import { describe, it, expect } from 'vitest';
import {
  makeTable, appendRow, appendColumn, toggleHeaderRow,
  addRowAfter, addColumnAfter, deleteRow, deleteColumn,
} from './tables.js';
import { textSelection, pos } from './selection.js';
import { getNode } from './doc.js';

// A state whose caret sits in cell [row,col] of a single table at doc index 0.
function tableState(rows, cols, header = true, row = 0, col = 0) {
  const doc = { type: 'doc', content: [makeTable(rows, cols, header)] };
  return { doc, selection: textSelection(pos([0, row, col, 0], 0)), storedMarks: null };
}
const tbl = (state) => getNode(state.doc, [0]);

describe('tables structural helpers', () => {
  it('appendRow adds a row at the end with the same column count', () => {
    const out = appendRow(tableState(2, 3));
    expect(tbl(out).content.length).toBe(3);
    expect(tbl(out).content[2].content.length).toBe(3);
  });

  it('appendColumn adds a cell to every row', () => {
    const out = appendColumn(tableState(2, 3));
    expect(tbl(out).content.every((r) => r.content.length === 4)).toBe(true);
  });

  it('appendColumn keeps the header flag on the new first-row cell only', () => {
    const out = appendColumn(tableState(2, 3, true));
    expect(tbl(out).content[0].content[3].attrs?.header).toBe(true);
    expect(tbl(out).content[1].content[3].attrs?.header).toBeFalsy();
  });

  it('appendColumn on a header-less table adds plain cells', () => {
    const out = appendColumn(tableState(2, 3, false));
    expect(tbl(out).content[0].content[3].attrs?.header).toBeFalsy();
  });

  it('toggleHeaderRow flips the first-row header flag both ways', () => {
    const off = toggleHeaderRow(tableState(2, 3, true));
    expect(tbl(off).content[0].content.every((c) => !c.attrs?.header)).toBe(true);
    const on = toggleHeaderRow(off);
    expect(tbl(on).content[0].content.every((c) => c.attrs?.header === true)).toBe(true);
  });

  it('addRowAfter / addColumnAfter still insert relative to the caret cell', () => {
    expect(tbl(addRowAfter(tableState(2, 2))).content.length).toBe(3);
    expect(tbl(addColumnAfter(tableState(2, 2))).content[0].content.length).toBe(3);
  });

  it('deleteRow / deleteColumn shrink the table', () => {
    expect(tbl(deleteRow(tableState(3, 3))).content.length).toBe(2);
    expect(tbl(deleteColumn(tableState(3, 3))).content[0].content.length).toBe(2);
  });
});
