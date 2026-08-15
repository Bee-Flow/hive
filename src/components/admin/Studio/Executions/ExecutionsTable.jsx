import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MoreHorizontal, RotateCcw, Ban, Check, X, ExternalLink, Copy, Eye, Link2, Loader2 } from 'lucide-react';
import { tokenFor } from '../../../shared/statusTokens';
import { RunStatusIcon, DryRunBadge } from '../RoutinesStudio/RunStatusBits';
import ContextMenu from '../RoutinesStudio/ContextMenu';
import { formatRelative, formatDuration, dayBucketLabel, absoluteTime } from '../RoutinesStudio/historyUtils';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import { useTranslation } from '../../../../hooks/useTranslation';
import useExecutions from './useExecutions';
import { runTitle, triggerLabel, whatHappened } from './runLanguage';
import useRunStream from './useRunStream';
import ExecutionsFilterBar from './ExecutionsFilterBar';

/**
 * The runs list — status / what ran / what happened / timing / trigger, in
 * sentences rather than machine words (runLanguage.js). Server-side filters +
 * cursor pagination (infinite scroll) + live SSE updates, grouped under
 * sticky day headers. Clicking a row opens it full-screen via `onOpenRun`.
 *
 * scope: 'global' shows the Name column + an automation picker; 'automation'
 * and 'step' are fixed to one id. `active=false` (hidden-mounted panel)
 * stands fetching and streaming down entirely.
 */
export default function ExecutionsTable({ scope, automationId, stepId, active = true, onOpenRun, onOpenEditor }) {
    const api = useAutomationApi();
    const {
        rows, loading, loadingMore, error, hasMore, loadMore, refresh,
        filters, setFilters, facets, applyEvent, patchRow, scopedAutomationId,
    } = useExecutions({ scope, automationId, stepId, enabled: active });

    // Live updates merge into the list.
    const { state: liveState } = useRunStream({
        enabled: active,
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

    // 7 columns in BOTH scopes — matching the 7 cells ExecutionRow renders
    // (Outcome, What ran, What happened, Started, Took, Started by, Actions).
    // Header cells, gridCols and the row MUST change together, and the memo
    // comparator below keys on gridCols.
    const gridCols = 'minmax(110px,140px) minmax(130px,1fr) minmax(170px,1.5fr) 100px 70px 140px 36px';

    // Day buckets — 200 rows of "Started 3h ago" carry no shape without them.
    const rowsWithDays = useMemo(() => {
        const out = [];
        let lastDay = null;
        for (const run of rows) {
            const day = dayBucketLabel(run.startedAt);
            if (day !== lastDay) { out.push({ day, key: `day:${day}:${run.id}` }); lastDay = day; }
            out.push({ run, key: run.id });
        }
        return out;
    }, [rows]);

    return (
        <div className="flex flex-col h-full min-h-0">
            <ExecutionsFilterBar
                filters={filters}
                setFilters={setFilters}
                facets={facets}
                liveState={liveState}
                onRefresh={refresh}
                onOpenRunById={(id) => onOpenRun({ id })}
                showAutomationPicker={isGlobal}
                automationOptions={automationOptions}
                showModePicker={scope !== 'step'}
            />

            {/* Header */}
            <div
                className="grid items-center gap-3 px-4 py-1.5 text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] border-b border-[var(--border-default)]"
                style={{ gridTemplateColumns: gridCols }}
            >
                {/* Exactly 7 header cells, matching the 7-column grid and the
                    7 cells each ExecutionRow renders. */}
                <span>Outcome</span>
                <span>What ran</span>
                <span>What happened</span>
                <span>Started</span>
                <span>Took</span>
                <span>Started by</span>
                <span />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                {loading ? (
                    <div className="py-10 text-center text-sm text-[var(--text-tertiary)]">Loading runs…</div>
                ) : error ? (
                    <div className="py-10 text-center space-y-2">
                        <div className="text-sm text-red-600 dark:text-red-400">We couldn't load the runs.</div>
                        {/* refresh exists on the hook but used to be reachable
                            only from the filter bar — which this branch never
                            rendered. A dead end with a working retry one
                            variable away. */}
                        <button
                            type="button"
                            onClick={refresh}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
                        >
                            Try again
                        </button>
                    </div>
                ) : rows.length === 0 ? (
                    <EmptyState scope={scope} range={filters.range} onShowAllTime={() => setFilters(prev => ({ ...prev, range: 'all' }))} />
                ) : (
                    <>
                        {rowsWithDays.map(entry => (entry.run ? (
                            <ExecutionRow
                                key={entry.key}
                                run={entry.run}
                                isGlobal={isGlobal}
                                gridCols={gridCols}
                                api={api}
                                patchRow={patchRow}
                                refresh={refresh}
                                onOpen={() => onOpenRun(entry.run)}
                                onOpenEditor={onOpenEditor}
                            />
                        ) : (
                            <div
                                key={entry.key}
                                className="sticky top-0 z-10 px-4 py-1 text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] bg-[var(--bg-primary)] border-b border-[var(--border-subtle,var(--border-default))]"
                            >
                                {entry.day}
                            </div>
                        )))}
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

function EmptyState({ scope, range, onShowAllTime }) {
    if (range && range !== 'all') {
        return (
            <div className="py-12 text-center px-6 space-y-2">
                <div className="text-sm text-[var(--text-primary)]">No runs in this time range.</div>
                <div className="text-xs text-[var(--text-secondary)]">Older runs are still here — widen the time range to see them.</div>
                <button
                    type="button"
                    onClick={onShowAllTime}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
                >
                    Show all time
                </button>
            </div>
        );
    }
    const msg = scope === 'step'
        ? 'No runs yet. Test this Step or call it from an automation to see its runs.'
        : 'No runs yet. Run the routine to see what happened here, step by step.';
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
    const [actionError, setActionError] = useState(null);
    const { t } = useTranslation();
    const token = tokenFor(run.status);
    const isDry = run.mode === 'dry_run';
    const isStep = run.automationKind === 'block';
    const running = run.status === 'running' || run.status === 'queued';
    const raw = whatHappened(run);
    const happened = { ...raw, text: t(raw.key, raw.en, raw.params) };

    const act = async (label, fn, optimistic) => {
        if (pending) return;
        setPending(true);
        setActionError(null);
        if (optimistic) patchRow(run.id, optimistic);
        try { await fn(); } catch (e) {
            // Swallowing left the button silently resetting — say what failed.
            setActionError(`Couldn't do that: ${e?.message || 'unknown error'}`);
        } finally { setPending(false); refresh(); }
    };

    const copyLink = () => {
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('view', 'runs');
            url.searchParams.set('run', run.id);
            url.searchParams.delete('step');
            navigator.clipboard?.writeText(url.toString());
        } catch { /* clipboard blocked — nothing useful to do */ }
    };

    // awaiting_confirm is a RUN-level gate and routes to /runs/:id/approve;
    // approve-step answers a step-level awaiting_approval. They were both
    // wired to approveStep, so confirming a run 404'd.
    const isAwaitStep = run.status === 'awaiting_approval';
    const isAwaitRun = run.status === 'awaiting_confirm';
    const menuItems = [
        run.status === 'error' && { label: 'Run it again', icon: <RotateCcw size={14} />, onClick: () => act('retry', () => api.retryRun(run.automationId, run.id)) },
        running && { label: 'Stop it', icon: <Ban size={14} />, onClick: () => act('cancel', () => api.cancelRun(run.id), { status: 'cancelled' }), danger: true },
        (isAwaitStep || isAwaitRun) && { label: 'Approve', icon: <Check size={14} />, onClick: () => act('approve', () => (isAwaitRun ? api.approveRun(run.id) : api.approveStep(run.id, 'approve'))) },
        isAwaitStep && { label: 'Reject', icon: <X size={14} />, onClick: () => act('reject', () => api.approveStep(run.id, 'reject')), danger: true },
        { label: 'Open this run', icon: <Eye size={14} />, onClick: onOpen },
        { label: 'Copy a link to this run', icon: <Link2 size={14} />, onClick: copyLink },
        run.automationId && { label: 'Open in editor', icon: <ExternalLink size={14} />, onClick: () => onOpenEditor?.(run.automationId) },
        { label: 'Copy run id', icon: <Copy size={14} />, onClick: () => navigator.clipboard?.writeText(run.id).catch(() => {}) },
    ].filter(Boolean);

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
            className="grid items-center gap-3 px-4 py-2.5 border-b border-[var(--border-subtle,var(--border-default))] hover:bg-[var(--bg-secondary)] cursor-pointer transition group"
            style={{ gridTemplateColumns: gridCols }}
        >
            {/* Outcome */}
            <span className="inline-flex items-center gap-1.5 min-w-0">
                {running ? <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" /> : null}
                <RunStatusIcon status={run.status} size={14} />
                <span className={`text-xs font-medium truncate ${token.solid}`}>{token.label}</span>
            </span>

            {/* What ran — the title (global) or the run's own name (scoped;
                a truncated hex id is not a name anyone reads). DryRunBadge in
                BOTH scopes: once "Tests only" is selectable, a test run must
                never be indistinguishable from a live one. */}
            <span className="min-w-0 flex items-center gap-2">
                <span className="text-sm text-[var(--text-primary)] truncate">
                    {isGlobal ? (run.automationTitle || 'Untitled') : runTitle(run)}
                </span>
                {isDry && <DryRunBadge />}
                {isStep && <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] flex-shrink-0">Step</span>}
            </span>

            {/* What happened — the sentence, full text in the title. */}
            <span
                className={`text-xs truncate ${happened.tone === 'error' ? 'text-red-600 dark:text-red-400' : happened.tone === 'warn' ? 'text-amber-700 dark:text-amber-300' : 'text-[var(--text-secondary)]'}`}
                title={happened.text}
            >
                {happened.text}
            </span>

            {/* Started — relative on screen, the real clock time in the title. */}
            <span className="text-xs text-[var(--text-secondary)] truncate" title={absoluteTime(run.startedAt)}>
                {run.startedAt ? formatRelative(run.startedAt) : '—'}
            </span>

            {/* Took */}
            <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                {formatDuration(run.durationMs) || (running ? '…' : '—')}
            </span>

            {/* Started by */}
            <span className="text-xs text-[var(--text-tertiary)] truncate" title={run.triggerKind || ''}>
                {triggerLabel(run.triggerKind || run.automationTriggerType)}
            </span>

            {/* Actions — focus-visible keeps the ⋯ reachable by keyboard. */}
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right - 8, y: r.bottom }); }}
                className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition justify-self-end"
                title="Actions"
            >
                {pending ? <Loader2 size={14} className="animate-spin" /> : <MoreHorizontal size={16} />}
            </button>
            {actionError && (
                <div role="alert" className="col-span-full text-xs text-red-600 dark:text-red-400">{actionError}</div>
            )}
            <ContextMenu position={menu} items={menuItems} onClose={() => setMenu(null)} />
        </div>
    );
}
