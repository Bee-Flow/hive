/**
 * Pure, DB-free org-membership resolution — the client mirror of
 * server/auth/orgMembership.js.
 *
 * The People directory groups people by organisation, and it must group them by
 * the SAME rule the server filters them by, or the screen quietly disagrees with
 * the data it was handed:
 *
 *   membership = users.organizationId  UNION  { g.organizationId | g ∈ user.groups }
 *
 * There is no join table — `users.groups` is a JSON-encoded TEXT column — so
 * both paths are required, and a user can legitimately belong to several orgs
 * and appear under more than one header.
 *
 * This is a MIRROR, not an import: the server copy is CJS and cannot go into the
 * Vite bundle. The two are pinned by a behavioural lockstep test
 * (orgMembershipLockstep.test.js) that runs both over one fixture matrix.
 * Change both, or the build goes red. Same duplicate-plus-lockstep idiom as
 * src/components/onboarding/catalogLockstep.test.js.
 *
 * NOTE this does NOT re-derive which users are *visible* — only how the visible
 * ones group. OrgUsersPanel.jsx:448-455 records that client-side re-derivation
 * of the visible set made the member list diverge between the Nextcloud-embedded
 * and standalone views. Trust the server's list; group within it.
 */

/**
 * `users.groups` is a TEXT column holding a JSON array, but the API may have
 * already parsed it. Accept either, and never throw on malformed JSON.
 */
export function parseGroupIds(userRow) {
    const raw = userRow && userRow.groups;
    if (Array.isArray(raw)) return raw;
    try {
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

/**
 * Every org this user reaches, and how. One entry per (org, path), so a user
 * attached both directly and through a group yields two entries for that org —
 * the "Via" filter needs that distinction.
 *
 * @returns {Array<{ orgId: string, via: 'direct' | string }>}
 */
export function membershipFor(userRow, allGroups = []) {
    const out = [];
    const seen = new Set();
    const add = (orgId, via) => {
        // `users.organizationId` DEFAULTs to '' and a global group's
        // organizationId is NULL — both falsy, and neither is an org.
        if (!orgId) return;
        const key = `${orgId}|${via}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ orgId, via });
    };

    add(userRow && userRow.organizationId, 'direct');
    for (const gid of parseGroupIds(userRow)) {
        const group = allGroups.find((g) => g.id === gid);
        add(group && group.organizationId, `group:${gid}`);
    }
    return out;
}

/** The distinct orgs this user reaches, by either path. */
export function orgIdsForUser(userRow, allGroups = []) {
    return new Set(membershipFor(userRow, allGroups).map((m) => m.orgId));
}

/** Does this user reach `orgId` by either path? */
export function isMemberOfOrg(userRow, allGroups, orgId) {
    if (!orgId) return false;
    return orgIdsForUser(userRow, allGroups).has(orgId);
}
