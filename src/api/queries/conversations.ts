// Conversation list/detail + mutations.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export const conversationsKeys = {
    all: ['conversations'] as const,
    byAgent: (agentId: string) => [...conversationsKeys.all, 'agent', agentId] as const,
    detail: (id: string) => [...conversationsKeys.all, 'detail', id] as const,
};

export interface ConversationSummary {
    id: string;
    title: string;
    agentId?: string;
    createdAt?: string;
    updatedAt?: string;
    [k: string]: unknown;
}

export function useAgentConversations(agentId: string | null | undefined) {
    return useQuery<ConversationSummary[], Error>({
        queryKey: agentId ? conversationsKeys.byAgent(agentId) : conversationsKeys.all,
        queryFn: ({ signal }) => apiClient
            .get<ConversationSummary[]>(`/agents/${agentId}/conversations`, { signal })
            .then((d) => d ?? []),
        enabled: Boolean(agentId),
    });
}

export function useDeleteConversation(agentId: string | null | undefined) {
    const qc = useQueryClient();
    return useMutation<unknown, Error, string>({
        mutationFn: (conversationId) =>
            apiClient.delete(`/agents/${agentId}/conversations/${conversationId}`),
        onSuccess: () => {
            if (agentId) qc.invalidateQueries({ queryKey: conversationsKeys.byAgent(agentId) });
        },
    });
}
