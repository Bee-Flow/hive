/**
 * tables.js — table model helpers + structural commands.
 *
 * Tables ship with the constrained feature set the toolbar exposes: insert,
 * add/delete row & column, delete table. Cell-rectangle selection and drag
 * column-resize are deferred (see plan risk notes).
 */
import { getNode, updateAt, parentPath } from './doc.js';
import { node, emptyParagraph } from '../model/nodes.js';
import { textSelection, nodeSelection, pos, isText, isNode, isCell } from './selection.js';
import { inlineToTokens } from './inline.js';
import { isTextblock } from '../model/schema.js';

const st = (doc, selection) => ({ doc, selection, storedMarks: null });

export function makeCell(header) {
  return node('tableCell', header ? { header: true } : null, [emptyParagraph()]);
}
export function makeRow(cols, header) {
  return node('tableRow', null, Array.from({ length: cols }, () => makeCell(header)));
}
export function makeTable(rows, cols, withHeaderRow) {
  const out = [];
  for (let r = 0; r < rows; r++) out.push(makeRow(cols, withHeaderRow && r === 0));
  return node('table', null, out);
}

/** Find { tablePath, rowIdx, cellIdx } for a selection path inside a table. */
export function tableContext(doc, path) {
  for (let i = 0; i < path.length; i++) {
    const p = path.slice(0, i + 1);
    if (getNode(doc, p).type === 'table') {
      return { tablePath: p, rowIdx: path[i + 1] ?? 0, cellIdx: path[i + 2] ?? 0 };
    }
  }
  return null;
}

function ctxFromState(state) {
  const sel = state.selection;
  const path = isText(sel) ? sel.anchor.path : isNode(sel) ? sel.path : isCell(sel) ? sel.anchorCell : null;
  if (!path) return null;
  return tableContext(state.doc, path);
}

export function addRowAfter(state) { return addRow(state, 1); }
export function addRowBefore(state) { return addRow(state, 0); }

function addRow(state, after) {
  const ctx = ctxFromState(state);
  if (!ctx) return state;
  const table = getNode(state.doc, ctx.tablePath);
  const cols = table.content[0]?.content.length || 1;
  const newRow = makeRow(cols, false);
  const doc2 = updateAt(state.doc, ctx.tablePath, (t) => {
    const content = t.content.slice();
    content.splice(ctx.rowIdx + after, 0, newRow);
    return { ...t, content };
  });
  const newRowIdx = ctx.rowIdx + after;
  return st(doc2, textSelection(pos([...ctx.tablePath, newRowIdx, 0, 0], 0)));
}

export function addColumnAfter(state) { return addColumn(state, 1); }
export function addColumnBefore(state) { return addColumn(state, 0); }

function addColumn(state, after) {
  const ctx = ctxFromState(state);
  if (!ctx) return state;
  const at = ctx.cellIdx + after;
  const doc2 = updateAt(state.doc, ctx.tablePath, (t) => {
    const content = t.content.map((row) => {
      const cells = row.content.slice();
      const header = cells[ctx.cellIdx]?.attrs?.header || false;
      cells.splice(at, 0, makeCell(header && row === t.content[0]));
      return { ...row, content: cells };
    });
    return { ...t, content };
  });
  return st(doc2, textSelection(pos([...ctx.tablePath, ctx.rowIdx, at, 0], 0)));
}

/** Append a row at the end of the table containing the selection. */
export function appendRow(state) {
  const ctx = ctxFromState(state);
  if (!ctx) return state;
  const table = getNode(state.doc, ctx.tablePath);
  const cols = table.content[0]?.content.length || 1;
  const newRow = makeRow(cols, false);
  const doc2 = updateAt(state.doc, ctx.tablePath, (t) => ({ ...t, content: [...t.content, newRow] }));
  const newRowIdx = getNode(doc2, ctx.tablePath).content.length - 1;
  return st(doc2, textSelection(pos([...ctx.tablePath, newRowIdx, 0, 0], 0)));
}

/** Append a column at the right edge of the table containing the selection. */
export function appendColumn(state) {
  const ctx = ctxFromState(state);
  if (!ctx) return state;
  const doc2 = updateAt(state.doc, ctx.tablePath, (t) => {
    const headerRow = !!t.content[0]?.content?.[0]?.attrs?.header;
    return {
      ...t,
      content: t.content.map((row, r) => ({ ...row, content: [...row.content, makeCell(r === 0 && headerRow)] })),
    };
  });
  const lastCol = getNode(doc2, ctx.tablePath).content[ctx.rowIdx].content.length - 1;
  return st(doc2, textSelection(pos([...ctx.tablePath, ctx.rowIdx, lastCol, 0], 0)));
}

/** Insert a block node immediately after the table containing the selection. */
export function insertAfterTable(state, blockNode) {
  const ctx = ctxFromState(state);
  if (!ctx || !blockNode) return state;
  const pPath = parentPath(ctx.tablePath);
  const idx = ctx.tablePath[ctx.tablePath.length - 1];
  const doc2 = updateAt(state.doc, pPath, (par) => {
    const content = par.content.slice();
    content.splice(idx + 1, 0, blockNode);
    return { ...par, content };
  });
  return st(doc2, nodeSelection([...pPath, idx + 1]));
}

/** Replace the current cell's content with a single formula atom (=…). */
export function setCellFormula(state, src) {
  const ctx = ctxFromState(state);
  if (!ctx) return state;
  const cellPath = [...ctx.tablePath, ctx.rowIdx, ctx.cellIdx];
  const doc2 = updateAt(state.doc, cellPath, (cell) => node('tableCell', cell.attrs || null, [
    node('paragraph', null, [node('formula', { src: src || '=' })]),
  ]));
  return st(doc2, textSelection(pos([...cellPath, 0], 0)));
}

/** Toggle whether the first row of the current table is a header row. */
export function toggleHeaderRow(state) {
  const ctx = ctxFromState(state);
  if (!ctx) return state;
  const table = getNode(state.doc, ctx.tablePath);
  const currentlyHeader = !!table.content[0]?.content?.[0]?.attrs?.header;
  const doc2 = updateAt(state.doc, ctx.tablePath, (t) => ({
    ...t,
    content: t.content.map((row, r) => (r === 0
      ? { ...row, content: row.content.map((cell) => node('tableCell', { ...(cell.attrs || {}), header: !currentlyHeader }, cell.content)) }
      : row)),
  }));
  return st(doc2, state.selection);
}

export function deleteRow(state) {
  const ctx = ctxFromState(state);
  if (!ctx) return state;
  const table = getNode(state.doc, ctx.tablePath);
  if (table.content.length <= 1) return deleteTable(state);
  const doc2 = updateAt(state.doc, ctx.tablePath, (t) => {
    const content = t.content.slice();
    content.splice(ctx.rowIdx, 1);
    return { ...t, content };
  });
  const row = Math.min(ctx.rowIdx, getNode(doc2, ctx.tablePath).content.length - 1);
  return st(doc2, textSelection(pos([...ctx.tablePath, row, 0, 0], 0)));
}

export function deleteColumn(state) {
  const ctx = ctxFromState(state);
  if (!ctx) return state;
  const table = getNode(state.doc, ctx.tablePath);
  if ((table.content[0]?.content.length || 0) <= 1) return deleteTable(state);
  const doc2 = updateAt(state.doc, ctx.tablePath, (t) => ({
    ...t,
    content: t.content.map((row) => {
      const cells = row.content.slice();
      cells.splice(ctx.cellIdx, 1);
      return { ...row, content: cells };
    }),
  }));
  const col = Math.max(0, ctx.cellIdx - 1);
  return st(doc2, textSelection(pos([...ctx.tablePath, ctx.rowIdx, col, 0], 0)));
}

export function deleteTable(state) {
  const ctx = ctxFromState(state);
  if (!ctx) return state;
  const pPath = parentPath(ctx.tablePath);
  const idx = ctx.tablePath[ctx.tablePath.length - 1];
  const doc2 = updateAt(state.doc, pPath, (par) => {
    const content = par.content.slice();
    content.splice(idx, 1, emptyParagraph());
    return { ...par, content };
  });
  return st(doc2, textSelection(pos([...pPath, idx], 0)));
}

/** Move the caret to the next/prev cell, creating a row when tabbing past the end. */
export function goToCell(state, dir) {
  const ctx = ctxFromState(state);
  if (!ctx) return state;
  const table = getNode(state.doc, ctx.tablePath);
  const rows = table.content.length;
  const cols = table.content[0].content.length;
  let r = ctx.rowIdx, c = ctx.cellIdx + dir;
  if (c >= cols) { c = 0; r += 1; }
  if (c < 0) { c = cols - 1; r -= 1; }
  if (r >= rows) return addRowAfter(state);
  if (r < 0) return state;
  return st(state.doc, textSelection(pos([...ctx.tablePath, r, c, 0], 0)));
}

export function inTable(state) {
  return !!ctxFromState(state);
}

/* ── cell-rectangle selection helpers ───────────────────── */

/** The rectangle spanned by a cell selection: { tablePath, minR, maxR, minC, maxC, cells:[cellPath] }. */
export function cellRect(doc, sel) {
  if (!isCell(sel)) return null;
  const a = cellCoords(doc, sel.anchorCell);
  const b = cellCoords(doc, sel.headCell);
  if (!a || !b || a.tablePath.join() !== b.tablePath.join()) return null;
  const minR = Math.min(a.r, b.r); const maxR = Math.max(a.r, b.r);
  const minC = Math.min(a.c, b.c); const maxC = Math.max(a.c, b.c);
  const cells = [];
  for (let r = minR; r <= maxR; r++) for (let c = minC; c <= maxC; c++) cells.push([...a.tablePath, r, c]);
  return { tablePath: a.tablePath, minR, maxR, minC, maxC, cells };
}

function cellCoords(doc, cellPath) {
  const ctx = tableContext(doc, cellPath);
  if (!ctx) return null;
  return { tablePath: ctx.tablePath, r: ctx.rowIdx, c: ctx.cellIdx };
}

/** Clear the text content of every cell in the current cell selection. */
export function clearCells(state) {
  const rect = cellRect(state.doc, state.selection);
  if (!rect) return state;
  let doc2 = state.doc;
  for (const cellPath of rect.cells) {
    doc2 = updateAt(doc2, cellPath, (cell) => ({ ...cell, content: [emptyParagraph()] }));
  }
  return st(doc2, state.selection);
}

/** Set text alignment on the current cell (text selection) or all selected cells. */
export function setCellAlign(state, align) {
  const sel = state.selection;
  let cellPaths = [];
  if (isCell(sel)) {
    const rect = cellRect(state.doc, sel);
    cellPaths = rect ? rect.cells : [];
  } else {
    const ctx = ctxFromState(state);
    if (ctx) cellPaths = [[...ctx.tablePath, ctx.rowIdx, ctx.cellIdx]];
  }
  if (!cellPaths.length) return state;
  let doc2 = state.doc;
  for (const p of cellPaths) {
    doc2 = updateAt(doc2, p, (cell) => node('tableCell', { ...(cell.attrs || {}), align: align === 'left' ? null : align }, cell.content));
  }
  return st(doc2, sel);
}

/** Set a column's width (px) on every cell in that column (per-cell, table-layout:fixed). */
export function setColumnWidth(state, colIdx, width) {
  const ctx = ctxFromState(state);
  if (!ctx) return state;
  const w = width ? Math.max(40, Math.round(width)) : null;
  const doc2 = updateAt(state.doc, ctx.tablePath, (t) => ({
    ...t,
    content: t.content.map((row) => ({
      ...row,
      content: row.content.map((cell, c) => (c === colIdx ? node('tableCell', { ...(cell.attrs || {}), colwidth: w }, cell.content) : cell)),
    })),
  }));
  return st(doc2, state.selection);
}

/** Plain-text (pipe-delimited) serialization of a table — used for clipboard. */
export function tableToText(table) {
  const rows = (table.content || []).map((row) => (row.content || []).map(cellText).join('\t'));
  return rows.join('\n');
}

/** Plain text of the cells in a rectangle (rows joined by newlines, cols by tabs). */
export function cellRectToText(doc, rect) {
  const lines = [];
  for (let r = rect.minR; r <= rect.maxR; r++) {
    const cols = [];
    for (let c = rect.minC; c <= rect.maxC; c++) cols.push(cellText(getNode(doc, [...rect.tablePath, r, c])));
    lines.push(cols.join('\t'));
  }
  return lines.join('\n');
}

function cellText(cell) {
  const parts = [];
  const walk = (n) => {
    if (!n) return;
    if (isTextblock(n.type)) { parts.push(inlineToTokens(n.content).filter((t) => !t.node).map((t) => t.ch).join('')); return; }
    (n.content || []).forEach(walk);
  };
  walk(cell);
  return parts.join(' ');
}
