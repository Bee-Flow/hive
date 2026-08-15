import React, { useCallback, useEffect, useRef, useState } from 'react';
import ExecutionsTable from './ExecutionsTable';
import ExecutionView from './ExecutionView';

/**
 * The single executions surface mounted by all three sections (global Routines
 * tab, per-automation builder tab, per-Step builder tab). The n8n table (list)
 * and the full-screen ExecutionView (one run) — BOTH stay mounted, the table
 * merely hidden while a run is open, so closing a run restores the exact list
 * the user left: filters, scroll, accumulated pages.
 *
 * Props:
 *   scope         'global' | 'automation' | 'step'
 *   automationId / stepId   fixed id for the scoped views
 *   active        false while the panel is mounted but not the visible view —
 *                 fetching and streaming stand down entirely
 *   onOpenEditor(automationId)  jump to the builder for a run's automation
 *   initialRunId / initialStepId   open straight to this run/step (deep-link);
 *                 changes are ADOPTED (browser Back/Forward moving ?run=)
 *   onRunStateChange({runId,stepId}, {replace})  report open/close/select so
 *                 the owner can sync the URL — open PUSHES (Back closes the
 *                 run), step-select and close REPLACE
 *   onRunIdChange(runId|null)   legacy single-value report, kept for callers
 *                 that only track the id
 *   onEditingChange(bool)  signal the studio shell to collapse chrome while a
 *                          run is open full-screen (global view only).
 */
export default function ExecutionsPanel({
    scope, automationId, stepId,
    onOpenEditor, initialRunId = null, initialStepId = null,
    onRunIdChange, onRunStateChange, onEditingChange, active = true,
}) {
    const [openRun, setOpenRun] = useState(() => (initialRunId ? { id: initialRunId } : null));
    const [selectedStepId, setSelectedStepId] = useState(initialStepId || null);

    // Adopt deep-link CHANGES (Back/Forward moving ?run=/?step=). Mount state
    // is seeded above; this only reacts to a genuinely different prop.
    const lastInitialRef = useRef(initialRunId);
    useEffect(() => {
        if (initialRunId === lastInitialRef.current) return;
        lastInitialRef.current = initialRunId;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- adopting external navigation
        setOpenRun(initialRunId ? { id: initialRunId } : null);
        setSelectedStepId(initialRunId ? (initialStepId || null) : null);
    }, [initialRunId, initialStepId]);

    const openRunId = openRun?.id || null;
    useEffect(() => { onRunIdChange?.(openRunId); }, [openRunId, onRunIdChange]);
    // Collapse studio chrome while a run is open (only matters for the global
    // view, which isn't already in builder edit mode).
    useEffect(() => {
        if (scope !== 'global') return undefined;
        onEditingChange?.(!!openRunId);
        return () => onEditingChange?.(false);
    }, [openRunId, scope, onEditingChange]);

    const openRunAndReport = useCallback((run) => {
        setOpenRun(run);
        setSelectedStepId(null);
        // PUSH — so the browser's Back closes the run, symmetric with the click.
        onRunStateChange?.({ runId: run?.id || null, stepId: null }, { replace: false });
    }, [onRunStateChange]);

    const closeRun = useCallback(() => {
        // Prefer real history navigation when this run's open state was the
        // last push (AuthedApp stamps beeflowRunOpen into it): Back and the ←
        // button then do the SAME thing, and Forward can re-open the run.
        if (typeof window !== 'undefined' && window.history?.state?.beeflowRunOpen
            && window.history.state.beeflowRunOpen === openRunId) {
            window.history.back();
            return;
        }
        setOpenRun(null);
        setSelectedStepId(null);
        onRunStateChange?.({ runId: null, stepId: null }, { replace: true });
    }, [openRunId, onRunStateChange]);

    const selectStep = useCallback((sid) => {
        setSelectedStepId(sid);
        // Step selection is a refinement of the same place — replace, never push.
        onRunStateChange?.({ runId: openRunId, stepId: sid || null }, { replace: true });
    }, [openRunId, onRunStateChange]);

    return (
        <div className="h-full min-h-0 flex flex-col">
            <div className={openRunId ? 'hidden' : 'h-full min-h-0'}>
                <ExecutionsTable
                    scope={scope}
                    automationId={automationId}
                    stepId={stepId}
                    active={active && !openRunId}
                    onOpenRun={openRunAndReport}
                    onOpenEditor={onOpenEditor}
                />
            </div>
            {openRunId && (
                <ExecutionView
                    runId={openRunId}
                    run={openRun}
                    scope={scope}
                    active={active}
                    initialStepId={selectedStepId}
                    onSelectStep={selectStep}
                    onBack={closeRun}
                    onOpenEditor={onOpenEditor}
                    // Retry/approve open the run they START; a parent-run chip
                    // opens the run a retry replayed.
                    onOpenAnotherRun={(id) => openRunAndReport({ id })}
                />
            )}
        </div>
    );
}
