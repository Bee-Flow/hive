import React, { useEffect, useState } from 'react';
import ExecutionsTable from './ExecutionsTable';
import ExecutionView from './ExecutionView';

/**
 * The single executions surface mounted by all three sections (global Routines
 * tab, per-automation builder tab, per-Step builder tab). Switches between the
 * n8n table (list) and the full-screen ExecutionView (one run).
 *
 * Props:
 *   scope         'global' | 'automation' | 'step'
 *   automationId / stepId   fixed id for the scoped views
 *   onOpenEditor(automationId)  jump to the builder for a run's automation
 *   initialRunId  open straight to this run (deep-link)
 *   onRunIdChange(runId|null)   report open/close so the parent can sync the URL
 *   onEditingChange(bool)  signal the studio shell to collapse chrome while a
 *                          run is open full-screen (global view only).
 */
export default function ExecutionsPanel({
    scope, automationId, stepId,
    onOpenEditor, initialRunId = null, onRunIdChange, onEditingChange,
}) {
    const [openRun, setOpenRun] = useState(null); // the selected run object (or {id})

    // Adopt a deep-linked run id on mount / when it changes.
    useEffect(() => {
        if (initialRunId && initialRunId !== openRun?.id) setOpenRun({ id: initialRunId });
        if (!initialRunId && openRun) { /* parent cleared it via URL */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialRunId]);

    const openRunId = openRun?.id || null;
    useEffect(() => { onRunIdChange?.(openRunId); }, [openRunId, onRunIdChange]);
    // Collapse studio chrome while a run is open (only matters for the global
    // view, which isn't already in builder edit mode).
    useEffect(() => {
        if (scope !== 'global') return undefined;
        onEditingChange?.(!!openRunId);
        return () => onEditingChange?.(false);
    }, [openRunId, scope, onEditingChange]);

    if (openRunId) {
        return (
            <ExecutionView
                runId={openRunId}
                run={openRun}
                scope={scope}
                onBack={() => setOpenRun(null)}
                onOpenEditor={onOpenEditor}
            />
        );
    }
    return (
        <ExecutionsTable
            scope={scope}
            automationId={automationId}
            stepId={stepId}
            onOpenRun={(run) => setOpenRun(run)}
            onOpenEditor={onOpenEditor}
        />
    );
}
