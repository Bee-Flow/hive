import React, { useState } from 'react';
import { Loader2, CheckCircle, XCircle, AlertTriangle, MousePointerClick, StopCircle } from 'lucide-react';
import TestReportRenderer from '../../../TestReportRenderer';
import useTestRunEvents from './useTestRunEvents';
import { API_BASE, authFetch } from '../../../../utils/helpers';

/**
 * RunResults — opens an SSE stream for the given runId and renders progress
 * while the worker executes. For agent runs (detected by the presence of
 * frame events) we split the view: live JPEG frame on the right, action log
 * + console on the left. For suite/explore runs we keep the original
 * single-column console.
 */
export default function RunResults({ runId, onClose, onCancelled }) {
    const { status, progressLines, reportJson, error, closed, latestFrame, currentAction, actionLog } = useTestRunEvents(runId);
    const [cancelling, setCancelling] = useState(false);

    const isFinal = ['passed', 'failed', 'error', 'cancelled'].includes(status);
    const isAgentRun = !!latestFrame || actionLog.length > 0;

    const cancel = async () => {
        if (cancelling || isFinal) return;
        if (!window.confirm('Cancel this run? Any progress so far is kept in the report.')) return;
        setCancelling(true);
        try {
            const res = await authFetch(`${API_BASE}/api/tests/runs/${encodeURIComponent(runId)}/cancel`, { method: 'POST' });
            if (!res.ok && res.status !== 409) {
                const data = await res.json().catch(() => ({}));
                window.alert(data?.message || data?.error || 'Failed to cancel');
            }
            onCancelled?.();
        } finally {
            setCancelling(false);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <header className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-default)]">
                <div className="flex items-center gap-2">
                    {!isFinal && <Loader2 className="animate-spin" size={16} />}
                    {status === 'passed' && <CheckCircle size={16} className="text-emerald-500" />}
                    {status === 'failed' && <XCircle size={16} className="text-red-500" />}
                    {status === 'error' && <AlertTriangle size={16} className="text-amber-500" />}
                    {status === 'cancelled' && <StopCircle size={16} className="text-[var(--text-tertiary)]" />}
                    <span className="text-sm font-semibold">
                        Run {runId.slice(0, 8)} — {status || 'starting…'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {!isFinal && (
                        <button
                            onClick={cancel}
                            disabled={cancelling}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-red-500/40 text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                            title="Cancel this run"
                        >
                            <StopCircle size={12} /> {cancelling ? 'Cancelling…' : 'Cancel'}
                        </button>
                    )}
                    {onClose && (
                        <button onClick={onClose} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                            Close
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 min-h-0 overflow-hidden p-5">
                {!isFinal && isAgentRun && (
                    <AgentLiveView
                        latestFrame={latestFrame}
                        currentAction={currentAction}
                        actionLog={actionLog}
                        progressLines={progressLines}
                    />
                )}

                {!isFinal && !isAgentRun && (
                    <div className="font-mono text-xs bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded p-3 max-h-64 overflow-y-auto whitespace-pre-wrap">
                        {progressLines.length === 0
                            ? <span className="text-[var(--text-tertiary)] italic">Waiting for output…</span>
                            : progressLines.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                )}

                {error && (
                    <div className="mt-4 text-sm text-[var(--danger)] bg-red-500/10 border border-red-500/40 rounded p-3">
                        {error}
                    </div>
                )}

                {isFinal && reportJson && (
                    <div className="mt-4 overflow-y-auto h-full">
                        <TestReportRenderer data={reportJson} />
                    </div>
                )}

                {isFinal && !reportJson && (
                    <div className="mt-4 text-sm text-[var(--text-secondary)]">
                        Run finished with status <strong>{status}</strong> but no report was produced.
                        {progressLines.length > 0 && (
                            <pre className="mt-2 font-mono text-xs bg-[var(--bg-secondary)] p-3 rounded max-h-64 overflow-y-auto whitespace-pre-wrap">{progressLines.join('\n')}</pre>
                        )}
                    </div>
                )}

                {closed && !isFinal && (
                    <div className="mt-4 text-xs text-[var(--text-tertiary)]">Connection closed.</div>
                )}
            </div>
        </div>
    );
}

function AgentLiveView({ latestFrame, currentAction, actionLog, progressLines }) {
    return (
        <div className="grid grid-cols-[minmax(280px,40%)_1fr] gap-4 h-full min-h-0">
            <div className="flex flex-col gap-3 min-h-0">
                <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Agent actions</h4>
                    <div className="text-xs bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded max-h-48 overflow-y-auto">
                        {actionLog.length === 0
                            ? <div className="px-3 py-2 italic text-[var(--text-tertiary)]">Agent is thinking…</div>
                            : actionLog.map((a, i) => (
                                <div key={i} className="px-3 py-1.5 border-b border-[var(--border-default)] last:border-b-0 flex items-start gap-2">
                                    <MousePointerClick size={11} className="mt-0.5 text-[var(--text-tertiary)] flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="font-mono text-[10px] text-[var(--text-secondary)]">
                                            {a.step}. {a.tool}
                                        </div>
                                        <div className="text-[10px] text-[var(--text-tertiary)] truncate">
                                            {summarizeInput(a.input)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
                <div className="flex-1 min-h-0">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Console</h4>
                    <div className="font-mono text-[10px] bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded p-2 h-full overflow-y-auto whitespace-pre-wrap">
                        {progressLines.length === 0
                            ? <span className="text-[var(--text-tertiary)] italic">Waiting…</span>
                            : progressLines.slice(-50).map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                </div>
            </div>
            <div className="flex flex-col min-h-0">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                    Live browser {currentAction?.tool ? `— ${currentAction.tool}` : ''}
                </h4>
                <div className="flex-1 min-h-0 rounded border border-[var(--border-default)] bg-black flex items-center justify-center overflow-hidden">
                    {latestFrame ? (
                        <img
                            src={`data:image/jpeg;base64,${latestFrame}`}
                            alt="Live browser frame"
                            className="max-w-full max-h-full object-contain"
                        />
                    ) : (
                        <div className="text-xs text-[var(--text-tertiary)] italic">Waiting for first frame…</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function summarizeInput(input) {
    if (!input || typeof input !== 'object') return '';
    const parts = [];
    if (input.url) parts.push(input.url);
    if (input.role || input.name) parts.push(`${input.role || ''}:${input.name || ''}`.replace(/^:|:$/, ''));
    if (input.selector) parts.push(input.selector);
    if (input.text) parts.push(`"${String(input.text).slice(0, 40)}"`);
    if (input.summary) parts.push(`— ${String(input.summary).slice(0, 60)}`);
    return parts.join(' ').slice(0, 120);
}
