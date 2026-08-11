import { Search } from 'lucide-react';
import React from 'react';
import { ORG_ROLES } from '../../../config/orgRoles';
import { useTranslation } from '../../../hooks/useTranslation';
import { ORG_NONE } from '../../../hooks/useUserFilters';

/**
 * The people filter bar — search + role + group + status, and optionally
 * organisation + membership path.
 *
 * Extracted from OrgUsersPanel, which had the only working one in the product,
 * so Settings and Security filter people the same way. Pairs with
 * hooks/useUserFilters.js, which owns the state and does the filtering.
 *
 * The `organizations` and `showVia` props are additive: pass them and the extra
 * selects appear. OrgUsersPanel is already scoped to one org, so it passes
 * neither and renders exactly the four controls it always had.
 */
const selectClass =
    'px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] ' +
    'text-[var(--text-primary)] text-xs outline-none disabled:opacity-50';

export default function UserFilterBar({
    filters,
    setFilter,
    clear,
    active,
    shownCount,
    totalCount,
    groups = [],
    organizations = null,
    showVia = false,
    countLabel = null,
}) {
    const { t } = useTranslation();

    return (
        <div
            className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/95 backdrop-blur-sm flex flex-wrap items-center gap-2"
            data-testid="user-filter-bar"
        >
            <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilter('search', e.target.value)}
                    placeholder={t('admin.org_search_users', 'Search by name or email…')}
                    aria-label={t('admin.org_search_users', 'Search by name or email…')}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-xs outline-none focus:border-[var(--accent-primary)] transition-colors"
                />
            </div>

            {organizations && (
                <select
                    value={filters.org}
                    onChange={(e) => setFilter('org', e.target.value)}
                    aria-label={t('admin.org_all_orgs', 'All organisations')}
                    className={`${selectClass} max-w-[200px]`}
                >
                    <option value="all">{t('admin.org_all_orgs', 'All organisations')}</option>
                    {organizations.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                    <option value={ORG_NONE}>{t('admin.org_org_none', 'No organisation')}</option>
                </select>
            )}

            <select
                value={filters.role}
                onChange={(e) => setFilter('role', e.target.value)}
                aria-label={t('admin.org_all_roles')}
                className={selectClass}
            >
                <option value="all">{t('admin.org_all_roles')}</option>
                <option value="user">{t('admin.org_role_user')}</option>
                {ORG_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                ))}
            </select>

            <select
                value={filters.group}
                onChange={(e) => setFilter('group', e.target.value)}
                disabled={groups.length === 0}
                aria-label={t('admin.org_all_groups')}
                className={`${selectClass} max-w-[200px]`}
            >
                <option value="all">{t('admin.org_all_groups')}</option>
                {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                ))}
            </select>

            <select
                value={filters.status}
                onChange={(e) => setFilter('status', e.target.value)}
                aria-label={t('admin.org_all_statuses')}
                className={selectClass}
            >
                <option value="all">{t('admin.org_all_statuses')}</option>
                <option value="active">{t('admin.org_status_active')}</option>
                <option value="pending">{t('admin.org_status_pending')}</option>
            </select>

            {showVia && (
                <select
                    value={filters.via}
                    onChange={(e) => setFilter('via', e.target.value)}
                    aria-label={t('admin.org_all_via', 'Any membership')}
                    className={selectClass}
                >
                    <option value="all">{t('admin.org_all_via', 'Any membership')}</option>
                    <option value="direct">{t('admin.org_via_direct', 'Direct member')}</option>
                    <option value="group">{t('admin.org_via_group', 'Via a group')}</option>
                </select>
            )}

            <span className="text-[11px] text-[var(--text-muted)] ml-auto whitespace-nowrap">
                {countLabel
                    ? countLabel(shownCount, totalCount)
                    : t('admin.org_showing_count', { count: shownCount, total: totalCount })}
            </span>

            {active && (
                <button onClick={clear} className="text-[11px] text-[var(--accent-primary)] hover:underline">
                    {t('admin.org_clear_filters', 'Clear')}
                </button>
            )}
        </div>
    );
}
