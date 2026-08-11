import { Building2, ChevronDown, ChevronRight, Users as UsersIcon } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';
import PeopleRow from './PeopleRow';

/**
 * A collapsible directory section — one organisation (with its groups nested
 * inside), one group, or the "No organisation" / "No group" bucket.
 *
 * The org status chip does NOT go through shared/statusTokens: that enum is a
 * run/job vocabulary (success, running, queued, …) and tokenFor() falls back to
 * `idle` for anything outside it — so an org with status 'suspended' would
 * render as "Idle", which is simply false. An org lifecycle is its own
 * vocabulary, so it gets its own two-entry map. 'active' is the norm and shows
 * no chip at all.
 *
 * Separators use `--border-default`, not `--border-subtle`: the subtle token is
 * rgba(255,255,255,.06) and effectively vanishes in the high-contrast theme.
 */
const ORG_STATUS_CHIP = {
    suspended: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40',
    archived: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-default)]',
};
export default function PeopleGroupSection({
    section,
    rowProps,
    defaultOpen = true,
    orgChipsFor = () => [],
    depth = 0,
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(defaultOpen);
    const Chevron = open ? ChevronDown : ChevronRight;
    const isOrg = section.kind === 'org';
    const Icon = isOrg ? Building2 : UsersIcon;
    const headingId = `people-section-${section.key}`;

    // Only orgs carry a lifecycle, and only a non-active one is worth a chip.
    const statusChip = isOrg ? ORG_STATUS_CHIP[section.status] : null;
    const statusLabel = isOrg
        ? {
            suspended: t('admin.sec_people_org_suspended', 'Suspended'),
            archived: t('admin.sec_people_org_archived', 'Archived'),
        }[section.status]
        : null;

    return (
        <div className="border-b border-[var(--border-default)] last:border-b-0" role="group" aria-labelledby={headingId}>
            <button
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="w-full px-5 py-2.5 flex items-center gap-2 hover:bg-[var(--bg-card-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent-primary)]"
                style={{ paddingLeft: `${1.25 + depth * 1}rem` }}
            >
                <Chevron className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" aria-hidden="true" />
                <Icon className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" aria-hidden="true" />

                <h3 id={headingId} className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {section.title}
                </h3>

                {section.subtitle && (
                    <span className="text-xs text-[var(--text-muted)] truncate">· {section.subtitle}</span>
                )}
                {section.isGlobal && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                        {t('admin.sec_people_global_group', 'Global')}
                    </span>
                )}
                {section.orphaned && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                        {t('admin.sec_people_unknown_org', 'Unknown organisation')}
                    </span>
                )}

                <span className="ml-auto flex items-center gap-2 flex-shrink-0">
                    {statusChip && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusChip}`}>{statusLabel}</span>
                    )}
                    <span className="text-xs text-[var(--text-muted)] tabular-nums">
                        {t('admin.sec_people_count', '{count} people', { count: section.count })}
                    </span>
                </span>
            </button>

            {open && (
                <div>
                    {section.subsections?.length
                        ? section.subsections.map((sub) => (
                            <PeopleGroupSection
                                key={sub.key}
                                section={{ ...sub, kind: 'group' }}
                                rowProps={rowProps}
                                orgChipsFor={orgChipsFor}
                                depth={depth + 1}
                            />
                        ))
                        : section.users.map((u) => (
                            <PeopleRow key={u.id} user={u} orgChips={orgChipsFor(u)} {...rowProps} />
                        ))}
                </div>
            )}
        </div>
    );
}
