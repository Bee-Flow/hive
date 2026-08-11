import { CheckCircle2, Loader2, ShieldQuestion, XCircle } from 'lucide-react';
import React, { useState } from 'react';
import useAutomationApi from '../../../../../hooks/useAutomationApi';
import { toast } from '../../../../shared/Toast';
import { denseInputClass } from '../flow/settings/formStyles';

/**
 * Inline action bar for a step that's paused awaiting human approval.
 * Posts to /runs/:runId/approve-step (decision: approve | reject, reason
 * optional). On approve, the server spawns a child run that resumes from
 * the next step; the parent run is marked 'success'. On reject the run
 * is finalised as 'error'.
 *
 * Lives inside StepInspector, above the SettingsForm, so the user sees
 * the decision affordance the moment they click the paused node.
 *
 * Props:
 *   runId        — the awaiting run's id (from runStep.runId)
 *   stepId       — the step that's paused (for the on-screen label only)
 *   onResolved() — optional callback fired after a successful decision
 *                  so the parent can refresh runs / close the panel
 */
export default function ApprovalActionBar({ runId, stepId, onResolved }) {
    const api = useAutomationApi();
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(null); // 'approve' | 'reject' | null

    const decide = async (decision) => {
        if (!runId || submitting) return;
        setSubmitting(decision);
        try {
            await api.approveStep(runId, decision, reason.trim() || undefined);
            toast.success(decision === 'approve' ? 'Approved — run resuming.' : 'Rejected — run halted.');
            setReason('');
            onResolved?.(decision);
        } catch (e) {
            toast.error(`Couldn't ${decision} the run: ${e.message || 'unknown error'}`);
        } finally {
            setSubmitting(null);
        }
    };

    return (
        <div className="mx-3 mt-3 mb-2 rounded-md border border-amber-500/40 bg-amber-500/10">
            <div className="flex items-start gap-2 px-3 py-2">
                <ShieldQuestion size={14} className="mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-amber-700 dark:text-amber-300">
                        Awaiting approval
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        Step <span className="font-mono">{stepId}</span> is paused. Approve to continue the run from the next step, or reject to halt.
                    </div>
                </div>
            </div>
            <div className="px-3 pb-2 space-y-2">
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="Optional reason (recorded on reject)…"
                    className={denseInputClass('w-full')}
                />
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => decide('approve')}
                        disabled={!!submitting}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-[12px] rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                    >
                        {submitting === 'approve'
                            ? <Loader2 size={12} className="animate-spin" />
                            : <CheckCircle2 size={12} />}
                        Approve
                    </button>
                    <button
                        type="button"
                        onClick={() => decide('reject')}
                        disabled={!!submitting}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-[12px] rounded-md border border-red-500/50 text-red-700 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition"
                    >
                        {submitting === 'reject'
                            ? <Loader2 size={12} className="animate-spin" />
                            : <XCircle size={12} />}
                        Reject
                    </button>
                </div>
            </div>
        </div>
    );
}
