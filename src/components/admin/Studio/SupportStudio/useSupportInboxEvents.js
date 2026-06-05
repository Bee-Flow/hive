import { useEffect } from 'react';
import { API_BASE } from '../../../../utils/helpers';

/**
 * Subscribe to /api/support-inbox/stream (SSE). Calls onEvent(type, data) for
 * thread_created / thread_updated events scoped to the caller's tenant inboxes.
 * Pass a STABLE onEvent (useCallback) — it's a dependency, so a new identity
 * reconnects the stream.
 */
export default function useSupportInboxEvents(onEvent) {
    useEffect(() => {
        let es;
        try {
            es = new EventSource(`${API_BASE}/api/support-inbox/stream`, { withCredentials: true });
        } catch (_) { return undefined; }
        const handle = (e) => {
            try { onEvent?.(e.type, JSON.parse(e.data)); } catch (_) { /* ignore */ }
        };
        es.addEventListener('thread_created', handle);
        es.addEventListener('thread_updated', handle);
        // EventSource auto-reconnects on transient errors; nothing to do here.
        es.onerror = () => {};
        return () => { try { es.close(); } catch (_) {} };
    }, [onEvent]);
}
