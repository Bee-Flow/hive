import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';

// Shown when the build stream drops mid-flight (gateway timeout / network
// cut). Every mutation is persisted server-side as it lands, so nothing is
// lost — guide the user instead of surfacing a raw "HTTP 504".
const STREAM_DROP_MESSAGE = 'The connection to the AI builder dropped while it was working. Your pages are already saved — send your message again to continue.';

/**
 * SSE hook for the CMS page-building assistant — a trimmed clone of
 * useAppBuilderStream (no plans/phases/checkpoints/data_model: pages are
 * small; one turn = one action). The hook holds ONLY the chat transcript;
 * the ProductWebsitePanel owns the document state and folds `draft` events
 * in via its panel bridge.
 *
 * useCmsBuilderStream({ siteId, onDraft, onToolCall, onDone, onError })
 *   → { messages, running, send, stop, sessionId, lastValidation }
 *
 *   onDraft(evt)        — { siteId, kind:'site', site } |
 *                         { siteId, kind:'page', pageId, page }
 *                         (server-persisted — fold in WITHOUT scheduling saves)
 *   onToolCall(tc)      — { name, label, ok, summary } (the panel mirrors
 *                         cms_remove_block's override prune locally)
 *   onDone(info)        — { siteId, createdPageIds, touchedPageIds }
 *   onError(msg, code?) — code ∈ subscription_limit | rate_limited |
 *                         model_unavailable | transient_upstream |
 *                         budget_exhausted | internal; undefined on raw drops
 *
 * send(text, { modelTier?, context? }); stop() aborts the in-flight stream
 * (the server halts its loop on disconnect — everything already applied
 * stays applied).
 *
 * Rehydrates from GET /api/cms/builder/session/:siteId on mount / site
 * switch (the session is SITE-scoped and shared between admins).
 */
export default function useCmsBuilderStream({ siteId, onDraft, onToolCall, onDone, onError } = {}) {
    const [messages, setMessages] = useState([]);
    const [running, setRunning] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [lastValidation, setLastValidation] = useState(null);

    const abortRef = useRef(null);
    const sessionIdRef = useRef(null);

    const onDraftRef = useRef(onDraft);
    onDraftRef.current = onDraft;
    const onToolCallRef = useRef(onToolCall);
    onToolCallRef.current = onToolCall;
    const onDoneRef = useRef(onDone);
    onDoneRef.current = onDone;
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    // ---- rehydrate a prior session (refresh / site switch) ------------------
    useEffect(() => {
        if (!siteId) return undefined;
        let alive = true;
        setMessages([]);
        setSessionId(null);
        sessionIdRef.current = null;
        setLastValidation(null);
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/api/cms/builder/session/${encodeURIComponent(siteId)}`);
                if (!res.ok) return; // 404 = no session yet → fresh chat
                const j = await res.json().catch(() => null);
                const snap = j?.snapshot;
                if (!alive || !snap) return;
                if (Array.isArray(snap.messages)) {
                    setMessages(snap.messages.filter((m) => m && typeof m === 'object'));
                }
                if (snap.sessionId) {
                    sessionIdRef.current = snap.sessionId;
                    setSessionId(snap.sessionId);
                }
                if (snap.lastValidation) setLastValidation(snap.lastValidation);
            } catch {
                // degrade to a fresh chat
            }
        })();
        return () => { alive = false; };
    }, [siteId]);

    // Abort an in-flight stream on unmount.
    useEffect(() => () => {
        try { abortRef.current?.abort(); } catch { /* already settled */ }
    }, []);

    /** Patch the current turn's assistant message (last non-tool assistant item). */
    const patchAssistant = useCallback((fn) => {
        setMessages((msgs) => {
            const next = msgs.slice();
            for (let i = next.length - 1; i >= 0; i--) {
                const m = next[i];
                if (m && m.role === 'assistant' && !m.kind) {
                    next[i] = fn({ ...m });
                    return next;
                }
            }
            next.push(fn({ role: 'assistant', content: '', thinkingParts: [], isStreaming: true }));
            return next;
        });
    }, []);

    const send = useCallback(async (text, options = {}) => {
        const message = typeof text === 'string' ? text.trim() : '';
        if (!message || !siteId) return;

        if (abortRef.current) {
            try { abortRef.current.abort(); } catch { /* already settled */ }
        }
        const ac = new AbortController();
        abortRef.current = ac;

        let sawDone = false;
        let errored = false;
        const failTurn = (msg, code) => {
            errored = true;
            setMessages((msgs) => [...msgs, { kind: 'error', message: msg, code }]);
            onErrorRef.current?.(msg, code);
        };

        setRunning(true);
        setLastValidation(null);
        setMessages((msgs) => [
            ...finalizeStreaming(msgs),
            { role: 'user', content: message },
            { role: 'assistant', content: '', thinkingParts: [], isStreaming: true },
        ]);

        const handle = (event, data) => {
            switch (event) {
                case 'builder_session':
                    if (data.sessionId) {
                        sessionIdRef.current = data.sessionId;
                        setSessionId(data.sessionId);
                    }
                    break;
                case 'model_selected':
                    patchAssistant((m) => ({ ...m, autoSelectedTier: data.tier }));
                    break;
                case 'message':
                    patchAssistant((m) => ({ ...m, content: (m.content || '') + (data.content || '') }));
                    break;
                case 'thinking_start':
                    patchAssistant((m) => {
                        const parts = Array.isArray(m.thinkingParts) ? [...m.thinkingParts] : [];
                        parts.push({ id: `t${parts.length}`, text: '', startedAt: Date.now(), endedAt: null });
                        return { ...m, thinkingParts: parts, isStreaming: true, thinkingStartedAt: m.thinkingStartedAt || Date.now() };
                    });
                    break;
                case 'thinking':
                    patchAssistant((m) => {
                        const parts = Array.isArray(m.thinkingParts) ? [...m.thinkingParts] : [];
                        let part = null;
                        for (let i = parts.length - 1; i >= 0; i--) {
                            if (!parts[i].endedAt) { part = { ...parts[i] }; parts[i] = part; break; }
                        }
                        if (!part) {
                            part = { id: `t${parts.length}`, text: '', startedAt: Date.now(), endedAt: null };
                            parts.push(part);
                        }
                        part.text = (part.text || '') + (data.delta || '');
                        return { ...m, thinkingParts: parts, isStreaming: true, thinkingStartedAt: m.thinkingStartedAt || Date.now() };
                    });
                    break;
                case 'thinking_stop':
                    patchAssistant((m) => ({
                        ...m,
                        thinkingParts: (Array.isArray(m.thinkingParts) ? m.thinkingParts : [])
                            .map((p) => (p.endedAt ? p : { ...p, endedAt: Date.now() })),
                        thinkingEndedAt: Date.now(),
                    }));
                    break;
                case 'tool_call': {
                    const tc = {
                        kind: 'tool',
                        name: data.name,
                        label: data.label || data.name,
                        ok: data.ok !== false,
                        summary: data.summary || '',
                    };
                    setMessages((msgs) => [...msgs, tc]);
                    onToolCallRef.current?.(tc);
                    break;
                }
                case 'draft':
                    onDraftRef.current?.(data);
                    break;
                case 'validation_errors':
                    setLastValidation({ errors: data.errors || [], warnings: data.warnings || [] });
                    break;
                case 'usage':
                    patchAssistant((m) => ({
                        ...m,
                        usage: { inputTokens: data.inputTokens, outputTokens: data.outputTokens },
                    }));
                    break;
                case 'done':
                    sawDone = true;
                    onDoneRef.current?.({
                        siteId: data.siteId,
                        createdPageIds: Array.isArray(data.createdPageIds) ? data.createdPageIds : [],
                        touchedPageIds: Array.isArray(data.touchedPageIds) ? data.touchedPageIds : [],
                    });
                    break;
                case 'error':
                    failTurn(data.message || 'The AI builder ran into a problem.', data.code);
                    break;
                default:
                    break;
            }
        };

        try {
            const resp = await authFetch(`${API_BASE}/api/cms/builder/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    siteId,
                    builderSessionId: sessionIdRef.current || undefined,
                    modelTier: options.modelTier || 'auto',
                    context: options.context && typeof options.context === 'object' ? options.context : undefined,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam',
                }),
                signal: ac.signal,
            });
            if (!resp.ok || !resp.body) {
                const isGateway = resp.status === 504 || resp.status === 502 || resp.status === 408;
                failTurn(isGateway ? STREAM_DROP_MESSAGE : (await safeText(resp)) || `HTTP ${resp.status}`);
            } else {
                const reader = resp.body.getReader();
                const decoder = new TextDecoder();
                let buf = '';
                let currentEvent = 'message';
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, { stream: true });
                    const lines = buf.split('\n');
                    buf = lines.pop();
                    for (const line of lines) {
                        if (line.startsWith('event: ')) {
                            currentEvent = line.slice(7).trim();
                        } else if (line.startsWith('data: ')) {
                            let data;
                            try { data = JSON.parse(line.slice(6)); } catch { continue; }
                            handle(currentEvent, data);
                        }
                    }
                }
                if (!sawDone && !errored) failTurn(STREAM_DROP_MESSAGE);
            }
        } catch (e) {
            if (e.name === 'AbortError') {
                // User pressed Stop — everything the server applied stays
                // applied; the turn just ends here.
                if (!sawDone && !errored) {
                    onDoneRef.current?.({ siteId, createdPageIds: [], touchedPageIds: [], stopped: true });
                }
            } else if (!errored) {
                const looksLikeDrop = /network|fetch|terminated|timeout|aborted|closed/i.test(e.message || '');
                failTurn(looksLikeDrop ? STREAM_DROP_MESSAGE : (e.message || 'Stream failed'));
            }
        }

        setRunning(false);
        setMessages((msgs) => finalizeStreaming(msgs));
    }, [siteId, patchAssistant]);

    const stop = useCallback(() => {
        try { abortRef.current?.abort(); } catch { /* already settled */ }
    }, []);

    return { messages, running, send, stop, sessionId, lastValidation };
}

/** Settle streaming flags + reasoning end time once a stream stops. */
function finalizeStreaming(messages) {
    if (!messages.some((m) => m && m.isStreaming)) return messages;
    return messages.map((m) => (m && m.isStreaming
        ? {
            ...m,
            isStreaming: false,
            thinkingEndedAt: m.thinkingEndedAt || (m.thinkingStartedAt ? Date.now() : undefined),
            thinkingParts: (m.thinkingParts || []).map((p) => (p.endedAt ? p : { ...p, endedAt: Date.now() })),
        }
        : m));
}

async function safeText(r) {
    try {
        const j = await r.json();
        return j.error || j.message || JSON.stringify(j);
    } catch {
        return r.statusText;
    }
}
