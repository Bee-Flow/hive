// Usage / analytics queries. Used by UsageSection.
// The endpoint shape mirrors what /api/usage exposes today; tighten
// types as panels migrate.

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export const usageKeys = {
    all: ['usage'] as const,
    summary: (range: string) => [...usageKeys.all, 'summary', range] as const,
    bySource: (range: string) => [...usageKeys.all, 'by-source', range] as const,
    byModel: (range: string) => [...usageKeys.all, 'by-model', range] as const,
    apiEgress: (range: string) => [...usageKeys.all, 'api-egress', range] as const,
    piiDetections: (range: string) => [...usageKeys.all, 'pii', range] as const,
    integrationsHealth: () => [...usageKeys.all, 'integrations-health'] as const,
};

interface RangeQuery { range: string }

export function useUsageSummary({ range }: RangeQuery) {
    return useQuery<unknown, Error>({
        queryKey: usageKeys.summary(range),
        queryFn: ({ signal }) => apiClient.get('/api/usage/summary', { signal, query: { range } }),
        enabled: Boolean(range),
    });
}

export function useUsageBySource({ range }: RangeQuery) {
    return useQuery<unknown, Error>({
        queryKey: usageKeys.bySource(range),
        queryFn: ({ signal }) => apiClient.get('/api/usage/by-source', { signal, query: { range } }),
        enabled: Boolean(range),
    });
}

export function useApiEgress({ range }: RangeQuery) {
    return useQuery<unknown, Error>({
        queryKey: usageKeys.apiEgress(range),
        queryFn: ({ signal }) => apiClient.get('/api/usage/api-egress', { signal, query: { range } }),
        enabled: Boolean(range),
    });
}

export function useIntegrationsHealth() {
    return useQuery<unknown, Error>({
        queryKey: usageKeys.integrationsHealth(),
        queryFn: ({ signal }) => apiClient.get('/api/usage/integrations-health', { signal }),
    });
}
