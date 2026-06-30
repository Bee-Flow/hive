import { describe, it, expect } from 'vitest';
import { markdownToAst } from './mdToAst.js';
import { astToMarkdown } from './astToMd.js';
import { astToHtml } from './astToHtml.js';
import { htmlToAst } from './htmlToAst.js';

const SPEC = '{"type":"bar","title":"Sales","labels":["Q1","Q2"],"series":[{"name":"Revenue","data":[10,20]}]}';
const MD = '```chart\n' + SPEC + '\n```\n';

describe('chart serialization', () => {
  it('parses a ```chart fenced block into a chart node', () => {
    const ast = markdownToAst(MD);
    const chart = ast.content.find((b) => b.type === 'chart');
    expect(chart).toBeTruthy();
    expect(JSON.parse(chart.attrs.spec).title).toBe('Sales');
  });

  it('round-trips through Markdown', () => {
    const md2 = astToMarkdown(markdownToAst(MD));
    expect(md2).toContain('```chart');
    expect(md2).toContain('"title":"Sales"');
    expect(astToMarkdown(markdownToAst(md2))).toBe(md2);
  });

  it('exports a static data table to HTML and round-trips via htmlToAst', () => {
    const ast = markdownToAst(MD);
    const html = astToHtml(ast);
    expect(html).toContain('data-type="chart"');
    expect(html).toContain('<figcaption>Sales</figcaption>');
    expect(html).toContain('Revenue');
    // HTML → AST preserves the spec
    const back = htmlToAst(html);
    const chart = back.content.find((b) => b.type === 'chart');
    expect(chart).toBeTruthy();
    expect(JSON.parse(chart.attrs.spec).labels).toEqual(['Q1', 'Q2']);
  });
});
