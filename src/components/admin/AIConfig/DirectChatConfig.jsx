import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';

const DirectChatConfig = () => {
    const [systemPrompt, setSystemPrompt] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await authFetch(`${API_BASE}/ai/config/direct-chat`);
                if (res.ok) {
                    const data = await res.json();
                    setSystemPrompt(data.systemPrompt || '');
                }
            } catch (e) {
                console.error('Failed to fetch direct chat config:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config/direct-chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ systemPrompt })
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'System prompt saved!' });
            } else {
                setMessage({ type: 'error', text: 'Failed to save' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to save' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    if (loading) return <div className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>Loading...</div>;

    return (
        <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
                        💬
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Direct Chat Settings</h3>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Configure the system prompt for Direct Chat</p>
                    </div>
                </div>
                {message && (
                    <span className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                        {message.text}
                    </span>
                )}
            </div>

            <div className="space-y-4 max-w-3xl">
                <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>System Prompt</label>
                    <textarea
                        value={systemPrompt}
                        onChange={e => setSystemPrompt(e.target.value)}
                        placeholder="You are a helpful AI assistant. Respond thoughtfully and concisely."
                        rows={8}
                        className="w-full px-4 py-3 rounded-lg border outline-none focus:border-[var(--accent-primary)] resize-y font-mono text-sm leading-relaxed"
                        style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', minHeight: '120px' }}
                    />
                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                        This prompt defines the AI personality for Direct Chat. The current date and available tools are appended automatically.
                        Leave empty to use the default.
                    </p>
                </div>

                <div className="pt-2">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2.5 rounded-xl font-medium text-white transition-all disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {saving ? 'Saving...' : 'Save System Prompt'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DirectChatConfig;
