import { describe, it, expect } from 'vitest';
import { markdownToAst } from './mdToAst.js';
import { astToHtml } from './astToHtml.js';
import { htmlToAst } from './htmlToAst.js';
import { nodeEq } from '../model/nodes.js';

// These canonical fixtures survive the HTML mirror losslessly (ast → html → ast).
const HTML_SAFE_FIXTURES = [
  '# Heading one',
  '### Heading three',
  'A simple paragraph.',
  'Text with **bold**, *italic*, ~~strike~~ and `code`.',
  'Combined ***bold italic*** word.',
  'A [link](https://example.com) here.',
  'Highlight ==this== please.',
  'Color [red]{color=#ef4444} text.',
  'Underline [under]{u} text.',
  '- one\n- two\n- three',
  '1. first\n2. second\n3. third',
  '- [ ] todo\n- [x] done',
  '- parent\n  - child',
  '> line one\n>\n> line two',
  '```js\nconst x = 1;\n```',
  '```mermaid\ngraph TD; A-->B\n```',
  'Inline $E=mc^2$ math.',
  '![Chart](https://x.com/c.png){w=400 align=left wrap}',
  '---',
  '| Name | Age |\n| :-- | --: |\n| Alice | 30 |\n| Bob | 25 |',
  '# Centered {align=center}',
];

describe('HTML migration round-trip (ast → html → ast)', () => {
  for (const md of HTML_SAFE_FIXTURES) {
    it(`survives the HTML mirror: ${JSON.stringify(md.slice(0, 40))}`, () => {
      const ast = markdownToAst(md);
      const back = htmlToAst(astToHtml(ast));
      expect(nodeEq(ast, back)).toBe(true);
    });
  }

  it('maps <p><br></p> to an empty paragraph', () => {
    const ast = htmlToAst('<p><br></p>');
    expect(ast.content[0].type).toBe('paragraph');
    expect(ast.content[0].content || []).toHaveLength(0);
  });
});

describe('Legacy TipTap shapes', () => {
  it('parses a legacy <img> with style width and data attributes', () => {
    const ast = htmlToAst('<img src="x.png" data-alignment="right" data-text-wrap="true" style="width: 300px">');
    const img = ast.content[0];
    expect(img.type).toBe('image');
    expect(img.attrs.width).toBe(300);
    expect(img.attrs.alignment).toBe('right');
    expect(img.attrs.textWrap).toBe(true);
  });

  it('decodes a legacy mermaid diagram div', () => {
    const ast = htmlToAst('<div data-type="mermaid-diagram" data-code="' + btoa('graph TD; A-->B') + '"></div>');
    expect(ast.content[0].type).toBe('mermaid');
    expect(ast.content[0].attrs.code).toBe('graph TD; A-->B');
  });

  it('parses a resizable-image-wrapper div', () => {
    const html = '<div class="resizable-image-wrapper" data-alignment="left"><img src="y.png" data-width="200"></div>';
    const ast = htmlToAst(html);
    expect(ast.content[0].type).toBe('image');
    expect(ast.content[0].attrs.src).toBe('y.png');
    expect(ast.content[0].attrs.alignment).toBe('left');
  });

  it('parses a plain code block without a language class', () => {
    const ast = htmlToAst('<pre><code>plain text\nline two</code></pre>');
    expect(ast.content[0].type).toBe('codeBlock');
    expect(ast.content[0].content[0].text).toBe('plain text\nline two');
  });

  it('parses a TipTap task list', () => {
    const html = '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked></label><div><p>done</p></div></li></ul>';
    const ast = htmlToAst(html);
    expect(ast.content[0].type).toBe('taskList');
    expect(ast.content[0].content[0].attrs.checked).toBe(true);
  });

  it('wraps loose inline content in a paragraph', () => {
    const ast = htmlToAst('just some <strong>bare</strong> text');
    expect(ast.content[0].type).toBe('paragraph');
    expect(ast.content[0].content.some((n) => n.marks?.some((m) => m.type === 'bold'))).toBe(true);
  });
});
