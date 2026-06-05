import { useEffect, useState } from 'react';
import { API_BASE } from '../../../../utils/helpers';

/**
 * Subscribe to /api/security/scans/:id/events via SSE.
 *
 * Returns { status, progressLines, reportJson, severitySummary, reportWebpageId, error, closed,
 *           actionLog, currentAction, scanStat, terminalLines }.
 *
 * Event flow:
 *   - snapshot — initial state (late-subscriber catch-up)
 *   - status   — queued / running / completed / error / cancelled
 *   - progress — single console line
 *   - done     — final state + report + severity summary + report webpage id
 *
 * Agent-mode scans additionally relay live structured events:
 *   - action   — { step, tool, input, summary }: pushed onto a structured action log
 *   - scanstat — { phase, crawledUrls?, alerts?, current? }: shallow-merged live stats
 *   - terminal — { command? | chunk? | done? }: sandboxed terminal stream
 */
export default function useScanRunEvents(scanId) {
    const [state, setState] = useState({
        status: null,
        progressLines: [],
        reportJson: null,
        severitySummary: null,
        reportWebpageId: null,
        error: null,
        closed: false,
        actionLog: [],
        currentAction: null,
        scanStat: null,
        terminalLines: [],
    });

    useEffect(() => {
        if (!scanId) return undefined;
        const es = new EventSource(`${API_BASE}/api/security/scans/${encodeURIComponent(scanId)}/events`, { withCredentials: true });

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
                    severitySummary: d.severitySummary ?? s.severitySummary,
                    reportWebpageId: d.reportWebpageId ?? s.reportWebpageId,
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
        const handleAction = (e) => {
            try {
                const d = JSON.parse(e.data);
                const entry = { step: d.step, tool: d.tool, input: d.input, summary: d.summary };
                setState(s => ({
                    ...s,
                    actionLog: [...s.actionLog, entry].slice(-60),
                    currentAction: entry,
                }));
            } catch (_) {}
        };
        const handleScanStat = (e) => {
            try {
                const d = JSON.parse(e.data);
                setState(s => ({ ...s, scanStat: { ...(s.scanStat || {}), ...d } }));
            } catch (_) {}
        };
        const handleTerminal = (e) => {
            try {
                const d = JSON.parse(e.data);
                let entry = null;
                if (d.command !== undefined && d.command !== null) {
                    entry = { kind: 'command', command: d.command };
                } else if (d.chunk !== undefined && d.chunk !== null) {
                    entry = { kind: 'output', chunk: d.chunk, stream: d.stream || 'stdout' };
                } else if (d.done) {
                    entry = { kind: 'exit', exitCode: d.exitCode };
                }
                if (!entry) return;
                setState(s => ({ ...s, terminalLines: [...s.terminalLines, entry].slice(-400) }));
            } catch (_) {}
        };
        const handleDone = (e) => {
            try {
                const d = JSON.parse(e.data);
                setState(s => ({
                    ...s,
                    status: d.status,
                    reportJson: d.reportJson ?? s.reportJson,
                    severitySummary: d.severitySummary ?? s.severitySummary,
                    reportWebpageId: d.reportWebpageId ?? s.reportWebpageId,
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
        es.addEventListener('action', handleAction);
        es.addEventListener('scanstat', handleScanStat);
        es.addEventListener('terminal', handleTerminal);
        es.addEventListener('done', handleDone);
        es.addEventListener('close', handleDone);
        es.onerror = handleError;

        return () => {
            try { es.close(); } catch (_) {}
        };
    }, [scanId]);

    return state;
}
