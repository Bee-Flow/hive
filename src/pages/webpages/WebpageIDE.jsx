import React, { useState, useRef, useCallback, useEffect } from 'react';
import './vscode-theme.css';
import ActivityBar from './ActivityBar';
import FileExplorer from './FileExplorer';
import EditorTabs from './EditorTabs';
import WebpageEditor from './WebpageEditor';
import WebpagePreview from './WebpagePreview';
import WebpageChat from './WebpageChat';
import WebpageSources from './WebpageSources';
import StatusBar from './StatusBar';
import scopedStorage from '../../utils/scopedStorage';

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 400;
const CHAT_MIN = 240;
const CHAT_MAX = 520;
const PREVIEW_MIN = 100;

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

export default function WebpageIDE({
    // Webpage data
    selected,
    html, css, js,
    onHtmlChange, onCssChange, onJsChange,
    sources, onSourcesChange,
    // Chat
    chatMessages, chatLoading,
    onChatSend, onChatStop, onChatRetry, onChatEdit,
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

    // Active pane in sidebar
    const [sidebarPane, setSidebarPane] = useState('files');

    // Active editor file
    const [activeFile, setActiveFile] = useState('html');

    // Cursor position (from Monaco)
    const [cursor, setCursor] = useState({ line: 1, col: 1 });

    // Panel sizes — sidebar width, chat width
    const [sidebarWidth, onSidebarDrag] = useDragResize(220, SIDEBAR_MIN, SIDEBAR_MAX);
    const [chatWidth, onChatDrag] = useDragResize(340, CHAT_MIN, CHAT_MAX);

    // Editor/preview split (percentage of center column)
    const centerRef = useRef(null);
    const [editorPct, onEditorPreviewDrag] = useRowDragResize(60, PREVIEW_MIN, centerRef);

    // Dirty tracking (files that changed since last save)
    const dirtyFiles = {};
    // (simplified — we don't track per-file dirty here, parent tracks overall saveState)

    const fileSize = new Blob([{ html, css, js }[activeFile] || '']).size;

    const handleFileChange = (file, value) => {
        if (file === 'html') onHtmlChange(value);
        else if (file === 'css') onCssChange(value);
        else if (file === 'js') onJsChange(value);
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
                <ActivityBar active={sidebarPane} onSelect={setSidebarPane} />

                {/* Sidebar */}
                <div
                    className="flex flex-col shrink-0 overflow-hidden"
                    style={{ width: sidebarWidth, borderRight: '1px solid var(--vsc-border)', background: 'var(--vsc-sidebar-bg)' }}
                >
                    {sidebarPane === 'files' && (
                        <FileExplorer
                            activeFile={activeFile}
                            onFileSelect={setActiveFile}
                            dirtyFiles={dirtyFiles}
                        />
                    )}
                    {sidebarPane === 'sources' && (
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

                {/* Sidebar resize handle */}
                <div
                    onMouseDown={onSidebarDrag}
                    className="shrink-0 w-1 cursor-col-resize"
                    style={{ background: 'transparent' }}
                />

                {/* Center: editor + preview stacked */}
                <div className="flex flex-col flex-1 min-w-0 min-h-0" ref={centerRef}>
                    {/* Tab strip */}
                    <EditorTabs activeFile={activeFile} onSelect={setActiveFile} dirtyFiles={dirtyFiles} />

                    {/* Editor */}
                    <div style={{ flex: `0 0 ${editorPct}%`, minHeight: 0, overflow: 'hidden' }}>
                        <WebpageEditor
                            activeFile={activeFile}
                            onActiveFileChange={setActiveFile}
                            html={html}
                            css={css}
                            js={js}
                            onChange={handleFileChange}
                            theme={theme}
                            onCursorChange={setCursor}
                            sizes={{
                                html: new Blob([html]).size,
                                css: new Blob([css]).size,
                                js: new Blob([js]).size,
                            }}
                        />
                    </div>

                    {/* Editor/Preview resize handle */}
                    <div
                        onMouseDown={onEditorPreviewDrag}
                        className="shrink-0 h-1 cursor-row-resize"
                        style={{ background: 'var(--vsc-border)' }}
                    />

                    {/* Preview */}
                    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                        <WebpagePreview html={html} css={css} js={js} />
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
                    />
                </div>
            </div>

            {/* Status bar */}
            <StatusBar
                theme={theme}
                onThemeToggle={toggleTheme}
                activeFile={activeFile}
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
