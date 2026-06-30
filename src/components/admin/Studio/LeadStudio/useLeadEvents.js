import { useEffect } from 'react';
import { API_BASE } from '../../../../utils/helpers';

/**
 * Subscribe to /api/lead-studio/stream (SSE). Calls onEvent(type, data) for
 * lead_created / lead_updated / run_status / run_progress / campaign_* events
 * scoped to the caller's org(s). Pass a STABLE onEvent (useCallback) — it's a
 * dependency, so a new identity reconnects the stream.
 */
export default function useLeadEvents(onEvent) {
    useEffect(() => {
        let es;
        try {
            es = new EventSource(`${API_BASE}/api/lead-studio/stream`, { withCredentials: true });
        } catch (_) { return undefined; }
        const handle = (e) => {
            try { onEvent?.(e.type, JSON.parse(e.data)); } catch (_) { /* ignore */ }
        };
        [
            'lead_created', 'lead_updated', 'run_status', 'run_progress', 'campaign_created', 'campaign_updated',
            // CRM events
            'activity_created', 'task_created', 'task_updated', 'contact_created', 'contact_updated', 'contact_deleted',
        ].forEach(ev => es.addEventListener(ev, handle));
        // EventSource auto-reconnects on transient errors; nothing to do here.
        es.onerror = () => {};
        return () => { try { es.close(); } catch (_) {} };
    }, [onEvent]);
}
