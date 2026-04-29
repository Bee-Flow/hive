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
    if (/^claude-haiku-4-5/.test(modelId)) return false;         // Haiku 4.5: no adaptive thinking
    if (/^claude-(opus|sonnet)-4/.test(modelId)) return true;    // Claude Opus/Sonnet 4.x
    return false;
};

// Detect Claude models specifically (they use adaptive thinking with effort levels)
const isClaudeReasoning = (modelId) => {
    if (!modelId) return false;
    if (/^claude-haiku-4-5/.test(modelId)) return false;
    return /^claude-(opus|sonnet)-4/.test(modelId);
};

// Opus 4.7 exposes an additional 'xhigh' effort level between 'high' and 'max'
const isClaudeOpus47 = (modelId) => /^claude-opus-4-7/.test(modelId || '');

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
    // Claude
    'claude-opus-4-7': { name: 'Claude Opus 4.7', cat: 'Reasoning' },
    'claude-opus-4-6': { name: 'Claude Opus 4.6', cat: 'Reasoning' },
    'claude-sonnet-4-6': { name: 'Claude Sonnet 4.6', cat: 'Generalist' },
    'claude-haiku-4-5': { name: 'Claude Haiku 4.5', cat: 'Generalist' },
};

const TIERS = [
    { key: 'fast', icon: '⚡', label: 'Fast', desc: 'Quick responses for simple questions' },
    { key: 'standard', icon: '🐝', label: 'Flow (Direct)', desc: 'Direct chat tier with per-chat orchestrated stages' },
    { key: 'thinking', icon: '🧠', label: 'Thinking', desc: 'Complex reasoning and analysis' },
    { key: 'writer', icon: '✍️', label: 'Writer', desc: 'Long-form content and reports' },
    { key: 'pro', icon: '✨', label: 'Deep Thinking', desc: 'Maximum quality output' }
];

const TIER_DEFAULTS = {
    fast: { maxTokens: 8192, temperature: 0.7 },
    standard: { maxTokens: 8192, temperature: 0.5 },
    thinking: { maxTokens: 40960, temperature: 0.7 },
    writer: { maxTokens: 16384, temperature: 0.7 },
    pro: { maxTokens: 40960, temperature: 0.7 },
};

// Custom tier defaults when creating a new one
const CUSTOM_TIER_DEFAULTS = { maxTokens: 16384, temperature: 0.7 };

const TASK_TYPES = [
    { key: 'direct_chat', label: 'Direct Chat' },
    { key: 'agent_chat', label: 'Agent Chat' },
    { key: 'email_kb', label: 'Email Knowledge Base' },
];

// Convert a free-form label into a stable custom tier id (slug, namespaced).
const slugifyTierLabel = (label) => {
    const slug = String(label || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return slug ? `custom:${slug}` : '';
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
        standard: { modelId: '', label: 'Flow (Direct)' },
        thinking: { modelId: '', label: 'Thinking' },
        writer: { modelId: '', label: 'Writer' },
        pro: { modelId: '', label: 'Deep Thinking' }
    });
    const [euConfig, setEuConfig] = useState({
        fast: { modelId: '', label: 'Fast' },
        standard: { modelId: '', label: 'Flow (Direct)' },
        thinking: { modelId: '', label: 'Thinking' },
        writer: { modelId: '', label: 'Writer' },
        pro: { modelId: '', label: 'Deep Thinking' }
    });
    const [customTiers, setCustomTiers] = useState([]);
    const [customMessage, setCustomMessage] = useState(null);
    const [customSaving, setCustomSaving] = useState(false);
    const [saving, setSaving] = useState(false);
    const [euSaving, setEuSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [euMessage, setEuMessage] = useState(null);
    const [expandedTier, setExpandedTier] = useState(null);
    const [expandedCustomId, setExpandedCustomId] = useState(null);
    const [classifierModel, setClassifierModel] = useState('');
    const [classifierSaving, setClassifierSaving] = useState(false);
    const [classifierMessage, setClassifierMessage] = useState(null);

    useEffect(() => {
        loadConfig();
        loadEuConfig();
        loadCustomTiers();
        loadClassifierModel();
    }, []);

    const loadClassifierModel = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/auto-classifier`);
            if (res.ok) {
                const data = await res.json();
                setClassifierModel(typeof data.modelId === 'string' ? data.modelId : '');
            }
        } catch (e) { console.error('Failed to load classifier model:', e); }
    };

    const saveClassifierModel = async (next = classifierModel) => {
        setClassifierSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config/auto-classifier`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelId: next || null }),
            });
            if (res.ok) {
                const data = await res.json();
                setClassifierModel(typeof data.modelId === 'string' ? data.modelId : '');
                setClassifierMessage({ type: 'success', text: 'Classifier model saved' });
                setTimeout(() => setClassifierMessage(null), 3000);
            } else {
                const data = await res.json().catch(() => ({}));
                setClassifierMessage({ type: 'error', text: data.error || 'Failed to save classifier model' });
            }
        } catch (e) {
            setClassifierMessage({ type: 'error', text: 'Failed to save classifier model' });
        }
        setClassifierSaving(false);
    };

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
            // Save standard tiers + custom tiers together so a single click
            // persists everything the user edited in this section.
            const [res, customRes] = await Promise.all([
                authFetch(`${API_BASE}/ai/config/chat-models`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config)
                }),
                authFetch(`${API_BASE}/ai/config/custom-chat-models`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tiers: customTiers })
                })
            ]);
            const bothOk = res.ok && customRes.ok;
            let warn = '';
            try {
                const j = customRes.ok ? await customRes.json() : null;
                if (j && Array.isArray(j.warnings) && j.warnings.length > 0) warn = ' (' + j.warnings.join('; ') + ')';
                if (j && Array.isArray(j.tiers)) setCustomTiers(j.tiers);
            } catch (_) { /* ignore */ }
            if (bothOk) {
                setMessage({ type: warn ? 'warning' : 'success', text: `Chat model tiers saved${warn}` });
                setTimeout(() => setMessage(null), 4000);
            } else {
                setMessage({ type: 'error', text: 'Failed to save (one or more configs)' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to save tier config' });
        }
        setSaving(false);
    };

    const loadCustomTiers = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/custom-chat-models`);
            if (res.ok) {
                const data = await res.json();
                setCustomTiers(Array.isArray(data.tiers) ? data.tiers : []);
            }
        } catch (e) { console.error('Failed to load custom tiers:', e); }
    };

    const saveCustomTiers = async (next = customTiers) => {
        setCustomSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config/custom-chat-models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tiers: next }),
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.tiers)) setCustomTiers(data.tiers);
                const warn = Array.isArray(data.warnings) && data.warnings.length > 0
                    ? `Saved, with warnings: ${data.warnings.join('; ')}`
                    : 'Custom tiers saved!';
                setCustomMessage({ type: data.warnings?.length ? 'warning' : 'success', text: warn });
                setTimeout(() => setCustomMessage(null), 4000);
            } else {
                setCustomMessage({ type: 'error', text: 'Failed to save custom tiers' });
            }
        } catch (e) {
            setCustomMessage({ type: 'error', text: 'Failed to save custom tiers' });
        }
        setCustomSaving(false);
    };

    const addCustomTier = () => {
        // Generate a unique placeholder id so the new card has a stable key
        let n = customTiers.length + 1;
        let placeholderId = `custom:new-tier-${n}`;
        while (customTiers.some(t => t.id === placeholderId)) {
            n += 1;
            placeholderId = `custom:new-tier-${n}`;
        }
        setCustomTiers(prev => [
            ...prev,
            {
                id: placeholderId,
                label: `New tier ${n}`,
                icon: '✨',
                description: '',
                modelId: '',
                maxTokens: CUSTOM_TIER_DEFAULTS.maxTokens,
                temperature: CUSTOM_TIER_DEFAULTS.temperature,
                reasoningEffort: undefined,
                reasoningSummary: false,
                allowedTaskTypes: ['direct_chat', 'agent_chat', 'email_kb'],
                _isNew: true, // local-only flag: show the label/id editor pre-expanded
            },
        ]);
        setExpandedCustomId(placeholderId);
    };

    const updateCustomTier = (id, patch) => {
        setCustomTiers(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    };

    const renameCustomTier = (currentId, newLabel) => {
        const newId = slugifyTierLabel(newLabel);
        setCustomTiers(prev => {
            const next = prev.map(t => {
                if (t.id !== currentId) return t;
                return { ...t, label: newLabel, id: newId || currentId };
            });
            return next;
        });
        if (newId && newId !== currentId) setExpandedCustomId(newId);
    };

    const removeCustomTier = (id) => {
        if (!window.confirm('Delete this custom tier? This cannot be undone.')) return;
        setCustomTiers(prev => prev.filter(t => t.id !== id));
    };

    const toggleCustomTaskType = (id, taskKey) => {
        setCustomTiers(prev => prev.map(t => {
            if (t.id !== id) return t;
            const set = new Set(t.allowedTaskTypes || []);
            if (set.has(taskKey)) set.delete(taskKey);
            else set.add(taskKey);
            return { ...t, allowedTaskTypes: Array.from(set) };
        }));
    };

    const saveEu = async () => {
        setEuSaving(true);
        try {
            // Save EU standard tiers AND the full custom tiers array (which now
            // contains each custom tier's euModelId). The custom-chat-models
            // endpoint overwrites wholesale so race with `save()` is avoided as
            // long as both callers write from the same local state.
            const [res, customRes] = await Promise.all([
                authFetch(`${API_BASE}/ai/config/chat-models-eu`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(euConfig)
                }),
                authFetch(`${API_BASE}/ai/config/custom-chat-models`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tiers: customTiers })
                })
            ]);
            if (res.ok && customRes.ok) {
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
                    {/* Bootstrap-only model picker for the Standard tier — used
                        for the per-conversation skill bootstrap pass to keep
                        cost down (e.g. Haiku) regardless of the main model. */}
                    {tier.key === 'standard' && (() => {
                        const bootstrapModel = chatModels.find(m => m.id === tierConfig.bootstrapModelId);
                        const bootstrapDisplayName = bootstrapModel ? getDisplayName(bootstrapModel) : null;
                        const bootstrapLabel = bootstrapModel
                            ? (bootstrapDisplayName !== bootstrapModel.id ? bootstrapDisplayName : bootstrapModel.id)
                            : '— Same as main model —';
                        return (
                            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-default)' }}>
                                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                                    Bootstrap model (cheap & fast)
                                </label>
                                <SearchableModelSelect
                                    value={tierConfig.bootstrapModelId || ''}
                                    label={bootstrapLabel}
                                    groups={byProvider}
                                    getModelMeta={getModelMeta}
                                    onChange={val => updateFn(tier.key, 'bootstrapModelId', val || '')}
                                />
                                <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                    Used once per direct chat to plan the conversation's Flow stages. Pick a small/fast model (e.g. Haiku) to cut planning cost. Leave empty to reuse the main model.
                                </p>
                            </div>
                        );
                    })()}
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
                                <div className="flex-1">
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>🧠 {isClaudeReasoning(tierConfig.modelId) ? 'Thinking Effort' : 'Reasoning Effort'}</label>
                                    <select
                                        value={tierConfig.reasoningEffort || (isClaudeReasoning(tierConfig.modelId) ? 'medium' : 'none')}
                                        onChange={e => updateFn(tier.key, 'reasoningEffort', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="none">None (disabled)</option>
                                        <option value="low">Low — quick tasks</option>
                                        <option value="medium">Medium — balanced (default)</option>
                                        <option value="high">High — complex reasoning</option>
                                        {isClaudeOpus47(tierConfig.modelId) ? (
                                            <>
                                                <option value="xhigh">xHigh — extended exploration</option>
                                                <option value="max">Max — no thinking constraints</option>
                                            </>
                                        ) : isClaudeReasoning(tierConfig.modelId) ? (
                                            <option value="xhigh">Max — deepest thinking</option>
                                        ) : (
                                            <option value="xhigh">xHigh — deepest reasoning</option>
                                        )}
                                    </select>
                                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                        {isClaudeReasoning(tierConfig.modelId)
                                            ? 'Adaptive thinking — Claude decides how deep to reason. Default: Medium.'
                                            : 'Controls how much the model reasons before responding.'}
                                    </p>
                                </div>
                                {!isClaudeReasoning(tierConfig.modelId) && (
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
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderCustomTierCard = (tier) => {
        const isExpanded = expandedCustomId === tier.id;
        const selectedModel = chatModels.find(m => m.id === tier.modelId);
        const displayName = selectedModel ? getDisplayName(selectedModel) : null;
        const selectedLabel = selectedModel
            ? (displayName !== selectedModel.id ? displayName : selectedModel.id)
            : '— Not configured —';
        const taskTypes = new Set(tier.allowedTaskTypes || []);

        return (
            <div key={tier.id} className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <input
                            type="text"
                            value={tier.icon || ''}
                            onChange={e => updateCustomTier(tier.id, { icon: e.target.value.slice(0, 4) })}
                            maxLength={4}
                            className="w-12 text-center text-xl px-1 py-1 rounded-lg border outline-none"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            title="Icon or emoji"
                        />
                        <div className="flex-1 min-w-0">
                            <input
                                type="text"
                                value={tier.label || ''}
                                onChange={e => renameCustomTier(tier.id, e.target.value)}
                                placeholder="Tier name"
                                className="w-full text-sm font-semibold px-2 py-1 rounded-lg border outline-none"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            />
                            <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>{tier.id}</p>
                        </div>
                        <button
                            onClick={() => setExpandedCustomId(isExpanded ? null : tier.id)}
                            className="text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            {isExpanded ? '▲ Settings' : '▼ Settings'}
                        </button>
                        <button
                            onClick={() => removeCustomTier(tier.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            title="Delete tier"
                        >✕</button>
                    </div>

                    <input
                        type="text"
                        value={tier.description || ''}
                        onChange={e => updateCustomTier(tier.id, { description: e.target.value })}
                        placeholder="Short description (shown in tier picker)"
                        className="w-full text-xs px-3 py-2 mb-3 rounded-lg border outline-none"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />

                    <SearchableModelSelect
                        value={tier.modelId || ''}
                        label={selectedLabel}
                        groups={byProvider}
                        getModelMeta={getModelMeta}
                        onChange={val => updateCustomTier(tier.id, { modelId: val })}
                    />

                    <div className="mt-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                            Available for
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {TASK_TYPES.map(tt => {
                                const active = taskTypes.has(tt.key);
                                return (
                                    <button
                                        key={tt.key}
                                        type="button"
                                        onClick={() => toggleCustomTaskType(tier.id, tt.key)}
                                        className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                        style={{
                                            background: active ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                            color: active ? '#fff' : 'var(--text-muted)',
                                            border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                                        }}
                                    >
                                        {active ? '✓ ' : ''}{tt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t flex gap-4 flex-wrap" style={{ borderColor: 'var(--border-default)' }}>
                        <div className="flex-1 min-w-[180px]">
                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Max Tokens</label>
                            <input
                                type="number"
                                value={tier.maxTokens !== undefined ? tier.maxTokens : CUSTOM_TIER_DEFAULTS.maxTokens}
                                onChange={e => updateCustomTier(tier.id, { maxTokens: parseInt(e.target.value) || CUSTOM_TIER_DEFAULTS.maxTokens })}
                                min={256} max={131072} step={256}
                                className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            />
                        </div>
                        <div className="flex-1 min-w-[180px]">
                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Temperature</label>
                            <input
                                type="number"
                                value={tier.temperature !== undefined ? tier.temperature : CUSTOM_TIER_DEFAULTS.temperature}
                                onChange={e => updateCustomTier(tier.id, { temperature: parseFloat(e.target.value) || CUSTOM_TIER_DEFAULTS.temperature })}
                                min={0} max={2} step={0.1}
                                className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            />
                        </div>
                        {isReasoningCapable(tier.modelId) && (
                            <div className="flex-1 min-w-[180px]">
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>🧠 {isClaudeReasoning(tier.modelId) ? 'Thinking Effort' : 'Reasoning Effort'}</label>
                                <select
                                    value={tier.reasoningEffort || 'none'}
                                    onChange={e => updateCustomTier(tier.id, { reasoningEffort: e.target.value === 'none' ? undefined : e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                >
                                    <option value="none">None (disabled)</option>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    {isClaudeOpus47(tier.modelId) && <option value="xhigh">xHigh</option>}
                                    {isClaudeOpus47(tier.modelId) && <option value="max">Max</option>}
                                </select>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Compact EU model picker for a custom tier — lives inside the EU section.
    const renderCustomTierEuRow = (tier) => {
        const selectedModel = chatModels.find(m => m.id === tier.euModelId);
        const displayName = selectedModel ? getDisplayName(selectedModel) : null;
        const label = selectedModel
            ? (displayName !== selectedModel.id ? displayName : selectedModel.id)
            : '— Not configured —';
        return (
            <div key={tier.id} className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-xl">{tier.icon || '✨'}</span>
                        <div className="flex-1">
                            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tier.label}</span>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {tier.description || <span className="italic opacity-60">Custom tier</span>}
                            </p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#eab308' }}>custom</span>
                    </div>
                    <SearchableModelSelect
                        value={tier.euModelId || ''}
                        label={label}
                        groups={byProvider}
                        getModelMeta={getModelMeta}
                        onChange={val => updateCustomTier(tier.id, { euModelId: val })}
                    />
                </div>
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

                {/* Custom tiers — live inside the same section as the standard four */}
                <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border-default)' }}>
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Custom Tiers
                            </h4>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Extra tiers beyond the standard four. Restrict each tier to specific task types and per-group access from the Organisation admin.
                            </p>
                        </div>
                        <button
                            onClick={addCustomTier}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity"
                            style={{ background: 'var(--accent-primary)' }}
                        >
                            + Add Custom Tier
                        </button>
                    </div>
                    {customTiers.length === 0 ? (
                        <div className="p-4 rounded-lg border text-center text-xs" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}>
                            No custom tiers yet.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {customTiers.map(renderCustomTierCard)}
                        </div>
                    )}
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

            {/* Auto-tier Classifier Model */}
            <div className="p-4 sm:p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>🔀</div>
                    <div>
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Auto-tier Classifier Model</h3>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Picks the model used to classify Auto-tier prompts. Choose the cheapest, fastest model — classification only needs ~8 tokens of output. Defaults to the Fast tier model when unset.
                        </p>
                    </div>
                </div>

                {classifierMessage && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${classifierMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {classifierMessage.text}
                    </div>
                )}

                <div className="rounded-xl border p-4" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        Classifier model
                    </label>
                    {(() => {
                        const selected = chatModels.find(m => m.id === classifierModel);
                        const display = selected ? getDisplayName(selected) : null;
                        const label = selected
                            ? (display !== selected.id ? display : selected.id)
                            : '— Use Fast tier model —';
                        return (
                            <SearchableModelSelect
                                value={classifierModel || ''}
                                label={label}
                                groups={byProvider}
                                getModelMeta={getModelMeta}
                                onChange={val => setClassifierModel(val || '')}
                            />
                        );
                    })()}
                </div>

                <button
                    onClick={() => saveClassifierModel()}
                    disabled={classifierSaving}
                    className="mt-4 px-6 py-2.5 rounded-lg font-medium text-sm transition-all text-white hover:opacity-90 disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    {classifierSaving ? 'Saving...' : 'Save Classifier Model'}
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

                {/* Custom tiers — EU model picker per tier. Only shown when any custom tier exists. */}
                {customTiers.length > 0 && (
                    <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border-default)' }}>
                        <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                            Custom Tiers — EU override
                        </h4>
                        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                            Pick an EU-hosted model for each custom tier. Used automatically when an organization has EU mode enabled.
                        </p>
                        <div className="space-y-4">
                            {customTiers.map(renderCustomTierEuRow)}
                        </div>
                    </div>
                )}

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
