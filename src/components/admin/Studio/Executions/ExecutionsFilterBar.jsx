import React, { useState } from 'react';
import { RefreshCw, ChevronDown, Search } from 'lucide-react';
import { runIdFromText, triggerLabel } from './runLanguage';

/**
 * Filter bar for the runs table: status chips (counts from facets), a
 * date-range segmented control, trigger + live/test selects, a paste-a-link
 * jump box, and — for the global view — an automation picker. Presentational;
 * the parent owns `filters` via useExecutions.
 */
const STATUS_CHIPS = [
    { key: 'all', label: 'All' },
    { key: 'success', label: 'Success' },
    { key: 'error', label: 'Failures' },
    { key: 'running', label: 'Running' },
    { key: 'awaiting', label: 'Awaiting' },
    { key: 'cancelled', label: 'Stopped' },
];
const RANGES = [
    { key: '24h', label: '24h' },
    { key: '7d', label: '7d' },
    { key: '30d', label: '30d' },
    { key: 'all', label: 'All' },
];
const MODES = [
    { key: 'live', label: 'Live runs' },
    { key: 'dry_run', label: 'Tests only' },
    { key: 'both', label: 'Live runs and tests' },
];
const CHIP_LABELS = Object.fromEntries(STATUS_CHIPS.map(c => [c.key, c.label]));
const RANGE_WORDS = { '24h': 'last 24 hours', '7d': 'last 7 days', '30d': 'last 30 days' };

function statusCount(facets, key) {
    if (!facets?.status) return null;
    const s = facets.status;
    if (key === 'all') return Object.values(s).reduce((a, b) => a + b, 0);
    if (key === 'running') return (s.running || 0) + (s.queued || 0);
    if (key === 'awaiting') return (s.awaiting_approval || 0) + (s.awaiting_confirm || 0) + (s.awaiting_form || 0);
    return s[key] || 0;
}

export default function ExecutionsFilterBar({
    filters, setFilters, facets, liveState = null, onRefresh,
    onOpenRunById = null, showAutomationPicker = false, automationOptions = [],
    showModePicker = true,
}) {
    const set = (patch) => setFilters(prev => ({ ...prev, ...patch }));
    const [jumpText, setJumpText] = useState('');
    const [jumpError, setJumpError] = useState(false);

    const jump = () => {
        const id = runIdFromText(jumpText);
        if (id && onOpenRunById) { setJumpError(false); setJumpText(''); onOpenRunById(id); }
        else setJumpError(true);
    };

    // What is currently narrowing the list, in one sentence — filters were
    // easy to set and invisible to un-set.
    const activeParts = [];
    if (filters.status && filters.status !== 'all') activeParts.push((CHIP_LABELS[filters.status] || filters.status).toLowerCase());
    if (filters.range && filters.range !== 'all') activeParts.push(RANGE_WORDS[filters.range] || filters.range);
    if (filters.trigger) activeParts.push(triggerLabel(filters.trigger).toLowerCase());
    if (showModePicker && filters.mode && filters.mode !== 'live') activeParts.push(MODES.find(m => m.key === filters.mode)?.label.toLowerCase() || filters.mode);

    const liveDot = liveState === 'live'
        ? { cls: 'bg-emerald-500 animate-pulse', title: 'Live — new runs appear on their own' }
        : liveState === 'polling'
            ? { cls: 'bg-amber-500', title: 'Checking every 5 seconds' }
            : liveState === 'paused'
                ? { cls: 'bg-[var(--text-tertiary)]', title: 'Paused while this tab is in the background' }
                : null;

    return (
        <div className="border-b border-[var(--border-default)]">
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
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

                {/* Jump to a pasted run link / id */}
                {onOpenRunById && (
                    <div className="relative">
                        <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                        <input
                            type="text"
                            value={jumpText}
                            onChange={(e) => { setJumpText(e.target.value); if (jumpError) setJumpError(false); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') jump(); }}
                            placeholder="Paste a run link or id"
                            aria-label="Paste a run link or id"
                            aria-invalid={jumpError || undefined}
                            className={`pl-7 pr-2 py-1 rounded-lg text-xs bg-[var(--bg-secondary)] border text-[var(--text-primary)] w-[13rem] focus:outline-none ${jumpError ? 'border-[var(--error)]' : 'border-[var(--border-default)]'}`}
                        />
                    </div>
                )}

                {/* Trigger — a select, not chips, so the chip names stay unique. */}
                <div className="relative">
                    <select
                        value={filters.trigger || ''}
                        onChange={(e) => set({ trigger: e.target.value || null })}
                        aria-label="Filter by trigger"
                        className="appearance-none pl-2.5 pr-7 py-1 rounded-lg text-xs bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition max-w-[12rem]"
                    >
                        <option value="">Any trigger</option>
                        {Object.keys(facets?.triggerKind || {}).sort().map(kind => (
                            <option key={kind} value={kind}>{triggerLabel(kind)}</option>
                        ))}
                    </select>
                    <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                </div>

                {/* Live vs test runs. Hidden for Steps — their runs are all tests. */}
                {showModePicker && (
                    <div className="relative">
                        <select
                            value={filters.mode || 'live'}
                            onChange={(e) => set({ mode: e.target.value })}
                            aria-label="Live or test runs"
                            className="appearance-none pl-2.5 pr-7 py-1 rounded-lg text-xs bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
                        >
                            {MODES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                        </select>
                        <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                    </div>
                )}

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
                    title={liveDot ? liveDot.title : 'Refresh'}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition"
                >
                    <RefreshCw size={13} />
                    {liveDot && <span className={`w-1.5 h-1.5 rounded-full ${liveDot.cls}`} title={liveDot.title} />}
                </button>
            </div>

            {/* Standing facts under the controls: what is narrowing the list,
                and what the counts actually cover. */}
            {(activeParts.length > 0 || filters.range === 'all') && (
                <div className="flex items-center gap-3 px-4 pb-1.5 text-[10px] text-[var(--text-tertiary)]">
                    {activeParts.length > 0 && (
                        <>
                            <span>Showing: {activeParts.join(', ')}</span>
                            <button
                                type="button"
                                onClick={() => set({ status: 'all', range: 'all', trigger: null, mode: 'both' })}
                                className="underline hover:no-underline"
                            >
                                Show everything
                            </button>
                        </>
                    )}
                    {filters.range === 'all' && (
                        // The server clamps facet counting to 720h — the chips'
                        // numbers are honest only with this label.
                        <span>Counts cover the last 30 days.</span>
                    )}
                </div>
            )}
        </div>
    );
}
