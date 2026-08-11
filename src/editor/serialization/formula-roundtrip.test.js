import { describe, it, expect } from 'vitest';
import { markdownToAst } from './mdToAst.js';
import { astToMarkdown } from './astToMd.js';
import { astToHtml } from './astToHtml.js';
import { isFormulaCell } from '../engine/formula.js';

// A1 is the literal top-left cell (the header here), so data lives in rows 2-3.
const MD = `| A | B |\n| --- | --- |\n| 1 | =A2+10 |\n| 2 | =SUM(A2:A3) |\n`;

describe('formula serialization', () => {
  it('parses a =… cell into a formula atom', () => {
    const ast = markdownToAst(MD);
    const table = ast.content.find((b) => b.type === 'table');
    const b2 = table.content[1].content[1]; // data row 1, col B → =A2+10
    expect(isFormulaCell(b2)).toBe(true);
    expect(b2.content[0].content[0].attrs.src).toBe('=A2+10');
    // plain header text is not a formula
    expect(isFormulaCell(table.content[0].content[0])).toBe(false);
  });

  it('header-cell formulas survive the MD round-trip (S9)', () => {
    const md = '| =SUM(A2:A3) | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |';
    const ast = markdownToAst(md);
    const headCell = ast.content[0].content[0].content[0];
    expect(isFormulaCell(headCell)).toBe(true);
    expect(headCell.content[0].content[0].attrs.src).toBe('=SUM(A2:A3)');
    const md2 = astToMarkdown(ast);
    expect(md2).toContain('=SUM(A2:A3)');
    expect(astToMarkdown(markdownToAst(md2))).toBe(md2);   // stable second pass
  });

  it("'= B3' and a bare '=' parse as formula atoms", () => {
    const md = '| A | B |\n| --- | --- |\n| = B3 | = |';
    const table = markdownToAst(md).content[0];
    const c0 = table.content[1].content[0];
    const c1 = table.content[1].content[1];
    expect(isFormulaCell(c0)).toBe(true);
    expect(c0.content[0].content[0].attrs.src).toBe('= B3');
    expect(isFormulaCell(c1)).toBe(true);
    expect(c1.content[0].content[0].attrs.src).toBe('=');
  });

  it("escaped '\\=' stays literal text", () => {
    const md = '| A |\n| --- |\n| \\=not a formula |';
    const table = markdownToAst(md).content[0];
    const cellNode = table.content[1].content[0];
    expect(isFormulaCell(cellNode)).toBe(false);
    expect(cellNode.content[0].content[0].text).toBe('=not a formula');
  });

  it('round-trips the formula source through Markdown', () => {
    const ast = markdownToAst(MD);
    const md2 = astToMarkdown(ast);
    expect(md2).toContain('=A2+10');
    expect(md2).toContain('=SUM(A2:A3)');
    // and a second parse is stable
    const md3 = astToMarkdown(markdownToAst(md2));
    expect(md3).toBe(md2);
  });

  it('exports the COMPUTED value to HTML with a data-formula round-trip hook', () => {
    const html = astToHtml(markdownToAst(MD));
    expect(html).toContain('data-formula="=A2+10"');
    expect(html).toContain('>11<'); // A2(1) + 10
    expect(html).toContain('>3<');  // SUM(A2,A3) = 1 + 2
  });
});
