// Lightweight permission predicate. Replaces the repeated 5-6-condition OR
// blocks found inline in admin panels:
//
//   const canManage =
//     user?.permissions?.includes('all') ||
//     user?.permissions?.includes('manage_skills') ||
//     user?.isAdmin ||
//     user?.role === 'admin' ||
//     user?.role === 'superadmin' ||
//     (user?.roles || []).some(r => r === 'admin');
//
// Usage:
//   const can = usePermissionCheck(user, 'manage_skills');
//   const canDelete = usePermissionCheck(user, ['delete_agents', 'manage_agents']);
//
// `all` always wins (super-admin escape hatch matching the rest of the
// codebase). Boolean `isAdmin` is treated as `all`.

import { useMemo } from 'react';

export interface PermissionUser {
    permissions?: string[] | null;
    isAdmin?: boolean;
}

export type PermissionSpec = string | readonly string[];

function hasOne(user: PermissionUser | null | undefined, perm: string): boolean {
    if (!user) return false;
    if (user.isAdmin) return true;
    const perms = user.permissions ?? [];
    return perms.includes('all') || perms.includes(perm);
}

export default function usePermissionCheck(
    user: PermissionUser | null | undefined,
    required: PermissionSpec,
): boolean {
    return useMemo(() => {
        if (typeof required === 'string') return hasOne(user, required);
        // Array semantics: ANY-of (caller asks for "either of these gates me in").
        // The vast majority of inline OR-chains in the codebase work this way.
        return required.some((p) => hasOne(user, p));
    }, [user, required]);
}

/** Non-hook variant for ad-hoc checks (e.g. inside event handlers). */
export function checkPermission(
    user: PermissionUser | null | undefined,
    required: PermissionSpec,
): boolean {
    if (typeof required === 'string') return hasOne(user, required);
    return required.some((p) => hasOne(user, p));
}
