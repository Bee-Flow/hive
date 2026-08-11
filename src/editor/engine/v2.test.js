import { describe, it, expect, afterEach } from 'vitest';
import { markdownToAst } from '../serialization/mdToAst.js';
import { createState, applyTransform } from './state.js';
import { textSelection, pos } from './selection.js';
import { toggleMark, updateNodeAttrsAtPath, insertText, deleteBackward, deleteForward } from './transforms.js';
import { isActive } from './queries.js';
import { EditorView } from './view.js';
import { cellSelection } from './selection.js';
import * as Tbl from './tables.js';
import { astToMarkdown } from '../serialization/astToMd.js';
import { astToHtml } from '../serialization/astToHtml.js';
import { htmlToAst } from '../serialization/htmlToAst.js';
import { normalizeDeep, normalizeLight } from './normalize.js';

const hasBold = (block) => (block.content || []).some((n) => n.type === 'text' && (n.marks || []).some((m) => m.type === 'bold'));

describe('V2: multi-block mark toggle', () => {
  const twoParas = () => createState(markdownToAst('hello\n\nworld'));

  it('adds the mark across two paragraphs', () => {
    let s = twoParas();
    s = { ...s, selection: textSelection(pos([0], 0), pos([1], 5)) };
    s = applyTransform(s, (x) => toggleMark(x, 'bold'));
    expect(hasBold(s.doc.content[0])).toBe(true);
    expect(hasBold(s.doc.content[1])).toBe(true);
  });

  it('removes the mark when every selected token already has it', () => {
    let s = twoParas();
    s = { ...s, selection: textSelection(pos([0], 0), pos([1], 5)) };
    s = applyTransform(s, (x) => toggleMark(x, 'bold')); // add
    s = { ...s, selection: textSelection(pos([0], 0), pos([1], 5)) };
    s = applyTransform(s, (x) => toggleMark(x, 'bold')); // remove
    expect(hasBold(s.doc.content[0])).toBe(false);
    expect(hasBold(s.doc.content[1])).toBe(false);
  });

  it('respects partial coverage: a partially-bold cross-block selection adds (not removes)', () => {
    let s = twoParas();
    // bold only the first paragraph
    s = { ...s, selection: textSelection(pos([0], 0), pos([0], 5)) };
    s = applyTransform(s, (x) => toggleMark(x, 'bold'));
    // now select across both; not all bold → should ADD bold to the rest
    s = { ...s, selection: textSelection(pos([0], 0), pos([1], 5)) };
    s = applyTransform(s, (x) => toggleMark(x, 'bold'));
    expect(hasBold(s.doc.content[0])).toBe(true);
    expect(hasBold(s.doc.content[1])).toBe(true);
  });

  it('isActive(bold) is true only when the whole cross-block selection is bold', () => {
    let s = twoParas();
    s = { ...s, selection: textSelection(pos([0], 0), pos([1], 5)) };
    expect(isActive(s, 'bold')).toBe(false);
    s = applyTransform(s, (x) => toggleMark(x, 'bold'));
    s = { ...s, selection: textSelection(pos([0], 0), pos([1], 5)) };
    expect(isActive(s, 'bold')).toBe(true);
  });
});

describe('V2: task item checked attr', () => {
  it('updateNodeAttrsAtPath toggles checked on a task item', () => {
    let s = createState(markdownToAst('- [ ] todo\n- [x] done'));
    // doc -> taskList[0] -> taskItem[0]
    const itemPath = [0, 0];
    s = applyTransform(s, (x) => updateNodeAttrsAtPath(x, itemPath, { checked: true }));
    expect(s.doc.content[0].content[0].attrs.checked).toBe(true);
  });
});

describe('V2: grapheme-aware delete (emoji-safe)', () => {
  const firstText = (s) => s.doc.content[0].content[0]?.text ?? '';

  it('backspace removes a whole emoji (surrogate pair), not half', () => {
    let s = createState(markdownToAst('a👍'));
    const len = firstText(s).length; // 'a' + surrogate pair = 3 code units
    s = { ...s, selection: textSelection(pos([0], len)) };
    s = applyTransform(s, (x) => deleteBackward(x));
    expect(firstText(s)).toBe('a');
  });

  it('forward-delete removes a whole emoji', () => {
    let s = createState(markdownToAst('👍b'));
    s = { ...s, selection: textSelection(pos([0], 0)) };
    s = applyTransform(s, (x) => deleteForward(x));
    expect(firstText(s)).toBe('b');
  });

  it('backspace removes a ZWJ emoji sequence as one unit', () => {
    const family = '👨‍👩‍👧'; // man + ZWJ + woman + ZWJ + girl
    let s = createState(markdownToAst(`x${family}`));
    const len = firstText(s).length;
    s = { ...s, selection: textSelection(pos([0], len)) };
    s = applyTransform(s, (x) => deleteBackward(x));
    expect(firstText(s)).toBe('x');
  });

  it('plain backspace still removes a single character', () => {
    let s = createState(markdownToAst('abc'));
    s = { ...s, selection: textSelection(pos([0], 3)) };
    s = applyTransform(s, (x) => deleteBackward(x));
    expect(firstText(s)).toBe('ab');
  });
});

describe('V2: URL sanitization (paste/import XSS)', () => {
  it('strips javascript: links on import and export', () => {
    const ast = htmlToAst('<p><a href="javascript:alert(1)">x</a></p>');
    const linkMark = ast.content[0].content[0].marks.find((m) => m.type === 'link');
    expect(linkMark.attrs?.href || '').toBe(''); // stripped at parse
    const html = astToHtml({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] });
    expect(html).not.toContain('javascript:');
  });

  it('strips javascript: image src but keeps http(s)', () => {
    const bad = htmlToAst('<img src="javascript:alert(1)">');
    expect(bad.content[0].attrs.src).toBe('');
    const ok = htmlToAst('<img src="https://x.test/a.png">');
    expect(ok.content[0].attrs.src).toBe('https://x.test/a.png');
  });

  it('allows data:image but blocks other data: URLs', () => {
    expect(htmlToAst('<img src="data:image/png;base64,AAA">').content[0].attrs.src).toBe('data:image/png;base64,AAA');
    expect(htmlToAst('<img src="data:text/html,<script>">').content[0].attrs.src).toBe('');
  });
});

describe('V2: table cell selection + column ops', () => {
  // 3x2 table; doc.content[0] = table, rows [0,1,2], cols [0,1]
  const tableDoc = () => createState(markdownToAst('| a | b |\n| - | - |\n| c | d |\n| e | f |'));
  const cellPath = (r, c) => [0, r, c];

  it('cellRect spans the rectangle between anchor and head', () => {
    const s = tableDoc();
    const sel = cellSelection(cellPath(0, 0), cellPath(2, 1));
    const rect = Tbl.cellRect(s.doc, sel);
    expect(rect.cells.length).toBe(6);
    expect(rect.minR).toBe(0); expect(rect.maxR).toBe(2);
    expect(rect.minC).toBe(0); expect(rect.maxC).toBe(1);
  });

  it('clearCells empties every cell in the rectangle', () => {
    let s = tableDoc();
    s = { ...s, selection: cellSelection(cellPath(1, 0), cellPath(2, 1)) };
    s = applyTransform(s, (x) => Tbl.clearCells(x));
    const text = (r, c) => (s.doc.content[0].content[r].content[c].content[0].content || []).length;
    expect(text(1, 0)).toBe(0);
    expect(text(2, 1)).toBe(0);
    // header row untouched (table → row0 → cell0 → paragraph → text)
    expect(s.doc.content[0].content[0].content[0].content[0].content[0].text).toBe('a');
  });

  it('setCellAlign applies to all selected cells', () => {
    let s = tableDoc();
    s = { ...s, selection: cellSelection(cellPath(1, 0), cellPath(2, 1)) };
    s = applyTransform(s, (x) => Tbl.setCellAlign(x, 'center'));
    expect(s.doc.content[0].content[1].content[0].attrs.align).toBe('center');
    expect(s.doc.content[0].content[2].content[1].attrs.align).toBe('center');
  });

  it('setColumnWidth sets colwidth on every cell in the column and round-trips through HTML', () => {
    let s = tableDoc();
    s = { ...s, selection: textSelection(pos(cellPath(0, 1).concat(0), 0)) };
    s = applyTransform(s, (x) => Tbl.setColumnWidth(x, 1, 250));
    expect(s.doc.content[0].content[0].content[1].attrs.colwidth).toBe(250);
    const html = astToHtml(s.doc);
    expect(html).toContain('width:250px');
    const back = htmlToAst(html);
    expect(back.content[0].content[0].content[1].attrs.colwidth).toBe(250);
  });

  it('column width survives the Markdown mirror', () => {
    // The AI tools read and write the Markdown mirror, so a width dropped here
    // was reset on the user's document the first time an AI edit touched it.
    let s = tableDoc();
    s = { ...s, selection: textSelection(pos(cellPath(0, 1).concat(0), 0)) };
    s = applyTransform(s, (x) => Tbl.setColumnWidth(x, 1, 250));
    const md = astToMarkdown(s.doc);
    expect(md).toContain('w=250');
    const back = markdownToAst(md);
    expect(back.content[0].content[0].content[1].attrs.colwidth).toBe(250);
    // The marker itself must not leak into the cell's visible text.
    expect(JSON.stringify(back)).not.toContain('"text":"w=250"');
  });

  it('cellRectToText serializes a rectangle to tab/newline text', () => {
    const s = tableDoc();
    const rect = Tbl.cellRect(s.doc, cellSelection(cellPath(0, 0), cellPath(1, 1)));
    expect(Tbl.cellRectToText(s.doc, rect)).toBe('a\tb\nc\td');
  });
});

describe('V2: incremental reconciler', () => {
  let views = [];
  const make = (md, opts = {}) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = new EditorView(host, { state: createState(markdownToAst(md)), ...opts });
    views.push({ view, host });
    return { view, host };
  };
  afterEach(() => { views.forEach(({ view, host }) => { view.destroy(); host.remove(); }); views = []; });

  it('preserves the caret text node when typing (patches .data in place)', () => {
    const { view, host } = make('hello');
    const textNode = host.querySelector('p').firstChild;
    expect(textNode.nodeType).toBe(3);
    view.state = { ...view.state, selection: textSelection(pos([0], 5)) };
    view.dispatch((s) => insertText(s, 'x'));
    // Same DOM Text object survived — the browser caret/IME/spellcheck stay anchored.
    expect(host.querySelector('p').firstChild).toBe(textNode);
    expect(textNode.data).toBe('hellox');
  });

  it('does not re-render an unrelated block when editing another', () => {
    const { view, host } = make('one\n\ntwo');
    const firstP = host.querySelectorAll('p')[0];
    view.state = { ...view.state, selection: textSelection(pos([1], 3)) };
    view.dispatch((s) => insertText(s, '!'));
    expect(host.querySelectorAll('p')[0]).toBe(firstP); // untouched
    expect(host.querySelectorAll('p')[1].textContent).toBe('two!');
  });

  it('does not unmount an atom when editing a sibling block', () => {
    let mounts = 0;
    let unmounts = 0;
    const { view, host } = make('![a](x.png)\n\nhello', {
      mountAtom: () => { mounts += 1; },
      unmountAtom: () => { unmounts += 1; },
      remapAtom: () => {},
    });
    const atomHost = host.querySelector('[data-bf-atom]');
    expect(mounts).toBe(1);
    view.state = { ...view.state, selection: textSelection(pos([1], 5)) };
    view.dispatch((s) => insertText(s, '!'));
    expect(unmounts).toBe(0);
    expect(mounts).toBe(1);
    expect(host.querySelector('[data-bf-atom]')).toBe(atomHost); // same host element
  });

  it('remaps an atom portal on attr change instead of unmounting', () => {
    let unmounts = 0;
    let remaps = 0;
    const { view, host } = make('![a](x.png)\n\nhello', {
      mountAtom: () => {},
      unmountAtom: () => { unmounts += 1; },
      remapAtom: () => { remaps += 1; },
    });
    const atomHost = host.querySelector('[data-bf-atom]');
    const imgNode = view.state.doc.content[0];
    view.updateAtom(imgNode, { width: 120 });
    expect(unmounts).toBe(0);
    expect(remaps).toBe(1);
    expect(host.querySelector('[data-bf-atom]')).toBe(atomHost);
  });
});

describe('V2: normalize canonicalizes formula cells (deep pass only)', () => {
  // A formula cell that picked up whitespace strays around its atom.
  const messyDoc = () => ({
    type: 'doc',
    content: [{
      type: 'table',
      content: [{
        type: 'tableRow',
        content: [{
          type: 'tableCell',
          content: [{
            type: 'paragraph',
            content: [
              { type: 'text', text: ' ' },
              { type: 'formula', attrs: { src: '=1+1' } },
              { type: 'text', text: '  ' },
            ],
          }],
        }],
      }],
    }],
  });

  it('normalizeDeep strips whitespace strays down to [paragraph[formula]]', () => {
    const d = normalizeDeep(messyDoc());
    const cell = d.content[0].content[0].content[0];
    expect(cell.content).toHaveLength(1);
    expect(cell.content[0].type).toBe('paragraph');
    expect(cell.content[0].content).toHaveLength(1);
    expect(cell.content[0].content[0].type).toBe('formula');
    expect(cell.content[0].content[0].attrs.value).toBe('2'); // recompute still ran
  });

  it('normalizeLight leaves the strays alone (selection safety) but still recomputes', () => {
    const d = normalizeLight(messyDoc());
    const inl = d.content[0].content[0].content[0].content[0].content;
    expect(inl).toHaveLength(3);                    // strays untouched
    expect(inl[1].type).toBe('formula');
    expect(inl[1].attrs.value).toBe('2');           // atom found by search, not position
  });
});
