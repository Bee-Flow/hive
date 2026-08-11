import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE, authFetch } from '../../../../../utils/helpers';

/**
 * App Studio RBAC — the authoring hooks for the per-app role model.
 *
 * The authoritative role definitions live in the DATA MODEL (owner-only,
 * server-enforced by the RLS gateway), NOT the app definition — the definition
 * only carries role KEY references (screen/node visibleToRoles). This hook is
 * the thin react-query surface over the two owner-only endpoints that own the
 * model + membership:
 *
 *   GET  /api/studio-apps/:id/schema          → { model, modelVersion }
 *   PUT  /api/studio-apps/:id/schema          ← { model }   (whole data model)
 *   GET  /api/studio-apps/:id/members         → { members }
 *   POST /api/studio-apps/:id/members         ← { userId, roleKey }
 *   DELETE /api/studio-apps/:id/members/:uid
 *
 * Every read degrades a 404 (app has no data model yet, or the viewer can't
 * read it) to an empty/neutral value rather than an error, so the Roles UI
 * renders a friendly empty state instead of crashing.
 *
 * Writes go through the SAME whole-model PUT the server validates (data-model
 * shape + every rowFilter against the bounded SQL subset). saveRoles /
 * saveTableAccess / saveRowFilter therefore READ the freshest cached model and
 * MERGE their slice in, so a role edit never clobbers tables and a rowFilter
 * edit never clobbers roles.
 */

const enc = encodeURIComponent;
const base = `${API_BASE}/api/studio-apps`;

async function request(url, options = {}) {
    const res = await authFetch(url, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
    });
    // Owner-only reads answer 404 (invisible) or 403 (readable non-owner) — both
    // mean "no authoring surface here", so a GET degrades to null.
    const isGet = !options.method || options.method === 'GET';
    if (isGet && (res.status === 404 || res.status === 403)) return null;
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    if (!res.ok) {
        const err = new Error(body?.error || `Request failed (${res.status})`);
        err.status = res.status;
        err.body = body;
        throw err;
    }
    return body;
}

/** A blank-but-valid data model, matching server emptyDataModel(). */
function emptyModel() {
    return { modelVersion: 1, tables: [], roles: [], roleMapping: { default: 'app', byGroup: {} } };
}

export const APP_SCHEMA_KEY = (appId) => ['studio-app-schema', appId];
export const APP_MEMBERS_KEY = (appId) => ['studio-app-members', appId];

/**
 * The primary RBAC hook. Exposes the model's roles/roleMapping/tables, the
 * membership list, and the merge-aware writers. `appId` may be null (the hook
 * simply stays idle).
 */
export default function useAppRoles(appId) {
    const qc = useQueryClient();
    const schemaKey = APP_SCHEMA_KEY(appId);
    const membersKey = APP_MEMBERS_KEY(appId);

    const schemaQuery = useQuery({
        queryKey: schemaKey,
        queryFn: async () => {
            const body = await request(`${base}/${enc(appId)}/schema`);
            return body && body.model && typeof body.model === 'object' ? body.model : null;
        },
        enabled: !!appId,
        staleTime: 30_000,
        retry: false,
    });

    const membersQuery = useQuery({
        queryKey: membersKey,
        queryFn: async () => {
            const body = await request(`${base}/${enc(appId)}/members`);
            return Array.isArray(body?.members) ? body.members : [];
        },
        enabled: !!appId,
        staleTime: 30_000,
        retry: false,
    });

    const model = schemaQuery.data || null;
    const roles = Array.isArray(model?.roles) ? model.roles : [];
    const roleMapping = (model?.roleMapping && typeof model.roleMapping === 'object')
        ? model.roleMapping
        : { default: 'app', byGroup: {} };
    const tables = Array.isArray(model?.tables) ? model.tables : [];
    const members = Array.isArray(membersQuery.data) ? membersQuery.data : [];

    // The freshest model to merge into: the react-query cache wins (it may hold
    // a just-saved value the local `model` closure hasn't re-rendered with yet).
    const currentModel = () => {
        const cached = qc.getQueryData(schemaKey);
        return (cached && typeof cached === 'object') ? cached : (model || emptyModel());
    };

    const putModel = async (nextModel) => {
        const body = await request(`${base}/${enc(appId)}/schema`, {
            method: 'PUT',
            body: JSON.stringify({ model: nextModel }),
        });
        // Optimistically adopt the model we just persisted, then refetch to pick
        // up the server's canonical version.
        qc.setQueryData(schemaKey, nextModel);
        qc.invalidateQueries({ queryKey: schemaKey });
        return body;
    };

    const saveRolesMutation = useMutation({
        mutationFn: async ({ roles: nextRoles, roleMapping: nextMapping }) => {
            const cur = currentModel();
            const next = {
                ...cur,
                roles: Array.isArray(nextRoles) ? nextRoles : (cur.roles || []),
                roleMapping: nextMapping && typeof nextMapping === 'object'
                    ? nextMapping
                    : (cur.roleMapping || { default: 'app', byGroup: {} }),
            };
            return putModel(next);
        },
    });

    const saveTableAccessMutation = useMutation({
        mutationFn: async ({ tableId, access: patch }) => {
            const cur = currentModel();
            const nextTables = (Array.isArray(cur.tables) ? cur.tables : []).map((t) => {
                if (!t || (t.id !== tableId && t.key !== tableId)) return t;
                const curAccess = (t.access && typeof t.access === 'object') ? t.access : {};
                return { ...t, access: mergeAccess(curAccess, patch) };
            });
            return putModel({ ...cur, tables: nextTables });
        },
    });

    const addMemberMutation = useMutation({
        mutationFn: ({ userId, roleKey }) => request(`${base}/${enc(appId)}/members`, {
            method: 'POST',
            body: JSON.stringify({ userId, roleKey }),
        }),
        onSuccess: () => qc.invalidateQueries({ queryKey: membersKey }),
    });

    const removeMemberMutation = useMutation({
        mutationFn: (userId) => request(`${base}/${enc(appId)}/members/${enc(userId)}`, { method: 'DELETE' }),
        onSuccess: () => qc.invalidateQueries({ queryKey: membersKey }),
    });

    return {
        // model slices
        model,
        roles,
        roleMapping,
        tables,
        members,
        // status
        isLoading: !!appId && (schemaQuery.isLoading || membersQuery.isLoading),
        isError: schemaQuery.isError,
        error: schemaQuery.error || null,
        hasModel: !!model,
        refetch: () => { schemaQuery.refetch(); membersQuery.refetch(); },
        // writers (promises)
        saveRoles: (nextRoles, nextMapping) => saveRolesMutation.mutateAsync({ roles: nextRoles, roleMapping: nextMapping }),
        saveTableAccess: (tableId, patch) => saveTableAccessMutation.mutateAsync({ tableId, access: patch }),
        saveRowFilter: (tableId, roleKey, expr) => {
            const trimmed = typeof expr === 'string' ? expr.trim() : '';
            return saveTableAccessMutation.mutateAsync({
                tableId,
                access: { rowFilters: { [roleKey]: trimmed || null } },
            });
        },
        assignMember: (userId, roleKey) => addMemberMutation.mutateAsync({ userId, roleKey }),
        removeMember: (userId) => removeMemberMutation.mutateAsync(userId),
        savingRoles: saveRolesMutation.isPending,
        savingAccess: saveTableAccessMutation.isPending,
        savingMember: addMemberMutation.isPending || removeMemberMutation.isPending,
    };
}

/**
 * Merge an access patch into a table's access block. `roles` and `rowFilters`
 * are merged key-by-key; a `null` rowFilter/role entry DELETES that key (so
 * clearing a rule doesn't leave a dangling empty string the gateway rejects).
 */
export function mergeAccess(current, patch) {
    const out = {
        default: current.default,
        roles: { ...(current.roles && typeof current.roles === 'object' ? current.roles : {}) },
        rowFilters: { ...(current.rowFilters && typeof current.rowFilters === 'object' ? current.rowFilters : {}) },
    };
    if (!patch || typeof patch !== 'object') return out;
    if (typeof patch.default === 'string') out.default = patch.default;
    if (patch.roles && typeof patch.roles === 'object') {
        for (const [k, v] of Object.entries(patch.roles)) {
            if (v == null) delete out.roles[k]; else out.roles[k] = v;
        }
    }
    if (patch.rowFilters && typeof patch.rowFilters === 'object') {
        for (const [k, v] of Object.entries(patch.rowFilters)) {
            if (v == null || v === '') delete out.rowFilters[k]; else out.rowFilters[k] = v;
        }
    }
    return out;
}

/**
 * The org directory (groups + users) used to map GROUPS → role and assign
 * specific USERS → role. Both endpoints require elevated org permissions the
 * app owner may not hold — a 403 degrades to an empty list, and the Roles UI
 * falls back to manual id entry.
 */
export function useOrgDirectory(enabled = true) {
    const groupsQuery = useQuery({
        queryKey: ['org-directory-groups'],
        queryFn: async () => {
            const body = await request(`${API_BASE}/auth/groups`);
            return Array.isArray(body) ? body : [];
        },
        enabled: !!enabled,
        staleTime: 60_000,
        retry: false,
    });
    const usersQuery = useQuery({
        queryKey: ['org-directory-users'],
        queryFn: async () => {
            const body = await request(`${API_BASE}/auth/users`);
            return Array.isArray(body) ? body : [];
        },
        enabled: !!enabled,
        staleTime: 60_000,
        retry: false,
    });
    return {
        groups: Array.isArray(groupsQuery.data) ? groupsQuery.data : [],
        users: Array.isArray(usersQuery.data) ? usersQuery.data : [],
        isLoading: (!!enabled) && (groupsQuery.isLoading || usersQuery.isLoading),
        // A 403 is expected (owner without directory perms) — never surfaced as error.
        available: !groupsQuery.isError,
    };
}
