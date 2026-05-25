import { AlertCircle, Copy as CopyIcon } from 'lucide-react';
import React from 'react';
import JsonTree from './JsonTree';

/**
 * Output sub-tab of the Run view. Renders the most recent run's output
 * with the same JsonTree the inputs tab uses, so leaves can be copied
 * straight into a downstream binding (paths are emitted relative to
 * `steps.<stepId>.output`).
 *
 * Errors are surfaced inline above the output tree — same place a user
 * would expect to find them.
 *
 * Props:
 *   stepId        — current step id (used as basePath for leaf paths)
 *   liveOutput    — output from the most recent run (any JSON, or null)
 *   error         — top-level error message from the run, if any
 *   onCopyPath(p) — clipboard hook for "copy path as binding"
 */
export default function StepOutputTab({ stepId, liveOutput, error, onCopyPath }) {
    const basePath = stepId ? `steps.${stepId}.output` : '';

    return (
        <div className="flex flex-col h-full min-h-0">
            {error && (
                <div className="px-3 py-2 border-b border-[var(--border-default)] flex items-start gap-2 bg-red-500/10">
                    <AlertCircle size={12} className="text-red-500 mt-0.5 shrink-0" />
                    <pre className="text-[11px] text-red-700 dark:text-red-400 whitespace-pre-wrap break-words min-w-0">
                        {String(error)}
                    </pre>
                </div>
            )}
            <JsonTree
                value={liveOutput}
                basePath={basePath}
                onCopyPath={onCopyPath}
                emptyMessage="No output recorded yet. Run or dry-run this step to capture one."
            />
            <footer className="px-3 py-1.5 border-t border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)] flex items-center gap-1.5">
                <CopyIcon size={10} />
                Hover any field to copy its binding path.
            </footer>
        </div>
    );
}
