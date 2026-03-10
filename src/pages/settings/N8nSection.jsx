import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { Loader2, RefreshCw, Plus, Trash2, ChevronDown, ChevronRight, Check, X } from 'lucide-react';

const INPUT_TYPES = ['string', 'number', 'file', 'json'];

export default function N8nSection() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [n8nUrl, setN8nUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [hasApiKey, setHasApiKey] = useState(false);
    const [configured, setConfigured] = useState(false);
    const [workflows, setWorkflows] = useState([]);
    const [discoveredWorkflows, setDiscoveredWorkflows] = useState([]);
    const [discovering, setDiscovering] = useState(false);
    const [expandedWf, setExpandedWf] = useState(null);

    useEffect(() => { loadConfig(); }, []);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/n8n/config`);
            if (res.ok) {
                const data = await res.json();
                setN8nUrl(data.n8nUrl || '');
                setHasApiKey(data.hasApiKey);
                setConfigured(data.configured);
                setWorkflows(data.workflows || []);
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const saveConnection = async () => {
        setSaving(true);
        try {
            const body = { n8nUrl };
            if (apiKey) body.apiKey = apiKey;
            const res = await authFetch(`${API_BASE}/ai/n8n/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Connection saved' });
                setHasApiKey(true);
                setConfigured(!!(n8nUrl && (apiKey || hasApiKey)));
                setApiKey('');
            } else {
                const err = await res.json();
                setMessage({ type: 'error', text: err.error || 'Failed to save' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to save' });
        }
        setSaving(false);
        setTimeout(() => setMessage(null), 3000);
    };

    const discoverWorkflows = async () => {
        setDiscovering(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/n8n/workflows`);
            if (res.ok) {
                const data = await res.json();
                setDiscoveredWorkflows(data.workflows || []);
                setMessage({ type: 'success', text: `Found ${(data.workflows || []).length} webhook workflow(s)` });
            } else {
                const err = await res.json();
                setMessage({ type: 'error', text: err.error || 'Failed to fetch workflows' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Connection failed — check URL and API key' });
        }
        setDiscovering(false);
        setTimeout(() => setMessage(null), 4000);
    };

    // Auto-save helper — saves a given workflows array to the server
    const persistWorkflows = async (wfs) => {
        try {
            await authFetch(`${API_BASE}/ai/n8n/workflows`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workflows: wfs }),
            });
        } catch (e) { console.error('n8n auto-save failed:', e); }
    };

    const addWorkflow = (discovered) => {
        const wfNode = discovered.webhookNodes?.[0];
        const slug = discovered.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 50);
        if (workflows.some(w => w.id === discovered.id)) {
            setMessage({ type: 'error', text: 'Workflow already added' });
            setTimeout(() => setMessage(null), 2000);
            return;
        }
        const newWf = {
            id: discovered.id,
            name: discovered.name,
            slug,
            webhookPath: wfNode?.path || '',
            httpMethod: wfNode?.method || 'POST',
            enabled: true,
            description: `Run n8n workflow: ${discovered.name}`,
            inputs: [],
            outputs: [{ name: 'result', type: 'string', description: 'Workflow output' }],
        };
        const updated = [...workflows, newWf];
        setWorkflows(updated);
        setExpandedWf(discovered.id);
        persistWorkflows(updated);
        setMessage({ type: 'success', text: `Added "${discovered.name}"` });
        setTimeout(() => setMessage(null), 2000);
    };

    const removeWorkflow = (id) => {
        const updated = workflows.filter(w => w.id !== id);
        setWorkflows(updated);
        persistWorkflows(updated);
    };

    const updateWorkflow = (id, updates) => {
        setWorkflows(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
    };

    const addInput = (wfId) => {
        setWorkflows(prev => prev.map(w => {
            if (w.id !== wfId) return w;
            return { ...w, inputs: [...(w.inputs || []), { name: '', type: 'string', description: '', required: true }] };
        }));
    };

    const updateInput = (wfId, idx, updates) => {
        setWorkflows(prev => prev.map(w => {
            if (w.id !== wfId) return w;
            const inputs = [...(w.inputs || [])];
            inputs[idx] = { ...inputs[idx], ...updates };
            return { ...w, inputs };
        }));
    };

    const removeInput = (wfId, idx) => {
        setWorkflows(prev => prev.map(w => {
            if (w.id !== wfId) return w;
            const inputs = [...(w.inputs || [])];
            inputs.splice(idx, 1);
            return { ...w, inputs };
        }));
    };

    const saveWorkflows = async () => {
        setSaving(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/n8n/workflows`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workflows }),
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Workflows saved' });
            } else {
                const err = await res.json();
                setMessage({ type: 'error', text: err.error || 'Failed to save' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to save' });
        }
        setSaving(false);
        setTimeout(() => setMessage(null), 3000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-4" style={{ color: 'var(--text-muted)' }}>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {message && (
                <span className={`text-xs font-medium px-3 py-1.5 rounded-lg inline-block ${message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    {message.text}
                </span>
            )}

            {/* Connection fields */}
            <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>n8n Instance URL</label>
                <input
                    type="url" value={n8nUrl} onChange={e => setN8nUrl(e.target.value)}
                    placeholder="https://n8n.yourdomain.com"
                    className="w-full px-3 py-2 text-sm rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                />
            </div>
            <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>API Key</label>
                <input
                    type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                    placeholder={hasApiKey ? '••••••••••••••••' : 'Enter your n8n API key'}
                    className="w-full px-3 py-2 text-sm rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Generate at n8n → Settings → API → Create API Key
                </p>
            </div>
            <button onClick={saveConnection} disabled={saving || !n8nUrl}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                style={{ background: 'var(--accent-primary)', color: 'white' }}>
                {saving ? 'Saving...' : 'Save Connection'}
            </button>

            {/* Workflow Discovery */}
            {configured && (
                <div className="rounded-lg border p-3 space-y-3 mt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Discover Workflows</h4>
                        <button onClick={discoverWorkflows} disabled={discovering}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                            <RefreshCw className={`w-3 h-3 ${discovering ? 'animate-spin' : ''}`} />
                            {discovering ? 'Scanning...' : 'Refresh'}
                        </button>
                    </div>
                    {discoveredWorkflows.length > 0 && (
                        <div className="space-y-1.5">
                            {discoveredWorkflows.map(dw => {
                                const alreadyAdded = workflows.some(w => w.id === dw.id);
                                return (
                                    <div key={dw.id} className="flex items-center justify-between px-3 py-2 rounded-lg border"
                                        style={{ borderColor: 'var(--border-subtle)', background: alreadyAdded ? 'rgba(16, 185, 129, 0.04)' : 'transparent' }}>
                                        <div>
                                            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{dw.name}</div>
                                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                {dw.webhookNodes?.map(n => `${n.method || 'POST'} /webhook/${n.path}`).join(', ')}
                                            </div>
                                        </div>
                                        {alreadyAdded ? (
                                            <span className="text-xs font-medium flex items-center gap-1" style={{ color: '#10b981' }}>
                                                <Check className="w-3.5 h-3.5" /> Added
                                            </span>
                                        ) : (
                                            <button onClick={() => addWorkflow(dw)}
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                                                style={{ background: 'var(--accent-primary)', color: 'white' }}>
                                                <Plus className="w-3 h-3" /> Add
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Configured Workflows */}
            {workflows.length > 0 && (
                <div className="rounded-lg border overflow-hidden mt-2" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                        <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Workflows ({workflows.filter(w => w.enabled).length}/{workflows.length} enabled)
                        </h4>
                        <button onClick={saveWorkflows} disabled={saving}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                            style={{ background: 'var(--accent-primary)', color: 'white' }}>
                            {saving ? 'Saving...' : 'Save All'}
                        </button>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                        {workflows.map(wf => {
                            const isExpanded = expandedWf === wf.id;
                            return (
                                <div key={wf.id}>
                                    <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                                        onClick={() => setExpandedWf(isExpanded ? null : wf.id)}>
                                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{wf.name}</div>
                                            <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                                                n8n_run_{wf.slug} · {(wf.inputs || []).length} input(s)
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0" onClick={e => e.stopPropagation()}>
                                            <input type="checkbox" checked={wf.enabled} onChange={() => updateWorkflow(wf.id, { enabled: !wf.enabled })} className="sr-only peer" />
                                            <div className="w-8 h-4 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                                        </label>
                                        <button onClick={(e) => { e.stopPropagation(); removeWorkflow(wf.id); }}
                                            className="p-1 rounded-lg hover:bg-red-500/10 transition-colors" style={{ color: 'var(--text-muted)' }}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {isExpanded && (
                                        <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                                            <div className="pt-2 grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[11px] font-medium mb-0.5" style={{ color: 'var(--text-secondary)' }}>Display Name</label>
                                                    <input type="text" value={wf.name} onChange={e => updateWorkflow(wf.id, { name: e.target.value })}
                                                        className="w-full px-2 py-1 text-xs rounded border bg-transparent outline-none focus:border-[var(--accent-primary)]"
                                                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-medium mb-0.5" style={{ color: 'var(--text-secondary)' }}>Tool Slug</label>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[11px] shrink-0" style={{ color: 'var(--text-muted)' }}>n8n_run_</span>
                                                        <input type="text" value={wf.slug} onChange={e => updateWorkflow(wf.id, { slug: e.target.value.replace(/[^a-z0-9_]/g, '') })}
                                                            className="w-full px-2 py-1 text-xs rounded border bg-transparent outline-none focus:border-[var(--accent-primary)]"
                                                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-medium mb-0.5" style={{ color: 'var(--text-secondary)' }}>Description (shown to AI)</label>
                                                <input type="text" value={wf.description || ''} onChange={e => updateWorkflow(wf.id, { description: e.target.value })}
                                                    placeholder="Describe what this workflow does"
                                                    className="w-full px-2 py-1 text-xs rounded border bg-transparent outline-none focus:border-[var(--accent-primary)]"
                                                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                            </div>

                                            {/* Inputs */}
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Input Parameters</label>
                                                    <button onClick={() => addInput(wf.id)}
                                                        className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded hover:opacity-80"
                                                        style={{ color: 'var(--accent-primary)' }}>
                                                        <Plus className="w-3 h-3" /> Add
                                                    </button>
                                                </div>
                                                {(wf.inputs || []).length === 0 ? (
                                                    <p className="text-[11px] py-1" style={{ color: 'var(--text-muted)' }}>No inputs — AI sends freeform JSON.</p>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        {(wf.inputs || []).map((inp, idx) => (
                                                            <div key={idx} className="flex items-center gap-1.5 p-1.5 rounded border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                                                <input type="text" value={inp.name} onChange={e => updateInput(wf.id, idx, { name: e.target.value })}
                                                                    placeholder="name" className="flex-1 px-1.5 py-0.5 text-[11px] rounded border bg-transparent outline-none"
                                                                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                                                <select value={inp.type} onChange={e => updateInput(wf.id, idx, { type: e.target.value })}
                                                                    className="px-1 py-0.5 text-[11px] rounded border bg-transparent outline-none"
                                                                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}>
                                                                    {INPUT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                                </select>
                                                                <input type="text" value={inp.description} onChange={e => updateInput(wf.id, idx, { description: e.target.value })}
                                                                    placeholder="description" className="flex-[2] px-1.5 py-0.5 text-[11px] rounded border bg-transparent outline-none"
                                                                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} />
                                                                <button onClick={() => removeInput(wf.id, idx)}
                                                                    className="p-0.5 rounded hover:bg-red-500/10 shrink-0" style={{ color: 'var(--text-muted)' }}>
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
