import { useEffect } from 'react';

/**
 * Document-level keyboard shortcuts for the builder. Bound only while
 * the caller component is mounted so the shortcuts don't bleed into
 * other pages of the studio.
 *
 * Shortcuts:
 *   Cmd/Ctrl + Z          → onUndo
 *   Cmd/Ctrl + Shift + Z  → onRedo
 *   Cmd/Ctrl + Y          → onRedo (Windows convention; ignored if Shift)
 *   Cmd/Ctrl + S          → onSave (force-flush pending debounce)
 *   Cmd/Ctrl + Enter      → onDryRun
 *   Escape                → onEscape (close inspector / modal / panel)
 *
 * Intentionally intercept inside text inputs too: builder undo is the
 * coalesced, draft-level history (see useRoutineDraftHistory), and one
 * consistent meaning for Cmd+Z beats two competing systems. Users who
 * type "hello" then Cmd+Z get the word reverted in one shot — same
 * model as Figma, Miro, n8n. Escape is the one exception we let the
 * browser handle when the active element is a text input that holds a
 * dropdown — passing through preserves native dismissal of native menus.
 *
 * `enabled` lets the parent pause the listener (e.g. when the builder
 * is hidden behind a different tab) without having to unmount this hook.
 */
export default function useBuilderHotkeys({
    enabled = true,
    onUndo,
    onRedo,
    onSave,
    onDryRun,
    onEscape,
}) {
    useEffect(() => {
        if (!enabled) return undefined;

        const onKey = (e) => {
            if (e.key === 'Escape') {
                if (onEscape) {
                    onEscape();
                }
                return;
            }
            const meta = e.metaKey || e.ctrlKey;
            if (!meta) return;
            const key = e.key.toLowerCase();
            if (key === 'z' && !e.shiftKey) {
                e.preventDefault();
                onUndo?.();
                return;
            }
            if ((key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey)) {
                e.preventDefault();
                onRedo?.();
                return;
            }
            if (key === 's') {
                if (!onSave) return;
                e.preventDefault();
                onSave();
                return;
            }
            if (key === 'enter') {
                if (!onDryRun) return;
                // Cmd/Ctrl+Enter inside a text field universally means "submit
                // this field" (the AI chat composer, the flowlet composer,
                // etc.), NOT "dry-run the whole automation". Those composers
                // handle the key locally but don't stopPropagation, so firing
                // onDryRun here too launched an unintended dry-run alongside
                // the submit. Only undo/redo/save stay global inside inputs.
                const t = e.target;
                const tag = t?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return;
                e.preventDefault();
                onDryRun();
            }
        };

        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [enabled, onUndo, onRedo, onSave, onDryRun, onEscape]);
}
