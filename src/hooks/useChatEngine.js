import { useState, useRef, useCallback, useEffect } from 'react';
import { API_BASE, generateMessageId, authFetch } from '../utils/helpers';
import scopedStorage from '../utils/scopedStorage';
import { logger } from '../utils/logger';
import useTranslation from './useTranslation';

// rAF helpers with a setTimeout fallback for non-browser environments. Resolved
// at call time (not module load) so they pick up the real/mocked global.
const _raf = (cb) => (typeof requestAnimationFrame === 'function')
    ? requestAnimationFrame(cb)
    : setTimeout(() => cb(Date.now()), 16);
const _caf = (id) => (typeof cancelAnimationFrame === 'function')
    ? cancelAnimationFrame(id)
    : clearTimeout(id);

/**
 * Per-stream content flusher. Coalesces high-frequency 'content' tokens into at
 * most one setMessages per animation frame (~60fps) instead of one per token,
 * which previously re-rendered the whole message list on every token.
 *
 * The accumulated text lives in `contentRef` (always current — appended
 * synchronously by the caller); the flusher only controls WHEN that text is
 * committed to React state. Callers MUST flushNow() before any handler that
 * reads committed content (done/finalize/interrupt) and cancel() on abort so a
 * late frame can't resurrect text after the stream ended.
 */
export function createContentFlusher(setMessages, activeIdRef, contentRef) {
    let rafId = null;
    let pending = false;
    let latestName;
    let latestAvatar;

    const flush = () => {
        rafId = null;
        if (!pending) return;
        pending = false;
        const content = contentRef.current;
        setMessages(prev => prev.map(m =>
            m.id === activeIdRef.current ? {
                ...m,
                content,
                // First content settles the pre-LLM phase indicator (mirrors the
                // original per-token behaviour).
                currentPhase: m.currentPhase ? null : m.currentPhase,
                respondingAgentName: latestName ?? m.respondingAgentName,
                respondingAgentAvatar: latestAvatar ?? m.respondingAgentAvatar,
            } : m
        ));
    };

    return {
        // Mark new content available and ensure a frame is scheduled. `name`/
        // `avatar` carry the last-seen responder identity into the coalesced flush.
        schedule(name, avatar) {
            if (name) latestName = name;
            if (avatar) latestAvatar = avatar;
            pending = true;
            if (rafId == null) rafId = _raf(flush);
        },
        // Commit any buffered content synchronously (call before terminal events).
        flushNow() {
            if (rafId != null) { _caf(rafId); rafId = null; }
            if (pending) flush();
        },
        // Drop any buffered content + scheduled frame (call on replace/abort).
        cancel() {
            if (rafId != null) { _caf(rafId); rafId = null; }
            pending = false;
        },
    };
}

// SSE events that carry a concrete work item, mapped to the user-facing kind
// used by the interrupted/error success summaries (BFSF-221). 'notebook' is
// the agent workspace panel (workspace_update), which the server persists
// BEFORE emitting the event.
const WORK_EVENT_KINDS = {
    webpage_doc_update: 'webpage',
    webpage_extra_update: 'webpage',
    notebook_doc_update: 'document',
    slides_deck_update: 'document',
    sheet_update: 'document',
    workspace_update: 'notebook',
};

/**
 * First markdown heading in `md` (trimmed, max 80 chars), or null. Used to
 * derive a title for workspace_update payloads, which carry no explicit title.
 */
export function extractMdHeading(md) {
    if (!md) return null;
    const m = /^#{1,6}\s+(.+)$/m.exec(md);
    return m ? m[1].trim().slice(0, 80) : null;
}

/**
 * One-line "what was created" summary for a tracked work item ({ kind, title }),
 * or null when nothing was tracked. `t` is the translation function.
 */
export function summarizeWorkItem(t, wi) {
    if (!wi?.kind) return null;
    const key = wi.title ? `chat.work_summary.${wi.kind}` : `chat.work_summary.${wi.kind}_untitled`;
    return t(key, wi.title ? { title: wi.title } : undefined);
}

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
 * @param {Function} opts.onGammaPreview - Called with Gamma generation/preview data from Gamma tool results
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
    onWebpageDocUpdate,
    onWebpageSourceAdded,
    onWebpageExtraUpdate,
    onWebpageExtraDeleted,
    onGammaPreview,
    activeSkillIds,
    onSessionSkillsChanged,
    // Optional: async () => messages[] — refetch the persisted conversation so a
    // dropped stream can auto-recover the saved reply (the server persists the
    // finished message even when the SSE connection drops mid/post-stream). When
    // omitted, the interrupted notice is shown as before (no behaviour change).
    reloadConversation,
}) {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    // Active stream controller. Ref instead of state so rapid double-send
    // can synchronously read+abort the previous controller in the same tick,
    // and so changes don't recreate `sendMessage`/`stopGenerating`.
    const abortControllerRef = useRef(null);
    // The current stream's content flusher (rAF coalescer). Held in a ref so
    // stopGenerating / unmount can cancel a pending frame from outside sendMessage.
    const activeFlusherRef = useRef(null);

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

    // Keep the recovery loader current without recreating sendMessage (it's read
    // in the interrupted catch-branch). Mirrors tRef/handleSSEEventRef.
    const reloadConversationRef = useRef(reloadConversation);
    useEffect(() => { reloadConversationRef.current = reloadConversation; }, [reloadConversation]);

    // Stable refs so SSE handlers always call the latest callback
    // (avoids stale closure when parent re-renders change the callback identity)
    const onNotebookDocUpdateRef = useRef(onNotebookDocUpdate);
    useEffect(() => { onNotebookDocUpdateRef.current = onNotebookDocUpdate; }, [onNotebookDocUpdate]);

    const onNotebookSourceAddedRef = useRef(onNotebookSourceAdded);
    useEffect(() => { onNotebookSourceAddedRef.current = onNotebookSourceAdded; }, [onNotebookSourceAdded]);

    const onNotebookThemeUpdateRef = useRef(onNotebookThemeUpdate);
    useEffect(() => { onNotebookThemeUpdateRef.current = onNotebookThemeUpdate; }, [onNotebookThemeUpdate]);

    const onWebpageDocUpdateRef = useRef(onWebpageDocUpdate);
    useEffect(() => { onWebpageDocUpdateRef.current = onWebpageDocUpdate; }, [onWebpageDocUpdate]);

    const onWebpageSourceAddedRef = useRef(onWebpageSourceAdded);
    useEffect(() => { onWebpageSourceAddedRef.current = onWebpageSourceAdded; }, [onWebpageSourceAdded]);

    const onWebpageExtraUpdateRef = useRef(onWebpageExtraUpdate);
    useEffect(() => { onWebpageExtraUpdateRef.current = onWebpageExtraUpdate; }, [onWebpageExtraUpdate]);

    const onWebpageExtraDeletedRef = useRef(onWebpageExtraDeleted);
    useEffect(() => { onWebpageExtraDeletedRef.current = onWebpageExtraDeleted; }, [onWebpageExtraDeleted]);

    const onGammaPreviewRef = useRef(onGammaPreview);
    useEffect(() => { onGammaPreviewRef.current = onGammaPreview; }, [onGammaPreview]);

    const extractGammaPreview = (toolName, result) => {
        if (!toolName?.startsWith?.('gamma_')) return null;
        let parsed = result;
        if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch { return null; }
        }
        if (!parsed || typeof parsed !== 'object' || parsed.error) return null;
        if (!parsed.generationId && !parsed.gammaUrl) return null;
        return {
            generationId: parsed.generationId || null,
            status: parsed.status || (parsed.gammaUrl ? 'completed' : 'pending'),
            gammaId: parsed.gammaId || null,
            gammaUrl: parsed.gammaUrl || null,
            exportUrl: parsed.exportUrl || null,
            templateGammaId: parsed.templateGammaId || null,
            templateUrl: parsed.templateUrl || null,
            sourceTool: toolName,
        };
    };

    // Cleanup abort controller on unmount. Mount-only effect — the ref
    // always points at the current controller, so we don't need to re-run.
    useEffect(() => {
        return () => {
            const c = abortControllerRef.current;
            if (c) {
                logger.debug('[useChatEngine] Unmounting, aborting active stream');
                c.abort();
                abortControllerRef.current = null;
            }
            // Cancel any scheduled content frame so it can't fire post-unmount.
            activeFlusherRef.current?.cancel();
            activeFlusherRef.current = null;
        };
    }, []);

    // --- SSE Event Handlers ---

    const handleSSEEvent = useCallback((event, data, ids) => {
        const { assistantMsgId, userMsgId, activeIdRef, contentRef, flusher, workRef } = ids;

        // DEBUG: log non-content events to help debug LinkedIn draft issue
        if (event !== 'content' && event !== 'thinking' && event !== 'ping') {
            logger.debug('[SSE Event]', event, data);
        }

        switch (event) {
            case 'ping':
                // SSE keepalive heartbeat (see server startSseHeartbeat). No-op —
                // its only job is to keep the connection warm through proxies so a
                // long, silent tool loop isn't idle-timed-out.
                break;

            case 'content':
                if (data.text) {
                    // Append synchronously to the ref (always current), but defer
                    // the React state commit to the next animation frame so a fast
                    // token stream re-renders at ~60fps instead of per-token. The
                    // flush settles the pre-LLM phase indicator and carries the
                    // last-seen responder name/avatar — see createContentFlusher.
                    contentRef.current += data.text;
                    flusher.schedule(data.respondingAgentName, data.respondingAgentAvatar);
                }
                break;

            case 'phase':
                // Pre-LLM progress signal from any chat runtime. We render a
                // single rotating status line above the typing dots so users
                // see what is happening (KB search, attachment OCR, etc.)
                // instead of a silent stall before the first token.
                logger.debug('[phase]', data.stage, data.status, data.detail || '', '→ msgId', activeIdRef.current);
                setMessages(prev => {
                    let updated = false;
                    const next = prev.map(m => {
                        if (m.id !== activeIdRef.current) return m;
                        if (data.status === 'end' && m.currentPhase?.stage !== data.stage) return m;
                        const phase = (data.status === 'end' || data.stage === 'streaming_start')
                            ? null
                            : { stage: data.stage, detail: data.detail || null, startedAt: Date.now() };
                        updated = true;
                        return { ...m, currentPhase: phase };
                    });
                    if (!updated) console.warn('[phase] no message matched activeIdRef', activeIdRef.current, 'msgIds=', prev.map(p => p.id));
                    return next;
                });
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

            case 'content_replace':
                // Allow empty string to clear content (e.g. clearing intermediate tool-call planning text)
                if (data.text !== undefined) {
                    // Drop any pending append flush — the replace is authoritative
                    // and must not be clobbered by a late frame carrying old text.
                    flusher.cancel();
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

            // ── Swarm tier (Deep Research) ──────────────────────────────
            case 'swarm_started':
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId
                        ? {
                            ...m,
                            swarm: {
                                state: 'running',
                                swarmId: data.swarmId,
                                swarmName: data.swarmName,
                                phases: Array.isArray(data.phases) ? data.phases : [],
                                phaseStates: {},
                                depth: data.depth || null,
                                startedAt: Date.now(),
                            },
                        }
                        : m
                ));
                break;
            case 'swarm_phase_started':
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId
                        ? {
                            ...m,
                            swarm: {
                                ...(m.swarm || {}),
                                activePhaseId: data.phaseId,
                                phaseStates: {
                                    ...(m.swarm?.phaseStates || {}),
                                    [data.phaseId]: { status: 'active', message: data.message || null, startedAt: Date.now() },
                                },
                            },
                        }
                        : m
                ));
                break;
            case 'swarm_phase_completed':
                setMessages(prev => prev.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    const prev2 = m.swarm?.phaseStates?.[data.phaseId] || {};
                    return {
                        ...m,
                        swarm: {
                            ...(m.swarm || {}),
                            phaseStates: {
                                ...(m.swarm?.phaseStates || {}),
                                [data.phaseId]: { ...prev2, status: 'done', durationMs: data.durationMs || null },
                            },
                        },
                    };
                }));
                break;
            case 'swarm_clarification_required':
                // The swarm asked the user a follow-up question. Surface it
                // on the in-flight assistant message; the chat UI renders
                // these inline so the user can answer in the next turn.
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId
                        ? {
                            ...m,
                            swarm: {
                                ...(m.swarm || {}),
                                state: 'awaiting_clarification',
                                clarification: {
                                    questions: Array.isArray(data?.questions) ? data.questions : [],
                                    refinedQuery: data?.refinedQuery || null,
                                },
                            },
                        }
                        : m
                ));
                break;
            case 'swarm_completed':
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId
                        ? {
                            ...m,
                            swarm: {
                                ...(m.swarm || {}),
                                state: data?.paused ? 'awaiting_clarification' : 'done',
                                durationMs: data?.durationMs || null,
                                error: data?.error || null,
                            },
                        }
                        : m
                ));
                break;
            // Per-worker streaming events — researcher tokens flow into
            // their own card; the synthesiser sends ordinary `content` so
            // its tokens show up in the assistant message body directly.
            case 'swarm_worker_started':
                setMessages(prev => prev.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    const workers = { ...(m.swarm?.workers || {}) };
                    workers[data.workerId] = {
                        workerId: data.workerId,
                        role: data.role,
                        name: data.name,
                        tier: data.tier,
                        modelId: data.modelId,
                        status: 'running',
                        content: '',
                        tools: [],
                        startedAt: Date.now(),
                    };
                    return { ...m, swarm: { ...(m.swarm || {}), workers } };
                }));
                break;
            case 'swarm_worker_content':
                setMessages(prev => prev.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    const workers = { ...(m.swarm?.workers || {}) };
                    const w = workers[data.workerId];
                    if (!w) return m;
                    workers[data.workerId] = { ...w, content: (w.content || '') + (data.delta || '') };
                    return { ...m, swarm: { ...(m.swarm || {}), workers } };
                }));
                break;
            case 'swarm_worker_tool':
                setMessages(prev => prev.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    const workers = { ...(m.swarm?.workers || {}) };
                    const w = workers[data.workerId];
                    if (!w) return m;
                    const tools = Array.isArray(w.tools) ? [...w.tools] : [];
                    if (data.status === 'start') {
                        tools.push({ name: data.toolName, status: 'running', at: Date.now() });
                    } else {
                        const idx = [...tools].reverse().findIndex(t => t.name === data.toolName && t.status === 'running');
                        if (idx >= 0) {
                            const realIdx = tools.length - 1 - idx;
                            tools[realIdx] = { ...tools[realIdx], status: data.status };
                        }
                    }
                    workers[data.workerId] = { ...w, tools };
                    return { ...m, swarm: { ...(m.swarm || {}), workers } };
                }));
                break;
            case 'swarm_worker_completed':
                setMessages(prev => prev.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    const workers = { ...(m.swarm?.workers || {}) };
                    const w = workers[data.workerId];
                    if (!w) return m;
                    workers[data.workerId] = {
                        ...w,
                        status: data.status || 'done',
                        durationMs: data.durationMs || null,
                        error: data.error || null,
                    };
                    return { ...m, swarm: { ...(m.swarm || {}), workers } };
                }));
                break;

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
                {
                    const gammaPreview = extractGammaPreview(data.name, data.result);
                    if (gammaPreview) onGammaPreviewRef.current?.(gammaPreview);
                }
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
                // Server emits this on every turn now. `fromAuto` tells us
                // whether the user was on Auto (so we render "Auto → Fast")
                // versus a pinned tier (where we just show the model name).
                setMessages(prev => prev.map(m =>
                    m.id === activeIdRef.current ? {
                        ...m,
                        modelId: data.modelId || m.modelId,
                        modelTier: data.tier || m.modelTier,
                        autoSelectedTier: data.fromAuto ? data.tier : m.autoSelectedTier,
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
                logger.debug('[DEBUG] linkedin_draft event received!', data, 'assistantMsgId:', assistantMsgId);
                setMessages(prev => {
                    const updated = prev.map(m =>
                        m.id === assistantMsgId ? {
                            ...m,
                            linkedInDrafts: [...(m.linkedInDrafts || []), { ...data, status: 'pending' }]
                        } : m
                    );
                    logger.debug('[DEBUG] Messages after linkedin_draft update:', updated.map(m => ({ id: m.id, hasLinkedInDrafts: !!m.linkedInDrafts, linkedInDraftsCount: m.linkedInDrafts?.length })));
                    return updated;
                });
                break;

            case 'calendar_draft': {
                // Key on the real draft fields (action/title/startTime/endTime/
                // eventId); summary/start/end are never present so the old key
                // deduped nothing and duplicate cards stacked up (BFSF-123).
                const calKey = (d) => JSON.stringify({ action: d?.action, title: d?.title, startTime: d?.startTime, endTime: d?.endTime, eventId: d?.eventId });
                const draftKey = calKey(data);
                setMessages(prev => prev.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    const existing = m.calendarDrafts || [];
                    if (existing.some(d => calKey(d) === draftKey)) return m;
                    return { ...m, calendarDrafts: [...existing, { ...data, status: 'pending' }] };
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

            // Webpage-specific events (file: 'html'|'css'|'js', content: string)
            case 'webpage_doc_update':
                onWebpageDocUpdateRef.current?.({ file: data.file, content: data.content, title: data.title });
                break;

            case 'webpage_source_added':
                onWebpageSourceAddedRef.current?.(data.source);
                break;

            // Multi-file events: extra-file create/update or delete.
            case 'webpage_extra_update':
                onWebpageExtraUpdateRef.current?.({ path: data.path, meta: data.meta });
                break;

            case 'webpage_extra_deleted':
                onWebpageExtraDeletedRef.current?.({ path: data.path });
                break;

            // DB tool wrote — re-broadcast as a DOM event so the open DB
            // viewer (if mounted) can refresh its schema/rows. Avoids drilling
            // a callback through the chat → IDE → viewer prop chain.
            case 'webpage_db_update':
                try { window.dispatchEvent(new CustomEvent('webpage_db_update')); } catch (_) {}
                break;

            // The AI switched this project's framework / runtime tier. Re-broadcast
            // as a DOM event so the page can update settings + recompose the
            // preview without drilling a callback through the prop chain.
            case 'webpage_framework_changed':
                try { window.dispatchEvent(new CustomEvent('webpage_framework_changed', { detail: { framework: data.framework } })); } catch (_) {}
                break;
            case 'webpage_runtime_changed':
                try { window.dispatchEvent(new CustomEvent('webpage_runtime_changed', { detail: { runtime: data.runtime } })); } catch (_) {}
                break;

            // Webpage plan proposal — attach to the in-flight assistant message
            // so the chat can render an approval card. The user will click
            // Approve/Reject and the plan card flips status; on Approve a new
            // chat send is fired with planExecution: { planId, action: 'execute' }.
            case 'webpage_plan_proposed':
                if (data && data.planId && data.plan) {
                    const planEntry = { planId: data.planId, plan: data.plan, status: 'pending' };
                    setMessages(prev => {
                        if (!prev || prev.length === 0) return prev;
                        for (let i = prev.length - 1; i >= 0; i--) {
                            if (prev[i].role === 'assistant') {
                                return [
                                    ...prev.slice(0, i),
                                    { ...prev[i], webpagePlan: planEntry },
                                    ...prev.slice(i + 1),
                                ];
                            }
                        }
                        return prev;
                    });
                }
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
                // Commit any buffered tokens before finalizing — 'done' preserves
                // m.content, so a not-yet-flushed tail would otherwise be lost.
                flusher.flushNow();
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
                // Drop any pending append so it can't overwrite the error message.
                flusher.cancel();
                const errMsg = typeof data.error === 'string' ? data.error : (data.error?.message || JSON.stringify(data.error) || 'An error occurred');
                // If work was already produced before the error, lead with what
                // was created so the error doesn't read as "nothing happened"
                // and trigger a duplicate retry (BFSF-221).
                const summary = summarizeWorkItem(tRef.current, workRef?.current);
                setMessages(prev => prev.map(m =>
                    m.id === assistantMsgId ? {
                        ...m,
                        content: summary ? summary + '\n\n' + errMsg : errMsg,
                        isStreaming: false,
                        isError: true,
                        ...(summary ? { workItem: workRef.current } : {}),
                    } : m
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
                const attachments = Array.isArray(data?.attachments) ? data.attachments : null;
                // `pii_tokenized` now fires for both message-level PII and
                // attachment-level (Privacy Shield) detections. Merge with
                // any prior tokenisationInfo rather than replacing it — the
                // two paths can both fire on the same turn (user text + PDF).
                setMessages(prev => prev.map(m => {
                    if (m.id === userMsgId) {
                        return { ...m, piiTokenizedCount: (m.piiTokenizedCount || 0) + count, piiCategories: [...new Set([...(m.piiCategories || []), ...categories])] };
                    }
                    if (m.id === assistantMsgId) {
                        const prevInfo = m.tokenisationInfo || null;
                        const mergedCats = [...new Set([...(prevInfo?.categories || []), ...categories])];
                        const mergedCount = (prevInfo?.count || 0) + count;
                        const info = {
                            source: data?.source || prevInfo?.source || 'pii',
                            action: prevInfo?.action || 'redact',
                            count: mergedCount,
                            categories: mergedCats,
                            provider: prevInfo?.provider || null,
                            automatic: prevInfo ? !!prevInfo.automatic : true,
                            // Attachments list (per-file detail) — only set when this
                            // event carries it. Existing per-file entries are
                            // preserved so a second event doesn't blow them away.
                            attachments: attachments
                                ? [...(prevInfo?.attachments || []), ...attachments]
                                : (prevInfo?.attachments || undefined),
                            tokenMap: prevInfo?.tokenMap || undefined,
                            tokenizedPrompt: prevInfo?.tokenizedPrompt || undefined,
                            rawResponse: prevInfo?.rawResponse || undefined,
                            rawTruncated: prevInfo?.rawTruncated,
                        };
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
            case 'privacy_token_map': {
                // Explicit { token: realValue } mapping. Server-gated by org `showRawPayload`.
                // Lets the privacy panel render an exact "[name_1] → Gerard" table.
                const incoming = data?.tokenMap || {};
                if (Object.keys(incoming).length === 0) break;
                setMessages(prev => prev.map(m => m.id === assistantMsgId
                    ? { ...m, tokenisationInfo: { ...(m.tokenisationInfo || {}), tokenMap: { ...(m.tokenisationInfo?.tokenMap || {}), ...incoming } } }
                    : m));
                break;
            }
            case 'tokenisation_info': {
                // Server-synthesised tokenisation info for actions that don't
                // fire `dlp_resolved` (restore: AI echoed tokens this turn;
                // protected: conv vault non-empty even when no token activity
                // this turn). Carries count/action/categories/tokenMap so the
                // pill and Privacy panel render live, not only after refresh.
                if (!data || typeof data !== 'object') break;
                setMessages(prev => prev.map(m => m.id === assistantMsgId
                    ? { ...m, tokenisationInfo: { ...(m.tokenisationInfo || {}), ...data, tokenMap: { ...(m.tokenisationInfo?.tokenMap || {}), ...(data.tokenMap || {}) } } }
                    : m));
                break;
            }
            case 'dlp_blocked': {
                window.dispatchEvent(new CustomEvent('beeflow:dlp_blocked', { detail: data }));
                const reason = data?.reason || 'policy';
                let msg;
                if (reason === 'attachment_pii') {
                    const cats = Array.isArray(data?.categories) ? data.categories.join(', ') : '';
                    const file = data?.filename ? ` in “${data.filename}”` : '';
                    msg = tRef.current('dlp.blocked_attachment_pii',
                        `Attachment blocked: sensitive data (${cats || 'PII'}) was detected${file}. Please remove the PII and re-upload.`);
                } else {
                    const labelKey = reason === 'timeout' ? 'dlp.blocked_timeout'
                        : reason === 'user_blocked' ? 'dlp.blocked_user'
                        : 'dlp.blocked_policy';
                    msg = tRef.current(labelKey, {
                        timeout: 'Blocked: DLP decision timed out.',
                        user_blocked: 'Prompt blocked by you.',
                        policy: 'Prompt blocked by data-loss-prevention policy.',
                    }[reason] || 'Prompt blocked by DLP.');
                }
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
                // Drop any pending append — the canned response is authoritative.
                flusher.cancel();
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

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        const controller = new AbortController();
        abortControllerRef.current = controller;
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
        // Per-stream rAF coalescer for 'content' tokens (see createContentFlusher).
        const flusher = createContentFlusher(setMessages, activeIdRef, contentRef);
        activeFlusherRef.current = flusher;
        // Tracks whether the stream produced any real work (content/tool/build
        // events) before it ended. Used so a stream that drops AFTER work was
        // already in flight (e.g. a long webpage/notebook build that tripped a
        // proxy idle-timeout) isn't misreported as a hard failure (BFSF-221).
        let producedWork = false;
        // Last work item ({ kind, title }) seen on this stream, so the
        // interrupted/error notices can say WHAT was produced (BFSF-221).
        const workRef = { current: null };

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
                    memoryWriteEnabled: (() => {
                        const v = scopedStorage.getItem('memoryWriteEnabled');
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
                    memoryWriteEnabled: (() => {
                        const v = scopedStorage.getItem('memoryWriteEnabled');
                        return v === null ? true : v === 'true';
                    })(),
                    webSearchEnabled: (() => {
                        const v = scopedStorage.getItem('webSearchEnabled');
                        return v === null ? true : v === 'true';
                    })(),
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

            const processLine = (line) => {
                if (line.startsWith('event: ')) {
                    currentEvent = line.slice(7).trim();
                } else if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));

                        // Note any event that represents real progress, so a
                        // later stream drop can be reported as "interrupted"
                        // rather than a blanket failure (BFSF-221).
                        if ([
                            'content', 'content_replace', 'tool_start', 'tool_end',
                            'webpage_doc_update', 'webpage_doc_partial', 'webpage_extra_update',
                            'workspace_update', 'notebook_doc_update', 'slides_deck_update',
                            'sheet_update', 'image', 'calendar_draft', 'linkedin_draft',
                        ].includes(currentEvent)) {
                            producedWork = true;
                        }

                        // Capture WHAT was produced (kind + best-known title) so the
                        // interrupted/error notices can name it. Latest event wins; a
                        // titleless follow-up of the same kind keeps the earlier title.
                        const kind = WORK_EVENT_KINDS[currentEvent];
                        if (kind) {
                            const prev = workRef.current;
                            const title = data.title
                                || (currentEvent === 'workspace_update' ? extractMdHeading(data.content) : null)
                                || (prev?.kind === kind ? prev.title : null);
                            workRef.current = { kind, title };
                        }

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
                            contentRef,
                            flusher,
                            workRef
                        });
                    } catch (e) {
                        console.debug('[useChatEngine] SSE event parse skipped', currentEvent, e);
                    }
                }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) processLine(line);
            }

            // Drain the decoder and process any final event left in the buffer.
            // The server's terminal `done` event can arrive in the last chunk
            // without a trailing newline; breaking on `done` without flushing left
            // the message stuck in isStreaming:true so the notebook edit was never
            // applied and the chat never finalized (BFSF-177).
            buffer += decoder.decode();
            if (buffer) {
                for (const line of buffer.split('\n')) processLine(line);
            }

            // Commit any final buffered tokens if the stream ended without a
            // terminal 'done' event (it preserves m.content otherwise).
            flusher.flushNow();
            setIsLoading(false);
            setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, isStreaming: false } : m
            ));

        } catch (err) {
            // Commit buffered tokens before the interrupt/error branch reads
            // m.content, so the prior content prepended to the notice is complete.
            flusher.flushNow();
            if (err.name !== 'AbortError') {
                console.error("Chat error", err);
                // If the stream already produced content/tool/build activity,
                // it most likely dropped after the work was underway (e.g. a long
                // webpage/notebook build that tripped a proxy idle-timeout) — the
                // result may well have been saved. Surface a non-fatal "interrupted"
                // notice instead of masquerading it as a hard failure (BFSF-221).
                const interrupted = producedWork || !!contentRef.current?.trim();
                setMessages(prev => prev.map(m => {
                    if (m.id !== assistantMsgId) return m;
                    if (interrupted) {
                        const prior = (m.content && m.content.trim()) ? m.content.trimEnd() + '\n\n' : '';
                        // When we know WHAT was produced, lead with an explicit
                        // success confirmation so users don't retry and duplicate.
                        const wi = workRef.current;
                        const summary = summarizeWorkItem(tRef.current, wi);
                        const notice = summary
                            ? tRef.current('chat.interrupted_with_work', { workSummary: summary })
                            : tRef.current('chat.interrupted_generic');
                        return {
                            ...m,
                            isStreaming: false,
                            isInterrupted: true,
                            workItem: wi || null,
                            content: prior + notice,
                        };
                    }
                    return { ...m, isStreaming: false, isError: true, content: 'Error generating response.' };
                }));
                setIsLoading(false);

                // Auto-recover: the server persists the finished reply even when
                // the SSE connection drops mid/post-stream (confirmed — the saved
                // message appears on a manual refresh). Poll the persisted
                // conversation and swap the real reply in so the user doesn't have
                // to refresh. Bounded (~60s); bails if the user moved on; the
                // interrupted notice stays if recovery never yields a saved reply.
                const _reload = reloadConversationRef.current;
                if (interrupted && typeof _reload === 'function') {
                    (async () => {
                        const stillOurs = () => {
                            const c = messagesRef.current;
                            const l = c[c.length - 1];
                            return !!(l && l.id === assistantMsgId && l.isInterrupted);
                        };
                        // Quick first attempt, then every 4s up to ~60s total.
                        const delays = [1200, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000];
                        for (const d of delays) {
                            await new Promise(r => setTimeout(r, d));
                            if (!stillOurs()) return;
                            let reloaded;
                            try { reloaded = await _reload(); } catch { continue; }
                            if (!Array.isArray(reloaded) || reloaded.length === 0) continue;
                            const lastReload = reloaded[reloaded.length - 1];
                            if (lastReload && lastReload.role === 'assistant' && String(lastReload.content || '').trim()) {
                                if (stillOurs()) setMessages(reloaded);
                                return;
                            }
                        }
                    })();
                }
            }
        } finally {
            // Release the controller once the stream is done (success, error, or
            // abort). Leaving it set means the next send would needlessly call
            // .abort() on an already-finished controller.
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
            }
            // Drop the flusher reference (guard against a newer concurrent stream
            // having replaced it) so stopGenerating can't act on a dead stream.
            flusher.cancel();
            if (activeFlusherRef.current === flusher) {
                activeFlusherRef.current = null;
            }
        }
        // Deliberately NOT in deps: `messages` (read via messagesRef), `handleSSEEvent`
        // (invoked via handleSSEEventRef). Keeping them here would recreate
        // `sendMessage` on every streamed token and break child memoization.
    }, [selectedAgent, isLoading, currentConversation, getNotebookPayload, directMode, onDirectConversationCreated, activeProject, activeSkillIds, onSessionSkillsChanged]);

    const stopGenerating = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        // Cancel any pending content frame so a late flush can't resurrect
        // streaming text after the user stopped generation.
        activeFlusherRef.current?.cancel();
        setIsLoading(false);
        setMessages(prev => prev.map(m =>
            m.isStreaming ? { ...m, isStreaming: false } : m
        ));
    }, []);

    /**
     * Retry: regenerate the AI response at `messageIndex`.
     * Truncates that AI message and everything after it,
     * then re-sends the preceding user message.
     * @param {number} messageIndex - Index of the assistant message to retry
     * @param {string} [overrideTier] - Optional model tier override (e.g. 'fast', 'think')
     */
    const retryMessage = useCallback((messageIndex, overrideTier) => {
        if (isLoading) return;

        // Compute truncation outside the state updater so the side-effect
        // (sendMessage) runs exactly once — React 19 StrictMode double-invokes
        // updater functions, which would otherwise fire sendMessage twice.
        const currentMessages = messagesRef.current;
        const visibleMessages = currentMessages.filter(m => !m.parentId);
        const assistantMsg = visibleMessages[messageIndex];
        if (!assistantMsg || assistantMsg.role !== 'assistant') return;

        let userMsgIndex = messageIndex - 1;
        while (userMsgIndex >= 0 && visibleMessages[userMsgIndex]?.role !== 'user') {
            userMsgIndex--;
        }
        const userMsg = visibleMessages[userMsgIndex];
        if (!userMsg) return;

        const userIdx = currentMessages.indexOf(userMsg);
        const truncated = currentMessages.slice(0, userIdx);

        setMessages(truncated);
        setTimeout(() => {
            sendMessage(userMsg.content, userMsg.attachments || [], false, truncated, overrideTier || null);
        }, 50);
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

        const currentMessages = messagesRef.current;
        const visibleMessages = currentMessages.filter(m => !m.parentId);
        const userMsg = visibleMessages[messageIndex];
        if (!userMsg || userMsg.role !== 'user') return;

        const userIdx = currentMessages.indexOf(userMsg);
        const truncated = currentMessages.slice(0, userIdx);

        setMessages(truncated);
        setTimeout(() => {
            sendMessage(newContent.trim(), userMsg.attachments || [], false, truncated);
        }, 50);
    }, [isLoading, sendMessage]);

    return {
        messages,
        setMessages,
        isLoading,
        sendMessage,
        stopGenerating,
        retryMessage,
        editAndRegenerate,
    };
}
