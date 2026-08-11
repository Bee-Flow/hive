import { createContext, useContext } from 'react';
import { sectionIdFromDroppable, screenIdFromScreenTabDroppable } from './dnd';
import { findNode, subtreeIds } from '../state/definitionOps';

/**
 * Where a drag would land, published for the canvas to draw.
 *
 * The editor had NO drop indicator at all: no line, no gap, no marking.
 * Reordering two components inside the same container showed nothing whatsoever
 * until you let go — the only feedback was the floating chip under the cursor,
 * which says what you are dragging and never where it goes. dnd-kit's own
 * transform preview does not fire here either, because same-parent reorders are
 * deliberately NOT applied transiently (they oscillate under the pointer).
 *
 * The rules below mirror computeDragEnd exactly — one place decides the drop and
 * this reads the same inputs, so the line can never point somewhere the drop
 * will not go.
 */
export const DropHintContext = createContext(null);

export function useDropHint(nodeId) {
    const hint = useContext(DropHintContext);
    return (hint && hint.nodeId === nodeId) ? hint.edge : null;
}

/**
 * @returns {{nodeId: string, edge: 'before'|'after'|'inside'}|null}
 */
export function computeDropHint({ active, over, definition, isPalette }) {
    if (!active || !over || over.id == null || !definition) return null;
    const overId = over.id;
    // A section or a screen tab already renders its own "drop here" affordance.
    if (sectionIdFromDroppable(overId) || screenIdFromScreenTabDroppable(overId)) return null;

    const overFound = findNode(definition, overId);
    if (!overFound) return null;

    if (!isPalette) {
        if (overId === active.id) return null;
        const activeFound = findNode(definition, active.id);
        if (!activeFound) return null;
        if (subtreeIds(activeFound.node).has(overId)) return null;       // into its own subtree
        if (Array.isArray(overFound.node.children)) {
            // computeDragEnd refuses a drop into one's own parent container.
            if (overFound.node.id === activeFound.parent.id) return null;
            return { nodeId: overId, edge: 'inside' };
        }
        // A node takes the sibling's slot → it lands BEFORE it.
        return { nodeId: overId, edge: 'before' };
    }

    if (Array.isArray(overFound.node.children)) return { nodeId: overId, edge: 'inside' };
    // A palette drop inserts AFTER the node under the pointer (matching
    // click-to-add, which appends below the selection).
    return { nodeId: overId, edge: 'after' };
}
