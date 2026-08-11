import { Edit2, Shield, Trash2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';
import RoleBadge from '../../../shared/RoleBadge';

/**
 * One person in the directory.
 *
 * Two deliberate departures from the table this replaces
 * (UserManagement.jsx:469-523):
 *
 *  1. Actions are ALWAYS rendered. The `xl:opacity-0 xl:group-hover:opacity-100`
 *     reveal used across UserManagement is a tab stop you cannot see — an
 *     accessibility defect, not a style choice. (Its root cause is the inline
 *     `style={{}}` idiom, which cannot express hover/focus variants at all.)
 *  2. No avatar image branch. getAllUsers() deliberately excludes `avatar`
 *     (userStore.js:811-812), so the old emoji/image branches could never fire —
 *     every row already falls through to the initial. Rendering a branch that
 *     cannot execute is worse than not having it; real avatars need
 *     getAllUserAvatars and a second round-trip.
 */
export default function PeopleRow({ user, orgChips = [], onEdit, onResetMfa, onDelete, canManage = false }) {
    const { t } = useTranslation();
    const isSystem = user.isSystem || user.id === 'admin';
    const initial = (user.displayName?.[0] || user.username?.[0] || '?').toUpperCase();

    return (
        <div
            className="px-5 py-2.5 flex items-center gap-3 hover:bg-[var(--bg-card-hover)] transition-colors"
            data-testid="people-row"
        >
            <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}
                aria-hidden="true"
            >
                {initial}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {user.displayName || user.username}
                    </span>
                    <RoleBadge role={user.orgRole || user.role} />
                    {orgChips.map((chip) => (
                        <span
                            key={chip}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] whitespace-nowrap"
                        >
                            {chip}
                        </span>
                    ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span className="truncate">@{user.username || user.id}</span>
                    {user.email && <span className="truncate">· {user.email}</span>}
                </div>
            </div>

            {canManage && !isSystem && (
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={() => onEdit?.(user)}
                        aria-label={t('admin.sec_people_edit', 'Edit {name}', { name: user.displayName || user.username })}
                        className="p-1.5 rounded hover:bg-blue-500/10 text-blue-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                    >
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onResetMfa?.(user)}
                        aria-label={t('admin.sec_people_reset_mfa', 'Reset 2FA for {name}', { name: user.displayName || user.username })}
                        className="p-1.5 rounded hover:bg-amber-500/10 text-amber-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                    >
                        <Shield className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onDelete?.(user)}
                        aria-label={t('admin.sec_people_delete', 'Delete {name}', { name: user.displayName || user.username })}
                        className="p-1.5 rounded hover:bg-red-500/10 text-red-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
