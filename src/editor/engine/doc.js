/**
 * doc.js — immutable tree helpers addressed by block path.
 *
 * A "path" is an array of child indices from the doc root to a node, e.g. [2,0]
 * = first child of the third top-level block. Updates use structural sharing:
 * untouched subtrees keep their object identity, which the DOM reconciler relies
 * on to skip unchanged blocks.
 */

/** Get the node at a path (path [] → the doc itself). */
export function getNode(doc, path) {
  let n = doc;
  for (const i of path) n = n.content[i];
  return n;
}

/** Immutably replace the node at `path` with `fn(oldNode)`. */
export function updateAt(doc, path, fn) {
  if (path.length === 0) return fn(doc);
  const [i, ...rest] = path;
  const content = doc.content.slice();
  content[i] = updateAt(content[i], rest, fn);
  return { ...doc, content };
}

/** Immutably set the node at `path`. */
export function setAt(doc, path, node) {
  return updateAt(doc, path, () => node);
}

/** Replace the `content` array of the node at `path`. */
export function setChildren(doc, path, children) {
  return updateAt(doc, path, (n) => ({ ...n, content: children }));
}

/** Insert `nodes` into the parent's content at `index`. */
export function insertChildren(doc, parentPath, index, nodes) {
  return updateAt(doc, parentPath, (parent) => {
    const content = parent.content.slice();
    content.splice(index, 0, ...nodes);
    return { ...parent, content };
  });
}

/** Remove `count` children starting at `index` from the parent at `parentPath`. */
export function removeChildren(doc, parentPath, index, count = 1) {
  return updateAt(doc, parentPath, (parent) => {
    const content = parent.content.slice();
    content.splice(index, count);
    return { ...parent, content };
  });
}

export const parentPath = (path) => path.slice(0, -1);
export const lastIndex = (path) => path[path.length - 1];

/** Number of children of the node at `path`. */
export function childCount(doc, path) {
  const n = getNode(doc, path);
  return (n.content || []).length;
}

/** Path of the previous sibling, or null. */
export function prevSiblingPath(path) {
  const i = lastIndex(path);
  if (i <= 0) return null;
  return [...parentPath(path), i - 1];
}

/** Path of the next sibling within a parent of `siblingCount`, or null. */
export function nextSiblingPath(path, siblingCount) {
  const i = lastIndex(path);
  if (i >= siblingCount - 1) return null;
  return [...parentPath(path), i + 1];
}

/** Deep-clone a node tree (drops transient fields by virtue of plain copy). */
export function cloneNode(n) {
  if (n.type === 'text') return { ...n, marks: n.marks ? n.marks.map((m) => ({ ...m })) : undefined };
  return { ...n, content: n.content ? n.content.map(cloneNode) : undefined };
}
