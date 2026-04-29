import { useState, useRef, useCallback, useEffect } from 'react';
import { API_BASE, generateMessageId, authFetch } from '../utils/helpers';
import scopedStorage from '../utils/scopedStorage';
import useTranslation from './useTranslation';

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
 * @param {Function} opts.getNotebookPayload - Returns { notebookspaceContent, notebookspaceSelection } if notebook is open
 * @param {Function} opts.onNotebookUpdate - Called with new workspace content from stream
 * @param {Object} opts.directMode - { enabled: boolean, modelTier: string }
 * @param {Function} opts.onDirectConversationCreated - Called with { conversationId, title } for direct chats
 */
export default function useChatEngine({
    selectedAgent,
    currentConversation,
    onConversationCreated,
    getNotebookPayload,
    onNotebookUpdate,
    directMode,
    onDirectConversationCreated,
    activeProject,
    onNotebookDocUpdate,
    onNotebookSourceAdded,
    onNotebookThemeUpdate,
    activeSkillIds,
    onSessionSkillsChanged,
}) {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [abortController, setAbortController] = useState(null);
    const [submittedFormIds, setSubmittedFormIds] = useState(new Set());

    // Keep a ref in sync with messages so `sendMessage` can read the current
    // conversation without listing `messages` in its dep array. With `messages`
    // in the deps, `sendMessage` was recreated on every keystroke — that
    // cascaded to `retryMessage` and `editAndRegenerate` (which depend on
    // `sendMessage`), breaking memoization for every child that consumes them.
    const messagesRef = useRef(messages);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    // i18n access for SSE event handlers
    const { t } = useTranslation();
    const tRef = useRef(t);
    useEffect(() => { tRef.current = t; }, [t]);

    // Stable refs so SSE handlers always call the latest callback
    // (avoids stale closure when parent re-renders change the callback identity)
    const onNotebookDocUpdateRef = useRef(onNotebookDocUpdate);
    useEffect(() => { onNotebookDocUpdateRef.current = onNotebookDocUpdate; }, [onNotebookDocUpdate]);

    const onNotebookSourceAddedRef = useRef(onNotebookSourceAdded);
    useEffect(() => { onNotebookSourceAddedRef.current = onNotebookSourceAdded; }, [onNotebookSourceAdded]);

    const onNotebookThemeUpdateRef = useRef(onNotebookThemeUpdate);
    useEffect(() => { onNotebookThemeUpdateRef.current = onNotebookThemeUpdate; }, [onNotebookThemeUpdate]);

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

            case 'thinking_start':
                if (data.partId) {
                    setMessages(prev => prev.map(m => {
                        if (m.id !== activeIdRef.current) return m;
                        const parts = Array.isArray(m.thinkingParts) ? [...m.thinkingParts] : [];
                        if (parts.find(p => p.id === data.partId)) return m;
                        parts.push({
                            id: data.partId,
                            text: '',
                            startedAt: Date.now(),
                            endedAt: null,
                            redacted: data.redacted || false,
                        });
                        return { ...m, thinkingParts: parts, thinkingStartedAt: m.thinkingStartedAt || Date.now() };
                    }));
                }
                break;

            case 'thinking':
                if (data.text) {
                    setMessages(prev => prev.map(m => {
                        if (m.id !== activeIdRef.current) return m;
                        const prevParts = Array.isArray(m.thinkingParts) ? m.thinkingParts : [];
                        const parts = prevParts.map(p => ({ ...p })); // deep-clone each part so we can safely mutate
                        let idx = data.partId ? parts.findIndex(p => p.id === data.partId) : -1;
                        if (idx === -1) {
                            const lastIdx = parts.length - 1;
                            if (!data.partId && lastIdx >= 0 && !parts[lastIdx].endedAt) {
                                idx = lastIdx;
                            } else {
                                parts.push({
                                    id: data.partId || `auto-${parts.length}`,
                                    text: '',
                                    startedAt: Date.now(),
                                    endedAt: null,
                                });
                                idx = parts.length - 1;
                            }
                        }
                        parts[idx] = { ...parts[idx], text: parts[idx].text + data.text };
                        return {
                            ...m,
                            thinkingParts: parts,
                            thinking: (m.thinking || '') + data.text,
                            thinkingStartedAt: m.thinkingStartedAt || Date.now(),
                        };
                    }));
                }
                break;

            case 'thinking_stop':
                if (data.partId) {
                    setMessages(prev => prev.map(m => {
                        if (m.id !== activeIdRef.current) return m;
                        const prevParts = Array.isArray(m.thinkingParts) ? m.thinkingParts : [];
                        const parts = prevParts.map(p =>
                            p.id === data.partId
                                ? { ...p, endedAt: Date.now(), redacted: p.redacted || !!data.redacted }
                                : p
                        );
                        return { ...m, thinkingParts: parts, thinkingEndedAt: Date.now() };
                    }));
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

            case 'session_skills_bootstrap_started':
                // Tag the in-flight assistant message so MessageItem can show a
                // "Preparing chat-local skills…" status above the reply.
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId
                        ? { ...m, sessionSkillsBootstrap: { state: 'pending' } }
                        : m
                ));
                break;
            case 'session_skills_bootstrapped':
                if (Array.isArray(data.skills)) {
                    const snapIds = Array.isArray(data.activatedSkillIds) ? data.activatedSkillIds : [];
                    setMessages(prev => prev.map(m =>
                        m.id === assistantMsgId
                            ? {
                                ...m,
                                sessionSkillsBootstrap: {
                                    state: 'done',
                                    skills: data.skills.map(s => ({
                                        id: s.id,
                                        name: s.name,
                                        description: s.description || '',
                                        icon: s.icon || '🧩',
                                    })),
                                },
                                // Stamp the snapshot immediately so the timeline
                                // stays pinned to this state after streaming ends
                                // (before server persist round-trips).
                                sessionSkillsSnapshot: {
                                    activatedSkillIds: [...snapIds],
                                    completedSkillIds: [],
                                    completions: [],
                                },
                            }
                            : m
                    ));
                    onSessionSkillsChanged?.({
                        skills: data.skills,
                        activatedSkillIds: snapIds,
                        completedSkillIds: [],
                    });
                }
                break;
            case 'session_skills_updated':
                if (Array.isArray(data.skills)) {
                    const snapIds = Array.isArray(data.activatedSkillIds) ? data.activatedSkillIds : [];
                    const completedIds = Array.isArray(data.completedSkillIds) ? data.completedSkillIds : null;
                    // Stamp the latest snapshot onto the in-flight assistant
                    // message so a post-stream view keeps the full state even
                    // before the server persists/reloads.
                    setMessages(prev => prev.map(m => {
                        if (m.id !== assistantMsgId) return m;
                        const prevSnap = m.sessionSkillsSnapshot || {};
                        return {
                            ...m,
                            sessionSkillsSnapshot: {
                                ...prevSnap,
                                activatedSkillIds: [...snapIds],
                                ...(completedIds ? { completedSkillIds: [...completedIds] } : {}),
                            },
                        };
                    }));
                    onSessionSkillsChanged?.({
                        skills: data.skills,
                        activatedSkillIds: snapIds,
                        ...(completedIds ? { completedSkillIds: completedIds } : {}),
                    });
                }
                break;
            case 'session_skill_completed':
                // Per-step completion — append to the in-flight message's
                // completions list so the timeline renders a "✓ Step — summary"
                // row live as the pipeline walks.
                if (data && data.skillId) {
                    setMessages(prev => prev.map(m => {
                        if (m.id !== assistantMsgId) return m;
                        const prevSnap = m.sessionSkillsSnapshot || {};
                        const prevCompletions = Array.isArray(prevSnap.completions) ? prevSnap.completions : [];
                        const prevCompletedIds = Array.isArray(prevSnap.completedSkillIds) ? prevSnap.completedSkillIds : [];
                        return {
                            ...m,
                            sessionSkillsSnapshot: {
                                ...prevSnap,
                                completions: [...prevCompletions, data],
                                completedSkillIds: prevCompletedIds.includes(data.skillId)
                                    ? prevCompletedIds
                                    : [...prevCompletedIds, data.skillId],
                            },
                        };
                    }));
                }
                break;

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

            case 'document_truncated':
                // The notebook document was too long for the system prompt — server
                // trimmed it to fit. Store the counts on the streaming message so
                // the UI can show a one-time banner ("Document too large — only
                // N of M tokens shown"). Client decides how to render; we just
                // attach the data.
                setMessages(prev => prev.map(m =>
                    m.id === activeIdRef.current ? {
                        ...m,
                        documentTruncation: {
                            originalTokens: data.originalTokens,
                            keptTokens: data.keptTokens,
                        },
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
                        // Merge with existing sources, deduplicate by content (not title — allows multiple chunks from same doc)
                        const existing = m.kbSources || [];
                        const existingContentKeys = new Set(existing.map(s => (s.content || '').slice(0, 100)));
                        const newSources = data.sources.filter(s => !existingContentKeys.has((s.content || '').slice(0, 100)));
                        return { ...m, kbSources: [...existing, ...newSources] };
                    }));
                }
                break;

            case 'workspace_update':
                onNotebookUpdate?.(data.content);
                break;

            case 'notebook_doc_update':
                onNotebookDocUpdateRef.current?.(data.content, data.title);
                break;

            // Slides-specific aliases (same callbacks as notebook)
            case 'slides_deck_update':
                onNotebookDocUpdateRef.current?.(data.slides, data.title);
                break;

            case 'slides_theme_update':
                onNotebookThemeUpdateRef.current?.(data.theme);
                break;

            case 'notebook_source_added':
                onNotebookSourceAddedRef.current?.(data.source);
                break;

            case 'slides_source_added':
                onNotebookSourceAddedRef.current?.(data.source);
                break;

            // Sheet-specific aliases (same callbacks as notebook/slides)
            case 'sheet_update':
                onNotebookDocUpdateRef.current?.(data.cells, data.sheetIndex);
                break;

            case 'sheet_source_added':
                onNotebookSourceAddedRef.current?.(data.source);
                break;

            // Proposal-specific aliases
            case 'proposal_blocks_update':
                onNotebookDocUpdateRef.current?.(data.blocks);
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

                        return update;
                    }
                    return m;
                }));
                if (data.conversationId) {
                    onConversationCreated?.(data.conversationId);
                }

                if (data.notebookspaceContent !== undefined) {
                    onNotebookUpdate?.(data.notebookspaceContent);
                }
                break;

            case 'error': {
                const errMsg = typeof data.error === 'string' ? data.error : (data.error?.message || JSON.stringify(data.error) || 'An error occurred');
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId ? { ...m, content: errMsg, isStreaming: false, isError: true } : m
                ));
                break;
            }

            case 'dlp_preview': {
                // Server is pausing the stream until the user responds via
                // the DLP decision endpoint. The modal listens for this event.
                window.dispatchEvent(new CustomEvent('beeflow:dlp_preview', { detail: data }));
                break;
            }
            case 'dlp_resolved': {
                window.dispatchEvent(new CustomEvent('beeflow:dlp_resolved', { detail: data }));
                if (data?.appliedChoice === 'redact' && data?.redactedCount > 0) {
                    const info = {
                        source: 'dlp',
                        action: data.appliedChoice,
                        count: data.redactedCount,
                        categories: data.categories || [],
                        provider: data.provider?.displayName || null,
                        automatic: !!data.automatic,
                    };
                    setMessages(prev => prev.map(m => {
                        if (m.id === userMsgId) {
                            return { ...m, dlpRedactedCount: data.redactedCount, dlpCategories: data.categories || [] };
                        }
                        // Also stash the info on the assistant message so the
                        // "How I got this answer" panel can render the privacy step.
                        if (m.id === assistantMsgId) {
                            return { ...m, tokenisationInfo: info };
                        }
                        return m;
                    }));
                }
                break;
            }
            case 'pii_tokenized': {
                const entities = Array.isArray(data?.entities) ? data.entities : [];
                const categories = [...new Set(entities.map(e => e.label || e.category).filter(Boolean))];
                const count = data?.tokenCount || entities.length;
                const info = {
                    source: 'pii',
                    action: 'redact',
                    count,
                    categories,
                    provider: null,
                    automatic: true,
                };
                setMessages(prev => prev.map(m => {
                    if (m.id === userMsgId) {
                        return { ...m, piiTokenizedCount: count, piiCategories: categories };
                    }
                    if (m.id === assistantMsgId) {
                        return { ...m, tokenisationInfo: info };
                    }
                    return m;
                }));
                break;
            }
            case 'privacy_payload': {
                // Transparency: the exact tokenised string that was sent to the LLM.
                // Gated server-side by org `showRawPayload`. Attach to the assistant
                // message so "How I got this answer → Privacy protection" can render it.
                setMessages(prev => prev.map(m => m.id === assistantMsgId
                    ? { ...m, tokenisationInfo: { ...(m.tokenisationInfo || {}), tokenizedPrompt: data?.tokenizedPrompt || '', provider: data?.provider || m.tokenisationInfo?.provider || null } }
                    : m));
                break;
            }
            case 'privacy_response_raw': {
                // The raw pre-un-tokenise LLM response. Same gating as privacy_payload.
                setMessages(prev => prev.map(m => m.id === assistantMsgId
                    ? { ...m, tokenisationInfo: { ...(m.tokenisationInfo || {}), rawResponse: data?.rawResponse || '', rawTruncated: !!data?.truncated } }
                    : m));
                break;
            }
            case 'dlp_blocked': {
                window.dispatchEvent(new CustomEvent('beeflow:dlp_blocked', { detail: data }));
                const reason = data?.reason || 'policy';
                const labelKey = reason === 'timeout' ? 'dlp.blocked_timeout'
                    : reason === 'user_blocked' ? 'dlp.blocked_user'
                    : 'dlp.blocked_policy';
                const msg = tRef.current(labelKey, {
                    timeout: 'Blocked: DLP decision timed out.',
                    user_blocked: 'Prompt blocked by you.',
                    policy: 'Prompt blocked by data-loss-prevention policy.',
                }[reason] || 'Prompt blocked by DLP.');
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId ? { ...m, content: msg, isStreaming: false, isError: true } : m
                ));
                break;
            }

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

            case 'guardrail_blocked': {
                // Compose translated canned response using i18n keys
                const title = tRef.current('chat.guardrail_blocked_title', { violation: data.violation || 'Policy Violation' });
                const body = tRef.current('chat.guardrail_blocked_body');
                const translatedResponse = `${title}\n\n${body}`;
                contentRef.current = translatedResponse;
                setMessages(prev => prev.map(m =>
                    m.id === activeIdRef.current ? { ...m, content: translatedResponse } : m
                ));
                break;
            }


        }
    }, [onConversationCreated, onNotebookUpdate]);

    // Ref wrapper so `sendMessage` can dispatch SSE events without listing
    // `handleSSEEvent` in its deps. Keeps `sendMessage`'s identity stable as
    // long as its real inputs (selectedAgent, directMode, …) don't change.
    const handleSSEEventRef = useRef(handleSSEEvent);
    useEffect(() => { handleSSEEventRef.current = handleSSEEvent; }, [handleSSEEvent]);

    // --- Core send ---

    const sendMessage = useCallback(async (text, attachments = [], isHidden = false, historyOverride = null, overrideTier = null) => {
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

        // Mutable refs for active agent tracking
        const activeIdRef = { current: assistantMsgId };
        const contentRef = { current: '' };

        try {
            // Thinking-effort override from composer (persisted in scopedStorage
            // so user A's choice doesn't follow user B after account switch).
            // Valid values: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'.
            // When unset, the server falls back to the tier default.
            const reasoningEffort = scopedStorage.getItem('reasoningEffort') || null;

            let url, payload;

            if (isDirectMode) {
                // Direct chat mode — post to custom endpoint or /ai/chat/direct/stream
                url = directMode.customEndpoint ? `${API_BASE}${directMode.customEndpoint}` : `${API_BASE}/ai/chat/direct/stream`;
                // History rule:
                //   - Edit/retry flow: send `historyOverride` so the server can
                //     truncate the conversation to the edit point.
                //   - Brand-new conversation (no conversationId): send the
                //     current in-memory history so the very first turn has it.
                //   - Persisted conversation, no override: send NO history.
                //     The server loads from `conversation_messages` instead,
                //     which is the durable source of truth and avoids drift
                //     (stripped tool messages, page-reload gaps, etc).
                let history;
                if (historyOverride) {
                    history = historyOverride.filter(m => (m.role === 'user' || m.role === 'assistant') && m.content?.trim()).map(m => ({
                        role: m.role,
                        content: m.content,
                        ...(m.attachments && m.attachments.length > 0 ? { attachments: m.attachments.map(a => ({ name: a.name, type: a.type })) } : {})
                    }));
                } else if (!currentConversation?.id) {
                    history = messagesRef.current.filter(m => (m.role === 'user' || m.role === 'assistant') && m.content?.trim()).map(m => ({
                        role: m.role,
                        content: m.content,
                        ...(m.attachments && m.attachments.length > 0 ? { attachments: m.attachments.map(a => ({ name: a.name, type: a.type })) } : {})
                    }));
                } else {
                    history = undefined;
                }
                payload = {
                    message: text,
                    conversationId: currentConversation?.id,
                    modelTier: overrideTier || directMode.modelTier || 'fast',
                    attachments,
                    ...(history !== undefined ? { history } : {}),
                    ...getNotebookPayload?.(),
                    ...(directMode.systemPrompt ? { systemPrompt: directMode.systemPrompt } : {}),
                    imageGenSettings: scopedStorage.getJSON('imageGenSettings', {}),
                    nanoBananaSettings: scopedStorage.getJSON('nanoBananaSettings', {}),
                    disabledMedia: scopedStorage.getJSON('disabledMedia', {}),
                    webSearchEnabled: (() => {
                        const v = scopedStorage.getItem('webSearchEnabled');
                        return v === null ? true : v === 'true';
                    })(),
                    ...(activeProject?.id ? { projectId: activeProject.id } : {}),
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    ...(typeof directMode.getExtraPayload === 'function' ? directMode.getExtraPayload() : {}),
                    ...(Array.isArray(activeSkillIds) && activeSkillIds.length > 0 ? { activeSkillIds } : {}),
                    ...(reasoningEffort ? { reasoningEffort } : {}),
                };
            } else {
                // Agent chat mode — post to /agents/:id/chat/stream
                const wsPayload = getNotebookPayload?.() || {};
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
                    ...(overrideTier ? { modelTier: overrideTier } : {}),
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    // When editing/retrying, send truncated history so server doesn't use full DB history
                    ...(historyOverride ? {
                        history: historyOverride.filter(m => (m.role === 'user' || m.role === 'assistant') && m.content?.trim()).map(m => ({
                            role: m.role,
                            content: m.content,
                            ...(m.attachments && m.attachments.length > 0 ? { attachments: m.attachments.map(a => ({ name: a.name, type: a.type })) } : {})
                        }))
                    } : {}),
                    ...(reasoningEffort ? { reasoningEffort } : {}),
                };
            }

            const response = await authFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            if (response.status === 403 || response.status === 401) {
                // Permissions were revoked while the user had the agent open.
                // Show a clear message rather than a generic error.
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId ? {
                        ...m,
                        isStreaming: false,
                        isError: true,
                        isPermissionDenied: true,
                        content: "⚠️ **Access denied** — you no longer have permission to use this agent. Please refresh the page."
                    } : m
                ));
                setIsLoading(false);
                return;
            }

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

                            handleSSEEventRef.current(currentEvent, data, {
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
        // Deliberately NOT in deps: `messages` (read via messagesRef), `handleSSEEvent`
        // (invoked via handleSSEEventRef). Keeping them here would recreate
        // `sendMessage` on every streamed token and break child memoization.
    }, [selectedAgent, isLoading, abortController, currentConversation, getNotebookPayload, directMode, onDirectConversationCreated, activeProject, activeSkillIds, onSessionSkillsChanged]);

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

            // Pass truncated history directly to avoid stale closure issues
            setTimeout(() => {
                sendMessage(userMsg.content, userMsg.attachments || [], false, truncated, overrideTier || null);
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

            // Pass truncated history directly to avoid stale closure issues
            setTimeout(() => {
                sendMessage(newContent.trim(), userMsg.attachments || [], false, truncated);
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
