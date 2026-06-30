import { CalendarDays, ListTree, List } from 'lucide-react';
import React from 'react';
import SegmentedControl from '../../../shared/SegmentedControl';

/**
 * Presentational controls for the History tab: a glanceable 24h stat strip
 * plus a status-filter chip group and a grouping toggle. Pure — all state
 * lives in the HistoryTab container; this just renders props.
 *
 * Counts on the status chips are computed from the SAME loaded run list the
 * chips filter, so a chip's number always matches what the list shows.
 */

const GROUP_OPTIONS = [
    { value: 'day', label: 'By day', icon: <CalendarDays size={14} /> },
    { value: 'automation', label: 'By automation', icon: <ListTree size={14} /> },
    { value: 'flat', label: 'Flat', icon: <List size={14} /> },
];

function StatTile({ value, label, tone }) {
    const valueColor = {
        neutral: 'text-[var(--text-primary)]',
        success: 'text-emerald-600 dark:text-emerald-400',
        error: 'text-red-600 dark:text-red-400',
        active: 'text-amber-600 dark:text-amber-400',
    }[tone] || 'text-[var(--text-primary)]';
    return (
        <div className="flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5 text-center">
            <div data-testid={`stat-${tone}`} className={`text-xl font-bold tabular-nums ${valueColor}`}>{value}</div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] mt-0.5">{label}</div>
        </div>
    );
}

/** Chip label with a muted count suffix (count hidden when zero/undefined). */
function ChipLabel({ text, count }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            {text}
            {count ? <span className="opacity-60 tabular-nums">{count}</span> : null}
        </span>
    );
}

export default function HistoryFilters({ stats, chipCounts, statusFilter, onStatusFilter, groupMode, onGroupMode }) {
    const statusOptions = [
        { value: 'all', label: <ChipLabel text="All" count={chipCounts.all} /> },
        { value: 'error', label: <ChipLabel text="Failures" count={chipCounts.error} /> },
        { value: 'running', label: <ChipLabel text="Running" count={chipCounts.running} /> },
        { value: 'awaiting', label: <ChipLabel text="Awaiting" count={chipCounts.awaiting} /> },
        { value: 'dry_run', label: <ChipLabel text="Dry-run" count={chipCounts.dry_run} /> },
    ];

    return (
        <div className="space-y-3">
            {/* 24h glance strip */}
            <div className="flex items-stretch gap-2">
                <StatTile value={stats.total} label="Runs · 24h" tone="neutral" />
                <StatTile value={stats.success} label="Success" tone="success" />
                <StatTile value={stats.failures} label="Failures" tone="error" />
                <StatTile value={stats.active} label="Running" tone="active" />
            </div>

            {/* Filter + grouping controls */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <SegmentedControl
                    size="sm"
                    ariaLabel="Filter runs by status"
                    value={statusFilter}
                    onChange={onStatusFilter}
                    options={statusOptions}
                />
                <SegmentedControl
                    size="sm"
                    ariaLabel="Group runs"
                    value={groupMode}
                    onChange={onGroupMode}
                    options={GROUP_OPTIONS}
                />
            </div>
        </div>
    );
}
