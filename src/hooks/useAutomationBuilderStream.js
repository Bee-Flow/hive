import { useCallback, useRef, useState } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';

/**
 * SSE hook for the conversational automation builder.
 *
 * Mirrors the SSE-reader pattern from useChatEngine.js but trimmed down to
 * just the events the builder emits: builder_session, message, tool_call,
 * draft, summary, dryrun, finalized, done, error.
 *
 * Usage:
 *   const { send, state, reset } = useAutomationBuilderStream();
 *   await send({ message: '...', modelTier: 'fast' });
 *   // state.messages, state.draft, state.dryRun, state.finalizedId update live
 */
export default function useAutomationBuilderStream(initial = {}) {
    const [state, setState] = useState({
        builderSessionId: null,
        automationId: initial.automationId || null,
        messages: [],          // [{ role, content, toolCalls? }]
        draft: initial.draft || null,
        summary: '',
        hasSideEffects: false,
        dryRun: null,
        steps: [],
        finalizedId: null,
        running: false,
        error: null,
    });
    const abortRef = useRef(null);

    const reset = useCallback(() => {
        setState(s => ({ ...s, messages: [], draft: null, summary: '', dryRun: null, steps: [], finalizedId: null, error: null }));
    }, []);

    const send = useCallback(async ({ message, modelTier = 'auto', timezone, history, attachments = [], webSearchEnabled = true, disabledMedia = {} }) => {
        if (abortRef.current) {
            try { abortRef.current.abort(); } catch {}
        }
        const ac = new AbortController();
        abortRef.current = ac;

        setState(s => ({
            ...s,
            running: true,
            error: null,
            messages: [...s.messages, { role: 'user', content: message }, { role: 'assistant', content: '', toolCalls: [] }],
        }));

        try {
            const resp = await authFetch(`${API_BASE}/api/automation/builder/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    modelTier,
                    timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam',
                    builderSessionId: state.builderSessionId,
                    automationId: state.automationId,
                    history: (history || state.messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role, content: m.content }))).slice(-20),
                    attachments: Array.isArray(attachments) ? attachments : [],
                    webSearchEnabled: !!webSearchEnabled,
                    disabledMedia: disabledMedia || {},
                }),
                signal: ac.signal,
            });
            if (!resp.ok || !resp.body) {
                const text = await safeText(resp);
                setState(s => ({ ...s, running: false, error: text || `HTTP ${resp.status}` }));
                return;
            }
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            let currentEvent = 'message';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                const lines = buf.split('\n');
                buf = lines.pop();
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith('data: ')) {
                        let data; try { data = JSON.parse(line.slice(6)); } catch { continue; }
                        handle(setState, currentEvent, data);
                    }
                }
            }
        } catch (e) {
            if (e.name !== 'AbortError') {
                setState(s => ({ ...s, running: false, error: e.message || 'Stream failed' }));
                return;
            }
        }
        setState(s => ({ ...s, running: false }));
    }, [state.builderSessionId, state.automationId, state.messages]);

    return { state, send, reset };
}

function handle(setState, event, data) {
    switch (event) {
        case 'builder_session':
            setState(s => ({ ...s, builderSessionId: data.builderSessionId, automationId: data.automationId || s.automationId }));
            break;
        case 'message':
            setState(s => {
                const msgs = [...s.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant') last.content = (last.content || '') + (data.content || '');
                else msgs.push({ role: 'assistant', content: data.content || '', toolCalls: [] });
                return { ...s, messages: msgs };
            });
            break;
        case 'tool_call':
            setState(s => {
                const msgs = [...s.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant') {
                    last.toolCalls = [...(last.toolCalls || []), { name: data.name, arguments: data.arguments, result: data.result }];
                }
                return { ...s, messages: msgs };
            });
            break;
        case 'draft':
            setState(s => ({ ...s, draft: data.definition, automationId: data.automationId || s.automationId }));
            break;
        case 'summary':
            setState(s => ({ ...s, summary: data.summary || '', hasSideEffects: !!data.hasSideEffects }));
            break;
        case 'dryrun':
            setState(s => ({ ...s, dryRun: data.run, steps: data.steps || [] }));
            break;
        case 'finalized':
            setState(s => ({ ...s, finalizedId: data.automationId || null }));
            break;
        case 'error':
            setState(s => ({ ...s, error: data.error || 'Builder error' }));
            break;
        case 'done':
        default:
            break;
    }
}

async function safeText(r) {
    try { const j = await r.json(); return j.error || JSON.stringify(j); } catch { return r.statusText; }
}
