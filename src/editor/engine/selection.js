/**
 * selection.js — model selection over (path, offset) positions.
 *
 * A position is { path:number[], offset:number } where path points to a textblock
 * and offset is a token offset within it (see inline.js). Document order equals
 * lexicographic path order then offset, because no textblock path is a prefix of
 * another (textblocks don't contain blocks).
 */

export function pos(path, offset) { return { path: path.slice(), offset }; }

export function textSelection(anchor, head) { return { type: 'text', anchor, head: head || anchor }; }
export function nodeSelection(path) { return { type: 'node', path: path.slice() }; }
/** Rectangular table-cell selection: anchor/head are tableCell paths in one table. */
export function cellSelection(anchorCell, headCell) { return { type: 'cell', anchorCell: anchorCell.slice(), headCell: (headCell || anchorCell).slice() }; }

export function isText(sel) { return sel && sel.type === 'text'; }
export function isNode(sel) { return sel && sel.type === 'node'; }
export function isCell(sel) { return sel && sel.type === 'cell'; }
export function isCollapsed(sel) { return isText(sel) && eqPos(sel.anchor, sel.head); }

export function eqPath(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function eqPos(a, b) {
  return a.offset === b.offset && eqPath(a.path, b.path);
}

export function cmpPos(a, b) {
  const n = Math.min(a.path.length, b.path.length);
  for (let i = 0; i < n; i++) {
    if (a.path[i] !== b.path[i]) return a.path[i] - b.path[i];
  }
  if (a.path.length !== b.path.length) return a.path.length - b.path.length;
  return a.offset - b.offset;
}

/** Ordered { from, to } for a text selection. */
export function selRange(sel) {
  if (!isText(sel)) return null;
  return cmpPos(sel.anchor, sel.head) <= 0 ? { from: sel.anchor, to: sel.head } : { from: sel.head, to: sel.anchor };
}

export function eqSelection(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === 'node') return eqPath(a.path, b.path);
  if (a.type === 'cell') return eqPath(a.anchorCell, b.anchorCell) && eqPath(a.headCell, b.headCell);
  return eqPos(a.anchor, b.anchor) && eqPos(a.head, b.head);
}
