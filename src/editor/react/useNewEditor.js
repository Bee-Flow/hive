/**
 * useNewEditor — resolve whether the new from-scratch editor (BeeEditor) should
 * be used for a given surface.
 *
 * BeeEditor is now the DEFAULT editor everywhere (V2). The legacy TipTap
 * NotebookEditor is retained only as an explicit per-surface kill-switch: set
 * `featureFlags.bf_editor_notebooks` / `bf_editor_legal` to `false` to fall back
 * to TipTap during the cross-browser/IME QA window. Once QA passes, the TipTap
 * path (NotebookEditor.jsx + the switch in RichTextEditor) can be removed.
 *
 * Flag keys: `bf_editor_notebooks` (NotebooksPage + WorkspaceNotebook) and
 * `bf_editor_legal` (LegalStudioPage).
 */
export function shouldUseNewEditor(user, surface) {
  const key = surface === 'legal' ? 'bf_editor_legal' : 'bf_editor_notebooks';
  // Explicit kill-switch wins; otherwise BeeEditor is the default.
  if (user?.featureFlags?.[key] === false) return false;
  return true;
}
