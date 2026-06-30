/**
 * useSourcesPolling — owns a notebook/matter's source list, the add/delete/retry
 * handlers and the "poll while processing" loop.
 *
 * Extracted from NotebooksPage + LegalStudioPage, which both copied this state +
 * the 3s processing poll + the identical CRUD handlers (only the API base path
 * differed, and both ultimately hit `/api/notebooks/:id/sources/*`).
 *
 *   entityId   notebook/matter id (null in list view → handlers no-op)
 *   onError    surface an error message to the page
 *   onChanged  refresh the notebook list counts after a mutation (notebook-level)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { notebookApi, uploadSourceFile, getSourceContent, renameSource as renameSourceApi, reorderSourcesApi, bulkDeleteSourcesApi } from './notebookApi';

export default function useSourcesPolling({ entityId, onError, onChanged } = {}) {
    const [sources, setSources] = useState([]);

    const refreshSources = useCallback(async () => {
        if (!entityId) return;
        try {
            const data = await notebookApi(`/${entityId}/sources`);
            setSources(data.sources || []);
        } catch (e) { onError?.(e.message); }
    }, [entityId, onError]);

    // Poll while any source is still processing; stop once all settle.
    useEffect(() => {
        if (!entityId) return;
        if (!sources.some(s => s.status === 'processing')) return;
        const interval = setInterval(() => { refreshSources(); }, 3000);
        return () => clearInterval(interval);
    }, [entityId, sources, refreshSources]);

    const handleFileUpload = useCallback(async (files) => {
        if (!files?.length || !entityId) return;
        for (const file of files) {
            try { await uploadSourceFile(entityId, file); }
            catch (err) { onError?.(`Failed to upload ${file.name}: ${err.message}`); }
        }
        await refreshSources();
        onChanged?.();
    }, [entityId, refreshSources, onChanged, onError]);

    const handleAddUrl = useCallback(async (url) => {
        if (!url?.trim() || !entityId) return;
        try {
            await notebookApi(`/${entityId}/sources/url`, { method: 'POST', body: JSON.stringify({ url: url.trim() }) });
            await refreshSources();
            onChanged?.();
        } catch (e) { onError?.(e.message); }
    }, [entityId, refreshSources, onChanged, onError]);

    const handleAddText = useCallback(async (text, name) => {
        if (!text?.trim() || !entityId) return;
        try {
            await notebookApi(`/${entityId}/sources/text`, { method: 'POST', body: JSON.stringify({ text: text.trim(), name: name?.trim() || undefined }) });
            await refreshSources();
            onChanged?.();
        } catch (e) { onError?.(e.message); }
    }, [entityId, refreshSources, onChanged, onError]);

    const handleAddMeeting = useCallback(async (meetingId, opts = {}) => {
        if (!meetingId || !entityId) return;
        const mode = opts.mode === 'summary' ? 'summary' : 'full';
        try {
            await notebookApi(`/${entityId}/sources/meeting`, { method: 'POST', body: JSON.stringify({ meetingId, mode }) });
            await refreshSources();
            onChanged?.();
        } catch (e) { onError?.(e.message); }
    }, [entityId, refreshSources, onChanged, onError]);

    const handleDeleteSource = useCallback(async (sid) => {
        if (!entityId) return;
        try {
            await notebookApi(`/${entityId}/sources/${sid}`, { method: 'DELETE' });
            setSources(prev => prev.filter(s => s.id !== sid));
            onChanged?.();
        } catch (e) { onError?.(e.message); }
    }, [entityId, onChanged, onError]);

    // Retry flips the row back to processing immediately so the shimmer shows
    // without waiting for the next poll tick.
    const handleRetrySource = useCallback(async (sid) => {
        if (!entityId) return;
        try {
            await notebookApi(`/${entityId}/sources/${sid}/retry`, { method: 'POST' });
            setSources(prev => prev.map(s => s.id === sid ? { ...s, status: 'processing', error: null } : s));
        } catch (e) { onError?.(e.message); }
    }, [entityId, onError]);

    // Cancel marks a stuck row errored so the user can delete/retry it without
    // waiting for the server watchdog.
    const handleCancelSource = useCallback(async (sid) => {
        if (!entityId) return;
        try {
            await notebookApi(`/${entityId}/sources/${sid}/cancel`, { method: 'POST' });
            setSources(prev => prev.map(s => s.id === sid ? { ...s, status: 'error', error: 'Cancelled by user' } : s));
        } catch (e) { onError?.(e.message); }
    }, [entityId, onError]);

    // Inline rename (optimistic).
    const handleRenameSource = useCallback(async (sid, name) => {
        if (!entityId || !name?.trim()) return;
        const clean = name.trim();
        setSources(prev => prev.map(s => s.id === sid ? { ...s, name: clean } : s));
        try { await renameSourceApi(entityId, sid, clean); }
        catch (e) { onError?.(e.message); await refreshSources(); }
    }, [entityId, onError, refreshSources]);

    // Persist a reordered list (optimistic; caller passes the new order array).
    const handleReorderSources = useCallback(async (ordered) => {
        if (!entityId || !Array.isArray(ordered)) return;
        setSources(ordered);
        try { await reorderSourcesApi(entityId, ordered.map(s => s.id)); }
        catch (e) { onError?.(e.message); await refreshSources(); }
    }, [entityId, onError, refreshSources]);

    // Bulk delete (optimistic removal).
    const handleBulkDelete = useCallback(async (ids) => {
        if (!entityId || !ids?.length) return;
        const set = new Set(ids);
        setSources(prev => prev.filter(s => !set.has(s.id)));
        try { await bulkDeleteSourcesApi(entityId, ids); onChanged?.(); }
        catch (e) { onError?.(e.message); await refreshSources(); }
    }, [entityId, onChanged, onError, refreshSources]);

    const fetchSourceContent = useCallback((sid) => getSourceContent(entityId, sid), [entityId]);

    const readySources = useMemo(() => sources.filter(s => s.status === 'ready'), [sources]);
    const totalWords = useMemo(() => sources.reduce((acc, src) => acc + (src.wordCount || 0), 0), [sources]);

    return {
        sources, setSources, refreshSources, readySources, totalWords,
        handleFileUpload, handleAddUrl, handleAddText, handleAddMeeting,
        handleDeleteSource, handleRetrySource, handleCancelSource,
        handleRenameSource, handleReorderSources, handleBulkDelete, fetchSourceContent,
    };
}
