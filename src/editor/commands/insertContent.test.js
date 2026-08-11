import { describe, it, expect } from 'vitest';
import { markdownToAst } from '../serialization/mdToAst.js';
import { createState, applyTransform } from '../engine/state.js';
import { insertContentCmd } from './index.js';

const emptyState = () => createState(markdownToAst(''));
const insert = (content) => applyTransform(emptyState(), (s) => insertContentCmd(s, content));

/**
 * String routing (#5): DOCX import and "insert to document" pass HTML, which
 * used to be parsed as Markdown so the tags landed as literal text.
 */
describe('insertContent string routing', () => {
  it('parses an HTML string as HTML — bold node, no literal tags', () => {
    const s = insert('<p><strong>x</strong></p>');
    const para = s.doc.content[0];
    expect(para.type).toBe('paragraph');
    const textNode = para.content.find((n) => n.type === 'text');
    expect(textNode.text).toBe('x');
    expect(textNode.marks.some((m) => m.type === 'bold')).toBe(true);
    expect(JSON.stringify(s.doc)).not.toContain('<p>');
  });

  it('still parses Markdown — # Title becomes a heading', () => {
    const s = insert('# Title');
    const heading = s.doc.content.find((n) => n.type === 'heading');
    expect(heading).toBeTruthy();
    expect(heading.content[0].text).toBe('Title');
  });

  it('a plain-text fragment inserts inline at the caret', () => {
    let s = createState(markdownToAst('ab'));
    s = { ...s, selection: { ...s.selection, anchor: { path: [0], offset: 1 }, head: { path: [0], offset: 1 } } };
    s = applyTransform(s, (x) => insertContentCmd(x, 'X'));
    expect(s.doc.content).toHaveLength(1);
    expect(s.doc.content[0].content[0].text).toBe('aXb');
  });

  it('an HTML table inserts as a table node', () => {
    const s = insert('<table><tr><th>a</th></tr><tr><td>1</td></tr></table>');
    expect(s.doc.content.some((n) => n.type === 'table')).toBe(true);
  });
});
