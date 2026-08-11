/**
 * transforms.js — pure editing operations: (state) → state.
 *
 * state = { doc, selection, storedMarks? }. Every function returns a NEW state
 * (structural sharing on the doc). Commands (commands/) wrap these; the input
 * loop dispatches them. Operations are correct for the common single-block and
 * same-parent cases; deeply-nested cross-structure selections fall back to a
 * safe collapse (documented) rather than risk corruption.
 */
import {
  getNode, updateAt, parentPath, lastIndex, prevSiblingPath,
} from './doc.js';
import {
  inlineToTokens, tokensToInline, marksAt, textTokens, toggleMarkTokens,
  graphemeBackLen, graphemeForwardLen,
} from './inline.js';
import {
  textSelection, nodeSelection, pos, selRange, isCollapsed, isText, isNode, eqPath,
} from './selection.js';
import { isTextblock, isAtom, isCode } from '../model/schema.js';
import { node, emptyParagraph } from '../model/nodes.js';
import { hasMark } from '../model/marks.js';
import { insertAfterTable, tableContext } from './tables.js';

const st = (doc, selection, storedMarks) => ({ doc, selection, storedMarks: storedMarks || null });

/** True when the selection is a non-collapsed text range (i.e. replaceable). */
export function isTextRange(state) {
  return isText(state.selection) && !isCollapsed(state.selection);
}

/* ── Text insertion ─────────────────────────────────────── */

export function insertText(state, str) {
  if (!str) return state;
  let s = isText(state.selection) && !isCollapsed(state.selection) ? deleteSelection(state) : state;
  if (!isText(s.selection)) return s;
  const { path, offset } = s.selection.anchor;
  const block = getNode(s.doc, path);
  if (!isTextblock(block.type)) return s;
  const toks = inlineToTokens(block.content);
  const marks = isCode(block.type) ? [] : (s.storedMarks || marksAt(toks, offset));
  const ins = textTokens(str, marks);
  const newToks = [...toks.slice(0, offset), ...ins, ...toks.slice(offset)];
  const doc2 = updateAt(s.doc, path, (b) => ({ ...b, content: tokensToInline(newToks) }));
  return st(doc2, textSelection(pos(path, offset + str.length)));
}

/* ── Deletion ───────────────────────────────────────────── */

export function deleteSelection(state) {
  const sel = state.selection;
  if (isNode(sel)) return deleteNodeAt(state, sel.path);
  if (!isText(sel) || isCollapsed(sel)) return state;
  const { from, to } = selRange(sel);

  if (eqPath(from.path, to.path)) {
    const doc2 = updateAt(state.doc, from.path, (b) => {
      const toks = inlineToTokens(b.content);
      return { ...b, content: tokensToInline([...toks.slice(0, from.offset), ...toks.slice(to.offset)]) };
    });
    return st(doc2, textSelection(pos(from.path, from.offset)));
  }

  // Same-parent multi-block: merge tail of `to` into `from`, drop blocks between.
  if (eqPath(parentPath(from.path), parentPath(to.path))) {
    const fromBlock = getNode(state.doc, from.path);
    const toBlock = getNode(state.doc, to.path);
    if (isTextblock(fromBlock.type) && isTextblock(toBlock.type)) {
      const fromToks = inlineToTokens(fromBlock.content).slice(0, from.offset);
      const toToks = inlineToTokens(toBlock.content).slice(to.offset);
      const merged = { ...fromBlock, content: tokensToInline([...fromToks, ...toToks]) };
      const pPath = parentPath(from.path);
      const a = lastIndex(from.path), b = lastIndex(to.path);
      const doc2 = updateAt(state.doc, pPath, (par) => {
        const content = par.content.slice();
        content.splice(a, b - a + 1, merged);
        return { ...par, content };
      });
      return st(doc2, textSelection(pos(from.path, from.offset)));
    }
  }
  // Fallback: collapse to `from` (safe; avoids cross-structure corruption).
  return st(state.doc, textSelection(from));
}

export function deleteBackward(state) {
  const sel = state.selection;
  if (isNode(sel)) return deleteNodeAt(state, sel.path);
  if (!isText(sel)) return state;
  if (!isCollapsed(sel)) return deleteSelection(state);
  const { path, offset } = sel.anchor;
  const block = getNode(state.doc, path);
  if (isTextblock(block.type) && offset > 0) {
    const toks = inlineToTokens(block.content);
    const len = graphemeBackLen(toks, offset); // delete a whole grapheme (emoji-safe)
    const doc2 = updateAt(state.doc, path, (b) => ({ ...b, content: tokensToInline([...toks.slice(0, offset - len), ...toks.slice(offset)]) }));
    return st(doc2, textSelection(pos(path, offset - len)));
  }
  return mergeBackward(state, path);
}

export function deleteForward(state) {
  const sel = state.selection;
  if (isNode(sel)) return deleteNodeAt(state, sel.path);
  if (!isText(sel)) return state;
  if (!isCollapsed(sel)) return deleteSelection(state);
  const { path, offset } = sel.anchor;
  const block = getNode(state.doc, path);
  const toks = inlineToTokens(block.content);
  if (isTextblock(block.type) && offset < toks.length) {
    const len = graphemeForwardLen(toks, offset); // delete a whole grapheme (emoji-safe)
    const doc2 = updateAt(state.doc, path, (b) => ({ ...b, content: tokensToInline([...toks.slice(0, offset), ...toks.slice(offset + len)]) }));
    return st(doc2, textSelection(pos(path, offset)));
  }
  // At block end: merge the next sibling textblock up into this one.
  const pPath = parentPath(path);
  const idx = lastIndex(path);
  const parent = getNode(state.doc, pPath);
  const next = parent.content[idx + 1];
  if (next && isTextblock(next.type) && isTextblock(block.type)) {
    const merged = { ...block, content: tokensToInline([...toks, ...inlineToTokens(next.content)]) };
    const doc2 = updateAt(state.doc, pPath, (par) => {
      const content = par.content.slice();
      content.splice(idx, 2, merged);
      return { ...par, content };
    });
    return st(doc2, textSelection(pos(path, offset)));
  }
  return state;
}

function mergeBackward(state, path) {
  const prev = prevSiblingPath(path);
  const block = getNode(state.doc, path);
  if (prev) {
    const prevBlock = getNode(state.doc, prev);
    if (isAtom(prevBlock.type)) {
      // Backspace before an atom → select it (a second backspace deletes).
      return st(state.doc, nodeSelection(prev));
    }
    if (isTextblock(prevBlock.type) && isTextblock(block.type)) {
      const prevToks = inlineToTokens(prevBlock.content);
      const merged = { ...prevBlock, content: tokensToInline([...prevToks, ...inlineToTokens(block.content)]) };
      const pPath = parentPath(path);
      const idx = lastIndex(path);
      const doc2 = updateAt(state.doc, pPath, (par) => {
        const content = par.content.slice();
        content.splice(idx - 1, 2, merged);
        return { ...par, content };
      });
      return st(doc2, textSelection(pos(prev, prevToks.length)));
    }
  }
  // First block of its parent.
  const parent = getNode(state.doc, parentPath(path));
  if (parent && (parent.type === 'listItem' || parent.type === 'taskItem')) return liftListItem(state);
  if (parent && parent.type === 'blockquote' && lastIndex(path) === 0) return liftBlock(state, parentPath(path), path);
  return state;
}

function deleteNodeAt(state, path) {
  const doc2 = updateAt(state.doc, parentPath(path), (par) => {
    const content = par.content.slice();
    content.splice(lastIndex(path), 1);
    if (content.length === 0 && par.type === 'doc') content.push(emptyParagraph());
    return { ...par, content };
  });
  // Place caret at the block now occupying the deleted slot (clamped to a textblock).
  return st(doc2, textSelection(clampCaret(doc2, path)));
}

/* ── Splitting (Enter) ──────────────────────────────────── */

export function splitBlock(state) {
  let s = isText(state.selection) && !isCollapsed(state.selection) ? deleteSelection(state) : state;
  if (!isText(s.selection)) return s;
  const { path, offset } = s.selection.anchor;
  const block = getNode(s.doc, path);
  if (!isTextblock(block.type)) return s;

  const toks = inlineToTokens(block.content);
  const left = tokensToInline(toks.slice(0, offset));
  const right = tokensToInline(toks.slice(offset));
  const rightType = block.type === 'heading' ? 'paragraph' : block.type;
  const leftBlock = { ...block, content: left };
  const rightBlock = node(rightType, block.type === 'heading' ? null : block.attrs, right);

  const pPath = parentPath(path);
  const parent = getNode(s.doc, pPath);
  const idx = lastIndex(path);

  if (parent.type === 'listItem' || parent.type === 'taskItem') {
    const listPath = parentPath(pPath);
    const itemIdx = lastIndex(pPath);
    const before = parent.content.slice(0, idx);
    const after = parent.content.slice(idx + 1);
    const newCurrent = { ...parent, content: [...before, leftBlock] };
    const newItem = node(parent.type, parent.type === 'taskItem' ? { checked: false } : null, [rightBlock, ...after]);
    const doc2 = updateAt(s.doc, listPath, (list) => {
      const content = list.content.slice();
      content.splice(itemIdx, 1, newCurrent, newItem);
      return { ...list, content };
    });
    return st(doc2, textSelection(pos([...listPath, itemIdx + 1, 0], 0)));
  }

  const doc2 = updateAt(s.doc, pPath, (par) => {
    const content = par.content.slice();
    content.splice(idx, 1, leftBlock, rightBlock);
    return { ...par, content };
  });
  return st(doc2, textSelection(pos([...pPath, idx + 1], 0)));
}

export function insertHardBreak(state) {
  let s = isText(state.selection) && !isCollapsed(state.selection) ? deleteSelection(state) : state;
  if (!isText(s.selection)) return s;
  return insertInlineNode(s, { type: 'hardBreak' });
}

/* ── Marks ──────────────────────────────────────────────── */

export function toggleMark(state, type, attrs) {
  const sel = state.selection;
  if (!isText(sel)) return state;
  if (isCollapsed(sel)) {
    // Toggle a stored mark applied to the next typed text.
    const stored = state.storedMarks || marksAt(inlineToTokens(getNode(state.doc, sel.anchor.path).content), sel.anchor.offset);
    const has = hasMark(stored, type);
    const next = has ? stored.filter((m) => m.type !== type) : [...stored.filter((m) => m.type !== type), { type, ...(attrs ? { attrs } : {}) }];
    return { doc: state.doc, selection: sel, storedMarks: next };
  }
  const { from, to } = selRange(sel);
  if (!eqPath(from.path, to.path)) {
    // Multi-block: add the mark unless every selected text token already has it.
    const ranges = selectedTextblockRanges(state.doc, from, to);
    let total = 0;
    let have = 0;
    for (const r of ranges) {
      const t = inlineToTokens(getNode(state.doc, r.path).content).slice(r.lo, r.hi).filter((x) => !x.node);
      total += t.length;
      have += t.filter((x) => hasMark(x.marks || [], type)).length;
    }
    const add = !(total > 0 && have === total);
    return st(applyMarkToRanges(state.doc, ranges, type, attrs, add), sel);
  }
  const doc2 = updateAt(state.doc, from.path, (b) => {
    const toks = inlineToTokens(b.content);
    return { ...b, content: tokensToInline(toggleMarkTokens(toks, from.offset, to.offset, type, attrs)) };
  });
  return st(doc2, sel);
}

export function setMark(state, type, attrs) {
  const sel = state.selection;
  if (!isText(sel) || isCollapsed(sel)) return state;
  const { from, to } = selRange(sel);
  if (!eqPath(from.path, to.path)) {
    return st(applyMarkToRanges(state.doc, selectedTextblockRanges(state.doc, from, to), type, attrs, true), sel);
  }
  const doc2 = updateAt(state.doc, from.path, (b) => {
    const toks = inlineToTokens(b.content);
    return { ...b, content: tokensToInline(toggleMarkTokens(toks, from.offset, to.offset, type, attrs, true)) };
  });
  return st(doc2, sel);
}

export function unsetMark(state, type) {
  const sel = state.selection;
  if (!isText(sel) || isCollapsed(sel)) return state;
  const { from, to } = selRange(sel);
  if (!eqPath(from.path, to.path)) {
    return st(applyMarkToRanges(state.doc, selectedTextblockRanges(state.doc, from, to), type, undefined, false), sel);
  }
  const doc2 = updateAt(state.doc, from.path, (b) => {
    const toks = inlineToTokens(b.content);
    return { ...b, content: tokensToInline(toggleMarkTokens(toks, from.offset, to.offset, type, undefined, false)) };
  });
  return st(doc2, sel);
}

/** Textblocks (in document order) intersecting a cross-block text selection,
 *  each with the local token sub-range [lo, hi) to operate on. */
function selectedTextblockRanges(doc, from, to) {
  const blocks = [];
  const walk = (n, p) => {
    if (isTextblock(n.type)) { blocks.push(p); return; }
    (n.content || []).forEach((c, i) => walk(c, [...p, i]));
  };
  walk(doc, []);
  const out = [];
  for (const p of blocks) {
    if (cmpPath(p, from.path) < 0 || cmpPath(p, to.path) > 0) continue;
    const len = inlineToTokens(getNode(doc, p).content).length;
    out.push({ path: p, lo: eqPath(p, from.path) ? from.offset : 0, hi: eqPath(p, to.path) ? to.offset : len });
  }
  return out;
}

/**
 * Locate an inline node (math, formula, inline image) by object identity.
 *
 * Block atoms are indexed in the view's nodeToPath map, but inline ones live
 * inside a textblock's token stream and cannot be addressed by a block path.
 * Node identity is stable because the doc is immutable with structural sharing,
 * so a walk is exact. Returns { path, offset } — the token offset within the
 * block — or null.
 */
export function findInlineNode(doc, target) {
  if (!target) return null;
  let found = null;
  const walk = (n, p) => {
    if (found) return;
    if (isTextblock(n.type)) {
      const toks = inlineToTokens(n.content);
      const i = toks.findIndex((t) => t.node === target);
      if (i >= 0) found = { path: p, offset: i };
      return;
    }
    (n.content || []).forEach((c, i) => walk(c, [...p, i]));
  };
  walk(doc, []);
  return found;
}

/** Merge attrs into the inline node occupying token `offset` of block `path`. */
export function updateInlineNodeAttrs(state, path, offset, attrs) {
  const block = getNode(state.doc, path);
  if (!block) return state;
  const toks = inlineToTokens(block.content);
  const tok = toks[offset];
  if (!tok?.node) return state;
  const out = toks.slice();
  out[offset] = { node: { ...tok.node, attrs: { ...(tok.node.attrs || {}), ...attrs } } };
  return st(updateAt(state.doc, path, (b) => ({ ...b, content: tokensToInline(out) })), state.selection);
}

/**
 * The selected content as a standalone doc AST.
 *
 * Used by copy/cut: the clipboard must carry the SELECTION, not the document.
 * Blocks fully inside the range keep their type and attrs; the first and last
 * are truncated to the selected token sub-range. Returns null for a collapsed
 * or non-text selection.
 */
export function sliceSelection(doc, sel) {
  if (!isText(sel) || isCollapsed(sel)) return null;
  const { from, to } = selRange(sel);
  const ranges = selectedTextblockRanges(doc, from, to);
  const content = [];
  for (const r of ranges) {
    const block = getNode(doc, r.path);
    if (!block) continue;
    const toks = inlineToTokens(block.content).slice(r.lo, r.hi);
    // A fully-deselected block (hi <= lo) still contributes its line break.
    content.push({ ...block, content: tokensToInline(toks) });
  }
  return { type: 'doc', content };
}

function applyMarkToRanges(doc, ranges, type, attrs, add) {
  let doc2 = doc;
  for (const r of ranges) {
    if (r.hi <= r.lo) continue;
    doc2 = updateAt(doc2, r.path, (b) => ({
      ...b,
      content: tokensToInline(toggleMarkTokens(inlineToTokens(b.content), r.lo, r.hi, type, attrs, add)),
    }));
  }
  return doc2;
}

/* ── Block type & attrs ─────────────────────────────────── */

export function setBlockType(state, type, attrs) {
  const sel = state.selection;
  if (!isText(sel)) return state;
  const { from, to } = selRange(sel);
  const pPath = parentPath(from.path);
  if (!eqPath(pPath, parentPath(to.path))) {
    return retypeOne(state, from.path, type, attrs);
  }
  const a = lastIndex(from.path), b = lastIndex(to.path);
  let doc2 = state.doc;
  for (let i = a; i <= b; i++) {
    const path = [...pPath, i];
    const blk = getNode(doc2, path);
    if (!isTextblock(blk.type)) continue;
    doc2 = updateAt(doc2, path, () => retype(blk, type, attrs));
  }
  return st(doc2, sel);
}

function retypeOne(state, path, type, attrs) {
  const blk = getNode(state.doc, path);
  if (!isTextblock(blk.type)) return state;
  return st(updateAt(state.doc, path, () => retype(blk, type, attrs)), state.selection);
}

function retype(blk, type, attrs) {
  let content = blk.content;
  if (isCode(type)) {
    // collapse to a single plain-text node
    const text = inlineToTokens(blk.content).filter((t) => !t.node).map((t) => t.ch).join('');
    content = text ? [{ type: 'text', text }] : [];
  }
  return node(type, attrs || null, content);
}

export function toggleBlockType(state, type, attrs) {
  const sel = state.selection;
  if (!isText(sel)) return state;
  const blk = getNode(state.doc, sel.anchor.path);
  const isType = blk.type === type && (!attrs || Object.entries(attrs).every(([k, v]) => (blk.attrs?.[k] ?? null) === v));
  return setBlockType(state, isType ? 'paragraph' : type, isType ? null : attrs);
}

export function setTextAlign(state, align) {
  const sel = state.selection;
  if (!isText(sel)) return state;
  const { from, to } = selRange(sel);
  const pPath = parentPath(from.path);
  const a = lastIndex(from.path), b = eqPath(pPath, parentPath(to.path)) ? lastIndex(to.path) : a;
  let doc2 = state.doc;
  for (let i = a; i <= b; i++) {
    const path = [...pPath, i];
    const blk = getNode(doc2, path);
    if (blk.type !== 'paragraph' && blk.type !== 'heading') continue;
    doc2 = updateAt(doc2, path, (n) => node(n.type, { ...(n.attrs || {}), align: align === 'left' ? null : align }, n.content));
  }
  return st(doc2, sel);
}

/* ── Lists & blockquote ─────────────────────────────────── */

/** Path of a node by object identity (structural sharing makes this exact). */
function pathOfNode(doc, target) {
  let found = null;
  const walk = (n, p) => {
    if (found) return;
    if (n === target) { found = p; return; }
    (n.content || []).forEach((c, i) => walk(c, [...p, i]));
  };
  walk(doc, []);
  return found;
}

const itemTypeFor = (listType) => (listType === 'taskList' ? 'taskItem' : 'listItem');
const makeItem = (itemType, block) => node(itemType, itemType === 'taskItem' ? { checked: false } : null, [block]);

/** Change a list (and its items) to another list type in place. */
function convertList(state, listPath, listType) {
  const itemType = itemTypeFor(listType);
  const doc2 = updateAt(state.doc, listPath, (list) => ({
    ...list,
    type: listType,
    attrs: listType === 'orderedList' ? { start: 1, tight: true } : null,
    content: (list.content || []).map((it) => (
      it.type === itemType ? it : { ...it, type: itemType, attrs: itemType === 'taskItem' ? { checked: false } : null }
    )),
  }));
  // Depth is unchanged, so the selection paths still address the same blocks.
  return st(doc2, state.selection);
}

/**
 * Wrap every selected block in one list — or lift them out if they are already
 * in a list of this type.
 *
 * This used to read `sel.anchor.path` only, so it converted a single line no
 * matter how much was selected, and it always created a FRESH list wrapper with
 * no merging — which is why each converted line rendered as its own <ol> and
 * every one of them restarted at "1." (BFSF-315). Merging into an adjacent list
 * is done here rather than in normalizeLight because that pass is contractually
 * selection-safe and merging shifts block indices.
 */
export function toggleList(state, listType) {
  const sel = state.selection;
  if (!isText(sel)) return state;
  const { from, to } = selRange(sel);
  const itemType = itemTypeFor(listType);

  const anchorParent = getNode(state.doc, parentPath(from.path));
  if (anchorParent && (anchorParent.type === 'listItem' || anchorParent.type === 'taskItem')) {
    const listPath = parentPath(parentPath(from.path));
    const list = getNode(state.doc, listPath);
    // Same type → toggle off (every selected item, not just the anchor's).
    if (list?.type === listType) return liftListRange(state);
    // Different type → convert in place. Falling through to the wrap branch
    // spliced the new list INSIDE the existing <li>, producing <ul><li><ol>….
    if (list) return convertList(state, listPath, listType);
  }

  const pPath = parentPath(from.path);
  // Cross-container selections (e.g. paragraph → table cell) can't share one
  // list; wrap the anchor block alone rather than corrupt the structure.
  const a = lastIndex(from.path);
  const b = eqPath(pPath, parentPath(to.path)) ? lastIndex(to.path) : a;
  const parent = getNode(state.doc, pPath);
  const kids = parent?.content || [];
  if (!kids.length) return state;

  const fromBlock = getNode(state.doc, from.path);
  const toBlock = getNode(state.doc, [...pPath, b]);
  if (!isTextblock(fromBlock?.type)) return state;

  // Build the replacement run. A non-textblock in the middle (a table, an
  // image) breaks the list in two rather than being swallowed by it.
  const replacement = [];
  let openList = null;
  for (let i = a; i <= b; i++) {
    const blk = kids[i];
    if (!blk) continue;
    if (!isTextblock(blk.type)) { replacement.push(blk); openList = null; continue; }
    const item = makeItem(itemType, blk);
    if (openList) {
      const merged = { ...openList.list, content: [...openList.list.content, item] };
      replacement[openList.at] = merged;
      openList.list = merged;
    } else {
      openList = { list: node(listType, null, [item]), at: replacement.length };
      replacement.push(openList.list);
    }
  }
  if (!replacement.length) return state;

  // Merge with an adjacent list of the same type so re-applying to the next
  // lines continues the numbering instead of starting a second list at 1.
  let start = a;
  let end = b;
  const prev = a > 0 ? kids[a - 1] : null;
  if (prev?.type === listType && replacement[0]?.type === listType) {
    replacement[0] = { ...prev, content: [...(prev.content || []), ...replacement[0].content] };
    start = a - 1;
  }
  const next = kids[b + 1];
  const lastIdx = replacement.length - 1;
  if (next?.type === listType && replacement[lastIdx]?.type === listType) {
    replacement[lastIdx] = { ...replacement[lastIdx], content: [...replacement[lastIdx].content, ...(next.content || [])] };
    end = b + 1;
  }

  const doc2 = updateAt(state.doc, pPath, (par) => {
    const content = par.content.slice();
    content.splice(start, end - start + 1, ...replacement);
    return { ...par, content };
  });

  // The wrapped blocks are the same objects, so identity gives exact new paths.
  const newFrom = pathOfNode(doc2, fromBlock);
  const newTo = pathOfNode(doc2, toBlock) || newFrom;
  if (!newFrom) return st(doc2, sel);
  return st(doc2, textSelection(pos(newFrom, from.offset), pos(newTo, to.offset)));
}

export function toggleBlockquote(state) {
  const sel = state.selection;
  if (!isText(sel)) return state;
  const path = sel.anchor.path;
  const parent = getNode(state.doc, parentPath(path));
  if (parent.type === 'blockquote') return liftBlock(state, parentPath(path), path);
  const block = getNode(state.doc, path);
  const bq = node('blockquote', null, [block]);
  const doc2 = updateAt(state.doc, parentPath(path), (par) => {
    const content = par.content.slice();
    content.splice(lastIndex(path), 1, bq);
    return { ...par, content };
  });
  return st(doc2, textSelection(pos([...parentPath(path), lastIndex(path), 0], sel.anchor.offset)));
}

/** Lift every list item touched by the selection out of its list. */
function liftListRange(state) {
  const sel = state.selection;
  const { from, to } = selRange(sel);
  const fromItemPath = parentPath(from.path);
  const toItemPath = parentPath(to.path);
  const listPath = parentPath(fromItemPath);
  // Only meaningful when both ends are items of the same list.
  if (!eqPath(listPath, parentPath(toItemPath))) return liftListItem(state);
  const i = lastIndex(fromItemPath);
  const j = lastIndex(toItemPath);
  if (j <= i) return liftListItem(state);

  const list = getNode(state.doc, listPath);
  const items = list.content || [];
  const before = items.slice(0, i);
  const after = items.slice(j + 1);
  const lifted = [];
  for (let k = i; k <= j; k++) lifted.push(...(items[k]?.content || []));

  const replacement = [];
  if (before.length) replacement.push({ ...list, content: before });
  replacement.push(...lifted);
  if (after.length) replacement.push({ ...list, content: after });

  const fromBlock = getNode(state.doc, from.path);
  const toBlock = getNode(state.doc, to.path);
  const doc2 = updateAt(state.doc, parentPath(listPath), (par) => {
    const content = par.content.slice();
    content.splice(lastIndex(listPath), 1, ...replacement);
    return { ...par, content };
  });
  const nf = pathOfNode(doc2, fromBlock);
  const nt = pathOfNode(doc2, toBlock) || nf;
  if (!nf) return st(doc2, sel);
  return st(doc2, textSelection(pos(nf, from.offset), pos(nt, to.offset)));
}

export function liftListItem(state) {
  const sel = state.selection;
  if (!isText(sel)) return state;
  const path = sel.anchor.path;          // textblock
  const itemPath = parentPath(path);     // listItem/taskItem
  const item = getNode(state.doc, itemPath);
  if (item.type !== 'listItem' && item.type !== 'taskItem') return state;
  const listPath = parentPath(itemPath);
  const list = getNode(state.doc, listPath);
  const itemIdx = lastIndex(itemPath);
  const blockIdx = lastIndex(path);
  const listParentPath = parentPath(listPath);
  const listIdx = lastIndex(listPath);

  // Move the item's blocks out to the list's parent, splitting the list around it.
  const before = list.content.slice(0, itemIdx);
  const after = list.content.slice(itemIdx + 1);
  const lifted = item.content;
  const replacement = [];
  if (before.length) replacement.push({ ...list, content: before });
  replacement.push(...lifted);
  if (after.length) replacement.push({ ...list, content: after });

  const doc2 = updateAt(state.doc, listParentPath, (par) => {
    const content = par.content.slice();
    content.splice(listIdx, 1, ...replacement);
    return { ...par, content };
  });
  const liftedAt = listIdx + (before.length ? 1 : 0);
  return st(doc2, textSelection(pos([...listParentPath, liftedAt + blockIdx], sel.anchor.offset)));
}

export function sinkListItem(state) {
  const sel = state.selection;
  if (!isText(sel)) return state;
  const path = sel.anchor.path;
  const itemPath = parentPath(path);
  const item = getNode(state.doc, itemPath);
  if (item.type !== 'listItem' && item.type !== 'taskItem') return state;
  const listPath = parentPath(itemPath);
  const list = getNode(state.doc, listPath);
  const itemIdx = lastIndex(itemPath);
  if (itemIdx === 0) return state; // nothing to nest under
  const prevItem = list.content[itemIdx - 1];
  // Append a nested list of the same type to the previous item.
  const nested = node(list.type, null, [item]);
  const doc2 = updateAt(state.doc, listPath, (l) => {
    const content = l.content.slice();
    const newPrev = { ...prevItem, content: [...prevItem.content, nested] };
    content.splice(itemIdx - 1, 2, newPrev);
    return { ...l, content };
  });
  const newPath = [...listPath, itemIdx - 1, prevItem.content.length, 0, lastIndex(path)];
  return st(doc2, textSelection(pos(newPath, sel.anchor.offset)));
}

function liftBlock(state, wrapperPath, blockPath) {
  const wrapper = getNode(state.doc, wrapperPath);
  const blockIdx = lastIndex(blockPath);
  const before = wrapper.content.slice(0, blockIdx);
  const block = wrapper.content[blockIdx];
  const after = wrapper.content.slice(blockIdx + 1);
  const replacement = [];
  if (before.length) replacement.push({ ...wrapper, content: before });
  replacement.push(block);
  if (after.length) replacement.push({ ...wrapper, content: after });
  const parentP = parentPath(wrapperPath);
  const wrapperIdx = lastIndex(wrapperPath);
  const doc2 = updateAt(state.doc, parentP, (par) => {
    const content = par.content.slice();
    content.splice(wrapperIdx, 1, ...replacement);
    return { ...par, content };
  });
  const at = wrapperIdx + (before.length ? 1 : 0);
  return st(doc2, textSelection(pos([...parentP, at], state.selection.anchor.offset)));
}

/* ── Inserting nodes ────────────────────────────────────── */

export function insertInlineNode(state, inlineNode) {
  let s = isText(state.selection) && !isCollapsed(state.selection) ? deleteSelection(state) : state;
  if (!isText(s.selection)) return s;
  const { path, offset } = s.selection.anchor;
  const block = getNode(s.doc, path);
  if (!isTextblock(block.type)) return s;
  const toks = inlineToTokens(block.content);
  const newToks = [...toks.slice(0, offset), { node: inlineNode }, ...toks.slice(offset)];
  const doc2 = updateAt(s.doc, path, (b) => ({ ...b, content: tokensToInline(newToks) }));
  return st(doc2, textSelection(pos(path, offset + 1)));
}

/** Insert an array of inline nodes (text/atoms) at the caret. */
export function insertInline(state, inlineNodes) {
  let s = isText(state.selection) && !isCollapsed(state.selection) ? deleteSelection(state) : state;
  if (!isText(s.selection)) return s;
  const { path, offset } = s.selection.anchor;
  const block = getNode(s.doc, path);
  if (!isTextblock(block.type)) return s;
  const toks = inlineToTokens(block.content);
  const ins = [];
  for (const n of inlineNodes) {
    if (n.type === 'text') for (let i = 0; i < n.text.length; i++) ins.push({ ch: n.text[i], marks: n.marks || [] });
    else ins.push({ node: n });
  }
  const newToks = [...toks.slice(0, offset), ...ins, ...toks.slice(offset)];
  const doc2 = updateAt(s.doc, path, (b) => ({ ...b, content: tokensToInline(newToks) }));
  return st(doc2, textSelection(pos(path, offset + ins.length)));
}

/** True when `path` (or any of its ancestors) sits inside a tableCell. */
export function insideTableCell(doc, path) {
  for (let i = 1; i <= path.length; i++) {
    if (getNode(doc, path.slice(0, i))?.type === 'tableCell') return true;
  }
  return false;
}

/** Route a table insert that would land inside a cell to AFTER the host table
 *  (nested tables corrupt geometry, serialization and formulas — S8). */
function insertTableOutsideCell(state, blockNode) {
  const s2 = insertAfterTable(state, blockNode);
  if (s2 === state) return state;
  // insertAfterTable node-selects the inserted block; for a table, drop the
  // caret into its first cell instead so editing continues naturally.
  if (isNode(s2.selection)) {
    return st(s2.doc, textSelection(pos(firstTextblockUnder(s2.doc, s2.selection.path), 0)));
  }
  return s2;
}

/** Insert a block node after the current block (or replace an empty block). A
 *  trailing textblock invariant is guaranteed by normalize() afterwards. */
export function insertBlockNode(state, blockNode) {
  const sel = state.selection;
  const path = isText(sel) ? sel.anchor.path : isNode(sel) ? sel.path : [0];
  if (blockNode?.type === 'table' && insideTableCell(state.doc, path)) {
    return insertTableOutsideCell(state, blockNode);
  }
  const block = getNode(state.doc, path);
  const pPath = parentPath(path);
  const idx = lastIndex(path);
  const blockEmpty = isTextblock(block.type) && inlineToTokens(block.content).length === 0;
  const at = blockEmpty ? idx : idx + 1;
  const doc2 = updateAt(state.doc, pPath, (par) => {
    const content = par.content.slice();
    content.splice(at, blockEmpty ? 1 : 0, blockNode);
    return { ...par, content };
  });
  if (isAtom(blockNode.type)) return st(doc2, nodeSelection([...pPath, at]));
  // Container blocks (table, list, blockquote): drop the caret into the first
  // textblock inside so the selection keeps the right context (e.g. isActive('table')).
  return st(doc2, textSelection(pos(firstTextblockUnder(doc2, [...pPath, at]), 0)));
}

function firstTextblockUnder(doc, path) {
  let p = path;
  let n = getNode(doc, p);
  while (n && !isTextblock(n.type) && n.content && n.content.length) {
    p = [...p, 0];
    n = getNode(doc, p);
  }
  return isTextblock(n?.type) ? p : path;
}

/** Replace the whole document with new top-level blocks. */
export function replaceDoc(docNode) {
  const content = docNode.content && docNode.content.length ? docNode.content : [emptyParagraph()];
  const d = { type: 'doc', content };
  return st(d, textSelection(clampCaret(d, [0])));
}

/** Merge attrs into a mark of `type` across the selection range (e.g. textStyle color).
 *  With a collapsed caret it stores the mark for the next typed text (TipTap parity). */
export function setMarkAttrs(state, type, patch) {
  const sel = state.selection;
  if (!isText(sel)) return state;
  if (isCollapsed(sel)) {
    const stored = state.storedMarks || marksAt(inlineToTokens(getNode(state.doc, sel.anchor.path).content), sel.anchor.offset);
    const existing = stored.find((m) => m.type === type);
    const merged = { ...(existing?.attrs || {}), ...patch };
    for (const k of Object.keys(merged)) if (merged[k] == null) delete merged[k];
    let next = stored.filter((m) => m.type !== type);
    if (Object.keys(merged).length) next = [...next, { type, attrs: merged }];
    return { doc: state.doc, selection: sel, storedMarks: next };
  }
  // A selection spanning several blocks used to hit `return state` here, so
  // colour and font silently did nothing on any multi-paragraph selection —
  // while bold and highlight worked, because those go through toggleMark/setMark
  // which already walk selectedTextblockRanges (BFSF-313).
  const { from, to } = selRange(sel);
  const ranges = selectedTextblockRanges(state.doc, from, to);
  let doc2 = state.doc;
  for (const r of ranges) {
    if (r.hi <= r.lo) continue;
    doc2 = updateAt(doc2, r.path, (b) => ({ ...b, content: tokensToInline(mergeAttrsInRange(inlineToTokens(b.content), r.lo, r.hi, type, patch)) }));
  }
  return st(doc2, sel);
}

/** Merge `patch` into each token's mark of `type` over [lo, hi). */
function mergeAttrsInRange(toks, lo, hi, type, patch) {
  const out = toks.slice();
  for (let i = lo; i < hi && i < out.length; i++) {
    const t = out[i];
    if (!t || t.node) continue;
    const existing = (t.marks || []).find((m) => m.type === type);
    const merged = { ...(existing?.attrs || {}), ...patch };
    for (const k of Object.keys(merged)) if (merged[k] == null) delete merged[k];
    let marks = (t.marks || []).filter((m) => m.type !== type);
    if (Object.keys(merged).length) marks = [...marks, { type, attrs: merged }];
    out[i] = { ch: t.ch, marks };
  }
  return out;
}

/** Update attrs of the currently node-selected atom (image/mermaid/math). */
export function updateNodeAttrs(state, attrs) {
  const sel = state.selection;
  const path = isNode(sel) ? sel.path : null;
  if (!path) return state;
  const doc2 = updateAt(state.doc, path, (n) => node(n.type, { ...(n.attrs || {}), ...attrs }, n.content));
  return st(doc2, sel);
}

/** Update attrs of the node at an explicit path (used by atom node-views). */
export function updateNodeAttrsAtPath(state, path, attrs) {
  const doc2 = updateAt(state.doc, path, (n) => node(n.type, { ...(n.attrs || {}), ...attrs }, n.content));
  return st(doc2, state.selection);
}

/** Insert an array of block nodes after the current block (or replacing it if empty). */
export function insertBlocks(state, blocks) {
  if (!blocks || !blocks.length) return state;
  const sel = state.selection;
  const path = isText(sel) ? sel.anchor.path : isNode(sel) ? sel.path : [0];
  // A paste inside a cell that contains a table anywhere in it routes ALL the
  // blocks after the host table — splitting the batch would scatter content
  // between the cell and the document (S8).
  if (insideTableCell(state.doc, path) && blocks.some((b) => b?.type === 'table')) {
    const ctx = tableContext(state.doc, path);
    if (ctx) {
      const pPath = parentPath(ctx.tablePath);
      const idx = lastIndex(ctx.tablePath);
      const doc2 = updateAt(state.doc, pPath, (par) => {
        const content = par.content.slice();
        content.splice(idx + 1, 0, ...blocks);
        return { ...par, content };
      });
      const lastPath = [...pPath, idx + blocks.length];
      const last = getNode(doc2, lastPath);
      if (isAtom(last.type)) return st(doc2, nodeSelection(lastPath));
      return st(doc2, textSelection(pos(firstTextblockUnder(doc2, lastPath), 0)));
    }
  }
  const block = getNode(state.doc, path);
  const pPath = parentPath(path);
  const idx = lastIndex(path);
  const blockEmpty = isTextblock(block.type) && inlineToTokens(block.content).length === 0;
  const at = blockEmpty ? idx : idx + 1;
  const doc2 = updateAt(state.doc, pPath, (par) => {
    const content = par.content.slice();
    content.splice(at, blockEmpty ? 1 : 0, ...blocks);
    return { ...par, content };
  });
  const lastPath = [...pPath, at + blocks.length - 1];
  const last = getNode(doc2, lastPath);
  if (isAtom(last.type)) return st(doc2, nodeSelection(lastPath));
  return st(doc2, textSelection(pos(lastPath, 0)));
}

/* ── helpers ────────────────────────────────────────────── */

function clampCaret(doc, path) {
  // Find the nearest textblock at/after `path` for a safe caret.
  const flatBlocks = [];
  const walk = (n, p) => {
    if (isTextblock(n.type)) { flatBlocks.push(p); return; }
    (n.content || []).forEach((c, i) => walk(c, [...p, i]));
  };
  walk(doc, []);
  if (!flatBlocks.length) return pos([0], 0);
  // pick the block whose path is >= requested, else last
  let chosen = flatBlocks[0];
  for (const bp of flatBlocks) {
    if (cmpPath(bp, path) >= 0) { chosen = bp; break; }
    chosen = bp;
  }
  return pos(chosen, 0);
}

function cmpPath(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}
