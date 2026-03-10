import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';

const ModelCostsConfig = () => {
    const [costs, setCosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [edits, setEdits] = useState({});  // { model: { input, output } }
    const [filter, setFilter] = useState('');

    useEffect(() => {
        fetchCosts();
    }, []);

    const fetchCosts = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/model-costs-config`);
            if (res.ok) {
                const data = await res.json();
                setCosts(data.costs || []);
            }
        } catch (e) {
            console.error('Failed to fetch model costs:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (model, field, value) => {
        setEdits(prev => ({
            ...prev,
            [model]: {
                ...(prev[model] || {}),
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        const changes = Object.entries(edits).map(([model, vals]) => ({
            model,
            input: parseFloat(vals.input ?? costs.find(c => c.model === model)?.input ?? 0),
            output: parseFloat(vals.output ?? costs.find(c => c.model === model)?.output ?? 0),
        })).filter(c => !isNaN(c.input) && !isNaN(c.output));

        if (changes.length === 0) return;

        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/model-costs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ costs: changes })
            });
            if (res.ok) {
                const data = await res.json();
                setMessage({ type: 'success', text: `Saved ${data.updated} cost override(s)` });
                setEdits({});
                fetchCosts(); // reload
            } else {
                setMessage({ type: 'error', text: 'Failed to save' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to save costs' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const handleReset = async (model) => {
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/model-costs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ costs: [{ model, reset: true }] })
            });
            if (res.ok) {
                setEdits(prev => { const n = { ...prev }; delete n[model]; return n; });
                setMessage({ type: 'success', text: `Reset ${model} to default` });
                fetchCosts();
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to reset' });
        } finally {
            setSaving(false);
            setTimeout(() => setMessage(null), 3000);
        }
    };

    const getValue = (item, field) => {
        if (edits[item.model]?.[field] !== undefined) return edits[item.model][field];
        return item[field];
    };

    const hasEdits = Object.keys(edits).length > 0;
    const filtered = filter
        ? costs.filter(c => c.model.toLowerCase().includes(filter.toLowerCase()) || (c.provider || '').toLowerCase().includes(filter.toLowerCase()))
        : costs;

    if (loading) return <div className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>Loading costs...</div>;

    return (
        <div className="p-4 sm:p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>💰</div>
                    <div>
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Model Costs</h3>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Per-model pricing ($/1M tokens) · used for cost monitoring
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {message && (
                        <span className={`text-xs px-3 py-1 rounded-full ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {message.text}
                        </span>
                    )}
                    {hasEdits && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 rounded-lg font-medium text-white text-sm transition-all disabled:opacity-50"
                            style={{ background: 'var(--accent-primary)' }}
                        >
                            {saving ? 'Saving...' : `Save ${Object.keys(edits).length} Change(s)`}
                        </button>
                    )}
                </div>
            </div>

            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    placeholder="Filter models..."
                    className="w-full max-w-xs px-3 py-2 rounded-lg border outline-none focus:border-[var(--accent-primary)] text-sm"
                    style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                />
            </div>

            {/* Table */}
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-default)' }}>
                {/* Header row */}
                <div className="grid gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{
                    gridTemplateColumns: '2fr 1fr 120px 120px 80px',
                    background: 'var(--bg-tertiary)', color: 'var(--text-muted)',
                }}>
                    <span>Model</span>
                    <span>Provider</span>
                    <span style={{ textAlign: 'center' }}>Input $/1M</span>
                    <span style={{ textAlign: 'center' }}>Output $/1M</span>
                    <span style={{ textAlign: 'center' }}>Status</span>
                </div>

                {/* Rows */}
                <div style={{ maxHeight: '500px', overflow: 'auto' }}>
                    {filtered.map((item, i) => {
                        const isEdited = edits[item.model] !== undefined;
                        const meta = getModelMeta(item.model);
                        const rowKey = item.provider ? `${item.provider}::${item.model}` : item.model;
                        return (
                            <div
                                key={rowKey}
                                className="grid gap-3 px-4 py-2.5 items-center transition-colors"
                                style={{
                                    gridTemplateColumns: '2fr 1fr 120px 120px 80px',
                                    background: i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)',
                                    borderTop: '1px solid var(--border-default)',
                                }}
                            >
                                {/* Model name */}
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                        {meta?.name || item.model}
                                    </span>
                                    {meta?.cat && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{
                                            background: CAT_COLORS[meta.cat] || 'rgba(107,114,128,0.2)',
                                            color: 'var(--text-muted)',
                                        }}>
                                            {meta.cat}
                                        </span>
                                    )}
                                    {item.isCustom && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium whitespace-nowrap">custom</span>
                                    )}
                                </div>
                                {/* Provider */}
                                <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                    {item.provider || '—'}
                                </span>

                                {/* Input cost */}
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={getValue(item, 'input')}
                                    onChange={e => handleEdit(item.model, 'input', e.target.value)}
                                    className="w-full px-2 py-1.5 rounded border text-sm text-center outline-none focus:border-[var(--accent-primary)]"
                                    style={{
                                        background: isEdited ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-secondary)',
                                        borderColor: isEdited ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-default)',
                                        color: 'var(--text-primary)',
                                    }}
                                />

                                {/* Output cost */}
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={getValue(item, 'output')}
                                    onChange={e => handleEdit(item.model, 'output', e.target.value)}
                                    className="w-full px-2 py-1.5 rounded border text-sm text-center outline-none focus:border-[var(--accent-primary)]"
                                    style={{
                                        background: isEdited ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-secondary)',
                                        borderColor: isEdited ? 'rgba(245, 158, 11, 0.3)' : 'var(--border-default)',
                                        color: 'var(--text-primary)',
                                    }}
                                />

                                {/* Status / Reset */}
                                <div className="flex justify-center">
                                    {item.isCustom ? (
                                        <button
                                            onClick={() => handleReset(item.model)}
                                            className="text-[10px] px-2 py-1 rounded hover:bg-white/10 transition-colors"
                                            style={{ color: 'var(--text-muted)' }}
                                            title="Reset to default pricing"
                                        >
                                            ↩ Reset
                                        </button>
                                    ) : (
                                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>default</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                Edit costs inline and click Save. Custom overrides are highlighted with <span className="text-amber-400">amber</span>. Reset returns to LiteLLM default pricing.
            </p>
        </div>
    );
};

// Mistral API Key Card Component

export default ModelCostsConfig;
