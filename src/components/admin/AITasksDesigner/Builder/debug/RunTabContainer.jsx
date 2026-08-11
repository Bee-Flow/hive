import { CheckCircle2, Clock, XCircle, Loader2, Pin } from 'lucide-react';
import React, { useCallback } from 'react';
import StepOutputTab from './StepOutputTab';
import { summariseData } from '../flow/dataSummary';

/**
 * Run-view container for the StepInspector. Shows the most recent run's
 * OUTPUT directly — a compact status strip (status badge + duration + retry
 * count) above the friendly Table/JSON output. Inputs and Logs are
 * intentionally omitted: after an execute the user wants the result, not
 * the plumbing.
 *
 * Props:
 *   step    — the active step (uses .id for path generation)
 *   runStep — the most recent run record for this step (or null)
 *             expected shape: { status, output, error, durationMs }
 *   compact — the caller already shows the status and the row count in its own
 *             header (the quick dialog does), so the strip here would be the
 *             same sentence twice, one band apart. Drops it, and the standing
 *             hint footer with it.
 */
export default function RunTabContainer({ step, runStep, compact = false }) {
    const copyPath = useCallback((path) => {
        if (!path) return;
        try {
            navigator.clipboard?.writeText(path);
        } catch {
            // Clipboard API can be blocked in non-secure contexts — silent fail
            // is preferable to a noisy error here.
        }
    }, []);

    // No live run record yet. If the step's output is PINNED, that pinned
    // value is exactly what downstream steps will receive at run-time, so
    // show it here (badged "Pinned") instead of the empty state.
    const isPinned = step?.pinnedOutput !== undefined && step?.pinnedOutput !== null;
    const effectiveRun = runStep || (isPinned
        ? { status: 'pinned', output: step.pinnedOutput }
        : null);

    if (!effectiveRun) {
        return (
            <div className="flex flex-col h-full min-h-0 items-center justify-center px-6 py-12 text-[11px] text-[var(--text-tertiary)] text-center gap-2">
                <Clock size={18} className="opacity-60" />
                <div>No data yet — press ▶ Execute to run this step and capture it.</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            {!compact && <StatusStrip runStep={effectiveRun} />}
            <div className="flex-1 min-h-0">
                <StepOutputTab
                    stepId={step?.id}
                    liveOutput={effectiveRun.output ?? null}
                    error={effectiveRun.error}
                    remediation={effectiveRun.errorRemediation}
                    onCopyPath={copyPath}
                    compact={compact}
                />
            </div>
        </div>
    );
}

function StatusStrip({ runStep }) {
    const { Icon, color, label } = statusFor(runStep.status);
    const duration = runStep.durationMs != null ? `${formatDuration(runStep.durationMs)}` : null;
    // How much came out, in the same words the connection chip uses.
    const summary = summariseData(runStep.output);
    return (
        <div className="px-3 py-1.5 border-b border-[var(--border-default)] flex items-center gap-2 text-[11px]">
            <Icon size={12} className={color} />
            <span className={color}>{label}</span>
            {summary && (
                <span className="text-[var(--text-primary)] font-medium">· {summary.label}</span>
            )}
            {duration && (
                <span className="text-[var(--text-tertiary)]">· {duration}</span>
            )}
            {runStep.attempts != null && runStep.attempts > 1 && (
                <span className="text-[var(--text-tertiary)]">· {runStep.attempts} attempts</span>
            )}
        </div>
    );
}

function statusFor(status) {
    switch (status) {
        case 'success':
            return { Icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', label: 'Success' };
        case 'error':
        case 'failed':
            return { Icon: XCircle, color: 'text-red-600 dark:text-red-400', label: 'Error' };
        case 'running':
            return { Icon: Loader2, color: 'text-amber-600 dark:text-amber-400 animate-spin', label: 'Running' };
        case 'pinned':
            return { Icon: Pin, color: 'text-cyan-600 dark:text-cyan-400', label: 'Pinned' };
        default:
            return { Icon: Clock, color: 'text-[var(--text-tertiary)]', label: status || 'Unknown' };
    }
}

function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60_000);
    const secs = Math.floor((ms % 60_000) / 1000);
    return `${mins}m ${secs}s`;
}
