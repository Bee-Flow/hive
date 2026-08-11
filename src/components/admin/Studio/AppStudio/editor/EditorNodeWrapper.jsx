import { useSortable } from '@dnd-kit/sortable';
import { useDropHint } from './dropHint';
import { Copy, GripVertical, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { spanFromDrag, heightFromDrag, HEIGHT_STEPS } from './resize';
import ConfirmDialog from '../../../../shared/ConfirmDialog';
import IconButton from '../../../../shared/IconButton';
import { getKnobsForType } from '../inspector/styleKnobMeta';
import { getComponentEntry } from '../runtime/componentRegistry';
import { useRuntime } from '../runtime/RuntimeContext';
import { isFill, resolveHeight, spanGridColumn } from '../runtime/styleResolver';
import { useAppEditor } from '../state/AppEditorContext';
import { duplicateNode, findNode, removeNode, updateNodeStyle } from '../state/definitionOps';

/**
 * App Studio editor — the NodeWrapper the canvas hands to AppRenderer.
 *
 * Honors the renderer contract: it renders the node's GRID CELL and spreads
 * className/style onto its outermost element so the 12-column placement
 * survives. Everything editor-y layers on top:
 *
 *   - useSortable(node.id): the whole cell activates a drag (PointerSensor
 *     distance 6 keeps plain clicks selecting), and the selected node's
 *     mini-toolbar exposes an explicit GripVertical activator. We do NOT
 *     apply sortable transforms — live move feedback comes from the shell's
 *     transient definition updates (see dnd.js header).
 *   - selection on pointerdown (not click, so drags still start); the event is
 *     CLAIMED rather than stopped, so nested nodes don't select their container
 *     too while document-level outside-click handlers still see it.
 *   - ON-CANVAS RESIZE: a selected, unlocked node gets a right-edge WIDTH grip
 *     (drags span in 1–12 steps snapped to the section grid) and, for types
 *     whose spec carries the `height` knob (image), a bottom-edge HEIGHT grip
 *     (snaps auto→sm→md→lg). Both live-preview via LOCAL inline style only —
 *     no reducer churn — and commit ONE history entry on pointer-up, so the
 *     draft-history sees the pre-drag definition as current and records a
 *     single undoable step. Handles are absolute overlays (no layout shift),
 *     hidden in preview/run mode and while the AI streams.
 *   - leaf content is inert in edit mode (React 19 boolean attribute) with a
 *     pointer-events fallback, so inner buttons/inputs are dead. Container
 *     content stays interactive — its children are EditorNodeWrappers
 *     themselves and must remain selectable; runtime components already
 *     no-op their handlers in edit mode.
 *   - hover/selected outlines + the "just added" pulse live in editor.css
 *     (outline/box-shadow/opacity only — no layout shift; selection raises
 *     z-index and relaxes `contain` from layout+paint to layout so the
 *     toolbar and resize grips may overflow the cell).
 */

function clampSpan(n) {
    return Number.isFinite(n) ? Math.max(1, Math.min(12, Math.round(n))) : 12;
}

// Marker set on the NATIVE pointerdown by whichever cell (or cell toolbar)
// handled it first, so ancestor cells keep their hands off without cutting the
// event short — see handlePointerDown.
const NODE_POINTERDOWN_CLAIM = '__aseNodePointerDown';

/** Claim a pointerdown for this cell; false when a descendant already had it. */
function claimPointerDown(e) {
    if (e.nativeEvent[NODE_POINTERDOWN_CLAIM]) return false;
    e.nativeEvent[NODE_POINTERDOWN_CLAIM] = true;
    return true;
}

export default function EditorNodeWrapper({ node, className, style, children, onCommit }) {
    const { definition, mode, streamLock, recentlyAddedIds, dispatch } = useAppEditor();
    const { selectedNodeId, selectedNodeIds, onSelectNode } = useRuntime();
    const [confirmDelete, setConfirmDelete] = useState(false);

    // A node under a repeating container is rendered ONCE PER ROW, all copies
    // carrying the same node.id. Exactly one of them — the first in document
    // order, i.e. the first row — owns the editor affordances; the others are
    // read-only echoes. Without this the canvas grows a toolbar and a grip per
    // row and dnd-kit sees one sortable id registered N times (its registry is
    // keyed by id, so the copies would also unregister each other).
    // Ownership can only be read off the mounted DOM, so every instance starts
    // as an echo and the layout effect below promotes the first one — never the
    // other way round, which would flash a duplicated real id.
    const instanceId = useId();
    const [primary, setPrimary] = useState(false);
    // Where a live drag would land relative to THIS node ('before' | 'after' |
    // 'inside'), or null. The editor drew nothing at all before this.
    const dropEdge = useDropHint(node.id);
    const {
        attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging,
    } = useSortable({
        id: primary ? node.id : `${node.id}::${instanceId}`,
        data: { type: 'node', node },
        disabled: !primary,
    });

    const editMode = mode === 'edit';
    // Multi-select: the whole set is the source of truth; selectedNodeId is its
    // anchor. A node is OUTLINED when it's anywhere in the set; only the ANCHOR
    // renders the mini-toolbar + resize grips (a stable single-node surface).
    const selectionSet = selectedNodeIds instanceof Set ? selectedNodeIds : null;
    const inSelection = editMode && (selectionSet ? selectionSet.has(node.id) : selectedNodeId === node.id);
    const selected = editMode && selectedNodeId === node.id && primary;
    const selectionCount = selectionSet ? selectionSet.size : (selectedNodeId ? 1 : 0);
    const isMulti = selectionCount > 1;
    const recent = recentlyAddedIds instanceof Set && recentlyAddedIds.has(node.id);
    const isContainer = Array.isArray(node.children);
    const hasChildren = isContainer && node.children.length > 0;
    const entry = getComponentEntry(node.type);
    const label = entry?.label || node.type;

    // --- on-canvas resize ----------------------------------------------------
    const currentSpan = clampSpan(node.style?.span);
    const currentHeight = HEIGHT_STEPS.includes(node.style?.height) ? node.style.height : 'auto';
    const supportsHeight = getKnobsForType(node.type).includes('height');
    const showHandles = selected && !streamLock;

    // Live definition for the pointer-up commit (no reducer writes happen
    // during a drag, but read via ref so an unrelated re-render can't stale it).
    const definitionRef = useRef(definition);
    useEffect(() => { definitionRef.current = definition; });

    // Own DOM ref (to measure the parent grid) that also feeds dnd-kit.
    const cellRef = useRef(null);
    const setCellRef = useCallback((el) => {
        cellRef.current = el;
        setNodeRef(el);
    }, [setNodeRef]);

    // Re-checked after every commit: rows appear, disappear and reorder as the
    // repeater's data changes, so "am I the first copy?" is never cached.
    useLayoutEffect(() => {
        const el = cellRef.current;
        if (!el) return;
        const first = el.ownerDocument?.querySelector(`[data-node-id="${node.id}"]`);
        setPrimary(!first || first === el);
    });

    const widthDragRef = useRef(null);
    const heightDragRef = useRef(null);
    const [widthPreview, setWidthPreview] = useState(null);   // span while dragging, else null
    const [heightPreview, setHeightPreview] = useState(null); // height step while dragging, else null

    const commitStyle = useCallback((patch) => {
        const next = updateNodeStyle(definitionRef.current, node.id, patch);
        if (next !== definitionRef.current) onCommit?.(next);
    }, [node.id, onCommit]);

    // WIDTH — right edge. One grid column = grid width / 12.
    const startWidthResize = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (streamLock) return;
        const gridEl = cellRef.current?.parentElement;
        const gridWidth = gridEl ? gridEl.getBoundingClientRect().width : 0;
        const columnWidth = gridWidth > 0 ? gridWidth / 12 : 0;
        widthDragRef.current = { startSpan: currentSpan, startX: e.clientX, columnWidth };
        setWidthPreview(currentSpan);
        e.currentTarget.setPointerCapture?.(e.pointerId);
    }, [streamLock, currentSpan]);

    const moveWidthResize = useCallback((e) => {
        const d = widthDragRef.current;
        if (!d) return;
        setWidthPreview(spanFromDrag({ startSpan: d.startSpan, dx: e.clientX - d.startX, columnWidth: d.columnWidth }));
    }, []);

    const endWidthResize = useCallback((e) => {
        const d = widthDragRef.current;
        widthDragRef.current = null;
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
        if (!d) return;
        const span = spanFromDrag({ startSpan: d.startSpan, dx: e.clientX - d.startX, columnWidth: d.columnWidth });
        setWidthPreview(null);
        if (span !== d.startSpan) commitStyle({ span });
    }, [commitStyle]);

    const cancelWidthResize = useCallback((e) => {
        widthDragRef.current = null;
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
        setWidthPreview(null);
    }, []);

    const onWidthKeyDown = useCallback((e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        e.stopPropagation();
        const span = clampSpan(currentSpan + (e.key === 'ArrowRight' ? 1 : -1));
        if (span !== currentSpan) commitStyle({ span });
    }, [currentSpan, commitStyle]);

    // HEIGHT — bottom edge (height-capable types only). Snaps by dragged step.
    const startHeightResize = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (streamLock) return;
        heightDragRef.current = { startHeight: currentHeight, startY: e.clientY };
        setHeightPreview(currentHeight);
        e.currentTarget.setPointerCapture?.(e.pointerId);
    }, [streamLock, currentHeight]);

    const moveHeightResize = useCallback((e) => {
        const d = heightDragRef.current;
        if (!d) return;
        setHeightPreview(heightFromDrag({ startHeight: d.startHeight, dy: e.clientY - d.startY }));
    }, []);

    const endHeightResize = useCallback((e) => {
        const d = heightDragRef.current;
        heightDragRef.current = null;
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
        if (!d) return;
        const height = heightFromDrag({ startHeight: d.startHeight, dy: e.clientY - d.startY });
        setHeightPreview(null);
        if (height !== d.startHeight) commitStyle({ height });
    }, [commitStyle]);

    const cancelHeightResize = useCallback((e) => {
        heightDragRef.current = null;
        e.currentTarget?.releasePointerCapture?.(e.pointerId);
        setHeightPreview(null);
    }, []);

    const onHeightKeyDown = useCallback((e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        e.stopPropagation();
        const idx = Math.max(0, HEIGHT_STEPS.indexOf(currentHeight));
        const next = Math.max(0, Math.min(HEIGHT_STEPS.length - 1, idx + (e.key === 'ArrowDown' ? 1 : -1)));
        const height = HEIGHT_STEPS[next];
        if (height !== currentHeight) commitStyle({ height });
    }, [currentHeight, commitStyle]);

    // --- selection / node actions --------------------------------------------
    const { onPointerDown: dndPointerDown, ...restListeners } = listeners || {};

    const handlePointerDown = (e) => {
        // NOT stopPropagation: React dispatches from the root container, so
        // stopping there also kills the native event before it reaches the
        // document-level outside-click listeners every menu/popover closes on.
        // The claim gives nested cells the same "my ancestors keep their hands
        // off" guarantee while the event still travels on to the document.
        if (!claimPointerDown(e)) return;
        dndPointerDown?.(e);
        // Shift/⌘/Ctrl-click toggles this node in the multi-selection; a plain
        // click replaces the selection with just this node (legacy behaviour).
        if (e.shiftKey || e.metaKey || e.ctrlKey) dispatch({ type: 'toggle_node', nodeId: node.id });
        else onSelectNode?.(node.id);
    };

    /*
     * Selection from the keyboard.
     *
     * dnd-kit's attributes give every cell role="button" and a tab stop, and
     * its KeyboardSensor listener (carried in restListeners) claims Enter and
     * Space to START A DRAG. So a keyboard user could tab onto a component,
     * press Enter, and begin dragging it — while no key selected anything.
     * Selecting is what Enter means on something announced as a button, so it
     * takes precedence and the drag keeps its own grip.
     */
    const handleKeyDown = (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (e.target !== e.currentTarget) return;   // a control inside keeps its own keys
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey || e.metaKey || e.ctrlKey) dispatch({ type: 'toggle_node', nodeId: node.id });
        else onSelectNode?.(node.id);
    };

    const doRemove = () => {
        setConfirmDelete(false);
        onCommit?.(removeNode(definition, node.id));
    };

    const doDuplicate = () => {
        const { def, nodeId } = duplicateNode(definition, node.id);
        if (!nodeId) return;
        onCommit?.(def);
        dispatch({ type: 'select_node', nodeId });
    };

    // --- bulk actions over the whole selection (one history commit each) -------
    const selectionIds = selectionSet ? [...selectionSet] : (selectedNodeId ? [selectedNodeId] : []);
    const anyContainerSelected = selectionIds.some((id) => {
        const f = findNode(definition, id);
        return f && Array.isArray(f.node.children) && f.node.children.length > 0;
    });

    const doBulkRemove = () => {
        setConfirmDelete(false);
        let def = definition;
        for (const id of selectionIds) def = removeNode(def, id);
        if (def !== definition) onCommit?.(def);
        dispatch({ type: 'clear_selection' });
    };

    const doBulkDuplicate = () => {
        let def = definition;
        const newIds = [];
        for (const id of selectionIds) {
            const res = duplicateNode(def, id);
            if (res.nodeId) { def = res.def; newIds.push(res.nodeId); }
        }
        if (def !== definition) onCommit?.(def);
        if (newIds.length) dispatch({ type: 'select_many', ids: newIds });
    };

    const clearPulse = () => dispatch({ type: 'clear_recent_id', nodeId: node.id });

    // Live-preview overrides — LOCAL only, so the reducer/history stay clean.
    const previewStyle = {};
    if (widthPreview != null) previewStyle.gridColumn = spanGridColumn(widthPreview);
    if (heightPreview != null) previewStyle.height = resolveHeight(heightPreview) || 'auto';

    return (
        <div
            ref={setCellRef}
            data-node-id={node.id}
            data-app-type={node.type}
            data-selected={inSelection || undefined}
            data-drop-edge={dropEdge || undefined}
            className={`${className} ase-cell ${recent ? 'ase-added-pulse' : ''}`}
            style={{
                ...style,
                ...previewStyle,
                // Relax paint containment for any selected cell so its outline
                // (and the anchor's toolbar/grips) can overflow the cell box.
                contain: inSelection ? 'layout' : 'layout paint',
                zIndex: selected ? 10 : (inSelection ? 5 : style?.zIndex),
                opacity: isDragging ? 0.4 : style?.opacity,
            }}
            onPointerDown={handlePointerDown}
            onAnimationEnd={recent ? clearPulse : undefined}
            {...attributes}
            {...restListeners}
            // After restListeners, so selecting wins over the keyboard drag.
            onKeyDown={handleKeyDown}
        >
            {selected && isMulti ? (
                <div
                    className="absolute left-0 bottom-full mb-1 z-20 flex items-center gap-0.5 rounded-md border px-1 py-0.5 shadow-sm whitespace-nowrap"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--editor-accent)' }}
                    onPointerDown={claimPointerDown}
                    data-multi-toolbar="true"
                >
                    <span
                        className="px-1.5 text-[10px] font-semibold uppercase tracking-wide select-none"
                        style={{ color: 'var(--editor-accent)' }}
                    >
                        {selectionCount} selected
                    </span>
                    <IconButton size="sm" ariaLabel="Duplicate selected" onClick={doBulkDuplicate}>
                        <Copy />
                    </IconButton>
                    <IconButton
                        size="sm"
                        variant="danger"
                        ariaLabel="Delete selected"
                        onClick={() => (anyContainerSelected ? setConfirmDelete(true) : doBulkRemove())}
                    >
                        <Trash2 />
                    </IconButton>
                </div>
            ) : selected ? (
                <div
                    className="absolute left-0 bottom-full mb-1 z-20 flex items-center gap-0.5 rounded-md border px-1 py-0.5 shadow-sm whitespace-nowrap"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                    onPointerDown={claimPointerDown}
                >
                    <span
                        className="px-1 text-[10px] font-semibold uppercase tracking-wide select-none"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        {label}
                    </span>
                    <button
                        type="button"
                        ref={setActivatorNodeRef}
                        {...(listeners || {})}
                        aria-label="Drag to move · Alt+Arrow to reorder"
                        title="Drag to move · Alt+↑/↓ to reorder"
                        className="ase-move-grip p-1 rounded cursor-grab active:cursor-grabbing"
                        style={{ color: 'var(--editor-accent)', touchAction: 'none' }}
                    >
                        <GripVertical className="w-4 h-4" />
                    </button>
                    <IconButton size="sm" ariaLabel="Duplicate" onClick={doDuplicate}>
                        <Copy />
                    </IconButton>
                    <IconButton
                        size="sm"
                        variant="danger"
                        ariaLabel="Delete"
                        onClick={() => (hasChildren ? setConfirmDelete(true) : doRemove())}
                    >
                        <Trash2 />
                    </IconButton>
                </div>
            ) : null}

            {/* WIDTH resize grip — right edge. */}
            {showHandles ? (
                <div
                    role="slider"
                    aria-label="Resize width"
                    aria-orientation="horizontal"
                    aria-valuemin={1}
                    aria-valuemax={12}
                    aria-valuenow={widthPreview ?? currentSpan}
                    tabIndex={0}
                    title="Drag to resize width · ←/→ to adjust"
                    className="ase-resize-handle ase-resize-x"
                    style={{ touchAction: 'none' }}
                    onPointerDown={startWidthResize}
                    onPointerMove={moveWidthResize}
                    onPointerUp={endWidthResize}
                    onPointerCancel={cancelWidthResize}
                    onKeyDown={onWidthKeyDown}
                >
                    <span className="ase-resize-grip-x" aria-hidden="true" />
                    {widthPreview != null ? (
                        <span className="ase-resize-badge" aria-hidden="true">{widthPreview} / 12</span>
                    ) : null}
                </div>
            ) : null}

            {/* HEIGHT resize grip — bottom edge (height-capable types only). */}
            {showHandles && supportsHeight ? (
                <div
                    role="slider"
                    aria-label="Resize height"
                    aria-orientation="vertical"
                    aria-valuetext={heightPreview ?? currentHeight}
                    tabIndex={0}
                    title="Drag to resize height · ↑/↓ to adjust"
                    className="ase-resize-handle ase-resize-y"
                    style={{ touchAction: 'none' }}
                    onPointerDown={startHeightResize}
                    onPointerMove={moveHeightResize}
                    onPointerUp={endHeightResize}
                    onPointerCancel={cancelHeightResize}
                    onKeyDown={onHeightKeyDown}
                >
                    <span className="ase-resize-grip-y" aria-hidden="true" />
                    {heightPreview != null ? (
                        <span className="ase-resize-badge ase-resize-badge-y" aria-hidden="true">{heightPreview}</span>
                    ) : null}
                </div>
            ) : null}

            {/*
              * This div exists to host `inert` + pointerEvents for non-container
              * nodes, so it cannot go away. But run mode (DefaultNodeWrapper)
              * has no equivalent, and while it was height-opaque a fill child
              * collapsed here and ONLY here — the editor showed something the
              * running app would never do, in a codebase whose whole premise is
              * "preview == production". Passing height through costs nothing:
              * the cell above already has a definite height in both hosts (a
              * stretched grid row, or a flex item with flex-grow).
              */}
            <div
                className={`min-w-0${isFill(node) ? ' h-full min-h-0' : ''}`}
                inert={editMode && !isContainer ? true : undefined}
                style={editMode && !isContainer ? { pointerEvents: 'none' } : undefined}
            >
                {children}
            </div>

            <ConfirmDialog
                open={confirmDelete}
                title={isMulti ? `Delete ${selectionCount} components?` : `Delete this ${label.toLowerCase()}?`}
                description={isMulti
                    ? 'Some of them are containers — everything nested inside is deleted too. You can undo this.'
                    : `It contains ${node.children?.length || 0} component${(node.children?.length || 0) === 1 ? '' : 's'} — everything inside is deleted with it.`}
                confirmLabel="Delete"
                destructive
                onConfirm={isMulti ? doBulkRemove : doRemove}
                onCancel={() => setConfirmDelete(false)}
            />
        </div>
    );
}
