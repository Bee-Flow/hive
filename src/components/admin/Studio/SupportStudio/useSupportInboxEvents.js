import { useEffect } from 'react';
import { API_BASE, isDemoMode } from '../../../../utils/helpers';

/**
 * Subscribe to /api/support-inbox/stream (SSE). Calls onEvent(type, data) for
 * thread_created / thread_updated events scoped to the caller's tenant inboxes.
 * Pass a STABLE onEvent (useCallback) — it's a dependency, so a new identity
 * reconnects the stream.
 */
export default function useSupportInboxEvents(onEvent) {
    useEffect(() => {
        // An EventSource is not a fetch, so the public demo's transport cannot
        // intercept it — this opened a real, long-lived connection to the API
        // from an anonymous visitor's browser on /__demo__/support. There is
        // nothing to stream in a demo anyway: the fixture state only changes
        // when the visitor changes it, and that already re-renders.
        if (isDemoMode()) return undefined;
        let es;
        try {
            es = new EventSource(`${API_BASE}/api/support-inbox/stream`, { withCredentials: true });
        } catch (_) { return undefined; }
        const handle = (e) => {
            try { onEvent?.(e.type, JSON.parse(e.data)); } catch (_) { /* ignore */ }
        };
        es.addEventListener('thread_created', handle);
        es.addEventListener('thread_updated', handle);
        es.addEventListener('scan_progress', handle);
        es.addEventListener('scan_done', handle);
        // EventSource auto-reconnects on transient errors; nothing to do here.
        es.onerror = () => {};
        return () => { try { es.close(); } catch (_) {} };
    }, [onEvent]);
}
