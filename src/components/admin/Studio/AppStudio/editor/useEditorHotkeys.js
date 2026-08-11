import { useEffect, useRef } from 'react';
import { getClipboard, hasClipboard, pasteNodes, serializeNodes, setClipboard } from '../state/clipboard';
import { useAppEditor } from '../state/AppEditorContext';
import { duplicateNode, findNode, moveNode, removeNode } from '../state/definitionOps';

/**
 * App Studio editor — window-level keyboard shortcuts.
 *
 * Adapted from AITasksDesigner/Builder/useBuilderHotkeys.js: undo/redo/save
 * stay global even while typing (one coalesced, draft-level history beats
 * two competing undo systems — same model as Figma/Miro/n8n); everything
 * that acts on the CANVAS SELECTION is suppressed inside inputs/textareas/
 * contenteditables so Delete deletes characters, arrows move the caret and
 * Escape dismisses native dropdowns. All shortcuts pause while streamLock
 * is on (the AI owns the draft) and structural edits require edit mode.
 *
 *   Cmd/Ctrl+Z              undo         (global)
 *   Shift+Cmd+Z / Cmd+Y     redo         (global)
 *   Cmd/Ctrl+S              flush save   (global, preventDefault)
 *   Cmd/Ctrl+K              command palette (global — even while typing)
 *   Cmd/Ctrl+C             copy the selection to the in-memory clipboard
 *   Cmd/Ctrl+X             cut the selection (copy + remove, one commit)
 *   Cmd/Ctrl+V             paste after the anchor (re-id'd, selected + pulsed)
 *   Delete / Backspace      remove the whole selection (never while typing)
 *   Cmd/Ctrl+D              duplicate + select the clone (preventDefault)
 *   Escape                  deselect
 *   ArrowUp / ArrowDown     select previous / next sibling
 *   Alt+ArrowUp / Down      move the node within its parent
 *
 * Copy/cut/paste act on the CANVAS SELECTION so they are suppressed while
 * typing (native clipboard wins in inputs) and, like every structural edit,
 * pause under streamLock and require edit mode.
 */

function isTyping(target) {
    const tag = target?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target?.isContentEditable;
}

export default function useEditorHotkeys({ enabled = true, onUndo, onRedo, onFlush, onCommit, onCommandPalette }) {
    const {
        definition, selectedNodeId, selectedNodeIds, screenId, mode, streamLock, dispatch,
    } = useAppEditor();

    // One listener for the component's lifetime; reads everything via a ref
    // refreshed after every render (key events always fire after effects).
    const ctxRef = useRef(null);
    useEffect(() => {
        ctxRef.current = {
            enabled, onUndo, onRedo, onFlush, onCommit, onCommandPalette,
            definition, selectedNodeId, selectedNodeIds, screenId, mode, streamLock, dispatch,
        };
    });

    useEffect(() => {
        const onKey = (e) => {
            const c = ctxRef.current;
            if (!c || !c.enabled || c.streamLock) return;
            const meta = e.metaKey || e.ctrlKey;
            const key = e.key;
            const lower = typeof key === 'string' ? key.toLowerCase() : '';

            if (meta && lower === 'z' && !e.shiftKey) {
                e.preventDefault();
                c.onUndo?.();
                return;
            }
            if (meta && ((lower === 'z' && e.shiftKey) || (lower === 'y' && !e.shiftKey))) {
                e.preventDefault();
                c.onRedo?.();
                return;
            }
            if (meta && lower === 's') {
                e.preventDefault();
                c.onFlush?.();
                return;
            }
            if (meta && lower === 'k') {
                // Command palette — global, so it opens even from an input.
                e.preventDefault();
                c.onCommandPalette?.();
                return;
            }

            // Selection-scoped shortcuts — never while typing.
            if (isTyping(e.target)) return;

            // Clipboard (edit mode only; typing already excluded above).
            const selIds = c.selectedNodeIds instanceof Set ? c.selectedNodeIds : null;
            if (meta && lower === 'c' && !e.shiftKey) {
                if (c.mode !== 'edit' || !selIds || !selIds.size) return;
                e.preventDefault();
                setClipboard(serializeNodes(c.definition, selIds));
                return;
            }
            if (meta && lower === 'x' && !e.shiftKey) {
                if (c.mode !== 'edit' || !selIds || !selIds.size) return;
                e.preventDefault();
                setClipboard(serializeNodes(c.definition, selIds));
                // Cut = copy + remove, as ONE history commit.
                let def = c.definition;
                for (const id of selIds) def = removeNode(def, id);
                if (def !== c.definition) c.onCommit?.(def);
                c.dispatch({ type: 'clear_selection' });
                return;
            }
            if (meta && lower === 'v' && !e.shiftKey) {
                if (c.mode !== 'edit' || !hasClipboard()) return;
                e.preventDefault();
                // Paste AFTER the anchor when it's a direct child of a section,
                // else append to the anchor's section, else the current screen's
                // first section (pasteNodes resolves the target).
                let target = { screenId: c.screenId };
                if (c.selectedNodeId) {
                    const found = findNode(c.definition, c.selectedNodeId);
                    if (found) {
                        const sameSectionParent = found.parent.id === found.section.id;
                        target = {
                            sectionId: found.section.id,
                            index: sameSectionParent ? found.index + 1 : undefined,
                        };
                    }
                }
                const { def, newIds } = pasteNodes(c.definition, getClipboard(), target);
                if (newIds.length) {
                    c.onCommit?.(def);
                    c.dispatch({ type: 'select_many', ids: newIds });
                    c.dispatch({ type: 'set_recent_ids', ids: newIds });
                }
                return;
            }

            if (key === 'Escape') {
                if (c.selectedNodeId) c.dispatch({ type: 'select_node', nodeId: null });
                return;
            }
            if (!c.selectedNodeId || c.mode !== 'edit') return;

            if (meta && lower === 'd') {
                e.preventDefault();
                const { def, nodeId } = duplicateNode(c.definition, c.selectedNodeId);
                if (!nodeId) return;
                c.onCommit?.(def);
                c.dispatch({ type: 'select_node', nodeId });
                return;
            }
            if (key === 'Delete' || key === 'Backspace') {
                e.preventDefault();
                // The WHOLE selection goes, in one commit — the anchor is just
                // the inspector target, never the only thing that was picked.
                let def = c.definition;
                for (const id of (selIds && selIds.size ? selIds : [c.selectedNodeId])) def = removeNode(def, id);
                if (def !== c.definition) c.onCommit?.(def);
                return;
            }
            if (key === 'ArrowUp' || key === 'ArrowDown') {
                const found = findNode(c.definition, c.selectedNodeId);
                if (!found) return;
                e.preventDefault();
                const delta = key === 'ArrowUp' ? -1 : 1;
                if (e.altKey) {
                    // moveNode's index addresses the siblings AFTER the node
                    // is lifted out, so index±1 is exactly one visual step.
                    const next = moveNode(c.definition, c.selectedNodeId, {
                        toParentId: found.parent.id,
                        index: found.index + delta,
                    });
                    if (next !== c.definition) c.onCommit?.(next);
                } else {
                    const sibling = (found.parent.children || [])[found.index + delta];
                    if (sibling) c.dispatch({ type: 'select_node', nodeId: sibling.id });
                }
            }
        };

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
}
