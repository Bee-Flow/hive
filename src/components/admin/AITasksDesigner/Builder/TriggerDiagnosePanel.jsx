import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, X, Loader2 } from 'lucide-react';

/**
 * Renders the response of POST /:id/diagnose-trigger as a vertical list of
 * checks (subscription / credentials / Gmail history / latest match).
 *
 * Each check has a status (`ok` | `warn` | `error` | `skipped`) that drives
 * the icon + colour. Optional `detail` payloads (cursor, lastPolledAt,
 * subject of latest match) are rendered as a monospace block under the
 * message so the user can spot the obvious thing without opening devtools.
 */
export default function TriggerDiagnosePanel({ result, loading, error, onClose }) {
    return (
        <div className="absolute right-4 top-16 z-30 w-[420px] max-h-[70vh] overflow-y-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-xl p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-sm text-[var(--text-primary)]">Trigger diagnose</div>
                <button
                    onClick={onClose}
                    className="p-1 rounded text-[var(--text-tertiary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                    title="Close"
                >
                    <X size={14} />
                </button>
            </div>

            {loading && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] py-4">
                    <Loader2 size={14} className="animate-spin" /> Probing the trigger pipeline…
                </div>
            )}

            {error && (
                <div className="text-sm text-red-600 dark:text-red-400 py-2">
                    {error}
                </div>
            )}

            {!loading && result && (
                <>
                    <div className="text-xs text-[var(--text-tertiary)] mb-2">
                        Trigger kind: <span className="font-mono">{result.kind || 'unknown'}</span>
                    </div>
                    <ul className="space-y-2">
                        {(result.checks || []).map((c) => (
                            <li
                                key={c.name}
                                className="rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] p-2.5"
                            >
                                <div className="flex items-start gap-2">
                                    <StatusIcon status={c.status} />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)]">{c.name}</div>
                                        <div className="text-sm text-[var(--text-primary)] mt-0.5">{c.message}</div>
                                        {c.detail && (
                                            <pre className="mt-1.5 text-[11px] font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words bg-[var(--bg-primary)] rounded p-1.5 border border-[var(--border-default)]">
{JSON.stringify(c.detail, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-3 text-xs text-[var(--text-tertiary)]">
                        {result.ok
                            ? 'No critical issues found. Send a matching email to confirm the run fires.'
                            : 'One or more checks failed — fix the highlighted issue and re-run the diagnose.'}
                    </div>
                </>
            )}
        </div>
    );
}

function StatusIcon({ status }) {
    if (status === 'ok')      return <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />;
    if (status === 'warn')    return <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />;
    if (status === 'error')   return <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />;
    return <CheckCircle2 size={16} className="text-[var(--text-tertiary)] mt-0.5 flex-shrink-0" />;
}
