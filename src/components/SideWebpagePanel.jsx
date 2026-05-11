import React, { useEffect, useRef, useState } from 'react';
import { Loader2, X, Pencil, Globe } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import WebpagePreview from '../pages/webpages/WebpagePreview';

/**
 * Read-only webpage view for the right-hand chat slot. Fetches the webpage
 * once and reuses WebpagePreview for the sandboxed iframe body. Editing
 * lives in Studio › Webpages — the pencil here jumps there.
 */
export default function SideWebpagePanel({
    webpageId,
    onClose,
    user,
    onLoaded,         // (webpage) — metadata-only, fires once on load
    onFilesLoaded,    // ({ html, css, js, extraFiles }) — content snapshot
    onSelectionAttach, // (selection) — user highlighted text in the preview
    reloadKey = 0,    // bump to force a refetch (e.g. after AI edits)
}) {
    const [state, setState] = useState({ loading: true, error: null, data: null });
    // Stash the callbacks in refs so the effect's deps stay limited to
    // webpageId + reloadKey. Parents typically pass inline arrows that get a
    // new reference on every render — listing them as deps causes the panel
    // to refetch on every parent re-render and the UI gets stuck on "Loading".
    const onLoadedRef = useRef(onLoaded);
    const onFilesLoadedRef = useRef(onFilesLoaded);
    useEffect(() => { onLoadedRef.current = onLoaded; }, [onLoaded]);
    useEffect(() => { onFilesLoadedRef.current = onFilesLoaded; }, [onFilesLoaded]);

    useEffect(() => {
        let cancelled = false;
        setState({ loading: true, error: null, data: null });
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/webpages/${webpageId}`);
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body.error || `Failed (${res.status})`);
                }
                const data = await res.json();
                if (!cancelled) {
                    setState({ loading: false, error: null, data });
                    if (typeof onLoadedRef.current === 'function' && data?.webpage) onLoadedRef.current(data.webpage);
                    if (typeof onFilesLoadedRef.current === 'function') {
                        onFilesLoadedRef.current({
                            html: data?.files?.html || '',
                            css: data?.files?.css || '',
                            js: data?.files?.js || '',
                            extraFiles: Array.isArray(data?.extraFiles) ? data.extraFiles : [],
                        });
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setState({ loading: false, error: err.message, data: null });
                    if (typeof onLoadedRef.current === 'function') onLoadedRef.current(null);
                    if (typeof onFilesLoadedRef.current === 'function') onFilesLoadedRef.current(null);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [webpageId, reloadKey]);

    const openInEditor = () => {
        const path = `/app/studio/webpages/${webpageId}`;
        window.history.pushState({ page: 'studio' }, '', path);
        window.dispatchEvent(new PopStateEvent('popstate', { state: { page: 'studio' } }));
    };

    const wp = state.data?.webpage;
    const files = state.data?.files || {};
    const isOwner = wp && user?.id && wp.userId === user.id;

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b"
                 style={{ borderColor: 'var(--border-subtle)' }}>
                <Globe className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                <span className="text-sm font-semibold truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                    {wp?.name || (state.loading ? 'Loading…' : 'Webpage')}
                </span>
                {isOwner && (
                    <button
                        onClick={openInEditor}
                        title="Open in editor"
                        className="p-1 rounded hover:bg-[var(--bg-secondary)]"
                    >
                        <Pencil className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                )}
                <button
                    onClick={onClose}
                    title="Close"
                    className="p-1 rounded hover:bg-[var(--bg-secondary)]"
                >
                    <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
            </div>

            <div className="flex-1 min-h-0">
                {state.loading && (
                    <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                    </div>
                )}
                {state.error && (
                    <div className="h-full flex flex-col items-center justify-center text-center px-6">
                        <Globe className="w-8 h-8 mb-3" style={{ color: 'var(--text-tertiary)' }} />
                        <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                            Webpage unavailable
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{state.error}</div>
                    </div>
                )}
                {!state.loading && !state.error && wp && (
                    <WebpagePreview
                        webpageId={wp.id}
                        html={files.html || ''}
                        css={files.css || ''}
                        js={files.js || ''}
                        extraFiles={state.data?.extraFiles || []}
                        extraContents={{}}
                        onSelectionAttach={onSelectionAttach}
                    />
                )}
            </div>
        </div>
    );
}
