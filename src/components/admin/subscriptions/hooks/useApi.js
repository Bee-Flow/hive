import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE, authFetch } from '../../../../utils/helpers';

export function api(path, opts) {
    return authFetch(`${API_BASE}${path}`, opts);
}

export async function apiJson(path, opts) {
    const res = await api(path, opts);
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    if (!res.ok) {
        const err = new Error(body?.error || `Request failed (${res.status})`);
        err.status = res.status;
        err.body = body;
        throw err;
    }
    return body;
}

/**
 * Lightweight data loader — keeps state in sync and exposes reload().
 *   const { data, loading, error, reload } = useResource('/api/subscriptions/plans', { initial: [] });
 */
export function useResource(path, { initial = null, enabled = true, transform } = {}) {
    const [data, setData] = useState(initial);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState(null);
    const alive = useRef(true);
    const pathRef = useRef(path);
    pathRef.current = path;

    const reload = useCallback(async () => {
        if (!pathRef.current) return;
        setLoading(true);
        setError(null);
        try {
            const body = await apiJson(pathRef.current);
            if (!alive.current) return;
            setData(transform ? transform(body) : body);
        } catch (e) {
            if (alive.current) setError(e);
        } finally {
            if (alive.current) setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        alive.current = true;
        if (enabled) reload();
        return () => { alive.current = false; };
    }, [enabled, reload]);

    return { data, loading, error, reload, setData };
}
