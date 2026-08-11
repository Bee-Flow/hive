import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import { getModelMeta, getModelDisplayName } from '../../../utils/modelMeta';
import SearchableModelSelect from '../shared/SearchableModelSelect';

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
        ? `${getModelDisplayName(cleanupSelected)} · ${cleanupSelected.providerName}`
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
        ? `${getModelDisplayName(embedOverride)} · ${embedOverride.providerName}`
        : (embedFallbackName ? `Inherit global · ${embedFallbackName}` : 'Inherit global · (none configured)');

    // Rerank model picker — only relevant when method='provider'.
    const rerankSelected = chatModels.find(m =>
        m.id === config.rerank.modelId && m.providerId === config.rerank.providerId
    );
    const rerankLabel = rerankSelected
        ? `${getModelDisplayName(rerankSelected)} · ${rerankSelected.providerName}`
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
