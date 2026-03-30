import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../../utils/helpers';
import { MISTRAL_MODEL_META, getModelMeta, CAT_COLORS } from './modelMeta';
import EmbeddingsConfig from './EmbeddingsConfig';
import OCRConfig from './OCRConfig';
import RerankerConfig from './RerankerConfig';

import DirectChatConfig from './DirectChatConfig';
import ModelCostsConfig from './ModelCostsConfig';
import MistralApiKeyCard from './ProviderCards/MistralCard';
import OpenAIApiKeyCard from './ProviderCards/OpenAICard';
import ClaudeApiKeyCard from './ProviderCards/ClaudeCard';
import GoogleApiKeyCard from './ProviderCards/GoogleCard';
import ElevenLabsApiKeyCard from './ProviderCards/ElevenLabsCard';
import AzureConfigCard from './ProviderCards/AzureCard';
import GoogleVertexConfigCard from './ProviderCards/GoogleVertexCard';
import MiniMaxApiKeyCard from './ProviderCards/MiniMaxCard';
import ChatModelTiersConfig from '../ChatModelTiersConfig';


const AIConfigPanel = () => {
    const { t } = useTranslation();
    // Navigation State
    const [activeTab, setActiveTab] = useState('providers');

    // Providers State
    const [providers, setProviders] = useState([]);
    const [defaultProviderId, setDefaultProviderId] = useState(null);
    const [presets, setPresets] = useState({});
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProvider, setEditingProvider] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [form, setForm] = useState({ name: '', type: 'custom', url: '', model: '', apiKey: '' });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    // Models State
    const [allModels, setAllModels] = useState([]);
    const [modelAliases, setModelAliases] = useState({});

    const [loadingModels, setLoadingModels] = useState(false);
    const [editingModel, setEditingModel] = useState(null);
    const [modelAlias, setModelAlias] = useState('');

    useEffect(() => {
        fetchProviders();
        loadModelAliases();
    }, []);

    useEffect(() => {
        if ((activeTab === 'models' || activeTab === 'chatModels') && providers.length > 0) {
            fetchAllModels();
        }
    }, [activeTab, providers]);

    const fetchProviders = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/providers`);
            if (res.ok) {
                const data = await res.json();
                setProviders(data.providers || []);
                setDefaultProviderId(data.defaultProviderId);
                setPresets(data.presets || {});
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

    const loadModelAliases = () => {
        try {
            const stored = localStorage.getItem('modelAliases');
            if (stored) setModelAliases(JSON.parse(stored));

        } catch (e) { }
    };

    const saveModelAlias = (modelId, alias) => {
        const updated = { ...modelAliases, [modelId]: alias };
        setModelAliases(updated);
        localStorage.setItem('modelAliases', JSON.stringify(updated));
        setEditingModel(null);
        setModelAlias('');
        setMessage({ type: 'success', text: 'Model alias saved!' });
    };



    const handleTypeChange = (type) => {
        const preset = presets[type];
        setForm(prev => ({
            ...prev,
            type,
            name: preset?.name || prev.name,
            url: preset?.url || prev.url
        }));
    };

    const handleAdd = async () => {
        if (!form.name || !form.url) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/providers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            if (res.ok) {
                const newProvider = await res.json();
                setProviders([...providers, newProvider]);
                if (!defaultProviderId) setDefaultProviderId(newProvider.id);
                setShowAddModal(false);
                resetForm();
                setMessage({ type: 'success', text: 'Provider added!' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to add provider' });
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingProvider || !form.name || !form.url) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/providers/${editingProvider.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            if (res.ok) {
                setProviders(providers.map(p => p.id === editingProvider.id ? { ...p, ...form, hasApiKey: p.hasApiKey || !!form.apiKey } : p));
                setEditingProvider(null);
                resetForm();
                setMessage({ type: 'success', text: 'Provider updated!' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to update provider' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (provider) => {
        try {
            const res = await authFetch(`${API_BASE}/ai/providers/${provider.id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setProviders(providers.filter(p => p.id !== provider.id));
                setDeleteConfirm(null);
                setMessage({ type: 'success', text: 'Provider deleted!' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to delete provider' });
        }
    };

    const handleSetDefault = async (providerId) => {
        try {
            const res = await authFetch(`${API_BASE}/ai/providers/${providerId}/default`, {
                method: 'POST',
            });
            if (res.ok) {
                setDefaultProviderId(providerId);
                setMessage({ type: 'success', text: 'Default provider updated!' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to set default' });
        }
    };

    const resetForm = () => {
        setForm({ name: '', type: 'custom', url: '', model: '', apiKey: '', apiVersion: '' });
    };

    const openEditModal = (provider) => {
        setEditingProvider(provider);
        setForm({
            name: provider.name,
            type: provider.type || 'custom',
            url: provider.url,
            model: provider.model || '',
            apiKey: '',
            apiVersion: provider.apiVersion || '',
        });
    };

    const getProviderIcon = (type) => {
        return '🌪️';
    };

    if (loading) return <div className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>Loading providers...</div>;

    const navItems = [
        { id: 'providers', labelKey: 'admin.ai_api_keys', icon: '🔑' },
        { id: 'models', labelKey: 'admin.ai_models', icon: '🧠' },

        { id: 'chatModels', labelKey: 'admin.ai_chat_models', icon: '🗨️' },
        { id: 'directChat', labelKey: 'admin.ai_direct_chat', icon: '💬' },
        { id: 'modelCosts', labelKey: 'admin.ai_model_costs', icon: '💰' },
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
                            {t(item.labelKey)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-[var(--bg-primary)]">
                {message && (
                    <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {message.text}
                    </div>
                )}

                {/* Models Tab */}
                {activeTab === 'models' && (
                    <div className="p-4 sm:p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>🧠</div>
                                <div>
                                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Models</h3>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        {allModels.length} models
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={fetchAllModels} disabled={loadingModels} className="px-3 py-1.5 rounded-lg text-xs transition-all hover:bg-white/10" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                                    {loadingModels ? '...' : '↻'}
                                </button>
                            </div>
                        </div>
                        {loadingModels ? (
                            <div className="text-center py-6" style={{ color: 'var(--text-muted)' }}>Loading models...</div>
                        ) : allModels.length === 0 ? (
                            <div className="text-center py-6" style={{ color: 'var(--text-muted)' }}>No models found</div>
                        ) : (
                            <div className="space-y-4">
                                {providers.map(provider => {
                                    const providerModels = allModels.filter(m => m.providerId === provider.id);
                                    if (providerModels.length === 0) return null;
                                    return (
                                        <div key={provider.id}>
                                            <h4 className="text-xs font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                                <span>{getProviderIcon(provider.type)}</span> {provider.name}
                                                <span className="opacity-60">({providerModels.length})</span>
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {providerModels.map(model => (
                                                    <div
                                                        key={`${provider.id}-${model.id}`}
                                                        className="group flex items-center gap-3 px-4 py-3 rounded-lg border transition-all hover:border-[var(--accent-primary)]"
                                                        style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            {editingModel === model.id ? (
                                                                <div className="flex gap-2">
                                                                    <input type="text" value={modelAlias} onChange={e => setModelAlias(e.target.value)} placeholder={model.name} className="flex-1 px-2 py-1 rounded text-sm outline-none min-w-0" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }} autoFocus onKeyDown={e => e.key === 'Enter' && saveModelAlias(model.id, modelAlias)} />
                                                                    <button onClick={() => saveModelAlias(model.id, modelAlias)} className="px-2 py-1 rounded text-xs bg-[var(--accent-primary)] text-white">Save</button>
                                                                    <button onClick={() => setEditingModel(null)} className="px-2 py-1 rounded text-xs" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>Cancel</button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }} title={model.name}>
                                                                            {modelAliases[model.id] || getModelMeta(model.id)?.name || model.name}
                                                                        </p>
                                                                        {getModelMeta(model.id)?.cat && (
                                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: CAT_COLORS[getModelMeta(model.id).cat] || 'rgba(107,114,128,0.2)', color: 'var(--text-muted)' }}>
                                                                                {getModelMeta(model.id).cat}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center justify-between mt-0.5">
                                                                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                                                            {getModelMeta(model.id)?.desc || model.id}
                                                                        </p>
                                                                        {(() => {
                                                                            const meta = getModelMeta(model.id);
                                                                            if (!meta) return null;
                                                                            if (meta.price) return <span className="text-[10px] whitespace-nowrap ml-2 px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }}>{meta.price}</span>;
                                                                            if (meta.input != null && meta.output != null) return <span className="text-[10px] whitespace-nowrap ml-2 px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }}>${meta.input} / ${meta.output}</span>;
                                                                            if (meta.input != null) return <span className="text-[10px] whitespace-nowrap ml-2 px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }}>${meta.input}/M</span>;
                                                                            if (meta.output != null) return <span className="text-[10px] whitespace-nowrap ml-2 px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }}>out ${meta.output}/M</span>;
                                                                            return null;
                                                                        })()}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Embeddings Tab */}
                {activeTab === 'embeddings' && (
                    <EmbeddingsConfig
                        providers={providers}
                        allModels={allModels}
                        fetchAllModels={fetchAllModels}
                    />
                )}

                {/* OCR Tab */}
                {activeTab === 'ocr' && (
                    <OCRConfig />
                )}



                {/* Providers Tab */}
                {activeTab === 'providers' && (
                    <>
                        <MistralApiKeyCard onMessage={setMessage} />
                        <OpenAIApiKeyCard onMessage={setMessage} />
                        <ClaudeApiKeyCard onMessage={setMessage} />
                        <GoogleApiKeyCard onMessage={setMessage} />
                        <ElevenLabsApiKeyCard onMessage={setMessage} />
                        <GoogleVertexConfigCard onMessage={setMessage} />
                        <AzureConfigCard onMessage={setMessage} />
                        <MiniMaxApiKeyCard onMessage={setMessage} />
                        <RerankerConfig onMessage={setMessage} />
                    </>
                )}

                {/* Model Costs Tab */}
                {activeTab === 'modelCosts' && (
                    <ModelCostsConfig />
                )}

                {/* Chat Models Tab */}
                {activeTab === 'chatModels' && (
                    <ChatModelTiersConfig allModels={allModels} />
                )}

                {/* Direct Chat Tab */}
                {activeTab === 'directChat' && (
                    <DirectChatConfig />
                )}

                {/* Add/Edit Modal */}
                {(showAddModal || editingProvider) && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        style={{ background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}
                        onClick={(e) => e.target === e.currentTarget && (setShowAddModal(false), setEditingProvider(null))}
                    >
                        <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}>
                            <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                                {editingProvider ? 'Edit Provider' : 'Add New Provider'}
                            </h3>
                            <div className="space-y-4">
                                {/* Type Selection */}
                                <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Provider Type</label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {Object.entries(presets).map(([key, preset]) => (
                                            <button
                                                key={key}
                                                onClick={() => handleTypeChange(key)}
                                                className={`p-2 rounded-lg text-center transition-all ${form.type === key ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
                                                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)' }}
                                                title={preset.name}
                                            >
                                                <span className="text-lg">{getProviderIcon(key)}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Name *</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={e => setForm({ ...form, name: e.target.value })}
                                        placeholder="My Provider"
                                        className="w-full px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)]"
                                        style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                </div>

                                {/* URL */}
                                <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>API URL *</label>
                                    <input
                                        type="text"
                                        value={form.url}
                                        onChange={e => setForm({ ...form, url: e.target.value })}
                                        placeholder="http://localhost:11434"
                                        className="w-full px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)]"
                                        style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                </div>

                                {/* Model */}
                                <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Model Name</label>
                                    <input
                                        type="text"
                                        value={form.model}
                                        onChange={e => setForm({ ...form, model: e.target.value })}
                                        placeholder="llama3:8b"
                                        className="w-full px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)]"
                                        style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                </div>

                                {/* API Key */}
                                <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                                        API Key <span className="text-xs opacity-60">(optional for local providers)</span>
                                    </label>
                                    <input
                                        type="password"
                                        value={form.apiKey}
                                        onChange={e => setForm({ ...form, apiKey: e.target.value })}
                                        placeholder={editingProvider?.hasApiKey ? '••••••••' : 'sk-...'}
                                        className="w-full px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)]"
                                        style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                </div>

                                {/* Azure-specific: API Version */}
                                {form.type === 'azure' && (
                                    <div>
                                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                                            API Version <span className="text-xs opacity-60">(e.g. 2025-04-01-preview)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={form.apiVersion || ''}
                                            onChange={e => setForm({ ...form, apiVersion: e.target.value })}
                                            placeholder="2025-04-01-preview"
                                            className="w-full px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)]"
                                            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => { setShowAddModal(false); setEditingProvider(null); }}
                                    className="flex-1 py-2.5 rounded-xl font-medium transition-all"
                                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={editingProvider ? handleUpdate : handleAdd}
                                    disabled={!form.name || !form.url || saving}
                                    className="flex-1 py-2.5 rounded-xl font-medium text-white transition-all disabled:opacity-50"
                                    style={{ background: 'var(--accent-primary)' }}
                                >
                                    {saving ? 'Saving...' : editingProvider ? 'Save Changes' : 'Add Provider'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation */}
                {deleteConfirm && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        style={{ background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}
                        onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}
                    >
                        <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}>
                            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Delete Provider?</h3>
                            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                                Are you sure you want to delete "{deleteConfirm.name}"?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="flex-1 py-2.5 rounded-xl font-medium"
                                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDelete(deleteConfirm)}
                                    className="flex-1 py-2.5 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};

export default AIConfigPanel;
