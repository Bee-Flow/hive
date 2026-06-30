/**
 * state.js — EditorState factory + transform application.
 *
 * state = { doc, selection, storedMarks }. Transforms are pure (state) → state;
 * applyTransform runs the result through the selection-safe normalizer.
 */
import { normalizeLight } from './normalize.js';
import { textSelection, pos, isText, isNode, isCell } from './selection.js';
import { getNode } from './doc.js';
import { isTextblock } from '../model/schema.js';

export function createState(doc, selection) {
  const d = normalizeLight(doc || { type: 'doc', content: [] });
  const sel = clampSelection(d, selection || textSelection(pos(firstTextblockPath(d), 0)));
  return { doc: d, selection: sel, storedMarks: null };
}

export function applyTransform(state, fn) {
  const next = fn(state);
  if (!next || next === state) return state;
  // Preserve doc identity for selection/storedMarks-only transforms so the view
  // can skip history + DOM reconcile.
  const doc = next.doc === state.doc ? state.doc : normalizeLight(next.doc);
  return { doc, selection: clampSelection(doc, next.selection), storedMarks: next.storedMarks || null };
}

/** First textblock path in document order (for a default caret). */
export function firstTextblockPath(doc) {
  let found = null;
  const walk = (n, p) => {
    if (found) return;
    if (isTextblock(n.type)) { found = p; return; }
    (n.content || []).forEach((c, i) => walk(c, [...p, i]));
  };
  walk(doc, []);
  return found || [0];
}

/** Ensure a selection still addresses valid nodes after a doc change. */
export function clampSelection(doc, sel) {
  if (!sel) return textSelection(pos(firstTextblockPath(doc), 0));
  if (isNode(sel)) {
    return pathExists(doc, sel.path) ? sel : textSelection(pos(firstTextblockPath(doc), 0));
  }
  if (isCell(sel)) {
    const ok = pathExists(doc, sel.anchorCell) && pathExists(doc, sel.headCell)
      && getNode(doc, sel.anchorCell).type === 'tableCell' && getNode(doc, sel.headCell).type === 'tableCell';
    return ok ? sel : textSelection(pos(firstTextblockPath(doc), 0));
  }
  if (isText(sel)) {
    const a = clampPos(doc, sel.anchor);
    const h = clampPos(doc, sel.head);
    return textSelection(a, h);
  }
  return textSelection(pos(firstTextblockPath(doc), 0));
}

function clampPos(doc, p) {
  if (!pathExists(doc, p.path)) return pos(firstTextblockPath(doc), 0);
  const block = getNode(doc, p.path);
  if (!isTextblock(block.type)) return pos(firstTextblockPath(doc), 0);
  const len = blockTokenLength(block);
  return pos(p.path, Math.max(0, Math.min(p.offset, len)));
}

function pathExists(doc, path) {
  let n = doc;
  for (const i of path) {
    if (!n.content || !n.content[i]) return false;
    n = n.content[i];
  }
  return true;
}

function blockTokenLength(block) {
  let len = 0;
  for (const c of block.content || []) len += c.type === 'text' ? c.text.length : 1;
  return len;
}
