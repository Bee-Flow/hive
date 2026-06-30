/**
 * nodes.js — node factory helpers and small tree utilities.
 *
 * These keep node construction terse and consistent. Attributes are filled from
 * schema defaults; defaulted values are stripped so two nodes that differ only in
 * implicit defaults compare equal.
 */
import { NODE_SCHEMA, nodeDefaults } from './schema.js';
import { sortMarks, sameMarkSet } from './marks.js';

/** Build a node, stripping attrs equal to their schema default. */
export function node(type, attrs, content) {
  const out = { type };
  if (attrs) {
    const d = nodeDefaults(type);
    const a = {};
    for (const k of Object.keys(attrs)) {
      if (attrs[k] !== undefined && attrs[k] !== d[k]) a[k] = attrs[k];
    }
    if (Object.keys(a).length) out.attrs = a;
  }
  if (content !== undefined) out.content = content;
  return out;
}

/** Build a text node with optional (sorted) marks. */
export function text(str, marks) {
  const out = { type: 'text', text: str };
  if (marks && marks.length) out.marks = sortMarks(marks);
  return out;
}

export const paragraph = (content = [], attrs) => node('paragraph', attrs, content);
export const heading = (level, content = [], attrs) => node('heading', { level, ...attrs }, content);
export const doc = (content = []) => node('doc', null, content);
export const emptyParagraph = () => node('paragraph', null, []);

/** Read an attr with schema default fallback. */
export function attr(n, key) {
  if (n.attrs && key in n.attrs) return n.attrs[key];
  return nodeDefaults(n.type)[key];
}

/** Get a node's children (always an array). */
export const children = (n) => n.content || [];

/** Is the node an empty textblock (no inline content)? */
export function isEmptyTextblock(n) {
  return NODE_SCHEMA[n.type]?.textblock && (!n.content || n.content.length === 0);
}

/**
 * Structural equality over the AST, ignoring transient `id` fields. Used by tests
 * and the reconciler's fast-path.
 */
export function nodeEq(a, b) {
  if (a === b) return true;
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === 'text') {
    return a.text === b.text && sameMarkSet(a.marks || [], b.marks || []);
  }
  if (!attrsEq(a.attrs, b.attrs)) return false;
  const ac = a.content || [], bc = b.content || [];
  if (ac.length !== bc.length) return false;
  for (let i = 0; i < ac.length; i++) {
    if (!nodeEq(ac[i], bc[i])) return false;
  }
  return true;
}

function attrsEq(a = {}, b = {}) {
  a = a || {}; b = b || {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const av = JSON.stringify(a[k]);
    const bv = JSON.stringify(b[k]);
    if (av !== bv) return false;
  }
  return true;
}
