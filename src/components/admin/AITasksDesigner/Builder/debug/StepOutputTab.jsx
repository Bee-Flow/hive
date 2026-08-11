import { AlertCircle, Copy as CopyIcon } from 'lucide-react';
import React from 'react';
import OutputView from '../OutputView';

/**
 * Output sub-tab of the Run view. Renders the most recent run's output with
 * the same friendly Table/JSON view the dry-run preview uses: arrays of
 * objects become real tables, objects become labelled fields, and a per-step
 * toggle flips to the collapsible JSON tree. In JSON mode each leaf still
 * carries a hover "copy path" button (paths relative to
 * `steps.<stepId>.output`) so it can be dropped straight into a binding.
 *
 * Errors are surfaced inline above the output — same place a user expects.
 *
 * Props:
 *   stepId        — current step id (used as basePath for leaf paths)
 *   liveOutput    — output from the most recent run (any JSON, or null)
 *   error         — top-level error message from the run, if any
 *   remediation   — short "what to do next" hint for the error, if any
 *   onCopyPath(p) — clipboard hook for "copy path as binding"
 *   compact       — drop the standing hint footer. The quick dialog stacks this
 *                   under the settings in a few hundred pixels; a permanent line
 *                   of advice there costs more than it teaches, and the JSON
 *                   toggle it points at is already on screen.
 */
export default function StepOutputTab({ stepId, liveOutput, error, remediation, onCopyPath, compact = false }) {
    const basePath = stepId ? `steps.${stepId}.output` : '';

    return (
        <div className="flex flex-col h-full min-h-0">
            {error && (
                <div className="px-3 py-2 border-b border-[var(--border-default)] flex items-start gap-2 bg-red-500/10">
                    <AlertCircle size={12} className="text-red-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                        <pre className="text-[11px] text-red-700 dark:text-red-400 whitespace-pre-wrap break-words min-w-0">
                            {String(error)}
                        </pre>
                        {remediation && (
                            <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">→ {remediation}</div>
                        )}
                    </div>
                </div>
            )}
            <div className="flex-1 min-h-0 flex flex-col px-2 py-2">
                <OutputView
                    fill
                    value={liveOutput}
                    basePath={basePath}
                    onCopyPath={onCopyPath}
                    emptyMessage="No output recorded yet. Run or dry-run this step to capture one."
                />
            </div>
            {!compact && (
                <footer className="px-3 py-1.5 border-t border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)] flex items-center gap-1.5">
                    <CopyIcon size={10} />
                    Switch to JSON to see the raw data.
                </footer>
            )}
        </div>
    );
}
