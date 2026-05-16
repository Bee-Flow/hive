// Billing / subscriptions read + mutations. Used by SubscriptionsPanel
// (super-admin) and the user-facing PlanPicker / Stripe-sync UI.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export const billingKeys = {
    all: ['billing'] as const,
    plans: () => [...billingKeys.all, 'plans'] as const,
    organizations: () => [...billingKeys.all, 'organizations'] as const,
    grants: () => [...billingKeys.all, 'grants'] as const,
    promos: () => [...billingKeys.all, 'promos'] as const,
    auditLog: () => [...billingKeys.all, 'audit'] as const,
    stripeSync: () => [...billingKeys.all, 'stripe-sync'] as const,
};

export interface Plan { id: string; name: string; [k: string]: unknown; }
export interface Organization { id: string; name: string; [k: string]: unknown; }
export interface Grant { id: string; orgId?: string; [k: string]: unknown; }
export interface Promo { id: string; code: string; [k: string]: unknown; }

export function usePlans() {
    return useQuery<Plan[], Error>({
        queryKey: billingKeys.plans(),
        queryFn: ({ signal }) => apiClient.get<Plan[]>('/api/billing/plans', { signal }).then((d) => d ?? []),
    });
}

export function useOrganizations() {
    return useQuery<Organization[], Error>({
        queryKey: billingKeys.organizations(),
        queryFn: ({ signal }) =>
            apiClient.get<Organization[]>('/api/billing/organizations', { signal }).then((d) => d ?? []),
    });
}

export function useGrants() {
    return useQuery<Grant[], Error>({
        queryKey: billingKeys.grants(),
        queryFn: ({ signal }) => apiClient.get<Grant[]>('/api/billing/grants', { signal }).then((d) => d ?? []),
    });
}

export function usePromos() {
    return useQuery<Promo[], Error>({
        queryKey: billingKeys.promos(),
        queryFn: ({ signal }) => apiClient.get<Promo[]>('/api/billing/promos', { signal }).then((d) => d ?? []),
    });
}

interface SavePlanInput { id?: string; data: Partial<Plan>; }
export function useSavePlan() {
    const qc = useQueryClient();
    return useMutation<Plan | null, Error, SavePlanInput>({
        mutationFn: ({ id, data }) =>
            id ? apiClient.patch<Plan>(`/api/billing/plans/${id}`, data)
               : apiClient.post<Plan>('/api/billing/plans', data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: billingKeys.plans() }); },
    });
}

export function useDeletePlan() {
    const qc = useQueryClient();
    return useMutation<unknown, Error, string>({
        mutationFn: (id) => apiClient.delete(`/api/billing/plans/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: billingKeys.plans() }); },
    });
}
