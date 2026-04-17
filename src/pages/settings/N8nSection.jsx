import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import {
    Loader2, RefreshCw, Plus, Trash2, ChevronDown, ChevronRight, Check, X,
    Link2, Workflow, ShieldCheck, Search, CircleCheck, CircleX, Info, ExternalLink,
    Crown,
} from 'lucide-react';

const INPUT_TYPES = ['string', 'number', 'file', 'json'];

const TABS = [
    { id: 'connection', label: 'Connection', Icon: Link2 },
    { id: 'workflows', label: 'Workflows', Icon: Workflow },
    { id: 'permissions', label: 'Permissions', Icon: ShieldCheck },
];

export default function N8nSection() {
    const [tab, setTab] = useState('connection');

    // Connection state
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [n8nUrl, setN8nUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [hasApiKey, setHasApiKey] = useState(false);
    const [configured, setConfigured] = useState(false);

    // Test-connection state
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null); // { ok, activeWebhookCount?, error? }

    // Workflow state
    const [workflows, setWorkflows] = useState([]);
    const [discoveredWorkflows, setDiscoveredWorkflows] = useState([]);
    const [discovering, setDiscovering] = useState(false);
    const [expandedWf, setExpandedWf] = useState(null);
    const [wfSearch, setWfSearch] = useState('');

    // Permissions state
    const [permLoading, setPermLoading] = useState(false);
    const [permSummary, setPermSummary] = useState(null);

    useEffect(() => { loadConfig(); }, []);

    useEffect(() => {
        if (tab === 'permissions' && !permSummary) loadPermissions();
    }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── API calls ────────────────────────────────────────────────

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
                setTestResult(null); // invalidate previous test
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

    const testConnection = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            // If the user typed new creds but hasn't hit Save, test those instead.
            const body = {};
            if (n8nUrl) body.n8nUrl = n8nUrl;
            if (apiKey) body.apiKey = apiKey;
            const res = await authFetch(`${API_BASE}/ai/n8n/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            setTestResult(data);
        } catch (e) {
            setTestResult({ ok: false, error: e.message });
        }
        setTesting(false);
    };

    const loadPermissions = async () => {
        setPermLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/ai/n8n/permissions`);
            if (res.ok) {
                const data = await res.json();
                setPermSummary(data);
            } else {
                setPermSummary({ error: 'Failed to load permissions' });
            }
        } catch (e) {
            setPermSummary({ error: e.message });
        }
        setPermLoading(false);
    };

    const mutatePermission = async (permission, groupId, action) => {
        // Optimistic refresh — show the spinner and refetch after the mutation.
        try {
            const res = await authFetch(`${API_BASE}/ai/n8n/permissions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permission, groupId, action }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setMessage({ type: 'error', text: err.error || 'Failed to update permission' });
                setTimeout(() => setMessage(null), 3000);
                return;
            }
            setMessage({ type: 'success', text: action === 'add' ? 'Group granted access' : 'Group access revoked' });
            setTimeout(() => setMessage(null), 2000);
            await loadPermissions();
        } catch (e) {
            setMessage({ type: 'error', text: 'Request failed' });
            setTimeout(() => setMessage(null), 3000);
        }
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
            if (res.ok) setMessage({ type: 'success', text: 'Workflows saved' });
            else {
                const err = await res.json();
                setMessage({ type: 'error', text: err.error || 'Failed to save' });
            }
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to save' });
        }
        setSaving(false);
        setTimeout(() => setMessage(null), 3000);
    };

    // ── Derived ──────────────────────────────────────────────────

    const filteredWorkflows = useMemo(() => {
        if (!wfSearch.trim()) return workflows;
        const q = wfSearch.toLowerCase();
        return workflows.filter(w =>
            (w.name || '').toLowerCase().includes(q) ||
            (w.slug || '').toLowerCase().includes(q) ||
            (w.description || '').toLowerCase().includes(q)
        );
    }, [workflows, wfSearch]);

    const filteredDiscovered = useMemo(() => {
        if (!wfSearch.trim()) return discoveredWorkflows;
        const q = wfSearch.toLowerCase();
        return discoveredWorkflows.filter(w => (w.name || '').toLowerCase().includes(q));
    }, [discoveredWorkflows, wfSearch]);

    // ── Render helpers ───────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center py-4" style={{ color: 'var(--text-muted)' }}>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Status row — shows live pill regardless of tab */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <StatusPill configured={configured} testResult={testResult} />
                {message && (
                    <span className={`text-xs font-medium px-3 py-1.5 rounded-lg ${message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                        {message.text}
                    </span>
                )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                {TABS.map(({ id, label, Icon }) => {
                    const active = tab === id;
                    return (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors relative"
                            style={{
                                color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                marginBottom: '-1px',
                            }}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            {tab === 'connection' && (
                <ConnectionTab
                    n8nUrl={n8nUrl} setN8nUrl={setN8nUrl}
                    apiKey={apiKey} setApiKey={setApiKey}
                    hasApiKey={hasApiKey}
                    saving={saving} onSave={saveConnection}
                    testing={testing} onTest={testConnection} testResult={testResult}
                />
            )}

            {tab === 'workflows' && (
                <WorkflowsTab
                    configured={configured}
                    wfSearch={wfSearch} setWfSearch={setWfSearch}
                    discoverWorkflows={discoverWorkflows}
                    discovering={discovering}
                    filteredDiscovered={filteredDiscovered}
                    workflows={workflows}
                    filteredWorkflows={filteredWorkflows}
                    expandedWf={expandedWf} setExpandedWf={setExpandedWf}
                    updateWorkflow={updateWorkflow}
                    removeWorkflow={removeWorkflow}
                    addWorkflow={addWorkflow}
                    addInput={addInput} updateInput={updateInput} removeInput={removeInput}
                    saving={saving} saveWorkflows={saveWorkflows}
                    setWorkflows={setWorkflows} persistWorkflows={persistWorkflows}
                />
            )}

            {tab === 'permissions' && (
                <PermissionsTab
                    loading={permLoading}
                    summary={permSummary}
                    onReload={loadPermissions}
                    onMutate={mutatePermission}
                />
            )}
        </div>
    );
}

// ─── Status pill ─────────────────────────────────────────────

function StatusPill({ configured, testResult }) {
    let label, bg, color, Icon;
    if (testResult?.ok) {
        label = testResult.activeWebhookCount != null
            ? `Connected · ${testResult.activeWebhookCount} active webhook workflow${testResult.activeWebhookCount === 1 ? '' : 's'}`
            : 'Connected';
        bg = 'rgba(16,185,129,0.12)'; color = '#10b981'; Icon = CircleCheck;
    } else if (testResult && !testResult.ok) {
        label = `Connection failed${testResult.error ? ` — ${String(testResult.error).slice(0, 80)}` : ''}`;
        bg = 'rgba(239,68,68,0.12)'; color = '#ef4444'; Icon = CircleX;
    } else if (configured) {
        label = 'Configured — click Test to verify';
        bg = 'var(--bg-tertiary)'; color = 'var(--text-secondary)'; Icon = Info;
    } else {
        label = 'Not configured';
        bg = 'var(--bg-tertiary)'; color = 'var(--text-muted)'; Icon = Info;
    }
    return (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: bg, color }}>
            <Icon className="w-3 h-3" /> {label}
        </span>
    );
}

// ─── Connection tab ─────────────────────────────────────────

function ConnectionTab({ n8nUrl, setN8nUrl, apiKey, setApiKey, hasApiKey, saving, onSave, testing, onTest, testResult }) {
    return (
        <div className="space-y-4">
            <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>n8n Instance URL</label>
                <input
                    type="url" value={n8nUrl} onChange={e => setN8nUrl(e.target.value)}
                    placeholder="https://n8n.yourdomain.com"
                    className="w-full px-3 py-2 text-sm rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                />
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    Base URL of your n8n instance. `/api/v1` is appended automatically.
                </p>
            </div>
            <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>API Key</label>
                <input
                    type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                    placeholder={hasApiKey ? '••••••••••••••••' : 'Enter your n8n API key'}
                    className="w-full px-3 py-2 text-sm rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                />
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    Generate at n8n → Settings → API → Create API Key. Stored encrypted.
                </p>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={onSave} disabled={saving || !n8nUrl}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)', color: 'white' }}
                >
                    {saving ? 'Saving...' : 'Save Connection'}
                </button>
                <button
                    onClick={onTest} disabled={testing || !n8nUrl || (!apiKey && !hasApiKey)}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 border"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', background: 'transparent' }}
                >
                    {testing ? <><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />Testing...</> : 'Test Connection'}
                </button>
            </div>
            {testResult && !testResult.ok && (
                <div className="text-[11px] rounded-lg border px-3 py-2" style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
                    {testResult.error || `HTTP ${testResult.status || '?'}`}
                </div>
            )}
        </div>
    );
}

// ─── Workflows tab ──────────────────────────────────────────

function WorkflowsTab({
    configured, wfSearch, setWfSearch, discoverWorkflows, discovering,
    filteredDiscovered, workflows, filteredWorkflows,
    expandedWf, setExpandedWf, updateWorkflow, removeWorkflow, addWorkflow,
    addInput, updateInput, removeInput, saving, saveWorkflows,
    setWorkflows, persistWorkflows,
}) {
    if (!configured) {
        return (
            <div className="rounded-lg border px-4 py-6 text-center" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                <Info className="w-5 h-5 mx-auto mb-2 opacity-60" />
                <p className="text-sm">Connect to n8n first — fill in the URL and API key on the Connection tab.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Search + Refresh */}
            <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text" value={wfSearch} onChange={e => setWfSearch(e.target.value)}
                        placeholder="Search workflows..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border bg-transparent outline-none focus:border-[var(--accent-primary)]"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />
                </div>
                <button
                    onClick={discoverWorkflows} disabled={discovering}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${discovering ? 'animate-spin' : ''}`} />
                    {discovering ? 'Scanning...' : 'Discover'}
                </button>
            </div>

            {/* Discovered (not yet added) */}
            {filteredDiscovered.length > 0 && (
                <div className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center justify-between mb-1">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Available to add</h4>
                    </div>
                    {filteredDiscovered.map(dw => {
                        const alreadyAdded = workflows.some(w => w.id === dw.id);
                        return (
                            <div key={dw.id} className="flex items-center justify-between px-3 py-2 rounded-lg border"
                                style={{ borderColor: 'var(--border-subtle)', background: alreadyAdded ? 'rgba(16, 185, 129, 0.04)' : 'transparent' }}>
                                <div className="min-w-0">
                                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{dw.name}</div>
                                    <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                        {dw.webhookNodes?.map(n => `${n.method || 'POST'} /webhook/${n.path}`).join(', ')}
                                    </div>
                                </div>
                                {alreadyAdded ? (
                                    <span className="text-xs font-medium flex items-center gap-1 shrink-0" style={{ color: '#10b981' }}>
                                        <Check className="w-3.5 h-3.5" /> Added
                                    </span>
                                ) : (
                                    <button onClick={() => addWorkflow(dw)}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-80 shrink-0"
                                        style={{ background: 'var(--accent-primary)', color: 'white' }}>
                                        <Plus className="w-3 h-3" /> Add
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Configured workflows */}
            {workflows.length === 0 ? (
                <div className="rounded-lg border px-4 py-6 text-center" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                    <Workflow className="w-5 h-5 mx-auto mb-2 opacity-60" />
                    <p className="text-sm">No workflows configured yet. Click <b>Discover</b> to scan your n8n instance for webhook-triggered workflows.</p>
                </div>
            ) : (
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
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
                        {filteredWorkflows.map(wf => {
                            const isExpanded = expandedWf === wf.id;
                            return (
                                <div key={wf.id}>
                                    <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                                        onClick={() => setExpandedWf(isExpanded ? null : wf.id)}>
                                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium truncate flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                                                {wf.name}
                                                {wf.allowKbIngestion && (
                                                    <span className="text-[9px] px-1 py-0.5 rounded font-medium flex-shrink-0" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }} title="Enabled for KB ingestion">📚 KB</span>
                                                )}
                                            </div>
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

                                            {/* KB Ingestion */}
                                            <div className="pt-2 mt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                                <div className="flex items-center justify-between p-2 rounded border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                        📚 Allow agents to ingest this workflow into their Knowledge Base.
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                        <input type="checkbox" checked={!!wf.allowKbIngestion} onChange={() => {
                                                            const updated = workflows.map(w => w.id === wf.id ? { ...w, allowKbIngestion: !w.allowKbIngestion } : w);
                                                            setWorkflows(updated);
                                                            persistWorkflows(updated);
                                                        }} className="sr-only peer" />
                                                        <div className="w-8 h-4 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
                                                    </label>
                                                </div>
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

// ─── Permissions tab (editable: add/remove groups) ──────────

function PermissionsTab({ loading, summary, onReload, onMutate }) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-6" style={{ color: 'var(--text-muted)' }}>
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading permissions...
            </div>
        );
    }
    if (!summary || summary.error) {
        return (
            <div className="rounded-lg border px-4 py-6 text-center" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                <p className="text-sm mb-2">{summary?.error || 'Could not load permissions'}</p>
                <button onClick={onReload} className="text-xs px-3 py-1 rounded-lg border"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>Retry</button>
            </div>
        );
    }

    const buckets = [
        {
            id: 'use_n8n_tools',
            title: 'Use n8n Tools',
            desc: 'Run webhook workflows from chat and inspect workflow definitions.',
            groups: summary.use_n8n_tools || [],
        },
        {
            id: 'modify_n8n_workflows',
            title: 'Modify n8n Workflows',
            desc: 'Allow the AI to create, edit, delete, activate, and execute workflows on behalf of the user. Grant carefully — the AI can change live automations.',
            groups: summary.modify_n8n_workflows || [],
        },
    ];

    return (
        <div className="space-y-3">
            <div className="rounded-lg border px-3 py-2.5 text-[11px] flex items-start gap-2"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                    Grant n8n permissions to groups here, or use the full group editor in{' '}
                    <a href={summary.editUrl || '/settings/organisation/users'} className="underline font-medium inline-flex items-center gap-0.5" style={{ color: 'var(--accent-primary)' }}>
                        Users & Groups <ExternalLink className="w-3 h-3" />
                    </a>.
                </span>
            </div>

            {buckets.map(bucket => (
                <PermissionBucket
                    key={bucket.id}
                    bucket={bucket}
                    availableGroups={summary.availableGroups || []}
                    orgAdminAlways={!!summary.orgAdminAlways}
                    onAdd={(groupId) => onMutate(bucket.id, groupId, 'add')}
                    onRemove={(groupId) => onMutate(bucket.id, groupId, 'remove')}
                />
            ))}
        </div>
    );
}

function PermissionBucket({ bucket, availableGroups, orgAdminAlways, onAdd, onRemove }) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const [busyGroupId, setBusyGroupId] = useState(null);

    const heldIds = new Set((bucket.groups || []).map(g => g.id));
    const addable = availableGroups.filter(g => !heldIds.has(g.id));

    const totalCount = (bucket.groups?.length || 0) + (orgAdminAlways ? 1 : 0);

    const handleAdd = async (groupId) => {
        setPickerOpen(false);
        setBusyGroupId(groupId);
        try { await onAdd(groupId); } finally { setBusyGroupId(null); }
    };
    const handleRemove = async (groupId) => {
        setBusyGroupId(groupId);
        try { await onRemove(groupId); } finally { setBusyGroupId(null); }
    };

    return (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{bucket.title}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{bucket.desc}</div>
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        {totalCount} grantee{totalCount === 1 ? '' : 's'}
                    </span>
                </div>
            </div>

            <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {/* Always-on row for org admins */}
                {orgAdminAlways && (
                    <li className="px-3 py-2 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                            <Crown className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} />
                            Organisation Admins
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                                always
                            </span>
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>baked in</span>
                    </li>
                )}

                {bucket.groups.length === 0 && !orgAdminAlways && (
                    <li className="px-3 py-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        No groups currently hold this permission.
                    </li>
                )}

                {bucket.groups.map(g => (
                    <li key={g.id} className="px-3 py-2 flex items-center justify-between text-xs gap-2">
                        <span className="truncate" style={{ color: 'var(--text-primary)' }}>{g.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                            <span style={{ color: 'var(--text-muted)' }}>{g.userCount} user{g.userCount === 1 ? '' : 's'}</span>
                            <button
                                onClick={() => handleRemove(g.id)}
                                disabled={busyGroupId === g.id}
                                className="p-1 rounded hover:bg-red-500/10 disabled:opacity-50"
                                style={{ color: 'var(--text-muted)' }}
                                title="Revoke permission"
                            >
                                {busyGroupId === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </li>
                ))}
            </ul>

            {/* Add-group row */}
            <div className="px-3 py-2 border-t flex items-center justify-between gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                {addable.length === 0 ? (
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {availableGroups.length === 0
                            ? 'No groups exist yet — create one in Users & Groups first.'
                            : 'All groups already hold this permission.'}
                    </span>
                ) : !pickerOpen ? (
                    <button
                        onClick={() => setPickerOpen(true)}
                        className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg hover:opacity-80"
                        style={{ color: 'var(--accent-primary)' }}
                    >
                        <Plus className="w-3.5 h-3.5" /> Add group
                    </button>
                ) : (
                    <div className="flex items-center gap-2 flex-1">
                        <select
                            onChange={(e) => { if (e.target.value) handleAdd(e.target.value); }}
                            defaultValue=""
                            autoFocus
                            className="flex-1 px-2 py-1 text-xs rounded border bg-transparent outline-none focus:border-[var(--accent-primary)]"
                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', background: 'var(--bg-primary)' }}
                        >
                            <option value="" disabled>Select a group to grant…</option>
                            {addable.map(g => (
                                <option key={g.id} value={g.id}>{g.name} ({g.userCount} user{g.userCount === 1 ? '' : 's'})</option>
                            ))}
                        </select>
                        <button
                            onClick={() => setPickerOpen(false)}
                            className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
                            style={{ color: 'var(--text-muted)' }}
                            title="Cancel"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
