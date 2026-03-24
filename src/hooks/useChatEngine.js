import { useState, useRef, useCallback, useEffect } from 'react';
import { API_BASE, generateMessageId, authFetch } from '../utils/helpers';

/**
 * Custom hook that encapsulates the chat messaging engine.
 *
 * Owns: messages, isLoading, abortController, sendMessage, stopGenerating.
 * Receives agent/conversation context and workspace state via params.
 *
 * @param {Object} opts
 * @param {Object|null} opts.selectedAgent - Currently selected agent
 * @param {Object|null} opts.currentConversation - Current conversation object
 * @param {Function} opts.onConversationCreated - Called when stream creates/updates a conversation
 * @param {Function} opts.getWorkspacePayload - Returns { workspaceContent, workspaceSelection } if workspace enabled
 * @param {Function} opts.onWorkspaceUpdate - Called with new workspace content from stream
 * @param {Object} opts.directMode - { enabled: boolean, modelTier: string }
 * @param {Function} opts.onDirectConversationCreated - Called with { conversationId, title } for direct chats
 */
export default function useChatEngine({
    selectedAgent,
    currentConversation,
    onConversationCreated,
    getWorkspacePayload,
    onWorkspaceUpdate,
    directMode,
    onDirectConversationCreated,
    activeProject,
    onNotebookDocUpdate,
    onNotebookSourceAdded,
}) {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [abortController, setAbortController] = useState(null);
    const [submittedFormIds, setSubmittedFormIds] = useState(new Set());

    // Cleanup abort controller on unmount
    useEffect(() => {
        return () => {
            if (abortController) {
                console.log('[useChatEngine] Unmounting, aborting active stream');
                abortController.abort();
            }
        };
    }, [abortController]);

    // --- SSE Event Handlers ---

    const handleSSEEvent = useCallback((event, data, ids) => {
        const { assistantMsgId, userMsgId, activeIdRef, contentRef } = ids;

        // DEBUG: log non-content events to help debug LinkedIn draft issue
        if (event !== 'content' && event !== 'thinking' && event !== 'orchestrator_thinking') {
            console.log('[SSE Event]', event, data);
        }

        switch (event) {
            case 'content':
                if (data.text) {
                    contentRef.current += data.text;
                    const content = contentRef.current;
                    setMessages(prev => prev.map(m =>
                        m.id === activeIdRef.current ? {
                            ...m,
                            content,
                            respondingAgentName: data.respondingAgentName || m.respondingAgentName,
                            respondingAgentAvatar: data.respondingAgentAvatar || m.respondingAgentAvatar
                        } : m
                    ));
                }
                break;

            case 'thinking':
                if (data.text) {
                    setMessages(prev => prev.map(m =>
                        m.id === activeIdRef.current ? {
                            ...m,
                            thinking: (m.thinking || '') + data.text
                        } : m
                    ));
                }
                break;

            case 'orchestrator_thinking':
                if (data.text) {
                    setMessages(prev => prev.map(m =>
                        m.id === activeIdRef.current ? {
                            ...m,
                            orchestratorThinking: (m.orchestratorThinking || '') + data.text
                        } : m
                    ));
                }
                break;

            case 'content_replace':
                // Allow empty string to clear content (e.g. clearing intermediate tool-call planning text)
                if (data.text !== undefined) {
                    contentRef.current = data.text;
                    setMessages(prev => prev.map(m =>
                        m.id === assistantMsgId ? { ...m, content: data.text } : m
                    ));
                }
                break;

            case 'content_redact': {
                const seconds = data.autoRedactSeconds || 5;
                setMessages(prev => prev.map(m =>
                    m.id === userMsgId ? { ...m, isGuardrailViolation: true, deleteIn: seconds, willRedact: true } : m
                ));
                setTimeout(() => {
                    setMessages(prev => prev.map(m =>
                        m.id === userMsgId ? { ...m, content: data.redactedMessage, isGuardrailViolation: false, isRedacted: true, willRedact: false } : m
                    ));
                }, seconds * 1000);
                break;
            }

            case 'tool_start':
                setMessages(prev => prev.map(m => {
                    if (m.id === assistantMsgId) {
                        const update = {
                            ...m,
                            toolCall: { name: data.name, status: 'running' },
                            toolHistory: [...(m.toolHistory || []), {
                                name: data.name,
                                args: data.args,
                                status: 'running',
                                startTime: Date.now()
                            }]
                        };
                        if (data.name === 'sequentialthinking' && data.args?.thought) {
                            const steps = [...(m.thinkingSteps || [])];
                            steps.push({
                                thought: data.args.thought,
                                thoughtNumber: data.args.thoughtNumber,
                                totalThoughts: data.args.totalThoughts,
                                isRevision: data.args.isRevision,
                                branchFromThought: data.args.branchFromThought,
                                branchId: data.args.branchId,
                                status: 'running',
                                worker: data.worker || null,
                                instanceId: data.instanceId || null
                            });
                            update.thinkingSteps = steps;
                        }
                        return update;
                    }
                    return m;
                }));
                break;

            case 'tool_end':
                setMessages(prev => prev.map(m => {
                    if (m.id === assistantMsgId) {
                        const trs = m.toolResults || [];
                        // Mark the matching running tool in toolHistory as done
                        const updatedHistory = (m.toolHistory || []).map(t =>
                            t.name === data.name && t.status === 'running'
                                ? {
                                    ...t,
                                    status: 'done',
                                    endTime: Date.now(),
                                    resultPreview: typeof data.result === 'string'
                                        ? data.result.slice(0, 120)
                                        : JSON.stringify(data.result || '').slice(0, 120)
                                }
                                : t
                        );
                        const update = {
                            ...m,
                            toolResults: [...trs, { name: data.name, result: data.result }],
                            toolCall: null,
                            toolHistory: updatedHistory,
                        };
                        if (data.name === 'sequentialthinking' && m.thinkingSteps?.length > 0) {
                            const steps = [...m.thinkingSteps];
                            const lastRunning = steps.findLastIndex(s => s.status === 'running');
                            if (lastRunning >= 0) steps[lastRunning] = { ...steps[lastRunning], status: 'done' };
                            update.thinkingSteps = steps;
                        }
                        return update;
                    }
                    return m;
                }));
                break;

            case 'model_selected':
                setMessages(prev => prev.map(m =>
                    m.id === activeIdRef.current ? {
                        ...m,
                        autoSelectedTier: data.tier
                    } : m
                ));
                break;

            case 'email_draft': {
                const draftKey = JSON.stringify({ to: data.to, subject: data.subject, body: data.body });
                setMessages(prev => prev.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    const existing = m.emailDrafts || [];
                    if (existing.some(d => JSON.stringify({ to: d.to, subject: d.subject, body: d.body }) === draftKey)) return m;
                    return { ...m, emailDrafts: [...existing, { ...data, status: 'pending' }] };
                }));
                break;
            }

            case 'linkedin_draft':
                console.log('[DEBUG] linkedin_draft event received!', data, 'assistantMsgId:', assistantMsgId);
                setMessages(prev => {
                    const updated = prev.map(m =>
                        m.id === assistantMsgId ? {
                            ...m,
                            linkedInDrafts: [...(m.linkedInDrafts || []), { ...data, status: 'pending' }]
                        } : m
                    );
                    console.log('[DEBUG] Messages after linkedin_draft update:', updated.map(m => ({ id: m.id, hasLinkedInDrafts: !!m.linkedInDrafts, linkedInDraftsCount: m.linkedInDrafts?.length })));
                    return updated;
                });
                break;

            case 'calendar_draft': {
                const draftKey = JSON.stringify({ summary: data.summary, start: data.start, end: data.end });
                setMessages(prev => prev.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    const existing = m.calendarDrafts || [];
                    if (existing.some(d => JSON.stringify({ summary: d.summary, start: d.start, end: d.end }) === draftKey)) return m;
                    return { ...m, calendarDrafts: [...existing, { ...data, status: 'pending' }] };
                }));
                break;
            }

            case 'whatsapp_draft': {
                const draftKey = JSON.stringify({ to: data.to, message: data.message });
                setMessages(prev => prev.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    const existing = m.whatsappDrafts || [];
                    if (existing.some(d => JSON.stringify({ to: d.to, message: d.message }) === draftKey)) return m;
                    return { ...m, whatsappDrafts: [...existing, { ...data, status: 'pending' }] };
                }));
                break;
            }

            case 'contacts_draft': {
                const draftKey = JSON.stringify({ name: data.name, email: data.email, phone: data.phone });
                setMessages(prev => prev.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    const existing = m.contactsDrafts || [];
                    if (existing.some(d => JSON.stringify({ name: d.name, email: d.email, phone: d.phone }) === draftKey)) return m;
                    return { ...m, contactsDrafts: [...existing, { ...data, status: 'pending' }] };
                }));
                break;
            }

            case 'keep_draft': {
                const draftKey = JSON.stringify({ title: data.title, content: data.content });
                setMessages(prev => prev.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    const existing = m.keepDrafts || [];
                    if (existing.some(d => JSON.stringify({ title: d.title, content: d.content }) === draftKey)) return m;
                    return { ...m, keepDrafts: [...existing, { ...data, status: 'pending' }] };
                }));
                break;
            }

            case 'sheets_result':
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId ? {
                        ...m,
                        sheetsResults: [...(m.sheetsResults || []), data]
                    } : m
                ));
                break;

            case 'sheets_draft': {
                const draftKey = JSON.stringify({ spreadsheetId: data.spreadsheetId, range: data.range });
                setMessages(prev => prev.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    const existing = m.sheetsDrafts || [];
                    if (existing.some(d => JSON.stringify({ spreadsheetId: d.spreadsheetId, range: d.range }) === draftKey)) return m;
                    return { ...m, sheetsDrafts: [...existing, { ...data, status: 'pending' }] };
                }));
                break;
            }

            case 'sheets_report':
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId ? {
                        ...m,
                        sheetsReports: [...(m.sheetsReports || []), data]
                    } : m
                ));
                break;

            case 'map_embed':
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId ? {
                        ...m,
                        mapEmbeds: [...(m.mapEmbeds || []), data]
                    } : m
                ));
                break;

            case 'image':
                if (data.data && data.mimeType) {
                    setMessages(prev => prev.map(m =>
                        m.id === activeIdRef.current ? {
                            ...m,
                            images: [...(m.images || []), {
                                data: data.data,
                                mimeType: data.mimeType,
                            }]
                        } : m
                    ));
                }
                break;

            case 'audio':
                if (data.url) {
                    setMessages(prev => prev.map(m =>
                        m.id === activeIdRef.current ? {
                            ...m,
                            audioFiles: [...(m.audioFiles || []), {
                                url: data.url,
                                mimeType: data.mimeType || 'audio/mpeg',
                                source: data.source || 'elevenlabs',
                            }]
                        } : m
                    ));
                }
                break;

            case 'video':
                if (data.url && data.mimeType) {
                    setMessages(prev => prev.map(m =>
                        m.id === activeIdRef.current ? {
                            ...m,
                            videoFiles: [...(m.videoFiles || []), {
                                url: data.url,
                                mimeType: data.mimeType,
                            }]
                        } : m
                    ));
                }
                break;

            case 'kb_sources':
                if (data.sources) {
                    setMessages(prev => prev.map(m => {
                        if (m.id !== assistantMsgId) return m;
                        // Merge with existing sources, deduplicate by title
                        const existing = m.kbSources || [];
                        const existingTitles = new Set(existing.map(s => s.title));
                        const newSources = data.sources.filter(s => !existingTitles.has(s.title));
                        return { ...m, kbSources: [...existing, ...newSources] };
                    }));
                }
                break;

            case 'workspace_update':
                onWorkspaceUpdate?.(data.content);
                break;

            case 'notebook_doc_update':
                onNotebookDocUpdate?.(data.content, data.title);
                break;

            case 'notebook_source_added':
                onNotebookSourceAdded?.(data.source);
                break;

            case 'done':
                setMessages(prev => prev.map(m => {
                    if (m.id === activeIdRef.current) {
                        const update = { ...m, isStreaming: false, toolCall: null };
                        if (m.thinkingSteps?.some(s => s.status === 'running')) {
                            update.thinkingSteps = m.thinkingSteps.map(s =>
                                s.status === 'running' ? { ...s, status: 'done' } : s
                            );
                        }
                        // Mark swarm activity as complete
                        if (m.swarmActivity) {
                            update.swarmActivity = { ...m.swarmActivity, status: 'complete' };
                        }
                        return update;
                    }
                    return m;
                }));
                if (data.conversationId) {
                    onConversationCreated?.(data.conversationId);
                }
                if (data.message) {
                    setMessages(prev => prev.map(m => {
                        if (m.id === assistantMsgId && m.browserActivity?.browserAgents) {
                            const updatedAgents = { ...m.browserActivity.browserAgents };
                            for (const key of Object.keys(updatedAgents)) {
                                updatedAgents[key] = { ...updatedAgents[key], status: 'complete' };
                            }
                            return { ...m, content: data.message, browserActivity: { ...m.browserActivity, browserAgents: updatedAgents } };
                        }
                        return m;
                    }));
                }
                if (data.workspaceContent !== undefined) {
                    onWorkspaceUpdate?.(data.workspaceContent);
                }
                break;

            case 'error':
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId ? { ...m, content: data.error, isStreaming: false, isError: true } : m
                ));
                break;

            case 'guardrail_violation': {
                const secs = data.autoDeleteSeconds || 5;
                const categories = data.categories || data.rules || [];
                const categoryText = Array.isArray(categories) ? categories.join(', ') : '';
                setMessages(prev => prev.map(m =>
                    m.id === userMsgId ? { ...m, isGuardrailViolation: true, deleteIn: secs, violationCategories: categoryText } : m
                ));
                setTimeout(() => {
                    setMessages(prev => prev.map(m =>
                        m.id === userMsgId ? { ...m, content: '[Message removed - policy violation]', isGuardrailViolation: false, isDeleted: true } : m
                    ));
                }, secs * 1000);
                break;
            }

            // Swarm events
            case 'phase':
                setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
                    ...m, swarmActivity: {
                        ...m.swarmActivity,
                        type: 'swarm',
                        // Use data.status if backend explicitly sends 'complete', otherwise use phase name
                        status: data.status === 'complete' ? m.swarmActivity?.status : data.phase,
                        phases: [...(m.swarmActivity?.phases || []), data.message],
                        logs: [...(m.swarmActivity?.logs || []), { type: 'phase', phase: data.phase, timestamp: new Date().toISOString() }]
                    }
                } : m));
                break;

            case 'worker_start':
                setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
                    ...m, swarmActivity: {
                        ...m.swarmActivity,
                        type: 'swarm',
                        logs: [...(m.swarmActivity?.logs || []), {
                            type: 'worker_start',
                            worker: data.worker,
                            instanceId: data.instanceId,
                            role: data.role,
                            phase: data.phase,
                            instruction: data.instruction,
                            timestamp: new Date().toISOString()
                        }]
                    }
                } : m));
                break;

            case 'worker_tool':
                setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
                    ...m, swarmActivity: {
                        ...m.swarmActivity,
                        logs: [...(m.swarmActivity?.logs || []), {
                            type: 'tool_start',
                            worker: data.worker,
                            instanceId: data.instanceId,
                            tool: data.tool,
                            args: data.args,
                            timestamp: new Date().toISOString()
                        }]
                    }
                } : m));
                break;

            case 'worker_complete':
                setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
                    ...m, swarmActivity: {
                        ...m.swarmActivity,
                        logs: [...(m.swarmActivity?.logs || []), {
                            type: 'worker_complete',
                            worker: data.worker,
                            instanceId: data.instanceId,
                            preview: data.result,
                            timestamp: new Date().toISOString()
                        }]
                    }
                } : m));
                break;

            case 'worker_error':
                setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
                    ...m, swarmActivity: {
                        ...m.swarmActivity,
                        logs: [...(m.swarmActivity?.logs || []), {
                            type: 'worker_error',
                            worker: data.worker,
                            instanceId: data.instanceId,
                            preview: data.error,
                            timestamp: new Date().toISOString()
                        }]
                    }
                } : m));
                break;

            case 'brain_update':
                setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
                    ...m, swarmActivity: {
                        ...m.swarmActivity,
                        brain: [...(m.swarmActivity?.brain || []), {
                            phase: data.phase,
                            worker: data.worker,
                            content: data.content,
                            totalEntries: data.totalEntries,
                            timestamp: new Date().toISOString()
                        }]
                    }
                } : m));
                break;

            // Browser agent events
            case 'browser_action': {
                const agentKey = data.instanceId || data.worker || 'default';
                setMessages(prev => prev.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    const existing = m.browserActivity?.browserAgents?.[agentKey] || {};
                    return {
                        ...m, browserActivity: {
                            ...m.browserActivity,
                            browserAgents: {
                                ...(m.browserActivity?.browserAgents || {}),
                                [agentKey]: {
                                    ...existing,
                                    worker: data.worker || agentKey,
                                    type: 'browser',
                                    status: data.action === 'done' ? 'complete' : 'running',
                                    actions: [...(existing.actions || []), {
                                        action: data.action,
                                        params: data.params,
                                        result: data.result,
                                        screenshot: data.screenshot,
                                        step: data.step,
                                        maxSteps: data.maxSteps,
                                        timestamp: new Date().toISOString()
                                    }]
                                }
                            }
                        }
                    };
                }));
                break;
            }

            case 'browser_screenshot': {
                const agentKey = data.instanceId || data.worker || 'default';
                setMessages(prev => prev.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    const existing = m.browserActivity?.browserAgents?.[agentKey] || {};
                    return {
                        ...m, browserActivity: {
                            ...m.browserActivity,
                            browserAgents: {
                                ...(m.browserActivity?.browserAgents || {}),
                                [agentKey]: {
                                    ...existing,
                                    worker: data.worker || agentKey,
                                    screenshot: data.image,
                                    screenshotTimestamp: new Date().toISOString()
                                }
                            }
                        }
                    };
                }));
                break;
            }

            // Terminal agent events
            case 'terminal_status':
                setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
                    ...m, terminalActivity: {
                        ...m.terminalActivity,
                        status: data.status,
                        statusMessage: data.message
                    }
                } : m));
                break;

            case 'terminal_command':
                setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
                    ...m, terminalActivity: {
                        ...m.terminalActivity,
                        commands: [...(m.terminalActivity?.commands || []), {
                            tool: data.tool,
                            args: data.args,
                            timestamp: new Date().toISOString()
                        }]
                    }
                } : m));
                break;

            case 'terminal_output':
                if (!data.streaming) {
                    setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
                        ...m, terminalActivity: {
                            ...m.terminalActivity,
                            outputs: [...(m.terminalActivity?.outputs || []), {
                                tool: data.tool,
                                content: data.content,
                                success: data.success,
                                type: data.type,
                                timestamp: new Date().toISOString()
                            }]
                        }
                    } : m));
                }
                break;

            case 'terminal_file':
                setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
                    ...m, terminalActivity: {
                        ...m.terminalActivity,
                        files: [...(m.terminalActivity?.files || []), {
                            name: data.name,
                            path: data.path,
                            size: data.size,
                            agentId: data.agentId,
                            containerKey: data.containerKey
                        }]
                    }
                } : m));
                break;

            case 'group_chat_agent_start': {
                const isVeryFirstAgent = data.round === 1 && data.index === 0;
                if (!isVeryFirstAgent) {
                    setMessages(prev => prev.map(m =>
                        m.id === activeIdRef.current ? { ...m, isStreaming: false } : m
                    ));
                    const newId = generateMessageId();
                    activeIdRef.current = newId;
                    contentRef.current = '';
                    setMessages(prev => [...prev, {
                        id: newId,
                        role: 'assistant',
                        content: '',
                        isStreaming: true,
                        respondingAgentId: data.agentId,
                        respondingAgentName: data.agentName,
                        respondingAgentAvatar: data.agentAvatar
                    }]);
                } else {
                    setMessages(prev => prev.map(m =>
                        m.id === activeIdRef.current ? {
                            ...m,
                            respondingAgentId: data.agentId,
                            respondingAgentName: data.agentName,
                            respondingAgentAvatar: data.agentAvatar
                        } : m
                    ));
                }
                break;
            }
        }
    }, [onConversationCreated, onWorkspaceUpdate]);

    // --- Core send ---

    const sendMessage = useCallback(async (text, attachments = [], isHidden = false) => {
        const isDirectMode = directMode?.enabled;
        if (!isDirectMode && !selectedAgent) return;
        if (isLoading) return;
        if (!text && attachments.length === 0) return;

        if (abortController) abortController.abort();
        const controller = new AbortController();
        setAbortController(controller);
        setIsLoading(true);

        const msgId = generateMessageId();
        const newMessage = {
            id: msgId,
            role: 'user',
            content: text,
            attachments,
            timestamp: new Date().toISOString(),
            isHidden
        };

        setMessages(prev => [...prev, newMessage]);

        const assistantMsgId = generateMessageId();
        const placeholder = {
            id: assistantMsgId,
            role: 'assistant',
            content: '',
            isStreaming: true,
            respondingAgentId: isDirectMode ? 'direct' : selectedAgent.id,
            respondingAgentName: isDirectMode ? null : selectedAgent.name,
            respondingAgentAvatar: isDirectMode ? '💬' : selectedAgent.avatar
        };
        setMessages(prev => [...prev, placeholder]);

        // Mutable refs for group chat active agent tracking
        const activeIdRef = { current: assistantMsgId };
        const contentRef = { current: '' };

        try {
            let url, payload;

            if (isDirectMode) {
                // Direct chat mode — post to custom endpoint or /ai/chat/direct/stream
                url = directMode.customEndpoint ? `${API_BASE}${directMode.customEndpoint}` : `${API_BASE}/ai/chat/direct/stream`;
                // Build history from current messages (exclude current user message)
                const history = messages.filter(m => (m.role === 'user' || m.role === 'assistant') && m.content?.trim()).map(m => ({
                    role: m.role,
                    content: m.content
                }));
                payload = {
                    message: text,
                    conversationId: currentConversation?.id,
                    modelTier: directMode.modelTier || 'fast',
                    attachments,
                    history,
                    ...getWorkspacePayload?.(),
                    ...(directMode.systemPrompt ? { systemPrompt: directMode.systemPrompt } : {}),
                    imageGenSettings: (() => {
                        try {
                            const s = localStorage.getItem('imageGenSettings');
                            return s ? JSON.parse(s) : {};
                        } catch { return {}; }
                    })(),
                    nanoBananaSettings: (() => {
                        try {
                            const s = localStorage.getItem('nanoBananaSettings');
                            return s ? JSON.parse(s) : {};
                        } catch { return {}; }
                    })(),
                    disabledMedia: (() => {
                        try {
                            const s = localStorage.getItem('disabledMedia');
                            return s ? JSON.parse(s) : {};
                        } catch { return {}; }
                    })(),
                    webSearchEnabled: (() => {
                        try { const v = localStorage.getItem('webSearchEnabled'); return v === null ? true : v === 'true'; } catch { return true; }
                    })(),
                    ...(activeProject?.id ? { projectId: activeProject.id } : {}),
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    ...(typeof directMode.getExtraPayload === 'function' ? directMode.getExtraPayload() : {}),
                };
            } else {
                // Agent chat mode — post to /agents/:id/chat/stream
                const wsPayload = getWorkspacePayload?.() || {};
                url = `${API_BASE}/agents/${selectedAgent.id}/chat/stream`;
                payload = {
                    message: text,
                    agentId: selectedAgent.id,
                    conversationId: currentConversation?.id,
                    attachments,
                    isHidden,
                    stream: true,
                    ...wsPayload,
                    ...(activeProject?.id ? { projectId: activeProject.id } : {}),
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                };
            }

            const response = await authFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            if (!response.ok) throw new Error('Failed to send message');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
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

                            // Handle direct-chat specific events
                            if (isDirectMode) {
                                if (currentEvent === 'conversation_created' && data.conversationId) {
                                    onDirectConversationCreated?.({ conversationId: data.conversationId });
                                } else if (currentEvent === 'title' && data.title) {
                                    onDirectConversationCreated?.({ conversationId: data.conversationId, title: data.title });
                                }
                            }

                            handleSSEEvent(currentEvent, data, {
                                assistantMsgId,
                                userMsgId: msgId,
                                activeIdRef,
                                contentRef
                            });
                        } catch (e) {
                            // Ignore parse errors
                        }
                    }
                }
            }

            setIsLoading(false);
            setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, isStreaming: false } : m
            ));

        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Chat error", err);
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId ? { ...m, isStreaming: false, isError: true, content: 'Error generating response.' } : m
                ));
                setIsLoading(false);
            }
        }
    }, [selectedAgent, isLoading, abortController, currentConversation, getWorkspacePayload, handleSSEEvent, directMode, messages, onDirectConversationCreated]);

    const stopGenerating = useCallback(() => {
        if (abortController) abortController.abort();
        setAbortController(null);
        setIsLoading(false);
        setMessages(prev => prev.map(m =>
            m.isStreaming ? { ...m, isStreaming: false } : m
        ));
    }, [abortController]);

    /**
     * Retry: regenerate the AI response at `messageIndex`.
     * Truncates that AI message and everything after it,
     * then re-sends the preceding user message.
     * @param {number} messageIndex - Index of the assistant message to retry
     * @param {string} [overrideTier] - Optional model tier override (e.g. 'fast', 'think')
     */
    const retryMessage = useCallback((messageIndex, overrideTier) => {
        if (isLoading) return;

        setMessages(prev => {
            // Find the assistant message and the user message before it
            const visibleMessages = prev.filter(m => !m.parentId);
            const assistantMsg = visibleMessages[messageIndex];
            if (!assistantMsg || assistantMsg.role !== 'assistant') return prev;

            // Find the user message that preceded this assistant message
            let userMsgIndex = messageIndex - 1;
            while (userMsgIndex >= 0 && visibleMessages[userMsgIndex]?.role !== 'user') {
                userMsgIndex--;
            }
            const userMsg = visibleMessages[userMsgIndex];
            if (!userMsg) return prev;

            // Truncate: remove both the user message and everything after it
            // sendMessage will re-add the user message, so we must not keep it
            const userIdx = prev.indexOf(userMsg);
            const truncated = prev.slice(0, userIdx);

            // Use setTimeout to call sendMessage after this state update
            setTimeout(() => {
                // Temporarily override tier if specified
                if (overrideTier && directMode?.enabled) {
                    const originalTier = directMode.modelTier;
                    directMode.modelTier = overrideTier;
                    sendMessage(userMsg.content, userMsg.attachments || []);
                    directMode.modelTier = originalTier;
                } else {
                    sendMessage(userMsg.content, userMsg.attachments || []);
                }
            }, 50);

            return truncated;
        });
    }, [isLoading, sendMessage, directMode]);

    /**
     * Edit a user message and regenerate the response.
     * Truncates from the user message onward, then sends newContent.
     * @param {number} messageIndex - Index of the user message to edit
     * @param {string} newContent - The edited message content
     */
    const editAndRegenerate = useCallback((messageIndex, newContent) => {
        if (isLoading) return;
        if (!newContent?.trim()) return;

        setMessages(prev => {
            const visibleMessages = prev.filter(m => !m.parentId);
            const userMsg = visibleMessages[messageIndex];
            if (!userMsg || userMsg.role !== 'user') return prev;

            // Truncate: keep messages before this user message
            const userIdx = prev.indexOf(userMsg);
            const truncated = prev.slice(0, userIdx);

            // Re-send with new content
            setTimeout(() => {
                sendMessage(newContent.trim(), userMsg.attachments || []);
            }, 50);

            return truncated;
        });
    }, [isLoading, sendMessage]);

    return {
        messages,
        setMessages,
        isLoading,
        sendMessage,
        stopGenerating,
        retryMessage,
        editAndRegenerate,
        submittedFormIds,
        setSubmittedFormIds,
    };
}
