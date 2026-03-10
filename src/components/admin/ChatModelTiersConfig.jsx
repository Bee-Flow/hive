import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';

// Convert a model ID into a human-readable display name
const formatModelId = (id) => {
    if (!id) return id;
    // Strip date suffixes like -20251101 or -2411
    let name = id.replace(/-\d{6,8}$/, '').replace(/-\d{4}$/, '');
    // Split on hyphens, capitalize each part
    return name.split('-').map(part => {
        if (/^\d/.test(part)) return part; // Keep version numbers as-is
        return part.charAt(0).toUpperCase() + part.slice(1);
    }).join(' ');
};

// Reuse model metadata from AIConfigPanel
const getModelMeta = (id) => {
    const meta = MODEL_META[id];
    if (meta) return meta;
    const prefixes = Object.keys(MODEL_META).sort((a, b) => b.length - a.length);
    for (const prefix of prefixes) {
        if (id.startsWith(prefix.replace(/-latest$/, '').replace(/-\d{4}$/, ''))) {
            return MODEL_META[prefix];
        }
    }
    return null;
};

// Get the best display name for a model, using multiple fallbacks
const getDisplayName = (model) => {
    const meta = getModelMeta(model.id);
    if (meta?.name) return meta.name;
    // Use server-provided name if it differs from the raw ID
    if (model.name && model.name !== model.id) return model.name;
    // Auto-format from ID as a last resort
    return formatModelId(model.id);
};

// Detect models that support OpenAI reasoning settings
const isReasoningCapable = (modelId) => {
    if (!modelId) return false;
    if (/^o\d/.test(modelId)) return true;                       // o1, o3, o4-mini, etc.
    if (/^gpt-5/.test(modelId)) return true;                     // GPT-5 family
    if (/^claude-(opus|sonnet|haiku)-4/.test(modelId)) return true;    // Claude 4.x
    return false;
};

// Detect Claude models specifically (they use budget_tokens, not reasoning_effort)
const isClaudeReasoning = (modelId) => {
    if (!modelId) return false;
    return /^claude-(opus|sonnet|haiku)-4/.test(modelId);
};

const MODEL_META = {
    // Mistral
    'mistral-large-latest': { name: 'Mistral Large 3', cat: 'Generalist' },
    'mistral-medium-latest': { name: 'Mistral Medium 3.1', cat: 'Generalist' },
    'mistral-small-latest': { name: 'Mistral Small 3.2', cat: 'Generalist' },
    'ministral-8b-latest': { name: 'Ministral 3 8B', cat: 'Generalist' },
    'ministral-3b-latest': { name: 'Ministral 3 3B', cat: 'Generalist' },
    'magistral-medium-latest': { name: 'Magistral Medium 1.2', cat: 'Reasoning' },
    'magistral-small-latest': { name: 'Magistral Small 1.2', cat: 'Reasoning' },
    'codestral-latest': { name: 'Codestral', cat: 'Coding' },
    'devstral-latest': { name: 'Devstral 2', cat: 'Coding' },
    'devstral-small-latest': { name: 'Devstral Small 2', cat: 'Coding' },
    'pixtral-large-latest': { name: 'Pixtral Large', cat: 'Vision' },
    // OpenAI
    'gpt-5.2': { name: 'GPT-5.2', cat: 'Generalist' },
    'gpt-5.2-pro': { name: 'GPT-5.2 Pro', cat: 'Reasoning' },
    'gpt-5-mini': { name: 'GPT-5 Mini', cat: 'Generalist' },
    'gpt-4o': { name: 'GPT-4o', cat: 'Generalist' },
    'gpt-4o-mini': { name: 'GPT-4o Mini', cat: 'Generalist' },
    'gpt-4.1': { name: 'GPT-4.1', cat: 'Generalist' },
    'gpt-4.1-mini': { name: 'GPT-4.1 Mini', cat: 'Generalist' },
    'gpt-4.1-nano': { name: 'GPT-4.1 Nano', cat: 'Generalist' },
    'o3': { name: 'o3', cat: 'Reasoning' },
    'o3-mini': { name: 'o3 Mini', cat: 'Reasoning' },
    'o4-mini': { name: 'o4 Mini', cat: 'Reasoning' },
};

const TIERS = [
    { key: 'fast', icon: '⚡', label: 'Fast', desc: 'Quick responses for simple questions' },
    { key: 'thinking', icon: '🧠', label: 'Thinking', desc: 'Complex reasoning and analysis' },
    { key: 'writer', icon: '✍️', label: 'Writer', desc: 'Long-form content and reports' },
    { key: 'pro', icon: '✨', label: 'Deep Thinking', desc: 'Maximum quality output' }
];

const TIER_DEFAULTS = {
    fast: { maxTokens: 8192, temperature: 0.7 },
    thinking: { maxTokens: 40960, temperature: 0.7 },
    writer: { maxTokens: 16384, temperature: 0.7 },
    pro: { maxTokens: 40960, temperature: 0.7 },
};


/** Searchable model selector — full-screen overlay with filters */
const SearchableModelSelect = ({ value, label, groups, getModelMeta, onChange }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [activeProvider, setActiveProvider] = useState(null);   // null = all
    const [activeFamily, setActiveFamily] = useState(null);       // null = all
    const inputRef = useRef(null);

    // Focus search input when opening
    useEffect(() => {
        if (open && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open]);

    // Detect model family from ID
    const getFamily = (modelId) => {
        if (/^gpt-5/.test(modelId)) return 'GPT-5';
        if (/^gpt-4\.1/.test(modelId)) return 'GPT-4.1';
        if (/^gpt-4o/.test(modelId)) return 'GPT-4o';
        if (/^gpt-4/.test(modelId)) return 'GPT-4';
        if (/^o\d/.test(modelId)) return 'o-series';
        if (/^mistral-large/.test(modelId)) return 'Mistral Large';
        if (/^mistral-medium/.test(modelId)) return 'Mistral Medium';
        if (/^mistral-small/.test(modelId)) return 'Mistral Small';
        if (/^magistral/.test(modelId)) return 'Magistral';
        if (/^codestral/.test(modelId)) return 'Codestral';
        if (/^devstral/.test(modelId)) return 'Devstral';
        if (/^pixtral/.test(modelId)) return 'Pixtral';
        if (/^ministral/.test(modelId)) return 'Ministral';
        if (/^mistral/.test(modelId)) return 'Mistral Other';
        return 'Other';
    };

    // Build provider list and family list from all models
    const providerNames = Object.keys(groups);
    const allFamilies = new Set();
    Object.values(groups).flat().forEach(m => allFamilies.add(getFamily(m.id)));
    const familyList = [...allFamilies].sort();

    // Filter models by search + provider + family
    const lowerSearch = search.toLowerCase();
    const filteredGroups = {};
    Object.entries(groups).forEach(([provName, models]) => {
        // Provider filter
        if (activeProvider && provName !== activeProvider) return;
        const filtered = models.filter(m => {
            // Family filter
            if (activeFamily && getFamily(m.id) !== activeFamily) return false;
            // Text search
            if (!lowerSearch) return true;
            const meta = getModelMeta(m.id);
            const name = meta?.name || '';
            const cat = meta?.cat || '';
            return m.id.toLowerCase().includes(lowerSearch)
                || name.toLowerCase().includes(lowerSearch)
                || cat.toLowerCase().includes(lowerSearch);
        });
        if (filtered.length > 0) filteredGroups[provName] = filtered;
    });
    const totalResults = Object.values(filteredGroups).reduce((s, a) => s + a.length, 0);

    return (
        <>
            {/* Trigger button */}
            <button
                type="button"
                onClick={() => { setOpen(true); setSearch(''); setActiveProvider(null); setActiveFamily(null); }}
                className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm text-left flex items-center justify-between transition-colors hover:border-[var(--accent-primary)]"
                style={{
                    background: 'var(--bg-secondary)',
                    borderColor: 'var(--border-default)',
                    color: value ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
            >
                <span className="truncate">{label}</span>
                <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Overlay modal */}
            {open && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
                >
                    <div
                        className="w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', maxHeight: '80vh' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pt-5 pb-3">
                            <div>
                                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Select Model</h3>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    {totalResults} model{totalResults !== 1 ? 's' : ''}{search ? ` matching "${search}"` : ' available'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Search input */}
                        <div className="px-5 pb-3">
                            <div className="relative">
                                <svg className="absolute left-3 top-3 w-5 h-5" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search by name, ID, or category..."
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none text-sm"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                />
                            </div>
                        </div>

                        {/* Filter chips */}
                        <div className="px-5 pb-3 space-y-2">
                            {/* Provider filter */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-semibold uppercase tracking-wider mr-1" style={{ color: 'var(--text-muted)' }}>Provider</span>
                                <button
                                    type="button"
                                    onClick={() => setActiveProvider(null)}
                                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                    style={{
                                        background: !activeProvider ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                        color: !activeProvider ? '#fff' : 'var(--text-muted)',
                                    }}
                                >All</button>
                                {providerNames.map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setActiveProvider(activeProvider === p ? null : p)}
                                        className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                        style={{
                                            background: activeProvider === p ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                            color: activeProvider === p ? '#fff' : 'var(--text-muted)',
                                        }}
                                    >{p}</button>
                                ))}
                            </div>
                            {/* Family filter */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-semibold uppercase tracking-wider mr-1" style={{ color: 'var(--text-muted)' }}>Family</span>
                                <button
                                    type="button"
                                    onClick={() => setActiveFamily(null)}
                                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                    style={{
                                        background: !activeFamily ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                        color: !activeFamily ? '#fff' : 'var(--text-muted)',
                                    }}
                                >All</button>
                                {familyList.map(f => (
                                    <button
                                        key={f}
                                        type="button"
                                        onClick={() => setActiveFamily(activeFamily === f ? null : f)}
                                        className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                        style={{
                                            background: activeFamily === f ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                            color: activeFamily === f ? '#fff' : 'var(--text-muted)',
                                        }}
                                    >{f}</button>
                                ))}
                            </div>
                        </div>

                        {/* Model list */}
                        <div className="flex-1 overflow-y-auto px-2 pb-4" style={{ minHeight: 0 }}>
                            {/* Clear option */}
                            <button
                                type="button"
                                onClick={() => { onChange(''); setOpen(false); }}
                                className="w-full text-left px-4 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors mb-1"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                — Not configured —
                            </button>

                            {Object.entries(filteredGroups).map(([provName, models]) => (
                                <div key={provName} className="mb-2">
                                    {/* Provider header */}
                                    <div
                                        className="sticky top-0 z-10 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg mb-1"
                                        style={{ background: 'var(--bg-secondary)', color: 'var(--accent-primary)' }}
                                    >
                                        {provName} ({models.length})
                                    </div>
                                    <div className="grid gap-0.5">
                                        {models.map(m => {
                                            const meta = getModelMeta(m.id);
                                            const displayName = getDisplayName(m);
                                            const isSelected = m.id === value;
                                            return (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => { onChange(m.id); setOpen(false); }}
                                                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm flex items-center gap-3 transition-all ${isSelected
                                                        ? 'ring-1 ring-[var(--accent-primary)]'
                                                        : 'hover:bg-white/5'
                                                        }`}
                                                    style={{
                                                        background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                                        color: 'var(--text-primary)',
                                                    }}
                                                >
                                                    {/* Checkmark */}
                                                    <span className="w-5 text-center shrink-0" style={{ color: 'var(--accent-primary)' }}>
                                                        {isSelected ? '✓' : ''}
                                                    </span>
                                                    {/* Model info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium">{displayName}</div>
                                                        {displayName !== m.id && (
                                                            <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{m.id}</div>
                                                        )}
                                                    </div>
                                                    {/* Category badge */}
                                                    {meta?.cat && (
                                                        <span
                                                            className="text-[10px] px-2 py-1 rounded-full shrink-0 font-medium"
                                                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                                                        >
                                                            {meta.cat}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {totalResults === 0 && (
                                <div className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                                    <p className="text-lg mb-1">No models found</p>
                                    <p className="text-sm">Try a different search term</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const ChatModelTiersConfig = ({ allModels = [] }) => {
    const [config, setConfig] = useState({
        fast: { modelId: '', label: 'Fast' },
        thinking: { modelId: '', label: 'Thinking' },
        writer: { modelId: '', label: 'Writer' },
        pro: { modelId: '', label: 'Deep Thinking' }
    });
    const [euConfig, setEuConfig] = useState({
        fast: { modelId: '', label: 'Fast' },
        thinking: { modelId: '', label: 'Thinking' },
        writer: { modelId: '', label: 'Writer' },
        pro: { modelId: '', label: 'Deep Thinking' }
    });
    const [saving, setSaving] = useState(false);
    const [euSaving, setEuSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [euMessage, setEuMessage] = useState(null);
    const [expandedTier, setExpandedTier] = useState(null);

    useEffect(() => {
        loadConfig();
        loadEuConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/chat-models`);
            if (res.ok) setConfig(await res.json());
        } catch (e) { console.error('Failed to load chat model tiers:', e); }
    };

    const loadEuConfig = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/chat-models-eu`);
            if (res.ok) setEuConfig(await res.json());
        } catch (e) { console.error('Failed to load EU chat model tiers:', e); }
    };

    const save = async () => {
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config/chat-models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Chat model tiers saved!' });
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: 'error', text: 'Failed to save' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to save tier config' });
        }
        setSaving(false);
    };

    const saveEu = async () => {
        setEuSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config/chat-models-eu`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(euConfig)
            });
            if (res.ok) {
                setEuMessage({ type: 'success', text: 'EU model tiers saved!' });
                setTimeout(() => setEuMessage(null), 3000);
            } else {
                setEuMessage({ type: 'error', text: 'Failed to save' });
            }
        } catch (e) {
            setEuMessage({ type: 'error', text: 'Failed to save EU tier config' });
        }
        setEuSaving(false);
    };

    // Filter to only chat-compatible models
    const chatModels = allModels.filter(m => {
        const meta = getModelMeta(m.id);
        if (!meta) return true; // Unknown models are shown
        return !['Embedding', 'OCR', 'Moderation', 'Audio'].includes(meta.cat);
    });

    const updateTier = (tierKey, field, value) => {
        setConfig(prev => ({
            ...prev,
            [tierKey]: { ...prev[tierKey], [field]: value }
        }));
    };

    const updateEuTier = (tierKey, field, value) => {
        setEuConfig(prev => ({
            ...prev,
            [tierKey]: { ...prev[tierKey], [field]: value }
        }));
    };

    // Build grouped model list (reused by both sections)
    const byProvider = {};
    chatModels.forEach(m => {
        const key = m.providerName || 'Unknown';
        if (!byProvider[key]) byProvider[key] = [];
        byProvider[key].push(m);
    });

    const renderTierCard = (tier, tierConfig, updateFn, defaults) => {
        const isExpanded = expandedTier === tier.key;
        const selectedModel = chatModels.find(m => m.id === tierConfig.modelId);
        const displayName = selectedModel ? getDisplayName(selectedModel) : null;
        const selectedLabel = selectedModel
            ? (displayName !== selectedModel.id
                ? displayName
                : selectedModel.id)
            : '— Not configured —';

        return (
            <div key={tier.key} className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-xl">{tier.icon}</span>
                        <div className="flex-1">
                            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tier.label}</span>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tier.desc}</p>
                        </div>
                        {defaults && (
                            <button
                                onClick={() => setExpandedTier(isExpanded ? null : tier.key)}
                                className="text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                {isExpanded ? '▲ Settings' : '▼ Settings'}
                            </button>
                        )}
                    </div>
                    <SearchableModelSelect
                        value={tierConfig.modelId || ''}
                        label={selectedLabel}
                        groups={byProvider}
                        getModelMeta={getModelMeta}
                        onChange={val => updateFn(tier.key, 'modelId', val)}
                    />
                </div>
                {defaults && isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t flex gap-4" style={{ borderColor: 'var(--border-default)' }}>
                        <div className="flex-1">
                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Max Tokens</label>
                            <input
                                type="number"
                                value={tierConfig.maxTokens !== undefined ? tierConfig.maxTokens : defaults.maxTokens}
                                onChange={e => updateFn(tier.key, 'maxTokens', parseInt(e.target.value) || defaults.maxTokens)}
                                min={256} max={131072} step={256}
                                className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            />
                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                Default: {defaults.maxTokens.toLocaleString()}. Thinking models need higher values.
                            </p>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Temperature</label>
                            <input
                                type="number"
                                value={tierConfig.temperature !== undefined ? tierConfig.temperature : defaults.temperature}
                                onChange={e => updateFn(tier.key, 'temperature', parseFloat(e.target.value) || defaults.temperature)}
                                min={0} max={2} step={0.1}
                                className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            />
                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                0 = deterministic, 1 = creative. Default: {defaults.temperature}
                            </p>
                        </div>
                        {isReasoningCapable(tierConfig.modelId) && (
                            <>
                                {isClaudeReasoning(tierConfig.modelId) ? (
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>🧠 Thinking Budget</label>
                                        <input
                                            type="number"
                                            value={tierConfig.budgetTokens !== undefined ? tierConfig.budgetTokens : 10000}
                                            onChange={e => updateFn(tier.key, 'budgetTokens', parseInt(e.target.value) || 10000)}
                                            min={1024} max={128000} step={1024}
                                            className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                        />
                                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                            Token budget for Claude's internal reasoning. Higher = deeper thinking. Set to 0 to disable.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>🧠 Reasoning Effort</label>
                                            <select
                                                value={tierConfig.reasoningEffort || 'none'}
                                                onChange={e => updateFn(tier.key, 'reasoningEffort', e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            >
                                                <option value="none">None (fastest)</option>
                                                <option value="low">Low</option>
                                                <option value="medium">Medium</option>
                                                <option value="high">High</option>
                                                <option value="xhigh">xHigh (deepest)</option>
                                            </select>
                                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                                Controls how much the model reasons before responding.
                                            </p>
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>📝 Reasoning Summary</label>
                                            <div
                                                className="flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                                                onClick={() => updateFn(tier.key, 'reasoningSummary', !tierConfig.reasoningSummary)}
                                            >
                                                <div className={`w-9 h-5 rounded-full relative transition-colors ${tierConfig.reasoningSummary ? 'bg-green-500' : 'bg-gray-600'}`}>
                                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${tierConfig.reasoningSummary ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                                </div>
                                                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                                                    {tierConfig.reasoningSummary ? 'Enabled' : 'Disabled'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                                Show a summary of the model's reasoning process.
                                            </p>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-8">
            {/* Regular Chat Model Tiers */}
            <div className="p-4 sm:p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>💬</div>
                    <div>
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Chat Model Tiers</h3>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Assign a model to each tier for Direct Chat mode
                        </p>
                    </div>
                </div>

                {message && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {message.text}
                    </div>
                )}

                <div className="space-y-4">
                    {TIERS.map(tier => renderTierCard(tier, config[tier.key] || {}, updateTier, TIER_DEFAULTS[tier.key]))}
                </div>

                <button
                    onClick={save}
                    disabled={saving}
                    className="mt-6 px-6 py-2.5 rounded-lg font-medium text-sm transition-all text-white hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    {saving ? 'Saving...' : 'Save Tier Configuration'}
                </button>
            </div>

            {/* EU Chat Model Tiers */}
            <div className="p-4 sm:p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(0, 51, 153, 0.15)' }}>🇪🇺</div>
                    <div>
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>EU Chat Model Tiers</h3>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            EU-hosted models used when an organization has EU mode enabled in their Privacy Shield
                        </p>
                    </div>
                </div>

                {euMessage && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${euMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {euMessage.text}
                    </div>
                )}

                <div className="space-y-4">
                    {TIERS.map(tier => renderTierCard(tier, euConfig[tier.key] || {}, updateEuTier, null))}
                </div>

                <button
                    onClick={saveEu}
                    disabled={euSaving}
                    className="mt-6 px-6 py-2.5 rounded-lg font-medium text-sm transition-all text-white hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    {euSaving ? 'Saving...' : 'Save EU Tier Configuration'}
                </button>
            </div>
        </div>
    );
};

export default ChatModelTiersConfig;
