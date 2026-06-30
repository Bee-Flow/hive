// Identity-scoped cache reset helpers.
//
// React Query keys in this app are NOT tenant-scoped (e.g. ['agents','list']),
// and user-scoped localStorage is keyed by userId. When the signed-in IDENTITY
// changes — a different account, or the same account switching active org — all
// cached server data from the previous identity must be dropped so it can't
// bleed into the new identity's views (App.jsx wires queryClient.clear() to the
// `true` result). These helpers isolate that decision so it can be unit-tested
// without mounting the whole app.

export interface IdentityLike {
    id?: string | number | null;
    organizationId?: string | number | null;
    orgId?: string | number | null;
}

/**
 * A stable string identifying "who is signed in, in which org". Returns null
 * when signed out. Two renders with the same id+org produce the same key, so
 * benign profile patches don't look like an identity change.
 */
export function identityKey(user: IdentityLike | null | undefined): string | null {
    if (!user || user.id == null || user.id === '') return null;
    const org = user.organizationId ?? user.orgId ?? '';
    return `${user.id}:${org}`;
}

/**
 * True when the cache must be cleared: a transition from one signed-in identity
 * to a DIFFERENT signed-in identity. The initial sign-in (null → X) and logout
 * (X → null, handled explicitly elsewhere) do not trigger a reset here, nor does
 * an unchanged identity.
 */
export function shouldResetCache(prev: string | null, next: string | null): boolean {
    return !!prev && !!next && prev !== next;
}
