import React from 'react';
import { RefreshCw, ChevronDown } from 'lucide-react';

/**
 * Filter bar for the executions table: status chips (counts from facets), a
 * date-range segmented control, and — for the global view — an automation
 * picker. Presentational; the parent owns `filters` via useExecutions.
 */
const STATUS_CHIPS = [
    { key: 'all', label: 'All' },
    { key: 'success', label: 'Success' },
    { key: 'error', label: 'Failures' },
    { key: 'running', label: 'Running' },
    { key: 'awaiting', label: 'Awaiting' },
];
const RANGES = [
    { key: '24h', label: '24h' },
    { key: '7d', label: '7d' },
    { key: '30d', label: '30d' },
    { key: 'all', label: 'All' },
];

function statusCount(facets, key) {
    if (!facets?.status) return null;
    const s = facets.status;
    if (key === 'all') return Object.values(s).reduce((a, b) => a + b, 0);
    if (key === 'running') return (s.running || 0) + (s.queued || 0);
    if (key === 'awaiting') return (s.awaiting_approval || 0) + (s.awaiting_confirm || 0);
    return s[key] || 0;
}

export default function ExecutionsFilterBar({
    filters, setFilters, facets, live = false, onRefresh,
    showAutomationPicker = false, automationOptions = [],
}) {
    const set = (patch) => setFilters(prev => ({ ...prev, ...patch }));

    return (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-[var(--border-default)]">
            {/* Status chips */}
            <div className="flex items-center gap-1">
                {STATUS_CHIPS.map(chip => {
                    const active = filters.status === chip.key;
                    const count = statusCount(facets, chip.key);
                    return (
                        <button
                            key={chip.key}
                            type="button"
                            onClick={() => set({ status: chip.key })}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition border ${
                                active
                                    ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--text-tertiary)]'
                                    : 'text-[var(--text-secondary)] border-transparent hover:bg-[var(--bg-secondary)]'
                            }`}
                        >
                            {chip.label}
                            {count != null && <span className="text-[10px] tabular-nums text-[var(--text-tertiary)]">{count}</span>}
                        </button>
                    );
                })}
            </div>

            <div className="flex-1" />

            {/* Automation picker (global only) */}
            {showAutomationPicker && (
                <div className="relative">
                    <select
                        value={filters.automationId || ''}
                        onChange={(e) => set({ automationId: e.target.value || null })}
                        className="appearance-none pl-2.5 pr-7 py-1 rounded-lg text-xs bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition max-w-[14rem]"
                        title="Filter by automation"
                    >
                        <option value="">All automations</option>
                        {automationOptions.map(o => (
                            <option key={o.id} value={o.id}>{o.title || 'Untitled'}</option>
                        ))}
                    </select>
                    <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                </div>
            )}

            {/* Date range */}
            <div className="inline-flex items-center rounded-lg border border-[var(--border-default)] overflow-hidden">
                {RANGES.map(r => (
                    <button
                        key={r.key}
                        type="button"
                        onClick={() => set({ range: r.key })}
                        className={`px-2 py-1 text-xs font-medium transition ${
                            filters.range === r.key
                                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                        }`}
                    >
                        {r.label}
                    </button>
                ))}
            </div>

            <button
                type="button"
                onClick={onRefresh}
                title={live ? 'Live — updating automatically' : 'Refresh'}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition"
            >
                <RefreshCw size={13} />
                {live && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Live" />}
            </button>
        </div>
    );
}
