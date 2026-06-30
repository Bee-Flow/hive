import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    ArrowLeft, Plus, FileText, Trash2,
    BookOpen, Loader2, AlertCircle, CheckCircle2, Search,
    X, ChevronRight, Pencil,
    ClipboardList, ListChecks, PanelLeft, History
} from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import { notebookApi as api, uploadSourceFile } from './notebooks/hooks/notebookApi';
import useModelTiers from './notebooks/hooks/useModelTiers';
import useExportTargets from './notebooks/hooks/useExportTargets';
import useSourcesPolling from './notebooks/hooks/useSourcesPolling';
import useDocumentAutosave from './notebooks/hooks/useDocumentAutosave';
import useChatEngine from '../hooks/useChatEngine';
import RichTextEditor from '../editor/react/RichTextEditor.jsx';
import { shouldUseNewEditor } from '../editor/react/useNewEditor.js';
import NotebookChat from './notebooks/NotebookChat';
import ExportMenu from './notebooks/ExportMenu';
import NotebookSources from './notebooks/NotebookSources';
import NotebookWorkspace from './notebooks/NotebookWorkspace';
import NotebookTOC from './notebooks/NotebookTOC';
import NotebookVersions from './notebooks/NotebookVersions';
import CitationOverlay from './notebooks/CitationOverlay';

import SendForSigningModal from './notebooks/SendForSigningModal';
import { preprocessMermaidContent } from './notebooks/MermaidExtension';
import { renderMermaidToSVG, svgToPngDataUrl } from './notebooks/MermaidBlock';
import { embedImagesAsBase64 } from '../utils/imageEmbedding';
import { useLicenseContext } from '../components/LicenseContext';
import { toast } from '../components/shared/Toast';
import useTranslation from '../hooks/useTranslation';

/* ── Time helper ──────────────────────────────────────────────── */
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

/* ── Source type metadata ─────────────────────────────────────── */
/* Shared with NotebookSources.jsx — keep in sync */
const SOURCE_META = {
    pdf:      { icon: '📄', color: '#ef4444', label: 'PDF' },
    docx:     { icon: '📝', color: '#3b82f6', label: 'Word' },
    xlsx:     { icon: '📊', color: '#22c55e', label: 'Excel' },
    csv:      { icon: '📊', color: '#22c55e', label: 'CSV' },
    text:     { icon: '📋', color: '#10b981', label: 'Text' },
    url:      { icon: '🌐', color: '#f59e0b', label: 'URL' },
    gdrive:   { icon: '🔵', color: '#4285f4', label: 'Drive' },
    onedrive: { icon: '☁️', color: '#0078d4', label: 'OneDrive' },
    file:     { icon: '📁', color: '#6b7280', label: 'File' },
    meeting:  { icon: '🎙️', color: '#ec4899', label: 'Meeting' },
};

const STATUS_CONFIG = {
    processing: { bg: 'linear-gradient(135deg, #fef3c7, #fde68a)', text: '#92400e', icon: Loader2, anim: 'animate-spin', label: 'Processing' },
    ready:      { bg: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', text: '#065f46', icon: CheckCircle2, anim: '', label: 'Ready' },
    error:      { bg: 'linear-gradient(135deg, #fecaca, #fca5a5)', text: '#991b1b', icon: AlertCircle, anim: '', label: 'Error' },
};

/* API helpers (`api`, `uploadSourceFile`) now live in ./notebooks/hooks/notebookApi */

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function NotebooksPage({ user, onBack, initialNotebookId, onNotebookChange }) {
    // Permission gate — matches the server-side `use_notebooks` router guard.
    // The result is used near the end of the component so hook order isn't disturbed.
    const canUseNotebooks = !!(user?.permissions?.includes('all') || user?.permissions?.includes('use_notebooks'));

    // Subscription/licence gate — matches the `notebooks` licence-feature gate on
    // the `/api/notebooks*` mounts (server/index.js) and the sidebar menu item.
    // When the org's plan/tier doesn't grant notebooks we hide the page and
    // redirect back to the app rather than render a broken shell that 403s on
    // every API call.
    const { hasFeature: hasLicenseFeature } = useLicenseContext();
    const licensedForNotebooks = hasLicenseFeature('notebooks');
    const { t } = useTranslation();

    const [notebooks, setNotebooks] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    const [newName, setNewName] = useState('');
    const [search, setSearch] = useState('');
    const [error, setError] = useState(null);
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null); // notebook pending delete confirmation
    const [sidebarFocusId, setSidebarFocusId] = useState(null); // sidebar-focused notebook in list view

    // SignRequest modal state
    const [signModalOpen, setSignModalOpen] = useState(false);
    const [signSending, setSignSending] = useState(false);

    // External export targets (SignRequest / Nextcloud) — shared hook
    const { signRequestConfigured, nextcloudConfigured } = useExportTargets();

    // Nextcloud export state
    const [nextcloudExporting, setNextcloudExporting] = useState(false);
    const [nextcloudToast, setNextcloudToast] = useState(null);

    // Layout (drawer open/width) is now owned by NotebookWorkspace.

    // Redirect away when the plan doesn't grant notebooks (covers direct nav /
    // stale bookmarks to /app/notebooks). The render gate below returns null in
    // the same condition so nothing flashes before the redirect lands.
    useEffect(() => {
        if (!licensedForNotebooks) onBack?.();
    }, [licensedForNotebooks, onBack]);

    // Table of Contents state (populated by the TipTap TableOfContents extension)
    const [tocItems, setTocItems] = useState([]);
    const [tocOpen, setTocOpen] = useState(false);

    // Sources list + add/delete/retry + processing-poll — shared hook.
    // `onChanged` refreshes the notebook list counts; routed through a ref so the
    // hook can be declared before `fetchNotebooks` (which it depends on).
    const fetchNotebooksRef = useRef(null);
    const onSourcesChanged = useCallback(() => fetchNotebooksRef.current?.(), []);
    const {
        sources, setSources, refreshSources, readySources, totalWords,
        handleFileUpload, handleAddUrl, handleAddText, handleAddMeeting,
        handleDeleteSource, handleRetrySource, handleCancelSource,
        handleRenameSource, handleReorderSources, handleBulkDelete, fetchSourceContent,
    } = useSourcesPolling({ entityId: selected?.id, onError: setError, onChanged: onSourcesChanged });

    // Right-panel resize is now handled inside NotebookWorkspace (useResizableWidth).

    // Chat + model tier state (matches direct chat pattern) — shared hook
    const { modelTiers, selectedTier, setSelectedTier } = useModelTiers();
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef(null);
    const chatContainerRef = useRef(null);

    // Document editor state + save lifecycle — shared hook
    const {
        documentContent, setDocumentContent,
        docSaving, saveState, lastSavedAt,
        handleDocSave, retrySave,
        editorRef,
    } = useDocumentAutosave({ entityId: selected?.id });

    // Citation overlay
    const [citationSource, setCitationSource] = useState(null);

    // Version history panel
    const [versionsOpen, setVersionsOpen] = useState(false);

    const [aiFilling, setAiFilling] = useState(false);

    // Pending selection passed alongside the next chat request. Set by
    // `handleEditorAIAction` right before `sendChatMessage`. The useChatEngine
    // payload builder reads it via `getExtraPayload` and we clear it after
    // sending so it doesn't bleed into the next turn.
    const pendingSelectionRef = useRef(null);

    /* ── useChatEngine — reuses direct chat pattern ──────────── */
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
            customEndpoint: selected ? '/ai/chat/notebook/stream' : undefined,
            getExtraPayload: () => {
                if (!selected) return {};
                const payload = { notebookId: selected.id, documentContent };
                // If the user triggered this turn from the editor's bubble menu
                // (Ask AI / rewrite / shorten / expand), attach the selection so
                // the server can build a dedicated [SELECTED TEXT] block into the
                // system prompt. Single-shot: cleared after one send.
                if (pendingSelectionRef.current) {
                    payload.notebookSelection = pendingSelectionRef.current;
                    pendingSelectionRef.current = null;
                }
                return payload;
            },
        }), [selectedTier, selected?.id, documentContent]),
        onDirectConversationCreated: useCallback(() => {}, []),
        // Notebook-specific callbacks
        onNotebookDocUpdate: useCallback((content, title) => {
            setDocumentContent(content);
            editorRef.current?.setContent?.(content);
        }, []),
        onNotebookSourceAdded: useCallback((source) => {
            // Add the new source to the sources list
            setSources(prev => [...prev, source]);
        }, []),
        // Auto-recover a dropped chat stream: refetch the persisted notebook
        // conversation so the saved AI reply replaces the "interrupted" notice
        // without a manual refresh (mirrors the rehydrate loader below).
        reloadConversation: useCallback(async () => {
            if (!selected?.id) return null;
            const conv = await api(`/${selected.id}/conversation`);
            const hist = Array.isArray(conv?.messages) ? conv.messages : [];
            return hist.map((m, i) => ({
                ...m, // keep tokenisationInfo / pii badge / modelId so the privacy panel survives reload
                id: m.id || `nb-${selected.id}-${i}`,
                role: m.role,
                content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
            }));
        }, [selected?.id]),
    });

    // Auto-scroll chat
    const fileInputRef = useRef(null);

    // Import Document to Editor
    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !selected) return;
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const res = await authFetch(`${API_BASE}/api/notebooks/${selected.id}/import-file`, {
                method: 'POST',
                body: formData
            });
            if (!res.ok) throw new Error('Failed to parse file for import');
            
            const data = await res.json();
            if (data.text && editorRef.current) {
                // TipTap natively parses both HTML and plain-text (with newlines) correctly.
                // We no longer escape HTML tags manually so DOCX formatting is preserved.
                const contentToInsert = data.text;
                editorRef.current.insertContent(contentToInsert);
            }
        } catch (err) {
            setError('Import error: ' + err.message);
        } finally {
            e.target.value = ''; // Reset input
        }
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    /* Model tiers + SignRequest/Nextcloud probes moved to useModelTiers / useExportTargets */

    /* ── Fetch notebooks ─────────────────────────────────────── */
    const didAutoSelect = useRef(false);

    const fetchNotebooks = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api('/');
            const list = data.notebooks || [];
            setNotebooks(list);
            // Auto-select notebook from URL on initial load
            if (initialNotebookId && !didAutoSelect.current) {
                didAutoSelect.current = true;
                const match = list.find(nb => String(nb.id) === String(initialNotebookId));
                if (match) selectNotebook(match);
            }
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }, [initialNotebookId]);

    // Keep the ref current so source-mutation handlers can refresh list counts.
    fetchNotebooksRef.current = fetchNotebooks;

    useEffect(() => { fetchNotebooks(); }, [fetchNotebooks]);

    /* ── Select notebook ─────────────────────────────────────── */
    const selectNotebook = useCallback(async (nb) => {
        try {
            const data = await api(`/${nb.id}`);
            setSelected(data.notebook);
            setSources(data.sources || []);
            // Preprocess mermaid code blocks so they render as diagrams
            const rawContent = data.notebook?.documentContent || '';
            setDocumentContent(preprocessMermaidContent(rawContent));
            // Rehydrate the persistent in-notebook chat history so it survives a
            // notebook switch / page refresh (was previously cleared to []).
            // Falls back to an empty thread if there's none yet or the load fails.
            try {
                const conv = await api(`/${nb.id}/conversation`);
                const hist = Array.isArray(conv?.messages) ? conv.messages : [];
                setChatMessages(hist.map((m, i) => ({
                    ...m, // keep tokenisationInfo / pii badge / modelId so the privacy panel survives reload
                    id: m.id || `nb-${nb.id}-${i}`,
                    role: m.role,
                    content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
                })));
            } catch (_) {
                setChatMessages([]);
            }
            onNotebookChange?.(nb.id);
        } catch (e) { setError(e.message); }
    }, [setChatMessages, onNotebookChange]);

    /* Source polling now lives in useSourcesPolling */

    /* ── Send chat message ───────────────────────────────────── */
    const handleSendMessage = useCallback((text, attachments) => {
        if (!text?.trim() && !attachments?.length) return;
        sendChatMessage(text, attachments);
    }, [sendChatMessage]);

    /* Document save lifecycle (handleDocSave, retrySave, beforeunload, Ctrl+S)
       now lives in useDocumentAutosave */

    /* ── Editor AI action (from TipTap bubble menu) ──────────── */
    const handleEditorAIAction = useCallback((actionKey, selectedText, range, customQuery) => {
        if (!selectedText?.trim()) return;

        // Attach the selection as a structured payload on the NEXT send. The
        // server injects it into the system prompt as [SELECTED TEXT], so the
        // AI sees the exact string to find + an explicit instruction to use
        // notebook_doc_replace. This is much more reliable than embedding a
        // blockquote in the user message (the old approach).
        pendingSelectionRef.current = {
            text: selectedText,
            from: typeof range?.from === 'number' ? range.from : null,
            to: typeof range?.to === 'number' ? range.to : null,
            action: actionKey,
        };

        // Build the user-visible message in the conversation.
        // • rewrite / shorten / expand: keep the message terse — the user just
        //   wants the doc to change, not to see a long quoted block in chat.
        //   The selection is in the system prompt so the AI knows what to edit.
        // • ask: the question is a conversation so the USER should see what text
        //   they're asking about. Include a truncated preview so the chat makes
        //   sense in isolation.
        const PREVIEW_CHARS = 300;
        const selPreview = selectedText.length > PREVIEW_CHARS
            ? selectedText.slice(0, PREVIEW_CHARS).trimEnd() + '…'
            : selectedText;

        const prompts = {
            rewrite: 'Rewrite the selected text. Use notebook_doc_replace to apply the change in place.',
            shorten: 'Shorten the selected text. Use notebook_doc_replace to apply the change in place.',
            expand: 'Expand the selected text with more detail. Use notebook_doc_replace to apply the change in place.',
            // For "ask", show the selection as a labelled quote so the
            // conversation is self-contained and the user can scroll back and
            // understand what was asked about.
            ask: `**Selected text:**\n> ${selPreview.split('\n').join('\n> ')}\n\n${customQuery || 'Analyze this text and provide insights.'}`,
        };
        sendChatMessage(prompts[actionKey] || prompts.ask);
    }, [sendChatMessage]);

    /* ── AI Fill: Replace {{params}} using sources ──────────── */
    const handleAIFill = useCallback(async () => {
        if (!selected || aiFilling) return;
        const html = editorRef.current?.getEditor?.()?.getHTML?.();
        if (!html?.trim()) return;

        // Quick check: does the doc have any {{params}}?
        if (!/\{\{[^}]+\}\}/.test(html)) {
            setError('No {{parameters}} found in the document to fill.');
            return;
        }

        setAiFilling(true);
        try {
            const res = await authFetch(`${API_BASE}/api/notebooks/${selected.id}/ai-fill`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ documentContent: html, modelTier: selectedTier }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'AI Fill failed');
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let filledContent = '';
            let currentEvent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (currentEvent === 'content' && data.text) {
                                filledContent += data.text;
                            } else if (currentEvent === 'error') {
                                throw new Error(data.error || 'AI Fill error');
                            }
                        } catch (e) {
                            if (e.message.includes('Fill') || e.message.includes('error')) throw e;
                        }
                    }
                }
            }

            if (filledContent && editorRef.current) {
                editorRef.current.setMarkdown(filledContent);
                const editor = editorRef.current.getEditor?.();
                if (editor) {
                    const newHtml = editor.getHTML();
                    setDocumentContent(newHtml);
                    handleDocSave(newHtml);
                }
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setAiFilling(false);
        }
    }, [selected, aiFilling, selectedTier, authFetch, handleDocSave]);

    /* ── Insert AI content into document ─────────────────────── */
    const handleInsertToDocument = useCallback((content) => {
        // Convert plain text to simple HTML paragraphs
        const html = content.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('');
        setDocumentContent(prev => prev + html);
    }, [setDocumentContent]);

    /* ── Export (PDF/Word) — uses document content or last chat answer ── */
    const getExportContent = useCallback(() => {
        if (documentContent) return documentContent;
        const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant' && m.content);
        return lastAssistant?.content || '';
    }, [documentContent, chatMessages]);

    const [exporting, setExporting] = useState(null); // 'pdf' | 'docx' | null

    const handleExport = useCallback(async (format) => {
        let content = getExportContent();
        if (!selected || !content) return;
        setExporting(format);
        try {
            // Render mermaid diagrams to images for export
            const mermaidDivRegex = /<div[^>]*data-type="mermaid-diagram"[^>]*data-code="([^"]*?)"[^>]*>.*?<\/div>/gi;
            const mermaidMatches = [...content.matchAll(mermaidDivRegex)];
            let mermaidFailures = 0;

            for (const match of mermaidMatches) {
                let mermaidCode;
                try {
                    mermaidCode = decodeURIComponent(escape(atob(match[1])));
                } catch {
                    mermaidCode = match[1]
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"');
                }
                try {
                    const svg = await renderMermaidToSVG(mermaidCode);
                    if (svg) {
                        const pngDataUrl = await svgToPngDataUrl(svg);
                        if (pngDataUrl) {
                            content = content.replace(match[0], `<div style="text-align:center;margin:16px 0;"><img src="${pngDataUrl}" style="max-width:100%;border-radius:8px;" alt="Diagram" /></div>`);
                        } else {
                            content = content.replace(match[0], `<div style="text-align:center;margin:16px 0;">${svg}</div>`);
                        }
                    }
                } catch (err) {
                    console.error('[Notebooks] Mermaid export render failed:', err);
                    mermaidFailures += 1;
                }
            }

            // Surface diagrams that silently dropped out of the export instead of
            // leaving the user to discover a missing diagram in the PDF/DOCX.
            if (mermaidFailures > 0) {
                toast.error(t('notebooks.export_mermaid_failed',
                    `Exported, but ${mermaidFailures} diagram(s) couldn't be rendered and were skipped.`,
                    { count: mermaidFailures }));
            }

            // Embed all images as base64 data URIs so they export with the document
            content = await embedImagesAsBase64(content);

            // Call server-side export API
            const res = await authFetch(`${API_BASE}/api/notebooks/${selected.id}/export/${format}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, title: selected.name }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Export failed (${res.status})`);
            }

            // Download the file
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const ext = format === 'pdf' ? 'pdf' : 'docx';
            a.download = `${selected.name.replace(/[^a-zA-Z0-9.\-_ ]/g, '_')}.${ext}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) { 
            console.error('[Notebooks] Export failed:', e);
            setError(e.message); 
        } finally {
            setExporting(null);
        }
    }, [selected, getExportContent, authFetch]);

    /* ── Send for Signing (SignRequest) ──────────────────────── */
    const handleSendForSigning = useCallback(async ({ signers, subject, message }) => {
        let content = getExportContent();
        if (!selected || !content) return null;
        setSignSending(true);
        try {
            // Embed images for export
            content = await embedImagesAsBase64(content);

            const res = await authFetch(`${API_BASE}/api/notebooks/${selected.id}/export/signrequest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, title: selected.name, signers, subject, message }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `SignRequest failed (${res.status})`);
            }

            const data = await res.json();
            return data;
        } catch (e) {
            console.error('[Notebooks] SignRequest failed:', e);
            setError(e.message);
            return null;
        } finally {
            setSignSending(false);
        }
    }, [selected, getExportContent, authFetch]);

    /* ── Export to Nextcloud (PDF → WebDAV) ──────────────────── */
    const handleNextcloudExport = useCallback(async () => {
        let content = getExportContent();
        if (!selected || !content) return;
        setNextcloudExporting(true);
        setNextcloudToast(null);
        try {
            content = await embedImagesAsBase64(content);
            const res = await authFetch(`${API_BASE}/api/notebooks/${selected.id}/export/nextcloud`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, title: selected.name }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
            setNextcloudToast({
                type: 'success',
                message: `Saved to Nextcloud: ${data.path}`,
                folderUrl: data.folderUrl || null,
            });
            setTimeout(() => setNextcloudToast(null), 6000);
        } catch (e) {
            console.error('[Notebooks] Nextcloud export failed:', e);
            setError(e.message);
        } finally {
            setNextcloudExporting(false);
        }
    }, [selected, getExportContent, authFetch]);

    /* ── Create notebook ─────────────────────────────────────── */
    const handleCreate = async () => {
        const name = newName.trim();
        if (!name) return;
        try {
            console.log('[Notebooks] Creating notebook:', name);
            setCreating(true);
            const data = await api('/', { 
                method: 'POST', 
                body: JSON.stringify({ name }) 
            });
            console.log('[Notebooks] Created:', data);
            setNewName('');
            await fetchNotebooks();
            if (data.notebook) {
                await selectNotebook(data.notebook);
            }
        } catch (e) { 
            console.error('[Notebooks] Create failed:', e);
            setError(e.message); 
        } finally { 
            setCreating(false); 
        }
    };

    /* ── Delete notebook ─────────────────────────────────────── */
    // Opens the Studio-style confirmation modal. The actual delete runs in
    // confirmDeleteNotebook below — separated so the modal pattern matches
    // SkillsStudio exactly.
    const handleDelete = (id) => {
        const nb = notebooks.find(n => n.id === id);
        if (nb) setPendingDelete(nb);
    };

    const confirmDeleteNotebook = async () => {
        const nb = pendingDelete;
        if (!nb?.id) return;
        try {
            await api(`/${nb.id}`, { method: 'DELETE' });
            if (selected?.id === nb.id) { setSelected(null); setSources([]); }
            fetchNotebooks();
            setPendingDelete(null);
        } catch (e) { setError(e.message); setPendingDelete(null); }
    };

    /* ── Rename notebook ─────────────────────────────────────── */
    const handleRename = async (id) => {
        if (!renameValue.trim()) return;
        try {
            await api(`/${id}`, { method: 'PUT', body: JSON.stringify({ name: renameValue.trim() }) });
            if (selected?.id === id) setSelected(prev => ({ ...prev, name: renameValue.trim() }));
            fetchNotebooks();
        } catch (e) { setError(e.message); }
        setRenamingId(null);
    };

    /* Source add/delete/retry/cancel handlers now live in useSourcesPolling */

    /* ── Filtered notebooks ──────────────────────────────────── */
    const filtered = notebooks.filter(nb =>
        nb.name.toLowerCase().includes(search.toLowerCase())
    );
    const hasExportContent = !!getExportContent();

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    /* ── Permission gate — must come before any render ─────── */
    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    // Not entitled by plan/tier → render nothing; the effect above redirects.
    if (!licensedForNotebooks) return null;
    if (!canUseNotebooks) {
        return (
            <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-center p-8 rounded-2xl border max-w-md" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                        <AlertCircle className="w-7 h-7" style={{ color: 'rgb(239, 68, 68)' }} />
                    </div>
                    <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Notebooks disabled</h2>
                    <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Your role doesn't include access to notebooks. Ask an administrator to grant the &quot;Use Notebooks&quot; permission.</p>
                    {onBack && <button onClick={onBack} className="px-4 py-2 rounded-lg font-medium text-white" style={{ background: 'var(--accent-primary)' }}>Go back</button>}
                </div>
            </div>
        );
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    /* ── NOTEBOOK DETAIL VIEW (3-panel: Sources + Editor + Studio/Chat) */
    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    if (selected) {
        const showMeetingNotes = user?.featureFlags?.meeting_notes !== false && (user?.isAdmin || user?.permissions?.includes('all') || (Array.isArray(user?.betaFeatures) && user.betaFeatures.includes('meeting_notes')));
        const detailMeta = `${sources.length} ${sources.length !== 1 ? t('notebooks.sources', 'Sources').toLowerCase() : 'source'} · ${totalWords.toLocaleString()} ${t('notebooks.words', 'words').toLowerCase()} · ${t('notebooks.created', 'Created')} ${timeAgo(selected.createdAt)}`;
        const commandContext = {
            editorRef,
            onExport: handleExport,
            hasExportContent,
            signRequestConfigured,
            onSign: () => setSignModalOpen(true),
            nextcloudConfigured,
            onNextcloud: handleNextcloudExport,
            onVersions: () => setVersionsOpen(true),
        };
        return (
            <>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleImportFile}
                    accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx"
                />
                <NotebookWorkspace
                    variant="notebook"
                    icon={BookOpen}
                    title={selected.name}
                    meta={detailMeta}
                    onBack={() => { setSelected(null); setSources([]); setChatMessages([]); setDocumentContent(''); }}
                    saveState={saveState}
                    lastSavedAt={lastSavedAt}
                    onRetrySave={retrySave}
                    headerExtras={[
                        { id: 'toc', icon: BookOpen, label: tocItems.length > 0 ? t('notebooks.toggle_toc', 'Toggle Table of Contents') : t('notebooks.toc_hint', 'Add headings to enable Table of Contents'), active: tocOpen, disabled: tocItems.length === 0, onClick: () => setTocOpen(p => !p) },
                        { id: 'versions', icon: History, label: t('notebooks.version_history', 'Version history'), active: versionsOpen, onClick: () => setVersionsOpen(p => !p) },
                    ]}
                    headerActions={
                        <ExportMenu
                            onExport={handleExport}
                            exporting={exporting}
                            hasContent={hasExportContent}
                            signRequestConfigured={signRequestConfigured}
                            onSignRequest={() => setSignModalOpen(true)}
                            nextcloudConfigured={nextcloudConfigured}
                            onNextcloudExport={handleNextcloudExport}
                            nextcloudExporting={nextcloudExporting}
                        />
                    }
                    leftDrawer={{
                        label: t('notebooks.sources', 'Sources'),
                        node: (
                            <NotebookSources
                                sources={sources}
                                onFileUpload={(files) => handleFileUpload(Array.from(files))}
                                onAddUrl={(url) => { if (url?.trim()) handleAddUrl(url); }}
                                onAddText={(text, name) => { if (text?.trim()) handleAddText(text, name); }}
                                onAddMeeting={handleAddMeeting}
                                onDeleteSource={handleDeleteSource}
                                onRetrySource={handleRetrySource}
                                onCancelSource={handleCancelSource}
                                onRenameSource={handleRenameSource}
                                onReorderSources={handleReorderSources}
                                onBulkDelete={handleBulkDelete}
                                onPreviewSource={fetchSourceContent}
                                dragOver={dragOver}
                                setDragOver={setDragOver}
                                totalWords={totalWords}
                                readyCount={readySources.length}
                                showMeetingNotes={showMeetingNotes}
                            />
                        ),
                    }}
                    secondaryLeft={tocOpen && (
                        <div className="w-[200px] shrink-0 border-r flex flex-col overflow-hidden" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                            <NotebookTOC items={tocItems} onClose={() => setTocOpen(false)} />
                        </div>
                    )}
                    rightDrawer={{
                        label: t('notebooks.ai_chat', 'AI Chat'),
                        node: (
                            <NotebookChat
                                messages={chatMessages}
                                isLoading={chatLoading}
                                onSend={handleSendMessage}
                                onStop={stopChatGenerating}
                                onRetry={retryChatMessage}
                                onEdit={editAndRegenerateChat}
                                modelTiers={modelTiers}
                                selectedTier={selectedTier}
                                onTierChange={setSelectedTier}
                                onInsertToDocument={handleInsertToDocument}
                                onCitationClick={(source) => setCitationSource(source)}
                            />
                        ),
                    }}
                    commandContext={commandContext}
                    banners={
                        <>
                            {error && (
                                <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 rounded-xl border bg-red-50 border-red-200 text-red-700 text-xs" style={{ animation: 'slideDown .2s ease-out' }}>
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span className="flex-1">{error}</span>
                                    <button onClick={() => setError(null)} className="font-bold text-sm leading-none">&times;</button>
                                </div>
                            )}
                            {nextcloudToast && (
                                <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs"
                                    style={{ background: 'rgba(0,130,201,0.08)', borderColor: 'rgba(0,130,201,0.25)', color: '#0082C9', animation: 'slideDown .2s ease-out' }}>
                                    <span className="flex-1">{nextcloudToast.message}</span>
                                    {nextcloudToast.folderUrl && (
                                        <a href={nextcloudToast.folderUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">Open folder</a>
                                    )}
                                    <button onClick={() => setNextcloudToast(null)} className="font-bold text-sm leading-none">&times;</button>
                                </div>
                            )}
                        </>
                    }
                    overlays={
                        <>
                            <CitationOverlay source={citationSource} onClose={() => setCitationSource(null)} />
                            <SendForSigningModal
                                open={signModalOpen}
                                onClose={() => setSignModalOpen(false)}
                                onSend={handleSendForSigning}
                                sending={signSending}
                                notebookTitle={selected?.name}
                            />
                            {versionsOpen && selected && (
                                <NotebookVersions
                                    notebookId={selected.id}
                                    currentContent={documentContent}
                                    onRestore={(content) => {
                                        if (editorRef.current?.setContent) editorRef.current.setContent(content);
                                        setDocumentContent(content);
                                        handleDocSave(content);
                                    }}
                                    onClose={() => setVersionsOpen(false)}
                                />
                            )}
                        </>
                    }
                >
                    <RichTextEditor
                        engine={shouldUseNewEditor(user, 'notebooks') ? 'bf' : 'tiptap'}
                        ref={editorRef}
                        onImportClick={() => fileInputRef.current?.click()}
                        content={documentContent}
                        onChange={setDocumentContent}
                        onSave={handleDocSave}
                        onAIAction={handleEditorAIAction}
                        onAIFill={handleAIFill}
                        aiFilling={aiFilling}
                        saving={docSaving}
                        onTocUpdate={setTocItems}
                        notebookId={selected?.id}
                    />
                </NotebookWorkspace>
            </>
        );
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    /* ── NOTEBOOK LIST VIEW (Studio-aligned: sidebar + detail) ─ */
    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    const focusedNotebook = filtered.find(n => n.id === sidebarFocusId) || null;
    const stripHtml = (html) => {
        if (!html) return '';
        if (typeof document === 'undefined') return '';
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
    };
    const focusedPreview = focusedNotebook
        ? (focusedNotebook.preview || stripHtml(focusedNotebook.documentContent).slice(0, 480))
        : '';

    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            {/* ─── Top header (Studio-style) ─── */}
            <div className="shrink-0 px-6 py-3 border-b flex items-center gap-4" style={{ borderColor: 'var(--border-default)' }}>
                <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
                    <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Notebooks</h1>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Upload sources, chat with your documents, and generate content</p>
                </div>
            </div>

            {error && (
                <div className="mx-6 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-red-50 border-red-200 text-red-700 text-sm" style={{ animation: 'slideDown .2s ease-out' }}>
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError(null)} className="font-bold text-lg leading-none">&times;</button>
                </div>
            )}

            {/* ─── Body: Studio sidebar + detail pane ─── */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Sidebar — list of all notebooks (single source of truth) */}
                <aside className="w-72 flex-shrink-0 border-r flex flex-col" style={{ borderColor: 'var(--border-default)' }}>
                    <div className="px-3 py-2.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-default)' }}>
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search…"
                                className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-1"
                                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                            />
                        </div>
                        <button
                            onClick={() => { setNewName(''); setSidebarFocusId('__new__'); }}
                            title="New notebook"
                            className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)]"
                            style={{ color: 'var(--accent-primary)' }}
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5">
                        {loading && <div className="text-xs p-3" style={{ color: 'var(--text-tertiary)' }}>…</div>}
                        {!loading && filtered.length === 0 && (
                            <div className="text-xs p-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
                                {search ? 'No matches' : 'No notebooks yet'}
                            </div>
                        )}
                        {filtered.map((nb) => {
                            const isFocused = sidebarFocusId === nb.id;
                            return (
                                <div
                                    key={nb.id}
                                    onClick={() => setSidebarFocusId(nb.id)}
                                    onDoubleClick={() => selectNotebook(nb)}
                                    title="Click to preview · Double-click to open"
                                    className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm transition ${isFocused
                                        ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}
                                >
                                    <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate">{nb.name}</div>
                                        <div className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                                            {(nb.sourceCount || 0)} src · {timeAgo(nb.updatedAt || nb.createdAt)}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(nb.id); }}
                                        title="Delete notebook"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </aside>

                {/* Detail pane — empty state OR new-notebook form OR focused-notebook preview */}
                <section className="flex-1 min-w-0 overflow-y-auto" style={{ background: 'var(--bg-secondary)' }}>
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--text-muted)' }} />
                        </div>
                    ) : sidebarFocusId === '__new__' ? (
                        <div className="h-full flex flex-col items-center justify-center px-6">
                            <div className="w-full max-w-md">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-xl border-[1.5px] flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                                        <Plus className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>New notebook</h2>
                                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Give it a name to get started</p>
                                    </div>
                                </div>
                                <input
                                    autoFocus
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleCreate();
                                        if (e.key === 'Escape') { setSidebarFocusId(null); setNewName(''); }
                                    }}
                                    placeholder="Notebook name…"
                                    className="w-full px-4 py-3 text-base rounded-xl border-[1.5px] focus:outline-none transition-colors focus:border-[var(--accent-primary)]"
                                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                                />
                                <div className="flex items-center justify-end gap-2 mt-4">
                                    <button
                                        onClick={() => { setSidebarFocusId(null); setNewName(''); }}
                                        className="px-4 py-2 rounded-full text-sm hover:bg-[var(--bg-tertiary)]"
                                        style={{ color: 'var(--text-secondary)' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCreate}
                                        disabled={!newName.trim() || creating}
                                        className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-40"
                                        style={{ background: 'var(--accent-primary)' }}
                                    >
                                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        Create notebook
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : !focusedNotebook ? (
                        <div className="h-full flex flex-col items-center justify-center px-6 py-12">
                            <BookOpen size={36} className="mb-4" style={{ color: 'var(--accent-primary)', opacity: 0.5 }} />
                            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                                {filtered.length === 0 && !search ? 'Create your first notebook' : 'Pick a notebook'}
                            </h3>
                            <p className="text-sm max-w-md text-center leading-relaxed mb-6" style={{ color: 'var(--text-tertiary)' }}>
                                {filtered.length === 0 && !search
                                    ? 'Upload PDFs, documents, and URLs — then chat with your sources and generate summaries, briefings, and more.'
                                    : 'Click a notebook in the sidebar to preview it, or create a new one.'}
                            </p>
                            <button
                                onClick={() => { setNewName(''); setSidebarFocusId('__new__'); }}
                                className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-white"
                                style={{ background: 'var(--accent-primary)' }}
                            >
                                <Plus size={15} /> New notebook
                            </button>
                        </div>
                    ) : (
                        // ─── Focused notebook preview (Studio "editor pane" equivalent) ───
                        <div className="flex flex-col h-full">
                            {/* Header: icon tile + name + meta + actions */}
                            <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                                <div className="w-12 h-12 rounded-xl border-[1.5px] flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                                    <BookOpen className="w-6 h-6" style={{ color: 'var(--brand-primary)' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    {renamingId === focusedNotebook.id ? (
                                        <input
                                            autoFocus
                                            value={renameValue}
                                            onChange={e => setRenameValue(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleRename(focusedNotebook.id);
                                                if (e.key === 'Escape') setRenamingId(null);
                                            }}
                                            onBlur={() => handleRename(focusedNotebook.id)}
                                            className="w-full text-lg font-bold bg-transparent outline-none border-b-[1.5px] focus:border-[var(--accent-primary)]"
                                            style={{ color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
                                        />
                                    ) : (
                                        <h2
                                            className="text-lg font-bold truncate cursor-text"
                                            style={{ color: 'var(--text-primary)' }}
                                            onDoubleClick={() => { setRenamingId(focusedNotebook.id); setRenameValue(focusedNotebook.name); }}
                                            title="Double-click to rename"
                                        >
                                            {focusedNotebook.name}
                                        </h2>
                                    )}
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                        {(focusedNotebook.sourceCount || 0)} source{(focusedNotebook.sourceCount || 0) !== 1 ? 's' : ''}
                                        {focusedNotebook.messageCount > 0 && ` · ${focusedNotebook.messageCount} message${focusedNotebook.messageCount !== 1 ? 's' : ''}`}
                                        {' · '}Updated {timeAgo(focusedNotebook.updatedAt || focusedNotebook.createdAt)}
                                    </p>
                                </div>
                                <div className="flex-shrink-0 flex items-center gap-2">
                                    <button
                                        onClick={() => { setRenamingId(focusedNotebook.id); setRenameValue(focusedNotebook.name); }}
                                        title="Rename"
                                        className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(focusedNotebook.id)}
                                        title="Delete notebook"
                                        className="p-2 rounded-lg hover:bg-red-500/10 hover:text-red-500"
                                        style={{ color: 'var(--text-tertiary)' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => selectNotebook(focusedNotebook)}
                                        className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-white"
                                        style={{ background: 'var(--accent-primary)' }}
                                    >
                                        Open notebook <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Body: preview + quick stats */}
                            <div className="flex-1 overflow-auto px-6 py-6">
                                <div className="max-w-3xl">
                                    {/* Stats row */}
                                    <div className="grid grid-cols-3 gap-3 mb-6">
                                        <StatCard
                                            label="Sources"
                                            value={focusedNotebook.sourceCount || 0}
                                            icon={FileText}
                                        />
                                        <StatCard
                                            label="Messages"
                                            value={focusedNotebook.messageCount || 0}
                                            icon={ClipboardList}
                                        />
                                        <StatCard
                                            label="Created"
                                            value={new Date(focusedNotebook.createdAt).toLocaleDateString()}
                                            icon={History}
                                            small
                                        />
                                    </div>

                                    {/* Preview */}
                                    <div className="rounded-xl border-[1.5px] p-5" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                                        <div className="text-[11px] uppercase font-semibold tracking-wide mb-2" style={{ color: 'var(--text-tertiary)' }}>
                                            Document preview
                                        </div>
                                        {focusedPreview ? (
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                                                {focusedPreview}
                                                {focusedPreview.length >= 480 && '…'}
                                            </p>
                                        ) : (
                                            <p className="text-sm italic" style={{ color: 'var(--text-tertiary)' }}>
                                                This notebook is empty. Open it to add sources and start writing.
                                            </p>
                                        )}
                                    </div>

                                    {/* Hint */}
                                    <p className="mt-4 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
                                        Tip: double-click any notebook in the sidebar to open it directly.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            <style>{`@keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            {/* ─── Delete confirmation modal (Studio pattern) ─── */}
            {pendingDelete && (
                <div
                    className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4"
                    onClick={() => setPendingDelete(null)}
                >
                    <div
                        className="rounded-xl w-full max-w-md shadow-xl border"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
                            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Delete notebook</div>
                            <button onClick={() => setPendingDelete(null)} className="hover:text-[var(--text-primary)]" style={{ color: 'var(--text-tertiary)' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Delete <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{pendingDelete.name}</span> and all its sources? This can't be undone.
                        </div>
                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t" style={{ borderColor: 'var(--border-default)' }}>
                            <button
                                onClick={() => setPendingDelete(null)}
                                className="px-4 py-2 rounded-full text-sm hover:bg-[var(--bg-secondary)]"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteNotebook}
                                className="px-4 py-2 rounded-full text-sm bg-red-500 text-white hover:bg-red-600"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Version history overlay is rendered by NotebookWorkspace in the
                detail view (where versionsOpen is actually toggled). */}

        </div>
    );
}

/* ── StatCard — small stat tile for the notebook preview pane ─── */
function StatCard({ label, value, icon: Icon, small = false }) {
    return (
        <div
            className="rounded-xl border-[1.5px] px-4 py-3 flex items-center gap-3"
            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}
        >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-1)' }}>
                <Icon className="w-4 h-4" style={{ color: 'var(--brand-primary)' }} />
            </div>
            <div className="min-w-0">
                <div className={`font-bold truncate ${small ? 'text-sm' : 'text-lg'}`} style={{ color: 'var(--text-primary)' }}>
                    {value}
                </div>
                <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                    {label}
                </div>
            </div>
        </div>
    );
}
