import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MoreHorizontal, RotateCcw, Ban, Check, X, ExternalLink, Copy, Eye, Loader2 } from 'lucide-react';
import { tokenFor } from '../../../shared/statusTokens';
import { RunStatusIcon, DryRunBadge } from '../RoutinesStudio/RunStatusBits';
import ContextMenu from '../RoutinesStudio/ContextMenu';
import { formatRelative, formatDuration } from '../RoutinesStudio/historyUtils';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import useExecutions from './useExecutions';
import useRunStream from './useRunStream';
import ExecutionsFilterBar from './ExecutionsFilterBar';

/**
 * n8n-style executions list — a dense table of runs with status / name /
 * started / run time / trigger / actions. Server-side filters + cursor
 * pagination (infinite scroll) + live SSE updates. Clicking a row opens it
 * full-screen via `onOpenRun`.
 *
 * scope: 'global' shows the Name column + an automation picker; 'automation'
 * and 'step' are fixed to one id.
 */
export default function ExecutionsTable({ scope, automationId, stepId, onOpenRun, onOpenEditor }) {
    const api = useAutomationApi();
    const {
        rows, loading, loadingMore, error, hasMore, loadMore, refresh,
        filters, setFilters, facets, applyEvent, patchRow, scopedAutomationId,
    } = useExecutions({ scope, automationId, stepId });

    // Live updates merge into the list.
    useRunStream({
        enabled: true,
        automationId: scope === 'global' ? null : (automationId || stepId),
        onEvent: applyEvent,
    });

    const isGlobal = scope === 'global';

    // Sticky automation options for the global picker — accumulated from rows so
    // filtering by one automation doesn't drop the others from the dropdown.
    const seenAutosRef = useRef(new Map());
    if (isGlobal) {
        for (const r of rows) if (r.automationId && r.automationTitle) seenAutosRef.current.set(r.automationId, r.automationTitle);
    }
    const automationOptions = useMemo(
        () => [...seenAutosRef.current.entries()].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title)),
        [rows], // eslint-disable-line react-hooks/exhaustive-deps
    );

    // Infinite scroll sentinel.
    const sentinelRef = useRef(null);
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el || !hasMore) return undefined;
        const io = new IntersectionObserver((entries) => {
            if (entries.some(e => e.isIntersecting)) loadMore();
        }, { rootMargin: '200px' });
        io.observe(el);
        return () => io.disconnect();
    }, [hasMore, loadMore]);

    // 6 columns in BOTH modes — matching the 6 cells ExecutionRow renders
    // (Status, Name/Run, Started, Run time, Trigger, Actions). The non-global
    // grid was previously 5 columns, so the row's Actions button wrapped.
    const gridCols = isGlobal
        ? 'minmax(120px,160px) minmax(0,1fr) 110px 90px 120px 36px'
        : 'minmax(120px,180px) minmax(0,1fr) 110px 90px 120px 36px';

    return (
        <div className="flex flex-col h-full min-h-0">
            <ExecutionsFilterBar
                filters={filters}
                setFilters={setFilters}
                facets={facets}
                live
                onRefresh={refresh}
                showAutomationPicker={isGlobal}
                automationOptions={automationOptions}
            />

            {/* Header */}
            <div
                className="grid items-center gap-3 px-4 py-1.5 text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] border-b border-[var(--border-default)]"
                style={{ gridTemplateColumns: gridCols }}
            >
                {/* Exactly 6 header cells, matching the 6-column grid and the
                    6 cells each ExecutionRow renders. */}
                <span>Status</span>
                {isGlobal ? <span>Name</span> : <span>Run</span>}
                <span>Started</span>
                <span>Run time</span>
                <span>Trigger</span>
                <span />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                {loading ? (
                    <div className="py-10 text-center text-sm text-[var(--text-tertiary)]">Loading executions…</div>
                ) : error ? (
                    <div className="py-10 text-center text-sm text-red-600 dark:text-red-400">Couldn't load executions.</div>
                ) : rows.length === 0 ? (
                    <EmptyState scope={scope} />
                ) : (
                    <>
                        {rows.map(run => (
                            <ExecutionRow
                                key={run.id}
                                run={run}
                                isGlobal={isGlobal}
                                gridCols={gridCols}
                                api={api}
                                patchRow={patchRow}
                                refresh={refresh}
                                onOpen={() => onOpenRun(run)}
                                onOpenEditor={onOpenEditor}
                            />
                        ))}
                        {hasMore && (
                            <div ref={sentinelRef} className="py-4 text-center text-xs text-[var(--text-tertiary)]">
                                {loadingMore ? 'Loading more…' : ' '}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function EmptyState({ scope }) {
    const msg = scope === 'step'
        ? 'No runs yet. Test this Step or call it from an automation to see executions.'
        : 'No executions yet. Run an automation to see its history here.';
    return (
        <div className="py-12 text-center text-sm text-[var(--text-tertiary)] px-6">{msg}</div>
    );
}

// Memoized so a live SSE tick that patches ONE row's `run` object doesn't
// re-render every accumulated row. The function props (onOpen/onOpenEditor)
// are inline per render but logically stable — they only ever act on this
// row's own `run` — so the comparator keys on the data props and ignores them.
const ExecutionRow = React.memo(ExecutionRowImpl, (prev, next) =>
    prev.run === next.run
    && prev.isGlobal === next.isGlobal
    && prev.gridCols === next.gridCols
    && prev.api === next.api
    && prev.patchRow === next.patchRow,
);

function ExecutionRowImpl({ run, isGlobal, gridCols, api, patchRow, refresh, onOpen, onOpenEditor }) {
    const [menu, setMenu] = useState(null); // {x,y}
    const [pending, setPending] = useState(false);
    const token = tokenFor(run.status);
    const isDry = run.mode === 'dry_run';
    const isStep = run.automationKind === 'block';
    const running = run.status === 'running' || run.status === 'queued';

    const act = async (label, fn, optimistic) => {
        if (pending) return;
        setPending(true);
        if (optimistic) patchRow(run.id, optimistic);
        try { await fn(); } catch { /* surfaced via refresh */ }
        finally { setPending(false); refresh(); }
    };

    const menuItems = [
        run.status === 'error' && { label: 'Retry', icon: <RotateCcw size={14} />, onClick: () => act('retry', () => api.retryRun(run.automationId, run.id)) },
        running && { label: 'Cancel', icon: <Ban size={14} />, onClick: () => act('cancel', () => api.cancelRun(run.id), { status: 'cancelled' }), danger: true },
        (run.status === 'awaiting_approval' || run.status === 'awaiting_confirm') && { label: 'Approve', icon: <Check size={14} />, onClick: () => act('approve', () => api.approveStep(run.id, 'approve')) },
        (run.status === 'awaiting_approval' || run.status === 'awaiting_confirm') && { label: 'Reject', icon: <X size={14} />, onClick: () => act('reject', () => api.approveStep(run.id, 'reject')), danger: true },
        { label: 'Open execution', icon: <Eye size={14} />, onClick: onOpen },
        run.automationId && { label: 'Open in editor', icon: <ExternalLink size={14} />, onClick: () => onOpenEditor?.(run.automationId) },
        { label: 'Copy run id', icon: <Copy size={14} />, onClick: () => navigator.clipboard?.writeText(run.id).catch(() => {}) },
    ].filter(Boolean);

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
            className="grid items-center gap-3 px-4 py-2.5 border-b border-[var(--border-subtle,var(--border-default))] hover:bg-[var(--bg-secondary)] cursor-pointer transition group"
            style={{ gridTemplateColumns: gridCols }}
        >
            {/* Status */}
            <span className="inline-flex items-center gap-1.5 min-w-0">
                {running ? <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" /> : null}
                <RunStatusIcon status={run.status} size={14} />
                <span className={`text-xs font-medium truncate ${token.solid}`}>{token.label}</span>
            </span>

            {/* Name (global) or run id (scoped) */}
            <span className="min-w-0 flex items-center gap-2">
                {isGlobal ? (
                    <>
                        <span className="text-sm text-[var(--text-primary)] truncate">{run.automationTitle || 'Untitled'}</span>
                        {isStep && <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] flex-shrink-0">Step</span>}
                    </>
                ) : (
                    <code className="text-[11px] font-mono text-[var(--text-tertiary)] truncate">{run.id.slice(0, 8)}</code>
                )}
            </span>

            {/* Started */}
            <span className="text-xs text-[var(--text-secondary)] truncate" title={run.startedAt || ''}>
                {run.startedAt ? formatRelative(run.startedAt) : '—'}
            </span>

            {/* Run time */}
            <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                {formatDuration(run.durationMs) || (running ? '…' : '—')}
            </span>

            {/* Trigger */}
            <span className="inline-flex items-center gap-1.5 min-w-0">
                {isDry ? <DryRunBadge /> : (
                    <span className="text-xs text-[var(--text-tertiary)] truncate">{run.triggerKind || run.automationTriggerType || '—'}</span>
                )}
            </span>

            {/* Actions */}
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right - 8, y: r.bottom }); }}
                className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] opacity-0 group-hover:opacity-100 transition justify-self-end"
                title="Actions"
            >
                {pending ? <Loader2 size={14} className="animate-spin" /> : <MoreHorizontal size={16} />}
            </button>
            <ContextMenu position={menu} items={menuItems} onClose={() => setMenu(null)} />
        </div>
    );
}
