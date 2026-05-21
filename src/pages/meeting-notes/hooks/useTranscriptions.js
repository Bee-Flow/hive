import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/transcriptionsApi';

export default function useTranscriptions() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const mounted = useRef(true);

    // React 18 Strict Mode runs effects mount → unmount → mount in dev. A naïve
    // `mounted.current = false` on cleanup leaves the ref stuck at false for
    // the remounted instance, and the in-flight fetch's success branch never
    // calls setLoading(false) — UI hangs on the spinner forever. Resetting
    // the ref on every mount keeps the guard correct for the *current*
    // mounted instance.
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const list = await api.listTranscriptions();
            if (mounted.current) {
                setItems(list);
                setError(null);
            }
        } catch (err) {
            if (mounted.current) setError(err);
        } finally {
            if (mounted.current) setLoading(false);
        }
    }, []);

    useEffect(() => { reload(); }, [reload]);

    const removeLocal = useCallback((id) => {
        setItems((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const patchLocal = useCallback((id, patch) => {
        setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    }, []);

    const upsertLocal = useCallback((item) => {
        if (!item || !item.id) return;
        setItems((prev) => {
            const idx = prev.findIndex((t) => t.id === item.id);
            if (idx === -1) return [item, ...prev];
            const next = [...prev];
            next[idx] = { ...next[idx], ...item };
            return next;
        });
    }, []);

    return { items, loading, error, reload, removeLocal, patchLocal, upsertLocal };
}
