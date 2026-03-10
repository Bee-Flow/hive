import React from 'react';
import { Check, ChevronDown } from 'lucide-react';

export function ThinkingStepsPanel({ steps }) {
    if (!steps || steps.length === 0) return null;

    const isThinking = steps.some(s => s.status === 'running');
    const completedCount = steps.filter(s => s.status === 'done').length;
    const totalEstimate = steps[steps.length - 1]?.totalThoughts || steps.length;

    return (
        <div className="mb-3">
            <details className="group" open={isThinking}>
                <summary className="flex items-center gap-2 cursor-pointer select-none list-none py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isThinking ? (
                            <div className="w-5 h-5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin flex-shrink-0" />
                        ) : (
                            <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                <Check className="w-3 h-3 text-purple-400" />
                            </div>
                        )}
                        <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                            {isThinking ? 'Thinking...' : 'Thought Process'}
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)] ml-auto flex-shrink-0">
                            {completedCount}/{totalEstimate} steps
                        </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform group-open:rotate-180" />
                </summary>

                <div className="mt-1 ml-2 border-l-2 border-purple-500/20 pl-4 space-y-2">
                    {steps.map((step, i) => (
                        <div
                            key={i}
                            className={`flex gap-2 py-1.5 transition-opacity ${step.status === 'running' ? 'opacity-100' : 'opacity-75'
                                }`}
                        >
                            {/* Step number indicator */}
                            <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step.status === 'running'
                                ? 'bg-purple-500/30 text-purple-300 animate-pulse'
                                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                                }`}>
                                {step.thoughtNumber}
                            </div>

                            <div className="flex-1 min-w-0">
                                {/* Badges */}
                                {(step.isRevision || step.branchFromThought) && (
                                    <div className="flex gap-1 mb-0.5">
                                        {step.isRevision && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold">
                                                🔄 Revision
                                            </span>
                                        )}
                                        {step.branchFromThought && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 font-semibold">
                                                🌿 Branch from #{step.branchFromThought}
                                            </span>
                                        )}
                                    </div>
                                )}
                                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                    {step.thought}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </details>
        </div>
    );
}

export function SequentialThinking({ msg }) {
    const steps = msg.thinkingSteps;
    if (!steps || steps.length === 0) return null;
    // In swarm mode, only show steps without a worker (coordinator/direct agent steps)
    const hasSwarm = msg.swarmActivity?.logs?.length > 0;
    const filteredSteps = hasSwarm ? steps.filter(s => !s.worker) : steps;
    return <ThinkingStepsPanel steps={filteredSteps} />;
}
