import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';

const TOOL_TIERS = [
    { key: 'fast', icon: '⚡', label: 'Fast' },
    { key: 'thinking', icon: '🧠', label: 'Thinking' },
    { key: 'writer', icon: '✍️', label: 'Writer' },
    { key: 'pro', icon: '✨', label: 'Deep Thinking' },
];

const DirectChatConfig = () => {
    const [systemPrompt, setSystemPrompt] = useState('');
    const [tools, setTools] = useState([]);
    const [tierToolConfig, setTierToolConfig] = useState({});
    const tierToolConfigRef = useRef({});
    const [tierToolParams, setTierToolParams] = useState({});
    const tierToolParamsRef = useRef({});
    const [selectedTier, setSelectedTier] = useState('fast');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    // Expandable tool details
    const [expandedTool, setExpandedTool] = useState(null);
    const [toolDetails, setToolDetails] = useState({});
    const [toolParamEdits, setToolParamEdits] = useState({});
    const [savingParams, setSavingParams] = useState(null);

    // Keep refs in sync
    useEffect(() => { tierToolConfigRef.current = tierToolConfig; }, [tierToolConfig]);
    useEffect(() => { tierToolParamsRef.current = tierToolParams; }, [tierToolParams]);

    useEffect(() => {
        (async () => {
            try {
                const [promptRes, toolsRes, tierToolsRes, tierParamsRes] = await Promise.all([
                    authFetch(`${API_BASE}/ai/config/direct-chat`),
                    authFetch(`${API_BASE}/components`),
                    authFetch(`${API_BASE}/ai/config/direct-chat-tools`),
                    authFetch(`${API_BASE}/ai/config/direct-chat-tool-params`)
                ]);
                if (promptRes.ok) {
                    const data = await promptRes.json();
                    setSystemPrompt(data.systemPrompt || '');
                }
                if (toolsRes.ok) {
                    const data = await toolsRes.json();
                    setTools(data || []);
                }
                if (tierToolsRes.ok) {
                    const data = await tierToolsRes.json();
                    setTierToolConfig(data || {});
                    tierToolConfigRef.current = data || {};
                }
                if (tierParamsRes.ok) {
                    const data = await tierParamsRes.json();
                    setTierToolParams(data || {});
                    tierToolParamsRef.current = data || {};
                }
            } catch (e) {
                console.error('Failed to fetch direct chat config:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config/direct-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ systemPrompt })
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'System prompt saved!' });
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

    // Save tier tools config to backend
    const saveTierTools = async (config) => {
        try {
            await authFetch(`${API_BASE}/ai/config/direct-chat-tools`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
        } catch (e) {
            console.error('Failed to save tier tools:', e);
        }
    };

    // Toggle tool for a specific tier
    const toggleTierTool = (tierKey, toolId) => {
        const prev = tierToolConfigRef.current;
        const currentList = prev[tierKey] || [];
        const isEnabled = currentList.includes(toolId);
        const newList = isEnabled
            ? currentList.filter(id => id !== toolId)
            : [...currentList, toolId];
        const newConfig = { ...prev, [tierKey]: newList };
        tierToolConfigRef.current = newConfig;
        setTierToolConfig(newConfig);
        saveTierTools(newConfig);
    };

    // Copy config from current tier to all others
    const copyToAllTiers = () => {
        const prev = tierToolConfigRef.current;
        const currentList = prev[selectedTier] || [];
        const newConfig = {};
        TOOL_TIERS.forEach(t => { newConfig[t.key] = [...currentList]; });
        tierToolConfigRef.current = newConfig;
        setTierToolConfig(newConfig);
        saveTierTools(newConfig);
        setMessage({ type: 'success', text: 'Copied to all tiers!' });
        setTimeout(() => setMessage(null), 2000);
    };

    // Get param values for a tool in a specific tier, falling back to component defaults
    const getEditsForTier = (tierKey, toolId, details) => {
        const tierOverrides = tierToolParamsRef.current[tierKey]?.[toolId] || {};
        const edits = {};
        for (const [key, conf] of Object.entries(details.inputs || {})) {
            if (typeof conf === 'object') {
                edits[key] = tierOverrides[key] !== undefined
                    ? tierOverrides[key]
                    : (conf.default !== undefined ? conf.default : '');
            }
        }
        return edits;
    };

    const expandTool = async (toolId) => {
        if (expandedTool === toolId) {
            setExpandedTool(null);
            return;
        }
        setExpandedTool(toolId);
        if (!toolDetails[toolId]) {
            try {
                const res = await authFetch(`${API_BASE}/components/${toolId}`);
                if (res.ok) {
                    const data = await res.json();
                    setToolDetails(prev => ({ ...prev, [toolId]: data }));
                    setToolParamEdits(prev => ({ ...prev, [toolId]: getEditsForTier(selectedTier, toolId, data) }));
                }
            } catch (e) {
                console.error('Failed to fetch tool details:', e);
            }
        } else {
            // Re-init edits for current tier
            setToolParamEdits(prev => ({ ...prev, [toolId]: getEditsForTier(selectedTier, toolId, toolDetails[toolId]) }));
        }
    };

    // When switching tiers, update edits for the expanded tool
    const handleTierSwitch = (tierKey) => {
        setSelectedTier(tierKey);
        if (expandedTool && toolDetails[expandedTool]) {
            setToolParamEdits(prev => ({ ...prev, [expandedTool]: getEditsForTier(tierKey, expandedTool, toolDetails[expandedTool]) }));
        }
    };

    const saveToolParams = async (toolId) => {
        setSavingParams(toolId);
        try {
            const details = toolDetails[toolId];
            const edits = toolParamEdits[toolId] || {};

            // Build per-tier overrides (non-secure params only)
            const overrides = {};
            let hasSecureChange = false;
            const secureUpdates = {};

            for (const [key, conf] of Object.entries(details.inputs || {})) {
                if (typeof conf !== 'object') continue;
                if (conf.secure) {
                    // Secure params saved globally on the component
                    if (edits[key] && edits[key] !== '') {
                        hasSecureChange = true;
                        secureUpdates[key] = edits[key];
                    }
                } else {
                    // Non-secure params go to per-tier overrides
                    if (edits[key] !== undefined && edits[key] !== '') {
                        overrides[key] = edits[key];
                    }
                }
            }

            // Save per-tier overrides
            const prev = { ...tierToolParamsRef.current };
            if (!prev[selectedTier]) prev[selectedTier] = {};
            prev[selectedTier] = { ...prev[selectedTier], [toolId]: overrides };
            tierToolParamsRef.current = prev;
            setTierToolParams(prev);

            await authFetch(`${API_BASE}/ai/config/direct-chat-tool-params`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(prev)
            });

            // Save secure params globally if changed
            if (hasSecureChange) {
                const updatedInputs = {};
                for (const [key, conf] of Object.entries(details.inputs || {})) {
                    if (typeof conf === 'object') {
                        updatedInputs[key] = { ...conf };
                        if (secureUpdates[key]) {
                            updatedInputs[key].default = secureUpdates[key];
                            delete updatedInputs[key]._hasStoredValue;
                        }
                    } else {
                        updatedInputs[key] = conf;
                    }
                }
                await authFetch(`${API_BASE}/components/${toolId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ inputs: updatedInputs })
                });
            }

            const tierLabel = TOOL_TIERS.find(t => t.key === selectedTier)?.label || selectedTier;
            setMessage({ type: 'success', text: `Parameters saved for ${tierLabel}!` });
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to save parameters' });
        } finally {
            setSavingParams(null);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    if (loading) return <div className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>Loading...</div>;

    const currentTierTools = tierToolConfig[selectedTier] || [];
    const enabledCount = currentTierTools.length;

    return (
        <div className="space-y-6">
            {/* System Prompt Section */}
            <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
                            💬
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Direct Chat Settings</h3>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Configure the system prompt for Direct Chat</p>
                        </div>
                    </div>
                    {message && (
                        <span className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                            {message.text}
                        </span>
                    )}
                </div>

                <div className="space-y-4 max-w-3xl">
                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>System Prompt</label>
                        <textarea
                            value={systemPrompt}
                            onChange={e => setSystemPrompt(e.target.value)}
                            placeholder="You are a helpful AI assistant. Respond thoughtfully and concisely."
                            rows={8}
                            className="w-full px-4 py-3 rounded-lg border outline-none focus:border-[var(--accent-primary)] resize-y font-mono text-sm leading-relaxed"
                            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', minHeight: '120px' }}
                        />
                        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                            This prompt defines the AI personality for Direct Chat. The current date and available tools are appended automatically.
                            Leave empty to use the default.
                        </p>
                    </div>

                    <div className="pt-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2.5 rounded-xl font-medium text-white transition-all disabled:opacity-50"
                            style={{ background: 'var(--accent-primary)' }}
                        >
                            {saving ? 'Saving...' : 'Save System Prompt'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Tools Section - Per Tier */}
            <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
                        🛠️
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Tools per Tier</h3>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            Configure which tools each model tier can use
                        </p>
                    </div>
                    <button
                        onClick={copyToAllTiers}
                        className="text-xs px-3 py-1.5 rounded-lg border hover:bg-white/5 transition-colors"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}
                        title={`Copy "${selectedTier}" tools to all tiers`}
                    >
                        📋 Copy to all tiers
                    </button>
                </div>

                {/* Tier tabs */}
                <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                    {TOOL_TIERS.map(tier => {
                        const isActive = selectedTier === tier.key;
                        const count = (tierToolConfig[tier.key] || []).length;
                        return (
                            <button
                                key={tier.key}
                                onClick={() => handleTierSwitch(tier.key)}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all`}
                                style={{
                                    background: isActive ? 'var(--accent-primary)' : 'transparent',
                                    color: isActive ? '#fff' : 'var(--text-muted)',
                                }}
                            >
                                <span>{tier.icon}</span>
                                <span>{tier.label}</span>
                                {count > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                                        background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(107,114,128,0.2)',
                                    }}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Tool list for selected tier */}
                {tools.length === 0 ? (
                    <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>
                        No tools available. Create components in the Tools tab first.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {tools.map(tool => {
                            const def = tool.definition || {};
                            const enabled = currentTierTools.includes(tool.id);
                            const isExpanded = expandedTool === tool.id;
                            const details = toolDetails[tool.id];
                            const edits = toolParamEdits[tool.id] || {};
                            const inputEntries = details ? Object.entries(details.inputs || {}).filter(([, v]) => typeof v === 'object') : [];

                            return (
                                <div
                                    key={tool.id}
                                    className="rounded-lg border transition-all overflow-hidden"
                                    style={{ background: 'var(--bg-tertiary)', borderColor: enabled ? 'var(--accent-primary)' : 'var(--border-default)' }}
                                >
                                    {/* Tool header row */}
                                    <div className="flex items-center gap-3 px-4 py-2.5">
                                        <button
                                            onClick={() => expandTool(tool.id)}
                                            className="p-0.5 rounded hover:bg-white/10 transition-colors"
                                            style={{ color: 'var(--text-muted)' }}
                                        >
                                            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => expandTool(tool.id)}>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                                    {def.name || tool.id}
                                                </p>
                                                {def.category && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: 'rgba(107, 114, 128, 0.2)', color: 'var(--text-muted)' }}>
                                                        {def.category}
                                                    </span>
                                                )}
                                            </div>
                                            {def.description && (
                                                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                    {def.description}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => toggleTierTool(selectedTier, tool.id)}
                                            className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                                            style={{ background: enabled ? 'var(--accent-primary)' : 'var(--bg-secondary)', border: `1px solid ${enabled ? 'var(--accent-primary)' : 'var(--border-default)'}` }}
                                        >
                                            <span
                                                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow transition-all"
                                                style={{ left: enabled ? '24px' : '4px' }}
                                            />
                                        </button>
                                    </div>

                                    {/* Expanded parameters */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: 'var(--border-default)' }}>
                                            {!details ? (
                                                <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>Loading parameters...</p>
                                            ) : inputEntries.length === 0 ? (
                                                <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>This tool has no configurable parameters.</p>
                                            ) : (
                                                <div className="space-y-3 mt-2">
                                                    {inputEntries.map(([key, conf]) => {
                                                        const isSecure = conf.secure === true;
                                                        const hasStoredValue = conf._hasStoredValue === true;
                                                        const currentValue = edits[key] !== undefined ? edits[key] : '';
                                                        return (
                                                            <div key={key}>
                                                                <label className="flex items-center gap-2 text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                                                                    {key}
                                                                    {conf.required && <span className="text-red-400">*</span>}
                                                                    {isSecure && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                                                                            🔒 secure
                                                                        </span>
                                                                    )}
                                                                </label>
                                                                {conf.description && (
                                                                    <p className="text-[11px] mb-1.5" style={{ color: 'var(--text-muted)' }}>{conf.description}</p>
                                                                )}
                                                                <input
                                                                    type={isSecure ? 'password' : 'text'}
                                                                    value={currentValue}
                                                                    onChange={e => setToolParamEdits(prev => ({
                                                                        ...prev,
                                                                        [tool.id]: { ...(prev[tool.id] || {}), [key]: e.target.value }
                                                                    }))}
                                                                    placeholder={isSecure && hasStoredValue ? '••••••••  (stored)' : conf.default !== undefined ? String(conf.default) : `Enter ${key}...`}
                                                                    className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                                                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                    <div className="pt-2">
                                                        <button
                                                            onClick={() => saveToolParams(tool.id)}
                                                            disabled={savingParams === tool.id}
                                                            className="px-4 py-2 rounded-lg font-medium text-white text-sm transition-all disabled:opacity-50"
                                                            style={{ background: 'var(--accent-primary)' }}
                                                        >
                                                            {savingParams === tool.id ? 'Saving...' : 'Save Parameters'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL COSTS CONFIG
// ═══════════════════════════════════════════════════════════════════════════════


export default DirectChatConfig;
