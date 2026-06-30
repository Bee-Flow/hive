/**
 * schema.js — node & mark registry for the Bee-Flow editor (BeeEditor / "bf-editor").
 *
 * The schema is data, not code: commands, the reconciler and the serializers all
 * consult this registry instead of hard-coding type names. Adding a node type is a
 * change here, not a sweep across the engine.
 *
 * A node is `{ type, attrs?, content?, marks?, text? }`. Block nodes carry
 * `content: Node[]`; text nodes carry `text: string` + optional `marks: Mark[]`.
 * A transient `id` is attached at runtime by the engine for DOM keying — it is
 * never part of the serialized form and never compared by the model.
 */

/** @typedef {{type:string, attrs?:Object, content?:Node[], marks?:Mark[], text?:string}} Node */
/** @typedef {{type:string, attrs?:Object}} Mark */

/**
 * Per-type descriptor.
 * - group:    'block' | 'inline'
 * - content:  allowed child group(s) — 'block' | 'inline' | 'text' | null (leaf)
 * - atom:     true → treated as an opaque leaf by the reconciler (void/atom node)
 * - textblock:true → a block whose direct children are inline content
 * - code:     true → children are literal text, marks are stripped
 * - marks:    allow-list of mark types ('_all_' = any) for textblock content
 * - defaults: default attribute values
 */
export const NODE_SCHEMA = {
  doc:            { group: 'block', content: 'block' },
  paragraph:      { group: 'block', content: 'inline', textblock: true, marks: '_all_', defaults: { align: null } },
  heading:        { group: 'block', content: 'inline', textblock: true, marks: '_all_', defaults: { level: 1, align: null } },
  bulletList:     { group: 'block', content: 'block', defaults: { tight: true } },
  orderedList:    { group: 'block', content: 'block', defaults: { start: 1, tight: true } },
  listItem:       { group: 'block', content: 'block' },
  taskList:       { group: 'block', content: 'block' },
  taskItem:       { group: 'block', content: 'block', defaults: { checked: false } },
  blockquote:     { group: 'block', content: 'block' },
  codeBlock:      { group: 'block', content: 'text', textblock: true, code: true, marks: 'none', defaults: { language: null } },
  horizontalRule: { group: 'block', atom: true },
  table:          { group: 'block', content: 'block' },
  tableRow:       { group: 'block', content: 'block' },
  tableCell:      { group: 'block', content: 'block', defaults: { header: false, align: null, colspan: 1, rowspan: 1, colwidth: null } },
  image:          { group: 'block', atom: true, defaults: { src: null, alt: null, title: null, width: null, alignment: 'center', textWrap: false } },
  mermaid:        { group: 'block', atom: true, defaults: { code: '' } },
  mathBlock:      { group: 'block', atom: true, defaults: { latex: '' } },
  // Data chart (built from a table snapshot). `spec` is a JSON string
  // {type,title,labels,series}; round-trips Markdown as a ```chart fenced block.
  chart:          { group: 'block', atom: true, defaults: { spec: '' } },

  text:           { group: 'inline' },
  hardBreak:      { group: 'inline', atom: true },
  mathInline:     { group: 'inline', atom: true, defaults: { latex: '' } },
  // Spreadsheet formula (table cells). `src` is the canonical `=…` text (round-trips
  // Markdown); `value`/`error` are transient computed display, set by normalize.
  formula:        { group: 'inline', atom: true, defaults: { src: '', value: '', error: false } },
};

/**
 * Mark descriptors. `order` controls serialization nesting (lower = outermost
 * wrapper). `excludes` lists mark types that cannot coexist with this one.
 */
// `order` controls serialization nesting (lower = outermost). The span-like marks
// (highlight, textStyle, underline) are deliberately contiguous at orders 1–3 so
// they collapse into a single `==…==` / `[…]{…}` wrapper between link and emphasis.
export const MARK_SCHEMA = {
  link:       { order: 0, defaults: { href: '', target: '_blank', rel: 'noopener noreferrer' } },
  highlight:  { order: 1, defaults: { color: null } },
  textStyle:  { order: 2, defaults: { color: null, fontFamily: null } },
  underline:  { order: 3 },
  bold:       { order: 4 },
  italic:     { order: 5 },
  strike:     { order: 6 },
  code:       { order: 7, excludes: ['bold', 'italic', 'underline', 'strike', 'link', 'highlight', 'textStyle'] },
};

/** Mark types that collapse into the bracketed-span / highlight wrapper. */
export const SPAN_MARKS = ['highlight', 'textStyle', 'underline'];

export const isBlock     = (type) => NODE_SCHEMA[type]?.group === 'block';
export const isInline    = (type) => NODE_SCHEMA[type]?.group === 'inline';
export const isAtom      = (type) => NODE_SCHEMA[type]?.atom === true;
export const isTextblock = (type) => NODE_SCHEMA[type]?.textblock === true;
export const isCode      = (type) => NODE_SCHEMA[type]?.code === true;
export const isVoid      = (type) => isAtom(type) && type !== 'text';

export function nodeDefaults(type) {
  return { ...(NODE_SCHEMA[type]?.defaults || {}) };
}
export function markDefaults(type) {
  return { ...(MARK_SCHEMA[type]?.defaults || {}) };
}
export function markOrder(type) {
  return MARK_SCHEMA[type]?.order ?? 99;
}
