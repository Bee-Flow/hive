import React from 'react';

/**
 * Loading placeholder for a list of people — a header block over avatar-shaped
 * rows. Extracted from OrgUsersPanel so the Security People directory loads with
 * the same silhouette the Settings member list already uses.
 *
 * Deliberately NOT merged with the `TableSkeleton` in
 * pages/settings/OrgAcademyPanel.jsx: despite the shared name, that one renders
 * five plain bars for a progress table and has no avatar column. They look alike
 * only in the import list.
 */
export default function UserListSkeleton({ rows = 3, showHeader = true }) {
    return (
        <div className="animate-pulse" data-testid="user-list-skeleton">
            {showHeader && (
                <div className="px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex justify-between">
                    <div className="space-y-1.5">
                        <div className="h-5 w-40 bg-[var(--bg-tertiary)] rounded" />
                        <div className="h-3 w-64 bg-[var(--bg-tertiary)] rounded" />
                    </div>
                </div>
            )}
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-4 border-b border-[var(--border-subtle)]">
                    <div className="w-9 h-9 rounded-full bg-[var(--bg-tertiary)]" />
                    <div className="flex-1 space-y-1.5">
                        <div className="h-4 w-32 bg-[var(--bg-tertiary)] rounded" />
                        <div className="h-3 w-48 bg-[var(--bg-tertiary)] rounded" />
                    </div>
                </div>
            ))}
        </div>
    );
}
