import React, { useCallback, useEffect, useRef, useState } from 'react';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import RunExecutionView from '../../AITasksDesigner/Builder/RunExecutionView';
import ExecutionBar from './ExecutionBar';
import RunStepTimeline from './RunStepTimeline';
import useRunStream from './useRunStream';

/**
 * Full-screen execution view: a top execution bar + a step-by-step TIMELINE
 * beside the run replayed on the read-only canvas. The timeline answers "in
 * what order, and where did it stop"; the canvas answers "where in the flow".
 * Selecting a step in either selects it in both (and in the URL's ?step=,
 * via onSelectStep).
 *
 * While the run is live, step data is polled + streamed so the canvas tints
 * in real time; the body is only REMOUNTED when the run id changes
 * (key={runId}) so live updates don't reset zoom/scroll.
 *
 * Retry/approve OPEN THE RUN THEY START (the server returns the child run)
 * instead of dumping the user back on the list to hunt for it.
 */
export default function ExecutionView({
    runId, run: seed = null, scope, active = true,
    initialStepId = null, onSelectStep = null,
    onBack, onOpenEditor, onOpenAnotherRun = null,
}) {
    const api = useAutomationApi();
    const [run, setRun] = useState(seed && seed.id === runId ? seed : null);
    const [steps, setSteps] = useState([]);
    const [definition, setDefinition] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [selectedStepId, setSelectedStepId] = useState(initialStepId || null);
    const selectStep = useCallback((sid) => {
        setSelectedStepId(sid);
        onSelectStep?.(sid);
    }, [onSelectStep]);
    // Adopt ?step= changes (Back/Forward).
    const lastInitialStepRef = useRef(initialStepId);
    useEffect(() => {
        if (initialStepId !== lastInitialStepRef.current) {
            lastInitialStepRef.current = initialStepId;
            // eslint-disable-next-line react-hooks/set-state-in-effect -- adopting external navigation
            setSelectedStepId(initialStepId || null);
        }
    }, [initialStepId]);

    const loadRun = useCallback(async () => {
        try {
            const r = await api.getRun(runId);
            setRun(prev => ({ ...(prev || {}), ...r }));
            setLoadError(null);
        } catch (e) {
            // Swallowing this used to leave a run view with NO bar and NO way
            // out — the only back button lived on the bar, which never
            // rendered without a run.
            setLoadError(e);
        }
    }, [api, runId]);

    // Debounced step loader: live SSE events arrive in bursts (step.started +
    // step.finished per step) and each used to fire its own full fetch.
    const stepsTimerRef = useRef(null);
    const fetchSteps = useCallback(async () => {
        try {
            const d = await api.getRunSteps(runId);
            setSteps(d.steps || []);
            setDefinition(d.definition || null);
        } catch { /* keep the last good data */ }
    }, [api, runId]);
    const loadSteps = useCallback(() => {
        if (stepsTimerRef.current) return; // one fetch per 750ms window
        stepsTimerRef.current = setTimeout(() => {
            stepsTimerRef.current = null;
            fetchSteps();
        }, 750);
    }, [fetchSteps]);
    useEffect(() => () => { if (stepsTimerRef.current) clearTimeout(stepsTimerRef.current); }, []);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        Promise.all([loadRun(), fetchSteps()]).finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [loadRun, fetchSteps]);

    const running = run?.status === 'running' || run?.status === 'queued';

    // Poll step data while running (step-level fallback alongside the SSE stream).
    useEffect(() => {
        if (!running || !active) return undefined;
        const t = setInterval(loadSteps, 1500);
        return () => clearInterval(t);
    }, [running, active, loadSteps]);

    // Live events for THIS run only.
    useRunStream({
        enabled: !!running && active,
        automationId: run?.automationId || null,
        onEvent: (type, data) => {
            if (data?.runId && data.runId !== runId) return;
            if (type === 'step.started' || type === 'step.finished') loadSteps();
            else if (type === 'run.finished' || type === 'run.failed') { loadRun(); loadSteps(); }
        },
    });

    // Retry STARTS a new run and opens it — it used to bounce back to the
    // list, leaving the user to guess which row was theirs.
    const onRetry = async () => {
        const res = await api.retryRun(run.automationId, runId);
        const childId = res?.run?.id;
        if (childId && onOpenAnotherRun) { onOpenAnotherRun(childId); return; }
        setNotice("Started — it's running now");
        loadRun(); loadSteps();
    };
    const onCancel = async () => { await api.cancelRun(runId); loadRun(); };
    const onApprove = async (decision) => {
        // awaiting_confirm is a RUN-level gate (POST /runs/:id/approve);
        // approve-step answers a step-level awaiting_approval. approve-step
        // returns the CHILD run that continues — open it.
        if (run?.status === 'awaiting_confirm') {
            await api.approveRun(runId);
            await Promise.all([loadRun(), fetchSteps()]);
            return;
        }
        const res = await api.approveStep(runId, decision);
        const childId = res?.run?.id;
        if (decision === 'approve' && childId && childId !== runId && onOpenAnotherRun) {
            onOpenAnotherRun(childId);
            return;
        }
        await Promise.all([loadRun(), fetchSteps()]);
    };

    if (loadError && !run) {
        return (
            <div className="flex flex-col h-full min-h-0 items-center justify-center gap-2 px-6 text-center">
                <div className="text-sm text-[var(--text-primary)]">We couldn't load this run.</div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => { setLoadError(null); setLoading(true); Promise.all([loadRun(), fetchSteps()]).finally(() => setLoading(false)); }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
                    >
                        Try again
                    </button>
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition"
                    >
                        Back to Runs
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            <ExecutionBar
                run={run}
                onBack={onBack}
                onRetry={onRetry}
                onCancel={onCancel}
                onApprove={onApprove}
                onOpenEditor={onOpenEditor}
                onOpenRun={onOpenAnotherRun}
            />
            {notice && (
                <div className="flex-shrink-0 px-4 py-2 text-xs text-emerald-700 dark:text-emerald-300 border-b border-[var(--border-default)] bg-emerald-500/5">
                    {notice}
                </div>
            )}
            {run?.error && (
                <div className="flex-shrink-0 px-4 py-2 text-xs text-red-600 dark:text-red-400 border-b border-[var(--border-default)] bg-red-500/5">
                    {run.error}
                </div>
            )}
            <div className="flex-1 min-h-0 flex">
                <aside className="w-[280px] flex-shrink-0 border-r border-[var(--border-default)] min-h-0">
                    <RunStepTimeline
                        steps={steps}
                        definition={definition}
                        selectedStepId={selectedStepId}
                        onSelectStep={selectStep}
                        runStatus={run?.status || null}
                    />
                </aside>
                <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                    <RunExecutionView
                        key={runId}
                        definition={definition}
                        steps={steps}
                        selectedStepId={selectedStepId}
                        onSelectStep={selectStep}
                        emptyDefinitionMessage={loading ? 'Loading the run…' : 'Definition unavailable for this run.'}
                    />
                </div>
            </div>
        </div>
    );
}
