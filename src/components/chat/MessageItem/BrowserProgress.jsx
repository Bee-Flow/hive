import React from 'react';
import { Check, ChevronDown, ChevronRight, Loader, Globe } from 'lucide-react';

export default function BrowserProgress({
    msg,
    showBrowserActions, setShowBrowserActions,
    selectedBrowserAgent, setSelectedBrowserAgent,
    setLightboxImage,
    selectedPhase,
}) {
    const ba = msg.browserActivity;
    if (!ba?.browserAgents) return null;

    let agentKeys = Object.keys(ba.browserAgents);
    if (agentKeys.length === 0) return null;

    // Filter browser agents by selected phase (from the phase stepper)
    if (selectedPhase !== null && msg.swarmActivity?.logs) {
        const dr = msg.swarmActivity;
        const phaseOrder = [];
        const workersByPhase = new Map();
        dr.logs.forEach(log => {
            if (log.type === 'phase' && !workersByPhase.has(log.phase)) {
                workersByPhase.set(log.phase, new Set());
                phaseOrder.push(log.phase);
            } else if (log.type === 'worker_start') {
                const phase = log.phase || 'Unknown';
                if (!workersByPhase.has(phase)) {
                    workersByPhase.set(phase, new Set());
                    phaseOrder.push(phase);
                }
                workersByPhase.get(phase).add(log.worker);
            }
        });

        const selectedPhaseName = phaseOrder[selectedPhase];
        if (selectedPhaseName) {
            const phaseWorkers = workersByPhase.get(selectedPhaseName) || new Set();
            agentKeys = agentKeys.filter(key => {
                const agentWorker = ba.browserAgents[key].worker;
                return phaseWorkers.has(agentWorker);
            });
            if (agentKeys.length === 0) return null;
        }
    }

    // Auto-select first agent if none selected or selected no longer exists
    const activeKey = (selectedBrowserAgent && ba.browserAgents[selectedBrowserAgent])
        ? selectedBrowserAgent
        : agentKeys[agentKeys.length - 1];

    const agent = ba.browserAgents[activeKey];
    if (!agent) return null;
    const isComplete = agent.status === 'complete';
    const actions = agent.actions || [];
    const latestAction = actions[actions.length - 1];
    const isMultiAgent = agentKeys.length > 1;

    const allComplete = agentKeys.every(k => ba.browserAgents[k].status === 'complete');

    const actionIcons = {
        navigate: '🌐',
        click: '👆',
        type: '⌨️',
        scroll: '📜',
        extract: '📋',
        observe: '👁️',
        screenshot: '📸',
        wait: '⏳',
        go_back: '⬅️',
        done: '✅',
        max_actions_reached: '⚠️',
        press_key: '⌨️'
    };

    return (
        <div className="mb-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                <Globe className="w-4 h-4 animate-pulse" />
                <span>Browser Activity</span>
                {!allComplete && (
                    <Loader className="w-3 h-3 animate-spin ml-auto" />
                )}
                {allComplete && (
                    <Check className="w-3.5 h-3.5 text-green-500 ml-auto" />
                )}
            </div>

            {/* Agent Tab Switcher (only for multi-agent swarms) */}
            {isMultiAgent && (
                <div className="flex gap-1 overflow-x-auto pb-1">
                    {agentKeys.map(key => {
                        const a = ba.browserAgents[key];
                        const isSelected = key === activeKey;
                        const isDone = a.status === 'complete';
                        return (
                            <button
                                key={key}
                                onClick={() => setSelectedBrowserAgent(key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${isSelected
                                    ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                                    : 'bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)]'
                                    }`}
                            >
                                {!isDone ? (
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                                ) : (
                                    <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                                )}
                                <span>🌐 {a.worker || key}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Progress Bar */}
            {latestAction && latestAction.maxSteps && (
                <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (latestAction.step / latestAction.maxSteps) * 100)}%` }}
                    />
                </div>
            )}

            {/* Current Action */}
            {latestAction && !isComplete && (
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-cyan-500/5 border border-cyan-500/20 rounded-lg px-3 py-2">
                    <span className="text-base">{actionIcons[latestAction.action] || '⚙️'}</span>
                    <span className="font-medium text-cyan-400 capitalize">{latestAction.action}</span>
                    {latestAction.params?.url && (
                        <span className="text-[var(--text-tertiary)] truncate max-w-[300px]">{latestAction.params.url}</span>
                    )}
                    {latestAction.params?.selector && (
                        <span className="font-mono text-[10px] text-[var(--text-tertiary)] truncate max-w-[200px]">{latestAction.params.selector}</span>
                    )}
                    {latestAction.params?.text && (
                        <span className="text-[var(--text-tertiary)] truncate max-w-[200px]">"{latestAction.params.text}"</span>
                    )}
                    <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">Step {latestAction.step}/{latestAction.maxSteps}</span>
                </div>
            )}

            {/* Live Browser Feed */}
            {agent.screenshot && (
                <div className={`rounded-lg overflow-hidden border shadow-lg relative ${!isComplete ? 'border-cyan-500/40' : 'border-[var(--border-subtle)]'}`}>
                    <div className="absolute top-2 right-2 z-10">
                        {!isComplete ? (
                            <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold tracking-wider">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-red-400">LIVE</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold tracking-wider text-green-400">
                                <Check className="w-3 h-3" />
                                DONE
                            </div>
                        )}
                    </div>
                    {isMultiAgent && (
                        <div className="absolute top-2 left-2 z-10">
                            <div className="flex items-center gap-1 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold tracking-wider text-cyan-400">
                                🌐 {agent.worker || activeKey}
                            </div>
                        </div>
                    )}
                    <img
                        src={`data:image/jpeg;base64,${agent.screenshot}`}
                        alt="Browser live feed"
                        className="w-full max-h-[400px] object-contain bg-neutral-900"
                        style={{ imageRendering: 'auto' }}
                    />
                </div>
            )}

            {/* Completion */}
            {isComplete && (
                <div className="text-xs text-green-500 flex items-center gap-2 font-medium">
                    <Check className="w-3 h-3" />
                    <span>{isMultiAgent ? `${agent.worker || activeKey}: ` : ''}Browser task completed ({actions.length} action{actions.length !== 1 ? 's' : ''})</span>
                </div>
            )}

            {/* Action Log */}
            {actions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
                    <button
                        onClick={() => setShowBrowserActions(!showBrowserActions)}
                        className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-medium border border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg px-2.5 py-1.5 mb-2 w-full justify-between group"
                    >
                        <span className="flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 opacity-70 group-hover:text-cyan-400 transition-colors" />
                            Action Log
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="text-[10px] bg-cyan-500/15 text-cyan-400 px-1.5 py-0.5 rounded">{actions.length} actions</span>
                            {showBrowserActions ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </span>
                    </button>

                    {showBrowserActions && (
                        <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {actions.map((act, i) => (
                                <div key={i} className={`rounded-lg border p-2.5 ${act.action === 'done' ? 'border-green-500/30 bg-green-500/5' : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)]'}`}>
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-sm">{actionIcons[act.action] || '⚙️'}</span>
                                        <span className="font-medium text-[var(--text-primary)] capitalize">{act.action}</span>
                                        <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">
                                            Step {act.step}/{act.maxSteps}
                                        </span>
                                    </div>
                                    {act.params && Object.keys(act.params).length > 0 && (
                                        <div className="text-[10px] text-[var(--text-tertiary)] mt-1 truncate">
                                            {(() => {
                                                const p = act.params;
                                                const a = act.action;
                                                if (a === 'navigate' && p.url) return p.url;
                                                if (a === 'click' && (p.elementId || p.selector)) return `Element: ${p.elementId || p.selector}`;
                                                if (a === 'type' && p.text) return `"${p.text}"${p.elementId ? ` → ${p.elementId}` : ''}`;
                                                if (a === 'press_key' && p.key) return `Key: ${p.key}`;
                                                if (a === 'scroll') return p.direction || 'down';
                                                if (a === 'extract' && p.selector) return p.selector;
                                                if (a === 'wait') return `${p.ms || p.timeout || ''}ms`;
                                                return Object.entries(p).map(([k, v]) => `${k}: ${typeof v === 'string' ? v.slice(0, 50) : v}`).join(' · ');
                                            })()}
                                        </div>
                                    )}
                                    {act.result && (
                                        <div className="text-[11px] text-[var(--text-secondary)] mt-1 line-clamp-2">{act.result}</div>
                                    )}
                                    {act.screenshot && (
                                        <div className="mt-2 rounded-lg overflow-hidden border border-[var(--border-subtle)]">
                                            <img
                                                src={`data:image/jpeg;base64,${act.screenshot}`}
                                                alt="Annotated page screenshot"
                                                className="w-full max-h-[300px] object-contain bg-neutral-900"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
