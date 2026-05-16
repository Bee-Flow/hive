import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import './vscode-theme.css';
import { FileImage, AlertCircle } from 'lucide-react';
import ActivityBar from './ActivityBar';
import FileExplorer from './FileExplorer';
import EditorTabs from './EditorTabs';
import WebpageEditor from './WebpageEditor';
import WebpagePreview from './WebpagePreview';
import WebpageChat from './WebpageChat';
import WebpageSources from './WebpageSources';
import WebpageDbViewer from './WebpageDbViewer';
import StatusBar from './StatusBar';
import scopedStorage from '../../utils/scopedStorage';

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 400;
const CHAT_MIN = 240;
const CHAT_MAX = 520;
const PREVIEW_MIN = 100;

const PRIMARY_LANG = { html: 'html', css: 'css', js: 'javascript' };

// Map common file extensions to Monaco language ids. Anything unrecognised
// renders as plain text — still editable, just no syntax highlighting.
function pickLanguage(path) {
    const ext = (path.split('.').pop() || '').toLowerCase();
    switch (ext) {
        case 'html': case 'htm': return 'html';
        case 'css': return 'css';
        case 'js': case 'mjs': return 'javascript';
        case 'json': return 'json';
        case 'md': case 'markdown': return 'markdown';
        case 'svg': case 'xml': return 'xml';
        case 'ts': case 'tsx': return 'typescript';
        case 'yml': case 'yaml': return 'yaml';
        default: return 'plaintext';
    }
}

function useDragResize(initialSize, min, max) {
    const [size, setSize] = useState(initialSize);
    const dragging = useRef(false);
    const startX = useRef(0);
    const startSize = useRef(initialSize);

    const onMouseDown = useCallback((e) => {
        dragging.current = true;
        startX.current = e.clientX;
        startSize.current = size;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [size]);

    useEffect(() => {
        const onMove = (e) => {
            if (!dragging.current) return;
            const delta = e.clientX - startX.current;
            setSize(Math.max(min, Math.min(max, startSize.current + delta)));
        };
        const onUp = () => {
            if (dragging.current) {
                dragging.current = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [min, max]);

    return [size, onMouseDown];
}

function useRowDragResize(initialPct, min, containerRef) {
    const [pct, setPct] = useState(initialPct);
    const dragging = useRef(false);
    const startY = useRef(0);
    const startPct = useRef(initialPct);

    const onMouseDown = useCallback((e) => {
        dragging.current = true;
        startY.current = e.clientY;
        startPct.current = pct;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
    }, [pct]);

    useEffect(() => {
        const onMove = (e) => {
            if (!dragging.current || !containerRef.current) return;
            const h = containerRef.current.getBoundingClientRect().height;
            const delta = e.clientY - startY.current;
            const newPct = startPct.current + (delta / h) * 100;
            const minPct = (min / h) * 100;
            setPct(Math.max(minPct, Math.min(100 - minPct, newPct)));
        };
        const onUp = () => {
            if (dragging.current) {
                dragging.current = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [min, containerRef]);

    return [pct, onMouseDown];
}

/**
 * Binary-file placeholder shown in place of Monaco when a non-text extra is
 * opened. Images render inline from their data URL; everything else gets
 * a generic file card with the size + mime type.
 */
function BinaryPreview({ path, mimeType, dataUrl, size }) {
    const isImage = mimeType?.startsWith('image/');
    const fmtSize = (n) => {
        if (!n || n < 1024) return `${n || 0} B`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
        return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    };
    return (
        <div className="flex flex-col items-center justify-center h-full w-full p-6" style={{ background: 'var(--vsc-editor-bg)', color: 'var(--vsc-fg-muted)' }}>
            {isImage && dataUrl ? (
                <img
                    src={dataUrl}
                    alt={path}
                    style={{ maxWidth: '100%', maxHeight: '70%', objectFit: 'contain', border: '1px solid var(--vsc-border)' }}
                />
            ) : (
                <FileImage size={48} style={{ opacity: 0.5 }} />
            )}
            <div className="text-[12px] mt-3 font-mono">{path}</div>
            <div className="text-[11px] mt-1">{mimeType || 'application/octet-stream'} · {fmtSize(size)}</div>
            <div className="text-[11px] mt-3 max-w-md text-center" style={{ opacity: 0.7 }}>
                Binary files aren't editable in the text editor. Ask the AI to replace this asset, or delete and re-upload.
            </div>
        </div>
    );
}

export default function WebpageIDE({
    // Webpage data
    selected,
    html, css, js,
    onHtmlChange, onCssChange, onJsChange,
    dirtyFiles: dirtyFilesProp = {},
    extraFiles = [], extraContents = {},
    onExtraChange,     // (path, newContent) => void  — text-only extras
    sources, onSourcesChange,
    // Chat
    chatMessages, chatLoading,
    onChatSend, onChatStop, onChatRetry, onChatEdit,
    onPlanApprove, onPlanReject,
    onNewChat,
    chatMode, onChatModeChange,
    onSelectionAttach,
    attachedSelection, onSelectionClear,
    modelTiers, selectedTier, onTierChange,
    // Save
    saveState, lastSavedAt,
    // Versions
    onVersionsClick,
    // Download
    onDownload,
    // User (unused here but kept for API symmetry)
    user, // eslint-disable-line no-unused-vars
}) {
    // Theme — persisted via scopedStorage (already namespaced by current user).
    // Defaults to light so the IDE blends with the host app's light theme.
    const [theme, setTheme] = useState(() => {
        try { return scopedStorage.getItem('webpages_theme') || 'light'; } catch { return 'light'; }
    });
    const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        try { scopedStorage.setItem('webpages_theme', next); } catch {}
    };

    // Active pane in sidebar — starts null so the sidebar is collapsed and the
    // preview takes full width. Clicking an activity-bar icon expands; clicking
    // the same icon again collapses.
    const [sidebarPane, setSidebarPane] = useState(null);
    const handleActivityBarSelect = (id) => {
        setSidebarPane(prev => (prev === id ? null : id));
    };
    const sidebarOpen = sidebarPane !== null;

    // Open editor tabs (keys: 'html'|'css'|'js'|'extra:<path>') + active key.
    const [openFiles, setOpenFiles] = useState([]);
    const [activeKey, setActiveKey] = useState(null);
    const editorOpen = activeKey !== null;

    const openFile = useCallback((key) => {
        setOpenFiles(prev => prev.includes(key) ? prev : [...prev, key]);
        setActiveKey(key);
    }, []);

    const closeFile = useCallback((key) => {
        setOpenFiles(prev => {
            const next = prev.filter(k => k !== key);
            if (activeKey === key) {
                setActiveKey(next.length > 0 ? next[next.length - 1] : null);
            }
            return next;
        });
    }, [activeKey]);

    // Cursor position (from Monaco)
    const [cursor, setCursor] = useState({ line: 1, col: 1 });

    // Panel sizes — sidebar width, chat width
    const [sidebarWidth, onSidebarDrag] = useDragResize(220, SIDEBAR_MIN, SIDEBAR_MAX);
    const [chatWidth, onChatDrag] = useDragResize(340, CHAT_MIN, CHAT_MAX);

    // Editor/preview split (percentage of center column)
    const centerRef = useRef(null);
    const [editorPct, onEditorPreviewDrag] = useRowDragResize(60, PREVIEW_MIN, centerRef);

    // Per-tab dirty dots — supplied by the parent (WebpagesPage tracks per-key
    // dirty state alongside its save queue). Object keyed by tab id
    // ('html' | 'css' | 'js' | 'extra:<path>') with truthy values for unsaved.
    const dirtyFiles = dirtyFilesProp || {};

    // Resolve activeKey → what the editor pane should render.
    const activeView = useMemo(() => {
        if (!activeKey) return null;
        if (activeKey === 'html' || activeKey === 'css' || activeKey === 'js') {
            const value = { html, css, js }[activeKey] || '';
            return {
                kind: 'text',
                value,
                language: PRIMARY_LANG[activeKey],
                onChange: (v) => {
                    if (activeKey === 'html') onHtmlChange(v);
                    else if (activeKey === 'css') onCssChange(v);
                    else onJsChange(v);
                },
            };
        }
        if (activeKey.startsWith('extra:')) {
            const path = activeKey.slice(6);
            const meta = extraFiles.find(f => f.path === path);
            const content = extraContents[path];
            if (!content) {
                return { kind: 'missing', path };
            }
            if (content.isText) {
                return {
                    kind: 'text',
                    value: content.content || '',
                    language: pickLanguage(path),
                    onChange: (v) => onExtraChange?.(path, v),
                };
            }
            return {
                kind: 'binary',
                path,
                mimeType: meta?.mimeType || content.mimeType,
                dataUrl: content.dataUrl,
                size: meta?.size || 0,
            };
        }
        return null;
    }, [activeKey, html, css, js, extraFiles, extraContents, onHtmlChange, onCssChange, onJsChange, onExtraChange]);

    // Status-bar file size for the active text file. Binary/db are 0.
    const fileSize = activeView?.kind === 'text'
        ? new Blob([activeView.value]).size
        : 0;

    // Status-bar activeFile token — kept compatible with the existing StatusBar
    // contract that distinguishes primary slots (string) from db ({kind:'db'}).
    const statusActiveFile = (() => {
        if (!activeKey) return null;
        if (activeKey === 'html' || activeKey === 'css' || activeKey === 'js') return activeKey;
        if (activeKey.startsWith('extra:')) return { kind: 'extra', path: activeKey.slice(6) };
        return null;
    })();

    // FileExplorer's activeFile prop is in the old shape ('html'|'css'|'js' or
    // {path}). Translate from our activeKey.
    const explorerActiveFile = (() => {
        if (!activeKey) return null;
        if (activeKey === 'html' || activeKey === 'css' || activeKey === 'js') return activeKey;
        if (activeKey.startsWith('extra:')) return { path: activeKey.slice(6) };
        return null;
    })();

    const handleExplorerSelect = (file) => {
        if (typeof file === 'string') {
            openFile(file);
        } else if (file && file.path) {
            openFile(`extra:${file.path}`);
        }
    };

    return (
        <div
            data-vscode-theme={theme}
            className="flex flex-col"
            style={{ height: '100%', width: '100%', overflow: 'hidden' }}
        >
            {/* Main body: activity bar + sidebar + center + chat */}
            <div className="flex flex-1 min-h-0">

                {/* Activity bar */}
                <ActivityBar active={sidebarPane} onSelect={handleActivityBarSelect} />

                {/* Sidebar — only mounted when a pane is selected. Click the
                    same activity-bar icon again to collapse. */}
                {sidebarOpen && (
                    <>
                        <div
                            className="flex flex-col shrink-0 overflow-hidden"
                            style={{ width: sidebarWidth, borderRight: '1px solid var(--vsc-border)', background: 'var(--vsc-sidebar-bg)' }}
                        >
                            {sidebarPane === 'files' && (
                                <FileExplorer
                                    activeFile={explorerActiveFile}
                                    onFileSelect={handleExplorerSelect}
                                    dirtyFiles={dirtyFiles}
                                    extraFiles={extraFiles}
                                />
                            )}
                            {sidebarPane === 'database' && (
                                <WebpageDbViewer webpageId={selected?.id} theme={theme} />
                            )}
                            {sidebarPane === 'knowledge' && (
                                <WebpageSources
                                    webpageId={selected.id}
                                    sources={sources}
                                    onSourcesChange={onSourcesChange}
                                />
                            )}
                            {sidebarPane === 'history' && (
                                <div
                                    className="flex items-center justify-center h-full text-[12px]"
                                    style={{ color: 'var(--vsc-fg-muted)' }}
                                >
                                    <button
                                        onClick={onVersionsClick}
                                        className="px-3 py-1.5 rounded text-[12px]"
                                        style={{ background: 'var(--vsc-accent)', color: '#fff' }}
                                    >
                                        Open version history
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Sidebar resize handle (only when sidebar is open) */}
                        <div
                            onMouseDown={onSidebarDrag}
                            className="shrink-0 w-1 cursor-col-resize"
                            style={{ background: 'transparent' }}
                        />
                    </>
                )}

                {/* Center: editor + preview stacked */}
                <div className="flex flex-col flex-1 min-w-0 min-h-0" ref={centerRef}>
                    {/* Tabs only render when at least one tab is open. */}
                    {editorOpen && (
                        <EditorTabs
                            openFiles={openFiles}
                            activeKey={activeKey}
                            onSelect={setActiveKey}
                            onClose={closeFile}
                            dirtyFiles={dirtyFiles}
                        />
                    )}

                    {editorOpen && activeView && (
                        <>
                            <div style={{ flex: `0 0 ${editorPct}%`, minHeight: 0, overflow: 'hidden' }}>
                                {activeView.kind === 'text' ? (
                                    <WebpageEditor
                                        value={activeView.value}
                                        language={activeView.language}
                                        onChange={activeView.onChange}
                                        theme={theme}
                                        onCursorChange={setCursor}
                                    />
                                ) : activeView.kind === 'binary' ? (
                                    <BinaryPreview
                                        path={activeView.path}
                                        mimeType={activeView.mimeType}
                                        dataUrl={activeView.dataUrl}
                                        size={activeView.size}
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full p-6 text-[12px]" style={{ color: 'var(--vsc-fg-muted)' }}>
                                        <AlertCircle size={32} style={{ opacity: 0.5 }} />
                                        <div className="mt-3 font-mono">{activeView.path}</div>
                                        <div className="mt-1">File content not loaded yet.</div>
                                    </div>
                                )}
                            </div>

                            {/* Editor/Preview resize handle */}
                            <div
                                onMouseDown={onEditorPreviewDrag}
                                className="shrink-0 h-1 cursor-row-resize"
                                style={{ background: 'var(--vsc-border)' }}
                            />
                        </>
                    )}

                    {/* Preview — always visible, full height when no editor is open */}
                    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                        <WebpagePreview
                            webpageId={selected?.id}
                            html={html} css={css} js={js}
                            extraFiles={extraFiles}
                            extraContents={extraContents}
                            onSelectionAttach={onSelectionAttach}
                        />
                    </div>
                </div>

                {/* Chat resize handle */}
                <div
                    onMouseDown={onChatDrag}
                    className="shrink-0 w-1 cursor-col-resize"
                    style={{ background: 'var(--vsc-border)' }}
                />

                {/* Chat panel */}
                <div
                    className="flex flex-col shrink-0"
                    style={{ width: chatWidth, borderLeft: '1px solid var(--vsc-border)', background: 'var(--vsc-editor-bg)' }}
                >
                    <WebpageChat
                        messages={chatMessages}
                        isLoading={chatLoading}
                        onSend={onChatSend}
                        onStop={onChatStop}
                        onRetry={onChatRetry}
                        onEdit={onChatEdit}
                        modelTiers={modelTiers}
                        selectedTier={selectedTier}
                        onTierChange={onTierChange}
                        onPlanApprove={onPlanApprove}
                        onPlanReject={onPlanReject}
                        onNewChat={onNewChat}
                        chatMode={chatMode}
                        onChatModeChange={onChatModeChange}
                        attachedSelection={attachedSelection}
                        onSelectionClear={onSelectionClear}
                    />
                </div>
            </div>

            {/* Status bar */}
            <StatusBar
                theme={theme}
                onThemeToggle={toggleTheme}
                activeFile={statusActiveFile}
                cursor={cursor}
                fileSize={fileSize}
                saveState={saveState}
                lastSavedAt={lastSavedAt}
                onDownload={onDownload}
                onVersions={onVersionsClick}
            />
        </div>
    );
}
