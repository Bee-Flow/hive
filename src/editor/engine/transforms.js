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

const st = (doc, selection, storedMarks) => ({ doc, selection, storedMarks: storedMarks || null });

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

/* ── Lists & blockquote (single-block toggle) ───────────── */

export function toggleList(state, listType) {
  const sel = state.selection;
  if (!isText(sel)) return state;
  const path = sel.anchor.path;
  const parent = getNode(state.doc, parentPath(path));
  const grand = getNode(state.doc, parentPath(parentPath(path)));
  // Already in a list of this type → lift the item out.
  if ((parent.type === 'listItem' || parent.type === 'taskItem') && grand?.type === listType) {
    return liftListItem(state);
  }
  const block = getNode(state.doc, path);
  if (!isTextblock(block.type)) return state;
  const itemType = listType === 'taskList' ? 'taskItem' : 'listItem';
  const item = node(itemType, itemType === 'taskItem' ? { checked: false } : null, [block]);
  const list = node(listType, null, [item]);
  const doc2 = updateAt(state.doc, parentPath(path), (par) => {
    const content = par.content.slice();
    content.splice(lastIndex(path), 1, list);
    return { ...par, content };
  });
  const newPath = [...parentPath(path), lastIndex(path), 0, 0];
  return st(doc2, textSelection(pos(newPath, sel.anchor.offset)));
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

/** Insert a block node after the current block (or replace an empty block). A
 *  trailing textblock invariant is guaranteed by normalize() afterwards. */
export function insertBlockNode(state, blockNode) {
  const sel = state.selection;
  const path = isText(sel) ? sel.anchor.path : isNode(sel) ? sel.path : [0];
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
  const { from, to } = selRange(sel);
  if (!eqPath(from.path, to.path)) return state;
  const doc2 = updateAt(state.doc, from.path, (b) => {
    const toks = inlineToTokens(b.content);
    const out = toks.slice();
    for (let i = from.offset; i < to.offset; i++) {
      const t = out[i];
      if (t.node) continue;
      const existing = (t.marks || []).find((m) => m.type === type);
      const merged = { ...(existing?.attrs || {}), ...patch };
      for (const k of Object.keys(merged)) if (merged[k] == null) delete merged[k];
      let marks = (t.marks || []).filter((m) => m.type !== type);
      if (Object.keys(merged).length) marks = [...marks, { type, attrs: merged }];
      out[i] = { ch: t.ch, marks };
    }
    return { ...b, content: tokensToInline(out) };
  });
  return st(doc2, sel);
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
