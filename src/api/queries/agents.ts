// Agent CRUD + favorites.
//
// Used by AgentHub (favorites + agent list), AgentMarketplace, the
// admin AgentDesigner, and various pickers across the app.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export const agentsKeys = {
    all: ['agents'] as const,
    list: () => [...agentsKeys.all, 'list'] as const,
    detail: (id: string) => [...agentsKeys.all, 'detail', id] as const,
    favorites: () => [...agentsKeys.all, 'favorites'] as const,
};

export interface AgentSummary {
    id: string;
    name: string;
    description?: string;
    avatar?: string | null;
    [k: string]: unknown;
}

export function useAgents() {
    return useQuery<AgentSummary[], Error>({
        queryKey: agentsKeys.list(),
        queryFn: ({ signal }) => apiClient.get<AgentSummary[]>('/agents', { signal })
            .then((d) => d ?? []),
    });
}

export function useAgent(id: string | null | undefined) {
    return useQuery<AgentSummary | null, Error>({
        queryKey: id ? agentsKeys.detail(id) : agentsKeys.all,
        queryFn: ({ signal }) => apiClient.get<AgentSummary>(`/agents/${id}`, { signal }),
        enabled: Boolean(id),
    });
}

export function useAgentFavorites() {
    return useQuery<string[], Error>({
        queryKey: agentsKeys.favorites(),
        queryFn: ({ signal }) => apiClient.get<string[]>('/agents/favorites', { signal })
            .then((d) => d ?? []),
    });
}

export function useToggleAgentFavorite() {
    const qc = useQueryClient();
    return useMutation<unknown, Error, { id: string; favorited: boolean }>({
        mutationFn: ({ id, favorited }) =>
            apiClient[favorited ? 'put' : 'delete'](`/agents/${id}/favorite`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: agentsKeys.favorites() }); },
    });
}

export function useDeleteAgent() {
    const qc = useQueryClient();
    return useMutation<unknown, Error, string>({
        mutationFn: (id) => apiClient.delete(`/agents/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: agentsKeys.list() }); },
    });
}
