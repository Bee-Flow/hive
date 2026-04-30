import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    ArrowLeft, Plus, Trash2, Loader2, AlertCircle, Search,
    X, ChevronRight, Pencil, Download, Globe, History,
    PanelLeft, FileCode2, Save, Check,
} from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import useChatEngine from '../hooks/useChatEngine';
import WebpageEditor from './webpages/WebpageEditor';
import WebpagePreview from './webpages/WebpagePreview';
import WebpageChat from './webpages/WebpageChat';
import WebpageSources from './webpages/WebpageSources';
import downloadWebpageZip from '../utils/downloadWebpageZip';

function timeAgo(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
}

async function api(path, opts = {}) {
    const url = `${API_BASE}/api/webpages${path === '/' ? '' : path}`;
    const res = await authFetch(url, {
        headers: opts.body && typeof opts.body === 'string' ? { 'Content-Type': 'application/json', ...opts.headers } : opts.headers,
        ...opts,
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `API ${res.status}`);
    }
    return res.json();
}

export default function WebpagesPage({ user, onBack, initialWebpageId, onWebpageChange }) {
    const canUseWebpages = !!(user?.permissions?.includes('all') || user?.permissions?.includes('use_webpages'));

    const [webpages, setWebpages] = useState([]);
    const [selected, setSelected] = useState(null); // metadata row
    const [sources, setSources] = useState([]);
    const [versions, setVersions] = useState([]);
    const [showVersions, setShowVersions] = useState(false);

    const [html, setHtml] = useState('');
    const [css, setCss] = useState('');
    const [js, setJs] = useState('');
    const [activeFile, setActiveFile] = useState('html');

    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [search, setSearch] = useState('');
    const [error, setError] = useState(null);
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState('');

    // Save state
    const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const saveTimerRef = useRef(null);
    const lastSavedSnapshotRef = useRef({ html: '', css: '', js: '' });
    const skipNextSaveRef = useRef(false); // set when we load a webpage so we don't fire a phantom save

    // Layout
    const [leftOpen, setLeftOpen] = useState(true);
    const [rightWidth, setRightWidth] = useState(340);
    const [sourcesWidth, setSourcesWidth] = useState(260);
    const rightDragRef = useRef(false);
    const sourcesDragRef = useRef(false);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (rightDragRef.current) {
                const newW = document.body.clientWidth - e.clientX;
                setRightWidth(Math.max(260, Math.min(newW, 720)));
            } else if (sourcesDragRef.current) {
                // sources panel is on the left of the editor; measure from the left edge
                // but offset by the left page-list panel width when open
                setSourcesWidth(Math.max(180, Math.min(e.clientX - (leftOpen ? 280 : 0), 520)));
            }
        };
        const handleMouseUp = () => {
            if (rightDragRef.current || sourcesDragRef.current) {
                rightDragRef.current = false;
                sourcesDragRef.current = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
            }
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [leftOpen]);

    /* ── Model tiers ─────────────────────────────────────────── */
    const [modelTiers, setModelTiers] = useState({});
    const [selectedTier, setSelectedTier] = useState('fast');

    useEffect(() => {
        authFetch(`${API_BASE}/ai/config/chat-models`)
            .then(r => r.ok ? r.json() : {})
            .then(data => setModelTiers(data))
            .catch(() => {});
    }, []);

    /* ── Chat engine wiring ──────────────────────────────────── */
    const { messages: chatMessages, setMessages: setChatMessages, isLoading: chatLoading,
        sendMessage: sendChatMessage, stopGenerating: stopChatGenerating,
        retryMessage: retryChatMessage, editAndRegenerate: editAndRegenerateChat,
        submittedFormIds, setSubmittedFormIds,
    } = useChatEngine({
        selectedAgent: null,
        currentConversation: null,
        onConversationCreated: useCallback(() => {}, []),
        getNotebookPayload: useCallback(() => ({}), []),
        onNotebookUpdate: useCallback(() => {}, []),
        directMode: useMemo(() => ({
            enabled: true,
            modelTier: selectedTier,
            customEndpoint: selected ? '/ai/chat/webpage/stream' : undefined,
            getExtraPayload: () => {
                if (!selected) return {};
                return {
                    webpageId: selected.id,
                    htmlContent: html,
                    cssContent: css,
                    jsContent: js,
                };
            },
        }), [selectedTier, selected?.id, html, css, js]),
        onDirectConversationCreated: useCallback(() => {}, []),
        // Webpage-specific SSE events — useChatEngine forwards them via these callbacks.
        onWebpageDocUpdate: useCallback((data) => {
            const { file, content } = data || {};
            if (file === 'html') setHtml(content || '');
            else if (file === 'css') setCss(content || '');
            else if (file === 'js') setJs(content || '');
        }, []),
        onWebpageSourceAdded: useCallback((source) => {
            setSources(prev => [...prev, source]);
        }, []),
    });

    /* ── Fetch webpages list ─────────────────────────────────── */
    const didAutoSelect = useRef(false);

    const fetchWebpages = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api('/');
            setWebpages(data.webpages || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (canUseWebpages) fetchWebpages(); }, [fetchWebpages, canUseWebpages]);

    /* ── Load a webpage (deep-link or click) ─────────────────── */
    const loadWebpage = useCallback(async (id) => {
        try {
            const { webpage, sources: srcs, files } = await api(`/${id}`);
            setSelected(webpage);
            setSources(srcs || []);
            setHtml(files?.html || '');
            setCss(files?.css || '');
            setJs(files?.js || '');
            setActiveFile(files?.html ? 'html' : files?.css ? 'css' : 'html');
            setChatMessages([]);
            lastSavedSnapshotRef.current = { html: files?.html || '', css: files?.css || '', js: files?.js || '' };
            skipNextSaveRef.current = true;
            onWebpageChange?.(id);
        } catch (err) {
            setError(err.message);
        }
    }, [setChatMessages, onWebpageChange]);

    // Deep-link: load the webpage in the URL on first list fetch
    useEffect(() => {
        if (!initialWebpageId || didAutoSelect.current) return;
        if (webpages.find(w => w.id === initialWebpageId)) {
            didAutoSelect.current = true;
            loadWebpage(initialWebpageId);
        }
    }, [initialWebpageId, webpages, loadWebpage]);

    /* ── Save (debounced) ────────────────────────────────────── */
    const persist = useCallback(async () => {
        if (!selected) return;
        const snapshot = { html, css, js };
        const last = lastSavedSnapshotRef.current;
        if (snapshot.html === last.html && snapshot.css === last.css && snapshot.js === last.js) return;
        setSaveState('saving');
        try {
            await api(`/${selected.id}`, {
                method: 'PUT',
                body: JSON.stringify(snapshot),
            });
            lastSavedSnapshotRef.current = snapshot;
            setSaveState('saved');
            setLastSavedAt(new Date());
            // Refresh metadata sizes/timestamps for the list view.
            setWebpages(prev => prev.map(w => w.id === selected.id ? { ...w, updatedAt: new Date().toISOString() } : w));
        } catch (err) {
            console.error('[Webpages] Save failed:', err);
            setSaveState('error');
        }
    }, [selected, html, css, js]);

    useEffect(() => {
        if (!selected) return;
        if (skipNextSaveRef.current) {
            skipNextSaveRef.current = false;
            return;
        }
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => persist(), 1500);
        return () => saveTimerRef.current && clearTimeout(saveTimerRef.current);
    }, [html, css, js, persist, selected]);

    // Cmd/Ctrl+S → flush
    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's' && selected) {
                e.preventDefault();
                if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                persist();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [persist, selected]);

    /* ── Versions ────────────────────────────────────────────── */
    const fetchVersions = useCallback(async () => {
        if (!selected) return;
        try {
            const data = await api(`/${selected.id}/versions`);
            setVersions(data.versions || []);
        } catch (err) {
            console.warn('[Webpages] Failed to load versions:', err.message);
        }
    }, [selected]);

    useEffect(() => { if (showVersions && selected) fetchVersions(); }, [showVersions, selected, fetchVersions]);

    const handleRestoreVersion = async (vid) => {
        if (!selected) return;
        if (!confirm('Restore this version? Current state will be saved as a new version first.')) return;
        try {
            const { files } = await api(`/${selected.id}/versions/${vid}/restore`, { method: 'POST' });
            setHtml(files.html || '');
            setCss(files.css || '');
            setJs(files.js || '');
            lastSavedSnapshotRef.current = files;
            skipNextSaveRef.current = true;
            await fetchVersions();
            setShowVersions(false);
        } catch (err) {
            setError(err.message);
        }
    };

    /* ── CRUD handlers ───────────────────────────────────────── */
    const handleCreate = async (e) => {
        e?.preventDefault?.();
        const trimmed = newName.trim();
        if (!trimmed) return;
        setCreating(true);
        try {
            const { webpage } = await api('/', {
                method: 'POST',
                body: JSON.stringify({ name: trimmed }),
            });
            setNewName('');
            setWebpages(prev => [webpage, ...prev]);
            await loadWebpage(webpage.id);
        } catch (err) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this webpage? This cannot be undone.')) return;
        try {
            await api(`/${id}`, { method: 'DELETE' });
            setWebpages(prev => prev.filter(w => w.id !== id));
            if (selected?.id === id) {
                setSelected(null);
                setHtml(''); setCss(''); setJs('');
                onWebpageChange?.(null);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handleRename = async (id) => {
        const trimmed = renameValue.trim();
        if (!trimmed) { setRenamingId(null); return; }
        try {
            await api(`/${id}`, { method: 'PUT', body: JSON.stringify({ name: trimmed }) });
            setWebpages(prev => prev.map(w => w.id === id ? { ...w, name: trimmed } : w));
            if (selected?.id === id) setSelected(prev => ({ ...prev, name: trimmed }));
        } catch (err) {
            setError(err.message);
        } finally {
            setRenamingId(null);
            setRenameValue('');
        }
    };

    const handleDownloadZip = useCallback(async () => {
        if (!selected) return;
        // Flush any pending edits before zipping so the zip matches what's saved.
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        await persist().catch(() => {});
        await downloadWebpageZip({ name: selected.name, html, css, js });
    }, [selected, html, css, js, persist]);

    const handleClose = () => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            persist().catch(() => {});
        }
        setSelected(null);
        setHtml(''); setCss(''); setJs('');
        setSources([]);
        setChatMessages([]);
        onWebpageChange?.(null);
    };

    const filteredWebpages = useMemo(() => {
        if (!search.trim()) return webpages;
        const q = search.toLowerCase();
        return webpages.filter(w => (w.name || '').toLowerCase().includes(q));
    }, [webpages, search]);

    if (!canUseWebpages) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md p-6 rounded-2xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                    <Globe className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
                    <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Webpages disabled</h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        You don't have permission to use Webpages. Ask an admin to grant the <code>use_webpages</code> permission.
                    </p>
                </div>
            </div>
        );
    }

    /* ── List view ───────────────────────────────────────────── */
    if (!selected) {
        return (
            <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
                <div className="shrink-0 px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    {onBack && (
                        <button onClick={onBack} className="p-1 rounded-md hover:bg-white/40">
                            <ArrowLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                        </button>
                    )}
                    <div className="flex-1 flex items-center gap-2">
                        <Globe className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Webpages</h2>
                    </div>
                </div>

                <div className="shrink-0 px-4 py-3 border-b flex flex-wrap items-center gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                    <form onSubmit={handleCreate} className="flex items-center gap-2 flex-1 min-w-[260px]">
                        <input
                            type="text"
                            placeholder="New webpage name…"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            disabled={creating}
                            className="flex-1 px-3 py-2 text-sm rounded-lg border outline-none focus:ring-2"
                            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        />
                        <button
                            type="submit"
                            disabled={creating || !newName.trim()}
                            className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1 disabled:opacity-50"
                            style={{ background: 'var(--accent-primary)', color: 'white' }}
                        >
                            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            Create
                        </button>
                    </form>
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                        <input
                            type="text"
                            placeholder="Search…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-7 pr-2 py-2 text-sm rounded-lg border outline-none"
                            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                        />
                    </div>
                </div>

                {error && (
                    <div className="shrink-0 px-4 py-2 text-xs flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#991b1b' }}>
                        <AlertCircle className="w-3.5 h-3.5" /> {error}
                        <button onClick={() => setError(null)} className="ml-auto"><X className="w-3 h-3" /></button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                        </div>
                    ) : filteredWebpages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-20">
                            <Globe className="w-12 h-12 mb-3" style={{ color: 'var(--text-tertiary)' }} />
                            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                                {search ? 'No matches' : 'No webpages yet'}
                            </h3>
                            <p className="text-sm max-w-sm" style={{ color: 'var(--text-secondary)' }}>
                                {search ? 'Try a different search.' : 'Create your first webpage above and let Claude build it for you.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredWebpages.map(w => (
                                <div key={w.id}
                                     onClick={() => loadWebpage(w.id)}
                                     className="group p-4 rounded-xl border hover:shadow-md cursor-pointer transition-all"
                                     style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                    <div className="flex items-start gap-2 mb-2">
                                        <FileCode2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--accent-primary)' }} />
                                        {renamingId === w.id ? (
                                            <input
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                onBlur={() => handleRename(w.id)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleRename(w.id);
                                                    if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                autoFocus
                                                className="flex-1 px-1 py-0.5 text-sm rounded outline-none border"
                                                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--accent-primary)' }}
                                            />
                                        ) : (
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                                    {w.name}
                                                </div>
                                                <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                                    {timeAgo(w.updatedAt)} · {w.sourceCount} source{w.sourceCount === 1 ? '' : 's'}
                                                </div>
                                            </div>
                                        )}
                                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); setRenamingId(w.id); setRenameValue(w.name); }}
                                                    className="p-1 rounded hover:bg-white/40" title="Rename">
                                                <Pencil className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(w.id); }}
                                                    className="p-1 rounded hover:bg-white/40" title="Delete">
                                                <Trash2 className="w-3 h-3" style={{ color: '#ef4444' }} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                        <span>HTML {(w.htmlSize / 1024).toFixed(1)}KB</span>
                                        <span>·</span>
                                        <span>CSS {(w.cssSize / 1024).toFixed(1)}KB</span>
                                        {w.jsSize > 0 && <><span>·</span><span>JS {(w.jsSize / 1024).toFixed(1)}KB</span></>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    /* ── Editor view ─────────────────────────────────────────── */
    return (
        <div className="flex h-full" style={{ background: 'var(--bg-secondary)' }}>
            {/* Sources panel */}
            <div className="shrink-0 border-r flex flex-col"
                 style={{ width: sourcesWidth, borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                <WebpageSources
                    webpageId={selected.id}
                    sources={sources}
                    onSourcesChange={setSources}
                />
            </div>
            {/* Resize handle */}
            <div
                onMouseDown={() => {
                    sourcesDragRef.current = true;
                    document.body.style.cursor = 'col-resize';
                    document.body.style.userSelect = 'none';
                }}
                className="shrink-0 w-1 cursor-col-resize hover:bg-blue-300/30 transition-colors"
                style={{ background: 'transparent' }}
            />

            {/* Center: editor + preview */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="shrink-0 px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                    <button onClick={handleClose} className="p-1 rounded-md hover:bg-white/40" title="Back to list">
                        <ArrowLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{selected.name}</div>
                    </div>
                    <SaveIndicator state={saveState} lastSavedAt={lastSavedAt} />
                    <button
                        onClick={() => setShowVersions(v => !v)}
                        className="px-2 py-1 rounded-md text-[11px] flex items-center gap-1 hover:bg-white/40"
                        style={{ color: 'var(--text-secondary)' }}
                        title="Version history"
                    >
                        <History className="w-3.5 h-3.5" /> Versions
                    </button>
                    <button
                        onClick={handleDownloadZip}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 hover:opacity-90"
                        style={{ background: 'var(--accent-primary)', color: 'white' }}
                        title="Download as ZIP"
                    >
                        <Download className="w-3.5 h-3.5" /> Download zip
                    </button>
                </div>

                {/* Editor + Preview split */}
                <div className="flex-1 grid min-h-0" style={{ gridTemplateRows: '1fr 1fr' }}>
                    <div className="min-h-0">
                        <WebpageEditor
                            activeFile={activeFile}
                            onActiveFileChange={setActiveFile}
                            html={html}
                            css={css}
                            js={js}
                            onChange={(file, value) => {
                                if (file === 'html') setHtml(value);
                                else if (file === 'css') setCss(value);
                                else if (file === 'js') setJs(value);
                            }}
                            sizes={{
                                html: new Blob([html]).size,
                                css: new Blob([css]).size,
                                js: new Blob([js]).size,
                            }}
                        />
                    </div>
                    <div className="min-h-0 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                        <WebpagePreview html={html} css={css} js={js} />
                    </div>
                </div>
            </div>

            {/* Resize handle */}
            <div
                onMouseDown={() => {
                    rightDragRef.current = true;
                    document.body.style.cursor = 'col-resize';
                    document.body.style.userSelect = 'none';
                }}
                className="shrink-0 w-1 cursor-col-resize hover:bg-blue-300/30 transition-colors"
            />

            {/* Right: AI chat */}
            <div className="shrink-0 flex flex-col"
                 style={{ width: rightWidth, background: 'var(--bg-primary)', borderLeft: '1px solid var(--border-subtle)' }}>
                <WebpageChat
                    messages={chatMessages}
                    isLoading={chatLoading}
                    onSend={(text, attachments) => sendChatMessage(text, attachments)}
                    onStop={stopChatGenerating}
                    onRetry={retryChatMessage}
                    onEdit={editAndRegenerateChat}
                    modelTiers={modelTiers}
                    selectedTier={selectedTier}
                    onTierChange={setSelectedTier}
                    submittedFormIds={submittedFormIds}
                    setSubmittedFormIds={setSubmittedFormIds}
                />
            </div>

            {/* Versions overlay */}
            {showVersions && (
                <div className="absolute inset-0 z-40 flex items-start justify-center pt-20" style={{ background: 'rgba(0,0,0,0.4)' }}
                     onClick={() => setShowVersions(false)}>
                    <div onClick={(e) => e.stopPropagation()}
                         className="rounded-xl border shadow-2xl p-4 w-[480px] max-h-[70vh] overflow-y-auto"
                         style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Version history</h3>
                            <button onClick={() => setShowVersions(false)}><X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} /></button>
                        </div>
                        {versions.length === 0 ? (
                            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No versions yet. Auto-snapshots are created every 5 minutes when you edit.</p>
                        ) : (
                            <div className="space-y-2">
                                {versions.map(v => (
                                    <div key={v.id} className="flex items-center justify-between p-2 rounded-lg border" style={{ borderColor: 'var(--border-subtle)' }}>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>{v.summary || 'Snapshot'}</div>
                                            <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                                {timeAgo(v.createdAt)} · {(v.contentLength / 1024).toFixed(1)}KB
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRestoreVersion(v.id)}
                                            className="px-2 py-1 rounded text-[10px] font-medium"
                                            style={{ background: 'var(--accent-primary)', color: 'white' }}
                                        >
                                            Restore
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function SaveIndicator({ state, lastSavedAt }) {
    if (state === 'saving') {
        return (
            <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                <Loader2 className="w-3 h-3 animate-spin" /> Saving…
            </span>
        );
    }
    if (state === 'error') {
        return (
            <span className="flex items-center gap-1 text-[11px]" style={{ color: '#991b1b' }}>
                <AlertCircle className="w-3 h-3" /> Save failed
            </span>
        );
    }
    if (state === 'saved' && lastSavedAt) {
        return (
            <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                <Check className="w-3 h-3" /> Saved {timeAgo(lastSavedAt.toISOString())}
            </span>
        );
    }
    return null;
}
