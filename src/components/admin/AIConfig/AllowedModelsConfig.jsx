import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';

const AGENT_TYPES = [
    { key: 'chat', label: 'Chat Agents', icon: '💬', color: '#8b5cf6', desc: 'Standard conversational agents (AgentDesigner)' },
    { key: 'browser', label: 'Browser Agents', icon: '🌐', color: '#06b6d4', desc: 'Web automation agents that control a browser' },
    { key: 'terminal', label: 'Terminal Agents', icon: '💻', color: '#10b981', desc: 'Shell and Python execution agents' },
    { key: 'swarm', label: 'Swarm Pipeline', icon: '🐝', color: '#f59e0b', desc: 'Multi-agent orchestration workers' },
];

const AllowedModelsConfig = ({ providers, allModels, fetchAllModels }) => {
    const [allowedConfig, setAllowedConfig] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [expandedType, setExpandedType] = useState(null);

    // Use all models (no filtering — hidden models feature removed)

    useEffect(() => {
        fetchConfig();
        if (allModels.length === 0 && providers.length > 0) {
            fetchAllModels();
        }
    }, [providers]);

    const fetchConfig = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config`);
            if (res.ok) {
                const data = await res.json();
                setAllowedConfig(data.allowedModelsByAgentType || {});
            }
        } catch (e) {
            console.error('Failed to fetch allowed models config:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (agentType, modelId) => {
        setAllowedConfig(prev => {
            const current = prev[agentType] || [];
            // Clean current: remove __none__ sentinel for real checks
            const cleaned = current.filter(id => id !== '__none__');
            const isAllowed = cleaned.length === 0 || cleaned.includes(modelId);

            let next;
            if (cleaned.length === 0 && current.length > 0) {
                // Was "deselect all" (__none__ only) — user re-checked one model
                next = [modelId];
            } else if (cleaned.length === 0) {
                // First toggle from unrestricted: start from all models and remove this one
                next = allModels.map(m => m.id).filter(id => id !== modelId);
            } else if (isAllowed) {
                next = cleaned.filter(id => id !== modelId);
                if (next.length === 0) next = []; // all removed = unrestricted
            } else {
                next = [...cleaned, modelId];
            }
            return { ...prev, [agentType]: next };
        });
    };

    const handleSelectAll = (agentType) => {
        setAllowedConfig(prev => ({ ...prev, [agentType]: [] })); // empty = all allowed
    };

    const handleDeselectAll = (agentType) => {
        setAllowedConfig(prev => ({ ...prev, [agentType]: ['__none__'] })); // sentinel to block all
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ allowedModelsByAgentType: allowedConfig })
            });
            if (res.ok) {
                // Invalidate the cache so agent managers pick up new config
                const { invalidateAllowedModelsCache } = await import('../../../utils/modelMeta.js');
                invalidateAllowedModelsCache();
                setMessage({ type: 'success', text: 'Agent model restrictions saved!' });
            } else {
                setMessage({ type: 'error', text: 'Failed to save' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to save' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const isAllowed = (agentType, modelId) => {
        const list = allowedConfig[agentType];
        if (!list || list.length === 0) return true; // empty = all allowed
        return list.includes(modelId);
    };

    const getAllowedCount = (agentType) => {
        const list = allowedConfig[agentType];
        if (!list || list.length === 0) return allModels.length;
        return allModels.filter(m => list.includes(m.id)).length;
    };

    if (loading) return <div className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>Loading settings...</div>;

    return (
        <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>
                        🛡️
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Agent Model Access</h3>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Control which models each agent type can use</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {message && (
                        <span className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                            {message.text}
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2.5 rounded-xl font-medium text-white transition-all disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                When no models are restricted for an agent type, all visible models are available. Restricting models here filters the model dropdown in each agent manager.
            </p>

            {allModels.length === 0 ? (
                <div className="p-8 text-center rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No models available. Make sure you have a provider configured and models are loaded.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {AGENT_TYPES.map(({ key, label, icon, color, desc }) => {
                        const isExpanded = expandedType === key;
                        const count = getAllowedCount(key);
                        const isRestricted = (allowedConfig[key] || []).length > 0;
                        return (
                            <div key={key} className="rounded-xl border overflow-hidden" style={{ borderColor: isExpanded ? color + '60' : 'var(--border-default)', background: 'var(--bg-primary)' }}>
                                <button
                                    onClick={() => setExpandedType(isExpanded ? null : key)}
                                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-all"
                                >
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: color + '20' }}>
                                        {icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{label}</div>
                                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${isRestricted ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>
                                            {isRestricted ? `${count}/${allModels.length} models` : 'All models'}
                                        </span>
                                        <span className="text-sm" style={{ color: 'var(--text-muted)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <button
                                                onClick={() => handleSelectAll(key)}
                                                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:bg-white/10"
                                                style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}
                                            >
                                                Select All
                                            </button>
                                            <button
                                                onClick={() => handleDeselectAll(key)}
                                                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:bg-white/10"
                                                style={{ color: 'var(--text-secondary)', background: 'var(--bg-tertiary)' }}
                                            >
                                                Deselect All
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {allModels.map(m => {
                                                const allowed = isAllowed(key, m.id);
                                                const meta = MISTRAL_MODEL_META[m.id];
                                                const displayName = meta?.name || m.id;
                                                const category = meta?.cat || '';
                                                return (
                                                    <label
                                                        key={m.id}
                                                        className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-white/5"
                                                        style={{
                                                            background: allowed ? 'var(--bg-tertiary)' : 'transparent',
                                                            border: '1px solid',
                                                            borderColor: allowed ? color + '40' : 'var(--border-subtle)',
                                                            opacity: allowed ? 1 : 0.5
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={allowed}
                                                            onChange={() => handleToggle(key, m.id)}
                                                            className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                                                            style={{ accentColor: color }}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{displayName}</div>
                                                            <div className="text-[10px] flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                                                <span className="font-mono">{m.id}</span>
                                                                {category && <span className="px-1.5 py-0.5 rounded" style={{ background: color + '15', color: color }}>{category}</span>}
                                                            </div>
                                                        </div>
                                                    </label>
                                                );
                                            })}
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
};

// ═══════════════════════════════════════════════════════════════════════════════
// DIRECT CHAT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════


export default AllowedModelsConfig;
