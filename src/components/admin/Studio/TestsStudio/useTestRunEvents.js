import { useEffect, useState } from 'react';
import { API_BASE } from '../../../../utils/helpers';

/**
 * Subscribe to /api/tests/runs/:id/events via SSE.
 *
 * Returns { status, progressLines, reportJson, error, closed, latestFrame, currentAction, actionLog }.
 *
 * Event flow:
 *   - snapshot — initial state (late-subscriber catch-up)
 *   - status   — running / passed / failed / error
 *   - progress — single console line
 *   - frame    — { b64, step, action }: only the latest is kept (memory bound)
 *   - action   — { tool, input, step }: pushed onto a structured action log
 *   - done     — final state + report
 */
export default function useTestRunEvents(runId) {
    const [state, setState] = useState({
        status: null,
        progressLines: [],
        reportJson: null,
        error: null,
        closed: false,
        latestFrame: null,
        currentAction: null,
        actionLog: [],
    });

    useEffect(() => {
        if (!runId) return undefined;
        const es = new EventSource(`${API_BASE}/api/tests/runs/${encodeURIComponent(runId)}/events`, { withCredentials: true });

        const handleSnapshot = (e) => {
            try {
                const d = JSON.parse(e.data);
                setState(s => ({
                    ...s,
                    status: d.status || s.status,
                    progressLines: d.stdoutTail
                        ? d.stdoutTail.split('\n').filter(Boolean)
                        : s.progressLines,
                    reportJson: d.reportJson ?? s.reportJson,
                }));
            } catch (_) {}
        };
        const handleStatus = (e) => {
            try { const d = JSON.parse(e.data); setState(s => ({ ...s, status: d.status })); } catch (_) {}
        };
        const handleProgress = (e) => {
            try {
                const d = JSON.parse(e.data);
                if (!d.line) return;
                setState(s => ({ ...s, progressLines: [...s.progressLines, d.line].slice(-200) }));
            } catch (_) {}
        };
        const handleFrame = (e) => {
            try {
                const d = JSON.parse(e.data);
                if (!d.b64) return;
                // Keep only the latest frame — accumulating base64 blobs would blow up memory.
                setState(s => ({
                    ...s,
                    latestFrame: d.b64,
                    currentAction: d.action || s.currentAction,
                }));
            } catch (_) {}
        };
        const handleAction = (e) => {
            try {
                const d = JSON.parse(e.data);
                setState(s => ({
                    ...s,
                    actionLog: [...s.actionLog, { tool: d.tool, input: d.input, step: d.step }].slice(-50),
                }));
            } catch (_) {}
        };
        const handleDone = (e) => {
            try {
                const d = JSON.parse(e.data);
                setState(s => ({
                    ...s,
                    status: d.status,
                    reportJson: d.reportJson ?? s.reportJson,
                    error: d.error || s.error,
                    closed: true,
                }));
            } catch (_) {}
            es.close();
        };
        const handleError = () => {
            setState(s => ({ ...s, closed: true, error: s.error || 'connection_lost' }));
            es.close();
        };

        es.addEventListener('snapshot', handleSnapshot);
        es.addEventListener('status', handleStatus);
        es.addEventListener('progress', handleProgress);
        es.addEventListener('frame', handleFrame);
        es.addEventListener('action', handleAction);
        es.addEventListener('done', handleDone);
        es.addEventListener('close', handleDone);
        es.onerror = handleError;

        return () => {
            try { es.close(); } catch (_) {}
        };
    }, [runId]);

    return state;
}
