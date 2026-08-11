import { useMemo } from 'react';
import { membershipFor, parseGroupIds } from './orgMembership';

/**
 * The grouping brain for the People directory — pure, so it can be tested
 * without rendering anything.
 *
 * It groups an ALREADY-VISIBLE list of people; it never decides who is visible.
 * OrgUsersPanel.jsx:425-432 records why: re-deriving the org set client-side made
 * the member list diverge between the Nextcloud-embedded and standalone views,
 * and could hide members from an org-admin whose client-side org pointer was
 * stale. The server's list is the truth; we only arrange it.
 *
 * Membership is resolved by ./orgMembership.js, which mirrors the server's
 * resolveUserOrgIds union (direct organizationId ∪ each group's organizationId)
 * and is pinned to it by orgMembershipLockstep.test.js.
 *
 * Three consequences the UI must show rather than hide:
 *  • A person in two orgs appears under BOTH headers. Deduping would misrepresent
 *    the data — they really can access both. `distinctCount` therefore counts
 *    people once while section counts count rows.
 *  • People reachable by neither path land in "No organisation". They are
 *    invisible in every org-scoped view today.
 *  • A global group (organizationId NULL) confers no org membership at all, so
 *    its members appear under "No organisation" unless another path attaches them.
 */

export const GROUP_BY = Object.freeze({ ORG: 'org', GROUP: 'group', FLAT: 'flat' });

export const SECTION_NO_ORG = '__no_org__';
export const SECTION_NO_GROUP = '__no_group__';
export const SECTION_ALL = '__all__';

const byName = (a, b) => String(a.title || '').localeCompare(String(b.title || ''));

/** Rows for one org, split by the groups of THAT org (plus a "no group" bucket). */
function splitByGroup(usersInOrg, orgGroups, noGroupTitle) {
    const buckets = new Map();
    const ungrouped = [];

    for (const u of usersInOrg) {
        const ids = parseGroupIds(u);
        const mine = orgGroups.filter((g) => ids.includes(g.id));
        if (!mine.length) {
            ungrouped.push(u);
            continue;
        }
        // A person in two groups of the same org appears under both — that is
        // what the data says. The org header counts them once.
        for (const g of mine) {
            if (!buckets.has(g.id)) buckets.set(g.id, { key: g.id, title: g.name, users: [] });
            buckets.get(g.id).users.push(u);
        }
    }

    const out = [...buckets.values()].sort(byName).map((b) => ({ ...b, count: b.users.length }));
    if (ungrouped.length) {
        out.push({ key: SECTION_NO_GROUP, title: noGroupTitle, users: ungrouped, count: ungrouped.length });
    }
    return out;
}

export function buildDirectory(users, groups, organizations, options = {}) {
    const {
        groupBy = GROUP_BY.ORG,
        noOrgTitle = 'No organisation',
        noGroupTitle = 'No group',
        allTitle = 'All people',
        // When the caller has filtered to one org, only that org gets a section.
        // Without this a person in two orgs would still drag their OTHER org's
        // header into a view explicitly scoped to one — filtering to Beta would
        // show an Acme section.
        onlyOrgId = null,
    } = options;

    const list = users || [];
    const allGroups = groups || [];
    const orgs = organizations || [];

    const distinctCount = list.length;
    const multiOrgCount = list.filter((u) => new Set(membershipFor(u, allGroups).map((m) => m.orgId)).size > 1).length;
    const base = { distinctCount, multiOrgCount };

    if (groupBy === GROUP_BY.FLAT) {
        return {
            ...base,
            sections: list.length
                ? [{ key: SECTION_ALL, kind: 'all', title: allTitle, count: list.length, users: list, subsections: [] }]
                : [],
        };
    }

    if (groupBy === GROUP_BY.GROUP) {
        const orgById = new Map(orgs.map((o) => [o.id, o]));
        const buckets = new Map();
        const ungrouped = [];

        for (const u of list) {
            const ids = parseGroupIds(u);
            const mine = allGroups.filter((g) => ids.includes(g.id));
            if (!mine.length) {
                ungrouped.push(u);
                continue;
            }
            for (const g of mine) {
                if (!buckets.has(g.id)) {
                    buckets.set(g.id, {
                        key: g.id,
                        kind: 'group',
                        title: g.name,
                        // A global group has no org — say so rather than leaving it blank.
                        subtitle: g.organizationId ? orgById.get(g.organizationId)?.name || g.organizationId : null,
                        isGlobal: !g.organizationId,
                        users: [],
                        subsections: [],
                    });
                }
                buckets.get(g.id).users.push(u);
            }
        }

        const sections = [...buckets.values()].sort(byName).map((s) => ({ ...s, count: s.users.length }));
        if (ungrouped.length) {
            sections.push({
                key: SECTION_NO_GROUP,
                kind: 'none',
                title: noGroupTitle,
                count: ungrouped.length,
                users: ungrouped,
                subsections: [],
            });
        }
        return { ...base, sections };
    }

    // groupBy === ORG
    const orgById = new Map(orgs.map((o) => [o.id, o]));
    const buckets = new Map();
    const noOrg = [];

    for (const u of list) {
        const all = [...new Set(membershipFor(u, allGroups).map((m) => m.orgId))];
        const orgIds = onlyOrgId ? all.filter((id) => id === onlyOrgId) : all;
        if (!orgIds.length) {
            // Only genuinely org-less people go to the bucket. Someone filtered
            // out by onlyOrgId has an org — they are simply not in this view.
            if (!all.length) noOrg.push(u);
            continue;
        }
        for (const orgId of orgIds) {
            if (!buckets.has(orgId)) {
                const org = orgById.get(orgId);
                buckets.set(orgId, {
                    key: orgId,
                    kind: 'org',
                    // An org id with no matching row still gets a section — dropping
                    // the people would be worse than showing an unresolved id.
                    title: org?.name || orgId,
                    status: org?.status || 'active',
                    orphaned: !org,
                    users: [],
                });
            }
            buckets.get(orgId).users.push(u);
        }
    }

    const sections = [...buckets.values()].sort(byName).map((s) => ({
        ...s,
        count: s.users.length,
        subsections: splitByGroup(s.users, allGroups.filter((g) => g.organizationId === s.key), noGroupTitle),
    }));

    if (noOrg.length) {
        sections.push({
            key: SECTION_NO_ORG,
            kind: 'none',
            title: noOrgTitle,
            count: noOrg.length,
            users: noOrg,
            subsections: [],
        });
    }

    return { ...base, sections };
}

/** React wrapper — memoised so a keystroke in the filter bar does not re-group. */
export function useUserDirectory(users, groups, organizations, options = {}) {
    const { groupBy, noOrgTitle, noGroupTitle, allTitle, onlyOrgId } = options;
    return useMemo(
        () => buildDirectory(users, groups, organizations, { groupBy, noOrgTitle, noGroupTitle, allTitle, onlyOrgId }),
        [users, groups, organizations, groupBy, noOrgTitle, noGroupTitle, allTitle, onlyOrgId],
    );
}
