/**
 * useDocumentAutosave — owns the editor document content + save lifecycle.
 *
 * Extracted from NotebooksPage + LegalStudioPage (both copied the same three
 * save states, the retry-once timer, the beforeunload guard and the Cmd/Ctrl+S
 * shortcut). It also adds the cross-entity guard the standalone copies lacked: a
 * save scheduled for notebook A can never write into notebook B after a switch.
 *
 *   entityId   notebook/matter id (null → saves no-op)
 *
 * Returns the document state plus `editorRef` (the single editor ref owner) and
 * `retrySave` for the header's "Save failed — retry" affordance.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { notebookApi } from './notebookApi';

export default function useDocumentAutosave({ entityId } = {}) {
    const [documentContent, setDocumentContent] = useState('');
    const [docSaving, setDocSaving] = useState(false);
    // 'idle' (nothing pending) · 'saving' (PUT in flight) · 'error' (last PUT failed)
    const [saveState, setSaveState] = useState('idle');
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const pendingContentRef = useRef(null);
    const retryTimerRef = useRef(null);
    const editorRef = useRef(null);
    const entityIdRef = useRef(entityId);

    const handleDocSave = useCallback(async (html, { isRetry = false } = {}) => {
        if (!entityId) return;
        const savingForId = entityId;
        pendingContentRef.current = html;
        if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
        setDocSaving(true);
        setSaveState('saving');
        try {
            await notebookApi(`/${savingForId}`, { method: 'PUT', body: JSON.stringify({ documentContent: html }) });
            if (entityIdRef.current !== savingForId) return; // switched entities mid-flight
            pendingContentRef.current = null;
            setSaveState('idle');
            setLastSavedAt(Date.now());
        } catch (e) {
            console.error('[Notebooks] Doc save failed:', e);
            if (entityIdRef.current !== savingForId) return;
            setSaveState('error');
            // A permission error (401/403) can never succeed on retry — skip the
            // automatic 5s retry, but keep pendingContentRef so the header's
            // manual "Save failed — retry" affordance still works (BFSF-221).
            const permissionDenied = e.status === 401 || e.status === 403;
            if (!isRetry && !permissionDenied) {
                retryTimerRef.current = setTimeout(() => {
                    if (pendingContentRef.current !== null) handleDocSave(pendingContentRef.current, { isRetry: true });
                }, 5000);
            }
        } finally {
            setDocSaving(false);
        }
    }, [entityId]);

    // On entity switch: cancel any pending retry + reset the indicator so a save
    // queued for the previous notebook can't clobber the new one. Crucially, the
    // cleanup (which runs with the PREVIOUS entityId captured, on switch AND on
    // unmount) FLUSHES any unsaved content for the notebook we're leaving — the
    // old code dropped pendingContentRef here, silently losing edits that hadn't
    // been PUT yet (a queued retry, a failed save, or a debounce that hadn't
    // fired before the user clicked another notebook).
    useEffect(() => {
        entityIdRef.current = entityId;
        if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
        setSaveState('idle');
        setDocSaving(false);
        return () => {
            const leavingId = entityId;
            const pending = pendingContentRef.current;
            pendingContentRef.current = null;
            if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
            if (leavingId && pending !== null) {
                // Best-effort flush for the entity being left; idempotent if a
                // save for the same content was already in flight.
                notebookApi(`/${leavingId}`, { method: 'PUT', body: JSON.stringify({ documentContent: pending }) })
                    .catch(err => console.error('[Notebooks] flush-on-switch save failed:', err));
            }
        };
    }, [entityId]);

    // Warn before closing the tab while a save is pending.
    useEffect(() => {
        if (saveState === 'idle') return;
        const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [saveState]);

    // Cmd/Ctrl+S bypasses the editor's debounce and saves immediately.
    useEffect(() => {
        const onKey = (e) => {
            const metaS = (e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S');
            if (!metaS || !entityId) return;
            e.preventDefault();
            const editor = editorRef.current?.getEditor?.();
            const html = editor?.getHTML?.() ?? documentContent;
            handleDocSave(html);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [entityId, documentContent, handleDocSave]);

    const retrySave = useCallback(() => {
        if (pendingContentRef.current !== null) handleDocSave(pendingContentRef.current);
    }, [handleDocSave]);

    return {
        documentContent, setDocumentContent,
        docSaving, saveState, lastSavedAt,
        handleDocSave, retrySave,
        editorRef, pendingContentRef,
    };
}
