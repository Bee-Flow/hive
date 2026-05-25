import { CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import StepInputsTab from './StepInputsTab';
import StepLogsTab from './StepLogsTab';
import StepOutputTab from './StepOutputTab';
import useStepDebug from './useStepDebug';

/**
 * Run-view container for the StepInspector. Hosts three sub-tabs:
 *   - Inputs  — resolved input from the most recent run + pin-as-sample
 *   - Output  — output from the most recent run with copy-path-as-binding
 *   - Logs    — Phase 2 placeholder for the streaming SSE log feed
 *
 * The compact status strip above the sub-tabs gives at-a-glance run
 * health (status badge + duration + error preview) so users don't have
 * to switch tabs just to see whether the last run succeeded.
 *
 * Props:
 *   step    — the active step (uses .id for path generation)
 *   runStep — the most recent run record for this step (or null)
 *             expected shape: { status, input, output, error, durationMs }
 */
export default function RunTabContainer({ step, runStep }) {
    const [subTab, setSubTab] = useState('inputs');
    const { pinnedInput, pinInput, clearPinned } = useStepDebug(step?.id);

    const copyPath = useCallback((path) => {
        if (!path) return;
        try {
            navigator.clipboard?.writeText(path);
        } catch {
            // Clipboard API can be blocked in non-secure contexts — silent fail
            // is preferable to a noisy error here.
        }
    }, []);

    if (!runStep) {
        return (
            <div className="flex flex-col h-full min-h-0 items-center justify-center px-6 py-12 text-[11px] text-[var(--text-tertiary)] text-center gap-2">
                <Clock size={18} className="opacity-60" />
                <div>No run output for this step yet — try a dry-run.</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            <StatusStrip runStep={runStep} />
            <div className="flex items-center gap-1 px-2 pt-1 border-b border-[var(--border-default)]">
                <SubTab active={subTab === 'inputs'} onClick={() => setSubTab('inputs')}>Inputs</SubTab>
                <SubTab active={subTab === 'output'} onClick={() => setSubTab('output')}>Output</SubTab>
                <SubTab active={subTab === 'logs'} onClick={() => setSubTab('logs')}>Logs</SubTab>
            </div>
            <div className="flex-1 min-h-0">
                {subTab === 'inputs' && (
                    <StepInputsTab
                        stepId={step?.id}
                        liveInput={runStep.input ?? null}
                        pinnedInput={pinnedInput}
                        onPin={pinInput}
                        onClearPin={clearPinned}
                        onCopyPath={copyPath}
                    />
                )}
                {subTab === 'output' && (
                    <StepOutputTab
                        stepId={step?.id}
                        liveOutput={runStep.output ?? null}
                        error={runStep.error}
                        onCopyPath={copyPath}
                    />
                )}
                {subTab === 'logs' && <StepLogsTab />}
            </div>
        </div>
    );
}

function StatusStrip({ runStep }) {
    const { Icon, color, label } = statusFor(runStep.status);
    const duration = runStep.durationMs != null ? `${formatDuration(runStep.durationMs)}` : null;
    return (
        <div className="px-3 py-1.5 border-b border-[var(--border-default)] flex items-center gap-2 text-[11px]">
            <Icon size={12} className={color} />
            <span className={color}>{label}</span>
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

function SubTab({ active, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-2.5 py-1 text-[11px] transition ${active
                ? 'border-b-2 border-[var(--accent)] text-[var(--text-primary)] -mb-px'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
        >
            {children}
        </button>
    );
}
