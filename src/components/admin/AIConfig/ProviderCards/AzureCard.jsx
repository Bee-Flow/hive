import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../../../utils/helpers';

const AzureConfigCard = ({ onMessage }) => {
    const [endpoint, setEndpoint] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [apiVersion, setApiVersion] = useState('2025-04-01-preview');
    const [models, setModels] = useState('');
    const [hasEndpoint, setHasEndpoint] = useState(false);
    const [hasKey, setHasKey] = useState(false);
    const [savedModels, setSavedModels] = useState('');
    const [saving, setSaving] = useState(false);
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
                setHasEndpoint(!!data.hasAzureEndpoint);
                setHasKey(!!data.hasAzureApiKey);
                if (data.azureApiVersion) setApiVersion(data.azureApiVersion);
                if (data.azureModels) {
                    setSavedModels(data.azureModels);
                    setModels(data.azureModels);
                }
            }
        } catch (e) {
            console.error('Failed to fetch Azure AI status:', e);
        }
    };

    const handleSave = async () => {
        if (!endpoint.trim() && !apiKey.trim() && !models.trim()) return;
        setSaving(true);
        try {
            const body = {};
            if (endpoint.trim()) body.azureEndpoint = endpoint;
            if (apiKey.trim()) body.azureApiKey = apiKey;
            body.azureApiVersion = apiVersion;
            body.azureModels = models.trim();

            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                if (endpoint.trim()) setHasEndpoint(true);
                if (apiKey.trim()) setHasKey(true);
                setSavedModels(models.trim());
                setEndpoint('');
                setApiKey('');
                onMessage?.({ type: 'success', text: 'Azure AI config saved!' });
            } else {
                onMessage?.({ type: 'error', text: 'Failed to save config' });
            }
        } catch (e) {
            onMessage?.({ type: 'error', text: 'Failed to save config' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteKey = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/key/azure_api_key`, { method: 'DELETE' });
            if (res.ok) {
                setHasKey(false);
                setApiKey('');
                setConfirmDeleteKey(false);
                onMessage?.({ type: 'success', text: 'Azure API key removed' });
            } else {
                onMessage?.({ type: 'error', text: 'Failed to delete Azure API key' });
            }
        } catch (e) {
            onMessage?.({ type: 'error', text: 'Failed to delete Azure API key' });
        }
    };

    const handleDeleteEndpoint = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/setting/azure_endpoint`, { method: 'DELETE' });
            if (res.ok) {
                setHasEndpoint(false);
                setEndpoint('');
                setConfirmDeleteEndpoint(false);
                onMessage?.({ type: 'success', text: 'Azure endpoint removed' });
            } else {
                onMessage?.({ type: 'error', text: 'Failed to delete Azure endpoint' });
            }
        } catch (e) {
            onMessage?.({ type: 'error', text: 'Failed to delete Azure endpoint' });
        }
    };

    const isConfigured = hasEndpoint && hasKey;
    const modelCount = savedModels ? savedModels.split(',').filter(m => m.trim()).length : 0;

    return (
        <div className="mb-6 p-5 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, rgba(0,120,212,0.2), rgba(0,153,255,0.2))' }}>
                    🔷
                </div>
                <div className="flex-1">
                    <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>Azure AI</h4>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {isConfigured ? '✅ Fully configured' : 'Azure OpenAI Service'}
                    </p>
                </div>
                <div className="flex gap-1.5">
                    {hasEndpoint && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Endpoint</span>}
                    {hasKey && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Key</span>}
                    {modelCount > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">{modelCount} model{modelCount !== 1 ? 's' : ''}</span>}
                </div>
            </div>
            <div className="space-y-3">
                {/* Endpoint URL */}
                <div>
                    <input
                        type="text"
                        value={endpoint}
                        onChange={e => setEndpoint(e.target.value)}
                        placeholder={hasEndpoint ? '••••••••••••••••' : 'https://your-resource.openai.azure.com'}
                        className="w-full px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />
                </div>

                {/* API Key + API Version row */}
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
                    <input
                        type="text"
                        value={apiVersion}
                        onChange={e => setApiVersion(e.target.value)}
                        placeholder="2025-04-01-preview"
                        className="w-48 px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        title="API Version — optional. Leave blank to use the recommended default (2025-04-01-preview)."
                    />
                </div>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    API version is optional — leave blank for the recommended default (2025-04-01-preview),
                    which enables the Responses API (reasoning summaries) for GPT-5 / o-series deployments.
                </p>

                {/* Models input */}
                <div>
                    <input
                        type="text"
                        value={models}
                        onChange={e => setModels(e.target.value)}
                        placeholder="Deployment names, e.g. gpt-4o, gpt-4.1, o3-mini"
                        className="w-full px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        title="Comma-separated list of your Azure deployment names"
                    />
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        Comma-separated deployment names from your Azure portal
                    </p>
                </div>

                {/* Help + Save */}
                <div className="flex items-center justify-between">
                    <div className="flex gap-2 flex-wrap">
                        <p className="text-xs self-center" style={{ color: 'var(--text-muted)' }}>
                            Get from <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--accent-primary)]">portal.azure.com</a>
                        </p>
                    </div>
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
                        <button
                            onClick={handleSave}
                            disabled={saving || (!endpoint.trim() && !apiKey.trim() && models === savedModels)}
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


export default AzureConfigCard;
