/**
 * queries.js — read-only state queries powering toolbar active-states.
 *
 * Mirrors the slice of TipTap's API the existing UI uses: isActive(name, attrs?),
 * getAttributes(name). Implemented as pure reads over (doc, selection).
 */
import { getNode } from './doc.js';
import { inlineToTokens, marksAt } from './inline.js';
import { isText, isNode, isCollapsed, selRange, eqPath } from './selection.js';
import { hasMark, getMark } from '../model/marks.js';
import { MARK_SCHEMA, nodeDefaults, isTextblock } from '../model/schema.js';
import { inTable } from './tables.js';

export function isActive(state, name, attrs) {
  if (typeof name === 'object') return blockAttrsActive(state, name);
  if (name === 'resizableImage' || name === 'image') {
    return isNode(state.selection) && getNode(state.doc, state.selection.path).type === 'image';
  }
  if (name === 'table') return inTable(state);
  if (MARK_SCHEMA[name]) return markActive(state, name);
  return blockActive(state, name, attrs);
}

function markActive(state, type) {
  const sel = state.selection;
  if (!isText(sel)) return false;
  if (isCollapsed(sel)) {
    if (state.storedMarks) return hasMark(state.storedMarks, type);
    const block = getNode(state.doc, sel.anchor.path);
    return hasMark(marksAt(inlineToTokens(block.content), sel.anchor.offset), type);
  }
  const { from, to } = selRange(sel);
  if (eqPath(from.path, to.path)) {
    const toks = inlineToTokens(getNode(state.doc, from.path).content).slice(from.offset, to.offset).filter((t) => !t.node);
    return toks.length > 0 && toks.every((t) => hasMark(t.marks || [], type));
  }
  // Cross-block: active only if every selected text token carries the mark.
  let total = 0;
  let have = 0;
  for (const r of selectedTextblockRanges(state.doc, from, to)) {
    const toks = inlineToTokens(getNode(state.doc, r.path).content).slice(r.lo, r.hi).filter((t) => !t.node);
    total += toks.length;
    have += toks.filter((t) => hasMark(t.marks || [], type)).length;
  }
  return total > 0 && have === total;
}

/** Textblocks (document order) intersecting a cross-block selection, with local sub-ranges. */
function selectedTextblockRanges(doc, from, to) {
  const blocks = [];
  const walk = (n, p) => {
    if (isTextblock(n.type)) { blocks.push(p); return; }
    (n.content || []).forEach((c, i) => walk(c, [...p, i]));
  };
  walk(doc, []);
  const cmp = (a, b) => { const k = Math.min(a.length, b.length); for (let i = 0; i < k; i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; };
  const out = [];
  for (const p of blocks) {
    if (cmp(p, from.path) < 0 || cmp(p, to.path) > 0) continue;
    const len = inlineToTokens(getNode(doc, p).content).length;
    out.push({ path: p, lo: eqPath(p, from.path) ? from.offset : 0, hi: eqPath(p, to.path) ? to.offset : len });
  }
  return out;
}

function blockActive(state, type, attrs) {
  const sel = state.selection;
  const path = isText(sel) ? sel.anchor.path : isNode(sel) ? sel.path : null;
  if (!path) return false;
  for (let p = path; p.length > 0; p = p.slice(0, -1)) {
    const n = getNode(state.doc, p);
    if (n.type === type) {
      if (!attrs) return true;
      return Object.entries(attrs).every(([k, v]) => (n.attrs?.[k] ?? nodeDefaults(n.type)[k]) === v);
    }
  }
  return false;
}

function blockAttrsActive(state, attrs) {
  const sel = state.selection;
  const path = isText(sel) ? sel.anchor.path : null;
  if (!path) return false;
  const block = getNode(state.doc, path);
  return Object.entries(attrs).every(([k, v]) => (block.attrs?.[k] ?? nodeDefaults(block.type)[k] ?? null) === (v === 'left' ? null : v));
}

export function getAttributes(state, name) {
  const sel = state.selection;
  if (name === 'resizableImage' || name === 'image') {
    if (isNode(sel) && getNode(state.doc, sel.path).type === 'image') return { ...getNode(state.doc, sel.path).attrs };
    return {};
  }
  if (!isText(sel)) return {};
  const block = getNode(state.doc, sel.anchor.path);
  const toks = inlineToTokens(block.content);
  let marks;
  if (isCollapsed(sel)) {
    marks = state.storedMarks || marksAt(toks, sel.anchor.offset);
  } else {
    const { from } = selRange(sel);
    marks = (toks[from.offset] && !toks[from.offset].node) ? toks[from.offset].marks || [] : [];
  }
  const m = getMark(marks, name);
  return m ? { ...(m.attrs || {}) } : {};
}
