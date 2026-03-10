import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';
import { Loader2, ToggleLeft, ToggleRight, Check, Settings } from 'lucide-react';

const ALL_INTEGRATIONS = [
    { id: 'gmail', label: 'Gmail', description: 'Send and read emails', category: 'Google' },
    { id: 'google-calendar', label: 'Calendar', description: 'Manage calendar events', category: 'Google' },
    { id: 'google-drive', label: 'Drive', description: 'Access and manage files', category: 'Google' },
    { id: 'google-slides', label: 'Slides', description: 'Create presentations', category: 'Google' },
    { id: 'google-sheets', label: 'Sheets', description: 'Work with spreadsheets', category: 'Google' },
    { id: 'google-docs', label: 'Docs', description: 'Create and edit documents', category: 'Google' },
    { id: 'image-gen', label: 'Image Generation', description: 'Generate images with AI', category: 'AI' },
    { id: 'music-gen', label: 'Music Generation', description: 'Generate music with AI (ElevenLabs)', category: 'AI' },
    { id: 'video-gen', label: 'Video Generation', description: 'Generate short videos with AI (Veo)', category: 'AI' },
    { id: 'elevenlabs', label: 'ElevenLabs', description: 'Music with vocals, TTS & sound effects', category: 'AI' },
    { id: 'agent-search', label: 'Agent Search', description: 'AI-powered web search with reranking', category: 'AI' },
    { id: 'fireflies', label: 'Fireflies', description: 'Meeting transcripts', category: 'Third-Party' },
    { id: 'youtrack', label: 'YouTrack', description: 'Issue tracking', category: 'Third-Party' },
    { id: 'gamma', label: 'Gamma', description: 'Create presentations', category: 'Third-Party' },
    { id: 'n8n', label: 'n8n', description: 'Workflow automation', category: 'Third-Party' },
    { id: 'linkedin', label: 'LinkedIn', description: 'Post to LinkedIn', category: 'Third-Party' },
];

export default function IntegrationsAdminPanel() {
    const [defaults, setDefaults] = useState(null); // null = all enabled
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [expandedOrg, setExpandedOrg] = useState(null);
    const [agentSearchUrl, setAgentSearchUrl] = useState('');
    const [hasAgentSearchUrl, setHasAgentSearchUrl] = useState(false);
    const [savingSearchUrl, setSavingSearchUrl] = useState(false);
    const [serperApiKey, setSerperApiKey] = useState('');
    const [hasSerperKey, setHasSerperKey] = useState(false);
    const [savingSerperKey, setSavingSerperKey] = useState(false);
    const [agentSearchDefaults, setAgentSearchDefaults] = useState({
        mode: 'web', include_citations: true,
        web: { max_results: 5, fetch_top_n: 3, max_tokens_markdown: 2000 },
        web_fast: { max_results: 10, max_tokens_markdown: 1500 },
    });
    const [savingSearchDefaults, setSavingSearchDefaults] = useState(false);
    const [linkedinClientId, setLinkedinClientId] = useState('');
    const [linkedinClientSecret, setLinkedinClientSecret] = useState('');
    const [hasLinkedInConfig, setHasLinkedInConfig] = useState(false);
    const [savingLinkedIn, setSavingLinkedIn] = useState(false);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            const [defRes, orgsRes] = await Promise.all([
                authFetch(`${API_BASE}/auth/default-integrations`),
                authFetch(`${API_BASE}/auth/organizations`),
            ]);
            if (defRes.ok) {
                const data = await defRes.json();
                setDefaults(data.defaults);
            }
            if (orgsRes.ok) {
                const orgs = await orgsRes.json();
                setOrganizations(orgs);
            }
        } catch (e) { console.error(e); }
        // Load config status
        try {
            const configRes = await authFetch(`${API_BASE}/ai/config`);
            if (configRes.ok) {
                const configData = await configRes.json();
                setHasAgentSearchUrl(!!configData.hasAgentSearchUrl);
                if (configData.agentSearchUrl) setAgentSearchUrl(configData.agentSearchUrl);
                setHasLinkedInConfig(!!configData.hasLinkedInConfig);
                setHasSerperKey(!!configData.hasSerperKey);
            }
        } catch (e) { console.error(e); }
        try {
            const searchDefRes = await authFetch(`${API_BASE}/ai/agent-search/defaults`);
            if (searchDefRes.ok) {
                const d = await searchDefRes.json();
                setAgentSearchDefaults(prev => ({ ...prev, ...d }));
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const saveDefaults = async (newDefaults) => {
        setDefaults(newDefaults);
        setSaving(true);
        try {
            await authFetch(`${API_BASE}/auth/default-integrations`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaults: newDefaults }),
            });
            setMessage({ type: 'success', text: 'Default integrations updated' });
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to save' });
        }
        setSaving(false);
        setTimeout(() => setMessage(null), 3000);
    };

    const saveOrgIntegrations = async (orgId, enabledIntegrations) => {
        setSaving(true);
        try {
            await authFetch(`${API_BASE}/auth/organizations/${orgId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabledIntegrations }),
            });
            setOrganizations(prev => prev.map(o => o.id === orgId ? { ...o, enabledIntegrations } : o));
            setMessage({ type: 'success', text: `Updated integrations for organization` });
        } catch (e) {
            setMessage({ type: 'error', text: 'Failed to save' });
        }
        setSaving(false);
        setTimeout(() => setMessage(null), 3000);
    };

    const isDefaultEnabled = (id) => !defaults || defaults.includes(id);
    const toggleDefault = (id) => {
        if (defaults === null) {
            // Switch from "all enabled" to custom — enable all except this one
            saveDefaults(ALL_INTEGRATIONS.map(i => i.id).filter(x => x !== id));
        } else {
            const newDefaults = defaults.includes(id)
                ? defaults.filter(x => x !== id)
                : [...defaults, id];
            // If all are enabled, switch back to null
            saveDefaults(newDefaults.length === ALL_INTEGRATIONS.length ? null : newDefaults);
        }
    };

    const enableAllDefaults = () => saveDefaults(null);
    const disableAllDefaults = () => saveDefaults([]);

    const getOrgIntegrations = (org) => {
        if (!org.enabledIntegrations) return null;
        return typeof org.enabledIntegrations === 'string'
            ? JSON.parse(org.enabledIntegrations)
            : org.enabledIntegrations;
    };

    const isOrgIntegrationEnabled = (org, id) => {
        const ints = getOrgIntegrations(org);
        return !ints || ints.includes(id);
    };

    const categories = [...new Set(ALL_INTEGRATIONS.map(i => i.category))];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading integrations...
            </div>
        );
    }

    return (
        <div className="h-full overflow-auto p-6">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header + status message */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Integrations</h2>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                            Manage which integrations are available globally and per organization
                        </p>
                    </div>
                    {message && (
                        <span className={`text-sm font-medium px-3 py-1.5 rounded-lg ${message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            {message.text}
                        </span>
                    )}
                </div>

                {/* Global Defaults */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                        <div>
                            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Global Defaults</h3>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                Default integrations for new organizations. Changes here don't affect existing orgs.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={enableAllDefaults} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                                Enable All
                            </button>
                            <button onClick={disableAllDefaults} className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                                Disable All
                            </button>
                        </div>
                    </div>
                    <div className="p-4">
                        {categories.map(cat => (
                            <div key={cat} className="mb-4 last:mb-0">
                                <div className="text-xs font-semibold uppercase tracking-wider mb-2 px-2" style={{ color: 'var(--text-muted)' }}>{cat}</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {ALL_INTEGRATIONS.filter(i => i.category === cat).map(integ => {
                                        const enabled = isDefaultEnabled(integ.id);
                                        return (
                                            <button key={integ.id} onClick={() => toggleDefault(integ.id)}
                                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:scale-[1.01]"
                                                style={{ background: enabled ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-primary)', border: `1px solid ${enabled ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-subtle)'}` }}>
                                                {enabled
                                                    ? <ToggleRight className="w-5 h-5 shrink-0" style={{ color: '#10b981' }} />
                                                    : <ToggleLeft className="w-5 h-5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                                                }
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium truncate" style={{ color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>{integ.label}</div>
                                                    <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{integ.description}</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Per-Organization Overrides */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Organization Overrides</h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Override integrations for specific organizations. "Using Defaults" means the org inherits the global defaults above.
                        </p>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                        {organizations.map(org => {
                            const orgInts = getOrgIntegrations(org);
                            const isExpanded = expandedOrg === org.id;
                            const usingDefaults = orgInts === null;
                            const enabledCount = usingDefaults
                                ? (defaults === null ? ALL_INTEGRATIONS.length : defaults.length)
                                : orgInts.length;

                            return (
                                <div key={org.id}>
                                    <button onClick={() => setExpandedOrg(isExpanded ? null : org.id)}
                                        className="w-full px-6 py-3.5 flex items-center justify-between text-left hover:bg-[var(--bg-tertiary)] transition-colors">
                                        <div className="flex items-center gap-3">
                                            {org.logo ? (
                                                <img src={org.logo.startsWith('/') ? `${API_BASE}${org.logo}` : org.logo} alt="" className="w-8 h-8 object-contain rounded-lg" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                                                    {org.name?.[0]?.toUpperCase() || '?'}
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{org.name}</div>
                                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{org.id}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${usingDefaults ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                {usingDefaults ? 'Using Defaults' : `Custom (${enabledCount}/${ALL_INTEGRATIONS.length})`}
                                            </span>
                                            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="px-6 pb-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <button onClick={() => saveOrgIntegrations(org.id, null)}
                                                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${usingDefaults ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
                                                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                                                    Use Defaults
                                                </button>
                                                <button onClick={() => {
                                                    if (usingDefaults) {
                                                        // Switch to custom — copy current effective integrations
                                                        const effective = defaults === null ? ALL_INTEGRATIONS.map(i => i.id) : [...defaults];
                                                        saveOrgIntegrations(org.id, effective);
                                                    }
                                                }}
                                                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${!usingDefaults ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
                                                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
                                                    Custom
                                                </button>
                                                {!usingDefaults && (
                                                    <>
                                                        <div className="flex-1" />
                                                        <button onClick={() => saveOrgIntegrations(org.id, ALL_INTEGRATIONS.map(i => i.id))}
                                                            className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ color: '#10b981' }}>
                                                            Enable All
                                                        </button>
                                                        <button onClick={() => saveOrgIntegrations(org.id, [])}
                                                            className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ color: '#ef4444' }}>
                                                            Disable All
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                            {!usingDefaults && (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {ALL_INTEGRATIONS.map(integ => {
                                                        const enabled = isOrgIntegrationEnabled(org, integ.id);
                                                        return (
                                                            <button key={integ.id} onClick={() => {
                                                                const current = orgInts || [];
                                                                const newInts = enabled
                                                                    ? current.filter(x => x !== integ.id)
                                                                    : [...current, integ.id];
                                                                saveOrgIntegrations(org.id, newInts);
                                                            }}
                                                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all"
                                                                style={{ background: enabled ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-primary)', border: `1px solid ${enabled ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-subtle)'}` }}>
                                                                {enabled
                                                                    ? <ToggleRight className="w-4 h-4 shrink-0" style={{ color: '#10b981' }} />
                                                                    : <ToggleLeft className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                                                                }
                                                                <span className="text-sm" style={{ color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>{integ.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {organizations.length === 0 && (
                            <div className="px-6 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                                No organizations found. Create one in Security → Organizations.
                            </div>
                        )}
                    </div>
                </div>

                {/* LinkedIn Configuration */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="4" fill="#0A66C2" /><path d="M7.5 9.5h2v7h-2v-7zm1-3.2a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zm3.5 3.2h1.9v1h0c.27-.5 .92-1.1 1.9-1.1 2 0 2.4 1.3 2.4 3.1v3.6h-2v-3.2c0-.8 0-1.8-1.1-1.8s-1.3.9-1.3 1.7v3.3h-2v-6.6z" fill="white" /></svg>
                            LinkedIn Configuration
                            {hasLinkedInConfig && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Configured</span>}
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Set LinkedIn API credentials. Users can then connect their LinkedIn accounts from Settings → Integrations.
                        </p>
                    </div>
                    <div className="p-6 space-y-3">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={linkedinClientId}
                                onChange={e => setLinkedinClientId(e.target.value)}
                                placeholder={hasLinkedInConfig ? '••••••••••••••••' : 'Client ID'}
                                className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                            />
                            <input
                                type="password"
                                value={linkedinClientSecret}
                                onChange={e => setLinkedinClientSecret(e.target.value)}
                                placeholder={hasLinkedInConfig ? '••••••••••••••••' : 'Client Secret'}
                                className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                            />
                            <button
                                onClick={async () => {
                                    if (!linkedinClientId.trim() || !linkedinClientSecret.trim()) return;
                                    setSavingLinkedIn(true);
                                    try {
                                        const res = await authFetch(`${API_BASE}/ai/config`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ linkedinClientId, linkedinClientSecret }),
                                        });
                                        if (res.ok) {
                                            setHasLinkedInConfig(true);
                                            setLinkedinClientId('');
                                            setLinkedinClientSecret('');
                                            setMessage({ type: 'success', text: 'LinkedIn credentials saved' });
                                        }
                                    } catch (e) {
                                        setMessage({ type: 'error', text: 'Failed to save LinkedIn credentials' });
                                    }
                                    setSavingLinkedIn(false);
                                    setTimeout(() => setMessage(null), 3000);
                                }}
                                disabled={savingLinkedIn || !linkedinClientId.trim() || !linkedinClientSecret.trim()}
                                className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                style={{ background: 'var(--accent-primary)', color: '#fff' }}
                            >
                                {savingLinkedIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Save
                            </button>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Get credentials from your <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-primary)' }}>LinkedIn Developer App</a> — enable "Share on LinkedIn" + "Sign In with LinkedIn using OpenID Connect".
                        </p>
                    </div>
                </div>

                {/* Global API Keys for Integrations */}
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                        <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <Settings className="w-4 h-4" /> Agent Search Configuration
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Configure your self-hosted Agent Search service.
                        </p>
                    </div>
                    <div className="p-6 space-y-4">
                        {/* Agent Search URL */}
                        <div>
                            <label className="text-sm font-medium flex items-center gap-2 mb-2" style={{ color: 'var(--text-primary)' }}>
                                Agent Search Service URL
                                {hasAgentSearchUrl && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Configured</span>}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={agentSearchUrl}
                                    onChange={e => setAgentSearchUrl(e.target.value)}
                                    placeholder="http://localhost:8000"
                                    className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                />
                                <button
                                    onClick={async () => {
                                        setSavingSearchUrl(true);
                                        try {
                                            const res = await authFetch(`${API_BASE}/ai/config`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ agentSearchUrl }),
                                            });
                                            if (res.ok) {
                                                setHasAgentSearchUrl(!!agentSearchUrl);
                                                setMessage({ type: 'success', text: agentSearchUrl ? 'Agent Search URL saved' : 'Agent Search URL removed' });
                                            }
                                        } catch (e) {
                                            setMessage({ type: 'error', text: 'Failed to save URL' });
                                        }
                                        setSavingSearchUrl(false);
                                        setTimeout(() => setMessage(null), 3000);
                                    }}
                                    disabled={savingSearchUrl}
                                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                    style={{ background: 'var(--accent-primary)', color: '#fff' }}
                                >
                                    {savingSearchUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Save
                                </button>
                            </div>
                            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                URL of your self-hosted Agent Search service (Serper.dev + GPU inference).
                            </p>

                            {/* Serper.dev API Key */}
                            <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                <label className="text-sm font-medium flex items-center gap-2 mb-2" style={{ color: 'var(--text-primary)' }}>
                                    Serper.dev API Key
                                    {hasSerperKey && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500">Configured</span>}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={serperApiKey}
                                        onChange={e => setSerperApiKey(e.target.value)}
                                        placeholder={hasSerperKey ? '••••••••••••••••' : 'Enter Serper.dev API key'}
                                        className="flex-1 px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }}
                                    />
                                    <button
                                        onClick={async () => {
                                            setSavingSerperKey(true);
                                            try {
                                                const res = await authFetch(`${API_BASE}/ai/config`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ serperApiKey }),
                                                });
                                                if (res.ok) {
                                                    setHasSerperKey(!!serperApiKey);
                                                    setSerperApiKey('');
                                                    setMessage({ type: 'success', text: serperApiKey ? 'Serper API key saved' : 'Serper API key removed' });
                                                }
                                            } catch (e) {
                                                setMessage({ type: 'error', text: 'Failed to save Serper API key' });
                                            }
                                            setSavingSerperKey(false);
                                            setTimeout(() => setMessage(null), 3000);
                                        }}
                                        disabled={savingSerperKey}
                                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                        style={{ background: 'var(--accent-primary)', color: '#fff' }}
                                    >
                                        {savingSerperKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        Save
                                    </button>
                                </div>
                                <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                    Get your API key from <a href="https://serper.dev" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent-primary)' }}>serper.dev</a>. Used by the search service for Google web search results.
                                </p>
                            </div>

                            {/* Agent Search Default Options */}
                            <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                <label className="text-sm font-medium flex items-center gap-2 mb-3" style={{ color: 'var(--text-primary)' }}>
                                    <Settings className="w-4 h-4" /> Agent Search Default Options
                                </label>

                                {/* Global settings */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div>
                                        <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Default Mode</label>
                                        <select
                                            value={agentSearchDefaults.mode}
                                            onChange={e => setAgentSearchDefaults(p => ({ ...p, mode: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                        >
                                            <option value="web">Web (full pages + reranking)</option>
                                            <option value="web_fast">Web Fast (snippets only)</option>
                                            <option value="kb">Knowledge Base</option>
                                            <option value="auto">Auto (KB + web fallback)</option>
                                        </select>
                                    </div>
                                    <div className="flex items-end pb-1">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={agentSearchDefaults.include_citations}
                                                onChange={e => setAgentSearchDefaults(p => ({ ...p, include_citations: e.target.checked }))}
                                                className="rounded"
                                            />
                                            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Include citations</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Web Mode Settings */}
                                <div className="rounded-lg border p-3 mb-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                    <div className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: 'var(--accent-primary)' }}>
                                        🌐 Web Mode
                                        <span className="font-normal normal-case" style={{ color: 'var(--text-muted)' }}>— full page content + reranking</span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-3">
                                        <div>
                                            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Max Results</label>
                                            <input
                                                type="number" min="1" max="10"
                                                value={agentSearchDefaults.web?.max_results || 5}
                                                onChange={e => setAgentSearchDefaults(p => ({ ...p, web: { ...p.web, max_results: parseInt(e.target.value) || 5 } }))}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Fetch Top N</label>
                                            <input
                                                type="number" min="1" max="5"
                                                value={agentSearchDefaults.web?.fetch_top_n || 3}
                                                onChange={e => setAgentSearchDefaults(p => ({ ...p, web: { ...p.web, fetch_top_n: parseInt(e.target.value) || 3 } }))}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Max Tokens</label>
                                            <input
                                                type="number" min="500" max="5000" step="100"
                                                value={agentSearchDefaults.web?.max_tokens_markdown || 2000}
                                                onChange={e => setAgentSearchDefaults(p => ({ ...p, web: { ...p.web, max_tokens_markdown: parseInt(e.target.value) || 2000 } }))}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Detail Level</label>
                                            <select
                                                value={agentSearchDefaults.web?.detail_level || 'detailed'}
                                                onChange={e => setAgentSearchDefaults(p => ({ ...p, web: { ...p.web, detail_level: e.target.value } }))}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            >
                                                <option value="basic">Basic (compact)</option>
                                                <option value="detailed">Detailed (default)</option>
                                                <option value="highly_detailed">Highly Detailed</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Web Fast Mode Settings */}
                                <div className="rounded-lg border p-3 mb-3" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                                    <div className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: '#f59e0b' }}>
                                        ⚡ Web Fast Mode
                                        <span className="font-normal normal-case" style={{ color: 'var(--text-muted)' }}>— snippets + AI synthesis</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Max Results</label>
                                            <input
                                                type="number" min="1" max="20"
                                                value={agentSearchDefaults.web_fast?.max_results || 10}
                                                onChange={e => setAgentSearchDefaults(p => ({ ...p, web_fast: { ...p.web_fast, max_results: parseInt(e.target.value) || 10 } }))}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Max Tokens</label>
                                            <input
                                                type="number" min="500" max="5000" step="100"
                                                value={agentSearchDefaults.web_fast?.max_tokens_markdown || 1500}
                                                onChange={e => setAgentSearchDefaults(p => ({ ...p, web_fast: { ...p.web_fast, max_tokens_markdown: parseInt(e.target.value) || 1500 } }))}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Detail Level</label>
                                            <select
                                                value={agentSearchDefaults.web_fast?.detail_level || 'detailed'}
                                                onChange={e => setAgentSearchDefaults(p => ({ ...p, web_fast: { ...p.web_fast, detail_level: e.target.value } }))}
                                                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            >
                                                <option value="basic">Basic (compact)</option>
                                                <option value="detailed">Detailed (default)</option>
                                                <option value="highly_detailed">Highly Detailed</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        onClick={async () => {
                                            setSavingSearchDefaults(true);
                                            try {
                                                await authFetch(`${API_BASE}/ai/agent-search/defaults`, {
                                                    method: 'PUT',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify(agentSearchDefaults),
                                                });
                                                setMessage({ type: 'success', text: 'Agent Search defaults saved' });
                                            } catch (e) {
                                                setMessage({ type: 'error', text: 'Failed to save defaults' });
                                            }
                                            setSavingSearchDefaults(false);
                                            setTimeout(() => setMessage(null), 3000);
                                        }}
                                        disabled={savingSearchDefaults}
                                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                                        style={{ background: 'var(--accent-primary)', color: '#fff' }}
                                    >
                                        {savingSearchDefaults ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        Save Defaults
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
