import React from 'react';

/**
 * StudioShell — two-pane layout (left sidebar + main content) used by the
 * three Studio panels: Routines, Skills, Knowledge Bases. Replaces the
 * duplicated chrome in:
 *   - components/admin/Studio/RoutinesStudio/
 *   - components/admin/Studio/SkillsStudio/index.jsx
 *   - components/admin/Studio/KBsStudio/index.jsx
 *
 * Slot-based on purpose: list-item rendering, empty states, and detail
 * views diverge per Studio, so we only standardize the chrome (widths,
 * borders, sidebar header bar) rather than forcing a single list shape.
 */

export interface StudioShellProps {
    /** Header text shown at the top of the sidebar. */
    sidebarTitle?: React.ReactNode;
    /** Action element rendered to the right of the title (typically a + button). */
    sidebarActions?: React.ReactNode;
    /** Body of the sidebar (search input + scrollable list). */
    sidebar: React.ReactNode;
    /** Main content slot — renders the selected item's detail or an EmptyState. */
    children: React.ReactNode;
    /** Sidebar width in Tailwind sizing units; default 'w-64' (256px). */
    sidebarWidthClass?: string;
    className?: string;
}

export default function StudioShell({
    sidebarTitle,
    sidebarActions,
    sidebar,
    children,
    sidebarWidthClass = 'w-64',
    className = '',
}: StudioShellProps) {
    return (
        <div className={`flex h-full bg-[var(--bg-primary)] ${className}`}>
            <aside
                className={`${sidebarWidthClass} flex-shrink-0 border-r border-[var(--border-default)] flex flex-col`}
            >
                {(sidebarTitle != null || sidebarActions != null) && (
                    <header className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                        <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                            {sidebarTitle}
                        </span>
                        {sidebarActions != null && (
                            <div className="flex-shrink-0">{sidebarActions}</div>
                        )}
                    </header>
                )}
                <div className="flex-1 overflow-y-auto">{sidebar}</div>
            </aside>
            <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
    );
}
