// Projects — the API module this feature never had.
//
// Every project call used to be an inline `authFetch` in ProjectDetailPage.jsx
// and AgentHub.jsx, which is why nothing was cached, nothing was shared between
// the two, and the sidebar list never refreshed. api/client.ts is the intended
// client (its own header says domain hooks should consume `apiClient` rather
// than reaching for `authFetch`), so this module brings Projects in line with
// agents / conversations / users.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

/**
 * apiClient resolves to `T | null` (a 204 or an empty body is a legitimate
 * response for some endpoints). For the project reads and writes below, a null
 * body means the server answered with nothing where a resource was required —
 * treating that as data would push `null` into components expecting a Project.
 * Failing here surfaces it as a query/mutation error instead.
 */
function required<T>(value: T | null, what: string): T {
    if (value === null || value === undefined) throw new Error(`Empty response for ${what}`);
    return value;
}

export const projectKeys = {
    all: ['projects'] as const,
    list: () => [...projectKeys.all, 'list'] as const,
    detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
    members: (id: string) => [...projectKeys.all, 'members', id] as const,
    activity: (id: string) => [...projectKeys.all, 'activity', id] as const,
    threads: (id: string) => [...projectKeys.all, 'threads', id] as const,
};

export type ProjectRole = 'owner' | 'editor' | 'viewer';

export interface Project {
    id: string;
    name: string;
    description?: string;
    customInstructions?: string;
    knowledgeBaseIds?: string[];
    color?: string;
    icon?: string;
    ownerId?: string;
    organizationId?: string;
    extractMemories?: boolean;
    /** Optimistic-concurrency token. Send it back on update to get a 409 instead
     *  of silently overwriting a colleague's edit. */
    version?: number;
    permission?: ProjectRole;
    role?: ProjectRole;
    createdAt?: string;
    updatedAt?: string;
}

export interface ProjectThread {
    id: string;
    type: 'direct' | 'agent';
    ownerId: string;
    projectId: string;
    title: string | null;
    updatedAt?: string;
    createdAt?: string;
}

export interface ProjectActivityItem {
    id: string;
    projectId: string;
    actorId: string;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    details?: Record<string, unknown>;
    createdAt?: string;
}

/** Raised when a project was changed by someone else mid-edit. */
export class ProjectConflictError extends Error {
    current: Project | null;
    constructor(message: string, current: Project | null) {
        super(message);
        this.name = 'ProjectConflictError';
        this.current = current;
    }
}

// ── Reads ────────────────────────────────────────────────────────────

export function useProjects(enabled = true) {
    return useQuery<Project[], Error>({
        queryKey: projectKeys.list(),
        queryFn: ({ signal }) => apiClient.get<Project[]>('/api/projects', { signal }).then((d) => d ?? []),
        enabled,
    });
}

export function useProject(id: string | null | undefined) {
    return useQuery<Project, Error>({
        queryKey: id ? projectKeys.detail(id) : projectKeys.all,
        queryFn: ({ signal }) => apiClient
            .get<Project>(`/api/projects/${id}`, { signal })
            .then((d) => required(d, 'project')),
        enabled: Boolean(id),
    });
}

export function useProjectThreads(id: string | null | undefined) {
    return useQuery<ProjectThread[], Error>({
        queryKey: id ? projectKeys.threads(id) : projectKeys.all,
        queryFn: ({ signal }) => apiClient
            .get<{ threads: ProjectThread[] }>(`/api/projects/${id}/threads`, { signal })
            .then((d) => d?.threads ?? []),
        enabled: Boolean(id),
    });
}

export function useProjectActivity(id: string | null | undefined, limit = 50) {
    return useQuery<{ items: ProjectActivityItem[]; hasMore: boolean }, Error>({
        queryKey: id ? projectKeys.activity(id) : projectKeys.all,
        queryFn: ({ signal }) => apiClient
            .get<{ items: ProjectActivityItem[]; hasMore: boolean }>(
                `/api/projects/${id}/activity?limit=${limit}`, { signal })
            .then((d) => d ?? { items: [], hasMore: false }),
        enabled: Boolean(id),
        // The live stream pushes updates now; this is the fallback for a client
        // whose stream could not connect, not the primary path.
        staleTime: 30_000,
    });
}

// ── Writes ───────────────────────────────────────────────────────────

export function useUpdateProject(id: string) {
    const qc = useQueryClient();
    return useMutation<Project, Error, Partial<Project> & { version?: number }>({
        mutationFn: async (patch) => {
            try {
                return required(await apiClient.put<Project>(`/api/projects/${id}`, patch), 'project update');
            } catch (err: unknown) {
                // 409 means a colleague saved first. Surface their version so the
                // UI can show what changed instead of silently discarding one of
                // the two edits — which is what happened before `version` existed.
                const e = err as { status?: number; body?: { error?: string; current?: Project } };
                if (e?.status === 409) {
                    throw new ProjectConflictError(
                        e.body?.error || 'This project was changed by someone else.',
                        e.body?.current ?? null,
                    );
                }
                throw err;
            }
        },
        onSuccess: (updated) => {
            qc.setQueryData(projectKeys.detail(id), updated);
            qc.invalidateQueries({ queryKey: projectKeys.list() });
        },
    });
}

/** Share one of MY conversations into a project. Owner-only, server-enforced. */
export function useShareThread(projectId: string) {
    const qc = useQueryClient();
    return useMutation<{ shared: boolean; rekeyed: number }, Error, { conversationId: string; type?: 'direct' | 'agent' }>({
        mutationFn: (body) => apiClient
            .post<{ shared: boolean; rekeyed: number }>(`/api/projects/${projectId}/threads`, body)
            .then((d) => d ?? { shared: true, rekeyed: 0 }),
        onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.threads(projectId) }),
    });
}

export function useUnshareThread(projectId: string) {
    const qc = useQueryClient();
    return useMutation<{ shared: boolean }, Error, { conversationId: string; type?: 'direct' | 'agent' }>({
        mutationFn: ({ conversationId, type }) => apiClient
            .delete<{ shared: boolean }>(`/api/projects/${projectId}/threads/${conversationId}?type=${type || 'direct'}`)
            .then((d) => d ?? { shared: false }),
        onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.threads(projectId) }),
    });
}

/**
 * Detach one of my own conversations from whatever project it is filed under.
 *
 * Deliberately not `PUT /:id/conversations` — that needs editor on the project,
 * so a user downgraded to viewer (or removed) could never unfile their own chat.
 */
export function useDetachConversation() {
    const qc = useQueryClient();
    return useMutation<unknown, Error, { conversationId: string; type?: 'direct' | 'agent' }>({
        mutationFn: ({ conversationId, type }) =>
            apiClient.delete(`/api/projects/conversations/${conversationId}?type=${type || 'direct'}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
    });
}
