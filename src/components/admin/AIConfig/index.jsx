import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../utils/helpers';
import { getModelMeta, CAT_COLORS } from './modelMeta';

import DirectChatConfig from './DirectChatConfig';
import TicketAssistantTiersConfig from './TicketAssistantTiersConfig';
import WebSearchInferenceConfig from './WebSearchInferenceConfig';
import LimitsConfig from './LimitsConfig';
import EmbeddingsConfig from './EmbeddingsConfig';

import MistralApiKeyCard from './ProviderCards/MistralCard';
import OpenAIApiKeyCard from './ProviderCards/OpenAICard';
import ClaudeApiKeyCard from './ProviderCards/ClaudeCard';
import GoogleApiKeyCard from './ProviderCards/GoogleCard';
import ElevenLabsApiKeyCard from './ProviderCards/ElevenLabsCard';
import AzureConfigCard from './ProviderCards/AzureCard';
import GoogleVertexConfigCard from './ProviderCards/GoogleVertexCard';
import RerankerConfig from './RerankerConfig';
import ChatModelTiersConfig from '../ChatModelTiersConfig';


const AIConfigPanel = () => {
    const { t } = useTranslation();
    // Navigation State
    const [activeTab, setActiveTab] = useState('providers');

    // Providers State
    const [providers, setProviders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);

    // Models State
    const [allModels, setAllModels] = useState([]);
    const [loadingModels, setLoadingModels] = useState(false);
    const [expandedProviderModels, setExpandedProviderModels] = useState({});

    useEffect(() => {
        fetchProviders();
    }, []);

    useEffect(() => {
        if (providers.length > 0 && (activeTab === 'providers' || activeTab === 'chatModels' || activeTab === 'webSearchInference' || activeTab === 'embeddings')) {
            fetchAllModels();
        }
    }, [activeTab, providers]);

    const fetchProviders = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/providers`);
            if (res.ok) {
                const data = await res.json();
                setProviders(data.providers || []);
            }
        } catch (e) {
            console.error('Failed to fetch providers:', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllModels = async () => {
        setLoadingModels(true);
        try {
            const results = await Promise.all(
                providers.map(async (provider) => {
                    try {
                        const res = await authFetch(`${API_BASE}/ai/providers/${provider.id}/models`);
                        if (res.ok) {
                            const data = await res.json();
                            return (data.models || []).map(m => ({
                                ...m,
                                providerId: provider.id,
                                providerName: provider.name,
                                providerType: provider.type
                            }));
                        }
                        return [];
                    } catch (e) {
                        console.error(`Failed to fetch models for ${provider.name}:`, e);
                        return [];
                    }
                })
            );
            setAllModels(results.flat());
        } catch (e) {
            console.error('Failed to fetch models:', e);
        }
        setLoadingModels(false);
    };

    const toggleProviderModels = (providerName) => {
        setExpandedProviderModels(prev => ({
            ...prev,
            [providerName]: !prev[providerName]
        }));
    };

    const getProviderModelCount = (providerName) => {
        return allModels.filter(m => m.providerName === providerName).length;
    };

    if (loading) return <div className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>Loading providers...</div>;

    const navItems = [
        { id: 'providers', label: t('admin.ai_api_keys'), icon: '🔑' },
        { id: 'chatModels', label: t('admin.ai_chat_models'), icon: '🗨️' },
        { id: 'embeddings', label: t('admin.ai_embeddings', 'Embeddings'), icon: '🧬' },
        { id: 'directChat', label: t('admin.ai_direct_chat'), icon: '💬' },
        { id: 'ticketAssistantTiers', label: t('admin.ai_ticket_assistant_tiers', 'Ticket Assistant Models'), icon: '🎫' },
        { id: 'webSearchInference', label: t('admin.ai_web_search_inference', 'Web Search Inference'), icon: '🌐' },
        { id: 'limits', label: t('admin.ai_limits', 'Limits & Self-host'), icon: '⚙️' },

    ];

    // Provider cards config — maps provider name to its card component
    const providerCards = [
        { name: 'Mistral', component: MistralApiKeyCard },
        { name: 'OpenAI', component: OpenAIApiKeyCard },
        { name: 'Claude', component: ClaudeApiKeyCard },
        { name: 'Google AI', component: GoogleApiKeyCard },
        { name: 'ElevenLabs', component: ElevenLabsApiKeyCard },
        { name: 'Google Vertex', component: GoogleVertexConfigCard },
        { name: 'Azure', component: AzureConfigCard },
    ];

    return (
        <div className="flex h-full border rounded-xl overflow-hidden shadow-sm" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
            {/* Left Sidebar */}
            <div className="w-64 flex flex-col p-2 border-r" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                <div className="p-4 mb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">AI Configuration</h3>
                </div>
                <div className="space-y-1">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${activeTab === item.id
                                ? 'bg-[var(--accent-primary)] text-white shadow-md'
                                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                                }`}
                        >
                            <span className="text-lg">{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-[var(--bg-primary)]">
                {message && (
                    <div className={`p-3 rounded-lg text-sm mb-4 ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {message.text}
                    </div>
                )}

                {/* Providers Tab — API Keys + inline model lists */}
                {activeTab === 'providers' && (
                    <div className="space-y-0">
                        {providerCards.map(({ name, component: Card }) => {
                            const modelCount = getProviderModelCount(name);
                            const isExpanded = expandedProviderModels[name];
                            const providerModels = allModels.filter(m => m.providerName === name);

                            return (
                                <div key={name}>
                                    <Card onMessage={setMessage} />
                                    {/* Inline model list (collapsible) */}
                                    {modelCount > 0 && (
                                        <div className="-mt-3 mb-6 mx-0">
                                            <button
                                                onClick={() => toggleProviderModels(name)}
                                                className="flex items-center gap-2 text-xs px-5 py-1.5 rounded-b-lg transition-colors hover:bg-white/5 w-full text-left"
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                                <span>{modelCount} available model{modelCount !== 1 ? 's' : ''}</span>
                                            </button>
                                            {isExpanded && (
                                                <div className="px-5 pb-3 pt-1">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                                        {providerModels.map(model => {
                                                            const meta = getModelMeta(model.id);
                                                            return (
                                                                <div
                                                                    key={model.id}
                                                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                                                                    style={{ background: 'var(--bg-tertiary)' }}
                                                                >
                                                                    <span className="font-medium truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                                                                        {meta?.name || model.name || model.id}
                                                                    </span>
                                                                    {meta?.cat && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{
                                                                            background: CAT_COLORS[meta.cat] || 'rgba(107,114,128,0.2)',
                                                                            color: 'var(--text-muted)'
                                                                        }}>
                                                                            {meta.cat}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Reranker stays at the bottom of providers */}
                        <RerankerConfig onMessage={setMessage} />

                        {/* Models loading indicator */}
                        {loadingModels && (
                            <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>
                                Loading available models...
                            </p>
                        )}
                    </div>
                )}

                {/* Chat Models Tab — Tier Assignment */}
                {activeTab === 'chatModels' && (
                    <ChatModelTiersConfig allModels={allModels} />
                )}

                {/* Embeddings Tab — global embedding provider + model picker */}
                {activeTab === 'embeddings' && (
                    <EmbeddingsConfig providers={providers} allModels={allModels} fetchAllModels={fetchAllModels} />
                )}

                {/* Direct Chat Tab — System Prompt only */}
                {activeTab === 'directChat' && (
                    <DirectChatConfig />
                )}

                {/* Ticket Assistant Tiers Tab — per-stage model tier picker */}
                {activeTab === 'ticketAssistantTiers' && (
                    <TicketAssistantTiersConfig />
                )}

                {/* Web Search Inference Tab — embed inherits global, rerank method-only, cleanup uses chat-model picker */}
                {activeTab === 'webSearchInference' && (
                    <WebSearchInferenceConfig allModels={allModels} onNavigateToTab={setActiveTab} />
                )}

                {/* Limits Tab — runtime caps applied to chat surfaces */}
                {activeTab === 'limits' && (
                    <LimitsConfig onNavigateToTab={setActiveTab} />
                )}

            </div>
        </div >
    );
};

export default AIConfigPanel;
