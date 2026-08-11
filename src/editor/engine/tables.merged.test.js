/**
 * Merged-cell (colspan/rowspan) table operations.
 *
 * tables.js treated a row's ARRAY index as its column number. Every other layer
 * — schema, htmlToAst, render, reconcile, astToHtml, astToMd — supports spans,
 * so tables with merged cells round-tripped fine and then corrupted the moment
 * a structural command touched them. tables.test.js builds every fixture with
 * the uniform makeTable() helper, which is exactly why none of this was caught.
 *
 * Run: cd agent-hub && npx vitest run src/editor/engine/tables.merged.test.js
 */
import { describe, it, expect } from 'vitest';
import { createState, applyTransform } from './state.js';
import { textSelection, cellSelection, pos } from './selection.js';
import * as Tbl from './tables.js';

const cell = (text, attrs = null) => ({
    type: 'tableCell',
    attrs,
    content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
});
const row = (...cells) => ({ type: 'tableRow', content: cells });
const table = (...rows) => ({ type: 'doc', content: [{ type: 'table', content: rows }] });

/** Header spanning 2 columns, then two 3-cell data rows. */
const mergedHeader = () => table(
    row(cell('H1+H2', { header: true, colspan: 2 }), cell('H3', { header: true })),
    row(cell('a'), cell('b'), cell('c')),
    row(cell('d'), cell('e'), cell('f')),
);

/** First column spans all 3 rows. */
const mergedColumn = () => table(
    row(cell('tall', { rowspan: 3 }), cell('x')),
    row(cell('y')),
    row(cell('z')),
);

const at = (s, r, c) => ({ ...s, selection: textSelection(pos([0, r, c, 0], 0)) });
const tbl = (s) => s.doc.content[0];
const rowTexts = (s, r) => (tbl(s).content[r]?.content || []).map((cl) => cl.content?.[0]?.content?.[0]?.text || '');
const spans = (s, r, c) => tbl(s).content[r]?.content?.[c]?.attrs || {};

describe('the visual grid', () => {
    it('maps a merged header to three visual columns', () => {
        const g = Tbl.tableGrid(mergedHeader().content[0]);
        expect(g.cols).toBe(3);
        expect(g.rows).toBe(3);
        // Both of the header's visual slots resolve to the same array cell.
        expect(g.grid[0][0].cellIdx).toBe(0);
        expect(g.grid[0][1].cellIdx).toBe(0);
        expect(g.grid[0][2].cellIdx).toBe(1);
    });

    it('maps a rowspan down the column', () => {
        const g = Tbl.tableGrid(mergedColumn().content[0]);
        expect(g.cols).toBe(2);
        expect(g.grid[1][0].cellIdx).toBe(0);
        expect(g.grid[1][0].rowIdx).toBe(0);   // owned by row 0
        expect(g.grid[1][1].rowIdx).toBe(1);
    });

    it('handles a plain table unchanged', () => {
        const g = Tbl.tableGrid(table(row(cell('a'), cell('b')), row(cell('c'), cell('d'))).content[0]);
        expect(g.cols).toBe(2);
        expect(g.grid[1][1].cellIdx).toBe(1);
    });
});

describe('deleteRow with a rowspan', () => {
    it('shrinks a span that reaches into the deleted row', () => {
        let s = createState(mergedColumn());
        s = at(s, 1, 0);                        // the "y" cell
        s = applyTransform(s, Tbl.deleteRow);
        expect(tbl(s).content).toHaveLength(2);
        // The span must not still claim 3 rows in a 2-row table.
        expect(spans(s, 0, 0).rowspan).toBe(2);
    });

    it('never leaves a rowspan larger than the table', () => {
        let s = createState(mergedColumn());
        s = at(s, 1, 0);
        s = applyTransform(s, Tbl.deleteRow);
        s = at(s, 1, 0);
        s = applyTransform(s, Tbl.deleteRow);
        const rows = tbl(s).content.length;
        for (const r of tbl(s).content) {
            for (const c of r.content) expect((c.attrs?.rowspan || 1)).toBeLessThanOrEqual(rows);
        }
    });

    it('moves a span down when its own row is deleted', () => {
        let s = createState(mergedColumn());
        s = at(s, 0, 1);                        // the "x" cell, row 0
        s = applyTransform(s, Tbl.deleteRow);
        expect(tbl(s).content).toHaveLength(2);
        expect(rowTexts(s, 0)).toContain('tall');
        expect(spans(s, 0, 0).rowspan).toBe(2);
    });
});

describe('addColumn with a merged header', () => {
    it('keeps data aligned under its header', () => {
        let s = createState(mergedHeader());
        s = at(s, 1, 1);                        // the "b" cell — visual column 1
        s = applyTransform(s, Tbl.addColumnAfter);
        // New column lands at visual index 2, so "c" stays in the last column.
        expect(rowTexts(s, 1)).toEqual(['a', 'b', '', 'c']);
        const g = Tbl.tableGrid(tbl(s));
        expect(g.cols).toBe(4);
    });

    it('widens a header that straddles the insertion point', () => {
        let s = createState(mergedHeader());
        s = at(s, 1, 0);                        // "a" — visual column 0
        s = applyTransform(s, Tbl.addColumnAfter);
        // Inserting at visual column 1 falls inside the 2-wide header.
        expect(spans(s, 0, 0).colspan).toBe(3);
        expect(rowTexts(s, 1)).toEqual(['a', '', 'b', 'c']);
    });

    it('every row still has the same visual width', () => {
        let s = createState(mergedHeader());
        s = at(s, 1, 2);
        s = applyTransform(s, Tbl.addColumnAfter);
        const g = Tbl.tableGrid(tbl(s));
        for (let r = 0; r < g.rows; r++) {
            const filled = g.grid[r].filter(Boolean).length;
            expect(filled).toBe(g.cols);
        }
    });
});

describe('deleteColumn with a merged header', () => {
    it('shrinks the header instead of silently doing nothing', () => {
        let s = createState(mergedHeader());
        s = at(s, 1, 0);                        // visual column 0, inside the span
        s = applyTransform(s, Tbl.deleteColumn);
        expect(spans(s, 0, 0).colspan).toBe(undefined);   // 2 → 1, attr dropped
        expect(rowTexts(s, 1)).toEqual(['b', 'c']);
    });

    it('removes the last column from EVERY row, including the short one', () => {
        let s = createState(mergedHeader());
        s = at(s, 1, 2);                        // "c" — visual column 2
        s = applyTransform(s, Tbl.deleteColumn);
        expect(rowTexts(s, 0)).toEqual(['H1+H2']);        // H3 gone
        expect(rowTexts(s, 1)).toEqual(['a', 'b']);
        const g = Tbl.tableGrid(tbl(s));
        expect(g.cols).toBe(2);
    });
});

describe('Tab navigation across merged cells', () => {
    const cellOf = (s) => s.selection.anchor.path.slice(1, 3);

    it('reaches the last column instead of stopping short', () => {
        let s = createState(mergedHeader());
        s = at(s, 1, 1);                        // "b"
        s = applyTransform(s, (x) => Tbl.goToCell(x, 1));
        expect(cellOf(s)).toEqual([1, 2]);       // "c" — was unreachable
        expect(tbl(s).content).toHaveLength(3);  // and no row was appended
    });

    it('steps over a merged cell in one move', () => {
        let s = createState(mergedHeader());
        s = at(s, 0, 0);                        // the 2-wide header
        s = applyTransform(s, (x) => Tbl.goToCell(x, 1));
        expect(cellOf(s)).toEqual([0, 1]);       // H3, not back into itself
    });

    it('wraps to the next row at the true visual width', () => {
        let s = createState(mergedHeader());
        s = at(s, 1, 2);                        // last cell of row 1
        s = applyTransform(s, (x) => Tbl.goToCell(x, 1));
        expect(cellOf(s)).toEqual([2, 0]);
    });

    it('only appends a row past the real last cell', () => {
        let s = createState(mergedHeader());
        s = at(s, 2, 2);                        // "f" — last cell of the table
        s = applyTransform(s, (x) => Tbl.goToCell(x, 1));
        expect(tbl(s).content).toHaveLength(4);
    });
});

describe('cell rectangles over merged cells', () => {
    it('resolves each visual slot to a real cell path, deduped', () => {
        const s = createState(mergedHeader());
        const rect = Tbl.cellRect(s.doc, cellSelection([0, 0, 0], [0, 1, 2]));
        expect(rect).toBeTruthy();
        for (const p of rect.cells) {
            let n = s.doc;
            for (const i of p) n = n?.content?.[i];
            expect(n?.type).toBe('tableCell');   // never undefined
        }
        // 2 cells in the header row + 3 in the data row.
        expect(rect.cells).toHaveLength(5);
    });

    it('clearCells never writes a type-less node', () => {
        let s = createState(mergedHeader());
        s = { ...s, selection: cellSelection([0, 0, 0], [0, 1, 2]) };
        s = applyTransform(s, Tbl.clearCells);
        for (const r of tbl(s).content) {
            for (const c of r.content) expect(c.type).toBe('tableCell');
        }
    });

    it('rectangle text keeps columns aligned around a merged cell', () => {
        const s = createState(mergedHeader());
        const rect = Tbl.cellRect(s.doc, cellSelection([0, 0, 0], [0, 1, 2]));
        const text = Tbl.cellRectToText(s.doc, rect);
        const [header, data] = text.split('\n');
        expect(header.split('\t')).toHaveLength(3);
        expect(data.split('\t')).toEqual(['a', 'b', 'c']);
    });
});

describe('column width on a merged table', () => {
    it('applies to the cells actually in that visual column', () => {
        let s = createState(mergedHeader());
        s = at(s, 1, 0);
        s = applyTransform(s, (x) => Tbl.setColumnWidth(x, 2, 150));
        // The 2-wide header is not "column 2" and must not take the width.
        expect(spans(s, 0, 0).colwidth).toBeUndefined();
        expect(spans(s, 1, 2).colwidth).toBe(150);
        expect(spans(s, 2, 2).colwidth).toBe(150);
    });
});
