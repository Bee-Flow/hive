import { useEffect, useRef } from 'react';
import useAutomationApi from '../../../../hooks/useAutomationApi';

/**
 * Live run-lifecycle subscription for the executions UI.
 *
 * Consumes the server SSE stream (`/_runs/stream`) via fetch streaming so the
 * normal X-Session-Token / cookie auth applies (EventSource can't set headers).
 * Calls `onEvent(type, data)` for run.started / run.finished / run.failed /
 * step.started / step.finished / step.heartbeat.
 *
 * Resilience:
 *   - reconnect with exponential backoff + jitter (cap 30s) when the stream
 *     errors or the server closes it;
 *   - after a few consecutive failures, fall back to POLLING active+recent runs
 *     and synthesising run.* events (so the list still updates without SSE);
 *   - pause (abort) while the tab is hidden, resume on focus, to avoid idle
 *     sockets.
 *
 * Owns nothing visual; the caller merges events into its own state.
 */
export default function useRunStream({ enabled = true, automationId = null, onEvent }) {
    const api = useAutomationApi();
    const onEventRef = useRef(onEvent);
    onEventRef.current = onEvent;

    useEffect(() => {
        if (!enabled) return undefined;
        let stopped = false;
        let controller = null;
        let timer = null;
        let failures = 0;
        let backoff = 1000;
        let polling = false;
        const lastSeen = new Map(); // runId -> last status (poll diffing)
        let firstPoll = true;

        const emit = (type, data) => { if (!stopped) onEventRef.current?.(type, data); };

        const clearTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };

        // ── Polling fallback ────────────────────────────────────────────
        const pollTick = async () => {
            if (stopped) return;
            try {
                const res = await api.listRecentRuns({ limit: 25, automationId: automationId || undefined });
                for (const r of (res.runs || [])) {
                    const prev = lastSeen.get(r.id);
                    lastSeen.set(r.id, r.status);
                    if (firstPoll || prev === r.status) continue; // seed silently / no change
                    if (r.status === 'running' || r.status === 'queued') {
                        emit('run.started', { runId: r.id, automationId: r.automationId, status: r.status, triggerKind: r.triggerKind, title: r.automationTitle, kind: r.automationKind, at: r.startedAt });
                    } else if (r.status === 'error') {
                        emit('run.failed', { runId: r.id, automationId: r.automationId, status: 'error', durationMs: r.durationMs });
                    } else {
                        emit('run.finished', { runId: r.id, automationId: r.automationId, status: r.status, durationMs: r.durationMs });
                    }
                }
                firstPoll = false;
            } catch { /* keep polling */ }
            if (!stopped) timer = setTimeout(pollTick, 5000);
        };

        const startPolling = () => {
            if (polling) return;
            polling = true;
            firstPoll = true;
            pollTick();
        };

        // ── SSE stream ──────────────────────────────────────────────────
        const scheduleReconnect = () => {
            if (stopped) return;
            const jittered = Math.min(backoff, 30000) * (0.7 + Math.random() * 0.6);
            backoff = Math.min(backoff * 2, 30000);
            timer = setTimeout(() => { if (!stopped) startStream(); }, jittered);
        };

        const startStream = async () => {
            if (stopped || polling) return;
            controller = new AbortController();
            try {
                await api.streamRuns({
                    automationId,
                    signal: controller.signal,
                    onEvent: (type, data) => { failures = 0; backoff = 1000; emit(type, data); },
                });
                // Server closed the stream — reconnect after a short beat.
                if (!stopped) scheduleReconnect();
            } catch (e) {
                if (stopped || controller?.signal?.aborted) return;
                failures += 1;
                if (failures >= 3) { startPolling(); return; }
                scheduleReconnect();
            }
        };

        // ── Visibility: pause idle sockets ──────────────────────────────
        const onVisibility = () => {
            if (document.hidden) {
                controller?.abort();
                clearTimer();
            } else if (!stopped) {
                failures = 0; backoff = 1000; polling = false; clearTimer();
                startStream();
            }
        };
        document.addEventListener('visibilitychange', onVisibility);

        if (!document.hidden) startStream();

        return () => {
            stopped = true;
            controller?.abort();
            clearTimer();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [enabled, automationId, api]);
}
