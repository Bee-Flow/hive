import { useCallback, useEffect, useRef, useState } from 'react';
import useAutomationApi from '../../../../hooks/useAutomationApi';

// Date-range chip → hours (0 = all time).
export const RANGE_HOURS = { '24h': 24, '7d': 168, '30d': 720, all: 0 };

// Map a status filter chip to the server status set.
export function statusFilterToServer(status) {
    if (!status || status === 'all') return undefined;
    if (status === 'running') return ['running', 'queued'];
    if (status === 'awaiting') return ['awaiting_approval', 'awaiting_confirm'];
    return [status]; // 'error' | 'success'
}

/**
 * List-data hook for the executions table: cursor pagination, server-side
 * filters, facet counts, and live-event merging. De-dupes by run id and keeps
 * the list sorted newest-first so a live event and a later page can't double.
 *
 * scope: 'global' | 'automation' | 'step'. For automation/step the list is
 * fixed to that id; for global the user can filter by automation.
 */
export default function useExecutions({ scope, automationId, stepId, pageSize = 50 }) {
    const api = useAutomationApi();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [hasMore, setHasMore] = useState(false);
    const [facets, setFacets] = useState(null);
    const [filters, setFilters] = useState({ status: 'all', range: '24h', trigger: null, automationId: null });

    const cursorRef = useRef(null);
    const reqIdRef = useRef(0); // guards against out-of-order responses

    const scopedAutomationId = scope === 'global' ? (filters.automationId || undefined) : (automationId || stepId);

    // Build the server query from the active filters.
    const queryFor = useCallback((cursor) => {
        const q = { limit: pageSize };
        if (cursor) q.cursor = cursor;
        const status = statusFilterToServer(filters.status);
        if (status) q.status = status;
        if (filters.trigger) q.trigger = filters.trigger;
        if (scopedAutomationId) q.automationId = scopedAutomationId;
        const hrs = RANGE_HOURS[filters.range] ?? 24;
        if (hrs > 0) q.since = new Date(Date.now() - hrs * 3600 * 1000).toISOString();
        // The live table is production runs only; Steps show everything (their
        // test runs are dry-runs and there's nothing else to show).
        if (scope !== 'step') q.mode = 'live';
        return q;
    }, [filters, scopedAutomationId, scope, pageSize]);

    const fetchPage = useCallback((q) => {
        if (scope === 'global') return api.listRecentRuns(q);
        if (scope === 'step') return api.listStepRuns(stepId, q);
        return api.listRuns(automationId, q);
    }, [api, scope, automationId, stepId]);

    const refresh = useCallback(async () => {
        const myReq = ++reqIdRef.current;
        cursorRef.current = null;
        setLoading(true); setError(null);
        try {
            const res = await fetchPage(queryFor(null));
            if (myReq !== reqIdRef.current) return; // superseded
            setRows(res.runs || []);
            cursorRef.current = res.nextCursor || null;
            setHasMore(!!res.nextCursor);
        } catch (e) {
            if (myReq !== reqIdRef.current) return;
            setError(e); setRows([]); setHasMore(false);
        } finally {
            if (myReq === reqIdRef.current) setLoading(false);
        }
    }, [fetchPage, queryFor]);

    const loadMore = useCallback(async () => {
        if (!cursorRef.current || loadingMore) return;
        setLoadingMore(true);
        try {
            const res = await fetchPage(queryFor(cursorRef.current));
            setRows(prev => {
                const seen = new Set(prev.map(r => r.id));
                const fresh = (res.runs || []).filter(r => !seen.has(r.id));
                return [...prev, ...fresh];
            });
            cursorRef.current = res.nextCursor || null;
            setHasMore(!!res.nextCursor);
        } catch { /* keep current page on a paging error */ }
        finally { setLoadingMore(false); }
    }, [fetchPage, queryFor, loadingMore]);

    // Reload when filters / scope change.
    useEffect(() => { refresh(); }, [refresh]);

    // Facet counts for the chips (status/trigger breakdown within the date +
    // automation context). Best-effort — chips fall back to no counts on error.
    useEffect(() => {
        let alive = true;
        const range = RANGE_HOURS[filters.range] ?? 24;
        api.getRunFacets({
            range: range || 720,
            automationId: scopedAutomationId,
            mode: scope !== 'step' ? 'live' : undefined,
        }).then(r => { if (alive) setFacets(r.facets || null); }).catch(() => {});
        return () => { alive = false; };
    }, [api, filters.range, scopedAutomationId, scope, rows.length]);

    // Merge a live SSE event into the list. Respects the active filters so a
    // just-started run that doesn't match the status filter isn't injected.
    const applyEvent = useCallback((type, data) => {
        if (!data || !data.runId) return;
        if (type === 'step.started' || type === 'step.finished' || type === 'step.heartbeat') return;

        // Scope guard (global automation filter / per-automation surface).
        if (scopedAutomationId && data.automationId && data.automationId !== scopedAutomationId) return;

        setRows(prev => {
            const idx = prev.findIndex(r => r.id === data.runId);
            if (type === 'run.started') {
                const statusOk = filters.status === 'all' || filters.status === 'running';
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = { ...next[idx], status: data.status || 'running' };
                    return next;
                }
                if (!statusOk) return prev; // don't inject a running row into a non-running filter
                const stub = {
                    id: data.runId,
                    automationId: data.automationId,
                    automationTitle: data.title || null,
                    automationKind: data.kind || 'automation',
                    triggerKind: data.triggerKind || null,
                    mode: data.mode || 'live',
                    status: data.status || 'running',
                    startedAt: data.at || new Date().toISOString(),
                    durationMs: null,
                };
                return [stub, ...prev];
            }
            // run.finished / run.failed → patch an existing row's terminal state.
            if (idx < 0) return prev;
            const next = [...prev];
            next[idx] = {
                ...next[idx],
                status: data.status || next[idx].status,
                durationMs: data.durationMs ?? next[idx].durationMs,
                error: data.error ?? next[idx].error,
                errorClass: data.errorClass ?? next[idx].errorClass,
            };
            return next;
        });
    }, [filters.status, scopedAutomationId]);

    // Optimistic patch for ⋯ row actions.
    const patchRow = useCallback((id, partial) => {
        setRows(prev => prev.map(r => (r.id === id ? { ...r, ...partial } : r)));
    }, []);

    return {
        rows, loading, loadingMore, error, hasMore,
        loadMore, refresh,
        filters, setFilters,
        facets, applyEvent, patchRow,
        scopedAutomationId,
    };
}
