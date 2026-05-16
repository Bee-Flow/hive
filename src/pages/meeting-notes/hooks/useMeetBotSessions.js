import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/transcriptionsApi';

const ACTIVE = ['pending', 'joining', 'recording', 'processing'];

export default function useMeetBotSessions({ enabled = true } = {}) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(false);
    const mounted = useRef(true);

    useEffect(() => () => { mounted.current = false; }, []);

    const reload = useCallback(async () => {
        if (!enabled) return;
        setLoading(true);
        try {
            const list = await api.listBotSessions();
            if (mounted.current) setSessions(Array.isArray(list) ? list : []);
        } catch (_) { /* swallow */ } finally {
            if (mounted.current) setLoading(false);
        }
    }, [enabled]);

    useEffect(() => { reload(); }, [reload]);

    useEffect(() => {
        if (!enabled) return undefined;
        const hasActive = sessions.some((s) => ACTIVE.includes(s.status));
        if (!hasActive) return undefined;
        const interval = setInterval(reload, 5000);
        return () => clearInterval(interval);
    }, [enabled, sessions, reload]);

    const stop = useCallback(async (id) => {
        try { await api.stopBotSession(id); } catch (_) { /* ignore */ }
        reload();
    }, [reload]);

    return { sessions, loading, reload, stop };
}
