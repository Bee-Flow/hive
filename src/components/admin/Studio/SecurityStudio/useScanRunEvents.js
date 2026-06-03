import { useEffect, useState } from 'react';
import { API_BASE } from '../../../../utils/helpers';

/**
 * Subscribe to /api/security/scans/:id/events via SSE.
 *
 * Returns { status, progressLines, reportJson, severitySummary, reportWebpageId, error, closed }.
 *
 * Event flow:
 *   - snapshot — initial state (late-subscriber catch-up)
 *   - status   — queued / running / completed / error / cancelled
 *   - progress — single console line
 *   - done     — final state + report + severity summary + report webpage id
 *
 * Unlike the Tests stream there are no frame/action events — security scans
 * run headless engines in isolated containers, so there is no live browser
 * view or structured agent action log to relay.
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
        es.addEventListener('done', handleDone);
        es.addEventListener('close', handleDone);
        es.onerror = handleError;

        return () => {
            try { es.close(); } catch (_) {}
        };
    }, [scanId]);

    return state;
}
