import React from 'react';
import { Plus, Trash2, Copy } from 'lucide-react';

/**
 * Reusable agent list sidebar used in Browser, Terminal, Swarm, and GroupChat managers.
 *
 * @param {string}   title          - Sidebar header title, e.g. "Browser Agents"
 * @param {object[]} agents         - Array of agent objects with { id, name, icon, description, enabled }
 * @param {object}   selected       - Currently selected agent object (or null)
 * @param {boolean}  loading        - Whether the agent list is loading
 * @param {boolean}  isCreating     - Whether a new agent is being created
 * @param {function} onSelect       - Called with agent object when user clicks one
 * @param {function} onCreate       - Called when user clicks the "+" create button
 * @param {function} onDelete       - Called with agent id when user clicks delete
 * @param {function} onDuplicate    - Called with agent object when user clicks duplicate
 * @param {React.ReactNode} typeBadge - Optional badge JSX to show per agent (e.g. <Globe/> Browser)
 * @param {string}   emptyIcon      - Emoji shown when no agents exist (default '🤖')
 * @param {string}   emptyText      - Text shown when no agents exist
 * @param {string}   accentColor    - Accent color class for the type badge (default 'cyan')
 */
export default function AgentSidebar({
    title,
    agents,
    selected,
    loading,
    isCreating,
    onSelect,
    onCreate,
    onDelete,
    onDuplicate,
    typeBadge,
    emptyIcon = '🤖',
    emptyText = 'No agents yet',
    accentColor = 'cyan',
}) {
    return (
        <div className="w-64 border-r flex flex-col flex-shrink-0" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
                <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{title}</span>
                <button
                    onClick={onCreate}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    title={`Create New ${title.replace(/s$/, '')}`}
                    style={{ color: 'var(--accent-primary)' }}
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="p-8 text-center text-muted text-sm">
                        <div className="spinner-sm mx-auto mb-2"></div>
                        Loading...
                    </div>
                ) : agents.length === 0 ? (
                    <div className="p-8 text-center text-muted text-sm flex flex-col items-center">
                        <span className="text-2xl mb-2">{emptyIcon}</span>
                        <p className="mb-3">{emptyText}</p>
                        <button onClick={onCreate} className="btn-primary text-xs py-1.5">
                            Create First Agent
                        </button>
                    </div>
                ) : (
                    <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                        {agents.map(agent => (
                            <div
                                key={agent.id}
                                onClick={() => onSelect(agent)}
                                className={`group p-4 cursor-pointer transition-all hover:bg-white/5 relative border-l-2 ${selected?.id === agent.id && !isCreating ? 'bg-white/5 border-[var(--accent-primary)]' : 'border-transparent'}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{agent.icon || emptyIcon}</span>
                                        <span className={`font-medium text-sm truncate ${selected?.id === agent.id && !isCreating ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`} title={agent.name}>
                                            {agent.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-0.5">
                                        {onDuplicate && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDuplicate(agent); }}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-blue-400 transition-all"
                                                title="Duplicate agent"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDelete(agent.id); }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                                            title="Delete agent"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="text-xs text-muted truncate leading-relaxed">
                                    {agent.description || 'No description'}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    {typeBadge}
                                    {agent.enabled !== undefined && (
                                        agent.enabled ? (
                                            <span className="text-[10px] uppercase tracking-wider font-medium text-emerald-400">● Active</span>
                                        ) : (
                                            <span className="text-[10px] uppercase tracking-wider font-medium text-amber-400">● Disabled</span>
                                        )
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
