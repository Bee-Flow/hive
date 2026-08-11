import { useCallback, useEffect, useRef, useState } from 'react';
import { studioAppsApi } from '../components/admin/Studio/AppStudio/studioAppsApi';
import { API_BASE, authFetch } from '../utils/helpers';

// Shown when the build stream drops mid-flight (gateway timeout / network
// cut). Every draft is persisted server-side as it lands, so nothing is lost —
// guide the user instead of surfacing a raw "HTTP 504".
const STREAM_DROP_MESSAGE = 'The connection to the AI builder dropped while it was working. Your progress is saved — send your message again to continue.';

// Left in the transcript when the user stops a running build. Every draft is
// persisted server-side as it lands, so stopping never throws work away.
const STOPPED_MESSAGE = 'You stopped the build — everything built so far is saved.';

// Cap on how many phases a single user action may auto-continue through when
// the model exhausts its per-turn budget mid-plan. Keeps a runaway plan from
// chaining forever without a human in the loop.
const MAX_CONTINUATIONS = 3;

/**
 * SSE hook for the conversational App Studio builder.
 *
 * Mirrors the reader/parser mechanics of useAutomationBuilderStream but
 * deliberately does NOT keep its own copy of the app definition: `draft`
 * events are forwarded to the caller (the editor context owns the canvas
 * state), and the chat transcript is the only state held here.
 *
 * useAppBuilderStream({ appId, onDraft, onDone, onError, onDataModel,
 *                       onPlan, onPhase, onCheckpoint })
 *   → { messages, thinkingParts, running, send, stop, sessionId, lastValidation,
 *       lastDataModel, pendingPlan, phases, checkpoints, continuation }
 *
 *   onDraft(definition, version, appId)  — each server-persisted draft
 *   onDone({ appId, finalized, awaitingPlan, stopped }) — the turn is over.
 *                                          `awaitingPlan` means the AI proposed
 *                                          a plan and is waiting for approval —
 *                                          the caller must NOT commit a history
 *                                          entry for it (no draft landed).
 *                                          `stopped` means the user stopped the
 *                                          build; the drafts that already landed
 *                                          are persisted and stay on the canvas.
 *   onError(message, code?)              — stream error / drop (an error chat
 *                                          item is appended here as well). `code`
 *                                          is the server's error-taxonomy code
 *                                          (subscription_limit | rate_limited |
 *                                          model_unavailable | transient_upstream |
 *                                          budget_exhausted | validation_failed |
 *                                          save_conflict | internal) on an in-stream
 *                                          `error` event; undefined for a raw
 *                                          connection drop.
 *   onDataModel({ modelVersion, tables, datasets })
 *                                        — the AI changed the app's DATA side
 *                                          (tables/rows/roles/datasets); the
 *                                          caller invalidates its data caches
 *   onPlan({ planId, plan })             — an editable plan artifact to approve
 *   onPhase({ index, total, label })     — phased-generation progress
 *   onCheckpoint({ versionId, summary }) — a restorable snapshot was taken
 *
 * send(text, options?) OR send(options):
 *   options = { modelTier?, context?, planMode?, plan?, continueToken? }
 *     planMode 'auto'|'always'|'never' — force/suppress the plan-first flow
 *     plan { planId, action:'approve', plan } — approve an edited plan artifact
 *     continueToken — resume an interrupted phased build (used internally by
 *                     the auto-continuation loop; callers rarely pass it)
 *
 * messages items:
 *   { role:'user'|'assistant', content, thinkingParts?, isStreaming?, autoSelectedTier? }
 *   { kind:'tool', name, label, ok, summary }   — one per tool_call event
 *   { kind:'error', message, code? }            — one per failed turn
 *
 * On mount the transcript rehydrates from GET /builder/session/:appId
 * (404 = no session yet → fresh). A pending plan (mid-approval refresh) and
 * prior checkpoints rehydrate from the same snapshot.
 */
export default function useAppBuilderStream({
    appId, onDraft, onDone, onError, onDataModel, onPlan, onPhase, onCheckpoint,
} = {}) {
    const [messages, setMessages] = useState([]);
    const [running, setRunning] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [lastValidation, setLastValidation] = useState(null);
    const [lastDataModel, setLastDataModel] = useState(null);
    // Plan-first UX (Wave 5): a pending editable plan, phased-build progress,
    // AI checkpoints, and the live "continuing…" status for an auto-continued
    // multi-phase build.
    const [pendingPlan, setPendingPlan] = useState(null);
    const [phases, setPhases] = useState([]);
    const [checkpoints, setCheckpoints] = useState([]);
    const [continuation, setContinuation] = useState(null);

    const abortRef = useRef(null);
    const sessionIdRef = useRef(null);
    const phasesTotalRef = useRef(0);

    // Callbacks via refs so an unstable identity from the caller never makes
    // `send` stale (events fire long after the render that created them).
    const onDraftRef = useRef(onDraft);
    onDraftRef.current = onDraft;
    const onDoneRef = useRef(onDone);
    onDoneRef.current = onDone;
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;
    const onDataModelRef = useRef(onDataModel);
    onDataModelRef.current = onDataModel;
    const onPlanRef = useRef(onPlan);
    onPlanRef.current = onPlan;
    const onPhaseRef = useRef(onPhase);
    onPhaseRef.current = onPhase;
    const onCheckpointRef = useRef(onCheckpoint);
    onCheckpointRef.current = onCheckpoint;

    // ---- rehydrate a prior session (refresh / reopen) -----------------------
    useEffect(() => {
        if (!appId) return undefined;
        let alive = true;
        (async () => {
            try {
                const res = await studioAppsApi.getBuilderSession(appId);
                const snap = res?.snapshot;
                if (!alive || !snap) return;
                if (Array.isArray(snap.messages)) {
                    const restored = snap.messages.filter((m) => m && typeof m === 'object');
                    // A turn may have started while this request was in flight —
                    // restore the history IN FRONT of it, never over it.
                    setMessages((live) => (live.length ? [...restored, ...live] : restored));
                }
                if (snap.sessionId) {
                    sessionIdRef.current = snap.sessionId;
                    setSessionId(snap.sessionId);
                }
                if (snap.lastValidation) setLastValidation(snap.lastValidation);
                // A build interrupted mid-approval left a plan on the snapshot
                // (top-level, trim-safe) — surface the card again so a refresh
                // doesn't lose the pending plan.
                if (snap.pendingPlan && typeof snap.pendingPlan === 'object') {
                    setPendingPlan(snap.pendingPlan);
                }
                if (Array.isArray(snap.checkpoints)) {
                    setCheckpoints(snap.checkpoints.filter((c) => c && typeof c === 'object'));
                }
            } catch {
                // 404 = no session yet; anything else degrades to a fresh chat.
            }
        })();
        return () => { alive = false; };
    }, [appId]);

    // Abort an in-flight stream on unmount.
    useEffect(() => () => {
        try { abortRef.current?.abort(); } catch { /* already settled */ }
    }, []);

    /**
     * Patch the current turn's assistant message (the last non-tool assistant
     * item — tool/error items may have been appended after it). `fn` receives
     * a shallow copy and returns the replacement.
     */
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

    /**
     * Stream ONE turn against the builder route. Returns
     * `{ continuation }` — the `{ token, nextPhase }` payload when the model
     * exhausted its budget mid-plan and the build should auto-resume, else
     * null. `failTurn` is shared with the caller so an error in any leg of a
     * continued build settles the whole action.
     */
    const runTurn = useCallback(async ({ message, options, failTurn }) => {
        if (abortRef.current) {
            try { abortRef.current.abort(); } catch { /* already settled */ }
        }
        const ac = new AbortController();
        abortRef.current = ac;

        let sawDone = false;
        let errored = false;
        let continuationOut = null;
        let doneInfo = null;
        // Wrap the shared failTurn so a terminal `error` event doesn't ALSO
        // trip the "stream closed without done" drop path below (two errors).
        // `code` is the server's taxonomy code (in-stream errors only).
        const fail = (msg, code) => { errored = true; failTurn(msg, code); };

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
                        return {
                            ...m,
                            thinkingParts: parts,
                            isStreaming: true,
                            thinkingStartedAt: m.thinkingStartedAt || Date.now(),
                        };
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
                        return {
                            ...m,
                            thinkingParts: parts,
                            isStreaming: true,
                            thinkingStartedAt: m.thinkingStartedAt || Date.now(),
                        };
                    });
                    break;
                case 'thinking_stop':
                    patchAssistant((m) => {
                        const parts = (Array.isArray(m.thinkingParts) ? m.thinkingParts : [])
                            .map((p) => (p.endedAt ? p : { ...p, endedAt: Date.now() }));
                        return { ...m, thinkingParts: parts, thinkingEndedAt: Date.now() };
                    });
                    break;
                case 'tool_call':
                    setMessages((msgs) => [...msgs, {
                        kind: 'tool',
                        name: data.name,
                        label: data.label || data.name,
                        ok: data.ok !== false,
                        summary: data.summary || '',
                    }]);
                    break;
                case 'draft':
                    onDraftRef.current?.(data.definition, data.version, data.appId);
                    break;
                case 'data_model':
                    setLastDataModel(data);
                    onDataModelRef.current?.(data);
                    break;
                case 'plan':
                    // An editable plan artifact — surface the card and hold it
                    // until the user approves or discards it.
                    if (data.plan) {
                        const p = { planId: data.planId, plan: data.plan };
                        setPendingPlan(p);
                        onPlanRef.current?.(p);
                    }
                    break;
                case 'phase':
                    if (typeof data.index === 'number') {
                        if (typeof data.total === 'number') phasesTotalRef.current = data.total;
                        setPhases((prev) => [...prev, { index: data.index, total: data.total, label: data.label || '' }]);
                        onPhaseRef.current?.(data);
                    }
                    break;
                case 'checkpoint':
                    if (data.versionId != null) {
                        const cp = { versionId: data.versionId, summary: data.summary || '' };
                        setCheckpoints((prev) => [...prev, cp]);
                        onCheckpointRef.current?.(cp);
                    }
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
                    // The send() loop decides whether this is terminal (fire
                    // onDone) or a leg to auto-continue — it owns the cap, which
                    // runTurn can't see.
                    doneInfo = {
                        appId: data.appId,
                        finalized: !!data.finalized,
                        awaitingPlan: !!data.awaitingPlan,
                    };
                    if (data.continuation && data.continuation.token) {
                        continuationOut = data.continuation;
                    }
                    break;
                case 'error':
                    // Forward the server's taxonomy `code` (Wave 6c) so the chat
                    // pane can map it to friendly copy + a retry affordance.
                    fail(data.message || 'The AI builder ran into a problem.', data.code);
                    break;
                default:
                    break;
            }
        };

        const plan = options.plan && typeof options.plan === 'object' ? options.plan : undefined;
        const context = options.context && typeof options.context === 'object' ? options.context : undefined;
        try {
            const resp = await authFetch(`${API_BASE}/api/studio-apps/builder/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // A continuation carries no user text — the server resumes
                    // from the continueToken; a plan approval may also be textless.
                    message: message || undefined,
                    appId: appId || undefined,
                    builderSessionId: sessionIdRef.current || undefined,
                    modelTier: options.modelTier || 'auto',
                    // The editor's current focus (selection / screen / bound table).
                    context,
                    // Plan-first UX: force/suppress the plan (quick actions send
                    // 'never'); approve an edited plan; resume a phased build.
                    planMode: options.planMode || undefined,
                    plan,
                    continueToken: options.continueToken || undefined,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam',
                }),
                signal: ac.signal,
            });
            if (!resp.ok || !resp.body) {
                const isGateway = resp.status === 504 || resp.status === 502 || resp.status === 408;
                fail(isGateway ? STREAM_DROP_MESSAGE : (await safeText(resp)) || `HTTP ${resp.status}`);
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
                // The stream closed without a terminal event — a proxy cut the
                // connection mid-build. Fail the turn so the editor unlocks.
                // A stop() abort is not a drop: stop() already settled the turn.
                if (!sawDone && !errored && !ac.signal.aborted) fail(STREAM_DROP_MESSAGE);
            }
        } catch (e) {
            if (e.name !== 'AbortError' && !errored) {
                const looksLikeDrop = /network|fetch|terminated|timeout|aborted|closed/i.test(e.message || '');
                fail(looksLikeDrop ? STREAM_DROP_MESSAGE : (e.message || 'Stream failed'));
            }
        }
        return { continuation: continuationOut, doneInfo };
    }, [appId, patchAssistant]);

    /**
     * Run a user action: one turn, plus up to MAX_CONTINUATIONS automatic
     * follow-up turns when a phased build exhausts its budget. Accepts either
     * `send(text, options)` or `send(options)` (a textless plan-approval turn).
     */
    const send = useCallback(async (textOrOpts, maybeOpts) => {
        let options; let text;
        if (textOrOpts && typeof textOrOpts === 'object') {
            options = textOrOpts;
            text = typeof options.message === 'string' ? options.message : '';
        } else {
            text = textOrOpts;
            options = maybeOpts || {};
        }
        const message = typeof text === 'string' ? text.trim() : '';
        const isApproval = !!(options.plan && typeof options.plan === 'object');
        // A turn needs SOMETHING to act on: user text or a plan approval.
        if (!message && !isApproval) return;

        let sawError = false;
        const failTurn = (msg, code) => {
            sawError = true;
            setMessages((msgs) => [...msgs, { kind: 'error', message: msg, code }]);
            onErrorRef.current?.(msg, code);
        };

        setRunning(true);
        setLastValidation(null);
        // A fresh user action starts a clean plan/phase/checkpoint slate. The
        // approval turn clears the pending card (the build is starting).
        setPendingPlan(null);
        setPhases([]);
        setCheckpoints([]);
        setContinuation(null);
        phasesTotalRef.current = 0;
        // Push the user's message (a textless approval still gets a "Build it"
        // bubble so the transcript reads) + a fresh streaming assistant bubble.
        const userBubble = message || (isApproval ? 'Build it' : '');
        setMessages((msgs) => [
            // A previously aborted turn may have left isStreaming behind —
            // settle it so its thinking block stops pulsing.
            ...finalizeStreaming(msgs),
            ...(userBubble ? [{ role: 'user', content: userBubble }] : []),
            { role: 'assistant', content: '', thinkingParts: [], isStreaming: true },
        ]);

        let turnOptions = options;
        for (let leg = 0; ; leg += 1) {
            const { continuation: cont, doneInfo } = await runTurn({
                message: leg === 0 ? message : '',
                options: turnOptions,
                failTurn,
            });
            const canContinue = !sawError && cont && cont.token && leg < MAX_CONTINUATIONS;
            if (!canContinue) {
                // Terminal leg (clean done, awaiting-plan, or the cap): tell the
                // caller ONCE so it unlocks the editor. An errored turn already
                // reported via onError, so skip onDone there.
                if (!sawError && doneInfo) onDoneRef.current?.(doneInfo);
                setContinuation(null);
                break;
            }
            // Auto-resume the next phase. Show progress, start a fresh assistant
            // bubble for the continued leg, and carry only the continueToken.
            setContinuation({ phase: cont.nextPhase, total: phasesTotalRef.current || null });
            setMessages((msgs) => [
                ...finalizeStreaming(msgs),
                { role: 'assistant', content: '', thinkingParts: [], isStreaming: true, continuation: true },
            ]);
            turnOptions = { continueToken: cont.token, context: options.context, modelTier: options.modelTier };
        }

        setRunning(false);
        setContinuation(null);
        setMessages((msgs) => finalizeStreaming(msgs));
    }, [runTurn]);

    /**
     * Stop the running build on the user's command. Aborts the stream, settles
     * the transcript with a plain note, and reports the turn as finished
     * (`stopped`) so the caller adopts the drafts that already landed and
     * unlocks the editor — exactly as it does for a normal completion.
     */
    const stop = useCallback(() => {
        if (!running) return;
        try { abortRef.current?.abort(); } catch { /* already settled */ }
        setRunning(false);
        setContinuation(null);
        setMessages((msgs) => [...finalizeStreaming(msgs), { role: 'assistant', content: STOPPED_MESSAGE }]);
        onDoneRef.current?.({ appId, stopped: true });
    }, [running, appId]);

    // Convenience view: the live turn's reasoning (BuilderChatPane renders the
    // block through MessageBubble; this is for callers that want it directly).
    let thinkingParts = [];
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m && m.role === 'assistant' && !m.kind) {
            thinkingParts = Array.isArray(m.thinkingParts) ? m.thinkingParts : [];
            break;
        }
    }

    return {
        messages, thinkingParts, running, send, stop, sessionId, lastValidation, lastDataModel,
        pendingPlan, phases, checkpoints, continuation,
    };
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
