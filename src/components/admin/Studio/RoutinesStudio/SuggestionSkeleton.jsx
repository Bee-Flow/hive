import React from 'react';

/**
 * SuggestionSkeleton — placeholder cards shown while a scan is running and we
 * don't have any results to display yet. Mirrors the SuggestionCard footprint
 * so the grid doesn't jump when real cards arrive. Pure CSS pulse, theme vars
 * only.
 */
export default function SuggestionSkeleton({ count = 3 }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" aria-hidden="true">
            {Array.from({ length: Math.max(1, count) }).map((_, i) => (
                <div
                    key={i}
                    className="flex flex-col rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 animate-pulse"
                >
                    <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="h-4 w-4 rounded bg-[var(--bg-tertiary)]" />
                        <div className="h-4 w-16 rounded bg-[var(--bg-tertiary)]" />
                    </div>
                    <div className="h-4 w-3/4 rounded bg-[var(--bg-tertiary)] mb-2" />
                    <div className="h-3 w-full rounded bg-[var(--bg-tertiary)] mb-1.5" />
                    <div className="h-3 w-5/6 rounded bg-[var(--bg-tertiary)] mb-4" />
                    <div className="flex gap-2 mt-auto">
                        <div className="h-7 w-28 rounded-lg bg-[var(--bg-tertiary)]" />
                        <div className="h-7 w-24 rounded-lg bg-[var(--bg-tertiary)]" />
                    </div>
                </div>
            ))}
        </div>
    );
}
