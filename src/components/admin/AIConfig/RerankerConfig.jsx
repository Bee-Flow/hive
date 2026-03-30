import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';

const RerankerConfig = ({ onMessage }) => {
    const [endpoint, setEndpoint] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('Cohere-rerank-v4.0-fast');
    const [hasEndpoint, setHasEndpoint] = useState(false);
    const [hasKey, setHasKey] = useState(false);
    const [savedModel, setSavedModel] = useState('');
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [confirmDeleteKey, setConfirmDeleteKey] = useState(false);
    const [confirmDeleteEndpoint, setConfirmDeleteEndpoint] = useState(false);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config`);
            if (res.ok) {
                const data = await res.json();
                setHasEndpoint(!!data.hasAzureRerankerEndpoint);
                setHasKey(!!data.hasAzureRerankerKey);
                if (data.azureRerankerModel) {
                    setSavedModel(data.azureRerankerModel);
                    setModel(data.azureRerankerModel);
                }
            }
        } catch (e) {
            console.error('Failed to fetch reranker status:', e);
        }
    };

    const handleSave = async () => {
        if (!endpoint.trim() && !apiKey.trim() && model === savedModel) return;
        setSaving(true);
        try {
            const body = {};
            if (endpoint.trim()) body.azureRerankerEndpoint = endpoint;
            if (apiKey.trim()) body.azureRerankerKey = apiKey;
            body.azureRerankerModel = model.trim() || 'Cohere-rerank-v4.0-fast';

            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                if (endpoint.trim()) setHasEndpoint(true);
                if (apiKey.trim()) setHasKey(true);
                setSavedModel(model.trim() || 'Cohere-rerank-v4.0-fast');
                setEndpoint('');
                setApiKey('');
                onMessage?.({ type: 'success', text: 'Reranker config saved!' });
            } else {
                onMessage?.({ type: 'error', text: 'Failed to save reranker config' });
            }
        } catch (e) {
            onMessage?.({ type: 'error', text: 'Failed to save reranker config' });
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config/test-reranker`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (res.ok && data.success) {
                onMessage?.({ type: 'success', text: `Reranker working! Latency: ${data.latencyMs}ms` });
            } else {
                onMessage?.({ type: 'error', text: data.error || 'Reranker test failed' });
            }
        } catch (e) {
            onMessage?.({ type: 'error', text: `Reranker test failed: ${e.message}` });
        } finally {
            setTesting(false);
        }
    };

    const handleDeleteKey = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/key/azure_reranker_key`, { method: 'DELETE' });
            if (res.ok) {
                setHasKey(false);
                setApiKey('');
                setConfirmDeleteKey(false);
                onMessage?.({ type: 'success', text: 'Reranker API key removed' });
            } else {
                onMessage?.({ type: 'error', text: 'Failed to delete reranker API key' });
            }
        } catch (e) {
            onMessage?.({ type: 'error', text: 'Failed to delete reranker API key' });
        }
    };

    const handleDeleteEndpoint = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/setting/azure_reranker_endpoint`, { method: 'DELETE' });
            if (res.ok) {
                setHasEndpoint(false);
                setEndpoint('');
                setConfirmDeleteEndpoint(false);
                onMessage?.({ type: 'success', text: 'Reranker endpoint removed' });
            } else {
                onMessage?.({ type: 'error', text: 'Failed to delete reranker endpoint' });
            }
        } catch (e) {
            onMessage?.({ type: 'error', text: 'Failed to delete reranker endpoint' });
        }
    };

    const isConfigured = hasEndpoint && hasKey;

    return (
        <div className="mb-6 p-5 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, rgba(234,88,12,0.2), rgba(249,115,22,0.2))' }}>
                    🎯
                </div>
                <div className="flex-1">
                    <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>Azure Cohere Reranker</h4>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {isConfigured ? '✅ Configured — Knowledge Base search results are reranked' : 'Improve Knowledge Base search accuracy with neural reranking'}
                    </p>
                </div>
                <div className="flex gap-1.5">
                    {hasEndpoint && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Endpoint</span>}
                    {hasKey && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Key</span>}
                    {savedModel && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">{savedModel}</span>}
                </div>
            </div>
            <div className="space-y-3">
                {/* Endpoint URL */}
                <div>
                    <input
                        type="text"
                        value={endpoint}
                        onChange={e => setEndpoint(e.target.value)}
                        placeholder={hasEndpoint ? '••••••••••••••••' : 'https://your-resource.services.ai.azure.com'}
                        className="w-full px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />
                </div>

                {/* API Key + Model row */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            type={showKey ? 'text' : 'password'}
                            value={apiKey}
                            onChange={e => setApiKey(e.target.value)}
                            placeholder={hasKey ? '••••••••••••••••' : 'Azure API Key'}
                            className="w-full px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm pr-10"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--text-muted)' }}
                            tabIndex={-1}
                        >
                            {showKey ? '🙈' : '👁️'}
                        </button>
                    </div>
                    <select
                        value={model}
                        onChange={e => setModel(e.target.value)}
                        className="w-64 px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        title="Reranker model deployment name"
                    >
                        <option value="Cohere-rerank-v4.0-fast">Cohere-rerank-v4.0-fast</option>
                        <option value="Cohere-rerank-v4.0-pro">Cohere-rerank-v4.0-pro</option>
                    </select>
                </div>

                {/* Help + Actions */}
                <div className="flex items-center justify-between">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Deploy from <a href="https://ai.azure.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--accent-primary)]">Azure AI Foundry</a> → Model catalog → Cohere-rerank
                    </p>
                    <div className="flex gap-2 items-center">
                        {hasEndpoint && !confirmDeleteEndpoint && (
                            <button onClick={() => setConfirmDeleteEndpoint(true)} className="px-3 py-2 rounded-lg text-xs transition-all hover:bg-red-500/20" style={{ color: 'var(--text-muted)' }} title="Remove endpoint">
                                🗑️ Endpoint
                            </button>
                        )}
                        {confirmDeleteEndpoint && (
                            <>
                                <button onClick={handleDeleteEndpoint} className="px-3 py-2 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30">Confirm</button>
                                <button onClick={() => setConfirmDeleteEndpoint(false)} className="px-2 py-2 rounded-lg text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
                            </>
                        )}
                        {hasKey && !confirmDeleteKey && (
                            <button onClick={() => setConfirmDeleteKey(true)} className="px-3 py-2 rounded-lg text-xs transition-all hover:bg-red-500/20" style={{ color: 'var(--text-muted)' }} title="Remove API key">
                                🗑️ Key
                            </button>
                        )}
                        {confirmDeleteKey && (
                            <>
                                <button onClick={handleDeleteKey} className="px-3 py-2 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30">Confirm</button>
                                <button onClick={() => setConfirmDeleteKey(false)} className="px-2 py-2 rounded-lg text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
                            </>
                        )}
                        {isConfigured && (
                            <button
                                onClick={handleTest}
                                disabled={testing}
                                className="px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-white/10"
                                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                            >
                                {testing ? '...' : '🧪 Test'}
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={saving || (!endpoint.trim() && !apiKey.trim() && model === savedModel)}
                            className="px-5 py-2.5 rounded-lg font-medium text-white text-sm transition-all disabled:opacity-50"
                            style={{ background: 'var(--accent-primary)' }}
                        >
                            {saving ? '...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RerankerConfig;
