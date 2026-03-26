import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../../../utils/helpers';

const GoogleApiKeyCard = ({ onMessage }) => {
    const [apiKey, setApiKey] = useState('');
    const [hasKey, setHasKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        fetchKeyStatus();
    }, []);

    const fetchKeyStatus = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config`);
            if (res.ok) {
                const data = await res.json();
                setHasKey(!!data.hasGoogleKey);
            }
        } catch (e) {
            console.error('Failed to fetch Google key status:', e);
        }
    };

    const handleSave = async () => {
        if (!apiKey.trim()) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ googleApiKey: apiKey })
            });
            if (res.ok) {
                setHasKey(true);
                setApiKey('');
                setShowKey(false);
                onMessage?.({ type: 'success', text: 'Google AI API key saved!' });
            } else {
                onMessage?.({ type: 'error', text: 'Failed to save API key' });
            }
        } catch (e) {
            onMessage?.({ type: 'error', text: 'Failed to save API key' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config/key/google_api_key`, { method: 'DELETE' });
            if (res.ok) {
                setHasKey(false);
                setApiKey('');
                setConfirmDelete(false);
                onMessage?.({ type: 'success', text: 'Google AI API key removed' });
            } else {
                onMessage?.({ type: 'error', text: 'Failed to delete API key' });
            }
        } catch (e) {
            onMessage?.({ type: 'error', text: 'Failed to delete API key' });
        }
    };

    return (
        <div className="mb-6 p-5 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, rgba(66,133,244,0.2), rgba(234,67,53,0.2), rgba(251,188,4,0.2), rgba(52,168,83,0.2))' }}>
                    ✨
                </div>
                <div className="flex-1">
                    <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>Google AI API Key</h4>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {hasKey ? '✅ API key configured' : 'Required for Gemini models + Image Generation'}
                    </p>
                </div>
                {hasKey && (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">Configured</span>
                )}
            </div>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder={hasKey ? '••••••••••••••••' : 'Enter your Google AI API key'}
                        className="w-full px-4 py-2.5 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm pr-10"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        onKeyDown={e => e.key === 'Enter' && handleSave()}
                    />
                    <button
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10"
                        style={{ color: 'var(--text-muted)' }}
                        title={showKey ? 'Hide' : 'Show'}
                    >
                        {showKey ? '👁️' : '👁️‍🗨️'}
                    </button>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving || !apiKey.trim()}
                    className="px-5 py-2.5 rounded-lg font-medium text-white text-sm transition-all disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    {saving ? '...' : 'Save'}
                </button>
                {hasKey && !confirmDelete && (
                    <button
                        onClick={() => setConfirmDelete(true)}
                        className="px-3 py-2.5 rounded-lg text-sm transition-all hover:bg-red-500/20"
                        style={{ color: 'var(--text-muted)' }}
                        title="Delete API key"
                    >
                        🗑️
                    </button>
                )}
                {confirmDelete && (
                    <>
                        <button
                            onClick={handleDelete}
                            className="px-3 py-2.5 rounded-lg text-sm font-medium transition-all bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        >
                            Confirm
                        </button>
                        <button
                            onClick={() => setConfirmDelete(false)}
                            className="px-3 py-2.5 rounded-lg text-sm transition-all"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            ✕
                        </button>
                    </>
                )}
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Get your API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--accent-primary)]">aistudio.google.com</a>
            </p>
        </div>
    );
};


export default GoogleApiKeyCard;
