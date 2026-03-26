/**
 * SectionDragExtension
 *
 * Enhances TipTap's block drag handle so that:
 *   - Dragging an H1 block moves everything until the next H1 (or end of doc)
 *   - Dragging an H2 block moves everything until the next H1 or H2
 *   - Dragging an H3 block moves everything until the next H1, H2, or H3
 *   - Dragging a non-heading block behaves normally (single block)
 *
 * Strategy:
 *   We hook into ProseMirror's transaction pipeline via `appendTransaction`.
 *   When TipTap's built-in DragHandle plugin starts a drag on a heading,
 *   we detect it by resolving the selection position (works with any
 *   selection type — NodeSelection, NodeRangeSelection, etc.) and patch
 *   `view.dragging.slice` to include the full section content.
 *   On `drop` we use a custom `handleDrop` to move the entire section
 *   as a single atomic operation.
 *
 *   The editor's visible selection is NOT changed — only the drag handle
 *   indicator (H1≡ / H2≡ / H3≡) tells the user they're moving a section.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const SECTION_DRAG_KEY = new PluginKey('sectionDrag');

/** Return the heading level of a ProseMirror node, or null if not a heading. */
function headingLevel(node) {
    if (node && node.type.name === 'heading') return node.attrs.level;
    return null;
}

/**
 * Given a doc and the position of a heading node, compute the full "section"
 * owned by that heading.
 *
 * The section includes the heading plus all content until the next heading
 * whose level is <= the heading's level, or end of document.
 *
 * Examples (dragging the marked heading):
 *   H1*  →  grabs everything until next H1 (includes H2, H3 and their content)
 *   H2*  →  grabs everything until next H1 or H2 (includes H3 and its content)
 *   H3*  →  grabs everything until next H1, H2, or H3
 *
 * @param {Node} doc - ProseMirror document node
 * @param {number} headingPos - Position of the heading in the document
 * @param {number} level - The heading's level (1, 2, or 3)
 * @returns {{ from: number, to: number }}
 */
function getSectionRange(doc, headingPos, level) {
    let sectionTo = doc.content.size;
    let foundHeading = false;

    doc.forEach((node, offset) => {
        if (offset === headingPos) {
            foundHeading = true;
            return; // skip the heading itself
        }
        if (!foundHeading) return;

        // We're past the dragged heading — look for the boundary
        if (sectionTo === doc.content.size) {
            const lvl = headingLevel(node);
            // Stop at any heading with level <= ours (same level or higher)
            if (lvl !== null && lvl <= level) {
                sectionTo = offset;
            }
        }
    });

    return { from: headingPos, to: sectionTo };
}

/**
 * Resolve the top-level heading node from a selection's start position.
 * Works regardless of selection type (NodeSelection, NodeRangeSelection, etc.)
 *
 * @returns {{ node, pos } | null}
 */
function resolveHeadingFromSelection(doc, selFrom) {
    const $from = doc.resolve(selFrom);

    if ($from.depth === 0) {
        // Position is at doc level — the heading is nodeAfter
        const node = $from.nodeAfter;
        return node ? { node, pos: selFrom } : null;
    }

    // Position is inside a node — walk up to the top-level parent
    const node = $from.node(1);
    const pos = $from.before(1);
    return node ? { node, pos } : null;
}

export const SectionDragExtension = Extension.create({
    name: 'sectionDrag',

    addProseMirrorPlugins() {
        const editor = this.editor;

        // Mutable state shared between appendTransaction and handleDrop
        let sectionDrag = null; // { from, to, slice } while a section is being dragged

        return [
            new Plugin({
                key: SECTION_DRAG_KEY,

                /**
                 * appendTransaction — detect when the DragHandle starts
                 * a drag on a heading. Uses position-based detection that
                 * works with any selection type.
                 *
                 * We DON'T change the selection (no visual change) — we only
                 * patch view.dragging.slice so the drag carries the full section.
                 */
                appendTransaction(transactions, oldState, newState) {
                    const view = editor.view;

                    // Only act during a drag (view.dragging is set by DragHandle)
                    if (!view.dragging) return null;

                    // Already processed this drag — don't re-trigger
                    if (sectionDrag) return null;

                    // Resolve the top-level node at the selection start
                    const resolved = resolveHeadingFromSelection(
                        newState.doc,
                        newState.selection.from
                    );
                    if (!resolved) return null;

                    const { node: headingNode, pos: headingPos } = resolved;
                    const level = headingLevel(headingNode);
                    if (level === null) return null; // Not a heading — leave it alone

                    // Compute the section range
                    const { from, to } = getSectionRange(newState.doc, headingPos, level);

                    // If the section is just the heading itself, no expansion needed
                    const headingEnd = headingPos + headingNode.nodeSize;
                    if (to <= headingEnd) return null;

                    // Expand view.dragging.slice to the full section
                    const sectionSlice = newState.doc.slice(from, to);
                    view.dragging = { slice: sectionSlice, move: true };

                    // Store state for handleDrop
                    sectionDrag = { from, to, slice: sectionSlice };

                    // Return null — don't change the visible selection.
                    return null;
                },

                props: {
                    /**
                     * handleDrop — take over the drop when we have a pending section drag.
                     * Performs the full section move as a single transaction.
                     */
                    handleDrop(view, event, slice, moved) {
                        if (!sectionDrag || !moved) {
                            return false; // Not our business
                        }

                        const { from: srcFrom, to: srcTo, slice: sectionSlice } = sectionDrag;
                        sectionDrag = null;

                        event.preventDefault();
                        event.stopPropagation();

                        // Find the drop position in document coordinates
                        const dropCoords = view.posAtCoords({
                            left: event.clientX,
                            top: event.clientY,
                        });
                        if (!dropCoords) return true;

                        let insertPos = dropCoords.pos;

                        // Snap to a top-level block boundary
                        const $drop = view.state.doc.resolve(insertPos);
                        let depth = $drop.depth;
                        while (depth > 1) depth--;
                        const blockStart = $drop.before(Math.max(1, depth));
                        const blockEnd = $drop.after(Math.max(1, depth));

                        // Decide whether to insert above or below based on cursor position
                        const nodeDOM = view.nodeDOM(blockStart);
                        if (nodeDOM && nodeDOM.getBoundingClientRect) {
                            const rect = nodeDOM.getBoundingClientRect();
                            const midY = rect.top + rect.height / 2;
                            insertPos = event.clientY < midY ? blockStart : blockEnd;
                        } else {
                            insertPos = blockEnd;
                        }

                        // Don't drop inside the source range (no-op)
                        if (insertPos >= srcFrom && insertPos <= srcTo) {
                            return true;
                        }

                        // Build the move transaction
                        const tr = view.state.tr;

                        if (insertPos > srcTo) {
                            // Drop is AFTER source: insert first, then delete (positions shift)
                            tr.insert(insertPos, sectionSlice.content);
                            tr.delete(srcFrom, srcTo);
                        } else {
                            // Drop is BEFORE source: delete first, then insert
                            tr.delete(srcFrom, srcTo);
                            tr.insert(insertPos, sectionSlice.content);
                        }

                        view.dispatch(tr);
                        return true; // Handled — skip ProseMirror's default drop
                    },

                    handleDOMEvents: {
                        /**
                         * dragend — clean up when a drag is cancelled or
                         * drops outside the editor.
                         */
                        dragend() {
                            sectionDrag = null;
                            return false;
                        },
                    },
                },
            }),
        ];
    },
});
