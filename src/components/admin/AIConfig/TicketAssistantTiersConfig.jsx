import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';

const STANDARD_TIERS = [
    { id: 'fast', label: 'Fast', icon: '⚡' },
    { id: 'thinking', label: 'Thinking', icon: '🧠' },
    { id: 'writer', label: 'Writer', icon: '✍️' },
    { id: 'pro', label: 'Deep Thinking', icon: '✨' },
];

const STAGES = [
    { key: 'article', label: 'Article generation', desc: 'Turns a cleaned ticket/email into a KB article with Root Cause + Resolution sections.' },
    { key: 'category', label: 'Categorisation', desc: 'Labels the generated article with a category and ITIL type.' },
    { key: 'merge', label: 'Category merge', desc: 'Merges multiple articles into a per-category KB document.' },
];

const TicketAssistantTiersConfig = () => {
    const [config, setConfig] = useState({ article: 'fast', category: 'fast', merge: 'fast' });
    const [customTiers, setCustomTiers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const [cfgRes, tiersRes] = await Promise.all([
                    authFetch(`${API_BASE}/ai/config/ticket-assistant-tiers`),
                    authFetch(`${API_BASE}/ai/config/custom-tiers-list`),
                ]);
                if (cfgRes.ok) setConfig(await cfgRes.json());
                if (tiersRes.ok) {
                    const data = await tiersRes.json();
                    setCustomTiers(Array.isArray(data.tiers) ? data.tiers : []);
                }
            } catch (e) {
                console.error('Failed to load Ticket Assistant tiers:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Only custom tiers with email_kb in allowedTaskTypes are available here.
    const availableCustom = customTiers.filter(t => Array.isArray(t.allowedTaskTypes) && t.allowedTaskTypes.includes('email_kb'));

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config/ticket-assistant-tiers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            if (res.ok) setMessage({ type: 'success', text: 'Ticket Assistant tiers saved!' });
            else setMessage({ type: 'error', text: 'Failed to save' });
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
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'rgba(236, 72, 153, 0.15)' }}>
                        🎫
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>ITIL Ticket Assistant — Model Tiers</h3>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            Pick a tier for each stage of the Ticket Assistant pipeline. Custom tiers appear here only if you enabled them for the "email_kb" task type in Chat Models.
                        </p>
                    </div>
                </div>
            </div>

            {message && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {message.text}
                </div>
            )}

            <div className="space-y-4">
                {STAGES.map(stage => (
                    <div key={stage.key} className="rounded-xl border p-4" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                        <div className="flex items-start justify-between gap-4 mb-3">
                            <div>
                                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{stage.label}</div>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stage.desc}</p>
                            </div>
                        </div>
                        <select
                            value={config[stage.key] || 'fast'}
                            onChange={e => setConfig(prev => ({ ...prev, [stage.key]: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        >
                            <optgroup label="Standard tiers">
                                {STANDARD_TIERS.map(t => (
                                    <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
                                ))}
                            </optgroup>
                            {availableCustom.length > 0 && (
                                <optgroup label="Custom tiers (ticket-assistant enabled)">
                                    {availableCustom.map(t => (
                                        <option key={t.id} value={t.id}>{t.icon || '✨'} {t.label}</option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    </div>
                ))}
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="mt-6 px-6 py-2.5 rounded-lg font-medium text-sm transition-all text-white hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--accent-primary)' }}
            >
                {saving ? 'Saving...' : 'Save Ticket Assistant Tiers'}
            </button>
        </div>
    );
};

export default TicketAssistantTiersConfig;
