// Integrations admin: read the platform-wide integration matrix and
// per-integration save mutations. Used by IntegrationsAdminPanel.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export const integrationsKeys = {
    all: ['integrations'] as const,
    admin: () => [...integrationsKeys.all, 'admin'] as const,
    config: (provider: string) => [...integrationsKeys.all, 'config', provider] as const,
};

export interface IntegrationAdminSummary {
    [provider: string]: {
        configured?: boolean;
        enabled?: boolean;
        label?: string;
        [k: string]: unknown;
    };
}

export function useIntegrationsAdmin() {
    return useQuery<IntegrationAdminSummary, Error>({
        queryKey: integrationsKeys.admin(),
        queryFn: ({ signal }) => apiClient
            .get<IntegrationAdminSummary>('/api/integrations/admin', { signal })
            .then((d) => d ?? {}),
    });
}

export interface IntegrationConfig {
    [k: string]: unknown;
}

export function useIntegrationConfig(provider: string | null | undefined) {
    return useQuery<IntegrationConfig | null, Error>({
        queryKey: provider ? integrationsKeys.config(provider) : integrationsKeys.all,
        queryFn: ({ signal }) =>
            apiClient.get<IntegrationConfig>(`/api/integrations/${provider}/config`, { signal }),
        enabled: Boolean(provider),
    });
}

export function useSaveIntegrationConfig() {
    const qc = useQueryClient();
    return useMutation<unknown, Error, { provider: string; config: unknown }>({
        mutationFn: ({ provider, config }) =>
            apiClient.put(`/api/integrations/${provider}/config`, config),
        onSuccess: (_, { provider }) => {
            qc.invalidateQueries({ queryKey: integrationsKeys.config(provider) });
            qc.invalidateQueries({ queryKey: integrationsKeys.admin() });
        },
    });
}
