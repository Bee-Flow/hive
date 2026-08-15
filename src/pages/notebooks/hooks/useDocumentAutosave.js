/**
 * useDocumentAutosave — owns the editor document content + save lifecycle.
 *
 * Extracted from NotebooksPage (it copied the same three
 * save states, the retry-once timer, the beforeunload guard and the Cmd/Ctrl+S
 * shortcut). It also adds the cross-entity guard the standalone copies lacked: a
 * save scheduled for notebook A can never write into notebook B after a switch.
 *
 *   entityId        notebook/matter id (null → saves no-op)
 *   initialVersion  optional server version to seed the CAS counter with; when
 *                   omitted the first PUT saves unconditionally and the counter
 *                   self-seeds from the response (Legal Studio path)
 *   onConflict      optional callback fired AFTER a 409 has been resolved by
 *                   reloading the server copy — the page owns the toast
 *
 * Returns the document state plus `editorRef` (the single editor ref owner),
 * `retrySave` for the header's "Save failed — retry" affordance and
 * `setKnownVersion` so pages can resync the CAS counter from out-of-band
 * version sources (SSE doc_update, version restore).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { notebookApi } from './notebookApi';

export default function useDocumentAutosave({ entityId, initialVersion, onConflict } = {}) {
    const [documentContent, setDocumentContent] = useState('');
    const [docSaving, setDocSaving] = useState(false);
    // 'idle' (nothing pending) · 'saving' (PUT in flight) · 'error' (last PUT failed)
    const [saveState, setSaveState] = useState('idle');
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const pendingContentRef = useRef(null);
    const retryTimerRef = useRef(null);
    const editorRef = useRef(null);
    const entityIdRef = useRef(entityId);
    // Last version this client knows the server holds. null = unknown → PUT
    // without expectedVersion (last-writer-wins, the pre-CAS behaviour).
    const versionRef = useRef(initialVersion ?? null);
    const initialVersionRef = useRef(initialVersion ?? null);
    const onConflictRef = useRef(onConflict);
    // Set around editor flush() calls (entity switch / beforeunload): the final
    // save of a session must never be stranded behind a version conflict, so
    // those PUTs skip expectedVersion.
    const bypassVersionRef = useRef(false);
    // True from the first keystroke until a save completes. Distinct from
    // `saveState`, which only knows about saves that have already started.
    const dirtyRef = useRef(false);
    // Mirrored into state so the header can show an "unsaved changes" hint; the
    // ref stays the source of truth for the unload guard (it must be readable
    // synchronously from an event handler).
    const [dirty, setDirty] = useState(false);
    /** Call from the editor's onChange so the unload guard sees debounced edits. */
    const markDirty = useCallback(() => { dirtyRef.current = true; setDirty(true); }, []);

    useEffect(() => { onConflictRef.current = onConflict; }, [onConflict]);

    // Track the latest initialVersion and seed the counter when it is still
    // unknown (the page usually learns the version from an async fetch, well
    // after this hook mounted). Never clobber a version adopted from a save.
    useEffect(() => {
        initialVersionRef.current = initialVersion ?? null;
        if (versionRef.current == null && initialVersion != null) versionRef.current = initialVersion;
    }, [initialVersion]);

    /** Resync the CAS counter from an out-of-band source (SSE, refetch). */
    const setKnownVersion = useCallback((v) => { versionRef.current = v ?? null; }, []);

    // 409 recovery: someone else (other tab, AI tool) saved first. Reload the
    // server copy into the editor and adopt its version — never retry the stale
    // PUT, that would silently overwrite the other writer.
    const resolveConflict = useCallback(async (savingForId) => {
        try {
            const data = await notebookApi(`/${savingForId}`);
            if (entityIdRef.current !== savingForId) return;
            const nb = data?.notebook ?? data ?? {};
            const serverHtml = nb.documentContent || '';
            editorRef.current?.setContent?.(serverHtml);
            setDocumentContent(serverHtml);
            versionRef.current = nb.version ?? null;
            pendingContentRef.current = null;
            dirtyRef.current = false;
            setDirty(false);
            setSaveState('idle');
            onConflictRef.current?.();
        } catch (e) {
            console.error('[Notebooks] Conflict reload failed:', e);
            if (entityIdRef.current !== savingForId) return;
            // Keep the pending content so the manual retry affordance still works.
            setSaveState('error');
        }
    }, []);

    const handleDocSave = useCallback(async (html, { isRetry = false } = {}) => {
        if (!entityId) return;
        const savingForId = entityId;
        pendingContentRef.current = html;
        if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
        setDocSaving(true);
        setSaveState('saving');
        try {
            const body = { documentContent: html };
            const expected = bypassVersionRef.current ? null : versionRef.current;
            if (expected != null) body.expectedVersion = expected;
            const res = await notebookApi(`/${savingForId}`, { method: 'PUT', body: JSON.stringify(body) });
            if (entityIdRef.current !== savingForId) return; // switched entities mid-flight
            if (res?.version != null) versionRef.current = res.version;
            pendingContentRef.current = null;
            dirtyRef.current = false;
            setDirty(false);
            setSaveState('idle');
            setLastSavedAt(Date.now());
        } catch (e) {
            console.error('[Notebooks] Doc save failed:', e);
            if (entityIdRef.current !== savingForId) return;
            if (e.status === 409) {
                await resolveConflict(savingForId);
                return;
            }
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
    }, [entityId, resolveConflict]);

    // On entity switch: cancel any pending retry + reset the indicator so a save
    // queued for the previous notebook can't clobber the new one. Crucially, the
    // cleanup (which runs with the PREVIOUS entityId captured, on switch AND on
    // unmount) FLUSHES any unsaved content for the notebook we're leaving — the
    // old code dropped pendingContentRef here, silently losing edits that hadn't
    // been PUT yet (a queued retry, a failed save, or a debounce that hadn't
    // fired before the user clicked another notebook).
    useEffect(() => {
        entityIdRef.current = entityId;
        versionRef.current = initialVersionRef.current;
        if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
        setSaveState('idle');
        setDocSaving(false);
        return () => {
            const leavingId = entityId;
            // Ask the editor to give up any debounced edit FIRST. Its 2s save
            // timer lives inside the editor and was simply cleared on unmount,
            // so recent keystrokes never reached pendingContentRef and vanished
            // on every notebook switch. flush() saves through the editor's own
            // onSave and returns the HTML it saved — so when it returns
            // non-null the save is already on its way and re-PUTting it here
            // would double every switch-away save.
            let flushed = null;
            try {
                bypassVersionRef.current = true;
                flushed = editorRef.current?.flush?.() ?? null;
            } catch (e) { console.error('[Notebooks] editor flush failed:', e); }
            finally { bypassVersionRef.current = false; }

            const pending = (flushed != null) ? null : pendingContentRef.current;
            pendingContentRef.current = null;
            if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
            if (leavingId && pending != null) {
                // Best-effort flush for the entity being left. No expectedVersion:
                // a final edit must win, never strand behind a conflict.
                notebookApi(`/${leavingId}`, { method: 'PUT', body: JSON.stringify({ documentContent: pending }) })
                    .catch(err => console.error('[Notebooks] flush-on-switch save failed:', err));
            }
        };
    }, [entityId]);

    // Warn before closing the tab while anything is unsaved, and take one last
    // shot at persisting it.
    //
    // Keyed off `saveState !== 'idle'` alone this missed the most common case:
    // typing that is still inside the editor's 2s debounce hasn't started a save
    // yet, so saveState is 'idle' and the tab closed silently on unsaved work.
    // `markDirty` lets the page report edits the moment they happen.
    useEffect(() => {
        const onBeforeUnload = (e) => {
            const dirty = saveState !== 'idle' || dirtyRef.current;
            if (!dirty) return;
            // Last-ditch flush. Not guaranteed to complete during unload, but it
            // costs nothing and often does. No expectedVersion (see bypass ref).
            try { bypassVersionRef.current = true; editorRef.current?.flush?.(); }
            catch (_) { /* unload path */ }
            finally { bypassVersionRef.current = false; }
            e.preventDefault();
            e.returnValue = '';
        };
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
        docSaving, saveState, lastSavedAt, dirty,
        handleDocSave, retrySave, markDirty, setKnownVersion,
        editorRef, pendingContentRef,
    };
}
