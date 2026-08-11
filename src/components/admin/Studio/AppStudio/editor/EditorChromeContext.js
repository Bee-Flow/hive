import { createContext, useContext } from 'react';

/**
 * App Studio editor — the shell's editing handles for the AI chat pane.
 *
 * AppEditorShell provides { commitTurn, markSaved, flush, appId, undoTurn }:
 *   commitTurn(finalDefinition) — record ONE history entry for a whole AI
 *       turn (pre-turn snapshot → final draft), so Cmd+Z undoes the turn
 *       atomically. The shell captures the pre-turn snapshot itself when
 *       streamLock flips on.
 *   markSaved(definition, version) — adopt a server-persisted definition in
 *       the autosave baseline WITHOUT re-saving it (the builder route already
 *       persisted every draft).
 *   flush() — force any pending autosave to persist NOW and resolve once the
 *       latest definition has landed. BuilderChatPane awaits this BEFORE it
 *       locks the stream: locking pauses autosave (cancelling the debounce),
 *       and the builder reads the definition from the DB, so an unsaved local
 *       edit would otherwise be invisible to the AI and then overwritten.
 *   undoTurn() — the shell's history.undo. A whole AI turn is committed as ONE
 *       history entry, so the chat pane's "Undo turn" affordance reverts the
 *       last turn with a single undo.
 *
 * Kept in its own module so BuilderChatPane can consume it without importing
 * the (heavy) shell. Returns null outside the shell — callers must guard.
 */
export const EditorChromeContext = createContext(null);

export function useEditorChrome() {
    return useContext(EditorChromeContext);
}
