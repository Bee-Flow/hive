/**
 * commands/index.js — command registry.
 *
 * Each command is a factory `(...args) => (state) => state`. The view's chain()
 * shim composes them so `editor.chain().focus().toggleBold().run()` ports from
 * the existing toolbar JSX with only the import changed. View-level commands
 * (focus, undo, redo, setContent, *Markdown) are handled in view.js.
 */
import * as T from '../engine/transforms.js';
import * as Tbl from '../engine/tables.js';
import { markdownToAst } from '../serialization/mdToAst.js';
import { isTextblock } from '../model/schema.js';

const id = (s) => s;

export const commands = {
  /* marks */
  toggleBold: () => (s) => T.toggleMark(s, 'bold'),
  toggleItalic: () => (s) => T.toggleMark(s, 'italic'),
  toggleUnderline: () => (s) => T.toggleMark(s, 'underline'),
  toggleStrike: () => (s) => T.toggleMark(s, 'strike'),
  toggleCode: () => (s) => T.toggleMark(s, 'code'),
  toggleHighlight: (attrs) => (s) => (attrs?.color ? T.setMark(s, 'highlight', { color: attrs.color }) : T.toggleMark(s, 'highlight')),
  setColor: (color) => (s) => T.setMarkAttrs(s, 'textStyle', { color }),
  unsetColor: () => (s) => T.setMarkAttrs(s, 'textStyle', { color: null }),
  setFontFamily: (fontFamily) => (s) => T.setMarkAttrs(s, 'textStyle', { fontFamily }),
  unsetFontFamily: () => (s) => T.setMarkAttrs(s, 'textStyle', { fontFamily: null }),
  setLink: (attrs) => (s) => T.setMark(s, 'link', { href: attrs?.href || '' }),
  unsetLink: () => (s) => T.unsetMark(s, 'link'),

  /* blocks */
  setParagraph: () => (s) => T.setBlockType(s, 'paragraph'),
  toggleHeading: (attrs) => (s) => T.toggleBlockType(s, 'heading', { level: attrs?.level || 1 }),
  setHeading: (attrs) => (s) => T.setBlockType(s, 'heading', { level: attrs?.level || 1 }),
  toggleBulletList: () => (s) => T.toggleList(s, 'bulletList'),
  toggleOrderedList: () => (s) => T.toggleList(s, 'orderedList'),
  toggleTaskList: () => (s) => T.toggleList(s, 'taskList'),
  toggleBlockquote: () => (s) => T.toggleBlockquote(s),
  setCodeBlock: () => (s) => T.setBlockType(s, 'codeBlock'),
  setTextAlign: (align) => (s) => T.setTextAlign(s, align),
  sinkListItem: () => (s) => T.sinkListItem(s),
  liftListItem: () => (s) => T.liftListItem(s),

  /* atoms */
  setImage: (attrs) => (s) => T.insertBlockNode(s, { type: 'image', attrs }),
  insertMermaid: (code) => (s) => T.insertBlockNode(s, { type: 'mermaid', attrs: { code } }),
  insertMermaidDiagram: (code) => (s) => T.insertBlockNode(s, { type: 'mermaid', attrs: { code } }),
  insertHorizontalRule: () => (s) => T.insertBlockNode(s, { type: 'horizontalRule' }),
  setHorizontalRule: () => (s) => T.insertBlockNode(s, { type: 'horizontalRule' }),
  updateAttributes: (_name, attrs) => (s) => T.updateNodeAttrs(s, attrs),

  /* tables */
  insertTable: (opts) => (s) => T.insertBlockNode(s, Tbl.makeTable(opts?.rows || 3, opts?.cols || 3, opts?.withHeaderRow !== false)),
  addRowAfter: () => Tbl.addRowAfter,
  addRowBefore: () => Tbl.addRowBefore,
  addColumnAfter: () => Tbl.addColumnAfter,
  addColumnBefore: () => Tbl.addColumnBefore,
  appendRow: () => Tbl.appendRow,
  appendColumn: () => Tbl.appendColumn,
  toggleHeaderRow: () => Tbl.toggleHeaderRow,
  setCellFormula: (src) => (s) => Tbl.setCellFormula(s, src),
  insertAfterTable: (blockNode) => (s) => Tbl.insertAfterTable(s, blockNode),
  deleteRow: () => Tbl.deleteRow,
  deleteColumn: () => Tbl.deleteColumn,
  deleteTable: () => Tbl.deleteTable,
  setCellAlign: (align) => (s) => Tbl.setCellAlign(s, align),
  clearCells: () => (s) => Tbl.clearCells(s),
  setColumnWidth: (colIdx, width) => (s) => Tbl.setColumnWidth(s, colIdx, width),

  /* generic */
  deleteSelection: () => (s) => T.deleteSelection(s),
  deleteBackward: () => (s) => T.deleteBackward(s),
  insertContent: (content) => (s) => insertContentCmd(s, content),
  insertText: (text) => (s) => T.insertText(s, text),
  focus: () => id,
  run: () => id,
};

export function insertContentCmd(state, content) {
  if (content == null) return state;
  if (typeof content === 'string') {
    const ast = markdownToAst(content);
    const blocks = ast.content || [];
    if (blocks.length === 1 && isTextblock(blocks[0].type)) return T.insertInline(state, blocks[0].content || []);
    return T.insertBlocks(state, blocks);
  }
  if (Array.isArray(content)) return T.insertBlocks(state, content);
  if (content.type === 'doc') return T.insertBlocks(state, content.content || []);
  // single node
  if (isTextblock(content.type) === false && content.type !== 'text') {
    return content.content ? T.insertBlocks(state, [content]) : T.insertBlockNode(state, content);
  }
  return T.insertInline(state, [content]);
}
