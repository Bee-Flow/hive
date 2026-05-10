import React, { useState, useEffect, useRef } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import { getModelMeta } from './modelMeta';

// Mirrors `getDisplayName` from ChatModelTiersConfig — local copy keeps
// this panel self-contained while we wait for a shared component.
const formatModelId = (id) => {
    if (!id) return id;
    let name = id.replace(/-\d{6,8}$/, '').replace(/-\d{4}$/, '');
    return name.split('-').map(part => /^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
};
const getDisplayName = (model) => {
    if (!model) return '';
    const meta = getModelMeta(model.id);
    if (meta?.name) return meta.name;
    if (model.name && model.name !== model.id) return model.name;
    return formatModelId(model.id);
};

// Same family detection ChatModelTiersConfig uses for the chip filter.
const getFamily = (modelId) => {
    if (/^gpt-5/.test(modelId)) return 'GPT-5';
    if (/^gpt-4\.1/.test(modelId)) return 'GPT-4.1';
    if (/^gpt-4o/.test(modelId)) return 'GPT-4o';
    if (/^gpt-4/.test(modelId)) return 'GPT-4';
    if (/^o\d/.test(modelId)) return 'o-series';
    if (/^claude-/.test(modelId)) return 'Claude';
    if (/^gemini-/.test(modelId)) return 'Gemini';
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

// Searchable model picker — overlay with filter chips. Same UX shape as
// ChatModelTiersConfig.SearchableModelSelect.
function SearchableModelSelect({ value, label, groups, onChange, title = 'Select model', clearLabel = '— Disabled —' }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [activeProvider, setActiveProvider] = useState(null);
    const [activeFamily, setActiveFamily] = useState(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 50);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open]);

    const providerNames = Object.keys(groups);
    const allFamilies = new Set();
    Object.values(groups).flat().forEach(m => allFamilies.add(getFamily(m.id)));
    const familyList = [...allFamilies].sort();

    const lowerSearch = search.toLowerCase();
    const filteredGroups = {};
    Object.entries(groups).forEach(([provName, models]) => {
        if (activeProvider && provName !== activeProvider) return;
        const filtered = models.filter(m => {
            if (activeFamily && getFamily(m.id) !== activeFamily) return false;
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

            {open && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
                >
                    <div className="w-full max-w-2xl rounded-2xl border shadow-2xl flex flex-col"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', maxHeight: '80vh' }}>
                        <div className="flex items-center justify-between px-5 pt-5 pb-3">
                            <div>
                                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    {totalResults} model{totalResults !== 1 ? 's' : ''}{search ? ` matching "${search}"` : ' available'}
                                </p>
                            </div>
                            <button type="button" onClick={() => setOpen(false)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                                style={{ color: 'var(--text-muted)' }}>✕</button>
                        </div>

                        <div className="px-5 pb-3">
                            <div className="relative">
                                <svg className="absolute left-3 top-3 w-5 h-5" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input ref={inputRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Search by name, ID, or category..."
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none text-sm"
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                            </div>
                        </div>

                        <div className="px-5 pb-3 space-y-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-semibold uppercase tracking-wider mr-1" style={{ color: 'var(--text-muted)' }}>Provider</span>
                                <button type="button" onClick={() => setActiveProvider(null)}
                                    className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                    style={{ background: !activeProvider ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: !activeProvider ? '#fff' : 'var(--text-muted)' }}>All</button>
                                {providerNames.map(p => (
                                    <button key={p} type="button" onClick={() => setActiveProvider(activeProvider === p ? null : p)}
                                        className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                        style={{ background: activeProvider === p ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: activeProvider === p ? '#fff' : 'var(--text-muted)' }}>{p}</button>
                                ))}
                            </div>
                            {familyList.length > 1 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider mr-1" style={{ color: 'var(--text-muted)' }}>Family</span>
                                    <button type="button" onClick={() => setActiveFamily(null)}
                                        className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                        style={{ background: !activeFamily ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: !activeFamily ? '#fff' : 'var(--text-muted)' }}>All</button>
                                    {familyList.map(f => (
                                        <button key={f} type="button" onClick={() => setActiveFamily(activeFamily === f ? null : f)}
                                            className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                                            style={{ background: activeFamily === f ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: activeFamily === f ? '#fff' : 'var(--text-muted)' }}>{f}</button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto px-2 pb-4" style={{ minHeight: 0 }}>
                            <button type="button" onClick={() => { onChange({ providerId: '', modelId: '' }); setOpen(false); }}
                                className="w-full text-left px-4 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors mb-1"
                                style={{ color: 'var(--text-muted)' }}>
                                {clearLabel}
                            </button>

                            {Object.entries(filteredGroups).map(([provName, models]) => (
                                <div key={provName} className="mb-2">
                                    <div className="sticky top-0 z-10 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg mb-1"
                                        style={{ background: 'var(--bg-secondary)', color: 'var(--accent-primary)' }}>
                                        {provName} ({models.length})
                                    </div>
                                    <div className="grid gap-0.5">
                                        {models.map(m => {
                                            const meta = getModelMeta(m.id);
                                            const displayName = getDisplayName(m);
                                            const isSelected = m.id === value?.modelId && m.providerId === value?.providerId;
                                            return (
                                                <button key={m.providerId + ':' + m.id} type="button"
                                                    onClick={() => { onChange({ providerId: m.providerId, modelId: m.id }); setOpen(false); }}
                                                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm flex items-center gap-3 transition-all ${isSelected ? 'ring-1 ring-[var(--accent-primary)]' : 'hover:bg-white/5'}`}
                                                    style={{ background: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: 'var(--text-primary)' }}>
                                                    <span className="w-5 text-center shrink-0" style={{ color: 'var(--accent-primary)' }}>{isSelected ? '✓' : ''}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium">{displayName}</div>
                                                        {displayName !== m.id && (
                                                            <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{m.id}</div>
                                                        )}
                                                    </div>
                                                    {meta?.cat && (
                                                        <span className="text-[10px] px-2 py-1 rounded-full shrink-0 font-medium"
                                                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
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
                                    <p className="text-sm">{providerNames.length === 0 ? 'Configure a provider in the Providers tab first.' : 'Try a different search term'}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

const RERANK_METHODS = [
    {
        id: 'cosine',
        label: 'Cosine similarity',
        desc: 'Reuses the query and document embeddings — no extra model. Works with whichever provider you picked for embeddings.',
    },
    {
        id: 'cpu',
        label: 'CPU cross-encoder',
        desc: 'Runs a small bge-reranker-base model in this Node process via Transformers.js. ~280 MB RAM, no GPU, no API call. Best quality-per-resource for self-hosted setups.',
    },
    {
        id: 'provider',
        label: 'Provider model',
        desc: 'Use a configured chat model (LLM-as-rerank) to score results. Pick any model from a configured provider below.',
    },
    {
        id: 'local',
        label: 'Local cross-encoder (GPU)',
        desc: 'A vLLM-served reranker on your own GPU. Highest quality at the cost of dedicated hardware. Falls back to cosine when running cloud-only search.',
    },
    {
        id: 'disabled',
        label: 'Disabled',
        desc: 'Skip the rerank step entirely. Results return in whatever order the vector store produced them.',
    },
];

const WebSearchInferenceConfig = ({ allModels = [], onNavigateToTab }) => {
    const [config, setConfig] = useState({
        embed: { providerId: '', modelId: '' },
        rerank: { method: 'cosine', providerId: '', modelId: '' },
        cleanup: { providerId: '', modelId: '' },
    });
    const [embedSummary, setEmbedSummary] = useState({ providerId: null, providerName: null, modelId: null });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    const fetchAll = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/web-search-inference`);
            if (res.ok) {
                const data = await res.json();
                if (data.config) setConfig(data.config);
                if (data.embedSummary) setEmbedSummary(data.embedSummary);
            }
        } catch (e) {
            console.error('Failed to load web-search inference config:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config/web-search-inference`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Saved' });
                fetchAll();
            } else {
                setMessage({ type: 'error', text: 'Failed to save' });
            }
        } catch (_) {
            setMessage({ type: 'error', text: 'Failed to save' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 2500);
        }
    };

    if (loading) return <div className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>Loading…</div>;

    // Filter to chat-completion models only — same exclusions ChatModelTiersConfig uses.
    const chatModels = (allModels || []).filter(m => {
        const meta = getModelMeta(m.id);
        if (!meta) return true;
        return !['Embedding', 'OCR', 'Moderation', 'Audio'].includes(meta.cat);
    });
    const cleanupGroups = {};
    chatModels.forEach(m => {
        const key = m.providerName || 'Unknown';
        if (!cleanupGroups[key]) cleanupGroups[key] = [];
        cleanupGroups[key].push(m);
    });

    // Embedding-only models — for the per-feature embed override.
    const embedModels = (allModels || []).filter(m => getModelMeta(m.id)?.cat === 'Embedding');
    const embedGroups = {};
    embedModels.forEach(m => {
        const key = m.providerName || 'Unknown';
        if (!embedGroups[key]) embedGroups[key] = [];
        embedGroups[key].push(m);
    });

    const cleanupSelected = chatModels.find(m =>
        m.id === config.cleanup.modelId && m.providerId === config.cleanup.providerId
    );
    const cleanupLabel = cleanupSelected
        ? `${getDisplayName(cleanupSelected)} · ${cleanupSelected.providerName}`
        : '— Disabled (no cleanup model selected) —';

    // Embed override — picker; empty falls back to global Embeddings config.
    const embedOverride = embedModels.find(m =>
        m.id === config.embed.modelId && m.providerId === config.embed.providerId
    );
    const embedConfigured = !!(embedSummary.providerId && embedSummary.modelId);
    const embedFallbackName = embedConfigured
        ? `${getModelMeta(embedSummary.modelId)?.name || embedSummary.modelId} · ${embedSummary.providerName || embedSummary.providerId}`
        : null;
    const embedLabel = embedOverride
        ? `${getDisplayName(embedOverride)} · ${embedOverride.providerName}`
        : (embedFallbackName ? `Inherit global · ${embedFallbackName}` : 'Inherit global · (none configured)');

    // Rerank model picker — only relevant when method='provider'.
    const rerankSelected = chatModels.find(m =>
        m.id === config.rerank.modelId && m.providerId === config.rerank.providerId
    );
    const rerankLabel = rerankSelected
        ? `${getDisplayName(rerankSelected)} · ${rerankSelected.providerName}`
        : '— Pick a model —';

    return (
        <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
            <div className="mb-6">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Web Search — Inference</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    Three tasks the search-service runs for every web query. Embeddings inherit your global Embeddings settings; rerank is a method-only choice; cleanup picks any chat model from a configured provider.
                </p>
            </div>

            {message && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            <div className="space-y-4">
                {/* ── Embeddings (per-feature picker; empty -> inherit global) ── */}
                <div className="rounded-xl border p-4" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                    <div className="flex items-center justify-between gap-4 mb-3">
                        <div className="flex-1">
                            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Embeddings</div>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                Vectorise queries and pages for semantic search. Pick a model to override, or leave on “Inherit global” to use the model from the Embeddings tab.
                            </p>
                        </div>
                        {onNavigateToTab && (
                            <button
                                onClick={() => onNavigateToTab('embeddings')}
                                className="text-xs px-3 py-1.5 rounded-lg border hover:bg-white/5 transition-colors"
                                style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
                            >
                                Open Embeddings settings →
                            </button>
                        )}
                    </div>
                    <SearchableModelSelect
                        value={config.embed}
                        label={embedLabel}
                        groups={embedGroups}
                        title="Select embedding model"
                        clearLabel="— Inherit from global Embeddings settings —"
                        onChange={({ providerId, modelId }) => setConfig(prev => ({ ...prev, embed: { providerId, modelId } }))}
                    />
                    {Object.keys(embedGroups).length === 0 && (
                        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                            No embedding models found in your configured providers — add a provider with embeddings (e.g. OpenAI, Mistral) or set one globally in the Embeddings tab.
                        </p>
                    )}
                </div>

                {/* ── Reranking ─────────────────────────────────────── */}
                <div className="rounded-xl border p-4" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Reranking</div>
                    <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>
                        Re-score search results to surface the most relevant. Provider-agnostic.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                        {RERANK_METHODS.map(opt => {
                            const selected = config.rerank.method === opt.id;
                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => setConfig(prev => ({
                                        ...prev,
                                        rerank: opt.id === 'provider'
                                            ? { method: 'provider', providerId: prev.rerank.providerId, modelId: prev.rerank.modelId }
                                            : { method: opt.id, providerId: '', modelId: '' },
                                    }))}
                                    className="text-left p-3 rounded-lg border transition-all"
                                    style={{
                                        background: selected ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)',
                                        borderColor: selected ? '#10B981' : 'var(--border-default)',
                                    }}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                                            style={{ borderColor: selected ? '#10B981' : 'var(--border-default)', background: selected ? '#10B981' : 'transparent' }}>
                                            {selected && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                                        </span>
                                        <span className="text-sm font-medium" style={{ color: selected ? '#10B981' : 'var(--text-primary)' }}>
                                            {opt.label}
                                        </span>
                                    </div>
                                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                                </button>
                            );
                        })}
                    </div>
                    {config.rerank.method === 'provider' && (
                        <div className="mt-3">
                            <SearchableModelSelect
                                value={{ providerId: config.rerank.providerId, modelId: config.rerank.modelId }}
                                label={rerankLabel}
                                groups={cleanupGroups}
                                title="Select rerank model"
                                clearLabel="— Pick a model (required for provider rerank) —"
                                onChange={({ providerId, modelId }) => setConfig(prev => ({ ...prev, rerank: { method: 'provider', providerId, modelId } }))}
                            />
                            {!config.rerank.modelId && (
                                <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                    Pick a model — without one, “Provider model” falls back to cosine similarity at runtime.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Cleanup ───────────────────────────────────────── */}
                <div className="rounded-xl border p-4" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Webpage cleanup</div>
                    <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>
                        Convert raw scraped HTML into clean, agent-readable text. Pick any chat model from a configured provider.
                    </p>
                    <SearchableModelSelect
                        value={config.cleanup}
                        label={cleanupLabel}
                        groups={cleanupGroups}
                        title="Select cleanup model"
                        clearLabel="— Disabled (skip cleanup) —"
                        onChange={({ providerId, modelId }) => setConfig(prev => ({ ...prev, cleanup: { providerId, modelId } }))}
                    />
                    {Object.keys(cleanupGroups).length === 0 && (
                        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                            No providers configured yet — add an API key in the Providers tab to enable model selection.
                        </p>
                    )}
                </div>
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ background: saving ? 'var(--bg-tertiary)' : 'var(--accent-primary)', color: 'white', opacity: saving ? 0.6 : 1 }}
                >
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </div>
    );
};

export default WebSearchInferenceConfig;
