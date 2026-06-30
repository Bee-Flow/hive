import { describe, it, expect, afterEach } from 'vitest';
import { EditorView } from '../engine/view.js';
import { createState } from '../engine/state.js';
import { makeFacade } from './editorFacade.js';
import { markdownToAst } from '../serialization/mdToAst.js';
import { textSelection, pos } from '../engine/selection.js';

let views = [];
function setup(md) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const view = new EditorView(host, { state: createState(markdownToAst(md)) });
  views.push({ view, host });
  return { view, editor: makeFacade(view), host };
}
const range = (view, a, b) => { view.state = { ...view.state, selection: textSelection(pos([0], a), pos([0], b)) }; };
const caret = (view, a) => { view.state = { ...view.state, selection: textSelection(pos([0], a)) }; };

afterEach(() => { views.forEach(({ view, host }) => { view.destroy(); host.remove(); }); views = []; });

describe('toolbar commands via the getEditor() facade', () => {
  it('Bold / Italic / Underline / Strike toggle on a selection', () => {
    const { view, editor } = setup('hello');
    range(view, 0, 5);
    editor.chain().focus().toggleBold().run();
    expect(editor.getMarkdown().trim()).toBe('**hello**');
    range(view, 0, 5);
    editor.chain().focus().toggleItalic().run();
    expect(editor.getHTML()).toContain('<em>');
    range(view, 0, 5);
    editor.chain().focus().toggleUnderline().run();
    expect(editor.getHTML()).toContain('<u>');
    range(view, 0, 5);
    editor.chain().focus().toggleStrike().run();
    expect(editor.getHTML()).toContain('<s>');
  });

  it('Color picker applies and resets a text color', () => {
    const { view, editor } = setup('hello');
    range(view, 0, 5);
    editor.chain().focus().setColor('#ef4444').run();
    expect(editor.getHTML()).toContain('color: #ef4444');
    expect(editor.isActive('textStyle') || editor.getAttributes('textStyle').color === '#ef4444').toBeTruthy();
    range(view, 0, 5);
    editor.chain().focus().unsetColor().run();
    expect(editor.getHTML()).not.toContain('#ef4444');
  });

  it('Font picker applies a font family', () => {
    const { view, editor } = setup('hello');
    range(view, 0, 5);
    editor.chain().focus().setFontFamily('Georgia').run();
    expect(editor.getHTML()).toContain('font-family: Georgia');
  });

  it('Highlight toggles a mark', () => {
    const { view, editor } = setup('hello');
    range(view, 0, 5);
    editor.chain().focus().toggleHighlight().run();
    expect(editor.getHTML()).toContain('<mark');
  });

  it('Headings and lists toggle', () => {
    const { view, editor } = setup('hello');
    caret(view, 1);
    editor.chain().focus().toggleHeading({ level: 2 }).run();
    expect(editor.getMarkdown().trim()).toBe('## hello');
    caret(view, 1);
    editor.chain().focus().toggleBulletList().run();
    expect(editor.getHTML()).toContain('<ul>');
    editor.chain().focus().toggleTaskList().run();
    expect(editor.getHTML()).toContain('data-type="taskList"');
  });

  it('Alignment sets text-align', () => {
    const { view, editor } = setup('hello');
    caret(view, 1);
    editor.chain().focus().setTextAlign('center').run();
    expect(editor.getHTML()).toContain('text-align:center');
  });

  it('Undo / Redo and can() flags work', () => {
    const { view, editor } = setup('hello');
    expect(editor.can().undo()).toBe(false);
    range(view, 0, 5);
    editor.chain().focus().toggleBold().run();
    expect(editor.can().undo()).toBe(true);
    editor.chain().focus().undo().run();
    expect(editor.getMarkdown().trim()).toBe('hello');
    editor.chain().focus().redo().run();
    expect(editor.getMarkdown().trim()).toBe('**hello**');
  });

  it('Table insert + row/column ops work', () => {
    const { view, editor } = setup('text');
    caret(view, 4);
    editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
    expect(editor.isActive('table')).toBe(true);
    const cols0 = editor.getHTML().match(/<t[hd]/g).length;
    editor.chain().focus().addColumnAfter().run();
    const cols1 = editor.getHTML().match(/<t[hd]/g).length;
    expect(cols1).toBeGreaterThan(cols0);
  });

  it('Link mark applies to a selection', () => {
    const { view, editor } = setup('hello');
    range(view, 0, 5);
    editor.chain().focus().setLink({ href: 'https://x.com' }).run();
    expect(editor.getHTML()).toContain('href="https://x.com"');
  });
});
