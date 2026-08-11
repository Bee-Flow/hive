import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE, authFetch } from '../../../../../utils/helpers';

/**
 * App Studio BI — saved-dataset CRUD hook (owner-only endpoints).
 *
 *   GET    /api/studio-apps/:appId/datasets
 *   POST   /api/studio-apps/:appId/datasets            → { dataset }
 *   PUT    /api/studio-apps/:appId/datasets/:datasetId → { dataset }
 *   DELETE /api/studio-apps/:appId/datasets/:datasetId
 *
 * Like useAppTables, a 404 degrades to an empty list rather than an error.
 * saveDataset/deleteDataset are promises that resolve to the server body and
 * invalidate the list so the gallery refreshes.
 */

async function request(url, options = {}) {
    const res = await authFetch(url, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
    });
    if (res.status === 404 && (!options.method || options.method === 'GET')) return null;
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    if (!res.ok) {
        const err = new Error(body?.error || `Request failed (${res.status})`);
        err.status = res.status;
        throw err;
    }
    return body;
}

export default function useDatasets(appId) {
    const qc = useQueryClient();
    const listKey = ['studio-app-datasets', appId];

    const listQuery = useQuery({
        queryKey: listKey,
        queryFn: async () => {
            const body = await request(`${API_BASE}/api/studio-apps/${encodeURIComponent(appId)}/datasets`);
            return Array.isArray(body?.datasets) ? body.datasets : [];
        },
        enabled: !!appId,
        staleTime: 30_000,
        retry: false,
    });

    const base = `${API_BASE}/api/studio-apps/${encodeURIComponent(appId)}/datasets`;
    const invalidate = () => qc.invalidateQueries({ queryKey: ['studio-app-datasets', appId] });

    const saveMutation = useMutation({
        mutationFn: async ({ id, ...payload }) => {
            if (id) {
                return request(`${base}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
            }
            return request(base, { method: 'POST', body: JSON.stringify(payload) });
        },
        onSuccess: invalidate,
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => request(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
        onSuccess: invalidate,
    });

    return {
        datasets: Array.isArray(listQuery.data) ? listQuery.data : [],
        isLoading: !!appId && listQuery.isLoading,
        isError: listQuery.isError,
        saveDataset: (payload) => saveMutation.mutateAsync(payload),
        deleteDataset: (id) => deleteMutation.mutateAsync(id),
        saving: saveMutation.isPending,
        deleting: deleteMutation.isPending,
        refetch: listQuery.refetch,
    };
}
