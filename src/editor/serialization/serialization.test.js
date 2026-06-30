import { describe, it, expect } from 'vitest';
import { markdownToAst } from './mdToAst.js';
import { astToMarkdown } from './astToMd.js';
import { astToHtml } from './astToHtml.js';
import { decodeFromAttr } from './util.js';
import { nodeEq } from '../model/nodes.js';

/**
 * Canonical BFM fixtures — each string is already in the exact form astToMarkdown
 * emits, so md → ast → md is an identity (after trim). This locks both the parser
 * and the serializer against drift.
 */
const FIXTURES = [
  '# Heading one',
  '## Heading two',
  '### Heading three',
  'A simple paragraph.',
  'Text with **bold**, *italic*, ~~strike~~ and `code`.',
  'Combined ***bold italic*** word.',
  'A [link](https://example.com) here.',
  'Highlight ==this== please.',
  'Color [red]{color=#ef4444} text.',
  'Font [serif]{font=Georgia} text.',
  'Underline [under]{u} text.',
  '- one\n- two\n- three',
  '1. first\n2. second\n3. third',
  '- [ ] todo\n- [x] done',
  '- parent\n  - child',
  '> a quote',
  '> line one\n>\n> line two',
  '```js\nconst x = 1;\n```',
  '```mermaid\ngraph TD; A-->B\n```',
  '$$\nE = mc^2\n$$',
  'Inline $E=mc^2$ math.',
  '![Alt](https://x.com/a.png)',
  '![Chart](https://x.com/c.png){w=400 align=left wrap}',
  '---',
  '| Name | Age |\n| :-- | --: |\n| Alice | 30 |\n| Bob | 25 |',
  '# Centered {align=center}',
  'Some text {align=center}',
];

describe('Markdown round-trip (md → ast → md)', () => {
  for (const md of FIXTURES) {
    it(`is stable for: ${JSON.stringify(md.slice(0, 40))}`, () => {
      const ast = markdownToAst(md);
      const out = astToMarkdown(ast).trim();
      expect(out).toBe(md.trim());
    });
  }
});

describe('AST round-trip (ast → md → ast)', () => {
  for (const md of FIXTURES) {
    it(`is structurally stable for: ${JSON.stringify(md.slice(0, 40))}`, () => {
      const ast = markdownToAst(md);
      const again = markdownToAst(astToMarkdown(ast));
      expect(nodeEq(ast, again)).toBe(true);
    });
  }
});

describe('HTML rendering (export/display mirror)', () => {
  it('emits export-compatible image markup', () => {
    const html = astToHtml(markdownToAst('![Chart](https://x.com/c.png){w=400 align=left wrap}'));
    expect(html).toContain('class="notebook-image"');
    expect(html).toContain('data-alignment="left"');
    expect(html).toContain('data-width="400"');
    expect(html).toContain('data-text-wrap="true"');
    expect(html).toContain('style="width: 400px"');
  });

  it('emits mermaid base64 div that decodes back to the source', () => {
    const code = 'graph TD; A-->B';
    const html = astToHtml(markdownToAst('```mermaid\n' + code + '\n```'));
    const m = html.match(/data-code="([^"]+)"/);
    expect(m).toBeTruthy();
    expect(decodeFromAttr(m[1])).toBe(code);
  });

  it('renders marks and links', () => {
    const html = astToHtml(markdownToAst('Text with **bold** and a [link](https://x.com).'));
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<a href="https://x.com"');
    expect(html).toContain('class="notebook-link"');
  });

  it('renders block alignment as text-align', () => {
    const html = astToHtml(markdownToAst('# Centered {align=center}'));
    expect(html).toContain('style="text-align:center"');
  });

  it('renders task lists with data-type', () => {
    const html = astToHtml(markdownToAst('- [x] done'));
    expect(html).toContain('data-type="taskList"');
    expect(html).toContain('data-checked="true"');
  });
});

describe('Parser specifics', () => {
  it('parses an empty document to a single empty paragraph', () => {
    const ast = markdownToAst('');
    expect(ast.content).toHaveLength(1);
    expect(ast.content[0].type).toBe('paragraph');
  });

  it('treats a standalone image line as a block image node', () => {
    const ast = markdownToAst('![A](b.png)');
    expect(ast.content[0].type).toBe('image');
  });

  it('decodes task item checked state', () => {
    const ast = markdownToAst('- [x] done\n- [ ] todo');
    const list = ast.content[0];
    expect(list.type).toBe('taskList');
    expect(list.content[0].attrs.checked).toBe(true);
    expect(list.content[1].attrs?.checked ?? false).toBe(false);
  });

  it('combines color and font into one textStyle mark', () => {
    const ast = markdownToAst('[x]{color=#ef4444 font=Georgia}');
    const textNode = ast.content[0].content[0];
    const ts = textNode.marks.find((m) => m.type === 'textStyle');
    expect(ts.attrs.color).toBe('#ef4444');
    expect(ts.attrs.fontFamily).toBe('Georgia');
  });
});
