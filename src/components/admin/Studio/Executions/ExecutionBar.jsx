import React, { useState } from 'react';
import { ArrowLeft, RotateCcw, Ban, Check, X, ExternalLink, Loader2 } from 'lucide-react';
import { RunStatusBadge, DryRunBadge } from '../RoutinesStudio/RunStatusBits';
import { formatDuration, formatRelative } from '../RoutinesStudio/historyUtils';

/**
 * Top bar of the full-screen execution view (n8n-style): back, status, timing,
 * trigger/mode, and the contextual run actions (Retry / Cancel / Approve /
 * Reject / Open in editor). Action handlers are lifted from the old run-detail
 * drawer; the parent runs them and refreshes.
 */
export default function ExecutionBar({ run, onBack, onRetry, onCancel, onApprove, onOpenEditor, showOpenEditor = true }) {
    const [pending, setPending] = useState(null);
    if (!run) return null;

    const isError = run.status === 'error';
    const isRunning = run.status === 'running' || run.status === 'queued';
    const isAwaiting = run.status === 'awaiting_approval' || run.status === 'awaiting_confirm';
    const isDry = run.mode === 'dry_run';

    const act = async (key, fn) => {
        if (pending || !fn) return;
        setPending(key);
        try { await fn(); } finally { setPending(null); }
    };

    return (
        <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-primary)]">
            <button
                onClick={onBack}
                title="Back to executions"
                className="inline-flex items-center gap-1 p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition"
            >
                <ArrowLeft size={16} /> <span className="text-xs font-medium">Executions</span>
            </button>

            <span className="text-[var(--text-tertiary)]">·</span>
            <RunStatusBadge status={run.status} />
            {isDry && <DryRunBadge />}

            {formatDuration(run.durationMs) && (
                <span className="text-xs text-[var(--text-secondary)] tabular-nums">{formatDuration(run.durationMs)}</span>
            )}
            {run.startedAt && (
                <span className="text-xs text-[var(--text-tertiary)]" title={run.startedAt}>{formatRelative(run.startedAt)}</span>
            )}
            {(run.triggerKind || run.automationTriggerType) && (
                <span className="text-xs text-[var(--text-tertiary)]">· {run.triggerKind || run.automationTriggerType}</span>
            )}
            {run.version != null && (
                <span className="text-[10px] text-[var(--text-tertiary)] px-1.5 py-0.5 rounded bg-[var(--bg-secondary)]">v{run.version}</span>
            )}

            <div className="ml-auto flex items-center gap-2">
                {isError && onRetry && (
                    <BarButton onClick={() => act('retry', onRetry)} pending={pending === 'retry'} icon={<RotateCcw size={14} />} tone="primary">Retry</BarButton>
                )}
                {isRunning && onCancel && (
                    <BarButton onClick={() => act('cancel', onCancel)} pending={pending === 'cancel'} icon={<Ban size={14} />} tone="danger">Cancel</BarButton>
                )}
                {isAwaiting && (
                    <>
                        <BarButton onClick={() => act('approve', () => onApprove?.('approve'))} pending={pending === 'approve'} icon={<Check size={14} />} tone="primary">Approve</BarButton>
                        <BarButton onClick={() => act('reject', () => onApprove?.('reject'))} pending={pending === 'reject'} icon={<X size={14} />} tone="danger">Reject</BarButton>
                    </>
                )}
                {showOpenEditor && (
                    <button
                        onClick={() => run.automationId && onOpenEditor?.(run.automationId)}
                        disabled={!run.automationId}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition disabled:opacity-50"
                    >
                        <ExternalLink size={14} /> Open in editor
                    </button>
                )}
            </div>
        </div>
    );
}

function BarButton({ onClick, pending, icon, tone, children }) {
    const toneCls = tone === 'danger'
        ? 'border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10'
        : 'text-white border-transparent';
    const toneStyle = tone === 'primary' ? { background: 'var(--accent-primary, var(--text-primary))' } : undefined;
    return (
        <button
            onClick={onClick}
            disabled={pending}
            style={toneStyle}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition disabled:opacity-50 ${toneCls}`}
        >
            {pending ? <Loader2 size={14} className="animate-spin" /> : icon}
            {children}
        </button>
    );
}
