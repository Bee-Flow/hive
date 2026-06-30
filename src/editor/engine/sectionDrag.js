/**
 * sectionDrag.js — heading-aware block move (ports SectionDragExtension).
 *
 * Dragging a heading moves the whole section (the heading + every following
 * top-level block until the next heading of equal-or-higher level). Non-heading
 * blocks move alone. Operates on the top-level block array — simpler than the old
 * ProseMirror appendTransaction/slice patching.
 */
import { textSelection, pos } from './selection.js';

export function getSectionRange(doc, idx) {
  const blocks = doc.content || [];
  const node = blocks[idx];
  if (!node || node.type !== 'heading') return 1;
  const level = node.attrs?.level || 1;
  let count = 1;
  for (let i = idx + 1; i < blocks.length; i++) {
    const n = blocks[i];
    if (n.type === 'heading' && (n.attrs?.level || 1) <= level) break;
    count++;
  }
  return count;
}

/** Move `count` top-level blocks starting at `fromIdx` to before original index `toIdx`. */
export function moveBlocks(state, fromIdx, count, toIdx) {
  if (toIdx >= fromIdx && toIdx < fromIdx + count) return state; // dropping inside the source
  const blocks = (state.doc.content || []).slice();
  const moving = blocks.splice(fromIdx, count);
  const insertAt = Math.max(0, Math.min(toIdx > fromIdx ? toIdx - count : toIdx, blocks.length));
  blocks.splice(insertAt, 0, ...moving);
  return { doc: { ...state.doc, content: blocks }, selection: textSelection(pos([insertAt], 0)), storedMarks: null };
}
