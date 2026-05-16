// Org-scoped user management. Used by OrgUsersPanel.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export const usersKeys = {
    all: ['users'] as const,
    org: () => [...usersKeys.all, 'org'] as const,
    detail: (id: string) => [...usersKeys.all, 'detail', id] as const,
};

export interface OrgUser {
    id: string;
    email: string;
    name?: string;
    role?: string;
    permissions?: string[];
    [k: string]: unknown;
}

export function useOrgUsers() {
    return useQuery<OrgUser[], Error>({
        queryKey: usersKeys.org(),
        queryFn: ({ signal }) => apiClient.get<OrgUser[]>('/api/org/users', { signal }).then((d) => d ?? []),
    });
}

export function useInviteUser() {
    const qc = useQueryClient();
    return useMutation<unknown, Error, { email: string; role?: string }>({
        mutationFn: (payload) => apiClient.post('/api/org/users', payload),
        onSuccess: () => { qc.invalidateQueries({ queryKey: usersKeys.org() }); },
    });
}

export function useUpdateUser() {
    const qc = useQueryClient();
    return useMutation<unknown, Error, { id: string; patch: Partial<OrgUser> }>({
        mutationFn: ({ id, patch }) => apiClient.patch(`/api/org/users/${id}`, patch),
        onSuccess: () => { qc.invalidateQueries({ queryKey: usersKeys.org() }); },
    });
}

export function useDeleteUser() {
    const qc = useQueryClient();
    return useMutation<unknown, Error, string>({
        mutationFn: (id) => apiClient.delete(`/api/org/users/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: usersKeys.org() }); },
    });
}
