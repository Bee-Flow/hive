import { describe, it, expect } from 'vitest';
import { colLabel, colToIndex, parseAnyRef, evaluateTable, displayResult, isFormulaCell } from './formula.js';

// Build a table node from a 2D array of cell strings. A string starting with '='
// becomes a formula cell; everything else is a plain-text cell.
function table(grid) {
  return {
    type: 'table',
    content: grid.map((row) => ({
      type: 'tableRow',
      content: row.map((s) => {
        const inl = typeof s === 'string' && s.startsWith('=')
          ? [{ type: 'formula', attrs: { src: s } }]
          : [{ type: 'text', text: String(s) }];
        return { type: 'tableCell', content: [{ type: 'paragraph', content: inl }] };
      }),
    })),
  };
}
const disp = (grid, r, c) => displayResult(evaluateTable(table(grid)).get(`${r},${c}`));

describe('A1 ref helpers', () => {
  it('colLabel / colToIndex round-trip', () => {
    expect(colLabel(0)).toBe('A');
    expect(colLabel(25)).toBe('Z');
    expect(colLabel(26)).toBe('AA');
    expect(colToIndex('A')).toBe(0);
    expect(colToIndex('AA')).toBe(26);
  });
  it('parseAnyRef handles cells and columns', () => {
    expect(parseAnyRef('B3')).toEqual({ r: 2, c: 1, col: false });
    expect(parseAnyRef('C')).toEqual({ c: 2, col: true });
    expect(parseAnyRef('!!')).toBeNull();
  });
});

describe('formula evaluation', () => {
  it('arithmetic with precedence, parens, unary minus and %', () => {
    expect(disp([['=1+2*3']], 0, 0)).toBe('7');
    expect(disp([['=(1+2)*3']], 0, 0)).toBe('9');
    expect(disp([['=-2+5']], 0, 0)).toBe('3');
    expect(disp([['=50%']], 0, 0)).toBe('0.5');
  });

  it('cell references and ranges', () => {
    const g = [['1', '2', '=A1+B1'], ['3', '4', '=SUM(A1:B2)'], ['', '', '=AVERAGE(A1:A2)']];
    expect(disp(g, 0, 2)).toBe('3');     // A1+B1
    expect(disp(g, 1, 2)).toBe('10');    // SUM(1,2,3,4)
    expect(disp(g, 2, 2)).toBe('2');     // AVERAGE(1,3)
  });

  it('whole-column ranges + MIN/MAX/COUNT/PRODUCT', () => {
    const g = [['10'], ['20'], ['30'], ['=MAX(A1:A3)'], ['=MIN(A1:A3)'], ['=COUNT(A1:A3)'], ['=PRODUCT(A1:A2)']];
    expect(disp(g, 3, 0)).toBe('30');
    expect(disp(g, 4, 0)).toBe('10');
    expect(disp(g, 5, 0)).toBe('3');
    expect(disp(g, 6, 0)).toBe('200');
  });

  it('text and empty cells are ignored by aggregates, treated as 0 in arithmetic', () => {
    const g = [['5', 'hello', ''], ['=SUM(A1:C1)', '=COUNT(A1:C1)', '=A1+B1']];
    expect(disp(g, 1, 0)).toBe('5');   // SUM ignores text + empty
    expect(disp(g, 1, 1)).toBe('1');   // COUNT counts only the number
    expect(disp(g, 1, 2)).toBe('5');   // 5 + text(0)
  });

  it('nested formula references recompute transitively', () => {
    const g = [['2'], ['=A1*3'], ['=A2+4']];
    expect(disp(g, 1, 0)).toBe('6');
    expect(disp(g, 2, 0)).toBe('10');
  });

  it('division by zero → #DIV/0! and propagates to dependents', () => {
    const g = [['=1/0'], ['=A1+1']];
    expect(disp(g, 0, 0)).toBe('#DIV/0!');
    expect(disp(g, 1, 0)).toBe('#DIV/0!');
  });

  it('circular references → #CIRC!', () => {
    const g = [['=B1', '=A1']];
    expect(disp(g, 0, 0)).toBe('#CIRC!');
  });

  it('unknown function → #NAME?, malformed → #ERR!', () => {
    expect(disp([['=FOO(1)']], 0, 0)).toBe('#NAME?');
    expect(disp([['=1+']], 0, 0)).toBe('#ERR!');
  });

  it('a bare "=" (empty formula) renders blank, and counts as empty when referenced', () => {
    expect(disp([['=']], 0, 0)).toBe('');
    expect(disp([['=', '=A1+5']], 0, 1)).toBe('5'); // empty A1 → 0 in arithmetic
  });

  it('isFormulaCell detects a single-formula cell', () => {
    const t = table([['=1+1', 'plain']]);
    expect(isFormulaCell(t.content[0].content[0])).toBe(true);
    expect(isFormulaCell(t.content[0].content[1])).toBe(false);
  });
});
