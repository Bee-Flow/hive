/**
 * flatpos.js — convert (path, offset) ↔ ProseMirror-style flat integer positions.
 *
 * Flat integers are only needed at the AI boundary: onAIAction passes {from,to}
 * and the legacy notebook_doc_replace contract speaks integers. Internally the
 * engine uses (path, offset); these helpers bridge the two.
 */
import { isAtom } from '../model/schema.js';

export function nodeSize(n) {
  if (n.type === 'text') return n.text.length;
  if (isAtom(n.type)) return 1;
  return contentSize(n) + 2;
}

export function contentSize(n) {
  let s = 0;
  for (const c of n.content || []) s += nodeSize(c);
  return s;
}

/** (path, offset) → flat integer position. */
export function flatFromPos(doc, p) {
  let base = 0;
  let node = doc;
  for (const idx of p.path) {
    const content = node.content || [];
    let off = base;
    for (let i = 0; i < idx; i++) off += nodeSize(content[i]);
    base = off + 1; // step past the block's open token
    node = content[idx];
  }
  return base + p.offset;
}

/** flat integer → (path, offset) pointing at the deepest textblock. */
export function posFromFlat(doc, target) {
  function rec(node, base, path) {
    const content = node.content || [];
    let off = base;
    for (let i = 0; i < content.length; i++) {
      const child = content[i];
      const size = nodeSize(child);
      if (child.type === 'text' || isAtom(child.type)) {
        if (target <= off + size) return { path: path.slice(), offset: target - base };
      } else if (target > off && target < off + size) {
        return rec(child, off + 1, [...path, i]);
      }
      off += size;
    }
    return { path: path.slice(), offset: target - base };
  }
  return rec(doc, 0, []);
}

/** Convenience for the AI contract: a text selection → {from,to} integers. */
export function selectionToFlat(doc, sel) {
  if (!sel || sel.type !== 'text') return null;
  const a = flatFromPos(doc, sel.anchor);
  const b = flatFromPos(doc, sel.head);
  return { from: Math.min(a, b), to: Math.max(a, b) };
}
