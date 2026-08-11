import { useEffect, useRef } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';

/**
 * Live subscription to a project's event feed.
 *
 * Modelled directly on components/admin/Studio/Executions/useRunStream.js — the
 * resilience shape there (backoff with jitter, polling fallback, pause while the
 * tab is hidden) already solves this problem, and a second, subtly different
 * implementation would only be a second set of bugs.
 *
 * ── What is different: the cursor ───────────────────────────────────────────
 *
 * Run events are fire-and-forget; project events are not. "You never miss a
 * message" is the promise, so every durable frame carries `id: <seq>` and this
 * hook tracks the highest one it has seen. On reconnect it sends
 * `?since=<cursor>` and the server replays exactly the gap. That makes a
 * dropped connection a latency problem rather than a correctness one.
 *
 * TRANSIENT frames (typing, presence, streaming snapshots) deliberately carry
 * no `id:`, so they never move the cursor. Otherwise a reconnecting client
 * would faithfully replay "Anna is typing" from ten minutes ago.
 *
 * Uses fetch streaming rather than EventSource, for the same reason useRunStream
 * does: EventSource cannot set the X-Session-Token header, and putting a token
 * in the query string would land it in access logs.
 *
 * @param {object}   opts
 * @param {string}   opts.projectId
 * @param {boolean}  opts.enabled
 * @param {(kind: string, event: object) => void} opts.onEvent
 */
export default function useProjectStream({ projectId, enabled = true, onEvent }) {
    const onEventRef = useRef(onEvent);
    onEventRef.current = onEvent;

    // Survives reconnects (and re-renders) so the gap is replayed, not skipped.
    const cursorRef = useRef(0);

    useEffect(() => {
        if (!enabled || !projectId) return undefined;

        // A different project is a different feed — never carry a cursor across.
        cursorRef.current = 0;

        let stopped = false;
        let controller = null;
        let timer = null;
        let failures = 0;
        let backoff = 1000;
        let polling = false;

        const emit = (kind, data) => { if (!stopped) onEventRef.current?.(kind, data); };
        const clearTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };

        // ── Polling fallback ────────────────────────────────────────────
        // Same endpoint, same cursor. Because the server's catch-up path IS the
        // live path, degraded mode loses latency and nothing else.
        const pollTick = async () => {
            if (stopped) return;
            try {
                const res = await authFetch(
                    `${API_BASE}/api/projects/${projectId}/activity?limit=25`
                );
                if (res.ok) {
                    const data = await res.json();
                    for (const item of (data.items || []).reverse()) {
                        emit(item.action, { ...item, polled: true });
                    }
                }
            } catch { /* keep polling */ }
            if (!stopped) timer = setTimeout(pollTick, 15000);
        };

        const startPolling = () => {
            if (polling) return;
            polling = true;
            pollTick();
        };

        // ── SSE over fetch ──────────────────────────────────────────────
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
                const res = await authFetch(
                    `${API_BASE}/api/projects/${projectId}/stream?since=${cursorRef.current}`,
                    { signal: controller.signal, headers: { Accept: 'text/event-stream' } }
                );
                if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);

                failures = 0;
                backoff = 1000;

                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                // Frames are separated by a blank line; a chunk can split one, so
                // hold the tail until the next read completes it.
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done || stopped) break;
                    buffer += decoder.decode(value, { stream: true });

                    let sep;
                    while ((sep = buffer.indexOf('\n\n')) !== -1) {
                        const frame = buffer.slice(0, sep);
                        buffer = buffer.slice(sep + 2);

                        let id = null;
                        let kind = 'message';
                        const dataLines = [];
                        for (const line of frame.split('\n')) {
                            if (line.startsWith('id: ')) id = line.slice(4).trim();
                            else if (line.startsWith('event: ')) kind = line.slice(7).trim();
                            else if (line.startsWith('data: ')) dataLines.push(line.slice(6));
                            // ': ping' comment frames fall through and are ignored.
                        }
                        if (dataLines.length === 0) continue;

                        let payload;
                        try { payload = JSON.parse(dataLines.join('\n')); } catch { continue; }

                        if (kind === 'ping') continue;

                        // Only durable frames advance the cursor.
                        if (id !== null) {
                            const seq = Number(id);
                            if (Number.isFinite(seq) && seq > cursorRef.current) cursorRef.current = seq;
                        }

                        if (kind === 'ready') continue;
                        if (kind === 'forbidden') {
                            // Access revoked while the stream was open. Stop —
                            // reconnecting would just 404 in a loop.
                            stopped = true;
                            emit('forbidden', payload);
                            return;
                        }
                        emit(kind, payload);
                    }
                }

                if (!stopped) scheduleReconnect();
            } catch (e) {
                if (stopped || controller?.signal?.aborted) return;
                failures += 1;
                // Three strikes: the stream is not coming back soon (proxy,
                // corporate network, no SSE support). Degrade rather than spin.
                if (failures >= 3) { startPolling(); return; }
                scheduleReconnect();
            }
        };

        // ── Visibility: don't hold an idle socket open ──────────────────
        const onVisibility = () => {
            if (document.hidden) {
                controller?.abort();
                clearTimer();
            } else if (!stopped) {
                failures = 0; backoff = 1000; polling = false; clearTimer();
                // The cursor is intact, so whatever happened while the tab was
                // hidden is replayed rather than lost.
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
    }, [projectId, enabled]);
}
