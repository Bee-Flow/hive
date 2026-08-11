/**
 * useNotebookList — owns the overview list state, server-driven.
 *
 * The old page fetched everything once and filtered client-side, which capped
 * the list at the server clamp and made search blind to document bodies. This
 * hook pushes search/sort/filter to `GET /api/notebooks` and pages with
 * limit/offset. Contract: `{notebooks, hasMore}`; card items carry the count/
 * preview/pin/activity fields (see the API contract in the notebooks plan).
 *
 * A generation counter discards out-of-order responses; the search input is
 * debounced 300ms and stale items stay visible while the refetch is in flight.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { notebookApi } from './notebookApi';

const PAGE_LIMIT = 60;
const SEARCH_DEBOUNCE_MS = 300;

export default function useNotebookList() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sort, setSort] = useState('activity');
    const [filter, setFilter] = useState('all');
    const [creating, setCreating] = useState(false);

    // Out-of-order guard: a slow first page must not overwrite a fresh
    // filtered page that resolved before it.
    const genRef = useRef(0);
    const offsetRef = useRef(0);
    // Re-entrancy guard for create — a ref, not state: the second Enter of a
    // double-tap arrives in the same tick, before any state update lands.
    const creatingRef = useRef(false);
    // Mirror for handlers that need the current items synchronously (setState
    // updaters run at render time, not at call time).
    const itemsRef = useRef([]);
    useEffect(() => { itemsRef.current = items; }, [items]);

    useEffect(() => {
        const tm = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(tm);
    }, [search]);

    const fetchPage = useCallback(async ({ offset = 0, append = false } = {}) => {
        const gen = ++genRef.current;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                search: debouncedSearch,
                sort,
                filter,
                limit: String(PAGE_LIMIT),
                offset: String(offset),
            });
            const data = await notebookApi(`?${params}`);
            if (genRef.current !== gen) return;
            const page = data.notebooks || [];
            setItems(prev => append ? [...prev, ...page] : page);
            setHasMore(!!data.hasMore);
            offsetRef.current = offset;
        } catch (e) {
            if (genRef.current !== gen) return;
            setError(e.message);
        } finally {
            if (genRef.current === gen) setLoading(false);
        }
    }, [debouncedSearch, sort, filter]);

    // Initial load + any search/sort/filter change resets to the first page.
    useEffect(() => { fetchPage({ offset: 0 }); }, [fetchPage]);

    const refetch = useCallback(() => fetchPage({ offset: 0 }), [fetchPage]);

    const loadMore = useCallback(() => {
        if (loading || !hasMore) return;
        fetchPage({ offset: offsetRef.current + PAGE_LIMIT, append: true });
    }, [fetchPage, loading, hasMore]);

    /** Create a notebook; returns it (or null on failure/double-submit). */
    const create = useCallback(async (name) => {
        const clean = name?.trim();
        if (!clean || creatingRef.current) return null;
        creatingRef.current = true;
        setCreating(true);
        try {
            const data = await notebookApi('/', { method: 'POST', body: JSON.stringify({ name: clean }) });
            await fetchPage({ offset: 0 });
            return data?.notebook ?? null;
        } catch (e) {
            setError(e.message);
            return null;
        } finally {
            creatingRef.current = false;
            setCreating(false);
        }
    }, [fetchPage]);

    // Optimistic rename; a failed PUT falls back to a refetch.
    const rename = useCallback(async (id, name) => {
        const clean = name?.trim();
        if (!id || !clean) return;
        setItems(prev => prev.map(n => n.id === id ? { ...n, name: clean } : n));
        try {
            const res = await notebookApi(`/${id}`, { method: 'PUT', body: JSON.stringify({ name: clean }) });
            if (res?.version != null) {
                setItems(prev => prev.map(n => n.id === id ? { ...n, version: res.version } : n));
            }
        } catch (e) {
            setError(e.message);
            fetchPage({ offset: 0 });
        }
    }, [fetchPage]);

    const remove = useCallback(async (id) => {
        if (!id) return false;
        try {
            await notebookApi(`/${id}`, { method: 'DELETE' });
            setItems(prev => prev.filter(n => n.id !== id));
            return true;
        } catch (e) {
            setError(e.message);
            return false;
        }
    }, []);

    // Optimistic pin flip, reverted if the PUT fails. Order (pinned-first) is
    // the server's job — it settles on the next refetch, not here.
    const togglePin = useCallback(async (id) => {
        const item = itemsRef.current.find(n => n.id === id);
        if (!item) return;
        const next = !item.pinned;
        setItems(prev => prev.map(n => n.id === id ? { ...n, pinned: next } : n));
        try {
            const res = await notebookApi(`/${id}`, { method: 'PUT', body: JSON.stringify({ pinned: next }) });
            if (res?.version != null) {
                setItems(prev => prev.map(n => n.id === id ? { ...n, version: res.version } : n));
            }
        } catch (e) {
            setError(e.message);
            setItems(prev => prev.map(n => n.id === id ? { ...n, pinned: !next } : n));
        }
    }, []);

    return {
        items, loading, error, hasMore,
        search, setSearch, sort, setSort, filter, setFilter,
        refetch, loadMore,
        create, rename, remove, togglePin, creating,
    };
}
