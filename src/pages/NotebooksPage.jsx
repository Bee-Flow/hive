import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BookOpen, AlertCircle, History } from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import { notebookApi as api } from './notebooks/hooks/notebookApi';
import useModelTiers from './notebooks/hooks/useModelTiers';
import useExportTargets from './notebooks/hooks/useExportTargets';
import useSourcesPolling from './notebooks/hooks/useSourcesPolling';
import useDocumentAutosave from './notebooks/hooks/useDocumentAutosave';
import useNotebookList from './notebooks/hooks/useNotebookList';
import useChatEngine from '../hooks/useChatEngine';
import useRelativeTime from '../hooks/useRelativeTime';
import RichTextEditor from '../editor/react/RichTextEditor.jsx';
import NotebookChat from './notebooks/NotebookChat';
import ExportMenu from './notebooks/ExportMenu';
import NotebookSources from './notebooks/NotebookSources';
import NotebookWorkspace from './notebooks/NotebookWorkspace';
import NotebookTOC from './notebooks/NotebookTOC';
import NotebookVersions from './notebooks/NotebookVersions';
import CitationOverlay from './notebooks/CitationOverlay';
import NotebooksOverview from './notebooks/overview/NotebooksOverview';

import SendForSigningModal from './notebooks/SendForSigningModal';
import { renderMermaidToSVG, svgToPngDataUrl } from './notebooks/MermaidBlock';
import { embedImagesAsBase64 } from '../utils/imageEmbedding';
import { useLicenseContext } from '../components/LicenseContext';
import { toast } from '../components/shared/Toast';
import useTranslation from '../hooks/useTranslation';

/* API helpers (`api`, `uploadSourceFile`) live in ./notebooks/hooks/notebookApi */

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
    const { t, locale } = useTranslation();
    const rel = useRelativeTime();

    // Overview list state — owned HERE (not in NotebooksOverview) so search/
    // sort/filter/page survive while the editor branch is mounted.
    const list = useNotebookList();

    const [selected, setSelected] = useState(null);
    // Mirror of `selected` for async callbacks that outlive a render (AI Fill,
    // chat stream events): reading `selected` there closes over a stale value.
    const selectedRef = useRef(null);
    useEffect(() => { selectedRef.current = selected; }, [selected]);
    // The notebook the in-flight chat turn belongs to.
    const streamNotebookRef = useRef(null);
    const chatLoadingRef = useRef(false);

    const [error, setError] = useState(null);
    const [dragOver, setDragOver] = useState(false);

    // SignRequest modal state
    const [signModalOpen, setSignModalOpen] = useState(false);
    const [signSending, setSignSending] = useState(false);
    const [signError, setSignError] = useState(null);

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

    // Table of Contents state (populated by the editor's heading scan)
    const [tocItems, setTocItems] = useState([]);
    const [tocOpen, setTocOpen] = useState(false);

    // Sources list + add/delete/retry + processing-poll — shared hook.
    // `onChanged` refreshes the overview card counts; routed through a ref so
    // list-refetch identity churn (search/sort changes) never rebuilds the
    // source handlers.
    const listRefetchRef = useRef(list.refetch);
    useEffect(() => { listRefetchRef.current = list.refetch; }, [list.refetch]);
    const onSourcesChanged = useCallback(() => listRefetchRef.current?.(), []);
    const {
        sources, setSources, readySources, totalWords,
        handleFileUpload, handleAddUrl, handleAddText, handleAddMeeting,
        handleDeleteSource, handleRetrySource, handleCancelSource,
        handleRenameSource, handleReorderSources, handleBulkDelete, fetchSourceContent,
    } = useSourcesPolling({ entityId: selected?.id, onError: setError, onChanged: onSourcesChanged });

    // Right-panel resize is now handled inside NotebookWorkspace (useResizableWidth).

    // Chat + model tier state (matches direct chat pattern) — shared hook
    const { modelTiers, selectedTier, setSelectedTier } = useModelTiers();
    const chatEndRef = useRef(null);

    // Encrypted chat history without a session DEK: the thread exists but can't
    // be decrypted right now. NotebookChat shows a banner instead of implying
    // an empty conversation.
    const [chatLocked, setChatLocked] = useState(false);

    // Live word count of the DOCUMENT, reported by the editor. The header used
    // to sum per-source words instead, showing "0 words" over a full document.
    const [docWords, setDocWords] = useState(0);

    // Someone else (other tab, AI tool) saved first; the hook reloaded the
    // server copy and resynced — all that's left is telling the user.
    const onConflict = useCallback(() => {
        toast.error(t('notebooks.doc_conflict', 'Document was updated elsewhere — reloaded'));
    }, [t]);

    // Document editor state + save lifecycle — shared hook
    const {
        documentContent, setDocumentContent,
        docSaving, saveState, lastSavedAt, dirty,
        handleDocSave, retrySave, markDirty, setKnownVersion,
        editorRef,
    } = useDocumentAutosave({ entityId: selected?.id, initialVersion: selected?.version, onConflict });

    // The editor debounces for 2 s before it even asks for a save, so the
    // unload guard has to learn about the edit here. markDirty was defined and
    // exported but never called by anyone, leaving dirtyRef permanently false
    // and the beforeunload guard dead code.
    const handleEditorChange = useCallback((html) => {
        markDirty();
        setDocumentContent(html);
    }, [markDirty, setDocumentContent]);

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
                // Remember which notebook this turn belongs to, so late stream
                // events can be matched against the notebook that is open when
                // they arrive.
                streamNotebookRef.current = selected.id;
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
        // Notebook-specific callbacks.
        // Both are guarded on the notebook the stream was started for: they had
        // empty deps and no id check, so an AI document update for notebook A
        // arriving after a switch was written into notebook B's editor, and A's
        // new source appeared in B's source list.
        onNotebookDocUpdate: useCallback((content, title, version) => {
            if (selectedRef.current?.id !== streamNotebookRef.current) return;
            setDocumentContent(content);
            editorRef.current?.setContent?.(content);
            // AI doc writes go through CAS server-side; adopting the version
            // they carry keeps the next autosave from a false 409.
            if (version != null) setKnownVersion(version);
        }, [setDocumentContent, setKnownVersion]),
        onNotebookSourceAdded: useCallback((source) => {
            if (selectedRef.current?.id !== streamNotebookRef.current) return;
            setSources(prev => [...prev, source]);
        }, []),
        // Server backstop: the store refused to persist the turn over a locked
        // (undecryptable) history — lock the composer here too.
        onHistoryLocked: useCallback(() => {
            if (selectedRef.current?.id !== streamNotebookRef.current) return;
            setChatLocked(true);
        }, []),
        // Auto-recover a dropped chat stream: refetch the persisted notebook
        // conversation so the saved AI reply replaces the "interrupted" notice
        // without a manual refresh (mirrors the rehydrate loader below).
        reloadConversation: useCallback(async () => {
            if (!selected?.id) return null;
            const conv = await api(`/${selected.id}/conversation`);
            setChatLocked(!!conv?.locked);
            const hist = Array.isArray(conv?.messages) ? conv.messages : [];
            return hist.map((m, i) => ({
                ...m, // keep tokenisationInfo / pii badge / modelId so the privacy panel survives reload
                id: m.id || `nb-${selected.id}-${i}`,
                role: m.role,
                content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
            }));
        }, [selected?.id]),
    });

    useEffect(() => { chatLoadingRef.current = chatLoading; }, [chatLoading]);

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
                // insertContent sniffs the payload itself (HTML → htmlToAst,
                // otherwise markdown), so DOCX formatting survives the import.
                editorRef.current.insertContent(data.text);
            }
        } catch (err) {
            setError(t('notebooks.import_error', { message: err.message }));
        } finally {
            e.target.value = ''; // Reset input
        }
    };

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    /* Model tiers + SignRequest/Nextcloud probes moved to useModelTiers / useExportTargets */

    /* ── Select notebook ─────────────────────────────────────── */
    // Generation counter: two sequential awaits below mean a slow response for
    // notebook A can land AFTER the user has already opened notebook B, mixing
    // A's document with B's chat. Every setter is gated on still being the
    // newest selection.
    const selectGenRef = useRef(0);
    const selectNotebook = useCallback(async (nb, opts = {}) => {
        const gen = ++selectGenRef.current;
        const isStale = () => selectGenRef.current !== gen;
        // Abort any in-flight reply first. The engine only aborted on unmount,
        // and switching notebooks doesn't unmount this page — so the stream kept
        // running against a message id that no longer existed (every token was
        // dropped) while the Stop button stayed live forever.
        if (chatLoadingRef.current) { try { stopChatGenerating?.(); } catch (_) { /* noop */ } }
        // "Open chat" from a card: NotebookWorkspace reads its drawer state
        // from localStorage on mount (useDrawerState), so flipping the key
        // before the workspace mounts opens the chat drawer without any new
        // shell plumbing.
        if (opts.focusChat) {
            try { localStorage.setItem('bf.workspace.notebook.rightOpen', '1'); } catch (_) { /* private mode */ }
        }
        // View state belonging to the outgoing notebook.
        setError(null);
        setCitationSource(null);
        setVersionsOpen(false);
        setTocOpen(false);
        try {
            const data = await api(`/${nb.id}`);
            if (isStale()) return;
            setSelected(data.notebook);
            setSources(data.sources || []);
            // Mermaid needs no pre-pass: the editor's md/html parsers turn both
            // ```mermaid fences and legacy <div data-type="mermaid-diagram">
            // into mermaid nodes natively.
            setDocumentContent(data.notebook?.documentContent || '');
            // Rehydrate the persistent in-notebook chat history so it survives a
            // notebook switch / page refresh (was previously cleared to []).
            // Falls back to an empty thread if there's none yet or the load fails.
            try {
                const conv = await api(`/${nb.id}/conversation`);
                if (isStale()) return;
                setChatLocked(!!conv?.locked);
                const hist = Array.isArray(conv?.messages) ? conv.messages : [];
                setChatMessages(hist.map((m, i) => ({
                    ...m, // keep tokenisationInfo / pii badge / modelId so the privacy panel survives reload
                    id: m.id || `nb-${nb.id}-${i}`,
                    role: m.role,
                    content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
                })));
            } catch (_) {
                if (isStale()) return;
                setChatLocked(false);
                setChatMessages([]);
            }
            if (isStale()) return;
            onNotebookChange?.(nb.id);
        } catch (e) {
            // Stay on the grid — a toast beats a banner that belongs to a view
            // we never reached (deep links to deleted/foreign ids land here).
            if (!isStale()) toast.error(e.message);
        }
    }, [setChatMessages, onNotebookChange, setDocumentContent, stopChatGenerating]);

    /* ── Deep link: /app/notebooks/:id ───────────────────────── */
    // Direct fetch via selectNotebook — no list lookup, so ids beyond the
    // first page (or not matching the current filter) resolve too.
    const didAutoSelect = useRef(false);
    useEffect(() => {
        if (!initialNotebookId || didAutoSelect.current) return;
        didAutoSelect.current = true;
        selectNotebook({ id: initialNotebookId });
    }, [initialNotebookId, selectNotebook]);

    /* Source polling now lives in useSourcesPolling */

    /* ── Send chat message ───────────────────────────────────── */
    const handleSendMessage = useCallback((text, attachments) => {
        if (!text?.trim() && !attachments?.length) return;
        sendChatMessage(text, attachments);
    }, [sendChatMessage]);

    /* Document save lifecycle (handleDocSave, retrySave, beforeunload, Ctrl+S)
       now lives in useDocumentAutosave */

    /* ── Editor AI action (from the editor bubble menu) ──────── */
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
            setError(t('notebooks.ai_fill_no_params', 'No {{parameters}} found in the document to fill.'));
            return;
        }

        // The fill streams for seconds; the user can open another notebook in
        // that time. Capture the target and verify it before writing, or the
        // shared editor gets notebook A's filled document while showing B —
        // and the next keystroke persists it into B.
        const fillFor = selected.id;
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
                        // Two failure modes are deliberately distinguished:
                        // a malformed SSE frame (skip it — the stream may
                        // recover) versus a real `event: error` from the server
                        // (abort and surface it). This used to decide between
                        // them by sniffing the message text for "Fill"/"error",
                        // so a backend error like "Rate limit exceeded" was
                        // swallowed and AI Fill just quietly did nothing.
                        let data;
                        try { data = JSON.parse(line.slice(6)); }
                        catch (_) { continue; }   // not JSON yet / partial frame
                        if (currentEvent === 'content' && data.text) {
                            filledContent += data.text;
                        } else if (currentEvent === 'error') {
                            const err = new Error(data.error || 'AI Fill failed');
                            err.__aiFill = true;
                            throw err;
                        }
                    }
                }
            }

            // A stream that ends without content is a failure too — it used to
            // fall through silently, leaving the user staring at an unchanged
            // document with no indication anything went wrong.
            if (!filledContent.trim()) {
                throw new Error(t('notebooks.ai_fill_no_content', 'AI Fill returned no content. Please try again.'));
            }

            if (selectedRef.current?.id !== fillFor) return;   // switched away mid-stream

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
            if (selectedRef.current?.id === fillFor) setError(e.message);
        } finally {
            setAiFilling(false);
        }
    }, [selected, aiFilling, selectedTier, authFetch, handleDocSave, setDocumentContent, t]);

    /* ── Insert AI content into document ─────────────────────── */
    const handleInsertToDocument = useCallback((content) => {
        // Convert plain text to simple HTML paragraphs
        const html = content.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('');
        // Insert THROUGH the editor. Pushing straight into `documentContent`
        // looks identical on screen but is an external content swap: BeeEditor
        // reloads the doc without emitting an update, so no save is ever
        // scheduled — and it cancels the pending save for whatever the user
        // typed just before. The insert (and that typing) were lost on the next
        // notebook switch.
        const editor = editorRef.current;
        if (editor?.insertContent) { editor.insertContent(html); return; }
        setDocumentContent((prev) => {
            const next = (prev || '') + html;
            handleDocSave(next);
            return next;
        });
    }, [setDocumentContent, handleDocSave]);

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
                    // base64 → UTF-8 without the deprecated escape() detour.
                    mermaidCode = new TextDecoder().decode(Uint8Array.from(atob(match[1]), c => c.charCodeAt(0)));
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
            // Surface it INSIDE the modal. setError renders into the banner
            // slot, which sits behind this modal's backdrop — so the user saw
            // the dialog just sit there with no explanation.
            setSignError(e.message);
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

    /* Create / rename / delete / search now live in useNotebookList +
       NotebooksOverview */

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
                    <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{t('notebooks.disabled_title', 'Notebooks disabled')}</h2>
                    <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{t('notebooks.disabled_body', 'Your role does not include access to notebooks. Ask an administrator to grant the "Use Notebooks" permission.')}</p>
                    {onBack && <button onClick={onBack} className="px-4 py-2 rounded-lg font-medium text-white" style={{ background: 'var(--accent-primary)' }}>{t('notebooks.go_back', 'Go back')}</button>}
                </div>
            </div>
        );
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    /* ── NOTEBOOK DETAIL VIEW (3-panel: Sources + Editor + Studio/Chat) */
    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    if (selected) {
        const showMeetingNotes = user?.featureFlags?.meeting_notes !== false && (user?.isAdmin || user?.permissions?.includes('all') || (Array.isArray(user?.betaFeatures) && user.betaFeatures.includes('meeting_notes')));
        const detailMeta = `${sources.length} ${t('notebooks.sources', 'Sources').toLowerCase()} · ${docWords.toLocaleString(locale)} ${t('notebooks.words', 'Words').toLowerCase()} · ${t('notebooks.created', 'Created')} ${rel(selected.createdAt)}`;
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
                    onBack={() => {
                        setSelected(null);
                        setSources([]);
                        setChatMessages([]);
                        setDocumentContent('');
                        setDocWords(0);
                        setChatLocked(false);
                        // Card counts/preview/activity changed while editing.
                        list.refetch();
                    }}
                    saveState={saveState}
                    lastSavedAt={lastSavedAt}
                    onRetrySave={retrySave}
                    dirty={dirty}
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
                                locked={chatLocked}
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
                                        <a href={nextcloudToast.folderUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">{t('notebooks.open_folder', 'Open folder')}</a>
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
                                error={signError}
                                onClearError={() => setSignError(null)}
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
                        ref={editorRef}
                        onImportClick={() => fileInputRef.current?.click()}
                        content={documentContent}
                        onChange={handleEditorChange}
                        onSave={handleDocSave}
                        onAIAction={handleEditorAIAction}
                        onAIFill={handleAIFill}
                        aiFilling={aiFilling}
                        saving={docSaving}
                        onTocUpdate={setTocItems}
                        onWordCountChange={setDocWords}
                        notebookId={selected?.id}
                    />
                </NotebookWorkspace>
            </>
        );
    }

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    /* ── NOTEBOOK OVERVIEW (card grid) ────────────────────────── */
    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    return (
        <NotebooksOverview
            list={list}
            onBack={onBack}
            onOpen={selectNotebook}
            onOpenChat={(nb) => selectNotebook(nb, { focusChat: true })}
        />
    );
}
