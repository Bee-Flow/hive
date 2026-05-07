import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Clock, Play, ChevronRight } from 'lucide-react';
import useAutomationApi from '../../../../hooks/useAutomationApi';

/**
 * Card-based run history. Replaces the dense one-line list with a stack
 * of cards that surface trigger kind, status, duration, and a tinted
 * left edge bar consistent with the diagram nodes.
 *
 * Filter chips at the top: All / Success / Error / Dry-run.
 * Click a card to expand the per-step rows below it.
 */
export default function RunHistoryTab({ automationId }) {
    const api = useAutomationApi();
    const [runs, setRuns] = useState([]);
    const [openId, setOpenId] = useState(null);
    const [steps, setSteps] = useState({});
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all'); // all | success | error | dry_run

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
        if (openId === run.id) { setOpenId(null); return; }
        setOpenId(run.id);
        if (steps[run.id]) return;
        try {
            const d = await api.getRunSteps(run.id);
            setSteps(s => ({ ...s, [run.id]: d.steps || [] }));
        } catch (e) {
            setSteps(s => ({ ...s, [run.id]: [] }));
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 px-6 py-3 border-b border-[var(--border-default)]">
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
                <span className="text-xs text-[var(--text-tertiary)] ml-auto">
                    {filtered.length} run{filtered.length === 1 ? '' : 's'}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
                        expanded={openId === run.id}
                        steps={steps[run.id] || null}
                        onToggle={() => open(run)}
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
    );
}

function RunCard({ run, expanded, steps, onToggle, onApprove }) {
    const tone = toneFor(run);
    return (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] hover:ring-1 hover:ring-[var(--border-default)] overflow-hidden transition">
            <button
                onClick={onToggle}
                className="w-full flex items-stretch text-left"
            >
                <span className={`w-1 flex-shrink-0 ${tone.bar}`} />
                <div className="flex-1 min-w-0 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                        <ChevronRight size={14} className={`text-[var(--text-tertiary)] transition-transform ${expanded ? 'rotate-90' : ''}`} />
                        <StatusBadge status={run.status} mode={run.mode} />
                        <span className="text-[var(--text-secondary)]">
                            {run.mode === 'dry_run' ? 'Dry-run' : run.triggerKind || 'manual'}
                        </span>
                        {run.summary && (
                            <span className="text-xs text-[var(--text-tertiary)] truncate">— {run.summary}</span>
                        )}
                        <span className="ml-auto text-xs text-[var(--text-tertiary)] flex-shrink-0">
                            {run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}
                        </span>
                        {run.status === 'awaiting_confirm' && (
                            <button
                                onClick={onApprove}
                                className="text-[11px] bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-0.5 rounded-full"
                            >
                                Approve
                            </button>
                        )}
                    </div>
                    {run.error && (
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1 line-clamp-1">
                            {run.error}
                        </div>
                    )}
                </div>
            </button>
            {expanded && (
                <div className="border-t border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 space-y-1.5">
                    {!steps && <div className="text-xs text-[var(--text-tertiary)]">Loading step records…</div>}
                    {steps && steps.length === 0 && <div className="text-xs text-[var(--text-tertiary)]">(no step records)</div>}
                    {steps && steps.map(s => (
                        <details key={`${s.stepId}-${s.attempts}`} className="rounded border border-[var(--border-default)] bg-[var(--bg-primary)]">
                            <summary className="cursor-pointer text-xs px-3 py-1.5 flex items-center gap-2 list-none">
                                <StatusIcon status={s.status} />
                                <code className="font-mono text-[var(--text-primary)]">{s.stepId}</code>
                                <span className="text-[var(--text-tertiary)]">({s.stepType})</span>
                                {s.error && <span className="ml-auto text-red-600 dark:text-red-400 truncate">{s.error}</span>}
                            </summary>
                            <pre className="text-[11px] px-3 py-2 bg-[var(--bg-secondary)] border-t border-[var(--border-default)] overflow-auto max-h-72 whitespace-pre-wrap break-words text-[var(--text-primary)]">
{JSON.stringify({ input: s.input, output: s.output, error: s.error }, null, 2)}
                            </pre>
                        </details>
                    ))}
                </div>
            )}
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
