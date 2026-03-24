import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../../../utils/helpers';

const MiniMaxApiKeyCard = ({ onMessage }) => {
    const [apiKey, setApiKey] = useState('');
    const [hasKey, setHasKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showKey, setShowKey] = useState(false);

    useEffect(() => {
        fetchKeyStatus();
    }, []);

    const fetchKeyStatus = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config`);
            if (res.ok) {
                const data = await res.json();
                setHasKey(!!data.hasMinimaxKey);
            }
        } catch (e) {
            console.error('Failed to fetch API key status:', e);
        }
    };

    const handleSave = async () => {
        if (!apiKey.trim()) return;
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ minimaxApiKey: apiKey })
            });
            if (res.ok) {
                setHasKey(true);
                setApiKey('');
                setShowKey(false);
                onMessage?.({ type: 'success', text: 'MiniMax API key saved!' });
            } else {
                onMessage?.({ type: 'error', text: 'Failed to save API key' });
            }
        } catch (e) {
            onMessage?.({ type: 'error', text: 'Failed to save API key' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mb-6 p-5 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: 'rgba(234, 179, 8, 0.15)' }}>
                    ⚡
                </div>
                <div className="flex-1">
                    <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>MiniMax API Key</h4>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {hasKey ? '✅ API key configured' : 'Required for MiniMax AI models'}
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
                        placeholder={hasKey ? '••••••••••••••••' : 'Enter your MiniMax API key'}
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
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Get your API key from <a href="https://platform.minimax.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--accent-primary)]">platform.minimax.io</a>
            </p>
        </div>
    );
};

export default MiniMaxApiKeyCard;
