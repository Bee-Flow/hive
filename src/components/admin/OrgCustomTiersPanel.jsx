import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';

const TASK_TYPES = [
    { key: 'direct_chat', label: 'Direct Chat' },
    { key: 'agent_chat', label: 'Agent Chat' },
];

const slugifyTierLabel = (label) => {
    const slug = String(label || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return slug ? `custom:${slug}` : '';
};

/**
 * Org-admin-facing custom tier editor. Operates on /ai/config/org-custom-chat-models
 * — tiers saved here are scoped to the caller's organisation only. Global custom
 * tiers (created by the super admin) are shown read-only for reference.
 */
const OrgCustomTiersPanel = () => {
    const [orgTiers, setOrgTiers] = useState([]);
    const [globalTiers, setGlobalTiers] = useState([]);
    const [availableModels, setAvailableModels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [tiersRes, providersRes] = await Promise.all([
                authFetch(`${API_BASE}/ai/config/org-custom-chat-models`),
                authFetch(`${API_BASE}/ai/providers`),
            ]);
            if (tiersRes.ok) {
                const data = await tiersRes.json();
                setOrgTiers(Array.isArray(data.orgTiers) ? data.orgTiers : []);
                setGlobalTiers(Array.isArray(data.globalTiers) ? data.globalTiers : []);
            } else if (tiersRes.status === 403) {
                setMessage({ type: 'error', text: 'You do not have permission to manage custom tiers for your organisation.' });
            }
            if (providersRes.ok) {
                const { providers } = await providersRes.json();
                const results = await Promise.all(
                    (providers || []).map(async (p) => {
                        try {
                            const r = await authFetch(`${API_BASE}/ai/providers/${p.id}/models`);
                            if (r.ok) {
                                const { models } = await r.json();
                                return (models || []).map(m => ({ ...m, providerName: p.name, providerType: p.type }));
                            }
                            return [];
                        } catch (_) { return []; }
                    })
                );
                setAvailableModels(results.flat());
            }
        } catch (e) {
            console.error('Failed to load org custom tiers:', e);
            setMessage({ type: 'error', text: 'Failed to load custom tiers.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadAll(); }, []);

    const addTier = () => {
        let n = orgTiers.length + 1;
        let placeholderId = `custom:org-tier-${n}`;
        while (orgTiers.some(t => t.id === placeholderId)) { n += 1; placeholderId = `custom:org-tier-${n}`; }
        const next = [
            ...orgTiers,
            {
                id: placeholderId,
                label: `New tier ${n}`,
                icon: '✨',
                description: '',
                modelId: '',
                euModelId: '',
                maxTokens: 16384,
                temperature: 0.7,
                allowedTaskTypes: ['direct_chat', 'agent_chat'],
            },
        ];
        setOrgTiers(next);
        setExpandedId(placeholderId);
    };

    const patch = (id, patchObj) => {
        setOrgTiers(prev => prev.map(t => t.id === id ? { ...t, ...patchObj } : t));
    };

    const rename = (currentId, newLabel) => {
        const newId = slugifyTierLabel(newLabel);
        setOrgTiers(prev => prev.map(t => {
            if (t.id !== currentId) return t;
            return { ...t, label: newLabel, id: newId || currentId };
        }));
        if (newId && newId !== currentId) setExpandedId(newId);
    };

    const remove = (id) => {
        if (!window.confirm('Delete this custom tier? This cannot be undone.')) return;
        setOrgTiers(prev => prev.filter(t => t.id !== id));
    };

    const toggleTaskType = (id, key) => {
        setOrgTiers(prev => prev.map(t => {
            if (t.id !== id) return t;
            const set = new Set(t.allowedTaskTypes || []);
            if (set.has(key)) set.delete(key);
            else set.add(key);
            return { ...t, allowedTaskTypes: Array.from(set) };
        }));
    };

    const save = async () => {
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/config/org-custom-chat-models`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tiers: orgTiers }),
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.tiers)) setOrgTiers(data.tiers);
                const warn = Array.isArray(data.warnings) && data.warnings.length > 0
                    ? ` (${data.warnings.join('; ')})`
                    : '';
                setMessage({ type: warn ? 'warning' : 'success', text: `Org custom tiers saved${warn}` });
            } else {
                const body = await res.json().catch(() => ({}));
                setMessage({ type: 'error', text: body.error || 'Failed to save' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to save' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 4000);
        }
    };

    if (loading) return <div className="text-sm p-4 text-[var(--text-muted)]">Loading custom tiers...</div>;

    return (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center justify-between">
                <div>
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">Organisation Custom Tiers</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        Create tiers scoped to this organisation. They appear alongside global tiers for your members.
                    </p>
                </div>
                <button
                    onClick={addTier}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[var(--accent-primary)] hover:opacity-90 transition-opacity"
                >
                    + Add Tier
                </button>
            </div>

            {message && (
                <div className={`mx-5 mt-4 p-3 rounded-lg text-sm ${
                    message.type === 'success' ? 'bg-green-500/20 text-green-400' :
                    message.type === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                }`}>
                    {message.text}
                </div>
            )}

            <div className="p-5 space-y-4">
                {orgTiers.length === 0 ? (
                    <div className="p-4 rounded-lg border text-center text-xs border-[var(--border-subtle)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                        No organisation-scoped tiers yet. Click <strong>Add Tier</strong> to create one.
                    </div>
                ) : (
                    orgTiers.map(tier => {
                        const isExpanded = expandedId === tier.id;
                        const taskTypes = new Set(tier.allowedTaskTypes || []);
                        const modelOption = availableModels.find(m => m.id === tier.modelId);
                        const euOption = availableModels.find(m => m.id === tier.euModelId);
                        return (
                            <div key={tier.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] overflow-hidden">
                                <div className="p-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <input
                                            type="text"
                                            value={tier.icon || ''}
                                            onChange={e => patch(tier.id, { icon: e.target.value.slice(0, 4) })}
                                            maxLength={4}
                                            className="w-12 text-center text-xl px-1 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] outline-none"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <input
                                                type="text"
                                                value={tier.label || ''}
                                                onChange={e => rename(tier.id, e.target.value)}
                                                placeholder="Tier name"
                                                className="w-full text-sm font-semibold px-2 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] outline-none"
                                            />
                                            <p className="text-[10px] mt-0.5 font-mono text-[var(--text-muted)]">{tier.id}</p>
                                        </div>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#eab308' }}>org</span>
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : tier.id)}
                                            className="text-xs px-2 py-1 rounded-lg hover:bg-white/10 text-[var(--text-muted)]"
                                        >
                                            {isExpanded ? '▲' : '▼'}
                                        </button>
                                        <button
                                            onClick={() => remove(tier.id)}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/20 text-[var(--text-muted)]"
                                            title="Delete"
                                        >✕</button>
                                    </div>

                                    <input
                                        type="text"
                                        value={tier.description || ''}
                                        onChange={e => patch(tier.id, { description: e.target.value })}
                                        placeholder="Short description (shown in tier picker)"
                                        className="w-full text-xs px-3 py-2 mb-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] outline-none"
                                    />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">Model</label>
                                            <select
                                                value={tier.modelId || ''}
                                                onChange={e => patch(tier.id, { modelId: e.target.value })}
                                                className="w-full px-3 py-2 mt-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm outline-none"
                                            >
                                                <option value="">— Not configured —</option>
                                                {availableModels.map(m => (
                                                    <option key={m.id} value={m.id}>{m.name || m.id} ({m.providerName})</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">EU override (optional)</label>
                                            <select
                                                value={tier.euModelId || ''}
                                                onChange={e => patch(tier.id, { euModelId: e.target.value })}
                                                className="w-full px-3 py-2 mt-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm outline-none"
                                            >
                                                <option value="">— Same as main model —</option>
                                                {availableModels.map(m => (
                                                    <option key={m.id} value={m.id}>{m.name || m.id} ({m.providerName})</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">
                                            Available for
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {TASK_TYPES.map(tt => {
                                                const active = taskTypes.has(tt.key);
                                                return (
                                                    <button
                                                        key={tt.key}
                                                        type="button"
                                                        onClick={() => toggleTaskType(tier.id, tt.key)}
                                                        className="px-2.5 py-1 rounded-full text-xs font-medium"
                                                        style={{
                                                            background: active ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                                            color: active ? '#fff' : 'var(--text-muted)',
                                                            border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                                                        }}
                                                    >
                                                        {active ? '✓ ' : ''}{tt.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-1 border-t border-[var(--border-subtle)] grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium mb-1 text-[var(--text-primary)]">Max Tokens</label>
                                            <input
                                                type="number"
                                                value={tier.maxTokens ?? 16384}
                                                onChange={e => patch(tier.id, { maxTokens: parseInt(e.target.value) || 16384 })}
                                                min={256} max={131072} step={256}
                                                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium mb-1 text-[var(--text-primary)]">Temperature</label>
                                            <input
                                                type="number"
                                                value={tier.temperature ?? 0.7}
                                                onChange={e => patch(tier.id, { temperature: parseFloat(e.target.value) || 0.7 })}
                                                min={0} max={2} step={0.1}
                                                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm outline-none"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}

                <button
                    onClick={save}
                    disabled={saving}
                    className="px-6 py-2.5 rounded-lg font-medium text-sm text-white bg-[var(--accent-primary)] hover:opacity-90 disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Organisation Tiers'}
                </button>

                {globalTiers.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-[var(--border-subtle)]">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Global tiers (read-only)</h4>
                        <p className="text-xs text-[var(--text-muted)] mb-3">
                            These tiers are provided by the system administrator. Your members can see them subject to the group permissions you've set.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {globalTiers.map(t => (
                                <div key={t.id} className="px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] flex items-center gap-2">
                                    <span className="text-lg">{t.icon || '✨'}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-[var(--text-primary)] truncate">{t.label}</div>
                                        <div className="text-[10px] text-[var(--text-muted)] truncate">{t.id}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrgCustomTiersPanel;
