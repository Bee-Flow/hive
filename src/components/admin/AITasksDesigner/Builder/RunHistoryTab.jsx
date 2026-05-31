import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Clock, Play, ChevronRight } from 'lucide-react';
import useAutomationApi from '../../../../hooks/useAutomationApi';
import DiagramPane from './DiagramPane';

/**
 * n8n-style Executions drawer. Two panes:
 *   - Left: scrolling list of recent runs filtered by status / mode.
 *   - Right: read-only diagram of the selected run with each node
 *     coloured by its recorded status. Click a step to expand its
 *     input/output JSON below the canvas (no separate inspector — this
 *     view is debug-focused, not edit-focused).
 *
 * Audit header per run: trigger kind + start time + duration. The runs
 * table already records the triggering user implicitly via user_id;
 * surfacing the name would need a server join — left for a follow-up.
 */
export default function RunHistoryTab({ automationId, automation }) {
    const api = useAutomationApi();
    const [runs, setRuns] = useState([]);
    const [openId, setOpenId] = useState(null);
    const [steps, setSteps] = useState({}); // runId → steps[]
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all'); // all | success | error | dry_run
    const [selectedStepId, setSelectedStepId] = useState(null);

    useEffect(() => {
        if (!automationId) return;
        let alive = true;
        setLoading(true);
        api.listRuns(automationId)
            .then(d => { if (alive) setRuns(d.runs || []); })
            .catch(() => {})
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [automationId]); // eslint-disable-line react-hooks/exhaustive-deps

    const filtered = useMemo(() => {
        if (filter === 'all') return runs;
        if (filter === 'dry_run') return runs.filter(r => r.mode === 'dry_run');
        return runs.filter(r => r.status === filter);
    }, [runs, filter]);

    const open = async (run) => {
        setOpenId(run.id);
        setSelectedStepId(null);
        if (steps[run.id]) return;
        try {
            const d = await api.getRunSteps(run.id);
            setSteps(s => ({ ...s, [run.id]: d.steps || [] }));
        } catch (e) {
            setSteps(s => ({ ...s, [run.id]: [] }));
        }
    };

    const selectedRun = useMemo(() => runs.find(r => r.id === openId) || null, [runs, openId]);
    const selectedSteps = openId ? (steps[openId] || []) : [];
    const selectedStepRecord = selectedStepId ? selectedSteps.find(s => s.stepId === selectedStepId) : null;

    return (
        <div className="h-full flex">
            {/* Left pane — list of runs */}
            <div className="w-[340px] flex-shrink-0 flex flex-col border-r border-[var(--border-default)]">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-default)]">
                    {[
                        { id: 'all',     label: 'All' },
                        { id: 'success', label: 'Success' },
                        { id: 'error',   label: 'Error' },
                        { id: 'dry_run', label: 'Dry-run' },
                    ].map(c => (
                        <button
                            key={c.id}
                            onClick={() => setFilter(c.id)}
                            className={`text-xs px-2.5 py-1 rounded-full transition ${
                                filter === c.id
                                    ? 'bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-[var(--accent)]/30'
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                            }`}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                    {loading && runs.length === 0 && (
                        <div className="text-sm text-[var(--text-tertiary)] p-4">Loading runs…</div>
                    )}
                    {!loading && filtered.length === 0 && (
                        <div className="text-sm text-[var(--text-tertiary)] p-4">
                            {runs.length === 0 ? 'No runs yet — click "Run Now" or wait for a trigger.' : 'No runs match this filter.'}
                        </div>
                    )}
                    {filtered.map(run => (
                        <RunCard
                            key={run.id}
                            run={run}
                            selected={openId === run.id}
                            onSelect={() => open(run)}
                            onApprove={async (e) => {
                                e.stopPropagation();
                                await api.approveRun(run.id);
                                const d = await api.listRuns(automationId);
                                setRuns(d.runs || []);
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Right pane — selected run preview */}
            <div className="flex-1 min-w-0 flex flex-col">
                {!selectedRun && (
                    <div className="flex-1 flex items-center justify-center text-sm text-[var(--text-tertiary)]">
                        Select a run on the left to inspect its execution.
                    </div>
                )}
                {selectedRun && (
                    <>
                        <AuditHeader run={selectedRun} />
                        <div className="flex-1 min-h-0 relative">
                            {automation?.definition ? (
                                <DiagramPane
                                    definition={automation.definition}
                                    runSteps={selectedSteps}
                                    onNodeClick={setSelectedStepId}
                                    readOnly
                                />
                            ) : (
                                <div className="p-4 text-xs text-[var(--text-tertiary)]">
                                    Definition unavailable — open the Build tab once to load it, then return here.
                                </div>
                            )}
                        </div>
                        {selectedStepRecord && (
                            <div className="flex-shrink-0 border-t border-[var(--border-default)] bg-[var(--bg-secondary)] max-h-[40%] overflow-y-auto p-3">
                                <div className="flex items-center gap-2 text-xs mb-2">
                                    <StatusIcon status={selectedStepRecord.status} />
                                    <code className="font-mono text-[var(--text-primary)]">{selectedStepRecord.stepId}</code>
                                    <span className="text-[var(--text-tertiary)]">({selectedStepRecord.stepType})</span>
                                    <button
                                        onClick={() => setSelectedStepId(null)}
                                        className="ml-auto text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                                    >
                                        Close
                                    </button>
                                </div>
                                {selectedStepRecord.error && (
                                    <div className="text-xs text-red-600 dark:text-red-400 mb-2">{selectedStepRecord.error}</div>
                                )}
                                {selectedStepRecord.errorRemediation && (
                                    <div className="text-xs text-amber-600 dark:text-amber-400 mb-2">→ {selectedStepRecord.errorRemediation}</div>
                                )}
                                <pre className="text-[11px] bg-[var(--bg-primary)] border border-[var(--border-default)] rounded p-2 overflow-auto whitespace-pre-wrap break-words text-[var(--text-primary)]">
{JSON.stringify({ input: selectedStepRecord.input, output: selectedStepRecord.output }, null, 2)}
                                </pre>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function RunCard({ run, selected, onSelect, onApprove }) {
    const tone = toneFor(run);
    const duration = run.durationMs
        ? `${(run.durationMs / 1000).toFixed(1)}s`
        : null;
    return (
        <button
            onClick={onSelect}
            className={`w-full text-left rounded-lg border overflow-hidden transition flex items-stretch ${
                selected
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]/30'
                    : 'border-[var(--border-default)] bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)]'
            }`}
        >
            <span className={`w-1 flex-shrink-0 ${tone.bar}`} />
            <div className="flex-1 min-w-0 px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                    <StatusBadge status={run.status} mode={run.mode} />
                    <span className="text-[var(--text-secondary)] truncate">
                        {run.mode === 'dry_run' ? 'Dry-run' : run.triggerKind || 'manual'}
                    </span>
                    {duration && <span className="ml-auto text-[var(--text-tertiary)] tabular-nums">{duration}</span>}
                </div>
                <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                    {run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}
                </div>
                {run.error && (
                    <div className="text-[11px] text-red-600 dark:text-red-400 mt-1 line-clamp-1">{run.error}</div>
                )}
                {run.status === 'awaiting_confirm' && (
                    <button
                        onClick={onApprove}
                        className="text-[11px] mt-1 bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-0.5 rounded-full"
                    >
                        Approve
                    </button>
                )}
            </div>
        </button>
    );
}

function AuditHeader({ run }) {
    return (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-default)] text-xs bg-[var(--bg-secondary)]/40 flex-shrink-0">
            <StatusBadge status={run.status} mode={run.mode} />
            <span className="text-[var(--text-secondary)]">
                Trigger: <span className="text-[var(--text-primary)]">{run.triggerKind || 'manual'}</span>
            </span>
            <span className="text-[var(--text-tertiary)]">
                Started {run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}
            </span>
            {run.durationMs != null && (
                <span className="text-[var(--text-tertiary)]">
                    · Duration {(run.durationMs / 1000).toFixed(2)}s
                </span>
            )}
            <code className="ml-auto font-mono text-[10px] text-[var(--text-tertiary)]">{run.id}</code>
        </div>
    );
}

function toneFor(run) {
    if (run.status === 'success') return { bar: 'bg-emerald-500' };
    if (run.status === 'error')   return { bar: 'bg-red-500' };
    if (run.status === 'running') return { bar: 'bg-amber-500' };
    if (run.status === 'awaiting_confirm') return { bar: 'bg-amber-500' };
    if (run.mode === 'dry_run')   return { bar: 'bg-[var(--accent)]' };
    return { bar: 'bg-[var(--border-default)]' };
}

function StatusBadge({ status, mode }) {
    const cls = status === 'success' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
        : status === 'error' ? 'bg-red-500/15 text-red-600 dark:text-red-400'
        : status === 'running' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
        : status === 'awaiting_confirm' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]';
    return (
        <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${cls}`}>
            {mode === 'dry_run' ? 'dry-run' : status}
        </span>
    );
}

function StatusIcon({ status }) {
    if (status === 'success') return <CheckCircle2 size={12} className="text-emerald-500" />;
    if (status === 'error')   return <AlertTriangle size={12} className="text-red-500" />;
    if (status === 'running') return <Clock size={12} className="text-amber-500" />;
    return <Play size={12} className="text-[var(--text-tertiary)]" />;
}
