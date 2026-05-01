import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    ArrowLeft, Plus, Trash2, Loader2, AlertCircle, Search,
    X, Pencil, Globe, FileCode2, Check,
} from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import useChatEngine from '../hooks/useChatEngine';
import WebpageIDE from './webpages/WebpageIDE';
import downloadWebpageZip from '../utils/downloadWebpageZip';
import computeWebpageDiff from '../utils/computeWebpageDiff';

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
    const canUseWebpages = !!(user?.permissions?.includes('all') || user?.betaFeatures?.includes('webpages'));

    const [webpages, setWebpages] = useState([]);
    const [selected, setSelected] = useState(null); // metadata row
    const [sources, setSources] = useState([]);
    const [versions, setVersions] = useState([]);
    const [showVersions, setShowVersions] = useState(false);

    const [html, setHtml] = useState('');
    const [css, setCss] = useState('');
    const [js, setJs] = useState('');

    // Refs that mirror html/css/js so the debounced persist() callback can be
    // stable (no html/css/js in its deps) — read the live value at call time.
    // Sync via useEffect so the ref tracks state regardless of which code path
    // mutates it.
    const htmlRef = useRef('');
    const cssRef  = useRef('');
    const jsRef   = useRef('');
    useEffect(() => { htmlRef.current = html; }, [html]);
    useEffect(() => { cssRef.current  = css;  }, [css]);
    useEffect(() => { jsRef.current   = js;   }, [js]);

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
    // Chat-history dirty tracking — the JSON-stringified version of the last
    // chat we know is in the DB. Compared in the debounced chat-save effect
    // so we only PUT when something actually changed.
    const lastSavedChatRef = useRef('[]');
    const chatSaveTimerRef = useRef(null);

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
    // Ref bridge so the SSE callback (closed over once at hook init) can call
    // the latest setChatMessages without recreating the callback every render.
    const setChatMessagesRef = useRef(null);

    // Plan approval state — set when the user clicks "Approve & build" on a
    // plan card; read by getExtraPayload so the next chat send carries the
    // planExecution authorisation. Cleared after the round-trip starts.
    const [pendingPlanExecution, setPendingPlanExecution] = useState(null);

    // Preview-iframe selection chip — set when the user highlights rendered
    // content in the preview. Surfaces above the chat input as a removable
    // pill. On send, getExtraPayload converts it into the server's existing
    // `webpageSelection: { text, file, action? }` contract. Single-shot —
    // cleared automatically after the send.
    const [attachedSelection, setAttachedSelection] = useState(null);
    const handleSelectionAttach = useCallback((selection) => {
        if (!selection || !selection.text) return;
        setAttachedSelection({
            text: selection.text,
            tagName: selection.tagName || null,
            className: selection.className || null,
            elementId: selection.elementId || null,
        });
    }, []);
    const handleSelectionClear = useCallback(() => setAttachedSelection(null), []);

    const { messages: chatMessages, setMessages: setChatMessages, isLoading: chatLoading,
        sendMessage: sendChatMessage, stopGenerating: stopChatGenerating,
        retryMessage: retryChatMessage, editAndRegenerate: editAndRegenerateChat,
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
                const base = {
                    webpageId: selected.id,
                    htmlContent: html,
                    cssContent: css,
                    jsContent: js,
                };
                if (pendingPlanExecution) {
                    base.planExecution = pendingPlanExecution;
                }
                if (attachedSelection) {
                    // The server's webpageSelection contract expects { text, file, action? }.
                    // Preview-iframe selections come from rendered HTML, so we tag
                    // file='html' and let the AI find the matching source there.
                    base.webpageSelection = {
                        text: attachedSelection.text,
                        file: 'html',
                    };
                }
                return base;
            },
        }), [selectedTier, selected?.id, html, css, js, pendingPlanExecution, attachedSelection]),
        onDirectConversationCreated: useCallback(() => {}, []),
        // Webpage-specific SSE events — useChatEngine forwards them via these callbacks.
        onWebpageDocUpdate: useCallback((data) => {
            const { file, content, title } = data || {};
            if (!file) return;
            const next = content || '';

            // Capture before-state from refs so the diff is computed against
            // exactly what was on screen the moment the SSE arrived.
            const before = file === 'html' ? htmlRef.current
                         : file === 'css'  ? cssRef.current
                         : file === 'js'   ? jsRef.current
                         : '';

            const diff = computeWebpageDiff(before, next);

            // Apply the change to editor state.
            if (file === 'html') setHtml(next);
            else if (file === 'css') setCss(next);
            else if (file === 'js') setJs(next);

            // Attach a diff entry to the most recent assistant message so the
            // chat panel can render a diff card below the AI's reply.
            const updateMessages = setChatMessagesRef.current;
            if (typeof updateMessages === 'function' && diff.summary !== 'no change') {
                updateMessages(prev => {
                    if (!prev || prev.length === 0) return prev;
                    // Find latest assistant message (walk from end)
                    for (let i = prev.length - 1; i >= 0; i--) {
                        if (prev[i].role === 'assistant') {
                            const msg = prev[i];
                            const edits = Array.isArray(msg.webpageEdits) ? msg.webpageEdits : [];
                            return [
                                ...prev.slice(0, i),
                                { ...msg, webpageEdits: [...edits, { file, title: title || file, diff }] },
                                ...prev.slice(i + 1),
                            ];
                        }
                    }
                    return prev;
                });
            }
        }, []),
        onWebpageSourceAdded: useCallback((source) => {
            setSources(prev => [...prev, source]);
        }, []),
    });

    // Bind the ref so the SSE callback above can mutate the chat-message list.
    setChatMessagesRef.current = setChatMessages;

    /* ── Plan approval handlers ─────────────────────────────── */
    const handlePlanApprove = useCallback((planId) => {
        if (!planId) return;
        // Flip the matching plan card to approved status
        setChatMessages(prev => prev.map(m => (
            m.webpagePlan && m.webpagePlan.planId === planId
                ? { ...m, webpagePlan: { ...m.webpagePlan, status: 'approved' } }
                : m
        )));
        // Stage the planExecution payload for the next chat send and trigger it.
        setPendingPlanExecution({ planId, action: 'execute' });
        // Defer to the next tick so React has flushed the pendingPlanExecution
        // state before getExtraPayload reads it.
        setTimeout(() => {
            sendChatMessage('Approved — please build the plan.', []);
            // Clear the staging state once the request has been kicked off; the
            // server has already received it, and we don't want it to leak
            // into the next user turn.
            setTimeout(() => setPendingPlanExecution(null), 100);
        }, 0);
    }, [sendChatMessage, setChatMessages]);

    const handlePlanReject = useCallback((planId) => {
        if (!planId) return;
        setChatMessages(prev => prev.map(m => (
            m.webpagePlan && m.webpagePlan.planId === planId
                ? { ...m, webpagePlan: { ...m.webpagePlan, status: 'rejected' } }
                : m
        )));
    }, [setChatMessages]);

    // After a build round-trip finishes (chat goes idle), flip any plan card
    // currently in "approved" state to "executed" so the user sees the ✓.
    useEffect(() => {
        if (chatLoading) return;
        setChatMessages(prev => {
            let changed = false;
            const next = prev.map(m => {
                if (m.webpagePlan && m.webpagePlan.status === 'approved') {
                    changed = true;
                    return { ...m, webpagePlan: { ...m.webpagePlan, status: 'executed' } };
                }
                return m;
            });
            return changed ? next : prev;
        });
    }, [chatLoading, setChatMessages]);

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
            const { webpage, sources: srcs, files, chatMessages: persistedChat } = await api(`/${id}`);
            setSelected(webpage);
            setSources(srcs || []);
            const fHtml = files?.html || '', fCss = files?.css || '', fJs = files?.js || '';
            setHtml(fHtml);
            setCss(fCss);
            setJs(fJs);
            // Restore the per-webpage chat history so the user keeps context
            // across refreshes. Fresh empty array if the webpage has none yet.
            setChatMessages(Array.isArray(persistedChat) ? persistedChat : []);
            // Mark the loaded chat as already-saved so the debounced chat-save
            // effect doesn't immediately re-PUT it back to the server.
            lastSavedChatRef.current = JSON.stringify(Array.isArray(persistedChat) ? persistedChat : []);
            lastSavedSnapshotRef.current = { html: fHtml, css: fCss, js: fJs };
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
        // Read current values from refs so persist() is stable (no html/css/js deps)
        const snapshot = { html: htmlRef.current, css: cssRef.current, js: jsRef.current };
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
    }, [selected]); // stable — html/css/js read via refs at call time

    useEffect(() => {
        if (!selected) return;
        if (skipNextSaveRef.current) {
            skipNextSaveRef.current = false;
            return;
        }
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => persist(), 1500);
        return () => saveTimerRef.current && clearTimeout(saveTimerRef.current);
    }, [html, css, js, selected]); // persist excluded — intentionally stable

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

    /* ── Persist chat history per webpage ──────────────────────
     * The chat is the source of truth on the client. Whenever it changes
     * AND we're not mid-stream (chatLoading=false), we debounce-save the
     * full message array to the server. Skips the no-op case where the
     * chat matches what we last persisted (loadWebpage hydrates this ref).
     */
    useEffect(() => {
        if (!selected) return;
        // Don't save mid-stream — wait for the assistant turn to settle so
        // we save the final shape rather than the partial streaming state.
        if (chatLoading) return;
        const serialized = JSON.stringify(chatMessages || []);
        if (serialized === lastSavedChatRef.current) return;

        if (chatSaveTimerRef.current) clearTimeout(chatSaveTimerRef.current);
        chatSaveTimerRef.current = setTimeout(async () => {
            try {
                await api(`/${selected.id}/chat`, {
                    method: 'PUT',
                    body: JSON.stringify({ messages: chatMessages || [] }),
                });
                lastSavedChatRef.current = serialized;
            } catch (err) {
                console.warn('[Webpages] Chat save failed:', err.message);
            }
        }, 800);
        return () => chatSaveTimerRef.current && clearTimeout(chatSaveTimerRef.current);
    }, [chatMessages, chatLoading, selected]);

    /* ── New Chat — clear local state + DELETE on the server ── */
    const handleNewChat = useCallback(async () => {
        if (!selected) return;
        setChatMessages([]);
        // Mark the empty array as "saved" so the debounced effect doesn't
        // also fire a PUT a moment later — DELETE is enough.
        lastSavedChatRef.current = '[]';
        try {
            await api(`/${selected.id}/chat`, { method: 'DELETE' });
        } catch (err) {
            console.warn('[Webpages] Chat clear failed:', err.message);
        }
    }, [selected, setChatMessages]);

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

    /* ── Editor view (VS Code IDE shell) ────────────────────────── */
    return (
        <div className="relative flex flex-col h-full">
            {/* Back-to-list header */}
            <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b"
                 style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                <button onClick={handleClose} className="p-1 rounded-md hover:bg-white/40" title="Back to list">
                    <ArrowLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{selected.name}</span>
            </div>

            {/* IDE shell — fills the rest of the height */}
            <div className="flex-1 min-h-0">
                <WebpageIDE
                    selected={selected}
                    html={html} css={css} js={js}
                    onHtmlChange={setHtml}
                    onCssChange={setCss}
                    onJsChange={setJs}
                    sources={sources}
                    onSourcesChange={setSources}
                    chatMessages={chatMessages}
                    chatLoading={chatLoading}
                    onChatSend={(text, attachments) => {
                        sendChatMessage(text, attachments);
                        // Single-shot: clear the attached selection after the
                        // first send so the next message doesn't carry it
                        // unless the user picks a new one.
                        if (attachedSelection) setAttachedSelection(null);
                    }}
                    onChatStop={stopChatGenerating}
                    onChatRetry={retryChatMessage}
                    onChatEdit={editAndRegenerateChat}
                    onPlanApprove={handlePlanApprove}
                    onPlanReject={handlePlanReject}
                    onNewChat={handleNewChat}
                    onSelectionAttach={handleSelectionAttach}
                    attachedSelection={attachedSelection}
                    onSelectionClear={handleSelectionClear}
                    modelTiers={modelTiers}
                    selectedTier={selectedTier}
                    onTierChange={setSelectedTier}
                    saveState={saveState}
                    lastSavedAt={lastSavedAt}
                    onVersionsClick={() => setShowVersions(true)}
                    onDownload={handleDownloadZip}
                    user={user}
                />
            </div>

            {/* Versions overlay */}
            {showVersions && (
                <div className="absolute inset-0 z-40 flex items-start justify-center pt-20" style={{ background: 'rgba(0,0,0,0.5)' }}
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

// eslint-disable-next-line no-unused-vars
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
