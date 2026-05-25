import React, { useMemo, useRef, useEffect } from 'react';
import { Check, Loader2, Lock } from 'lucide-react';
import { classifySessionSkill, deriveCompletedSkillIds } from '../../skills/sessionSkillState';
import beeFlowIcon from '../../../assets/BeeFlow-logo-Icon-2026.svg';

/**
 * SessionSkillsTimeline — inline Flow progress card that sits above the
 * assistant message body during a Flow-tier direct chat. Renders the
 * "Created N stages" headline (when the message carries `bootstrap` info)
 * plus a stepper of stage tiles and per-stage completion summaries.
 *
 * State per node comes from classifySessionSkill / deriveCompletedSkillIds.
 * When a node's state changes between renders we briefly re-mount it so the
 * Tailwind animate-in classes fire — the user sees the Flow tick forward
 * live instead of just snapping.
 */

const TIER_ICON = {
    auto:     '🔀',
    fast:     '⚡',
    standard: '🐝',
    thinking: '🧠',
    writer:   '✍️',
    pro:      '✨',
};

const STATE_ICON = {
    done: Check,
    active: Loader2,
    waiting: Lock,
    ready: null,
};

const STATE_TILE_CLASS = {
    done:    'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    active:  'bg-sky-500/15 text-sky-600 border-sky-500/40 shadow-[0_0_0_3px_rgba(14,165,233,.10)]',
    ready:   'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--border-subtle)]',
    waiting: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
};

const STATE_LABEL_CLASS = {
    done:    'text-[var(--text-secondary)] line-through decoration-1',
    active:  'text-[var(--text-primary)] font-semibold',
    ready:   'text-[var(--text-secondary)]',
    waiting: 'text-[var(--text-tertiary)]',
};

function SkillNode({ skill, state, sessionSkillsById }) {
    const Icon = STATE_ICON[state];
    const previousStateRef = useRef(state);
    // Re-key on state change so animate-in fires on the new tile.
    useEffect(() => { previousStateRef.current = state; }, [state]);
    const justChanged = previousStateRef.current !== state;

    const unmetDeps = state === 'waiting'
        ? (skill.dependsOn || [])
            .filter(id => sessionSkillsById.get(id))
            .map(id => sessionSkillsById.get(id).name)
        : [];

    const tierIcon = skill.tier ? TIER_ICON[skill.tier] : null;
    const tierTitle = skill.tier ? `Runs on ${skill.tier} tier` : null;
    const baseTitle = state === 'waiting' && unmetDeps.length ? `Waiting on: ${unmetDeps.join(', ')}` : undefined;
    const titleAttr = [baseTitle, tierTitle].filter(Boolean).join(' · ') || undefined;

    return (
        <div
            // Re-keying via the state token forces a fresh mount so the
            // animate-in classes get a chance to play on every transition.
            key={`${skill.id}-${state}`}
            className={`flex flex-col gap-1 px-2.5 py-2 rounded-lg border min-w-0 transition-colors ${STATE_TILE_CLASS[state]} ${justChanged ? 'animate-in fade-in zoom-in-95 duration-300' : ''}`}
            title={titleAttr}
        >
            <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md flex items-center justify-center bg-white/40 text-[10px] font-bold flex-shrink-0">
                    {Icon
                        ? <Icon size={11} className={state === 'active' ? 'animate-spin' : ''} />
                        : (skill.order || '·')}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {state === 'done' ? 'done' : state === 'active' ? 'active' : state === 'waiting' ? 'waiting' : 'ready'}
                </span>
                {tierIcon && (
                    <span
                        className="ml-auto text-[10px] leading-none flex-shrink-0 opacity-80"
                        aria-label={tierTitle}
                    >
                        {tierIcon}
                    </span>
                )}
            </div>
            <div className={`text-[11.5px] leading-tight truncate ${STATE_LABEL_CLASS[state]}`}>
                {skill.name}
            </div>
        </div>
    );
}

export default function SessionSkillsTimeline({
    sessionSkills = [],
    activatedSkillIds = [],
    completedSkillIds = null,  // explicit from server (null = fall back to activation-derived)
    completions = [],          // [{skillId, skillName, summary, order, total, at}]
    bootstrap = null, // { state, skills } when this is the bootstrap message
}) {
    const ordered = useMemo(
        () => [...sessionSkills].sort((a, b) => (a.order || 0) - (b.order || 0)),
        [sessionSkills]
    );
    const sessionSkillsById = useMemo(
        () => new Map(sessionSkills.map(s => [s.id, s])),
        [sessionSkills]
    );
    const activatedSet = useMemo(
        () => new Set(Array.isArray(activatedSkillIds) ? activatedSkillIds : []),
        [activatedSkillIds]
    );
    const completedSet = useMemo(
        () => Array.isArray(completedSkillIds)
            ? new Set(completedSkillIds)
            : new Set(deriveCompletedSkillIds(sessionSkills, activatedSkillIds)),
        [sessionSkills, activatedSkillIds, completedSkillIds]
    );
    const orderedCompletions = useMemo(() => {
        if (!Array.isArray(completions) || completions.length === 0) return [];
        return [...completions].sort((a, b) => (a.order || 0) - (b.order || 0) || (a.at || 0) - (b.at || 0));
    }, [completions]);

    if (ordered.length === 0) return null;

    const doneCount = completedSet.size;
    const total = ordered.length;
    const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    const isPending = bootstrap?.state === 'pending';

    return (
        <div
            className="mb-3 rounded-xl border overflow-hidden"
            style={{
                background: 'rgba(245, 158, 11, .05)',
                borderColor: 'rgba(245, 158, 11, .25)',
            }}
        >
            {/* Progress strip */}
            <div className="h-1 bg-[var(--bg-tertiary)] overflow-hidden">
                <div
                    className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                    style={{ width: `${progressPct}%` }}
                />
            </div>

            {/* Header — bootstrap intro OR a compact summary */}
            <div className="flex items-center gap-2 px-3 pt-2.5">
                <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(245,158,11,.15)' }}
                    aria-hidden="true"
                >
                    {isPending
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                        : <img src={beeFlowIcon} alt="" className="w-4 h-4 object-contain" />}
                </span>
                <div className="flex-1 min-w-0">
                    {bootstrap ? (
                        <>
                            <div className="text-[12.5px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                                {isPending
                                    ? 'Preparing Flow stages…'
                                    : `Created ${ordered.length} stage${ordered.length === 1 ? '' : 's'} for this conversation`}
                            </div>
                            {!isPending && (
                                <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                    Stages activate in order; each one updates live below.
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-[12.5px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                            Flow · {doneCount === total ? `Done ${total}/${total}` : `${doneCount}/${total} done`}
                        </div>
                    )}
                </div>
            </div>

            {/* Stepper — horizontal for ≤4, 2-col grid for ≥5. Skip when still bootstrapping. */}
            {!isPending && (
                <div className={`grid gap-2 px-3 pt-2 pb-3 ${ordered.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    {ordered.map(skill => {
                        const state = classifySessionSkill(skill, activatedSet, completedSet);
                        return (
                            <SkillNode
                                key={skill.id}
                                skill={skill}
                                state={state}
                                sessionSkillsById={sessionSkillsById}
                            />
                        );
                    })}
                </div>
            )}

            {/* Per-step summaries — one row per complete_session_skill call.
                Gives the user visible evidence each step produced output before
                the final answer renders. */}
            {!isPending && orderedCompletions.length > 0 && (
                <div className="px-3 pb-3 pt-1 flex flex-col gap-1.5 border-t border-[var(--border-subtle)]">
                    {orderedCompletions.map((c, idx) => {
                        const name = c.skillName || sessionSkillsById.get(c.skillId)?.name || c.skillId;
                        return (
                            <div
                                key={`${c.skillId}-${c.at || idx}`}
                                className="flex items-start gap-2 text-[12px] leading-snug animate-in fade-in slide-in-from-top-1 duration-300"
                            >
                                <Check size={13} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                                <div className="min-w-0">
                                    <span className="font-semibold text-[var(--text-primary)]">{name}</span>
                                    {c.summary && (
                                        <span className="text-[var(--text-secondary)]"> — {c.summary}</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
