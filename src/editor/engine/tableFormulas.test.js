/**
 * Spreadsheet behaviour in notebook tables: A1 addressing, `=` to start a
 * formula, reference picking, index-addressed row/column operations, reference
 * remapping after structural ops (S6), destructive-insert refusals (S4) and
 * the column-total command.
 *
 * Run: cd agent-hub && npx vitest run src/editor/engine/tableFormulas.test.js
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createState, applyTransform } from './state.js';
import { textSelection, cellSelection, pos } from './selection.js';
import { markdownToAst } from '../serialization/mdToAst.js';
import { EditorView } from './view.js';
import * as Tbl from './tables.js';
import { evaluateTable, isFormulaCell, formulaSrc } from './formula.js';
import { colLabel, colToIndex, parseAnyRef } from './formulaRefs.js';
import { remapSrc } from './formulaRemap.js';
import { normalizeDeep } from './normalize.js';
import { runInputRules } from './inputRules.js';
import { insertText } from './transforms.js';

const cell = (text, attrs = null) => ({
    type: 'tableCell',
    attrs,
    content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
});
const row = (...cells) => ({ type: 'tableRow', content: cells });
const table = (...rows) => ({ type: 'doc', content: [{ type: 'table', content: rows }] });

/** Header row + two numeric data rows. */
const numbers = () => table(
    row(cell('Item', { header: true }), cell('Qty', { header: true }), cell('Price', { header: true })),
    row(cell('Bolt'), cell('4'), cell('2.5')),
    row(cell('Nut'), cell('10'), cell('0.5')),
);

const tbl = (s) => s.doc.content[0];
const at = (s, r, c, off = 0) => ({ ...s, selection: textSelection(pos([0, r, c, 0], off)) });
const valueAt = (s, r, c) => evaluateTable(tbl(s)).get(`${r},${c}`);
// setCellFormula refuses non-empty cells (S4), so tests empty the target first.
const blank = (s, r, c) => applyTransform(s, (x) => Tbl.clearCells({ ...x, selection: cellSelection([0, r, c]) }));
const setFormula = (s, r, c, src) => applyTransform(at(blank(s, r, c), r, c), (x) => Tbl.setCellFormula(x, src));

describe('A1 labels', () => {
    it('round-trips column labels past Z', () => {
        expect(colLabel(0)).toBe('A');
        expect(colLabel(25)).toBe('Z');
        expect(colLabel(26)).toBe('AA');
        expect(colToIndex('AA')).toBe(26);
        expect(parseAnyRef('B3')).toEqual({ r: 2, c: 1, col: false });
        expect(parseAnyRef('C')).toEqual({ c: 2, col: true });
    });

    it('gives a cell its spreadsheet reference', () => {
        const s = createState(numbers());
        expect(Tbl.cellRef(s.doc, [0, 0, 0])).toBe('A1');
        expect(Tbl.cellRef(s.doc, [0, 1, 2])).toBe('C2');
        expect(Tbl.cellRef(s.doc, [0, 2, 1])).toBe('B3');
    });

    it('builds range and whole-column references', () => {
        expect(Tbl.rangeRef({ r: 1, c: 0 }, { r: 3, c: 2 })).toBe('A2:C4');
        expect(Tbl.rangeRef({ r: 2, c: 1 }, { r: 0, c: 0 })).toBe('A1:B3');   // order-independent
        expect(Tbl.rangeRef({ r: 1, c: 1 }, { r: 1, c: 1 })).toBe('B2');      // single cell
        expect(Tbl.columnRef(1)).toBe('B:B');
        expect(Tbl.columnRef(0, 2)).toBe('A:C');
    });

    it('labels a merged table by VISUAL column, not array index', () => {
        const s = createState(table(
            row(cell('H1+H2', { header: true, colspan: 2 }), cell('H3', { header: true })),
            row(cell('a'), cell('b'), cell('c')),
        ));
        // "c" is the third array cell of row 1 and also visual column C.
        expect(Tbl.cellRef(s.doc, [0, 1, 2])).toBe('C2');
        // The merged header starts at visual column A.
        expect(Tbl.cellRef(s.doc, [0, 0, 0])).toBe('A1');
        // ...and its neighbour is at C, not B — it is pushed by the span.
        expect(Tbl.cellRef(s.doc, [0, 0, 1])).toBe('C1');
    });
});

describe('typing "=" starts a formula', () => {
    const typeInCell = (s, r, c, ch) => {
        let next = applyTransform(at(s, r, c), (x) => insertText(x, ch));
        const rule = runInputRules(next, ch);
        return rule ? applyTransform(next, () => rule) : next;
    };

    it('converts an empty cell into a formula atom', () => {
        const s = typeInCell(blank(createState(numbers()), 1, 1), 1, 1, '=');
        expect(isFormulaCell(tbl(s).content[1].content[1])).toBe(true);
        expect(formulaSrc(tbl(s).content[1].content[1])).toBe('=');
    });

    it("'=' at the start of a NON-empty cell keeps the content (S4)", () => {
        const s = typeInCell(createState(numbers()), 1, 1, '=');   // before the "4"
        const target = tbl(s).content[1].content[1];
        expect(isFormulaCell(target)).toBe(false);
        expect(target.content[0].content.map((n) => n.text || '').join('')).toBe('=4');
    });

    it('leaves "=" typed mid-text alone', () => {
        let s = createState(numbers());
        s = applyTransform(at(s, 1, 1, 1), (x) => insertText(x, '='));   // after the "4"
        const rule = runInputRules(s, '=');
        expect(rule).toBe(null);
        expect(isFormulaCell(tbl(s).content[1].content[1])).toBe(false);
    });

    it('does not fire outside a table', () => {
        let s = createState(markdownToAst('hello'));
        s = { ...s, selection: textSelection(pos([0], 0)) };
        s = applyTransform(s, (x) => insertText(x, '='));
        expect(runInputRules(s, '=')).toBe(null);
    });
});

describe('formula evaluation addresses visual cells', () => {
    it('sums a column range', () => {
        let s = createState(numbers());
        // The formula must sit outside its own range, or it is (correctly) circular.
        s = setFormula(s, 2, 0, '=SUM(B2:B3)');
        expect(valueAt(s, 2, 0)?.value).toBe(14);
    });

    it('a formula inside its own range is circular, not a wrong number', () => {
        let s = createState(numbers());
        s = setFormula(s, 1, 1, '=SUM(B2:B3)');
        expect(valueAt(s, 1, 1)?.error).toBe('#CIRC!');
    });

    it('multiplies two cells', () => {
        let s = createState(numbers());
        // Put the formula somewhere it cannot reference itself.
        s = setFormula(s, 2, 0, '=B2*C2');
        expect(valueAt(s, 2, 0)?.value).toBe(10);
    });

    it('reports #REF! for a reference outside the table', () => {
        let s = createState(numbers());
        s = setFormula(s, 1, 0, '=Z99+1');
        expect(valueAt(s, 1, 0)?.error).toBe('#REF!');
    });

    it('detects a circular reference instead of hanging', () => {
        let s = createState(numbers());
        s = setFormula(s, 1, 1, '=C2');
        s = setFormula(s, 1, 2, '=B2');
        expect(valueAt(s, 1, 1)?.error).toBe('#CIRC!');
    });
});

describe('remapSrc', () => {
    it('skips function names and error sentinels', () => {
        expect(remapSrc('=SUM(B2:B3)+#REF!', { colMap: (c) => c + 1 })).toBe('=SUM(C2:C3)+#REF!');
    });

    it('rewrites a deleted lone ref to a literal #REF!', () => {
        expect(remapSrc('=B2*2', { colMap: (c) => (c === 1 ? null : c) })).toBe('=#REF!*2');
    });

    it('clamps a deleted range endpoint to the nearest survivor', () => {
        expect(remapSrc('=SUM(B2:B4)', { rowMap: (r) => (r === 3 ? null : r) })).toBe('=SUM(B2:B3)');
    });

    it('a fully deleted range becomes #REF!', () => {
        expect(remapSrc('=SUM(B2:B3)', { rowMap: (r) => (r === 1 || r === 2 ? null : r) })).toBe('=SUM(#REF!)');
    });

    it('whole-column ranges only move with the column map', () => {
        expect(remapSrc('=SUM(B:B)', { colMap: (c) => c + 1 })).toBe('=SUM(C:C)');
        expect(remapSrc('=SUM(B:B)', { rowMap: (r) => r + 5 })).toBe('=SUM(B:B)');
    });
});

describe('references remap on structural ops (S6)', () => {
    it('addRowBefore shifts refs at/below the insertion down (=B3 → =B4)', () => {
        let s = setFormula(createState(numbers()), 1, 0, '=B3');
        expect(valueAt(s, 1, 0)?.value).toBe(10);
        s = applyTransform(at(s, 2, 1), Tbl.addRowBefore);        // insert above the Nut row
        expect(formulaSrc(tbl(s).content[1].content[0])).toBe('=B4');
        expect(valueAt(s, 1, 0)?.value).toBe(10);                 // same value, moved row
    });

    it('addRowAfter shifts refs the same way', () => {
        let s = setFormula(createState(numbers()), 1, 0, '=B3');
        s = applyTransform(at(s, 1, 1), Tbl.addRowAfter);         // insert between Bolt and Nut
        expect(formulaSrc(tbl(s).content[1].content[0])).toBe('=B4');
    });

    it('addColumnBefore shifts lone refs and ranges right', () => {
        let s = setFormula(createState(numbers()), 2, 0, '=B2');
        s = setFormula(s, 2, 2, '=SUM(B2:B3)');
        s = applyTransform(at(s, 1, 1), Tbl.addColumnBefore);     // insert at visual column 1
        expect(formulaSrc(tbl(s).content[2].content[0])).toBe('=C2');
        expect(formulaSrc(tbl(s).content[2].content[3])).toBe('=SUM(C2:C3)');
        expect(valueAt(s, 2, 0)?.value).toBe(4);
    });

    it('never rewrites a function name', () => {
        let s = setFormula(createState(numbers()), 2, 0, '=SUM(B2:B2)');
        s = applyTransform(at(s, 1, 0), Tbl.addColumnBefore);     // shift EVERY column
        expect(formulaSrc(tbl(s).content[2].content[1])).toBe('=SUM(C2:C2)');
    });

    it('deleteRow above the reference shifts it up', () => {
        let s = setFormula(createState(numbers()), 1, 0, '=B3');
        s = applyTransform(s, (x) => Tbl.deleteRowAt(x, [0], 0)); // drop the header row
        expect(formulaSrc(tbl(s).content[0].content[0])).toBe('=B2');
        expect(valueAt(s, 0, 0)?.value).toBe(10);
    });

    it('deleteRow ON the referenced row leaves a #REF! error', () => {
        let s = setFormula(createState(numbers()), 1, 0, '=B3');
        s = applyTransform(s, (x) => Tbl.deleteRowAt(x, [0], 2)); // drop the Nut row
        expect(formulaSrc(tbl(s).content[1].content[0])).toBe('=#REF!');
        expect(valueAt(s, 1, 0)?.error).toBe('#REF!');
    });

    it('deleteRow below the reference leaves it untouched', () => {
        let s = applyTransform(createState(numbers()), (x) => Tbl.appendRow({ ...x, selection: textSelection(pos([0, 1, 0, 0], 0)) }));
        s = setFormula(s, 3, 0, '=B2');
        s = applyTransform(s, (x) => Tbl.deleteRowAt(x, [0], 2)); // drop the Nut row (below B2)
        expect(formulaSrc(tbl(s).content[2].content[0])).toBe('=B2');
        expect(valueAt(s, 2, 0)?.value).toBe(4);
    });

    it('deleteRow clamps a range endpoint to the nearest survivor', () => {
        let s = applyTransform(createState(numbers()), (x) => Tbl.appendRow({ ...x, selection: textSelection(pos([0, 1, 0, 0], 0)) }));
        s = setFormula(s, 3, 0, '=SUM(B2:B3)');
        s = applyTransform(s, (x) => Tbl.deleteRowAt(x, [0], 2)); // drop row 3 (the Nut row)
        expect(formulaSrc(tbl(s).content[2].content[0])).toBe('=SUM(B2:B2)');
        expect(valueAt(s, 2, 0)?.value).toBe(4);
    });

    it('deleteColumnAt shifts refs right of the cut left', () => {
        let s = setFormula(createState(numbers()), 1, 0, '=C2');
        s = applyTransform(s, (x) => Tbl.deleteColumnAt(x, [0], 1)); // drop the Qty column
        expect(formulaSrc(tbl(s).content[1].content[0])).toBe('=B2');
        expect(valueAt(s, 1, 0)?.value).toBe(2.5);
    });

    it('deleteColumnAt on the referenced column leaves a #REF! error', () => {
        let s = setFormula(createState(numbers()), 1, 2, '=B2');
        s = applyTransform(s, (x) => Tbl.deleteColumnAt(x, [0], 1)); // drop column B itself
        expect(formulaSrc(tbl(s).content[1].content[1])).toBe('=#REF!');
        expect(valueAt(s, 1, 1)?.error).toBe('#REF!');
    });

    it('deleteColumnAt clamps a range endpoint', () => {
        let s = setFormula(createState(numbers()), 1, 0, '=SUM(B2:C2)');
        s = applyTransform(s, (x) => Tbl.deleteColumnAt(x, [0], 2)); // drop the Price column
        expect(formulaSrc(tbl(s).content[1].content[0])).toBe('=SUM(B2:B2)');
        expect(valueAt(s, 1, 0)?.value).toBe(4);
    });

    it('deleteColumnAt never drops a row that becomes empty', () => {
        // Ragged table: the second row has ONE cell, in the deleted column.
        let s = createState(table(row(cell('a'), cell('b')), row(cell('only'))));
        s = applyTransform(s, (x) => Tbl.deleteColumnAt(x, [0], 0));
        expect(tbl(s).content).toHaveLength(2);                   // row survives…
        expect(tbl(s).content[1].content).toHaveLength(1);        // …with one empty cell
        expect(tbl(s).content[1].content[0].type).toBe('tableCell');
    });
});

describe('S4 guards: tableContext + setCellFormula refusals', () => {
    it('tableContext is null for table- and row-level paths', () => {
        const s = createState(numbers());
        expect(Tbl.tableContext(s.doc, [0])).toBe(null);
        expect(Tbl.tableContext(s.doc, [0, 1])).toBe(null);
        expect(Tbl.tableContext(s.doc, [0, 1, 1])).toEqual({ tablePath: [0], rowIdx: 1, cellIdx: 1 });
    });

    it('refuses to overwrite a non-empty cell', () => {
        const s = createState(numbers());
        const s2 = Tbl.setCellFormula(at(s, 1, 0), '=');
        expect(s2.doc).toBe(s.doc);
        expect(tbl(s2).content[1].content[0].content[0].content[0].text).toBe('Bolt');
    });

    it('refuses a multi-cell selection and keeps the header intact', () => {
        let s = createState(numbers());
        s = applyTransform(s, (x) => Tbl.selectColumn(x, [0], 1));
        expect(s.selection.type).toBe('cell');
        const s2 = Tbl.setCellFormula(s, '=');                    // the old toolbar path
        expect(s2.doc).toBe(s.doc);
        expect(tbl(s2).content[0].content[1].content[0].content[0].text).toBe('Qty');
    });

    it('replaces a cell that already holds just a formula', () => {
        let s = setFormula(createState(numbers()), 1, 0, '=B2');
        s = applyTransform(at(s, 1, 0), (x) => Tbl.setCellFormula(x, '=C2'));
        expect(formulaSrc(tbl(s).content[1].content[0])).toBe('=C2');
    });
});

describe('addColumnTotal', () => {
    it('appends a total row with an explicit, header-skipping range', () => {
        let s = createState(numbers());
        s = applyTransform(s, (x) => Tbl.addColumnTotal(x, [0], 1));
        expect(tbl(s).content).toHaveLength(4);                   // one appended row
        const totalCell = tbl(s).content[3].content[1];
        expect(isFormulaCell(totalCell)).toBe(true);
        expect(formulaSrc(totalCell)).toBe('=SUM(B2:B3)');        // header row skipped
        expect(valueAt(s, 3, 1)?.value).toBe(14);
        // Header untouched.
        expect(tbl(s).content[0].content[1].content[0].content[0].text).toBe('Qty');
    });

    it('starts at row 1 when the table has no header row', () => {
        let s = createState(table(row(cell('1'), cell('2')), row(cell('3'), cell('4'))));
        s = applyTransform(s, (x) => Tbl.addColumnTotal(x, [0], 0));
        expect(formulaSrc(tbl(s).content[2].content[0])).toBe('=SUM(A1:A2)');
        expect(valueAt(s, 2, 0)?.value).toBe(4);
    });

    it('fullColumnSelection detects a select-column rectangle (toolbar routing)', () => {
        let s = createState(numbers());
        s = applyTransform(s, (x) => Tbl.selectColumn(x, [0], 2));
        expect(Tbl.fullColumnSelection(s.doc, s.selection)).toEqual({ tablePath: [0], col: 2 });
        // A single-cell selection is NOT a full column.
        const one = { ...s, selection: cellSelection([0, 1, 1]) };
        expect(Tbl.fullColumnSelection(one.doc, one.selection)).toBe(null);
    });
});

describe('legacy nested-table healing (deep normalize)', () => {
    it('flattens a table nested in a cell to " | " paragraphs', () => {
        const nested = {
            type: 'table',
            content: [row(cell('n1'), cell('n2')), row(cell('n3'), cell('n4'))],
        };
        const hostCell = {
            type: 'tableCell',
            attrs: null,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'host' }] }, nested],
        };
        const docAst = { type: 'doc', content: [{ type: 'table', content: [row(hostCell, cell('x'))] }] };
        const out = normalizeDeep(docAst);
        const healed = out.content[0].content[0].content[0];
        expect(JSON.stringify(healed)).not.toContain('"table"');
        const texts = healed.content.map((p) => (p.content || []).map((t) => t.text || '').join(''));
        expect(texts).toEqual(['host', 'n1 | n2', 'n3 | n4']);
    });
});

describe('row and column operations by index', () => {
    it('deletes the addressed column', () => {
        let s = createState(numbers());
        s = applyTransform(s, (x) => Tbl.deleteColumnAt(x, [0], 1));   // the Qty column
        const texts = tbl(s).content[0].content.map((c) => c.content?.[0]?.content?.[0]?.text);
        expect(texts).toEqual(['Item', 'Price']);
    });

    it('deletes the column the user pointed at, not a span origin', () => {
        // Column B is covered by the header's colspan, whose origin is A.
        // Routing the delete through the selection resolved to A instead.
        let s = createState(table(
            row(cell('H1+H2', { header: true, colspan: 2 }), cell('H3', { header: true })),
            row(cell('a'), cell('b'), cell('c')),
        ));
        s = applyTransform(s, (x) => Tbl.deleteColumnAt(x, [0], 1));
        expect(tbl(s).content[1].content.map((c) => c.content[0].content[0].text)).toEqual(['a', 'c']);
        // The header narrows rather than vanishing.
        expect(tbl(s).content[0].content[0].attrs.colspan).toBeUndefined();
    });

    it('deletes the addressed row', () => {
        let s = createState(numbers());
        s = applyTransform(s, (x) => Tbl.deleteRowAt(x, [0], 1));       // the Bolt row
        expect(tbl(s).content).toHaveLength(2);
        expect(JSON.stringify(tbl(s))).not.toContain('Bolt');
    });

    it('selects a whole column as a cell rectangle', () => {
        const s = applyTransform(createState(numbers()), (x) => Tbl.selectColumn(x, [0], 1));
        expect(s.selection.type).toBe('cell');
        const rect = Tbl.cellRect(s.doc, s.selection);
        expect(rect.minC).toBe(1);
        expect(rect.maxC).toBe(1);
        expect(rect.cells).toHaveLength(3);
    });

    it('selects a whole row as a cell rectangle', () => {
        const s = applyTransform(createState(numbers()), (x) => Tbl.selectRow(x, [0], 2));
        const rect = Tbl.cellRect(s.doc, s.selection);
        expect(rect.minR).toBe(2);
        expect(rect.maxR).toBe(2);
        expect(rect.cells).toHaveLength(3);
    });
});

describe('reference picking from the view', () => {
    let views = [];
    const make = (doc) => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const view = new EditorView(host, { state: createState(doc) });
        views.push({ view, host });
        return view;
    };
    afterEach(() => { views.forEach(({ view, host }) => { view.destroy(); host.remove(); }); views = []; });

    it('reports the clicked cell as an A1 reference', () => {
        const view = make(numbers());
        const picked = [];
        view.beginRefPick({ tablePath: [0], onPick: (r) => picked.push(r) });
        view.pickRefBetween([0, 1, 1], [0, 1, 1]);
        expect(picked).toEqual(['B2']);
    });

    it('a drag across cells becomes a range', () => {
        const view = make(numbers());
        const picked = [];
        view.beginRefPick({ tablePath: [0], onPick: (r) => picked.push(r) });
        view.pickRefBetween([0, 1, 1], [0, 2, 2]);
        expect(picked.at(-1)).toBe('B2:C3');
    });

    it('marks the host so the table shows a picker cursor', () => {
        const view = make(numbers());
        view.beginRefPick({ tablePath: [0], onPick: () => {} });
        expect(view.host.classList.contains('bf-picking-ref')).toBe(true);
        view.endRefPick();
        expect(view.host.classList.contains('bf-picking-ref')).toBe(false);
    });
});
