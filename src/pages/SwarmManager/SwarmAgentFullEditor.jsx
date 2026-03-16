import React, { useState } from 'react';

/**
 * SwarmAgentFullEditor — Rich editor for swarm LLM worker agents
 * Matches the AgentDesigner visual style with tabbed sidebar navigation
 */
function SwarmAgentFullEditor({ data, onChange, availableModels = [] }) {
    const [activeTab, setActiveTab] = useState('identity');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const handleChange = (field, value) => onChange(field, value);

    const tabs = [
        { id: 'identity', label: 'Identity', icon: '🆔' },
        { id: 'prompt', label: 'Instructions', icon: '📝' },
    ];

    const tierCards = [
        { key: 'auto', icon: '🔀', label: 'Auto', desc: 'Smart selection', gradient: 'from-purple-500/20 to-indigo-500/20', border: 'border-purple-500/50', glow: 'shadow-purple-500/20' },
        { key: 'fast', icon: '⚡', label: 'Fast', desc: 'Quick answers', gradient: 'from-emerald-500/20 to-green-500/20', border: 'border-emerald-500/50', glow: 'shadow-emerald-500/20' },
        { key: 'thinking', icon: '🧠', label: 'Thinking', desc: 'Complex problems', gradient: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/50', glow: 'shadow-blue-500/20' },
        { key: 'writer', icon: '✍️', label: 'Writer', desc: 'Long-form content', gradient: 'from-pink-500/20 to-rose-500/20', border: 'border-pink-500/50', glow: 'shadow-pink-500/20' },
        { key: 'pro', icon: '✨', label: 'Pro', desc: 'Max quality', gradient: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/50', glow: 'shadow-amber-500/20' },
    ];

    const currentTier = data?.model ? data.model.replace('tier:', '') : 'auto';

    return (
        <div className="flex h-full">
            {/* Sidebar Navigation */}
            <div className="w-52 border-r flex flex-col py-5 px-3 gap-1" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${activeTab === tab.id
                            ? 'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-primary-hover,var(--accent-primary))] text-white shadow-lg shadow-[var(--accent-primary)]/20'
                            : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                            }`}
                    >
                        <span className="text-base">{tab.icon}</span>
                        <span className="flex-1">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-3xl mx-auto">

                    {/* IDENTITY TAB */}
                    {activeTab === 'identity' && (
                        <div className="space-y-8 animate-fadeIn">
                            {/* Hero — Avatar + Name + Role inline */}
                            <div className="flex items-start gap-5">
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        className="w-20 h-20 text-3xl rounded-2xl border-2 bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-secondary)] flex items-center justify-center hover:border-[var(--accent-primary)] hover:shadow-lg hover:shadow-[var(--accent-primary)]/10 transition-all"
                                        style={{ borderColor: 'var(--border-default)' }}
                                    >
                                        {data?.avatar || '🤖'}
                                    </button>
                                    <span className="absolute -bottom-1 -right-1 text-[9px] bg-[var(--bg-secondary)] border border-[var(--border-default)] px-1.5 py-0.5 rounded-md text-[var(--text-muted)]">edit</span>
                                    {showEmojiPicker && (
                                        <div className="absolute top-full left-0 mt-2 p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-2xl z-50 w-64">
                                            <div className="grid grid-cols-6 gap-1">
                                                {['🤖', '🧠', '💡', '🔧', '📊', '📝', '🔍', '🎯', '⚡', '🚀', '💻', '📱', '🌐', '🔐', '📈', '🎨', '🛠️', '📧', '💬', '🗂️', '📅', '⏰', '🔔', '✅'].map(emoji => (
                                                    <button
                                                        key={emoji}
                                                        onClick={() => { handleChange('avatar', emoji); setShowEmojiPicker(false); }}
                                                        className="aspect-square flex items-center justify-center rounded-lg hover:bg-white/10 text-lg transition-colors"
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[11px] font-medium text-[var(--text-muted)] mb-1.5 block">Agent Name</label>
                                            <input
                                                type="text"
                                                value={data?.name || ''}
                                                onChange={e => handleChange('name', e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl border bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none text-sm transition-colors"
                                                style={{ borderColor: 'var(--border-default)' }}
                                                placeholder="e.g. Research Agent"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-medium text-[var(--text-muted)] mb-1.5 block">Role key</label>
                                            <input
                                                type="text"
                                                value={data?.role || ''}
                                                onChange={e => handleChange('role', e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl border bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none text-sm font-mono transition-colors"
                                                style={{ borderColor: 'var(--border-default)' }}
                                                placeholder="e.g. researcher"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <input
                                            type="text"
                                            value={data?.description || ''}
                                            onChange={e => handleChange('description', e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border bg-[var(--bg-tertiary)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] outline-none text-sm transition-colors"
                                            style={{ borderColor: 'var(--border-default)' }}
                                            placeholder="Short description of what this agent does..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="border-t" style={{ borderColor: 'var(--border-subtle)' }} />

                            {/* AI Model - Tier Cards */}
                            <div>
                                <label className="text-[11px] font-medium text-[var(--text-muted)] mb-3 block">AI Model</label>
                                <div className="grid grid-cols-4 gap-3">
                                    {tierCards.map(tier => {
                                        const isSelected = currentTier === tier.key;
                                        return (
                                            <button
                                                key={tier.key}
                                                type="button"
                                                onClick={() => handleChange('model', `tier:${tier.key}`)}
                                                className={`relative p-4 rounded-xl border-2 text-center transition-all duration-200 cursor-pointer group ${isSelected
                                                    ? `bg-gradient-to-b ${tier.gradient} ${tier.border} shadow-lg ${tier.glow}`
                                                    : 'border-[var(--border-default)] bg-[var(--bg-tertiary)] hover:border-[var(--border-default)] hover:bg-white/[0.03]'
                                                    }`}
                                            >
                                                <span className={`text-2xl block mb-1.5 transition-transform duration-200 ${isSelected ? 'scale-110' : 'group-hover:scale-105'}`}>{tier.icon}</span>
                                                <span className={`text-sm font-semibold block ${isSelected ? 'text-white' : 'text-[var(--text-primary)]'}`}>{tier.label}</span>
                                                <span className={`text-[10px] block mt-0.5 ${isSelected ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>{tier.desc}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Parameters — compact row */}
                            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-[11px] font-medium text-[var(--text-muted)] mb-1.5 block">Temperature</label>
                                        <input
                                            type="number"
                                            min="0" max="2" step="0.1"
                                            value={data?.temperature ?? 0.3}
                                            onChange={e => handleChange('temperature', parseFloat(e.target.value))}
                                            className="w-full px-3 py-2 rounded-lg border bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--accent-primary)] transition-colors"
                                            style={{ borderColor: 'var(--border-default)' }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-medium text-[var(--text-muted)] mb-1.5 block">Max Tokens</label>
                                        <input
                                            type="number" step="100"
                                            value={data?.maxTokens ?? 2000}
                                            onChange={e => handleChange('maxTokens', parseInt(e.target.value))}
                                            className="w-full px-3 py-2 rounded-lg border bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--accent-primary)] transition-colors"
                                            style={{ borderColor: 'var(--border-default)' }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-medium text-[var(--text-muted)] mb-1.5 block">🐝 Hive Mind</label>
                                        <select
                                            value={data?.hiveMindAccess || 'readwrite'}
                                            onChange={e => handleChange('hiveMindAccess', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--accent-primary)] transition-colors"
                                            style={{ borderColor: 'var(--border-default)' }}
                                        >
                                            <option value="readwrite">Read & Write</option>
                                            <option value="read">Read Only</option>
                                            <option value="write">Write Only</option>
                                            <option value="none">None</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PROMPT TAB */}
                    {activeTab === 'prompt' && (
                        <div className="space-y-4 animate-fadeIn">
                            <div>
                                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>System Prompt</h2>
                                <p className="text-sm text-[var(--text-secondary)] mt-1">Define personality and rules for this agent.</p>
                            </div>
                            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
                                <textarea
                                    value={data?.systemPrompt || data?.system_prompt || ''}
                                    onChange={e => handleChange('systemPrompt', e.target.value)}
                                    className="w-full px-5 py-4 bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-mono text-[13px] leading-relaxed focus:outline-none resize-y min-h-[400px]"
                                    style={{ minHeight: '400px' }}
                                    placeholder="You are a helpful AI assistant..."
                                />
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}

export default SwarmAgentFullEditor;
