import React, { useMemo } from 'react';
import { tokenFor } from '../../../shared/statusTokens';
import { buildStepLabelMap } from '../../AITasksDesigner/Builder/flow/displayHelpers';
import { formatDuration } from '../RoutinesStudio/historyUtils';

/**
 * The run as a story: every step in order, named as the user named it, with
 * what happened and how long it took. Sits beside the read-only canvas —
 * the canvas answers "where in the flow", this answers "in what order, and
 * where did it stop". Clicking a row selects the same step on the canvas.
 *
 * Reads only what ExecutionView already holds — no new request. Sub-steps
 * (parentStepId set — a Step/flowlet call's inner records) render indented
 * under their call step. Multiple attempts of one step collapse into the
 * LATEST record with an "attempt N" note.
 */
export default function RunStepTimeline({
    steps = [],
    definition = null,
    selectedStepId = null,
    onSelectStep = null,
    runStatus = null,
}) {
    const labelById = useMemo(() => buildStepLabelMap(definition), [definition]);

    // Latest record per (parent, stepId), preserving first-seen order —
    // attempts of one step are one row, not three.
    const rows = useMemo(() => {
        const byKey = new Map();
        for (const s of steps) {
            const key = `${s.parentStepId || ''}/${s.stepId}`;
            const cur = byKey.get(key);
            if (!cur) byKey.set(key, { ...s, attempts: 1 });
            else byKey.set(key, { ...s, attempts: cur.attempts + 1 });
        }
        return [...byKey.values()];
    }, [steps]);

    // Where the run STOPPED — the first failing row (if the run failed).
    const stopIndex = useMemo(() => {
        if (runStatus !== 'error' && runStatus !== 'failed') return -1;
        return rows.findIndex(r => r.status === 'error' || r.status === 'failed');
    }, [rows, runStatus]);

    if (!rows.length) {
        return (
            <div className="px-3 py-4 text-[11px] text-[var(--text-tertiary)] italic">
                No steps recorded for this run.
            </div>
        );
    }

    return (
        <div className="h-full min-h-0 overflow-y-auto custom-scrollbar" role="list" aria-label="Steps">
            <div className="px-3 py-2 text-[10px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] border-b border-[var(--border-default)] sticky top-0 bg-[var(--bg-primary)] z-10">
                Steps
            </div>
            {rows.map((row, i) => {
                const token = tokenFor(row.status);
                const Icon = token.icon;
                const selected = row.stepId === selectedStepId;
                const label = labelById.get(row.stepId) || row.stepId;
                const nested = !!row.parentStepId;
                return (
                    <React.Fragment key={`${row.parentStepId || ''}/${row.stepId}`}>
                        <button
                            type="button"
                            role="listitem"
                            onClick={() => onSelectStep?.(selected ? null : row.stepId)}
                            title={row.stepId}
                            className={`w-full text-left flex items-start gap-2 px-3 py-2 border-b border-[var(--border-subtle,var(--border-default))] transition ${
                                selected ? 'bg-[var(--bg-secondary)]' : 'hover:bg-[var(--bg-secondary)]'
                            } ${nested ? 'pl-7' : ''}`}
                        >
                            <Icon size={13} className={`shrink-0 mt-0.5 ${token.solid}${token.spin ? ' animate-spin' : ''}`} />
                            <span className="min-w-0 flex-1">
                                <span className="block text-xs font-medium text-[var(--text-primary)] truncate">{label}</span>
                                <span className="block text-[10px] text-[var(--text-tertiary)]">
                                    {token.label}
                                    {row.durationMs != null && ` · took ${formatDuration(row.durationMs)}`}
                                    {row.attempts > 1 && ` · attempt ${row.attempts} of ${row.attempts}`}
                                </span>
                                {row.error && (
                                    <span className="block text-[10px] text-red-600 dark:text-red-400 truncate" title={row.error}>{row.error}</span>
                                )}
                            </span>
                        </button>
                        {i === stopIndex && (
                            <div className="px-3 py-1.5 text-[10px] text-red-600 dark:text-red-400 border-b border-[var(--border-subtle,var(--border-default))] bg-red-500/5">
                                This is where it stopped. Nothing ran after this point.
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
