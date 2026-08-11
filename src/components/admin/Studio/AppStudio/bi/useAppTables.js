import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { API_BASE, authFetch } from '../../../../../utils/helpers';

/**
 * App Studio BI — the table/field catalogue hook.
 *
 * Reads GET /api/studio-apps/:appId/data/tables (the viewer-readable tables,
 * fields only — access rules never leave the server). It degrades gracefully:
 * a 404 (app has no data model yet, or the endpoint is empty) resolves to an
 * empty table list instead of an error, so the query builder renders a friendly
 * "no tables yet" state rather than crashing.
 *
 *   const { tables, fieldsFor, isLoading } = useAppTables(appId);
 *   const fields = fieldsFor(selectedTableId);   // [] when unknown
 */

async function fetchTables(appId) {
    const res = await authFetch(`${API_BASE}/api/studio-apps/${encodeURIComponent(appId)}/data/tables`);
    if (res.status === 404) return [];
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    if (!res.ok) throw new Error(body?.error || `Could not load tables (${res.status})`);
    return Array.isArray(body?.tables) ? body.tables : [];
}

/** Fields for a table resolved by id OR key (empty array when unknown). */
export function fieldsForTable(tables, tableRef) {
    const t = (Array.isArray(tables) ? tables : []).find((x) => x && (x.id === tableRef || x.key === tableRef));
    return t && Array.isArray(t.fields) ? t.fields : [];
}

export default function useAppTables(appId) {
    const query = useQuery({
        queryKey: ['studio-app-tables', appId],
        queryFn: () => fetchTables(appId),
        enabled: !!appId,
        staleTime: 30_000,
        retry: false,
    });

    const tables = Array.isArray(query.data) ? query.data : [];
    const fieldsFor = useCallback((tableRef) => fieldsForTable(tables, tableRef), [tables]);

    return {
        tables,
        fieldsFor,
        isLoading: !!appId && query.isLoading,
        isError: query.isError,
        error: query.error || null,
        refetch: query.refetch,
    };
}
