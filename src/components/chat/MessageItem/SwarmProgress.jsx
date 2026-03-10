import React from 'react';
import { Check, ChevronDown, ChevronRight, Loader, Activity, Brain, Microscope, Search, Clock } from 'lucide-react';
import { ThinkingStepsPanel } from './ThinkingSteps';

export default function SwarmProgress({
    msg,
    showSwarmLogs, setShowSwarmLogs,
    showBrain, setShowBrain,
    expandedBrainEntries, setExpandedBrainEntries,
    expandedWorkers, setExpandedWorkers,
    selectedPhase, setSelectedPhase,
}) {
    const dr = msg.swarmActivity;
    if (!dr) return null;

    const isComplete = dr.status === 'complete';
    const isSwarmMode = dr.type === 'swarm';

    // ─── Helper: format tool call for display ───
    const formatToolCall = (tool, args) => {
        if (!args) return { icon: '⚙️', text: tool };
        if (args.query) return { icon: '🔍', text: `"${args.query}"` };
        if (args.url) {
            try { return { icon: '🌐', text: new URL(args.url).hostname }; } catch { }
            return { icon: '🌐', text: args.url.slice(0, 60) };
        }
        if (args.text) return { icon: '⌨️', text: `"${args.text.slice(0, 60)}"` };
        if (args.selector) return { icon: '👆', text: args.selector.slice(0, 40) };
        return { icon: '⚙️', text: tool };
    };

    return (
        <div className="mb-3 space-y-3">
            {/* ─── Header ─── */}
            <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${isSwarmMode ? 'text-blue-400' : 'text-purple-400'}`}>
                {isSwarmMode ? <Activity className="w-4 h-4 animate-pulse" /> : <Microscope className="w-4 h-4 animate-pulse" />}
                <span>{isSwarmMode ? 'Swarm Activity' : 'Agent Activity'}</span>
                {dr.status !== 'complete' && (
                    <Loader className="w-3 h-3 animate-spin ml-auto" />
                )}
            </div>

            {/* ─── Orchestrator Thinking ─── */}
            {msg.orchestratorThinking && (() => {
                const isLive = msg.isStreaming && !isComplete;
                if (isLive) {
                    return (
                        <div>
                            <div className="flex items-center gap-2 text-xs text-purple-400 mb-1.5">
                                <span className="text-sm animate-pulse">🧠</span>
                                <span className="font-semibold">Orchestrator</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                            </div>
                            <div
                                className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/20 text-[11px] text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed max-h-[150px] overflow-y-auto custom-scrollbar"
                                ref={el => { if (el) el.scrollTop = el.scrollHeight; }}
                                style={{ fontStyle: 'italic', opacity: 0.85 }}
                            >
                                {msg.orchestratorThinking}
                                <span className="inline-block w-1 h-3 bg-purple-400/60 ml-0.5 animate-pulse align-text-bottom" />
                            </div>
                        </div>
                    );
                }
                return (
                    <details className="group/orch">
                        <summary className="flex items-center gap-2 cursor-pointer text-xs text-purple-400/70 hover:text-purple-300 transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
                            <span className="text-sm">🧠</span>
                            <span className="font-medium">Orchestrator Thoughts</span>
                            <svg className="w-3 h-3 transition-transform group-open/orch:rotate-90 ml-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </summary>
                        <div className="mt-1.5 p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/20 text-[11px] text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto custom-scrollbar" style={{ fontStyle: 'italic', opacity: 0.85 }}>
                            {msg.orchestratorThinking}
                        </div>
                    </details>
                );
            })()}

            {/* ─── Phase Stepper ─── */}
            {dr.phases?.length > 0 && (() => {
                const phaseMessages = dr.phases || [];
                const phaseNames = [];
                const completedPhases = new Set();
                let currentPhase = null;

                phaseMessages.forEach(msg => {
                    const startMatch = msg.match(/Starting phase:\s*(.+)/i);
                    const completeMatch = msg.match(/Phase complete:\s*(.+)/i);
                    if (startMatch) {
                        const name = startMatch[1].trim();
                        if (!phaseNames.includes(name)) phaseNames.push(name);
                        currentPhase = name;
                    }
                    if (completeMatch) {
                        completedPhases.add(completeMatch[1].trim());
                    }
                });

                if (phaseNames.length === 0) {
                    const uniquePhases = [...new Set(phaseMessages.map(p => p.replace('Entering phase: ', '')))];
                    phaseNames.push(...uniquePhases);
                }

                const completedCount = completedPhases.size;
                const totalPhases = phaseNames.length;
                const allPhasesComplete = totalPhases > 0 && completedCount >= totalPhases;
                const progressPct = totalPhases > 0 ? Math.round((completedCount / totalPhases) * 100) : 0;

                const handlePhaseClick = (phaseIndex) => {
                    if (!showSwarmLogs) setShowSwarmLogs(true);
                    setSelectedPhase(prev => prev === phaseIndex ? null : phaseIndex);
                };

                return phaseNames.length > 0 ? (
                    <div className="space-y-2">
                        {/* Stepper row */}
                        <div className="flex items-center">
                            {phaseNames.map((phase, i) => {
                                const isDone = completedPhases.has(phase);
                                const isCurrent = phase === currentPhase && !isDone;
                                return (
                                    <React.Fragment key={i}>
                                        {i > 0 && (
                                            <div className={`h-0.5 flex-1 transition-colors duration-500 ${isDone || isCurrent ? 'bg-blue-500/50' : 'bg-[var(--border-subtle)]'}`} />
                                        )}
                                        <button
                                            onClick={() => handlePhaseClick(i)}
                                            className="flex flex-col items-center gap-1 group cursor-pointer"
                                            style={{ minWidth: '60px' }}
                                            title={`View ${phase?.replace(/_/g, ' ')}`}
                                        >
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg ${isDone
                                                ? 'bg-green-500/20 border-2 border-green-500 text-green-400 group-hover:bg-green-500/30'
                                                : isCurrent
                                                    ? 'bg-blue-500/20 border-2 border-blue-400 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.3)] group-hover:bg-blue-500/30'
                                                    : 'bg-[var(--bg-tertiary)] border-2 border-[var(--border-subtle)] text-[var(--text-tertiary)] group-hover:border-blue-400/50'
                                                }`}>
                                                {isDone ? (
                                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                                ) : isCurrent ? (
                                                    <Loader className="w-3.5 h-3.5 animate-spin text-blue-400" />
                                                ) : (
                                                    <span>{i + 1}</span>
                                                )}
                                            </div>
                                            <span className={`text-[10px] font-medium text-center leading-tight transition-colors ${isDone ? 'text-green-400/80 group-hover:text-green-300' : isCurrent ? 'text-blue-300 group-hover:text-blue-200' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'}`}>
                                                {phase?.replace(/_/g, ' ')}
                                            </span>
                                        </button>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                        {/* Progress bar */}
                        <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-1 overflow-hidden">
                            <div
                                className={`h-1 rounded-full transition-all duration-700 ease-out ${allPhasesComplete ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-blue-500 to-cyan-400'}`}
                                style={{ width: `${(isComplete || allPhasesComplete) ? 100 : Math.max(progressPct, 5)}%` }}
                            />
                        </div>
                    </div>
                ) : null;
            })()}

            {/* ─── Sub-questions (Deep Research) ─── */}
            {dr.questions?.length > 0 && (
                <div className="space-y-1 pl-1">
                    {dr.questions.map((q, i) => {
                        const isSearching = dr.activeSearches?.includes(q.question);
                        const isDone = (dr.completedSearches || 0) > i;
                        return (
                            <div key={i} className="text-xs flex items-center gap-2 text-[var(--text-secondary)]">
                                {isDone ? (
                                    <Check className="w-3 h-3 text-green-500 shrink-0" />
                                ) : isSearching ? (
                                    <Search className="w-3 h-3 text-purple-400 animate-pulse shrink-0" />
                                ) : (
                                    <div className="w-3 h-3 rounded-full border border-[var(--border-subtle)] shrink-0" />
                                )}
                                <span className={isDone ? 'text-[var(--text-tertiary)]' : ''}>{q.question}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {dr.status === 'synthesize' && (
                <div className="text-xs text-purple-400 flex items-center gap-2 font-medium">
                    <Loader className="w-3 h-3 animate-spin" />
                    <span>Synthesizing research into report...</span>
                </div>
            )}

            {isComplete && (
                <div className="text-xs text-green-500 flex items-center gap-2 font-medium">
                    <Check className="w-3 h-3" />
                    <span>Research gathered from {dr.completedSearches || 0} sources</span>
                </div>
            )}

            {/* ─── Activity Timeline (Worker Cards) ─── */}
            {dr.logs && dr.logs.length > 0 && (() => {
                const workersByPhase = new Map();
                const activeWorkers = new Map();
                const phaseOrder = [];

                dr.logs.forEach(log => {
                    const key = log.instanceId || log.worker;
                    if (log.type === 'phase') {
                        if (!workersByPhase.has(log.phase)) {
                            workersByPhase.set(log.phase, []);
                            phaseOrder.push(log.phase);
                        }
                    } else if (log.type === 'worker_start') {
                        const run = {
                            worker: log.worker,
                            instanceId: log.instanceId,
                            role: log.role,
                            phase: log.phase,
                            instruction: log.instruction,
                            timestamp: log.timestamp,
                            tools: [],
                            thinkingSteps: [],
                            result: null,
                            error: null,
                            endTimestamp: null,
                            workerType: log.type === 'browser' ? 'browser' : 'llm'
                        };
                        activeWorkers.set(key, run);
                        const phase = log.phase || 'Unknown';
                        if (!workersByPhase.has(phase)) {
                            workersByPhase.set(phase, []);
                            phaseOrder.push(phase);
                        }
                        workersByPhase.get(phase).push(run);
                    } else if (log.type === 'tool_start') {
                        const run = activeWorkers.get(key);
                        if (run) {
                            run.tools.push({ tool: log.tool, args: log.args });
                        }
                    } else if (log.type === 'worker_complete') {
                        const run = activeWorkers.get(key);
                        if (run) {
                            run.result = log.preview;
                            run.endTimestamp = log.timestamp;
                        }
                    } else if (log.type === 'worker_error') {
                        const run = activeWorkers.get(key);
                        if (run) {
                            run.error = log.preview;
                            run.endTimestamp = log.timestamp;
                        }
                    }
                });

                // Distribute thinking steps to their respective workers
                if (msg.thinkingSteps?.length > 0) {
                    msg.thinkingSteps.forEach(step => {
                        if (step.instanceId) {
                            const run = activeWorkers.get(step.instanceId);
                            if (run) {
                                run.thinkingSteps.push(step);
                            }
                        }
                    });
                }

                const workerCount = phaseOrder.reduce((sum, p) => sum + workersByPhase.get(p).length, 0);
                const completedWorkers = phaseOrder.reduce((sum, p) => sum + workersByPhase.get(p).filter(w => w.result !== null || w.error !== null).length, 0);
                const toolCount = phaseOrder.reduce((sum, p) => sum + workersByPhase.get(p).reduce((s, w) => s + w.tools.length, 0), 0);

                return (
                    <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
                        <button
                            onClick={() => setShowSwarmLogs(!showSwarmLogs)}
                            className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-medium border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg px-2.5 py-1.5 mb-2 w-full justify-between group"
                        >
                            <span className="flex items-center gap-2">
                                <Activity className="w-3.5 h-3.5 opacity-70 group-hover:text-blue-400 transition-colors" />
                                Activity Timeline
                            </span>
                            <span className="flex items-center gap-2">
                                <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded">{completedWorkers}/{workerCount} workers</span>
                                {toolCount > 0 && <span className="text-[10px] bg-purple-500/15 text-purple-400 px-1.5 py-0.5 rounded">{toolCount} tools</span>}
                                {showSwarmLogs ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </span>
                        </button>

                        {showSwarmLogs && (
                            <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {phaseOrder.map((phase, pi) => {
                                    if (selectedPhase !== null && selectedPhase !== pi) return null;
                                    const workers = workersByPhase.get(phase);
                                    if (!workers || workers.length === 0) return null;

                                    const phaseCompleted = workers.every(w => w.result !== null || w.error !== null);
                                    const phaseWorkersDone = workers.filter(w => w.result !== null || w.error !== null).length;
                                    const phaseFailed = workers.filter(w => w.error !== null).length;
                                    const isLastPhase = pi === phaseOrder.length - 1;
                                    const phaseKey = `phase-${pi}`;
                                    const isPhaseExpanded = expandedWorkers[phaseKey] !== undefined
                                        ? expandedWorkers[phaseKey]
                                        : (!phaseCompleted || isLastPhase);

                                    return (
                                        <div key={pi} className="rounded-lg border border-[var(--border-subtle)] overflow-hidden">
                                            <button
                                                onClick={() => setExpandedWorkers(prev => ({ ...prev, [phaseKey]: !isPhaseExpanded }))}
                                                className="flex items-center gap-2 w-full px-3 py-2 bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                            >
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400/80">
                                                    {phase?.replace(/_/g, ' ')}
                                                </span>
                                                <span className="flex items-center gap-1.5 ml-auto">
                                                    <span className="text-[9px] text-[var(--text-tertiary)]">
                                                        {phaseWorkersDone}/{workers.length} workers
                                                    </span>
                                                    {phaseFailed > 0 && (
                                                        <span className="text-[9px] text-red-400">{phaseFailed} failed</span>
                                                    )}
                                                    {phaseCompleted && <Check className="w-3 h-3 text-green-500" />}
                                                    {!phaseCompleted && <Loader className="w-3 h-3 text-blue-400 animate-spin" />}
                                                    {isPhaseExpanded ? <ChevronDown className="w-3 h-3 text-[var(--text-tertiary)]" /> : <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)]" />}
                                                </span>
                                            </button>

                                            {isPhaseExpanded && (
                                                <div className="flex flex-col gap-1 p-1.5 bg-[var(--bg-secondary)]">
                                                    {workers.map((run, wi) => {
                                                        const isDone = run.result !== null;
                                                        const hasError = run.error !== null;
                                                        const isRunning = !isDone && !hasError;
                                                        const isCleanResult = run.result && run.result.replace(/[\s.\-]/g, '').length > 10 && !(/^[\-\.\s\da-f]{5,}$/i.test(run.result.trim()));
                                                        const displayName = run.instanceId
                                                            ? `${run.worker} · ${run.instanceId}`
                                                            : run.worker;

                                                        const duration = run.endTimestamp && run.timestamp
                                                            ? Math.round((new Date(run.endTimestamp) - new Date(run.timestamp)) / 1000)
                                                            : null;

                                                        const workerKey = `${pi}-${wi}`;
                                                        const isExpanded = expandedWorkers[workerKey];
                                                        const borderColor = hasError ? 'border-l-red-500' : isDone ? 'border-l-green-500' : 'border-l-blue-400';

                                                        return (
                                                            <div key={wi} className={`rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] border-l-[3px] ${borderColor} overflow-hidden`}>
                                                                <button
                                                                    onClick={() => setExpandedWorkers(prev => ({ ...prev, [workerKey]: !prev[workerKey] }))}
                                                                    className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left hover:bg-[var(--bg-tertiary)] transition-colors"
                                                                >
                                                                    <span className="text-[11px] font-semibold text-[var(--text-primary)] flex items-center gap-1 truncate">
                                                                        🐝 {displayName}
                                                                    </span>

                                                                    <span className="flex items-center gap-1 ml-auto shrink-0">
                                                                        {run.thinkingSteps?.length > 0 && (
                                                                            <span className="text-[8px] text-purple-400/70">💭 {run.thinkingSteps.length}</span>
                                                                        )}
                                                                        {run.tools.length > 0 && (
                                                                            <span className="text-[8px] text-purple-400/70">{run.tools.length} tool{run.tools.length > 1 ? 's' : ''}</span>
                                                                        )}
                                                                        {duration !== null && (
                                                                            <span className="text-[8px] text-[var(--text-tertiary)] flex items-center gap-0.5">
                                                                                <Clock className="w-2.5 h-2.5" /> {duration}s
                                                                            </span>
                                                                        )}
                                                                        {isDone && <Check className="w-3 h-3 text-green-500" />}
                                                                        {hasError && <span className="text-[9px] text-red-400 font-medium">Failed</span>}
                                                                        {isRunning && <Loader className="w-2.5 h-2.5 text-blue-400 animate-spin" />}
                                                                        {isExpanded ? <ChevronDown className="w-3 h-3 text-[var(--text-tertiary)]" /> : <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)]" />}
                                                                    </span>
                                                                </button>

                                                                {isExpanded && (
                                                                    <div className="px-2.5 pb-2 space-y-1.5 border-t border-[var(--border-subtle)]">
                                                                        {run.thinkingSteps?.length > 0 && (
                                                                            <div className="mt-1.5">
                                                                                <ThinkingStepsPanel steps={run.thinkingSteps} />
                                                                            </div>
                                                                        )}
                                                                        {run.instruction && (
                                                                            <div className="text-[10px] text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded px-2 py-1.5 border-l-2 border-blue-500/40 mt-1.5 leading-relaxed">
                                                                                📋 {run.instruction}
                                                                            </div>
                                                                        )}
                                                                        {run.tools.length > 0 && (
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {run.tools.map((t, j) => {
                                                                                    const fmt = formatToolCall(t.tool, t.args);
                                                                                    return (
                                                                                        <span key={j} className="inline-flex items-center gap-1 text-[9px] bg-yellow-500/10 text-yellow-400/90 border border-yellow-500/20 rounded-full px-1.5 py-0.5">
                                                                                            <span>{fmt.icon}</span>
                                                                                            <span className="font-medium truncate max-w-[180px]">{fmt.text}</span>
                                                                                        </span>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                        {isCleanResult && (
                                                                            <div className="text-[10px] text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded px-2 py-1 border border-[var(--border-subtle)] line-clamp-3">
                                                                                {run.result}
                                                                            </div>
                                                                        )}
                                                                        {run.error && (
                                                                            <div className="text-[10px] text-red-400 bg-red-500/10 rounded px-2 py-1 border border-red-500/20">
                                                                                {run.error}
                                                                            </div>
                                                                        )}
                                                                        <div className="text-[8px] text-[var(--text-tertiary)] text-right">
                                                                            {new Date(run.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ─── Hive Mind ─── */}
            {dr.brain && dr.brain.length > 0 && (() => {
                const filteredBrain = dr.brain.filter(entry => {
                    if (!entry.content || entry.content.length < 20) return false;
                    if (entry.worker?.toLowerCase() === 'orchestrator') return false;
                    const stripped = entry.content.replace(/[\s.\-]/g, '');
                    if (stripped.length < 10) return false;
                    if (/^[\da-f\-]{8,}$/i.test(stripped)) return false;
                    return true;
                });

                if (filteredBrain.length === 0) return null;

                return (
                    <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
                        <button
                            onClick={() => setShowBrain(!showBrain)}
                            className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-medium border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg px-2.5 py-1.5 mb-2 w-full justify-between group"
                        >
                            <span className="flex items-center gap-2">
                                <Brain className="w-3.5 h-3.5 opacity-70 group-hover:text-amber-400 transition-colors" />
                                🐝 Hive Mind
                            </span>
                            <span className="flex items-center gap-2">
                                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">{filteredBrain.length} entries</span>
                                {showBrain ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </span>
                        </button>

                        {showBrain && (
                            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto custom-scrollbar rounded-lg p-2">
                                {filteredBrain.map((entry, i) => {
                                    const isExpanded = expandedBrainEntries[i];
                                    const isLong = entry.content && entry.content.length > 300;
                                    return (
                                        <div key={i} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
                                            <div
                                                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                                                onClick={() => setExpandedBrainEntries(prev => ({ ...prev, [i]: !prev[i] }))}
                                            >
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/20">
                                                    {entry.phase}
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/20">
                                                    {(() => {
                                                        const sameWorkerEntries = filteredBrain.filter(e => e.worker === entry.worker && e.phase === entry.phase);
                                                        if (sameWorkerEntries.length <= 1) return entry.worker;
                                                        const idx = sameWorkerEntries.indexOf(entry) + 1;
                                                        return `${entry.worker} ${idx}`;
                                                    })()}
                                                </span>
                                                <span className="text-[9px] text-[var(--text-tertiary)] ml-auto">
                                                    {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </span>
                                                {isLong && (
                                                    isExpanded ? <ChevronDown className="w-3 h-3 text-[var(--text-tertiary)]" /> : <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)]" />
                                                )}
                                            </div>
                                            <div className={`px-3 pb-2.5 text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed ${!isExpanded && isLong ? 'line-clamp-3' : ''}`}>
                                                {entry.content}
                                            </div>
                                            {!isExpanded && isLong && (
                                                <button
                                                    onClick={() => setExpandedBrainEntries(prev => ({ ...prev, [i]: true }))}
                                                    className="text-[10px] text-amber-400/70 hover:text-amber-400 px-3 pb-2 font-medium"
                                                >
                                                    Show more
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })()}
        </div>
    );
}
