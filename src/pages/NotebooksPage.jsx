import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    ArrowLeft, Plus, FileText, Trash2,
    BookOpen, Loader2, AlertCircle, CheckCircle2, Search,
    X, ChevronRight, Pencil, Download, HelpCircle,
    ClipboardList, ListChecks, PanelLeft, History
} from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import useChatEngine from '../hooks/useChatEngine';
import NotebookEditor from './notebooks/NotebookEditor';
import NotebookChat from './notebooks/NotebookChat';
import NotebookStudio from './notebooks/NotebookStudio';
import NotebookSources from './notebooks/NotebookSources';
import NotebookTOC from './notebooks/NotebookTOC';
import NotebookVersions from './notebooks/NotebookVersions';
import CitationOverlay from './notebooks/CitationOverlay';
import NotebookCard from './notebooks/components/NotebookCard';

import GenerationOverlay from './notebooks/GenerationOverlay';
import SendForSigningModal from './notebooks/SendForSigningModal';
import { preprocessMermaidContent } from './notebooks/MermaidExtension';
import { renderMermaidToSVG, svgToPngDataUrl } from './notebooks/MermaidBlock';

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

/* ── Embed images as base64 for export (PDF/Word) ────────────── */
async function embedImagesAsBase64(html) {
    // Find all <img> tags and extract their src
    const imgRegex = /<img([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi;
    const matches = [...html.matchAll(imgRegex)];

    const replacements = await Promise.allSettled(
        matches.map(async (match) => {
            const [fullMatch, before, src, after] = match;
            // Skip already-embedded base64 images
            if (src.startsWith('data:')) return { fullMatch, newTag: fullMatch };

            try {
                // Resolve relative URLs
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
                // Preserve width from data-width attribute or style
                let widthStyle = '';
                const widthMatch = (before + after).match(/data-width=["'](\d+)["']/);
                const styleMatch = (before + after).match(/style=["']([^"']*?width[^"']*?)["']/);
                if (widthMatch) {
                    widthStyle = ` style="width:${widthMatch[1]}px;height:auto;max-width:100%"`;
                } else if (styleMatch) {
                    widthStyle = ` style="${styleMatch[1]}"`;
                }
                return {
                    fullMatch,
                    newTag: `<img src="${dataUrl}"${widthStyle} alt="" />`
                };
            } catch (err) {
                console.warn('[Export] Failed to embed image:', src, err.message);
                return { fullMatch, newTag: fullMatch }; // Keep original on failure
            }
        })
    );

    let result = html;
    for (const r of replacements) {
        if (r.status === 'fulfilled') {
            result = result.replace(r.value.fullMatch, r.value.newTag);
        }
    }
    return result;
}

/* ── Source type metadata ─────────────────────────────────────── */
/* Shared with NotebookSources.jsx — keep in sync */
const SOURCE_META = {
    pdf:      { icon: '📄', color: '#ef4444', label: 'PDF' },
    docx:     { icon: '📝', color: '#3b82f6', label: 'Word' },
    xlsx:     { icon: '📊', color: '#22c55e', label: 'Excel' },
    csv:      { icon: '📊', color: '#22c55e', label: 'CSV' },
    text:     { icon: '📋', color: '#8b5cf6', label: 'Text' },
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

/* ── API helpers ──────────────────────────────────────────────── */
async function api(path, opts = {}) {
    const url = `${API_BASE}/api/notebooks${path === '/' ? '' : path}`;
    const res = await authFetch(url, {
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        ...opts,
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('[Notebooks] API error:', res.status, data);
        throw new Error(data.error || `API ${res.status}`);
    }
    return res.json();
}

async function uploadSourceFile(notebookId, file) {
    const form = new FormData();
    form.append('file', file);
    const res = await authFetch(`${API_BASE}/api/notebooks/${notebookId}/sources/file`, {
        method: 'POST',
        body: form,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
}



/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export default function NotebooksPage({ user, onBack, initialNotebookId, onNotebookChange }) {
    // Permission gate — matches the server-side `use_notebooks` router guard.
    // The result is used near the end of the component so hook order isn't disturbed.
    const canUseNotebooks = !!(user?.permissions?.includes('all') || user?.permissions?.includes('use_notebooks'));

    const [notebooks, setNotebooks] = useState([]);
    const [selected, setSelected] = useState(null);
    const [sources, setSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    const [newName, setNewName] = useState('');
    const [search, setSearch] = useState('');
    const [error, setError] = useState(null);
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [dragOver, setDragOver] = useState(false);

    // SignRequest modal state
    const [signModalOpen, setSignModalOpen] = useState(false);
    const [signSending, setSignSending] = useState(false);
    const [signRequestConfigured, setSignRequestConfigured] = useState(false);

    // Layout states
    const [leftPanelOpen, setLeftPanelOpen] = useState(true);
    const [rightPanelWidth, setRightPanelWidth] = useState(320);
    const rightPanelDragRef = useRef(false);

    // Aborts the current Studio generation SSE when the user navigates away
    // or clicks "Cancel". Prevents state updates on an unmounted component and
    // stops the server from burning tokens on a generation nobody will see.
    const generationAbortRef = useRef(null);
    useEffect(() => () => { generationAbortRef.current?.abort?.(); }, []);

    // Table of Contents state (populated by the TipTap TableOfContents extension)
    const [tocItems, setTocItems] = useState([]);
    const [tocOpen, setTocOpen] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!rightPanelDragRef.current) return;
            // The right panel is bounded by the right edge of the screen
            const newWidth = document.body.clientWidth - e.clientX;
            setRightPanelWidth(Math.max(250, Math.min(newWidth, 800)));
        };
        const handleMouseUp = () => {
            if (rightPanelDragRef.current) {
                rightPanelDragRef.current = false;
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
    }, []);


    // Chat + model tier state (matches direct chat pattern)
    const [selectedTier, setSelectedTier] = useState('auto');
    const [modelTiers, setModelTiers] = useState({});
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef(null);
    const chatContainerRef = useRef(null);

    // Document editor state
    const [documentContent, setDocumentContent] = useState('');
    const [docSaving, setDocSaving] = useState(false);
    // Three save states: 'idle' (nothing pending), 'saving' (PUT in flight),
    // 'error' (last PUT failed — retry scheduled or waiting for user).
    const [saveState, setSaveState] = useState('idle');
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const pendingContentRef = useRef(null);
    const retryTimerRef = useRef(null);
    const editorRef = useRef(null);

    // Citation overlay
    const [citationSource, setCitationSource] = useState(null);

    // Version history panel
    const [versionsOpen, setVersionsOpen] = useState(false);

    // Studio generation state
    const [generating, setGenerating] = useState(null);
    const [aiFilling, setAiFilling] = useState(false);

    // Last generated content for export
    const [lastGeneratedContent, setLastGeneratedContent] = useState('');

    // Generation overlay & history
    const [generationHistory, setGenerationHistory] = useState([]);
    const [activeGeneration, setActiveGeneration] = useState(null);

    // Pending selection passed alongside the next chat request. Set by
    // `handleEditorAIAction` right before `sendChatMessage`. The useChatEngine
    // payload builder reads it via `getExtraPayload` and we clear it after
    // sending so it doesn't bleed into the next turn.
    const pendingSelectionRef = useRef(null);

    /* ── useChatEngine — reuses direct chat pattern ──────────── */
    const { messages: chatMessages, setMessages: setChatMessages, isLoading: chatLoading,
        sendMessage: sendChatMessage, stopGenerating: stopChatGenerating,
        retryMessage: retryChatMessage, editAndRegenerate: editAndRegenerateChat,
        submittedFormIds, setSubmittedFormIds
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

    /* ── Load model tiers ────────────────────────────────────── */
    useEffect(() => {
        authFetch(`${API_BASE}/ai/config/chat-models`)
            .then(r => r.ok ? r.json() : {})
            .then(data => setModelTiers(data))
            .catch(() => {});
    }, []);

    /* ── Check SignRequest config ────────────────────────────── */
    useEffect(() => {
        authFetch(`${API_BASE}/ai/user-settings`)
            .then(r => r.ok ? r.json() : {})
            .then(data => setSignRequestConfigured(!!data.hasSignRequestConfig))
            .catch(() => {});
    }, []);

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
            setChatMessages([]);
            setLastGeneratedContent('');
            onNotebookChange?.(nb.id);
        } catch (e) { setError(e.message); }
    }, [setChatMessages, onNotebookChange]);

    /* ── Poll processing sources ─────────────────────────────── */
    useEffect(() => {
        if (!selected) return;
        const hasProcessing = sources.some(s => s.status === 'processing');
        if (!hasProcessing) return;
        const interval = setInterval(async () => {
            try {
                const data = await api(`/${selected.id}/sources`);
                setSources(data.sources || []);
            } catch {}
        }, 3000);
        return () => clearInterval(interval);
    }, [selected, sources]);

    /* ── Send chat message ───────────────────────────────────── */
    const handleSendMessage = useCallback((text, attachments) => {
        if (!text?.trim() && !attachments?.length) return;
        sendChatMessage(text, attachments);
    }, [sendChatMessage]);

    /* ── Save document content ───────────────────────────────── */
    // Tracks three states and retries once on failure. A second failure leaves
    // the indicator in 'error' and the user can click Retry.
    const handleDocSave = useCallback(async (html, { isRetry = false } = {}) => {
        if (!selected) return;
        pendingContentRef.current = html;
        if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
        setDocSaving(true);
        setSaveState('saving');
        try {
            await api(`/${selected.id}`, { method: 'PUT', body: JSON.stringify({ documentContent: html }) });
            pendingContentRef.current = null;
            setSaveState('idle');
            setLastSavedAt(Date.now());
        } catch (e) {
            console.error('[Notebooks] Doc save failed:', e);
            setSaveState('error');
            if (!isRetry) {
                retryTimerRef.current = setTimeout(() => {
                    if (pendingContentRef.current !== null) handleDocSave(pendingContentRef.current, { isRetry: true });
                }, 5000);
            }
        } finally {
            setDocSaving(false);
        }
    }, [selected]);

    // Warn the user before closing the tab if a save is still pending.
    useEffect(() => {
        if (saveState === 'idle') return;
        const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [saveState]);

    // Cmd/Ctrl+S bypasses the editor's 2s debounce and saves immediately.
    useEffect(() => {
        const onKey = (e) => {
            const metaS = (e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S');
            if (!metaS || !selected) return;
            e.preventDefault();
            const editor = editorRef.current?.getEditor?.();
            const html = editor?.getHTML?.() ?? documentContent;
            handleDocSave(html);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selected, documentContent, handleDocSave]);

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
    }, []);

    /* ── Studio: Generate content → inject into TipTap document ── */
    const handleGenerate = useCallback(async (type) => {
        if (!selected || generating) return;
        setGenerating(type);
        setLastGeneratedContent('');

        // Add a user message and a placeholder assistant response in chat
        const label = type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const userMsg = { id: `gen-user-${Date.now()}`, role: 'user', content: `Generate ${label} from my sources` };
        const assistantMsg = { id: `gen-asst-${Date.now()}`, role: 'assistant', content: `⏳ Generating ${label}...` };
        setChatMessages(prev => [...prev, userMsg, assistantMsg]);

        generationAbortRef.current?.abort?.();
        const abortController = new AbortController();
        generationAbortRef.current = abortController;
        try {
            const res = await authFetch(`${API_BASE}/api/notebooks/${selected.id}/generate/${type}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelTier: selectedTier, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
                signal: abortController.signal,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Generation failed');
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let content = '';
            let currentEvent = '';
            let audioFiles = [];

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
                                content += data.text;
                                // Don't update chat during streaming to prevent flickering
                            } else if (currentEvent === 'audio' && data.url) {
                                // Collect audio files to render via AudioPlayer in chat
                                audioFiles.push({
                                    url: data.url,
                                    mimeType: data.mimeType || 'audio/mpeg',
                                    source: data.source || 'elevenlabs_tts',
                                });
                            } else if (currentEvent === 'error') {
                                throw new Error(data.error || 'Generation error');
                            }
                        } catch (e) {
                            if (e.message.includes('Generation') || e.message.includes('error')) throw e;
                        }
                    }
                }
            }
            setLastGeneratedContent(content);

            // Update chat with final content. Study-aid types (flashcards, studyGuide,
            // quiz) were removed — all remaining types insert into the document.
            setChatMessages(prev => prev.map(m =>
                m.id === assistantMsg.id ? {
                    ...m,
                    content: `✅ ${label} generated and inserted into the document.`,
                } : m
            ));

            // Save to generation history and open overlay
            const genEntry = {
                id: `gen-${Date.now()}`,
                type,
                label,
                content,
                audioFiles: audioFiles.length > 0 ? audioFiles : undefined,
                timestamp: new Date().toISOString(),
            };
            setGenerationHistory(prev => [...prev, genEntry]);
            setActiveGeneration(genEntry);

            // Preprocess mermaid content and insert into the TipTap editor
            // Skip insertion for study aid types — they only show in the overlay
            if (content && editorRef.current && !isStudyAid) {
                const processed = preprocessMermaidContent(content);
                editorRef.current.setContent(processed);
                // Trigger a save of the new document content
                const editor = editorRef.current.getEditor?.();
                if (editor) {
                    const html = editor.getHTML();
                    setDocumentContent(html);
                    handleDocSave(html);
                }
            }
        } catch (e) {
            // Silently swallow aborts — the user cancelled or navigated away.
            if (e.name === 'AbortError') {
                setChatMessages(prev => prev.map(m =>
                    m.id?.startsWith('gen-asst-') && m.content?.startsWith('⏳') ? { ...m, content: `⏹️ Generation cancelled.` } : m
                ));
            } else {
                setError(e.message);
                setChatMessages(prev => prev.map(m =>
                    m.id?.startsWith('gen-asst-') && m.content?.startsWith('⏳') ? { ...m, content: `❌ Generation failed: ${e.message}` } : m
                ));
            }
        } finally {
            setGenerating(null);
            if (generationAbortRef.current === abortController) generationAbortRef.current = null;
        }
    }, [selected, generating, selectedTier, setChatMessages, handleDocSave]);

    const cancelGeneration = useCallback(() => {
        generationAbortRef.current?.abort?.();
    }, []);

    /* ── Export (PDF/Word) — uses document content or last generated ── */
    const getExportContent = useCallback(() => {
        if (documentContent) return documentContent;
        if (lastGeneratedContent) return lastGeneratedContent;
        const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant' && m.content);
        return lastAssistant?.content || '';
    }, [documentContent, lastGeneratedContent, chatMessages]);

    const [exporting, setExporting] = useState(null); // 'pdf' | 'docx' | null

    const handleExport = useCallback(async (format) => {
        let content = getExportContent();
        if (!selected || !content) return;
        setExporting(format);
        try {
            // Render mermaid diagrams to images for export
            const mermaidDivRegex = /<div[^>]*data-type="mermaid-diagram"[^>]*data-code="([^"]*?)"[^>]*>.*?<\/div>/gi;
            const mermaidMatches = [...content.matchAll(mermaidDivRegex)];
            
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
                }
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
    const handleDelete = async (id) => {
        if (!confirm('Delete this notebook and all its sources?')) return;
        try {
            await api(`/${id}`, { method: 'DELETE' });
            if (selected?.id === id) { setSelected(null); setSources([]); }
            fetchNotebooks();
        } catch (e) { setError(e.message); }
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

    /* ── Add sources ─────────────────────────────────────────── */
    const handleFileUpload = async (files) => {
        if (!files?.length || !selected) return;
        for (const file of files) {
            try { await uploadSourceFile(selected.id, file); }
            catch (err) { setError(`Failed to upload ${file.name}: ${err.message}`); }
        }
        const data = await api(`/${selected.id}/sources`);
        setSources(data.sources || []);
        fetchNotebooks();
    };

    const handleAddUrl = async (url) => {
        if (!url?.trim() || !selected) return;
        try {
            await api(`/${selected.id}/sources/url`, { method: 'POST', body: JSON.stringify({ url: url.trim() }) });
            const data = await api(`/${selected.id}/sources`);
            setSources(data.sources || []);
            fetchNotebooks();
        } catch (e) { setError(e.message); }
    };

    const handleAddText = async (text, name) => {
        if (!text?.trim() || !selected) return;
        try {
            await api(`/${selected.id}/sources/text`, { method: 'POST', body: JSON.stringify({ text: text.trim(), name: name?.trim() || undefined }) });
            const data = await api(`/${selected.id}/sources`);
            setSources(data.sources || []);
            fetchNotebooks();
        } catch (e) { setError(e.message); }
    };

    const handleAddMeeting = async (meetingId) => {
        if (!meetingId || !selected) return;
        try {
            await api(`/${selected.id}/sources/meeting`, { method: 'POST', body: JSON.stringify({ meetingId }) });
            const data = await api(`/${selected.id}/sources`);
            setSources(data.sources || []);
            fetchNotebooks();
        } catch (e) { setError(e.message); }
    };

    const handleDeleteSource = async (sid) => {
        if (!selected) return;
        try {
            await api(`/${selected.id}/sources/${sid}`, { method: 'DELETE' });
            setSources(prev => prev.filter(s => s.id !== sid));
            fetchNotebooks();
        } catch (e) { setError(e.message); }
    };

    // Retry re-runs server-side ingestion. The row immediately flips back to
    // "processing" so the UI shows the shimmer without waiting for the next poll.
    const handleRetrySource = async (sid) => {
        if (!selected) return;
        try {
            await api(`/${selected.id}/sources/${sid}/retry`, { method: 'POST' });
            setSources(prev => prev.map(s => s.id === sid ? { ...s, status: 'processing', error: null } : s));
        } catch (e) { setError(e.message); }
    };

    // Cancel marks a stuck `processing` row as errored so the user can delete
    // it (or retry) without waiting for the 10-min server watchdog to fire.
    const handleCancelSource = async (sid) => {
        if (!selected) return;
        try {
            await api(`/${selected.id}/sources/${sid}/cancel`, { method: 'POST' });
            setSources(prev => prev.map(s => s.id === sid ? { ...s, status: 'error', error: 'Cancelled by user' } : s));
        } catch (e) { setError(e.message); }
    };

    /* ── Filtered notebooks ──────────────────────────────────── */
    const filtered = notebooks.filter(nb =>
        nb.name.toLowerCase().includes(search.toLowerCase())
    );
    const readySources = sources.filter(s => s.status === 'ready');
    const totalWords = sources.reduce((s, src) => s + (src.wordCount || 0), 0);
    const hasExportContent = !!getExportContent();

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    /* ── Permission gate — must come before any render ─────── */
    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
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
        return (
            <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleImportFile} 
                    accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx" 
                />
                
                {/* ── Header ── */}
                <div className="shrink-0 px-5 py-3 border-b flex items-center gap-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
                    {/* Back */}
                    <button
                        onClick={() => { setSelected(null); setSources([]); setChatMessages([]); setDocumentContent(''); }}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"
                        title="Back to Notebooks"
                    >
                        <ArrowLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                    </button>

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-[15px] font-semibold truncate" style={{ color: 'var(--text-primary)' }} title={selected.name}>
                                {selected.name}
                            </h2>
                            {saveState === 'saving' && (
                                <span className="flex items-center gap-1 text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                                    <Loader2 className="w-3 h-3 animate-spin" />Saving…
                                </span>
                            )}
                            {saveState === 'error' && (
                                <button
                                    onClick={() => pendingContentRef.current && handleDocSave(pendingContentRef.current)}
                                    className="flex items-center gap-1 text-[10px] text-red-500 hover:underline shrink-0"
                                    title="Click to retry"
                                >
                                    <AlertCircle className="w-3 h-3" />Save failed — retry
                                </button>
                            )}
                            {saveState === 'idle' && lastSavedAt && (Date.now() - lastSavedAt < 4000) && (
                                <span className="flex items-center gap-1 text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                                    <CheckCircle2 className="w-3 h-3" />Saved
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                            {sources.length} source{sources.length !== 1 ? 's' : ''} · {totalWords.toLocaleString()} words · Created {timeAgo(selected.createdAt)}
                        </p>
                    </div>

                    {/* Layout toggles */}
                    <div className="flex items-center gap-0.5 shrink-0 pr-2 mr-1 border-r" style={{ borderColor: 'var(--border-subtle)' }}>
                        <button
                            onClick={() => setLeftPanelOpen(p => !p)}
                            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                            title="Toggle Sources"
                            style={{ background: leftPanelOpen ? 'var(--brand-gradient-soft)' : 'transparent' }}
                        >
                            <PanelLeft className="w-4 h-4" style={{ color: leftPanelOpen ? 'var(--brand-primary)' : 'var(--text-secondary)' }} />
                        </button>
                        <button
                            onClick={() => setTocOpen(p => !p)}
                            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                            title={tocItems.length > 0 ? 'Toggle Table of Contents' : 'Add headings to enable Table of Contents'}
                            style={{ background: tocOpen ? 'var(--brand-gradient-soft)' : 'transparent' }}
                        >
                            <BookOpen className="w-4 h-4" style={{ color: tocOpen ? 'var(--brand-primary)' : tocItems.length > 0 ? 'var(--text-secondary)' : 'var(--text-tertiary)' }} />
                        </button>
                        <button
                            onClick={() => setVersionsOpen(p => !p)}
                            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                            title="Version History"
                            style={{ background: versionsOpen ? 'var(--brand-gradient-soft)' : 'transparent' }}
                        >
                            <History className="w-4 h-4" style={{ color: versionsOpen ? 'var(--brand-primary)' : 'var(--text-secondary)' }} />
                        </button>
                    </div>

                    <NotebookStudio
                        onGenerate={handleGenerate}
                        generating={generating}
                        onExport={handleExport}
                        exporting={exporting}
                        hasContent={hasExportContent}
                        readySourceCount={readySources.length}
                        generationCount={generationHistory.length}
                        onHistoryClick={() => {
                            if (generationHistory.length > 0) {
                                setActiveGeneration(generationHistory[generationHistory.length - 1]);
                            }
                        }}
                        signRequestConfigured={signRequestConfigured}
                        onSignRequest={() => setSignModalOpen(true)}

                    />
                </div>

                {/* ── Error toast ── */}
                {error && (
                    <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 rounded-xl border bg-red-50 border-red-200 text-red-700 text-xs" style={{ animation: 'slideDown .2s ease-out' }}>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="flex-1">{error}</span>
                        <button onClick={() => setError(null)} className="font-bold text-sm leading-none">&times;</button>
                    </div>
                )}

                {/* ── 3-Panel Layout: Sources | Editor | Studio+Chat ── */}
                <div className="flex-1 flex overflow-hidden">

                    {/* ═══ LEFT: Sources Panel ═══ */}
                    {leftPanelOpen && (
                    <div className="w-[180px] xl:w-[240px] shrink-0 border-r flex flex-col overflow-hidden" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                        <NotebookSources
                                sources={sources}
                                onFileUpload={(files) => handleFileUpload(Array.from(files))}
                                onAddUrl={(url) => { if (url?.trim()) handleAddUrl(url); }}
                                onAddText={(text, name) => { if (text?.trim()) handleAddText(text, name); }}
                                onAddMeeting={handleAddMeeting}
                                onDeleteSource={handleDeleteSource}
                                onRetrySource={handleRetrySource}
                                onCancelSource={handleCancelSource}
                                dragOver={dragOver}
                                setDragOver={setDragOver}
                                totalWords={totalWords}
                                readyCount={readySources.length}
                                showMeetingNotes={user?.featureFlags?.meeting_notes !== false && (user?.isAdmin || user?.permissions?.includes('all') || (Array.isArray(user?.betaFeatures) && user.betaFeatures.includes('meeting_notes')))}
                            />

                    </div>
                    )}

                    {/* ═══ TOC Panel (collapsible, between sources and editor) ═══ */}
                    {tocOpen && (
                        <div
                            className="w-[200px] shrink-0 border-r flex flex-col overflow-hidden"
                            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
                        >
                            <NotebookTOC items={tocItems} onClose={() => setTocOpen(false)} />
                        </div>
                    )}

                    {/* ═══ CENTER: Document Editor (TipTap) ═══ */}
                    <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--bg-primary)' }}>
                        <NotebookEditor
                            ref={editorRef}
                            onImportClick={() => fileInputRef.current?.click()}
                            content={documentContent}
                            onChange={setDocumentContent}
                            onSave={handleDocSave}
                            onAIAction={handleEditorAIAction}
                            onAIFill={handleAIFill}
                            aiFilling={aiFilling}
                            saving={docSaving}
                            generating={generating}
                            onTocUpdate={setTocItems}
                            notebookId={selected?.id}
                        />
                    </div>

                    {/* ═══ RIGHT: Studio (top) + AI Chat (bottom) ═══ */}
                    <div 
                        className="w-[4px] hover:bg-[var(--accent-primary)] cursor-col-resize transition-colors shrink-0 z-10 -ml-[2px]"
                        style={{ borderLeft: '1px solid var(--border-subtle)' }}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            rightPanelDragRef.current = true;
                            document.body.style.cursor = 'col-resize';
                            document.body.style.userSelect = 'none';
                        }}
                    />
                    <div className="shrink-0 flex flex-col overflow-hidden" style={{ width: rightPanelWidth, background: 'var(--bg-primary)' }}>
                        {/* Chat section */}
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
                                submittedFormIds={submittedFormIds}
                                setSubmittedFormIds={setSubmittedFormIds}
                                onInsertToDocument={handleInsertToDocument}
                                onCitationClick={(source) => setCitationSource(source)}
                            />
                        </div>
                    </div>
                </div>

                {/* Citation overlay */}
                <CitationOverlay source={citationSource} onClose={() => setCitationSource(null)} />

                {/* Generation overlay */}
                <GenerationOverlay
                    generation={activeGeneration}
                    history={generationHistory}
                    onClose={() => setActiveGeneration(null)}
                    onSelectHistory={(item) => setActiveGeneration(item)}
                    onSourceClick={(sourceName) => {
                        // Close overlay and try to highlight the matching source in sidebar
                        setActiveGeneration(null);
                        // Flash the source in the sources panel — find by partial name match
                        const matchingSource = sources.find(s =>
                            s.name?.toLowerCase().includes(sourceName.toLowerCase()) ||
                            sourceName.toLowerCase().includes(s.name?.toLowerCase())
                        );
                        if (matchingSource) {
                            // Scroll to the source element in the sidebar
                            setTimeout(() => {
                                const el = document.querySelector(`[data-source-id="${matchingSource.id}"]`);
                                if (el) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    el.style.transition = 'background 0.3s';
                                    el.style.background = 'var(--accent-primary)';
                                    el.style.opacity = '0.15';
                                    setTimeout(() => { el.style.background = ''; el.style.opacity = ''; }, 2000);
                                }
                            }, 300);
                        }
                    }}
                    onInsertToDocument={(content) => {
                        if (editorRef.current) {
                            const processed = preprocessMermaidContent(content);
                            editorRef.current.setContent(processed);
                            const editor = editorRef.current.getEditor?.();
                            if (editor) {
                                const html = editor.getHTML();
                                setDocumentContent(html);
                                handleDocSave(html);
                            }
                        }
                    }}
                />

                {/* SignRequest Modal */}
                <SendForSigningModal
                    open={signModalOpen}
                    onClose={() => setSignModalOpen(false)}
                    onSend={handleSendForSigning}
                    sending={signSending}
                    notebookTitle={selected?.name}
                />
            </div>
        );
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    /* ── NOTEBOOK LIST VIEW ──────────────────────────────────── */
    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <div className="shrink-0 px-6 py-4 border-b flex items-center gap-4" style={{ borderColor: 'var(--border-subtle)' }}>
                <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
                    <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Notebooks</h1>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Upload sources, chat with your documents, and generate content</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notebooks..."
                            className="pl-8 pr-3 py-1.5 text-sm rounded-lg border w-48 focus:outline-none focus:ring-1"
                            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }} />
                    </div>
                    <div className="flex gap-2">
                        <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()}
                            placeholder="New notebook name..."
                            className="px-3 py-1.5 text-sm rounded-lg border w-48 focus:outline-none focus:ring-1"
                            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }} />
                        <button onClick={handleCreate} disabled={!newName.trim() || creating}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-40"
                            style={{ background: 'var(--brand-gradient)' }}>
                            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Create
                        </button>

                    </div>
                </div>
            </div>

            {error && (
                <div className="mx-6 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-red-50 border-red-200 text-red-700 text-sm" style={{ animation: 'slideDown .2s ease-out' }}>
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button onClick={() => setError(null)} className="font-bold text-lg leading-none">&times;</button>
                </div>
            )}

            <div className="flex-1 overflow-auto p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--text-muted)' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center max-w-sm">
                            <div
                                className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                                style={{ background: 'var(--brand-gradient-soft)' }}
                            >
                                <BookOpen className="w-10 h-10" style={{ color: 'var(--brand-primary)', opacity: 0.8 }} />
                            </div>
                            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                                {search ? 'No notebooks found' : 'Create your first notebook'}
                            </h3>
                            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                                {search ? 'Try a different search' : 'Upload PDFs, documents, and URLs — then chat with your sources and generate summaries, study guides, and more.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div
                        className="max-w-6xl mx-auto grid gap-5"
                        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
                    >
                        {filtered.map(nb => (
                            <NotebookCard
                                key={nb.id}
                                nb={nb}
                                renamingId={renamingId}
                                renameValue={renameValue}
                                setRenameValue={setRenameValue}
                                setRenamingId={setRenamingId}
                                onRename={handleRename}
                                onDelete={handleDelete}
                                onSelect={selectNotebook}
                                timeAgo={timeAgo}
                            />
                        ))}
                    </div>
                )}
            </div>
            <style>{`@keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            {/* ═══ Version History Overlay ═══ */}
            {versionsOpen && selected && (
                <NotebookVersions
                    notebookId={selected.id}
                    currentContent={documentContent}
                    onRestore={(content) => {
                        if (editorRef.current?.setContent) {
                            editorRef.current.setContent(content);
                        }
                        setDocumentContent(content);
                        handleDocSave(content);
                    }}
                    onClose={() => setVersionsOpen(false)}
                />
            )}


        </div>
    );
}
