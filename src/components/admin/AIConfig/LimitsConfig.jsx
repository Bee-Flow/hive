import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';

const PER_SURFACE_DEFAULTS = [
    { name: 'Direct chat', value: 5 },
    { name: 'Notebook chat', value: 5 },
    { name: 'Webpage chat', value: 10 },
    { name: 'Native streaming loop', value: 10 },
];

const LimitsConfig = () => {
    const [value, setValue] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => { fetchConfig(); }, []);

    const fetchConfig = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config`);
            if (res.ok) {
                const data = await res.json();
                setValue(data.maxToolRoundsChat ?? '');
            }
        } catch (e) {
            console.error('Failed to load limits:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const trimmed = String(value).trim();
            const payload = { maxToolRoundsChat: trimmed === '' ? null : parseInt(trimmed, 10) };
            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                setMessage({ type: 'success', text: trimmed === '' ? 'Cleared — using per-surface defaults' : `Saved — limit set to ${payload.maxToolRoundsChat}` });
                fetchConfig();
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

    return (
        <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
            <div className="mb-6">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Limits</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    Runtime caps applied to chat surfaces. Background agents (AI tasks, swarms, browser, automation builder) keep their own internal limits and are out of scope here.
                </p>
            </div>

            {message && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            <div className="rounded-xl border p-4" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Tool calls per chat turn</div>
                <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>
                    Maximum number of tool-call rounds the model is allowed before it must produce a final answer. Higher values let agents finish multi-step workflows; lower values keep latency and cost predictable. Applies uniformly to direct chat, notebook chat, webpage chat, and the native streaming loop.
                </p>

                <div className="flex items-center gap-3">
                    <input
                        type="number"
                        min="1"
                        max="50"
                        value={value}
                        onChange={e => setValue(e.target.value)}
                        placeholder="Use per-surface defaults"
                        className="w-48 px-3 py-2.5 rounded-lg border outline-none text-sm"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Range 1–50. Leave empty to use per-surface defaults.
                    </span>
                </div>

                <div className="mt-4">
                    <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                        Per-surface defaults (when empty)
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {PER_SURFACE_DEFAULTS.map(s => (
                            <div key={s.name} className="px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}>
                                <div style={{ color: 'var(--text-muted)' }}>{s.name}</div>
                                <div className="font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{s.value} rounds</div>
                            </div>
                        ))}
                    </div>
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

export default LimitsConfig;
