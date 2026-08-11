/**
 * App Studio editor — PURE drag-and-drop logic. No React, no dnd-kit imports:
 * everything here takes plain data and returns plain data so it is unit-
 * testable without a DOM (see dnd.test.js).
 *
 * Draggable/droppable id vocabulary (shared with the shell + canvas):
 *   <nodeId>              — a canvas node (useSortable in EditorNodeWrapper)
 *   'palette:<type>'      — a palette row (useDraggable in Palette.jsx)
 *   'section:<sectionId>' — an empty-section drop zone (useDroppable in Canvas)
 *
 * SortableContext placement (documented design choice): ONE SortableContext
 * per screen lives in Canvas.jsx with every node id of the screen flattened
 * in render order, and the shell's DndContext uses closestCorners to resolve
 * targets across parents. We deliberately do NOT apply dnd-kit's sortable
 * transforms — cross-parent "make room" feedback comes from the shell
 * transiently applying the real move to the definition during onDragOver
 * (see AppEditorShell), which one shared context supports naturally and
 * per-section contexts would fight (a node mid-drag hops between contexts).
 *
 * computeDragEnd() is called by the shell twice: against the LIVE definition
 * on dragOver (transient cross-parent preview) and against the pre-drag
 * SNAPSHOT on drop (the single history commit), so its rules must be pure
 * functions of (active, over, definition).
 */

import { APP_COMPONENT_TYPES } from '../runtime/componentRegistry';
import { deepClone, findNode, insertNode, moveNode, newId, subtreeIds } from '../state/definitionOps';

const SECTION_PREFIX = 'section:';
const SCREENTAB_PREFIX = 'screentab:';
export const PALETTE_PREFIX = 'palette:';

export function sectionDroppableId(sectionId) {
    return `${SECTION_PREFIX}${sectionId}`;
}

export function sectionIdFromDroppable(id) {
    return typeof id === 'string' && id.startsWith(SECTION_PREFIX)
        ? id.slice(SECTION_PREFIX.length)
        : null;
}

/** Droppable id for a screen tab (cross-screen drag target). */
export function screenTabDroppableId(screenId) {
    return `${SCREENTAB_PREFIX}${screenId}`;
}

export function screenIdFromScreenTabDroppable(id) {
    return typeof id === 'string' && id.startsWith(SCREENTAB_PREFIX)
        ? id.slice(SCREENTAB_PREFIX.length)
        : null;
}

/** The first section id of a screen (the drop target for cross-screen drags). */
function firstSectionOfScreen(definition, screenId) {
    const screen = (definition?.screens || []).find((s) => s.id === screenId);
    return screen?.sections?.[0]?.id || null;
}

/**
 * Build a fresh node for a component type from the registry defaults.
 * Containers get an empty children array (container-ness contract of
 * definitionOps). Returns null for unknown types.
 */
export function buildNode(type) {
    const entry = APP_COMPONENT_TYPES[type];
    if (!entry) return null;
    const node = {
        id: newId('component'),
        type,
        visible: true,
        props: deepClone(entry.defaultProps || {}),
        style: { ...(entry.defaultStyle || {}) },
    };
    if (entry.container) node.children = [];
    return node;
}

/** dnd-kit hands entry.data as a ref ({ current }); tests pass plain objects. */
function dragData(entry) {
    const data = entry?.data;
    if (data && typeof data === 'object' && 'current' in data) return data.current || {};
    return data || {};
}

function sectionExists(definition, sectionId) {
    return (definition?.screens || []).some((screen) =>
        (screen.sections || []).some((section) => section.id === sectionId));
}

/**
 * Resolve a finished (or transiently previewed) drag into a definition op.
 *
 *   → { op: 'insert', node, parentId, index }          (palette drops)
 *   → { op: 'move', nodeId, toParentId, index }        (canvas node drops)
 *   → null                                             (no-op / invalid)
 *
 * index semantics follow definitionOps (insertAt / moveNode: nullish index
 * appends; move index addresses the destination AFTER the node is lifted).
 * Rules:
 *   - palette over a node        → insert AFTER it (matches click-to-add)
 *   - palette over a container   → insert INSIDE, at the end
 *   - palette over 'section:x'   → append to that section
 *   - node over a sibling        → take the sibling's position (arrayMove-
 *                                  equivalent same-parent, before-it cross-parent)
 *   - node over a container      → move INSIDE, at the end (not its own parent)
 *   - node over 'section:x'      → append to that section
 *   - over itself / own subtree / own parent container → null
 */
export function computeDragEnd({ active, over, definition, screenId } = {}) {
    if (!active || !over || !definition || over.id == null) return null;
    const overId = over.id;
    const activeData = dragData(active);
    const overSectionId = sectionIdFromDroppable(overId);
    const overScreenTabId = screenIdFromScreenTabDroppable(overId);
    const isPalette = activeData.type === 'palette'
        || (typeof active.id === 'string' && active.id.startsWith(PALETTE_PREFIX));

    if (isPalette) {
        const componentType = activeData.componentType
            || String(active.id).slice(PALETTE_PREFIX.length);
        const node = buildNode(componentType);
        if (!node) return null;
        if (overScreenTabId) {
            // Dropping a palette component on a screen tab adds it to that
            // screen's first section.
            const targetSection = firstSectionOfScreen(definition, overScreenTabId);
            if (!targetSection) return null;
            return { op: 'insert', node, parentId: targetSection, index: null, screenId: overScreenTabId };
        }
        if (overSectionId) {
            if (!sectionExists(definition, overSectionId)) return null;
            return { op: 'insert', node, parentId: overSectionId, index: null };
        }
        const overFound = findNode(definition, overId);
        if (!overFound) return null;
        if (Array.isArray(overFound.node.children)) {
            return { op: 'insert', node, parentId: overFound.node.id, index: overFound.node.children.length };
        }
        return { op: 'insert', node, parentId: overFound.parent.id, index: overFound.index + 1 };
    }

    // Canvas node drag.
    const nodeId = active.id;
    if (overId === nodeId) return null;
    const activeFound = findNode(definition, nodeId);
    if (!activeFound) return null;

    if (overScreenTabId) {
        // Dropped on a screen tab → move into that screen's first section
        // (append). A no-op move (already the last child there) is handled by
        // moveNode returning the same reference.
        const targetSection = firstSectionOfScreen(definition, overScreenTabId);
        if (!targetSection) return null;
        return { op: 'move', nodeId, toParentId: targetSection, index: null, screenId: overScreenTabId };
    }

    if (overSectionId) {
        if (!sectionExists(definition, overSectionId)) return null;
        return { op: 'move', nodeId, toParentId: overSectionId, index: null };
    }

    const overFound = findNode(definition, overId);
    if (!overFound) return null;
    if (subtreeIds(activeFound.node).has(overId)) return null; // into own subtree
    if (Array.isArray(overFound.node.children)) {
        // Hovering a container drops inside it — except one's own parent,
        // where geometry makes it far too easy to trigger accidentally.
        if (overFound.node.id === activeFound.parent.id) return null;
        return { op: 'move', nodeId, toParentId: overFound.node.id, index: null };
    }
    return { op: 'move', nodeId, toParentId: overFound.parent.id, index: overFound.index, screenId };
}

/**
 * Resolve a finished drag into the single result the shell should COMMIT,
 * given the pre-drag `snapshot` and the (transiently mutated) `liveDefinition`.
 *
 * Returns { def, nodeId, op } (def computed against the snapshot, so exactly
 * one history entry captures the whole gesture) or null when the drag was a
 * true no-op.
 *
 * The subtlety this handles: onDragOver transiently reparents a node across
 * sections/containers (plain set_definition, no history), so by drop time the
 * node often sits UNDER the pointer — over.id === active.id — and
 * computeDragEnd(snapshot) returns null (a self-drop). Reverting to the
 * snapshot then would throw away the whole cross-parent gesture. So when the
 * fresh computation is a no-op BUT the live draft diverged from the snapshot,
 * we keep that transient move as the committed result instead of reverting.
 */
export function resolveDrop({ snapshot, liveDefinition, active, over, screenId } = {}) {
    if (!snapshot) return null;
    const res = computeDragEnd({ active, over, definition: snapshot, screenId });
    if (res) {
        const { def, nodeId } = applyDragResult(snapshot, res);
        if (def === snapshot) return null;
        return { def, nodeId, op: res.op };
    }
    // No fresh op — but a transient dragOver may have already moved the node.
    if (liveDefinition && liveDefinition !== snapshot) {
        return { def: liveDefinition, nodeId: active?.id ?? null, op: 'move' };
    }
    return null;
}

/**
 * Apply a computeDragEnd result to a definition.
 * Returns { def, nodeId } — same def reference when nothing changed; nodeId
 * is the inserted node's real id (insert) or the moved node's id (move).
 */
export function applyDragResult(definition, result) {
    if (!result) return { def: definition, nodeId: null };
    if (result.op === 'insert') {
        const { def, nodeId } = insertNode(definition, {
            parentId: result.parentId,
            index: result.index ?? undefined,
            node: result.node,
        });
        return { def, nodeId };
    }
    if (result.op === 'move') {
        const def = moveNode(definition, result.nodeId, {
            toParentId: result.toParentId,
            index: result.index ?? undefined,
        });
        return { def, nodeId: result.nodeId };
    }
    return { def: definition, nodeId: null };
}
