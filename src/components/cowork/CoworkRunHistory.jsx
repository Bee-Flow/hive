/**
 * Every execution of one cowork item, newest first — the thing prompt tasks
 * never had. A prompt task only ever kept its *last* result, so "it stopped
 * working last Tuesday" was unanswerable.
 *
 * Fetched per item on selection rather than up front: a user with ten
 * schedules would otherwise pull ten histories to read one.
 */
import React, { useEffect, useState } from 'react';
import MarkdownRenderer from '../MarkdownRenderer';
import { tokenFor } from '../shared/statusTokens';
import { listCoworkRuns } from './coworkApi';
import { formatDuration, fullTimestamp } from './coworkFormat';

function RunRow({ run }) {
    const [open, setOpen] = useState(false);
    const status = tokenFor(run.status);
    const StatusIcon = status.icon;

    return (
        <div
            data-testid="cowork-run"
            className="rounded-xl border"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
            >
                <StatusIcon
                    className={`w-4 h-4 flex-shrink-0 ${status.spin ? 'animate-spin' : ''} ${status.solid}`}
                />
                <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium ${status.badge}`}>
                    {status.label}
                </span>
                <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    {fullTimestamp(run.startedAt)}
                </span>
                <span className="text-[11px] ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                    {run.triggerKind === 'manual' ? 'run by you' : 'on schedule'}
                    {run.durationMs != null && ` · ${formatDuration(run.durationMs)}`}
                </span>
            </button>
            {open && (
                <div
                    className="px-3 pb-3 pt-2 text-[12.5px] break-words border-t"
                    style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}
                >
                    {/* A result is model output, so it arrives as Markdown —
                        headings, bullets, tables, bold. Printed raw it was a
                        wall of asterisks and pipes. A failure is not: it is a
                        stack line or an API message, and passing that through a
                        Markdown parser only mangles it. */}
                    {run.error
                        ? <div className="whitespace-pre-wrap font-mono text-[11.5px] text-red-600 dark:text-red-400">{run.error}</div>
                        : run.result
                            ? <MarkdownRenderer content={run.result} className="cowork-run-output" />
                            : <span style={{ color: 'var(--text-tertiary)' }}>No output was recorded for this run.</span>}
                </div>
            )}
        </div>
    );
}

export default function CoworkRunHistory({ coworkId, reloadKey }) {
    // State carries the key it was fetched for, so "is this stale?" is derived
    // rather than announced by a setState in the effect body. Switching items
    // therefore shows the spinner immediately on the same render, instead of
    // flashing the previous item's runs for one frame.
    const key = `${coworkId}:${reloadKey}`;
    const [state, setState] = useState({ key: null, runs: [], total: 0, error: null });

    useEffect(() => {
        if (!coworkId) return undefined;
        let cancelled = false;
        listCoworkRuns(coworkId)
            .then(({ runs, total }) => {
                if (!cancelled) setState({ key, runs, total, error: null });
            })
            .catch((err) => {
                if (!cancelled) setState({ key, runs: [], total: 0, error: err.message });
            });
        return () => { cancelled = true; };
    }, [coworkId, key]);

    if (state.key !== key) {
        return <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>Loading history…</p>;
    }
    if (state.error) {
        return <p className="text-[12px] text-red-600 dark:text-red-400" role="alert">{state.error}</p>;
    }
    if (state.runs.length === 0) {
        return (
            <p className="text-[12px]" style={{ color: 'var(--text-tertiary)' }} data-testid="cowork-no-runs">
                This hasn&rsquo;t run yet. The history fills in after the first run.
            </p>
        );
    }
    return (
        <div className="flex flex-col gap-1.5" data-testid="cowork-run-list">
            {state.runs.map(run => <RunRow key={run.id} run={run} />)}
            {state.total > state.runs.length && (
                <p className="text-[11px] pt-1" style={{ color: 'var(--text-tertiary)' }}>
                    Showing the {state.runs.length} most recent of {state.total} runs.
                </p>
            )}
        </div>
    );
}
