import { describe, it, expect } from 'vitest';
import { markdownToAst } from './mdToAst.js';
import { astToMarkdown } from './astToMd.js';

/**
 * Table-sniff guard: a '|' line only opens a table when the next line is a
 * delimiter row with the SAME cell count. A bare '---' (one cell) after a
 * two-cell line used to produce a phantom table swallowing the rule (#6).
 */
describe('table sniff cell-count guard', () => {
  it("'price | qty' + '---' is paragraph + HR + paragraph, not a table", () => {
    const ast = markdownToAst('price | qty\n---\nnext');
    expect(ast.content.map((n) => n.type)).toEqual(['paragraph', 'horizontalRule', 'paragraph']);
    expect(ast.content[0].content[0].text).toBe('price | qty');
  });

  it('the guard also applies mid-paragraph (isBlockStart mirror)', () => {
    const ast = markdownToAst('intro line\nprice | qty\n---\nnext');
    expect(ast.content.map((n) => n.type)).toEqual(['paragraph', 'horizontalRule', 'paragraph']);
    // Both lines stay in one paragraph joined by a hard break.
    expect(ast.content[0].content.some((n) => n.type === 'hardBreak')).toBe(true);
  });

  it('a minimal GFM table still parses', () => {
    const ast = markdownToAst('a|b\n-|-\n1|2');
    expect(ast.content).toHaveLength(1);
    expect(ast.content[0].type).toBe('table');
    const rows = ast.content[0].content;
    expect(rows).toHaveLength(2);
    expect(rows[0].content).toHaveLength(2);
    expect(rows[0].content[0].attrs.header).toBe(true);
  });

  it('a piped-and-aligned table still parses and round-trips', () => {
    const md = '| Name | Age |\n| :-- | --: |\n| Alice | 30 |\n| Bob | 25 |';
    const ast = markdownToAst(md);
    expect(ast.content[0].type).toBe('table');
    expect(astToMarkdown(ast).trim()).toBe(md);
  });

  it('a mismatched delimiter (3 header cells, 2 dashes) is not a table', () => {
    const ast = markdownToAst('a | b | c\n- | -');
    expect(ast.content.some((n) => n.type === 'table')).toBe(false);
  });
});
