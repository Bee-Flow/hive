import React, { useMemo, useState } from 'react';
import { Check, Loader2, AlertCircle, Lock, ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import beeFlowIcon from '../../../assets/BeeFlow-logo-Icon-2026.svg';

/**
 * SwarmTimeline — inline progress card shown above the assistant message body
 * during a Swarm-tier direct chat. Renders the swarm's phase progress bar
 * (Researching → Writing) plus expandable worker cards that stream their
 * content live as it arrives. The synthesiser's tokens stream straight into
 * the chat bubble below via ordinary `content` events; this component only
 * shows what the workers were doing in parallel.
 */

const PHASE_TILE = {
    pending: 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border-[var(--border-subtle)]',
    active:  'bg-sky-500/15 text-sky-700 border-sky-500/40 shadow-[0_0_0_3px_rgba(14,165,233,.10)]',
    done:    'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
    failed:  'bg-rose-500/15 text-rose-700 border-rose-500/30',
};

const WORKER_TILE = {
    running: 'bg-sky-500/10 text-sky-800 border-sky-500/30',
    done:    'bg-emerald-500/10 text-emerald-800 border-emerald-500/25',
    failed:  'bg-rose-500/10 text-rose-800 border-rose-500/30',
};

function PhaseTile({ phase, state }) {
    const Icon = state === 'done' ? Check
        : state === 'active' ? Loader2
        : state === 'failed' ? AlertCircle
        : Lock;
    const cls = PHASE_TILE[state] || PHASE_TILE.pending;
    return (
        <div
            className={`flex flex-col gap-1 px-2.5 py-2 rounded-lg border min-w-0 transition-colors ${cls}`}
            title={phase.description || phase.name}
        >
            <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md flex items-center justify-center bg-white/40 text-[10px] font-bold flex-shrink-0">
                    <Icon size={11} className={state === 'active' ? 'animate-spin' : ''} />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {state === 'done' ? 'done' : state === 'active' ? 'active' : state === 'failed' ? 'failed' : 'waiting'}
                </span>
            </div>
            <div className="text-[11.5px] leading-tight truncate">
                {phase.name}
            </div>
        </div>
    );
}

function WorkerCard({ worker }) {
    const [open, setOpen] = useState(false);
    const status = worker.status || 'running';
    const tileCls = WORKER_TILE[status] || WORKER_TILE.running;
    const StatusIcon = status === 'done' ? Check : status === 'failed' ? AlertCircle : Loader2;
    const tools = Array.isArray(worker.tools) ? worker.tools : [];
    const hasContent = (worker.content || '').length > 0;
    const hasTools = tools.length > 0;
    const expandable = hasContent || hasTools;

    return (
        <div className={`rounded-lg border ${tileCls} transition-colors`}>
            <button
                type="button"
                onClick={() => expandable && setOpen(o => !o)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 text-left ${expandable ? 'cursor-pointer hover:bg-white/30' : 'cursor-default'}`}
                disabled={!expandable}
            >
                <span className="w-5 h-5 rounded-md flex items-center justify-center bg-white/40 flex-shrink-0">
                    <StatusIcon size={11} className={status === 'running' ? 'animate-spin' : ''} />
                </span>
                <div className="flex-1 min-w-0">
                    <div className="text-[11.5px] font-semibold leading-tight truncate">
                        {worker.name || worker.role || worker.workerId}
                    </div>
                    <div className="text-[10px] opacity-70 truncate">
                        {status === 'running' ? 'Working…' : status === 'done' ? `Done${worker.durationMs ? ` · ${(worker.durationMs / 1000).toFixed(1)}s` : ''}` : `Failed${worker.error ? ` · ${worker.error}` : ''}`}
                        {hasTools ? ` · ${tools.length} tool call${tools.length === 1 ? '' : 's'}` : ''}
                    </div>
                </div>
                {expandable && (
                    open
                        ? <ChevronDown size={12} className="opacity-60 flex-shrink-0" />
                        : <ChevronRight size={12} className="opacity-60 flex-shrink-0" />
                )}
            </button>
            {open && (
                <div className="px-2.5 pb-2.5 pt-0 space-y-2">
                    {hasTools && (
                        <div className="text-[10.5px] flex flex-wrap gap-1.5 mt-1">
                            {tools.map((t, i) => (
                                <span
                                    key={i}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${
                                        t.status === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-700'
                                        : t.status === 'done' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800'
                                        : 'bg-white/40 border-black/10'
                                    }`}
                                >
                                    <Wrench size={9} />
                                    {t.name}
                                </span>
                            ))}
                        </div>
                    )}
                    {hasContent && (
                        <pre className="text-[11px] whitespace-pre-wrap break-words bg-white/40 rounded-md p-2 max-h-64 overflow-auto leading-snug">
                            {worker.content}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
}

export default function SwarmTimeline({ swarm }) {
    const phases = useMemo(() => Array.isArray(swarm?.phases) ? swarm.phases : [], [swarm]);
    const workersById = swarm?.workers || {};
    const phaseStates = swarm?.phaseStates || {};

    if (!swarm || phases.length === 0) return null;

    const doneCount = phases.filter(p => phaseStates[p.id]?.status === 'done').length;
    const total = phases.length;
    const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    const swarmName = swarm.swarmName || 'Swarm';
    const isPending = swarm.state === 'running' && doneCount === 0 && Object.keys(phaseStates).length === 0;

    // Workers grouped under "current phase" — for v2 we just show all
    // workers (3 researchers + 1 synthesiser) regardless of phase since
    // the manifest is fixed and small.
    const workerList = Object.values(workersById).filter(w => w.role !== 'writer');
    const failedCount = workerList.filter(w => w.status === 'failed').length;

    return (
        <div
            className="mb-3 rounded-xl border overflow-hidden"
            style={{
                background: 'rgba(16, 185, 129, .05)',
                borderColor: 'rgba(16, 185, 129, .25)',
            }}
        >
            {/* Progress strip */}
            <div className="h-1 bg-[var(--bg-tertiary)] overflow-hidden">
                <div
                    className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                    style={{ width: `${progressPct}%` }}
                />
            </div>

            {/* Header */}
            <div className="flex items-center gap-2 px-3 pt-2.5">
                <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(16, 185, 129, .15)' }}
                    aria-hidden="true"
                >
                    {isPending
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        : <img src={beeFlowIcon} alt="" className="w-4 h-4 object-contain" />}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {swarmName}
                    </div>
                    <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {swarm.state === 'done'
                            ? `Completed ${doneCount}/${total} phases${failedCount ? ` · ${failedCount} worker failure${failedCount === 1 ? '' : 's'}` : ''}`
                            : `Phase ${doneCount + 1} of ${total} · workers running in parallel`}
                    </div>
                </div>
            </div>

            {/* Phase tiles */}
            <div className={`grid gap-2 px-3 pt-2 pb-2 ${phases.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
                {phases.map(phase => {
                    const status = phaseStates[phase.id]?.status || 'pending';
                    return <PhaseTile key={phase.id} phase={phase} state={status} />;
                })}
            </div>

            {/* Worker cards (researchers; synthesiser streams into the chat
                bubble directly, no card needed). */}
            {workerList.length > 0 && (
                <div className="px-3 pb-3 pt-1 grid gap-2 grid-cols-1 sm:grid-cols-2 border-t border-[var(--border-subtle)]">
                    {workerList.map(w => <WorkerCard key={w.workerId} worker={w} />)}
                </div>
            )}
        </div>
    );
}
