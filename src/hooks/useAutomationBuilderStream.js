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
        messages: [],          // [{ role, content, toolCalls?, autoSelectedTier? }]
        draft: initial.draft || null,
        lastServerDraft: initial.draft || null,   // last definition the server confirmed; used to detect local divergence
        pendingExternalDraft: null,               // SSE draft arrived while user had local edits — surfaced to UI for accept/discard
        summary: '',
        hasSideEffects: false,
        dryRun: null,
        steps: [],
        finalizedId: null,
        running: false,
        executingStepId: null, // id of step currently mid partial-execute (n8n-style ▶)
        error: null,
        validation: null,      // { errors: [...], warnings: [...] } — structured records
        aborted: null,         // { reason, iterations, lastValidation } when builder ran out of iterations
        todos: [],             // agent's self-managed plan: [{ text, done }] — read-only checklist
    });
    const abortRef = useRef(null);

    const reset = useCallback(() => {
        setState(s => ({ ...s, messages: [], draft: null, summary: '', dryRun: null, steps: [], finalizedId: null, error: null, validation: null, aborted: null, todos: [] }));
    }, []);

    /**
     * Rehydrate from a server-persisted builder snapshot. Called by
     * BuilderShell on mount so a refresh / new tab restores chat history,
     * draft, latest validation, and summary.
     */
    const hydrate = useCallback((snapshot) => {
        if (!snapshot) return;
        setState(s => {
            const nextDraft = snapshot.draft || s.draft;
            return {
                ...s,
                messages: Array.isArray(snapshot.conversation) ? snapshot.conversation : s.messages,
                draft: nextDraft,
                // On hydrate we treat the snapshot as authoritative — local
                // edits before mount are not yet possible. Seed the baseline
                // so subsequent SSE `draft` events compare against it.
                lastServerDraft: nextDraft,
                summary: snapshot.summary || s.summary,
                validation: snapshot.lastValidation || s.validation,
                todos: Array.isArray(snapshot.todos) ? snapshot.todos : s.todos,
                builderSessionId: snapshot.sessionId || s.builderSessionId,
                // Allow lazy assignment of the automationId when the builder
                // creates a draft via the visual editor BEFORE the chat
                // produces one (n8n-style click-build flow).
                automationId: snapshot.automationId || s.automationId,
            };
        });
    }, []);

    /**
     * Replace the local draft definition. Used by the visual editor
     * (DiagramPane in editable mode) when the user drags / connects /
     * adds / deletes nodes — keeps the canvas in sync immediately while
     * the parent persists to the backend out-of-band.
     */
    const setDraft = useCallback((nextDef) => {
        setState(s => ({ ...s, draft: nextDef }));
    }, []);

    /**
     * Mark the current draft as server-confirmed (called after a
     * successful PUT). After this, an incoming SSE `draft` event whose
     * payload matches `lastServerDraft` won't surface as a conflict —
     * since the user IS in sync.
     */
    const markServerConfirmed = useCallback((nextDef) => {
        setState(s => ({ ...s, lastServerDraft: nextDef }));
    }, []);

    /**
     * Accept a pending external draft (chat-driven change that arrived
     * while user had local edits). Promotes it to the canonical draft
     * and clears the conflict banner.
     */
    const acceptExternalDraft = useCallback(() => {
        setState(s => s.pendingExternalDraft
            ? { ...s, draft: s.pendingExternalDraft, lastServerDraft: s.pendingExternalDraft, pendingExternalDraft: null }
            : s);
    }, []);

    /**
     * Dismiss the pending external draft — user wants to keep their
     * local edits. The chat-side change is effectively discarded
     * client-side (server-side it still ran; next save round-trip
     * will reconcile).
     */
    const dismissExternalDraft = useCallback(() => {
        setState(s => ({ ...s, pendingExternalDraft: null }));
    }, []);

    const send = useCallback(async ({ message, modelTier = 'auto', timezone, history, attachments = [], webSearchEnabled = true, disabledMedia = {}, canvasScope = null, resume = false }) => {
        if (abortRef.current) {
            try { abortRef.current.abort(); } catch {}
        }
        const ac = new AbortController();
        abortRef.current = ac;

        setState(s => ({
            ...s,
            running: true,
            error: null,
            // Clear any stale isStreaming on prior messages (e.g. an aborted
            // turn) so their thinking block stops pulsing, then add the new
            // user turn + an in-flight assistant placeholder.
            messages: [
                ...s.messages.map(m => (m.isStreaming ? { ...m, isStreaming: false } : m)),
                { role: 'user', content: message },
                { role: 'assistant', content: '', toolCalls: [], thinkingParts: [], isStreaming: true },
            ],
        }));

        try {
            const url = `${API_BASE}/api/automation/builder/stream${resume ? '?resume=1' : ''}`;
            const resp = await authFetch(url, {
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
                    // Layer key of the canvas the user is looking at (null =
                    // root). Server uses it to hint the model's default
                    // `scope` for builder tool calls.
                    canvasScope: canvasScope || null,
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
                setState(s => ({ ...s, running: false, error: e.message || 'Stream failed', messages: finalizeStreaming(s.messages) }));
                return;
            }
        }
        setState(s => ({ ...s, running: false, messages: finalizeStreaming(s.messages) }));
    }, [state.builderSessionId, state.automationId, state.messages]);

    /**
     * Manual/step runs hit synchronous endpoints that only return once the
     * whole run is done — so the diagram can't show progress on its own.
     * While such a request is in flight, this discovers the active run for
     * the automation (it's created `queued`→`running` server-side and shows
     * in /_runs/active for the duration) and surfaces it as a 'running'
     * dryRun stub. That flips `liveRunInFlight` on, which starts BuildTab's
     * step poller — lighting up the running node, animating the in-flight
     * edge, and showing the progress banner — so the user sees exactly where
     * the run currently is, including upstream steps that run first.
     * Returns a stop() for the caller's finally.
     */
    const watchActiveRun = useCallback((automationId) => {
        const aid = automationId || state.automationId;
        if (!aid) return () => {};
        let alive = true;
        let found = false;
        const discover = async () => {
            if (!alive || found) return;
            try {
                const r = await authFetch(`${API_BASE}/api/automation/_runs/active`);
                const j = await r.json().catch(() => ({}));
                const run = (Array.isArray(j.active) ? j.active : []).find(
                    x => x.automationId === aid && (x.status === 'running' || x.status === 'queued'),
                );
                if (run && alive) {
                    found = true;
                    setState(s => ({ ...s, dryRun: { id: run.runId, status: 'running', startedAt: run.startedAt } }));
                }
            } catch { /* transient — keep trying until stopped */ }
        };
        const handle = setInterval(discover, 350);
        discover();
        return () => { alive = false; clearInterval(handle); };
    }, [state.automationId]);

    /**
     * n8n-style "Execute step" — run a single step and merge the resulting
     * step record into `state.steps`. Sets `executingStepId` so the node UI
     * can show a spinner; clears it on completion. Does NOT touch
     * `state.running` (that flag is reserved for the chat builder stream).
     */
    const executeStep = useCallback(async (stepId, { mode = 'only' } = {}) => {
        if (!state.automationId || !stepId) return null;
        setState(s => ({ ...s, executingStepId: stepId, error: null }));
        // Light up live progress (the run may execute upstream steps first).
        const stopWatch = watchActiveRun(state.automationId);
        try {
            const r = await authFetch(`${API_BASE}/api/automation/${state.automationId}/steps/${encodeURIComponent(stepId)}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) {
                setState(s => ({ ...s, executingStepId: null, error: j?.error || `HTTP ${r.status}`, dryRun: settleRunStub(s.dryRun) }));
                return null;
            }
            // Merge the returned steps into existing state.steps. The
            // partial-run only records ONE step (or, for mode='from', the
            // step + its downstream) so we keep the prior step rows for
            // every node we didn't touch.
            setState(s => {
                const byId = new Map(s.steps.map(st => [st.stepId, st]));
                for (const ns of (j.steps || [])) byId.set(ns.stepId, ns);
                return {
                    ...s,
                    executingStepId: null,
                    dryRun: j.run || settleRunStub(s.dryRun),
                    steps: Array.from(byId.values()),
                };
            });
            return j;
        } catch (e) {
            setState(s => ({ ...s, executingStepId: null, error: e.message || 'Execute step failed', dryRun: settleRunStub(s.dryRun) }));
            return null;
        } finally {
            stopWatch();
        }
    }, [state.automationId, watchActiveRun]);

    const retryFromStep = useCallback((stepId) => executeStep(stepId, { mode: 'from' }), [executeStep]);

    /**
     * Cancel an in-flight run. Latency is bounded by step duration since
     * the runner checks the abort signal between steps. Acknowledges
     * immediately; the caller's progress poll surfaces the final status.
     */
    const stopRun = useCallback(async (runId) => {
        if (!runId) return false;
        try {
            const r = await authFetch(`${API_BASE}/api/automation/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' });
            return r.ok;
        } catch {
            return false;
        }
    }, []);

    /**
     * Snapshot of an in-progress run's step rows. Drives the live progress
     * banner + animated edges while a dry-run is executing. Callers should
     * poll every ~750ms; cheap query, capped at one row per step.
     */
    const pollRunProgress = useCallback(async (runId) => {
        if (!runId) return null;
        try {
            const r = await authFetch(`${API_BASE}/api/automation/runs/${encodeURIComponent(runId)}/steps`);
            const j = await r.json().catch(() => ({}));
            if (!r.ok) return null;
            const steps = Array.isArray(j.steps) ? j.steps : [];
            setState(s => ({ ...s, steps }));
            return steps;
        } catch {
            return null;
        }
    }, []);

    /** Dismiss the dry-run preview drawer (clears the result + step rows). */
    const clearDryRun = useCallback(() => {
        setState(s => ({ ...s, dryRun: null, steps: [] }));
    }, []);

    /**
     * Push a completed full-flow run (dry-run or live) into state so every
     * node's Run tab shows its own input/output. Replaces the step rows
     * wholesale — a full run records every step, so there's nothing prior
     * worth preserving (unlike executeStep's single-step merge).
     */
    const setRunResult = useCallback((run, steps) => {
        setState(s => ({
            ...s,
            dryRun: run || s.dryRun,
            steps: Array.isArray(steps) ? steps : s.steps,
        }));
    }, []);

    return { state, send, reset, hydrate, setDraft, markServerConfirmed, acceptExternalDraft, dismissExternalDraft, executeStep, retryFromStep, stopRun, pollRunProgress, clearDryRun, setRunResult, watchActiveRun };
}

// Mark any in-flight assistant message as no-longer-streaming and stamp the
// reasoning end time, so its thinking block flips from "Thinking…" to
// "Thought for Xs" and stops pulsing once the stream ends.
function finalizeStreaming(messages) {
    if (!Array.isArray(messages) || !messages.some(m => m && m.isStreaming)) return messages;
    return messages.map(m => (m && m.isStreaming
        ? { ...m, isStreaming: false, thinkingEndedAt: m.thinkingEndedAt || (m.thinkingStartedAt ? Date.now() : undefined) }
        : m));
}

function handle(setState, event, data) {
    switch (event) {
        case 'builder_session':
            setState(s => ({ ...s, builderSessionId: data.builderSessionId, automationId: data.automationId || s.automationId }));
            break;
        case 'model_selected':
            // Mirrors useChatEngine's handler so the assistant bubble can
            // render "Auto → <resolved tier>" when the user picked Auto.
            setState(s => {
                const msgs = [...s.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant') last.autoSelectedTier = data.tier;
                return { ...s, messages: msgs };
            });
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
        // ── Reasoning stream (parity with direct/agent chat) ──
        // The builder route streams the model turn; these build the live
        // thinking block on the in-flight assistant message. Shape mirrors
        // the chat engine: thinkingParts:[{id,text,startedAt,endedAt,redacted}]
        // + thinkingStartedAt + isStreaming.
        case 'thinking_start':
            setState(s => {
                const msgs = [...s.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant') {
                    const parts = Array.isArray(last.thinkingParts) ? [...last.thinkingParts] : [];
                    if (!parts.some(p => p.id === data.partId)) {
                        parts.push({ id: data.partId, text: '', redacted: !!data.redacted, startedAt: Date.now(), endedAt: null });
                    }
                    last.thinkingParts = parts;
                    last.isStreaming = true;
                    if (!last.thinkingStartedAt) last.thinkingStartedAt = Date.now();
                }
                return { ...s, messages: msgs };
            });
            break;
        case 'thinking':
            setState(s => {
                const msgs = [...s.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant') {
                    const parts = Array.isArray(last.thinkingParts) ? [...last.thinkingParts] : [];
                    let p = data.partId ? parts.find(x => x.id === data.partId) : parts[parts.length - 1];
                    if (!p) { p = { id: data.partId || `t${parts.length}`, text: '', startedAt: Date.now(), endedAt: null }; parts.push(p); }
                    p.text = (p.text || '') + (data.text || '');
                    last.thinkingParts = parts;
                    last.isStreaming = true;
                    if (!last.thinkingStartedAt) last.thinkingStartedAt = Date.now();
                }
                return { ...s, messages: msgs };
            });
            break;
        case 'thinking_stop':
            setState(s => {
                const msgs = [...s.messages];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant' && Array.isArray(last.thinkingParts)) {
                    const p = last.thinkingParts.find(x => x.id === data.partId);
                    if (p && !p.endedAt) p.endedAt = Date.now();
                    last.thinkingParts = [...last.thinkingParts];
                }
                return { ...s, messages: msgs };
            });
            break;
        case 'draft':
            // Conflict-aware: if the user's local draft is already in
            // sync with the last server-confirmed draft, accept silently.
            // Otherwise the user has unsaved local edits — stash the
            // incoming draft as `pendingExternalDraft` so the UI can
            // offer Accept / Keep-my-edits, instead of silently clobbering.
            setState(s => {
                const incoming = data.definition;
                const local = s.draft;
                const baseline = s.lastServerDraft;
                const localMatchesBaseline = !local || !baseline
                    ? local === baseline
                    : shallowDefinitionEqual(local, baseline);
                if (localMatchesBaseline) {
                    return {
                        ...s,
                        draft: incoming,
                        lastServerDraft: incoming,
                        automationId: data.automationId || s.automationId,
                        pendingExternalDraft: null,
                    };
                }
                return {
                    ...s,
                    pendingExternalDraft: incoming,
                    automationId: data.automationId || s.automationId,
                };
            });
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
        case 'validation_errors':
            // Structured records emitted after each mutation. Stored as
            // state.validation so the consolidated banner / step inspector
            // can render the {code, severity, path, message, hint} shape.
            setState(s => ({ ...s, validation: { errors: data.errors || [], warnings: data.warnings || [] } }));
            break;
        case 'plan':
            // Agent's self-managed to-do list (builder_set_plan). Whole list
            // is re-sent each time; render it as a read-only live checklist.
            setState(s => ({ ...s, todos: Array.isArray(data.todos) ? data.todos : s.todos }));
            break;
        case 'builder_aborted':
            // Server gave up before finalizing — surface so the UI can
            // explain why instead of silently leaving the user staring at
            // a partially-built diagram.
            setState(s => ({ ...s, aborted: { reason: data.reason, iterations: data.iterations, lastValidation: data.lastValidation || null } }));
            break;
        case 'resume':
            // Rehydrate from snapshot replayed by the server on
            // reconnect — same shape as the GET /session endpoint.
            if (data?.snapshot) {
                setState(s => ({
                    ...s,
                    messages: Array.isArray(data.snapshot.conversation) ? data.snapshot.conversation : s.messages,
                    draft: data.snapshot.draft || s.draft,
                    summary: data.snapshot.summary || s.summary,
                    validation: data.snapshot.lastValidation || s.validation,
                    todos: Array.isArray(data.snapshot.todos) ? data.snapshot.todos : s.todos,
                }));
            }
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

/**
 * Settle a 'running' progress stub (set by watchActiveRun) so
 * `liveRunInFlight` clears when a run ends without us receiving a final run
 * record — e.g. an errored execute. A genuine completed run (status
 * 'success'/'error' from the server) is left untouched.
 */
function settleRunStub(d) {
    return d && d.status === 'running' ? { ...d, status: 'error' } : d;
}

/**
 * Cheap structural equality for two automation definitions. We compare
 * via JSON.stringify after normalising key order in the shallow fields
 * we care about — definitions are small (a few dozen steps) so this is
 * fine, and it avoids a deepEqual import here.
 *
 * Returns true iff the two definitions describe the same DAG; used to
 * decide whether an SSE `draft` event is a no-op or a real conflict.
 */
function shallowDefinitionEqual(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    try {
        return JSON.stringify(a) === JSON.stringify(b);
    } catch {
        return false;
    }
}
