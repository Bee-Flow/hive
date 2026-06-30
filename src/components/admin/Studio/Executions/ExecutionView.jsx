import React, { useCallback, useEffect, useState } from 'react';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import RunExecutionView from '../../AITasksDesigner/Builder/RunExecutionView';
import ExecutionBar from './ExecutionBar';
import useRunStream from './useRunStream';

/**
 * Full-screen execution view (n8n-style): a top execution bar + the run
 * replayed on the read-only canvas (RunExecutionView). Click a node for its
 * input/output. While the run is live, step data is polled + streamed so the
 * canvas tints in real time; the body is only REMOUNTED when the run id changes
 * (key={runId}) so live updates don't reset zoom/scroll.
 */
export default function ExecutionView({ runId, run: seed = null, scope, onBack, onOpenEditor }) {
    const api = useAutomationApi();
    const [run, setRun] = useState(seed && seed.id === runId ? seed : null);
    const [steps, setSteps] = useState([]);
    const [definition, setDefinition] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadRun = useCallback(async () => {
        try { const r = await api.getRun(runId); setRun(prev => ({ ...(prev || {}), ...r })); } catch { /* keep */ }
    }, [api, runId]);

    const loadSteps = useCallback(async () => {
        try {
            const d = await api.getRunSteps(runId);
            setSteps(d.steps || []);
            setDefinition(d.definition || null);
        } catch { /* keep */ }
    }, [api, runId]);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        Promise.all([loadRun(), loadSteps()]).finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [loadRun, loadSteps]);

    const running = run?.status === 'running' || run?.status === 'queued';

    // Poll step data while running (step-level fallback alongside the SSE stream).
    useEffect(() => {
        if (!running) return undefined;
        const t = setInterval(loadSteps, 1500);
        return () => clearInterval(t);
    }, [running, loadSteps]);

    // Live events for THIS run only.
    useRunStream({
        enabled: !!running,
        automationId: run?.automationId || null,
        onEvent: (type, data) => {
            if (data?.runId && data.runId !== runId) return;
            if (type === 'step.started' || type === 'step.finished') loadSteps();
            else if (type === 'run.finished' || type === 'run.failed') { loadRun(); loadSteps(); }
        },
    });

    const onRetry = async () => { await api.retryRun(run.automationId, runId); onBack?.(); };
    const onCancel = async () => { await api.cancelRun(runId); loadRun(); };
    const onApprove = async (decision) => { await api.approveStep(runId, decision); await Promise.all([loadRun(), loadSteps()]); };

    return (
        <div className="flex flex-col h-full min-h-0">
            <ExecutionBar
                run={run}
                onBack={onBack}
                onRetry={onRetry}
                onCancel={onCancel}
                onApprove={onApprove}
                onOpenEditor={onOpenEditor}
            />
            {run?.error && (
                <div className="flex-shrink-0 px-4 py-2 text-xs text-red-600 dark:text-red-400 border-b border-[var(--border-default)] bg-red-500/5">
                    {run.error}
                </div>
            )}
            <RunExecutionView
                key={runId}
                definition={definition}
                steps={steps}
                emptyDefinitionMessage={loading ? 'Loading execution…' : 'Definition unavailable for this run.'}
            />
        </div>
    );
}
