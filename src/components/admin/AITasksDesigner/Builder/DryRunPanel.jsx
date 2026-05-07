import React from 'react';
import { Eye } from 'lucide-react';

/**
 * Renders a dry-run preview: per-step "would have called X with Y" plus
 * any synthesised side-effect outputs.
 *
 * Uses theme tokens (`--bg-secondary`, accent text) instead of hardcoded
 * yellows so the panel works under both light and dark themes.
 */
export default function DryRunPanel({ run, steps }) {
    if (!run) return null;
    const stepList = Array.isArray(steps) ? steps : [];

    return (
        <div className="m-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400 mb-2 text-sm">
                <Eye size={16} /> Dry-run preview ({run.status})
            </div>
            {run.summary && (
                <div className="text-xs text-[var(--text-secondary)] mb-2 whitespace-pre-wrap">{run.summary}</div>
            )}
            <div className="flex flex-col gap-1.5">
                {stepList.map((s, idx) => {
                    if (!s) return null;
                    const out = s.output || null;
                    const wouldNotify = out && out.wouldNotify;
                    const wouldCall = out && out._dryRun;
                    return (
                        <div
                            key={`${s.stepId || 'step'}-${s.attempts ?? idx}`}
                            className="rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] p-2 text-xs"
                        >
                            <div className="font-semibold text-[var(--text-primary)]">
                                {s.stepId}
                                <span className="ml-1 text-[var(--text-tertiary)] font-normal">({s.stepType})</span>
                            </div>
                            {wouldNotify && (
                                <div className="text-amber-700 dark:text-amber-400 mt-1">
                                    Would notify on <strong>{(wouldNotify.channels || []).join(', ')}</strong>:{' '}
                                    <em>{wouldNotify.title}</em>
                                </div>
                            )}
                            {wouldCall && !wouldNotify && (
                                <div className="text-amber-700 dark:text-amber-400 mt-1">
                                    Would call <code className="font-mono">{out.wouldHaveCalled}</code>{' '}
                                    with <code className="font-mono">{safeJson(out.withArgs)}</code>
                                </div>
                            )}
                            {out && !wouldNotify && !wouldCall && (
                                <pre className="mt-1 max-h-40 overflow-auto text-[11px] text-[var(--text-primary)]">
                                    {safeJson(out, 2)}
                                </pre>
                            )}
                            {s.error && (
                                <div className="text-red-600 dark:text-red-400 mt-1 whitespace-pre-wrap">{s.error}</div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function safeJson(value, indent) {
    try { return JSON.stringify(value, null, indent); }
    catch { return String(value); }
}
