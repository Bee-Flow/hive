/**
 * tables.js — table model helpers + structural commands.
 *
 * MERGED CELLS: every structural operation here works in VISUAL grid
 * coordinates, not array indices. colspan/rowspan are supported everywhere else
 * in the stack (schema, htmlToAst, render, reconcile, astToHtml, astToMd's
 * `{cs= rs=}` marker) but this module used to treat a row's array index as its
 * column number. In any table with a merged cell that meant: deleting a row left
 * a rowspan overflowing the table, adding a column slid data under the wrong
 * header, deleting a column silently did nothing on short rows, and Tab skipped
 * cells while appending endless new rows.
 */
import { getNode, updateAt, parentPath } from './doc.js';
import { node, emptyParagraph } from '../model/nodes.js';
import { textSelection, nodeSelection, cellSelection, pos, isText, isNode, isCell } from './selection.js';
import { inlineToTokens } from './inline.js';
import { isTextblock } from '../model/schema.js';
import { colLabel } from './formulaRefs.js';
import { remapFormulasInTable } from './formulaRemap.js';

const st = (doc, selection) => ({ doc, selection, storedMarks: null });

/* ── visual grid ────────────────────────────────────────── */

const spanOf = (cell) => ({
  cs: Math.max(1, parseInt(cell?.attrs?.colspan, 10) || 1),
  rs: Math.max(1, parseInt(cell?.attrs?.rowspan, 10) || 1),
});

/**
 * Expand a table into its visual grid.
 *
 * `grid[r][c]` is `{ cell, rowIdx, cellIdx, originR, originC }` — the cell that
 * OCCUPIES that visual slot. A merged cell repeats the same entry across every
 * slot it covers, so a visual column can always be mapped back to the array
 * index that actually holds it. `cols` is the widest visual row.
 */
export function tableGrid(table) {
  const rows = table?.content || [];
  const grid = rows.map(() => []);
  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r].content || [];
    let c = 0;
    for (let i = 0; i < cells.length; i++) {
      while (grid[r][c]) c += 1;              // slot taken by a span from above
      const { cs, rs } = spanOf(cells[i]);
      const entry = { cell: cells[i], rowIdx: r, cellIdx: i, originR: r, originC: c };
      for (let dr = 0; dr < rs; dr++) {
        const rr = r + dr;
        if (rr >= rows.length) break;         // span overflowing the table body
        for (let dc = 0; dc < cs; dc++) if (!grid[rr][c + dc]) grid[rr][c + dc] = entry;
      }
      c += cs;
    }
  }
  const cols = grid.reduce((m, row) => Math.max(m, row.length), 0);
  return { grid, rows: rows.length, cols };
}

/** The grid entry for an (rowIdx, cellIdx) array position. */
function entryFor(grid, rowIdx, cellIdx) {
  const row = grid[rowIdx] || [];
  for (const e of row) if (e && e.rowIdx === rowIdx && e.cellIdx === cellIdx) return e;
  return null;
}

/** Visual column where row `r`'s own cell `i` starts, or null. */
function ownColOf(grid, r, i) {
  const e = entryFor(grid, r, i);
  return e ? e.originC : null;
}

/** Distinct cells occupying visual column range, deduped by origin. */
function distinctEntries(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    if (!e) continue;
    const key = `${e.rowIdx}:${e.cellIdx}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

const withSpan = (cell, key, value) => {
  const attrs = { ...(cell.attrs || {}) };
  if (value > 1) attrs[key] = value; else delete attrs[key];
  return { ...cell, attrs: Object.keys(attrs).length ? attrs : null };
};

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
      // A table- or row-level path has no cell address. Defaulting to (0,0)
      // here made table-level commands silently target header cell A1 (S4).
      if (path[i + 1] === undefined || path[i + 2] === undefined) return null;
      return { tablePath: p, rowIdx: path[i + 1], cellIdx: path[i + 2] };
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
  const { grid, cols } = tableGrid(table);
  const at = ctx.rowIdx + after;

  // A cell spanning ACROSS the insertion boundary grows by one row instead of
  // the new row getting a cell in that column.
  const covered = new Set();
  if (at > 0 && at < table.content.length) {
    for (const e of distinctEntries(grid[at] || [])) {
      if (e.originR < at) {
        covered.add(`${e.rowIdx}:${e.cellIdx}`);
        for (let c = e.originC; c < e.originC + spanOf(e.cell).cs; c++) covered.add(`col:${c}`);
      }
    }
  }
  const newCells = [];
  for (let c = 0; c < Math.max(1, cols); c++) if (!covered.has(`col:${c}`)) newCells.push(makeCell(false));
  const newRow = node('tableRow', null, newCells.length ? newCells : [makeCell(false)]);

  const doc2 = updateAt(state.doc, ctx.tablePath, (t) => {
    const content = t.content.map((row, r) => ({
      ...row,
      content: row.content.map((cell, i) => (covered.has(`${r}:${i}`)
        ? withSpan(cell, 'rowspan', spanOf(cell).rs + 1)
        : cell)),
    }));
    content.splice(at, 0, newRow);
    return { ...t, content };
  });
  // References at/below the insertion point shift down one row (S6).
  const doc3 = updateAt(doc2, ctx.tablePath, (t) => remapFormulasInTable(t, {
    rowMap: (r) => (r >= at ? r + 1 : r),
  }));
  return st(doc3, textSelection(pos([...ctx.tablePath, at, 0, 0], 0)));
}

export function addColumnAfter(state) { return addColumn(state, 1); }
export function addColumnBefore(state) { return addColumn(state, 0); }

function addColumn(state, after) {
  const ctx = ctxFromState(state);
  if (!ctx) return state;
  const table = getNode(state.doc, ctx.tablePath);
  const { grid, rows } = tableGrid(table);
  const anchor = entryFor(grid, ctx.rowIdx, ctx.cellIdx);
  // Insertion boundary in VISUAL columns: array indices are meaningless once a
  // row above holds a colspan.
  const X = anchor ? anchor.originC + (after ? spanOf(anchor.cell).cs : 0) : ctx.cellIdx + after;

  const widen = new Set();          // `rowIdx:cellIdx` of cells straddling X
  const insertAt = new Map();       // rowIdx → array index for the new cell
  for (let r = 0; r < rows; r++) {
    const e = grid[r]?.[X];
    if (e && e.originC < X) { widen.add(`${e.rowIdx}:${e.cellIdx}`); continue; }
    insertAt.set(r, e ? e.cellIdx : (table.content[r]?.content?.length || 0));
  }

  const headerRow0 = !!table.content[0]?.content?.[0]?.attrs?.header;
  const doc2 = updateAt(state.doc, ctx.tablePath, (t) => ({
    ...t,
    content: t.content.map((row, r) => {
      const cells = row.content.map((cell, i) => (widen.has(`${r}:${i}`)
        ? withSpan(cell, 'colspan', spanOf(cell).cs + 1)
        : cell));
      if (insertAt.has(r)) cells.splice(insertAt.get(r), 0, makeCell(r === 0 && headerRow0));
      return { ...row, content: cells };
    }),
  }));
  // References at/right of the insertion boundary shift one column (S6).
  const doc3 = updateAt(doc2, ctx.tablePath, (t) => remapFormulasInTable(t, {
    colMap: (c) => (c >= X ? c + 1 : c),
  }));
  const caretIdx = insertAt.has(ctx.rowIdx) ? insertAt.get(ctx.rowIdx) : ctx.cellIdx;
  return st(doc3, textSelection(pos([...ctx.tablePath, ctx.rowIdx, caretIdx, 0], 0)));
}

/** Append a row at the end of the table containing the selection. */
export function appendRow(state) {
  const ctx = ctxFromState(state);
  if (!ctx) return state;
  const table = getNode(state.doc, ctx.tablePath);
  const { cols } = tableGrid(table);           // visual width, not row 0's array length
  const newRow = makeRow(Math.max(1, cols), false);
  const doc2 = updateAt(state.doc, ctx.tablePath, (t) => ({ ...t, content: [...t.content, newRow] }));
  const newRowIdx = getNode(doc2, ctx.tablePath).content.length - 1;
  return st(doc2, textSelection(pos([...ctx.tablePath, newRowIdx, 0, 0], 0)));
}

/** Append a column at the right edge of the table containing the selection. */
export function appendColumn(state) {
  const ctx = ctxFromState(state);
  if (!ctx) return state;
  const table = getNode(state.doc, ctx.tablePath);
  const headerRow = !!table.content[0]?.content?.[0]?.attrs?.header;
  const doc2 = updateAt(state.doc, ctx.tablePath, (t) => ({
    ...t,
    content: t.content.map((row, r) => ({ ...row, content: [...row.content, makeCell(r === 0 && headerRow)] })),
  }));
  const lastCol = getNode(doc2, ctx.tablePath).content[ctx.rowIdx].content.length - 1;
  return st(doc2, textSelection(pos([...ctx.tablePath, ctx.rowIdx, lastCol, 0], 0)));
}

/**
 * Append a total row and put `=SUM(<col-range>)` in visual column `col`.
 *
 * The range is explicit (`B2:B4`), not the whole column (`B:B`): a whole-column
 * range would include the total row itself and evaluate to #CIRC!. Row 1 is
 * skipped when the table has a header row; the range's last row is the row
 * count BEFORE the append.
 */
export function addColumnTotal(state, tablePath, col) {
  const table = getNode(state.doc, tablePath);
  if (!table || table.type !== 'table') return state;
  const { rows, cols } = tableGrid(table);
  if (!cols || col == null || col < 0 || col >= cols) return state;
  const hasHeader = !!table.content[0]?.content?.[0]?.attrs?.header;
  const first = hasHeader ? 2 : 1;               // 1-based first data row
  const last = rows;                              // 1-based last row before the append
  if (last < first) return state;                 // nothing to total
  const letter = colLabel(col);
  const src = `=SUM(${letter}${first}:${letter}${last})`;

  // Same width mechanics as appendRow: a fresh full-width row at the end.
  const newRow = makeRow(Math.max(1, cols), false);
  const doc2 = updateAt(state.doc, tablePath, (t) => ({ ...t, content: [...t.content, newRow] }));
  const t2 = getNode(doc2, tablePath);
  const newRowIdx = t2.content.length - 1;
  const { grid } = tableGrid(t2);
  const e = grid[newRowIdx]?.[col];
  const cellIdx = e && e.rowIdx === newRowIdx
    ? e.cellIdx
    : Math.max(0, Math.min(col, (t2.content[newRowIdx]?.content?.length || 1) - 1));
  const cellPath = [...tablePath, newRowIdx, cellIdx];
  const doc3 = updateAt(doc2, cellPath, (c) => node('tableCell', c.attrs || null, [
    node('paragraph', null, [node('formula', { src })]),
  ]));
  return st(doc3, textSelection(pos([...cellPath, 0], 0)));
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

/** A cell that may be replaced by a formula: empty / whitespace-only text, or
 *  already holding just a formula atom (+ whitespace strays). Anything else —
 *  real text, other atoms, nested blocks — refuses, so Insert formula can
 *  never destroy data (S4). Duplicates the small formula.js walk to avoid a
 *  tables↔formula import cycle. */
function cellReplaceableByFormula(cell) {
  let formulas = 0;
  for (const b of cell?.content || []) {
    for (const inl of b?.content || []) {
      if (inl?.type === 'formula') { formulas += 1; if (formulas > 1) return false; continue; }
      if (inl?.type === 'text') { if ((inl.text || '').trim() !== '') return false; continue; }
      return false;
    }
  }
  return true;
}

/** Replace the current cell's content with a single formula atom (=…).
 *  Refuses (returns state unchanged) when the selection spans more than one
 *  cell or the target cell holds anything besides whitespace or an existing
 *  formula — the old version wiped whatever the cell contained (S4). */
export function setCellFormula(state, src) {
  const sel = state.selection;
  if (isCell(sel)) {
    const rect = cellRect(state.doc, sel);
    if (!rect || rect.cells.length !== 1) return state;
  }
  const ctx = ctxFromState(state);
  if (!ctx) return state;
  const cellPath = [...ctx.tablePath, ctx.rowIdx, ctx.cellIdx];
  const cell = getNode(state.doc, cellPath);
  if (!cell || cell.type !== 'tableCell' || !cellReplaceableByFormula(cell)) return state;
  const doc2 = updateAt(state.doc, cellPath, (c) => node('tableCell', c.attrs || null, [
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
  const { grid } = tableGrid(table);
  const Y = ctx.rowIdx;

  // Cells reaching INTO the row from above shrink by one; cells that start in
  // it and continue below move down to the next row with rowspan-1. Neither
  // used to happen, so a rowspan was left overflowing the table body.
  const shrink = new Set();
  const moved = [];
  for (const e of distinctEntries(grid[Y] || [])) {
    const { rs } = spanOf(e.cell);
    if (e.originR < Y) { if (rs > 1) shrink.add(`${e.rowIdx}:${e.cellIdx}`); continue; }
    if (rs > 1) moved.push({ cell: withSpan(e.cell, 'rowspan', rs - 1), col: e.originC });
  }
  moved.sort((a, b) => a.col - b.col);

  const doc2 = updateAt(state.doc, ctx.tablePath, (t) => {
    const content = t.content.map((row, r) => ({
      ...row,
      content: row.content.map((cell, i) => (shrink.has(`${r}:${i}`) ? withSpan(cell, 'rowspan', spanOf(cell).rs - 1) : cell)),
    }));
    // Re-home the moved cells into the row below (if there is one).
    if (moved.length && Y + 1 < content.length) {
      const target = content[Y + 1];
      const cells = target.content.slice();
      for (const m of moved) {
        let idx = 0;
        for (let i = 0; i < cells.length; i++) {
          const c = ownColOf(grid, Y + 1, i);
          if (c != null && c < m.col) idx = i + 1;
        }
        cells.splice(idx, 0, m.cell);
      }
      content[Y + 1] = { ...target, content: cells };
    }
    content.splice(Y, 1);
    return { ...t, content };
  });
  // Refs to the deleted row become #REF!; refs below it shift up one (S6).
  const doc3 = updateAt(doc2, ctx.tablePath, (t) => remapFormulasInTable(t, {
    rowMap: (r) => (r === Y ? null : r > Y ? r - 1 : r),
  }));
  const row = Math.min(Y, getNode(doc3, ctx.tablePath).content.length - 1);
  return st(doc3, textSelection(pos([...ctx.tablePath, row, 0, 0], 0)));
}

export function deleteColumn(state) {
  const ctx = ctxFromState(state);
  if (!ctx) return state;
  const { grid } = tableGrid(getNode(state.doc, ctx.tablePath));
  const anchor = entryFor(grid, ctx.rowIdx, ctx.cellIdx);
  return deleteColumnAt(state, ctx.tablePath, anchor ? anchor.originC : ctx.cellIdx, ctx);
}

/**
 * Delete VISUAL column `X`.
 *
 * Addressed by visual column, not by a cell: routing this through the selection
 * meant that clicking the gutter for a column covered by a span deleted the
 * span's ORIGIN column instead of the one the user pointed at.
 */
export function deleteColumnAt(state, tablePath, X, ctxIn = null) {
  const table = getNode(state.doc, tablePath);
  if (!table) return state;
  const { grid, rows, cols } = tableGrid(table);
  if (cols <= 1) return deleteTable(ctxIn ? state : { ...state, selection: textSelection(pos([...tablePath, 0, 0, 0], 0)) });
  const ctx = ctxIn || { tablePath, rowIdx: 0, cellIdx: 0 };

  // A cell wider than one column shrinks; a plain cell is removed. Working from
  // array indices meant a short row (a merged header) simply had nothing at
  // that index, so the column could never be deleted from it.
  const shrink = new Set();
  const remove = new Set();
  const seen = new Set();
  for (let r = 0; r < rows; r++) {
    const e = grid[r]?.[X];
    if (!e) continue;
    const key = `${e.rowIdx}:${e.cellIdx}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (spanOf(e.cell).cs > 1) shrink.add(key); else remove.add(key);
  }

  const doc2 = updateAt(state.doc, ctx.tablePath, (t) => ({
    ...t,
    content: t.content.map((row, r) => {
      const cells = row.content
        .map((cell, i) => (shrink.has(`${r}:${i}`) ? withSpan(cell, 'colspan', spanOf(cell).cs - 1) : cell))
        .filter((_, i) => !remove.has(`${r}:${i}`));
      // A row whose every cell sat in the deleted column keeps ONE empty cell —
      // dropping it meant a column delete could delete rows (S6, old :352).
      return { ...row, content: cells.length ? cells : [makeCell(false)] };
    }),
  }));
  // Refs to the deleted column become #REF!; refs right of it shift left (S6).
  const doc3 = updateAt(doc2, ctx.tablePath, (t) => remapFormulasInTable(t, {
    colMap: (c) => (c === X ? null : c > X ? c - 1 : c),
  }));
  const target = getNode(doc3, ctx.tablePath);
  const row = Math.min(ctx.rowIdx, (target?.content?.length || 1) - 1);
  const col = Math.max(0, Math.min(ctx.cellIdx, (target?.content?.[row]?.content?.length || 1) - 1));
  return st(doc3, textSelection(pos([...ctx.tablePath, row, col, 0], 0)));
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
  const { grid, rows, cols } = tableGrid(table);
  if (!cols) return state;
  const anchor = entryFor(grid, ctx.rowIdx, ctx.cellIdx);
  const r0 = anchor ? anchor.originR : ctx.rowIdx;
  const c0 = anchor ? anchor.originC : ctx.cellIdx;
  // Step past the whole width of a merged cell, and use the VISUAL column count.
  // Taking row 0's array length as the width meant a merged header made the
  // last column unreachable and every second Tab appended a new row.
  let r = r0;
  let c = dir > 0 ? c0 + spanOf(anchor?.cell).cs : c0 - 1;
  if (c >= cols) { c = 0; r += 1; }
  if (c < 0) { c = cols - 1; r -= 1; }
  if (r >= rows) return addRowAfter(state);
  if (r < 0) return state;
  // Skip slots covered by a span reaching in from elsewhere.
  let guard = cols * rows;
  while (guard-- > 0) {
    const e = grid[r]?.[c];
    if (e && !(e.originR === r0 && e.originC === c0)) {
      return st(state.doc, textSelection(pos([...ctx.tablePath, e.rowIdx, e.cellIdx, 0], 0)));
    }
    c += dir > 0 ? 1 : -1;
    if (c >= cols) { c = 0; r += 1; }
    if (c < 0) { c = cols - 1; r -= 1; }
    if (r >= rows) return addRowAfter(state);
    if (r < 0) return state;
  }
  return state;
}

export function inTable(state) {
  return !!ctxFromState(state);
}

/* ── A1 references (for the formula editor's click-to-pick) ── */

/** Visual { r, c, tablePath } of a cell path, or null. */
export function cellCoordsVisual(doc, cellPath) {
  const ctx = tableContext(doc, cellPath);
  if (!ctx) return null;
  const { grid } = tableGrid(getNode(doc, ctx.tablePath));
  const e = entryFor(grid, ctx.rowIdx, ctx.cellIdx);
  return e ? { r: e.originR, c: e.originC, tablePath: ctx.tablePath } : null;
}

/** "A1" for a cell path — row 1 is the table's first row, as in a spreadsheet. */
export function cellRef(doc, cellPath) {
  const co = cellCoordsVisual(doc, cellPath);
  return co ? `${colLabel(co.c)}${co.r + 1}` : null;
}

/** "A1" / "A1:C4" for a pair of visual coordinates (order-independent). */
export function rangeRef(a, b) {
  if (!a || !b) return null;
  const r1 = Math.min(a.r, b.r); const r2 = Math.max(a.r, b.r);
  const c1 = Math.min(a.c, b.c); const c2 = Math.max(a.c, b.c);
  const from = `${colLabel(c1)}${r1 + 1}`;
  const to = `${colLabel(c2)}${r2 + 1}`;
  return from === to ? from : `${from}:${to}`;
}

/** Whole-column range, e.g. "B:B" (or "B:D" across a span of columns). */
export function columnRef(c1, c2 = c1) {
  const lo = Math.min(c1, c2); const hi = Math.max(c1, c2);
  return `${colLabel(lo)}:${colLabel(hi)}`;
}

/* ── index-addressed structural ops (row/column gutter buttons) ── */

/** Put the caret in a specific cell so a selection-driven command targets it. */
function withCaretAt(state, tablePath, rowIdx, cellIdx) {
  return { ...state, selection: textSelection(pos([...tablePath, rowIdx, cellIdx, 0], 0)) };
}

/** Delete row `rowIdx` of the table at `tablePath`. */
export function deleteRowAt(state, tablePath, rowIdx) {
  const table = getNode(state.doc, tablePath);
  if (!table?.content?.[rowIdx]?.content?.length) return state;
  return deleteRow(withCaretAt(state, tablePath, rowIdx, 0));
}

/** Select the whole of visual column `col` as a cell rectangle. */
export function selectColumn(state, tablePath, col) {
  const { grid, rows } = tableGrid(getNode(state.doc, tablePath));
  const first = grid[0]?.[col];
  const last = grid[rows - 1]?.[col];
  if (!first || !last) return state;
  return st(state.doc, cellSelection(
    [...tablePath, first.rowIdx, first.cellIdx],
    [...tablePath, last.rowIdx, last.cellIdx],
  ));
}

/** Select the whole of row `rowIdx` as a cell rectangle. */
export function selectRow(state, tablePath, rowIdx) {
  const { grid, cols } = tableGrid(getNode(state.doc, tablePath));
  const first = grid[rowIdx]?.[0];
  const last = grid[rowIdx]?.[cols - 1];
  if (!first || !last) return state;
  return st(state.doc, cellSelection(
    [...tablePath, first.rowIdx, first.cellIdx],
    [...tablePath, last.rowIdx, last.cellIdx],
  ));
}

/* ── cell-rectangle selection helpers ───────────────────── */

/** The rectangle spanned by a cell selection: { tablePath, minR, maxR, minC, maxC, cells:[cellPath] }. */
export function cellRect(doc, sel) {
  if (!isCell(sel)) return null;
  const a = cellCoords(doc, sel.anchorCell);
  const b = cellCoords(doc, sel.headCell);
  if (!a || !b || a.tablePath.join() !== b.tablePath.join()) return null;
  const table = getNode(doc, a.tablePath);
  const { grid, rows, cols } = tableGrid(table);
  const ea = entryFor(grid, a.r, a.c);
  const eb = entryFor(grid, b.r, b.c);
  // Work in visual coordinates, and expand the rectangle so a merged cell is
  // never half-selected.
  const av = ea ? { r: ea.originR, c: ea.originC, cs: spanOf(ea.cell).cs, rs: spanOf(ea.cell).rs } : { r: a.r, c: a.c, cs: 1, rs: 1 };
  const bv = eb ? { r: eb.originR, c: eb.originC, cs: spanOf(eb.cell).cs, rs: spanOf(eb.cell).rs } : { r: b.r, c: b.c, cs: 1, rs: 1 };
  const minR = Math.max(0, Math.min(av.r, bv.r));
  const maxR = Math.min(rows - 1, Math.max(av.r + av.rs - 1, bv.r + bv.rs - 1));
  const minC = Math.max(0, Math.min(av.c, bv.c));
  const maxC = Math.min(Math.max(0, cols - 1), Math.max(av.c + av.cs - 1, bv.c + bv.cs - 1));

  // Resolve visual slots to real cell paths, deduped — the old version emitted
  // one path per visual slot, so a ragged or merged rectangle produced paths
  // that address nothing and updateAt built a type-less node from `undefined`.
  const seen = new Set();
  const cells = [];
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const e = grid[r]?.[c];
      if (!e) continue;
      const key = `${e.rowIdx}:${e.cellIdx}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cells.push([...a.tablePath, e.rowIdx, e.cellIdx]);
    }
  }
  return { tablePath: a.tablePath, minR, maxR, minC, maxC, cells, grid };
}

function cellCoords(doc, cellPath) {
  const ctx = tableContext(doc, cellPath);
  if (!ctx) return null;
  return { tablePath: ctx.tablePath, r: ctx.rowIdx, c: ctx.cellIdx };
}

/**
 * When `sel` is a cell selection covering exactly one FULL visual column,
 * return { tablePath, col }; else null. Drives the toolbar's Insert-formula
 * routing: a full-column selection means "total this column", not "overwrite
 * the anchor cell".
 */
export function fullColumnSelection(doc, sel) {
  if (!doc || !sel) return null;
  const rect = cellRect(doc, sel);
  if (!rect || rect.minC !== rect.maxC) return null;
  const { rows } = tableGrid(getNode(doc, rect.tablePath));
  if (rect.minR !== 0 || rect.maxR !== rows - 1) return null;
  return { tablePath: rect.tablePath, col: rect.minC };
}

/** Clear the text content of every cell in the current cell selection. */
export function clearCells(state) {
  const rect = cellRect(state.doc, state.selection);
  if (!rect) return state;
  let doc2 = state.doc;
  for (const cellPath of rect.cells) {
    // Guard the node: updateAt recurses into a missing index and hands the
    // callback `undefined`, so spreading it produced a node with no `type`
    // that then rendered a <div> inside a <tr>.
    if (!getNode(doc2, cellPath)) continue;
    doc2 = updateAt(doc2, cellPath, (cell) => (cell ? { ...cell, content: [emptyParagraph()] } : cell));
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
  const table = getNode(state.doc, ctx.tablePath);
  const { grid, rows } = tableGrid(table);
  // colIdx is a VISUAL column. Only cells that are exactly one column wide and
  // start here carry the width — a merged cell spans several columns, so its
  // width isn't this column's width. Comparing array index to column index put
  // the width on the wrong cells in any merged table.
  const targets = new Set();
  for (let r = 0; r < rows; r++) {
    const e = grid[r]?.[colIdx];
    if (e && e.originC === colIdx && spanOf(e.cell).cs === 1) targets.add(`${e.rowIdx}:${e.cellIdx}`);
  }
  const doc2 = updateAt(state.doc, ctx.tablePath, (t) => ({
    ...t,
    content: t.content.map((row, r) => ({
      ...row,
      content: row.content.map((cell, i) => (targets.has(`${r}:${i}`)
        ? node('tableCell', { ...(cell.attrs || {}), colwidth: w }, cell.content)
        : cell)),
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
  const grid = rect.grid || tableGrid(getNode(doc, rect.tablePath)).grid;
  const lines = [];
  for (let r = rect.minR; r <= rect.maxR; r++) {
    const cols = [];
    const emitted = new Set();
    for (let c = rect.minC; c <= rect.maxC; c++) {
      const e = grid[r]?.[c];
      if (!e) { cols.push(''); continue; }
      const key = `${e.rowIdx}:${e.cellIdx}`;
      // A merged cell's text belongs to its first column only; the rest of the
      // slots it covers are blank, so columns still line up.
      cols.push(emitted.has(key) ? '' : cellText(e.cell));
      emitted.add(key);
    }
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
