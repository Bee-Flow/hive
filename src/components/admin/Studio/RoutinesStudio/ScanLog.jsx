import { Loader2, Check, AlertTriangle, ShieldAlert } from 'lucide-react';
import React from 'react';

/**
 * ScanLog — the live per-tool transparency log for a running/finished scan.
 * Extracted from SuggestedAutomations so the orchestrator stays thin.
 *
 * Each row shows what was (or is being) looked at, any PII categories the
 * Privacy Shield flagged, and — when a source was blocked by the Privacy
 * Shield — a clear "blocked" treatment with the reason. Read-only, on-theme,
 * amber/emerald only (never purple/violet/indigo).
 *
 * @param {Array} steps   - [{ tool, integration, status, piiCategories, blockedReason }]
 * @param {(id:string)=>string} labelFor - integration id → display label
 */
export default function ScanLog({ steps = [], labelFor = (x) => x }) {
    if (!steps.length) return null;
    return (
        <div className="max-w-xl mx-auto mb-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] divide-y divide-[var(--border-default)]">
            {steps.map((s) => {
                const blocked = s.status === 'blocked';
                return (
                    <div key={s.tool} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
                        {s.status === 'scanning' && <Loader2 size={12} className="animate-spin text-[var(--text-tertiary)] flex-shrink-0" />}
                        {s.status === 'done' && <Check size={12} className="text-emerald-500 flex-shrink-0" />}
                        {blocked && (s.blockedReason
                            ? <ShieldAlert size={12} className="text-amber-500 flex-shrink-0" />
                            : <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />)}
                        <span className="text-[var(--text-secondary)] flex-1 truncate">
                            {blocked
                                ? 'Skipped'
                                : (s.status === 'scanning' ? 'Scanning' : 'Scanned')} {labelFor(s.integration)}
                            <span className="text-[var(--text-tertiary)]"> · {s.tool.replace(/_/g, ' ')}</span>
                            {blocked && (
                                <span className="text-amber-600 dark:text-amber-400">
                                    {' '}— {s.blockedReason || 'blocked by Privacy Shield'}
                                </span>
                            )}
                        </span>
                        {s.piiCategories?.length > 0 && (
                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 flex-shrink-0">
                                {s.piiCategories.join(', ')}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
