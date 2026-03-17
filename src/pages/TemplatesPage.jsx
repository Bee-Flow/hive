import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';
import {
    ArrowLeft, Upload, FileText, Trash2, Pencil, Check, X,
    Loader2, Search, Download, Bot, Sparkles, ChevronDown, File, Plus, Settings, BookOpen, ChevronRight,
    MessageSquare
} from 'lucide-react';
import useChatEngine from '../hooks/useChatEngine';
import MessageItem from '../components/chat/MessageItem';
import InputArea from '../components/InputArea';
import KnowledgePanel from '../components/KnowledgePanel';

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

// Normalize parameter — supports both string "Name" and { name, description } formats
function getParam(p) {
    if (typeof p === 'string') return { name: p, description: '' };
    return { name: p.name || p, description: p.description || '' };
}

export default function TemplatesPage({ user, onBack }) {
    // Template list state
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Upload state
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    // Rename state
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState('');

    // Delete state
    const [deletingId, setDeletingId] = useState(null);

    // AI Fill view state
    const [fillTemplate, setFillTemplate] = useState(null); // template being filled
    const [meetingNotes, setMeetingNotes] = useState([]);
    const [selectedNoteIds, setSelectedNoteIds] = useState([]);
    const [showNotesPicker, setShowNotesPicker] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [parameterizing, setParameterizing] = useState(false);
    const [skipAiDetection, setSkipAiDetection] = useState(false);

    // Template settings state
    const [showSettings, setShowSettings] = useState(false);
    const [editInstructions, setEditInstructions] = useState('');
    const [savingInstructions, setSavingInstructions] = useState(false);

    // Chat state
    const [selectedChatTier, setSelectedChatTier] = useState('auto');
    const [modelTiers, setModelTiers] = useState({});
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef(null);
    const chatContainerRef = useRef(null);

    // useChatEngine — routes through dedicated template chat endpoint
    const { messages: chatMessages, setMessages: setChatMessages, isLoading: chatLoading, sendMessage: sendChatMessage, stopGenerating: stopChatGenerating, retryMessage: retryChatMessage, editAndRegenerate: editAndRegenerateChat, submittedFormIds, setSubmittedFormIds } = useChatEngine({
        selectedAgent: null,
        currentConversation: null,
        onConversationCreated: useCallback(() => {}, []),
        getWorkspacePayload: useCallback(() => ({}), []),
        onWorkspaceUpdate: useCallback(() => {}, []),
        directMode: useMemo(() => ({
            enabled: true,
            modelTier: selectedChatTier,
            customEndpoint: fillTemplate ? '/ai/chat/template/stream' : undefined,
            getExtraPayload: () => fillTemplate ? {
                templateId: fillTemplate.id,
                meetingNoteIds: selectedNoteIds,
            } : {},
        }), [selectedChatTier, fillTemplate?.id, selectedNoteIds]),
        onDirectConversationCreated: useCallback(() => {}, []),
    });

    // Load templates
    const loadTemplates = useCallback(async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/templates`);
            if (res.ok) {
                const data = await res.json();
                setTemplates(data.templates || []);
            }
        } catch (err) {
            console.error('Failed to load templates:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadTemplates(); }, [loadTemplates]);

    // Load model tiers
    useEffect(() => {
        authFetch(`${API_BASE}/ai/config/chat-models`)
            .then(r => r.ok ? r.json() : {})
            .then(data => setModelTiers(data))
            .catch(() => {});
    }, []);

    // Load meeting notes for context picker
    useEffect(() => {
        authFetch(`${API_BASE}/ai/chat/template/meeting-notes`)
            .then(r => r.ok ? r.json() : { notes: [] })
            .then(data => setMeetingNotes(data.notes || []))
            .catch(() => {});
    }, []);

    // Reset chat when changing template + detect if still processing
    useEffect(() => {
        setChatMessages([]);
        setChatInput('');
        setSelectedNoteIds([]);
        if (fillTemplate) {
            setEditInstructions(fillTemplate.instructions || '');

            // Auto-detect if this template is still being processed
            // (0 parameters AND no description = AI is still working)
            const isStillProcessing = fillTemplate.parameters.length === 0 && !fillTemplate.description;
            if (isStillProcessing) {
                setParameterizing(true);
                const templateId = fillTemplate.id;
                let polls = 0;
                const processingPoller = setInterval(async () => {
                    polls++;
                    if (polls > 30) { clearInterval(processingPoller); setParameterizing(false); return; }
                    try {
                        const r = await authFetch(`${API_BASE}/api/templates/${templateId}`);
                        if (r.ok) {
                            const { template: updated } = await r.json();
                            if (updated?.parameters?.length > 0 || updated?.description) {
                                setFillTemplate(prev => prev?.id === templateId ? { ...prev, ...updated } : prev);
                                if (updated.instructions) setEditInstructions(updated.instructions);
                                if (updated.parameters?.length > 0) setParameterizing(false);
                                await loadTemplates();
                                if (updated.parameters?.length > 0 && updated.description && updated.instructions) {
                                    clearInterval(processingPoller);
                                }
                            }
                        }
                    } catch {}
                }, 3000);
                return () => clearInterval(processingPoller);
            } else {
                setParameterizing(false);
            }
        }
    }, [fillTemplate?.id]);

    // Auto-generate document when AI outputs a JSON block with parameter values
    const processedJsonMsgIds = useRef(new Set());
    useEffect(() => {
        if (!fillTemplate || chatLoading) return;
        const lastMsg = chatMessages[chatMessages.length - 1];
        if (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.isStreaming) return;
        if (processedJsonMsgIds.current.has(lastMsg.id)) return;

        // Check for JSON code block
        const jsonMatch = lastMsg.content?.match(/```json\s*\n([\s\S]*?)\n```/);
        if (!jsonMatch) return;

        try {
            const values = JSON.parse(jsonMatch[1]);
            if (!values || typeof values !== 'object') return;

            // Mark as processed
            processedJsonMsgIds.current.add(lastMsg.id);

            // Auto-generate document
            (async () => {
                // Add a generating message
                const genMsgId = `gen-${Date.now()}`;
                setChatMessages(prev => [...prev, {
                    id: genMsgId,
                    role: 'assistant',
                    content: '⏳ Generating your document...',
                    isSystem: true,
                }]);

                try {
                    const res = await authFetch(`${API_BASE}/api/templates/${fillTemplate.id}/fill-and-store`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ values }),
                    });

                    if (res.ok) {
                        const { downloadUrl, fileName } = await res.json();
                        const fullDownloadUrl = downloadUrl.startsWith('http') ? downloadUrl : `${API_BASE}${downloadUrl}`;
                        
                        // Trigger authenticated download immediately
                        try {
                            const dlRes = await authFetch(fullDownloadUrl);
                            if (dlRes.ok) {
                                const blob = await dlRes.blob();
                                const blobUrl = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = blobUrl;
                                a.download = fileName;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
                            }
                        } catch (dlErr) {
                            console.warn('Auto-download failed:', dlErr);
                        }

                        setChatMessages(prev => prev.map(m => m.id === genMsgId ? {
                            ...m,
                            content: `✅ **Document generated!**\n\n📄 [Download ${fileName}](${fullDownloadUrl})`,
                            _downloadUrl: fullDownloadUrl,
                            _downloadFileName: fileName,
                        } : m));
                    } else {
                        const err = await res.json().catch(() => ({}));
                        setChatMessages(prev => prev.map(m => m.id === genMsgId ? {
                            ...m,
                            content: `❌ Failed to generate document: ${err.error || 'Unknown error'}`,
                        } : m));
                    }
                } catch (err) {
                    setChatMessages(prev => prev.map(m => m.id === genMsgId ? {
                        ...m,
                        content: `❌ Failed to generate document: ${err.message}`,
                    } : m));
                }
            })();
        } catch {
            // Not valid JSON, ignore
        }
    }, [chatMessages, chatLoading, fillTemplate?.id]);

    // Save instructions
    const saveInstructions = async () => {
        if (!fillTemplate) return;
        setSavingInstructions(true);
        try {
            await authFetch(`${API_BASE}/api/templates/${fillTemplate.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instructions: editInstructions }),
            });
            setFillTemplate(prev => ({ ...prev, instructions: editInstructions }));
        } catch (err) { console.error('Save instructions failed:', err); }
        finally { setSavingInstructions(false); }
    };

    // KB ID changes — persist to template
    const handleKnowledgeBaseIdsChange = async (newIds) => {
        if (!fillTemplate) return;
        setFillTemplate(prev => ({ ...prev, knowledgeBaseIds: newIds }));
        try {
            await authFetch(`${API_BASE}/api/templates/${fillTemplate.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ knowledgeBaseIds: newIds }),
            });
        } catch (err) { console.error('Save KB IDs failed:', err); }
    };

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // Upload handler
    const handleUpload = async (file) => {
        if (!file || !file.name.toLowerCase().endsWith('.docx')) {
            alert('Please select a .docx file');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', file.name.replace(/\.docx$/i, ''));
            if (skipAiDetection) formData.append('skipAutoParameterize', 'true');

            const res = await authFetch(`${API_BASE}/api/templates/upload`, {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                await loadTemplates();

                // Auto-open the new template
                if (data.template) {
                    setFillTemplate(data.template);
                }

                // If context is being generated in the background, poll for updates
                if (data.generatingContext && data.template?.id) {
                    const templateId = data.template.id;
                    const origParamCount = data.template.parameters?.length || 0;
                    if (origParamCount === 0) setParameterizing(true);
                    let polls = 0;
                    const poller = setInterval(async () => {
                        polls++;
                        if (polls > 20) { clearInterval(poller); setParameterizing(false); return; } // max 60s (parameterization takes longer)
                        try {
                            const r = await authFetch(`${API_BASE}/api/templates/${templateId}`);
                            if (r.ok) {
                                const { template: updated } = await r.json();
                                const hasNew = updated?.description || updated?.instructions ||
                                    (updated?.knowledgeBaseIds?.length > (data.template.knowledgeBaseIds?.length || 0)) ||
                                    (updated?.parameters?.length > origParamCount);
                                if (hasNew) {
                                    setFillTemplate(prev => prev?.id === templateId ? { ...prev, ...updated } : prev);
                                    if (updated.instructions) setEditInstructions(updated.instructions);
                                    if (updated.parameters?.length > origParamCount) setParameterizing(false);
                                    await loadTemplates();
                                    // Stop when all background tasks completed
                                    const allDone = updated.description && updated.instructions && 
                                        (updated.parameters?.length > origParamCount);
                                    if (allDone) clearInterval(poller);
                                }
                            }
                        } catch {}
                    }, 3000);
                }
            } else {
                const err = await res.json();
                alert(err.error || 'Upload failed');
            }
        } catch (err) {
            alert('Upload failed: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    // Rename handler
    const handleRename = async (id) => {
        if (!renameValue.trim()) return;
        try {
            const res = await authFetch(`${API_BASE}/api/templates/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: renameValue.trim() }),
            });
            if (res.ok) {
                setTemplates(prev => prev.map(t => t.id === id ? { ...t, name: renameValue.trim() } : t));
            }
        } catch (err) {
            console.error('Rename failed:', err);
        }
        setRenamingId(null);
    };

    // Delete handler
    const handleDelete = async (id) => {
        setDeletingId(id);
        try {
            const res = await authFetch(`${API_BASE}/api/templates/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setTemplates(prev => prev.filter(t => t.id !== id));
                if (fillTemplate?.id === id) setFillTemplate(null);
            }
        } catch (err) {
            console.error('Delete failed:', err);
        }
        setDeletingId(null);
    };

    // Download handler
    const handleDownload = async (template) => {
        try {
            const res = await authFetch(`${API_BASE}/api/templates/${template.id}/download`);
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = template.fileName;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Download failed:', err);
        }
    };

    // Generate filled document
    const handleGenerate = async () => {
        if (!fillTemplate) return;

        // Find the last JSON code block in chat messages
        const assistantMessages = chatMessages.filter(m => m.role === 'assistant' && m.content);
        let values = null;

        for (let i = assistantMessages.length - 1; i >= 0; i--) {
            const content = assistantMessages[i].content;
            const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                try {
                    values = JSON.parse(jsonMatch[1]);
                    break;
                } catch (e) {
                    continue;
                }
            }
        }

        if (!values) {
            // Ask AI to generate values
            sendChatMessage('Please fill all the template parameters based on our conversation. Respond with a JSON code block containing all parameter values.');
            return;
        }

        setGenerating(true);
        try {
            const res = await authFetch(`${API_BASE}/api/templates/${fillTemplate.id}/fill`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values }),
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fillTemplate.fileName.replace(/\.docx$/i, '_filled.docx');
                a.click();
                URL.revokeObjectURL(url);
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to generate document');
            }
        } catch (err) {
            alert('Failed to generate document: ' + err.message);
        } finally {
            setGenerating(false);
        }
    };

    // Send message — meeting notes are passed via backend payload, no need to inject context
    const handleSendMessage = (text, attachments) => {
        sendChatMessage(text, attachments);
    };

    // Filter templates
    const filtered = templates.filter(t =>
        !searchQuery || t.name?.toLowerCase().includes(searchQuery.toLowerCase()) || t.fileName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ── AI Fill View ─────────────────────────────────────────────
    if (fillTemplate) {
        return (
            <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
                {/* Header */}
                <div className="shrink-0 px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    <button onClick={() => setFillTemplate(null)} className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
                        <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {fillTemplate.name}
                        </h2>
                        <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                            {parameterizing ? (
                                <><span className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin inline-block" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} /> Detecting parameters...</>
                            ) : (
                                <>{fillTemplate.parameters.length} parameter{fillTemplate.parameters.length !== 1 ? 's' : ''} · {fillTemplate.fileName}</>
                            )}
                        </p>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex gap-1 p-0.5 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                        <button
                            onClick={() => setShowSettings(false)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!showSettings ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-[var(--text-secondary)]'}`}
                        >
                            <MessageSquare className="w-3.5 h-3.5" /> Chat
                        </button>
                        <button
                            onClick={() => setShowSettings(true)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${showSettings ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-[var(--text-secondary)]'}`}
                        >
                            <Settings className="w-3.5 h-3.5" /> Settings & Knowledge
                        </button>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={generating || chatMessages.length === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
                        style={{ background: generating ? 'var(--text-muted)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                    >
                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        {generating ? 'Generating...' : 'Generate Document'}
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Sidebar — Template Details */}
                    <div className="w-[280px] shrink-0 border-r overflow-auto p-4 flex flex-col gap-4" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                        {/* Parameters */}
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Parameters</h3>
                            <div className="flex flex-wrap gap-1.5">
                                {fillTemplate.parameters.map((p, i) => {
                                    const param = getParam(p);
                                    return (
                                        <span key={i} className="text-xs px-2 py-1 rounded-lg border" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-primary)' }} title={param.description || undefined}>
                                            {param.description ? `${param.name}: ${param.description}` : `{{${param.name}}}`}
                                        </span>
                                    );
                                })}
                                {fillTemplate.parameters.length === 0 && (
                                    parameterizing ? (
                                        <div className="flex items-center gap-2 py-2">
                                            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
                                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>AI is analyzing the document and detecting parameters...</p>
                                        </div>
                                    ) : (
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No parameters detected in this template</p>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Meeting Notes Picker */}
                        <div>
                            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Meeting Notes Context</h3>
                            <div className="relative">
                                <button
                                    onClick={() => setShowNotesPicker(!showNotesPicker)}
                                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-colors hover:border-[var(--accent-primary)]"
                                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-primary)' }}
                                >
                                    <span>{selectedNoteIds.length > 0 ? `${selectedNoteIds.length} note${selectedNoteIds.length > 1 ? 's' : ''} selected` : 'Select meeting notes...'}</span>
                                    <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                                </button>
                                {showNotesPicker && (
                                    <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border shadow-xl overflow-auto max-h-48 z-10" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                                        {meetingNotes.length === 0 ? (
                                            <p className="text-xs p-3 text-center" style={{ color: 'var(--text-muted)' }}>No meeting notes available</p>
                                        ) : (
                                            meetingNotes.map(note => (
                                                <button
                                                    key={note.id}
                                                    onClick={() => {
                                                        setSelectedNoteIds(prev =>
                                                            prev.includes(note.id)
                                                                ? prev.filter(id => id !== note.id)
                                                                : [...prev, note.id]
                                                        );
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-tertiary)] transition-colors"
                                                >
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedNoteIds.includes(note.id) ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]' : 'border-[var(--border-default)]'}`}>
                                                        {selectedNoteIds.includes(note.id) && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{note.title}</p>
                                                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{timeAgo(note.createdAt)}</p>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                            {selectedNoteIds.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {selectedNoteIds.map(id => {
                                        const note = meetingNotes.find(n => n.id === id);
                                        return note ? (
                                            <span key={id} className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)' }}>
                                                {note.title.length > 20 ? note.title.slice(0, 20) + '...' : note.title}
                                                <button onClick={() => setSelectedNoteIds(prev => prev.filter(i => i !== id))}>
                                                    <X className="w-2.5 h-2.5" />
                                                </button>
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            )}
                        </div>

                        {fillTemplate.description && (
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Description</h3>
                                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{fillTemplate.description}</p>
                            </div>
                        )}
                    </div>

                    {/* Right Panel — Chat or Settings */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {showSettings ? (
                            /* ═══ Settings & Knowledge Panel ═══ */
                            <div className="flex-1 overflow-auto p-6 custom-scrollbar">
                                <div className="max-w-3xl mx-auto space-y-6">
                                    {/* Custom Instructions */}
                                    <div>
                                        <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Custom Instructions</h3>
                                        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                                            Add extra context or rules for the AI when filling this template.
                                        </p>
                                        <textarea
                                            value={editInstructions}
                                            onChange={e => setEditInstructions(e.target.value)}
                                            onBlur={saveInstructions}
                                            placeholder="e.g. 'Always use formal Dutch language', 'Company address is ...', 'Use metric units'"
                                            rows={4}
                                            className="w-full px-4 py-3 rounded-xl border text-sm resize-y"
                                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }}
                                        />
                                        {savingInstructions && <span className="text-xs mt-1 block" style={{ color: 'var(--accent-primary)' }}>Saving...</span>}
                                    </div>

                                    {/* Knowledge Panel — same as Agent Editor */}
                                    <KnowledgePanel
                                        API_BASE={API_BASE}
                                        knowledgeBaseIds={fillTemplate.knowledgeBaseIds || []}
                                        onKnowledgeBaseIdsChange={handleKnowledgeBaseIdsChange}
                                    />
                                </div>
                            </div>
                        ) : (
                            /* ═══ AI Chat ═══ */
                            <>
                                {/* Processing Banner */}
                                {parameterizing && (
                                    <div className="mx-4 mt-3 flex items-center gap-3 px-4 py-3 rounded-xl border animate-pulse" style={{ background: 'rgba(99, 102, 241, 0.08)', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
                                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
                                        <div>
                                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>AI is processing your template...</p>
                                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Detecting parameters, generating instructions, and building knowledge base. This may take up to a minute.</p>
                                        </div>
                                    </div>
                                )}
                                {/* Chat Messages */}
                                <div ref={chatContainerRef} className="flex-1 overflow-auto p-4 custom-scrollbar">
                                    {chatMessages.length === 0 ? (
                                        <div className="text-center py-12">
                                            <Bot className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                                            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Fill this template with AI</p>
                                            <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
                                                Describe what the document should contain. The AI will help you fill in all the parameters.
                                                {selectedNoteIds.length > 0 && ' Meeting notes are loaded as context.'}
                                            </p>
                                            <div className="flex flex-wrap gap-1.5 justify-center mt-4">
                                                {['Fill all parameters from context', 'What parameters need to be filled?', 'Help me fill this template'].map((q, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => setChatInput(q)}
                                                        className="text-[11px] px-2.5 py-1.5 rounded-lg border transition-all hover:border-[var(--accent-primary)]"
                                                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}
                                                    >
                                                        {q}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="max-w-3xl mx-auto space-y-6 pb-4">
                                            {chatMessages.filter(m => !m.parentId).map((msg, idx) => (
                                                <MessageItem
                                                    key={msg.id || idx}
                                                    idx={idx}
                                                    msg={msg}
                                                    selectedAgent={{ name: 'Template Assistant', avatar: '📝' }}
                                                    onCopy={(txt) => navigator.clipboard.writeText(txt)}
                                                    handleFormSubmit={(formMsg, data, formId) => {
                                                        setSubmittedFormIds(prev => new Set([...prev, formId]));
                                                        // Build a readable message with form data values
                                                        const formDataText = data.formData
                                                            ? Object.entries(data.formData).map(([k, v]) => `${k}: ${v}`).join('\n')
                                                            : data.text;
                                                        sendChatMessage(`Form submitted:\n${formDataText}`);
                                                    }}
                                                    isFormSubmitted={submittedFormIds.has(`form-${msg.id || idx}`)}
                                                    allMessages={chatMessages}
                                                    chatSource="direct"
                                                    onRetry={retryChatMessage}
                                                    onEditMessage={editAndRegenerateChat}
                                                    modelTiers={modelTiers}
                                                />
                                            ))}
                                            <div ref={chatEndRef} />
                                        </div>
                                    )}
                                </div>

                                {/* Input Area */}
                                <div className="w-full flex flex-col shrink-0">
                                    <InputArea
                                        onSendMessage={(text, attachments) => handleSendMessage(text, attachments)}
                                        onStopGenerating={stopChatGenerating}
                                        isLoading={chatLoading}
                                        directMode={true}
                                        modelTiers={modelTiers}
                                        selectedTier={selectedChatTier}
                                        onTierChange={setSelectedChatTier}
                                        input={chatInput}
                                        setInput={setChatInput}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── Template List View ────────────────────────────────────────
    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b flex items-center gap-4" style={{ borderColor: 'var(--border-subtle)' }}>
                <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
                    <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Word Templates</h1>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Upload .docx templates with {'{{parameters}}'} for AI to fill</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search templates..."
                            className="pl-8 pr-3 py-1.5 text-sm rounded-lg border w-48 focus:outline-none focus:ring-1"
                            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                        />
                    </div>
                    {/* Upload button */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02]"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                        >
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Upload Template
                        </button>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
                            <input
                                type="checkbox"
                                checked={skipAiDetection}
                                onChange={e => setSkipAiDetection(e.target.checked)}
                                className="w-3.5 h-3.5 rounded accent-[#6366f1]"
                            />
                            Skip AI detection
                        </label>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".docx"
                        className="hidden"
                        onChange={e => {
                            if (e.target.files[0]) handleUpload(e.target.files[0]);
                            e.target.value = '';
                        }}
                    />
                </div>
            </div>

            {/* Content */}
            <div
                className={`flex-1 overflow-auto p-6 ${dragOver ? 'ring-2 ring-inset ring-[var(--accent-primary)]' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]); }}
            >
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--text-muted)' }} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99, 102, 241, 0.08)' }}>
                                <FileText className="w-10 h-10" style={{ color: '#6366f1', opacity: 0.6 }} />
                            </div>
                            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                                {searchQuery ? 'No templates found' : 'No templates yet'}
                            </h3>
                            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                                {searchQuery ? 'Try a different search' : 'Upload a .docx file with {{parameter}} placeholders'}
                            </p>
                            {!searchQuery && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                                >
                                    Upload Your First Template
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="max-w-4xl mx-auto grid gap-3">
                        {filtered.map(template => (
                            <div
                                key={template.id}
                                className="group rounded-xl border p-4 transition-all hover:shadow-md hover:border-[var(--accent-primary)]/30"
                                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
                            >
                                <div className="flex items-start gap-3">
                                    {/* Icon */}
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(99, 102, 241, 0.08)' }}>
                                        <File className="w-5 h-5" style={{ color: '#6366f1' }} />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        {renamingId === template.id ? (
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    autoFocus
                                                    value={renameValue}
                                                    onChange={e => setRenameValue(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleRename(template.id); if (e.key === 'Escape') setRenamingId(null); }}
                                                    className="text-sm font-semibold px-2 py-0.5 rounded border focus:outline-none focus:ring-1"
                                                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', background: 'var(--bg-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                                />
                                                <button onClick={() => handleRename(template.id)} className="p-0.5 rounded hover:bg-green-500/10"><Check className="w-4 h-4 text-green-500" /></button>
                                                <button onClick={() => setRenamingId(null)} className="p-0.5 rounded hover:bg-red-500/10"><X className="w-4 h-4 text-red-400" /></button>
                                            </div>
                                        ) : (
                                            <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{template.name}</h3>
                                        )}
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{template.fileName}</span>
                                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>·</span>
                                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{timeAgo(template.createdAt)}</span>
                                        </div>
                                        {template.parameters.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {template.parameters.slice(0, 8).map((p, i) => {
                                                    const param = getParam(p);
                                                    return (
                                                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }} title={param.description || undefined}>
                                                            {param.name}
                                                        </span>
                                                    );
                                                })}
                                                {template.parameters.length > 8 && (
                                                    <span className="text-[10px] px-1.5 py-0.5" style={{ color: 'var(--text-muted)' }}>+{template.parameters.length - 8} more</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => setFillTemplate(template)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:scale-[1.02]"
                                            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                                        >
                                            <Sparkles className="w-3.5 h-3.5" />
                                            Fill with AI
                                        </button>
                                        <button
                                            onClick={() => handleDownload(template)}
                                            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                                            title="Download"
                                        >
                                            <Download className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                        </button>
                                        <button
                                            onClick={() => { setRenamingId(template.id); setRenameValue(template.name); }}
                                            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                                            title="Rename"
                                        >
                                            <Pencil className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                        </button>
                                        <button
                                            onClick={() => { if (confirm('Delete this template?')) handleDelete(template.id); }}
                                            disabled={deletingId === template.id}
                                            className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                                            title="Delete"
                                        >
                                            {deletingId === template.id
                                                ? <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                                                : <Trash2 className="w-4 h-4 text-red-400" />
                                            }
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
