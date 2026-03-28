import React, { useRef, useEffect, useCallback, useState } from 'react';
import NotebookEditor from '../pages/notebooks/NotebookEditor';
import { API_BASE, authFetch } from '../utils/helpers';
import {
    X, ExternalLink, Copy, Download, FileDown,
    Check, Loader2, ChevronDown, FileText,
} from 'lucide-react';
import { renderMermaidToSVG, svgToPngDataUrl } from '../pages/notebooks/MermaidBlock';

/* ── Embed images as base64 for export ───────────────────────── */
async function embedImagesAsBase64(html) {
    const imgRegex = /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi;
    const matches = [...html.matchAll(imgRegex)];
    const replacements = await Promise.allSettled(
        matches.map(async (match) => {
            const [fullMatch, before, src, after] = match;
            if (src.startsWith('data:')) return { fullMatch, newTag: fullMatch };
            try {
                const resolvedUrl = src.startsWith('http') ? src : `${window.location.origin}${src}`;
                const res = await fetch(resolvedUrl, { credentials: 'include' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                let widthStyle = '';
                const widthMatch = (before + after).match(/data-width=["'](\d+)["']/);
                const styleMatch = (before + after).match(/style=["']([^"']*?width[^"']*?)["']/);
                if (widthMatch) widthStyle = ` style="width:${widthMatch[1]}px;height:auto;max-width:100%"`;
                else if (styleMatch) widthStyle = ` style="${styleMatch[1]}"`;
                return { fullMatch, newTag: `<img src="${dataUrl}"${widthStyle} alt="" />` };
            } catch (err) {
                console.warn('[Export] Failed to embed image:', src, err.message);
                return { fullMatch, newTag: fullMatch };
            }
        })
    );
    let result = html;
    for (const r of replacements) {
        if (r.status === 'fulfilled') result = result.replace(r.value.fullMatch, r.value.newTag);
    }
    return result;
}

/**
 * WorkspaceNotebook — Replaces the old WorkspacePanel.
 *
 * Wraps NotebookEditor in a minimal container: header bar + editor,
 * no sources sidebar, no chat panel.
 *
 * IMPORTANT: We pass a STABLE `initialContent` to NotebookEditor (never
 * changes after mount). All subsequent external updates are pushed via ref.
 */
export default function WorkspaceNotebook({
    content,
    onChange,
    onSave,
    onClose,
    onSelectionChange,
    onAskAI,
    onOpenInNotebook,
    conversationId,
    existingNotebookId,
    onNotebookIdChange,
    user,
}) {
    const editorRef = useRef(null);
    const [copied, setCopied] = useState(false);
    const [saving, setSaving] = useState(false);
    const saveTimerRef = useRef(null);

    // Lazy notebook creation for image uploads etc.
    const [notebookId, setNotebookId] = useState(existingNotebookId || null);
    const creatingNotebookRef = useRef(false);

    // Sync when parent passes a different existing notebook ID (e.g. conversation switch)
    useEffect(() => {
        if (existingNotebookId && existingNotebookId !== notebookId) {
            setNotebookId(existingNotebookId);
        }
    }, [existingNotebookId]);

    // Stable initial content
    const [initialContent] = useState(() => content || '');
    const prevContentRef = useRef(content);

    // Export state
    const [exporting, setExporting] = useState(null);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const exportMenuRef = useRef(null);

    // Lazily create a real notebook when content exists
    const ensureNotebook = useCallback(async () => {
        if (notebookId || creatingNotebookRef.current) return notebookId;
        creatingNotebookRef.current = true;
        try {
            const res = await authFetch(`${API_BASE}/api/notebooks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: `Chat Notebook – ${new Date().toLocaleDateString()}` }),
            });
            if (res.ok) {
                const { notebook } = await res.json();
                setNotebookId(notebook.id);
                // Notify parent so it can persist the ID to the conversation
                onNotebookIdChange?.(notebook.id);
                // Trigger an immediate save so the notebook ID is persisted
                const editor = editorRef.current?.getEditor?.();
                const md = editor?.storage?.markdown?.getMarkdown?.() || '';
                if (md.trim()) onSave?.(md, notebook.id);
                return notebook.id;
            }
        } catch (err) {
            console.error('[WorkspaceNotebook] Failed to create notebook:', err);
        } finally {
            creatingNotebookRef.current = false;
        }
        return null;
    }, [notebookId, onNotebookIdChange, onSave]);

    // Auto-create notebook when content first appears
    useEffect(() => {
        if (content && content.trim() && !notebookId && !creatingNotebookRef.current) {
            ensureNotebook();
        }
    }, [content, notebookId, ensureNotebook]);

    // Push external updates imperatively
    useEffect(() => {
        if (content === prevContentRef.current) return;
        prevContentRef.current = content;
        const editor = editorRef.current?.getEditor?.();
        if (!editor) return;
        editor.commands.setContent(content || '', false);
    }, [content]);

    // Extract markdown helper
    const getMarkdown = useCallback(() => {
        const editor = editorRef.current?.getEditor?.();
        if (!editor) return '';
        return editor.storage.markdown?.getMarkdown?.() || '';
    }, []);

    // Get HTML for export
    const getHTML = useCallback(() => {
        const editor = editorRef.current?.getEditor?.();
        return editor?.getHTML?.() || '';
    }, []);

    // Editor onChange
    const handleEditorChange = useCallback(() => {
        const md = getMarkdown();
        prevContentRef.current = md;
        onChange?.(md);

        if (md.trim() && !notebookId && !creatingNotebookRef.current) {
            ensureNotebook();
        }

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            setSaving(true);
            onSave?.(md);
            setTimeout(() => setSaving(false), 800);
        }, 1200);
    }, [onChange, onSave, getMarkdown, notebookId, ensureNotebook]);

    // AI actions from bubble menu
    const handleAIAction = useCallback((actionKey, selectedText, range, customQuery) => {
        if (!onAskAI) return;
        onSelectionChange?.(selectedText);

        let prompt;
        switch (actionKey) {
            case 'rewrite': prompt = `Rewrite this text in the notebook:\n> ${selectedText}`; break;
            case 'shorten': prompt = `Make this text shorter in the notebook:\n> ${selectedText}`; break;
            case 'expand':  prompt = `Expand and elaborate on this text in the notebook:\n> ${selectedText}`; break;
            case 'ask':     prompt = customQuery || `About this text in the notebook: ${selectedText}`; break;
            default:        prompt = `${actionKey}: ${selectedText}`;
        }
        onAskAI(prompt);
    }, [onAskAI, onSelectionChange]);

    // Copy
    const handleCopy = useCallback(() => {
        const md = getMarkdown();
        navigator.clipboard.writeText(md);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [getMarkdown]);

    // Export PDF/Word
    const handleExport = useCallback(async (format) => {
        const nbId = notebookId || await ensureNotebook();
        if (!nbId) return;

        setExporting(format);
        setExportMenuOpen(false);
        try {
            let htmlContent = getHTML();

            // Render mermaid diagrams
            const mermaidRegex = /<div[^>]*data-type="mermaid-diagram"[^>]*data-code="([^"]*?)"[^>]*>.*?<\/div>/gi;
            const mermaidMatches = [...htmlContent.matchAll(mermaidRegex)];
            for (const match of mermaidMatches) {
                const code = match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
                try {
                    const svg = await renderMermaidToSVG(code);
                    if (svg) {
                        const png = await svgToPngDataUrl(svg);
                        htmlContent = htmlContent.replace(match[0],
                            png ? `<div style="text-align:center;margin:16px 0;"><img src="${png}" style="max-width:100%;border-radius:8px;" alt="Diagram" /></div>`
                                : `<div style="text-align:center;margin:16px 0;">${svg}</div>`);
                    }
                } catch (_) {}
            }

            htmlContent = await embedImagesAsBase64(htmlContent);

            const res = await authFetch(`${API_BASE}/api/notebooks/${nbId}/export/${format}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: htmlContent, title: 'Notebook' }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Export failed (${res.status})`);
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `notebook-${new Date().toISOString().slice(0, 10)}.${format === 'pdf' ? 'pdf' : 'docx'}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('[WorkspaceNotebook] Export failed:', e);
        } finally {
            setExporting(null);
        }
    }, [notebookId, ensureNotebook, getHTML]);

    // Open in full notebook
    const handleOpenNotebook = useCallback(async () => {
        const md = getMarkdown();
        if (notebookId) {
            try {
                await authFetch(`${API_BASE}/api/notebooks/${notebookId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ documentContent: md }),
                });
            } catch (e) {
                console.warn('[WorkspaceNotebook] Failed to sync content before opening:', e);
            }
        }
        onOpenInNotebook?.(md, notebookId);
    }, [getMarkdown, onOpenInNotebook, notebookId]);

    // Close export menu on outside click
    useEffect(() => {
        if (!exportMenuOpen) return;
        const handleClick = (e) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
                setExportMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [exportMenuOpen]);

    // Cleanup
    useEffect(() => {
        return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, []);

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
            {/* ── Header Bar ── */}
            <div
                className="shrink-0 flex items-center justify-between px-4 py-2 border-b"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
            >
                <div className="flex items-center gap-2">
                    <span className="text-sm">📓</span>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Notebook
                    </h3>
                    {saving && (
                        <span className="text-[10px] animate-pulse ml-1" style={{ color: 'var(--accent-primary)' }}>
                            Saving…
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-0.5">

                    {/* Export dropdown */}
                    {user?.featureFlags?.export !== false && (
                    <div className="relative" ref={exportMenuRef}>
                        <button
                            onClick={() => setExportMenuOpen(p => !p)}
                            disabled={!!exporting}
                            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)] flex items-center gap-0.5"
                            style={{ color: exporting ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}
                            title={t('notebooks.export_title')}
                        >
                            {exporting
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Download className="w-3.5 h-3.5" />}
                            <ChevronDown className="w-2.5 h-2.5" />
                        </button>

                        {exportMenuOpen && (
                            <div
                                className="absolute right-0 top-full mt-1 rounded-xl border py-1 shadow-xl z-50 min-w-[150px]"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}
                            >
                                <button
                                    onClick={() => handleExport('pdf')}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    <FileDown className="w-3.5 h-3.5 text-red-500" />
                                    {t('notebooks.export_pdf')}
                                </button>
                                <button
                                    onClick={() => handleExport('docx')}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                                    {t('notebooks.export_word')}
                                </button>
                            </div>
                        )}
                    </div>
                    )}

                    {/* Open in full Notebook */}
                    {user?.featureFlags?.openInNotebook !== false && (
                    <button
                        onClick={handleOpenNotebook}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ color: 'var(--accent-primary)' }}
                        title={t('notebooks.open_in_notebook_title')}
                    >
                        <ExternalLink className="w-3 h-3" />
                        {t('notebooks.open_in_notebook')}
                    </button>
                    )}

                    {/* Divider */}
                    {(user?.featureFlags?.export !== false || user?.featureFlags?.openInNotebook !== false) && (
                        <div className="w-px h-4 mx-1" style={{ background: 'var(--border-subtle)' }} />
                    )}

                    {/* Close */}
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ color: 'var(--text-tertiary)' }}
                        title={t('notebooks.close')}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── TipTap Editor ── */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <NotebookEditor
                    ref={editorRef}
                    content={initialContent}
                    onChange={handleEditorChange}
                    onSave={() => onSave?.(getMarkdown())}
                    onAIAction={handleAIAction}
                    saving={saving}
                    notebookId={notebookId || 'workspace'}
                    askAiEnabled={user?.featureFlags?.askAi !== false}
                />
            </div>
        </div>
    );
}
