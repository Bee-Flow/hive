import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/transcriptionsApi';

export default function useTranscription(id) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const mounted = useRef(true);

    // React 18 Strict Mode runs effects mount → unmount → mount in dev. Resetting
    // `mounted.current` on every mount keeps the guard correct for the *current*
    // mounted instance (otherwise the remount sees `false` and never updates).
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    useEffect(() => {
        // Clear the PREVIOUS note before fetching the new one. This only reset
        // `data` when `id` went falsy, so selecting a note that then failed to
        // load left the old note on screen while the library highlighted the
        // new one — and every action in the detail view (rename, delete,
        // action items) targeted the note still in `data`. A user who trusted
        // the highlight and pressed Delete destroyed a different meeting.
        setData(null);
        setError(null);
        if (!id) { setLoading(false); return; }
        let cancelled = false;
        setLoading(true);
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

    // While this note is still transcribing (async pipeline), poll so the detail
    // view fills in transcript/speakers/summary the moment processing finishes.
    useEffect(() => {
        if (data?.status !== 'processing') return;
        const interval = setInterval(() => { refresh(); }, 4000);
        return () => clearInterval(interval);
    }, [data?.status, refresh]);

    const setLocal = useCallback((updater) => {
        setData((prev) => (typeof updater === 'function' ? updater(prev) : updater));
    }, []);

    return { data, loading, error, refresh, setLocal };
}
