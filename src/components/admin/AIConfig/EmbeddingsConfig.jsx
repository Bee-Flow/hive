import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';

const EmbeddingsConfig = ({ providers, allModels, fetchAllModels }) => {
    const [config, setConfig] = useState({ embeddingProviderId: '', embeddingModel: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        fetchConfig();
        // Ensure models are loaded
        if (allModels.length === 0 && providers.length > 0) {
            fetchAllModels();
        }
    }, [providers]); // Refetch if providers change

    const fetchConfig = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config`);
            if (res.ok) {
                const data = await res.json();
                setConfig({
                    embeddingProviderId: data.embeddingProviderId || '',
                    embeddingModel: data.embeddingModel || ''
                });
            }
        } catch (e) {
            console.error('Failed to fetch config:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Embedding settings saved!' });
            } else {
                setMessage({ type: 'error', text: 'Failed to save settings' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    // Filter models based on selected provider
    const providerModels = config.embeddingProviderId
        ? allModels.filter(m => m.providerId === config.embeddingProviderId)
        : [];

    // Azure embedding model is a deployment name and must be typed manually
    const selectedProvider = providers.find(p => p.id === config.embeddingProviderId);
    const isAzure = selectedProvider?.type === 'azure';
    const useModelDropdown = providerModels.length > 0 && !isAzure;

    if (loading) return <div className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>Loading settings...</div>;

    return (
        <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
                        🔍
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Embedding Configuration</h3>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Configure vectors for Knowledge Base</p>
                    </div>
                </div>
                {message && (
                    <span className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                        {message.text}
                    </span>
                )}
            </div>

            <div className="space-y-6 max-w-2xl">
                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Embedding Provider</label>
                    <select
                        value={config.embeddingProviderId}
                        onChange={e => setConfig({ ...config, embeddingProviderId: e.target.value, embeddingModel: '' })}
                        className="w-full px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)]"
                        style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    >
                        <option value="">Select Provider...</option>
                        {providers.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Embedding Model</label>
                    {useModelDropdown ? (
                        <select
                            value={config.embeddingModel}
                            onChange={e => setConfig({ ...config, embeddingModel: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)]"
                            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        >
                            <option value="">Select Model...</option>
                            {providerModels.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            value={config.embeddingModel}
                            onChange={e => setConfig({ ...config, embeddingModel: e.target.value })}
                            placeholder={isAzure ? 'Your Azure deployment name, e.g. text-embedding-3-small' : 'e.g. text-embedding-3-small'}
                            className="w-full px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)]"
                            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        />
                    )}
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {isAzure
                            ? 'For Azure, enter the deployment name of your embedding model (not the base model name).'
                            : 'For Mistral, "mistral-embed" is recommended.'}
                    </p>
                </div>

                <div className="pt-4">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2.5 rounded-xl font-medium text-white transition-all disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {saving ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmbeddingsConfig;
