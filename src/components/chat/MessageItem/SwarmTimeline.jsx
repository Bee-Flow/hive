import React, { useMemo } from 'react';
import { Check, Loader2, AlertCircle, Lock } from 'lucide-react';

/**
 * SwarmTimeline — inline progress card shown above the assistant message body
 * during a Swarm-tier direct chat. Renders the swarm's phase progress bar
 * (Clarify → Plan → Research → … → Deliver), an optional clarifier prompt,
 * and a small footer summarising deepResearch metadata when present.
 *
 * The component is shape-agnostic: it reads `message.swarm` (populated by the
 * SSE handlers in useChatEngine) and gracefully renders whatever's there.
 * Once Swarm v2 ships generic phased+parallel execution this same component
 * can render multiple worker cards per phase without backend changes.
 */

const PHASE_TILE = {
    pending: 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border-[var(--border-subtle)]',
    active:  'bg-sky-500/15 text-sky-700 border-sky-500/40 shadow-[0_0_0_3px_rgba(14,165,233,.10)]',
    done:    'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
    failed:  'bg-rose-500/15 text-rose-700 border-rose-500/30',
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

export default function SwarmTimeline({ swarm }) {
    const phases = useMemo(() => Array.isArray(swarm?.phases) ? swarm.phases : [], [swarm]);
    if (!swarm || phases.length === 0) return null;

    const phaseStates = swarm.phaseStates || {};
    const doneCount = phases.filter(p => phaseStates[p.id]?.status === 'done').length;
    const total = phases.length;
    const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    const swarmName = swarm.swarmName || 'Swarm';
    const isPending = swarm.state === 'running' && doneCount === 0 && Object.keys(phaseStates).length === 0;
    const meta = swarm.deepResearch || {};
    const sourceCount = meta.research_summary?.totalSources || meta.citations_registered?.count || null;
    const questionCount = meta.research_plan?.nodeCount || null;

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
                        : <img src="/BeeFlow-logo-Icon-2026.svg" alt="" className="w-4 h-4 object-contain" />}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {swarmName} {swarm.depth ? <span className="text-[11px] font-normal opacity-70">· {swarm.depth} mode</span> : null}
                    </div>
                    <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {swarm.state === 'awaiting_clarification'
                            ? 'Waiting for your clarification…'
                            : swarm.state === 'done'
                                ? `Completed ${doneCount}/${total} phases`
                                : `Phase ${doneCount + 1} of ${total} · workers running in parallel`}
                    </div>
                </div>
            </div>

            {/* Phase tiles */}
            <div className={`grid gap-2 px-3 pt-2 pb-3 ${phases.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
                {phases.map(phase => {
                    const status = phaseStates[phase.id]?.status || 'pending';
                    return <PhaseTile key={phase.id} phase={phase} state={status} />;
                })}
            </div>

            {/* Clarifier prompt (when paused) */}
            {swarm.state === 'awaiting_clarification' && Array.isArray(swarm.clarification?.questions) && swarm.clarification.questions.length > 0 && (
                <div className="px-3 pb-3 pt-1 border-t border-[var(--border-subtle)]">
                    <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>
                        The swarm needs your input
                    </div>
                    <ul className="text-[12.5px] leading-snug space-y-1" style={{ color: 'var(--text-primary)' }}>
                        {swarm.clarification.questions.map((q, i) => (
                            <li key={i} className="flex gap-2">
                                <span className="text-[var(--text-tertiary)]">{i + 1}.</span>
                                <span>{typeof q === 'string' ? q : (q?.question || JSON.stringify(q))}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Footer — deep research meta when present */}
            {(sourceCount !== null || questionCount !== null) && (
                <div className="px-3 pb-2 pt-1 text-[10.5px] flex gap-3" style={{ color: 'var(--text-tertiary)' }}>
                    {questionCount !== null && <span>🔍 {questionCount} sub-questions</span>}
                    {sourceCount !== null && <span>📚 {sourceCount} sources</span>}
                </div>
            )}
        </div>
    );
}
