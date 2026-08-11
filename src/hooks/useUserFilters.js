import { useCallback, useMemo, useState } from 'react';
import { membershipFor, parseGroupIds } from '../components/admin/security/people/orgMembership';

/**
 * Filter state + the filtering itself for a list of people.
 *
 * Lifted from OrgUsersPanel's `filteredOrgUsers` memo (which was the only
 * working filter bar in the product) and widened with the two axes the Security
 * People directory needs: `org` and `via`.
 *
 * `via` is the cheapest possible proof that dual-path membership is handled:
 * a person can belong to an org directly (users.organizationId) OR transitively
 * through a group (users.groups → groups.organizationId). Filtering to "Direct"
 * must make the transitive-only people disappear.
 *
 * This filters a list; it does NOT decide who is *in* the list. That is the
 * server's answer (see the note at OrgUsersPanel.jsx:448-455 — re-deriving the
 * visible set client-side once made the member list diverge between the
 * Nextcloud-embedded and standalone views).
 */

export const ORG_NONE = '__none__';

export const INITIAL_FILTERS = Object.freeze({
    search: '',
    role: 'all',
    group: 'all',
    status: 'all',
    org: 'all',
    via: 'all',
});

const matchesVia = (m, via) => (via === 'direct' ? m.via === 'direct' : m.via !== 'direct');

export function useUserFilters(users, { groups = [] } = {}) {
    const [filters, setFilters] = useState(INITIAL_FILTERS);

    const setFilter = useCallback((key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    }, []);

    const clear = useCallback(() => setFilters(INITIAL_FILTERS), []);

    const active = useMemo(
        () => Object.keys(INITIAL_FILTERS).some((k) => filters[k] !== INITIAL_FILTERS[k]),
        [filters],
    );

    const filtered = useMemo(() => {
        const q = filters.search.trim().toLowerCase();

        return (users || []).filter((u) => {
            if (q) {
                const hay = `${u.displayName || ''} ${u.username || ''} ${u.email || ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }

            if (filters.role !== 'all') {
                // Carried over from OrgUsersPanel: this conflates users.orgRole
                // with users.role. See the note in shared/RoleBadge.jsx.
                const role = u.orgRole || u.role || 'user';
                if (filters.role === 'user') {
                    if (role !== 'user' && role !== 'member') return false;
                } else if (role !== filters.role) return false;
            }

            if (filters.group !== 'all' && !parseGroupIds(u).includes(filters.group)) return false;

            if (filters.status !== 'all' && (u.status || 'active') !== filters.status) return false;

            const membership = membershipFor(u, groups);

            if (filters.org === ORG_NONE) {
                // People reachable by neither path — invisible in every org view
                // today, which is precisely why they get a bucket.
                if (membership.length) return false;
                return true;
            }

            if (filters.org !== 'all') {
                const toOrg = membership.filter((m) => m.orgId === filters.org);
                if (!toOrg.length) return false;
                // Scope `via` to the selected org: "direct members of Acme",
                // not "members of Acme who are direct members of anything".
                if (filters.via !== 'all' && !toOrg.some((m) => matchesVia(m, filters.via))) return false;
                return true;
            }

            if (filters.via !== 'all' && !membership.some((m) => matchesVia(m, filters.via))) return false;

            return true;
        });
    }, [users, groups, filters]);

    return { filters, setFilter, clear, active, filtered };
}
