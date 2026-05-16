import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/transcriptionsApi';

export default function useTranscription(id) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const mounted = useRef(true);

    useEffect(() => () => { mounted.current = false; }, []);

    useEffect(() => {
        if (!id) { setData(null); return; }
        let cancelled = false;
        setLoading(true);
        setError(null);
        api.getTranscription(id)
            .then((res) => { if (!cancelled && mounted.current) setData(res); })
            .catch((err) => { if (!cancelled && mounted.current) setError(err); })
            .finally(() => { if (!cancelled && mounted.current) setLoading(false); });
        return () => { cancelled = true; };
    }, [id]);

    const refresh = useCallback(async () => {
        if (!id) return;
        try {
            const next = await api.getTranscription(id);
            if (mounted.current) setData(next);
        } catch (err) {
            if (mounted.current) setError(err);
        }
    }, [id]);

    const setLocal = useCallback((updater) => {
        setData((prev) => (typeof updater === 'function' ? updater(prev) : updater));
    }, []);

    return { data, loading, error, refresh, setLocal };
}
