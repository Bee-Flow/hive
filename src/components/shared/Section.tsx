import React from 'react';

/**
 * Section — bordered panel container with an optional title bar.
 * Replaces the recurring inline pattern:
 *
 *   <div className="rounded border p-4 bg-white/5">
 *     <h3 className="text-sm font-semibold mb-2">Title</h3>
 *     <p className="text-xs text-muted mb-3">Description</p>
 *     {children}
 *   </div>
 *
 * Used to give settings panels and admin sections a consistent shell so
 * the spacing/border style only lives in one place.
 */

export interface SectionProps {
    title?: React.ReactNode;
    description?: React.ReactNode;
    /** Optional element rendered to the right of the title (links, badges). */
    actions?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
    /** When false, drops outer padding so the section can host its own grid. */
    padded?: boolean;
}

export default function Section({
    title,
    description,
    actions,
    children,
    className = '',
    padded = true,
}: SectionProps) {
    const hasHeader = title != null || description != null || actions != null;
    return (
        <section
            className={
                'rounded-xl border border-[var(--border-subtle)] bg-white/5 ' +
                (padded ? 'p-4 ' : '') +
                className
            }
        >
            {hasHeader && (
                <header className={`flex items-start justify-between gap-3 ${children ? 'mb-3' : ''}`}>
                    <div className="min-w-0">
                        {title != null && (
                            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
                        )}
                        {description != null && (
                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{description}</p>
                        )}
                    </div>
                    {actions != null && <div className="flex-shrink-0">{actions}</div>}
                </header>
            )}
            {children}
        </section>
    );
}
