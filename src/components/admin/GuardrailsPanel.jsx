import React, { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../utils/helpers';

// Guardrails Configuration Panel (Regex Rules)
const GuardrailsPanel = ({ orgShieldOnly = false }) => {
    // Global Regex Rules State
    const [rules, setRules] = useState([]);
    const [collections, setCollections] = useState([]);
    const [newRuleName, setNewRuleName] = useState('');
    const [newRulePattern, setNewRulePattern] = useState('');
    const [newCollectionName, setNewCollectionName] = useState('');
    const [editingCollection, setEditingCollection] = useState(null);
    const [savingRules, setSavingRules] = useState(false);
    const [rulesMessage, setRulesMessage] = useState(null);

    // AI Generation State
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiGenerating, setAiGenerating] = useState(false);
    const [aiMessage, setAiMessage] = useState(null);
    const [aiModelTier, setAiModelTier] = useState('think');

    // Direct Chat Guardrails State
    const [dcEnabled, setDcEnabled] = useState(false);
    const [dcCollections, setDcCollections] = useState([]);
    const [dcScope, setDcScope] = useState({ userInput: true, agentOutput: true });
    const [dcAction, setDcAction] = useState('delete');
    const [dcSaving, setDcSaving] = useState(false);
    const [dcMessage, setDcMessage] = useState(null);

    // Org Privacy Shield State
    const [orgList, setOrgList] = useState([]);
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [orgShieldEnabled, setOrgShieldEnabled] = useState(false);
    const [orgShieldCollections, setOrgShieldCollections] = useState([]);
    const [orgShieldScope, setOrgShieldScope] = useState({ userInput: true, agentOutput: true });
    const [orgShieldAction, setOrgShieldAction] = useState('delete');
    const [orgShieldSaving, setOrgShieldSaving] = useState(false);
    const [orgShieldMessage, setOrgShieldMessage] = useState(null);
    const [orgShieldLoading, setOrgShieldLoading] = useState(false);
    const [orgShieldModeration, setOrgShieldModeration] = useState(false);
    const [orgShieldCategories, setOrgShieldCategories] = useState([]);
    const [euModeEnabled, setEuModeEnabled] = useState(false);
    const [orgWebSearchGuard, setOrgWebSearchGuard] = useState(false);

    const MODERATION_CATEGORIES = [
        { id: 'S1', label: 'Violent Crimes', icon: '⚔️' },
        { id: 'S2', label: 'Non-Violent Crimes', icon: '⚠️' },
        { id: 'S3', label: 'Sex-Related Crimes', icon: '🚫' },
        { id: 'S4', label: 'Child Sexual Exploitation', icon: '🔴' },
        { id: 'S5', label: 'Defamation', icon: '🗣️' },
        { id: 'S6', label: 'Specialized Advice', icon: '⚖️' },
        { id: 'S7', label: 'Privacy', icon: '🔒' },
        { id: 'S8', label: 'Intellectual Property', icon: '©️' },
        { id: 'S9', label: 'Indiscriminate Weapons', icon: '💣' },
        { id: 'S10', label: 'Hate', icon: '🚷' },
        { id: 'S11', label: 'Suicide & Self-Harm', icon: '💔' },
        { id: 'S12', label: 'Sexual Content', icon: '🔞' },
        { id: 'S13', label: 'Elections', icon: '🗳️' },
        { id: 'S14', label: 'Code Interpreter Abuse', icon: '💻' },
    ];

    // Navigation State (default to AI Moderation, or orgshield if orgShieldOnly)
    const [activeTab, setActiveTab] = useState(orgShieldOnly ? 'orgshield' : 'moderation');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config`);
            if (res.ok) {
                const data = await res.json();
                if (data.regexGuardrails) {
                    setRules(data.regexGuardrails.rules || []);
                    setCollections(data.regexGuardrails.collections || []);
                }
                if (data.directChatRegexGuardrails) {
                    const dc = data.directChatRegexGuardrails;
                    setDcEnabled(dc.enabled === true);
                    setDcCollections(dc.collectionIds || []);
                    setDcScope(dc.scope || { userInput: true, agentOutput: true });
                    setDcAction(dc.action || 'delete');
                }
            }

            // Fetch orgs for privacy shield
            const orgRes = await authFetch(`${API_BASE}/auth/organizations`);
            if (orgRes.ok) {
                const orgs = await orgRes.json();
                setOrgList(orgs);
                if (orgs.length > 0 && !selectedOrgId) {
                    setSelectedOrgId(orgs[0].id);
                    fetchOrgShield(orgs[0].id);
                }
            }
        } catch (e) {
            console.error('Failed to fetch config', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchOrgShield = async (orgId) => {
        if (!orgId) return;
        setOrgShieldLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/org-privacy-shield/${orgId}`);
            if (res.ok) {
                const data = await res.json();
                setOrgShieldEnabled(data.enabled || false);
                setOrgShieldCollections(data.collectionIds || []);
                setOrgShieldScope(data.scope || { userInput: true, agentOutput: true });
                setOrgShieldAction(data.action || 'delete');
                setOrgShieldModeration(data.moderationEnabled || false);
                setOrgShieldCategories(data.moderationCategories?.length > 0 ? data.moderationCategories : MODERATION_CATEGORIES.map(c => c.id));
                setEuModeEnabled(data.euModeEnabled || false);
                setOrgWebSearchGuard(data.webSearchGuardEnabled || false);
            }
        } catch (e) {
            console.error('Failed to fetch org shield', e);
        } finally {
            setOrgShieldLoading(false);
        }
    };

    const handleOrgChange = (orgId) => {
        setSelectedOrgId(orgId);
        setOrgShieldMessage(null);
        fetchOrgShield(orgId);
    };

    const handleSaveOrgShield = async () => {
        if (!selectedOrgId) return;
        setOrgShieldSaving(true);
        setOrgShieldMessage(null);
        try {
            const res = await authFetch(`${API_BASE}/api/org-privacy-shield/${selectedOrgId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: orgShieldEnabled,
                    collectionIds: orgShieldCollections,
                    scope: orgShieldScope,
                    action: orgShieldAction,
                    moderationEnabled: orgShieldModeration,
                    moderationCategories: orgShieldCategories,
                    euModeEnabled: euModeEnabled,
                    webSearchGuardEnabled: orgWebSearchGuard,
                })
            });
            if (res.ok) {
                setOrgShieldMessage({ type: 'success', text: 'Privacy shield saved!' });
            } else {
                const data = await res.json();
                setOrgShieldMessage({ type: 'error', text: data.error || 'Failed to save.' });
            }
        } catch (e) {
            setOrgShieldMessage({ type: 'error', text: 'Error saving.' });
        } finally {
            setOrgShieldSaving(false);
        }
    };

    const handleGenerateWithAI = async () => {
        if (!aiPrompt.trim() || aiGenerating) return;
        setAiGenerating(true);
        setAiMessage(null);
        try {
            const res = await authFetch(`${API_BASE}/ai/generate-regex`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPrompt.trim(), modelTier: aiModelTier })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setRules(data.regexGuardrails?.rules || []);
                setCollections(data.regexGuardrails?.collections || []);
                setAiMessage({ type: 'success', text: data.message || 'Rules generated successfully!' });
                setAiPrompt('');
            } else {
                setAiMessage({ type: 'error', text: data.error || 'Failed to generate rules' });
            }
        } catch (e) {
            setAiMessage({ type: 'error', text: 'Error communicating with AI: ' + e.message });
        } finally {
            setAiGenerating(false);
        }
    };

    const handleSaveRules = async () => {
        setSavingRules(true);
        setRulesMessage(null);
        try {
            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ regexGuardrails: { rules, collections } })
            });
            if (res.ok) {
                setRulesMessage({ type: 'success', text: 'Rules & collections saved!' });
            } else {
                setRulesMessage({ type: 'error', text: 'Failed to save' });
            }
        } catch (e) {
            setRulesMessage({ type: 'error', text: 'Error saving' });
        } finally {
            setSavingRules(false);
        }
    };

    const addRule = () => {
        if (!newRuleName.trim() || !newRulePattern.trim()) return;
        setRules([...rules, { id: 'r' + Date.now(), name: newRuleName.trim(), pattern: newRulePattern.trim() }]);
        setNewRuleName('');
        setNewRulePattern('');
    };

    const removeRule = (id) => {
        setRules(rules.filter(r => r.id !== id));
        setCollections(collections.map(c => ({ ...c, ruleIds: c.ruleIds.filter(rId => rId !== id) })));
    };

    const addCollection = () => {
        if (!newCollectionName.trim()) return;
        setCollections([...collections, { id: 'c' + Date.now(), name: newCollectionName.trim(), ruleIds: [] }]);
        setNewCollectionName('');
    };

    const removeCollection = (id) => setCollections(collections.filter(c => c.id !== id));

    const toggleRuleInCollection = (colId, ruleId) => {
        setCollections(collections.map(c => {
            if (c.id !== colId) return c;
            const has = c.ruleIds.includes(ruleId);
            return { ...c, ruleIds: has ? c.ruleIds.filter(r => r !== ruleId) : [...c.ruleIds, ruleId] };
        }));
    };

    const handleSaveDcGuardrails = async () => {
        setDcSaving(true);
        setDcMessage(null);
        try {
            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    directChatRegexGuardrails: {
                        enabled: dcEnabled,
                        collectionIds: dcCollections,
                        scope: dcScope,
                        action: dcAction
                    }
                })
            });
            if (res.ok) {
                setDcMessage({ type: 'success', text: 'Saved!' });
            } else {
                setDcMessage({ type: 'error', text: 'Failed to save.' });
            }
        } catch (e) {
            setDcMessage({ type: 'error', text: 'Error saving.' });
        } finally {
            setDcSaving(false);
        }
    };

    if (loading) return <div className="text-sm p-4" style={{ color: 'var(--text-muted)' }}>Loading configuration...</div>;

    return (
        <div className={`flex h-full ${orgShieldOnly ? '' : 'border rounded-xl'} overflow-hidden shadow-sm`} style={{ borderColor: orgShieldOnly ? 'transparent' : 'var(--border-default)', background: 'var(--bg-secondary)' }}>
            {/* Left Sidebar - hidden when orgShieldOnly */}
            {!orgShieldOnly && (
                <div className="w-64 flex flex-col p-2 border-r" style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)' }}>
                    <div className="p-4 mb-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Guardrails</h3>
                    </div>
                    <div className="space-y-1">
                        <button
                            onClick={() => setActiveTab('moderation')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${activeTab === 'moderation'
                                ? 'bg-[var(--accent-primary)] text-white shadow-md'
                                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                                }`}
                        >
                            <span className="text-lg">🛡️</span>
                            AI Moderation
                        </button>
                        <button
                            onClick={() => setActiveTab('regex')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${activeTab === 'regex'
                                ? 'bg-[var(--accent-primary)] text-white shadow-md'
                                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                                }`}
                        >
                            <span className="text-lg">📝</span>
                            Regex Rules
                        </button>
                        <button
                            onClick={() => setActiveTab('directchat')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${activeTab === 'directchat'
                                ? 'bg-[var(--accent-primary)] text-white shadow-md'
                                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                                }`}
                        >
                            <span className="text-lg">💬</span>
                            Direct Chat
                        </button>
                        <button
                            onClick={() => setActiveTab('orgshield')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${activeTab === 'orgshield'
                                ? 'bg-[var(--accent-primary)] text-white shadow-md'
                                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                                }`}
                        >
                            <span className="text-lg">🏢</span>
                            Org Privacy Shield
                        </button>
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-[var(--bg-primary)]">
                {activeTab === 'moderation' && (
                    <AIModerationConfig />
                )}

                {activeTab === 'regex' && (
                    <div className="max-w-full space-y-6 animate-fadeIn h-full flex flex-col">
                        <div className="flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-xl font-bold mb-1 text-primary">Regex Rules</h2>
                                <p className="text-sm text-muted">Manage regular expression patterns and rule collections.</p>
                            </div>
                            <button
                                onClick={handleSaveRules}
                                disabled={savingRules}
                                className="px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 shadow-lg shadow-purple-500/20 transition-all hover:opacity-90"
                                style={{ background: 'var(--accent-primary)', color: 'white' }}
                            >
                                {savingRules ? 'Saving...' : 'Save All Changes'}
                            </button>
                        </div>
                        {rulesMessage && <div className={`px-4 py-3 rounded-lg text-sm shrink-0 ${rulesMessage.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>{rulesMessage.text}</div>}

                        <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
                            {/* Left Col: Rules */}
                            <div className="flex flex-col min-h-0">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3 shrink-0">1. Define Rules</h3>
                                <div className="p-6 rounded-xl border flex flex-col flex-1 min-h-0 overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                    <div className="flex gap-3 mb-4 shrink-0">
                                        <div className="w-1/3">
                                            <label className="text-xs font-medium text-muted mb-1.5 block">Rule Name</label>
                                            <input value={newRuleName} onChange={e => setNewRuleName(e.target.value)} placeholder="Name" className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }} />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs font-medium text-muted mb-1.5 block">Regex Pattern</label>
                                            <div className="flex gap-2">
                                                <input value={newRulePattern} onChange={e => setNewRulePattern(e.target.value)} placeholder="Pattern..." className="flex-1 px-3 py-2 rounded-lg border text-sm font-mono" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }} />
                                                <button onClick={addRule} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors" style={{ border: '1px solid var(--border-default)', color: 'var(--accent-primary)' }}>Add</button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 overflow-y-auto custom-scrollbar pr-2 flex-1">
                                        {rules.length === 0 && (
                                            <div className="text-center py-8 text-muted border-2 border-dashed rounded-lg border-white/5">
                                                <p className="text-sm">No rules defined yet</p>
                                            </div>
                                        )}
                                        {rules.map(rule => (
                                            <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg group hover:bg-white/5 transition-colors" style={{ background: 'var(--bg-tertiary)' }}>
                                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                                    <span className="font-medium text-sm whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>{rule.name}</span>
                                                    <code className="text-xs px-2 py-1 rounded font-mono truncate max-w-[200px]" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>{rule.pattern}</code>
                                                </div>
                                                <button onClick={() => removeRule(rule.id)} className="text-muted hover:text-red-400 p-1.5 rounded-md hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right Col: Collections */}
                            <div className="flex flex-col min-h-0">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3 shrink-0">2. Organize Collections</h3>
                                <div className="p-6 rounded-xl border flex flex-col flex-1 min-h-0 overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                    <div className="flex gap-3 mb-6 shrink-0">
                                        <div className="flex-1">
                                            <input value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)} placeholder="New Collection Name..." className="w-full px-4 py-2.5 rounded-lg border text-sm" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }} />
                                        </div>
                                        <button onClick={addCollection} className="px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors" style={{ border: '1px solid var(--border-default)', color: 'var(--accent-primary)' }}>Create</button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 overflow-y-auto custom-scrollbar pr-2 flex-1">
                                        {collections.length === 0 && (
                                            <div className="text-center py-8 text-muted border-2 border-dashed rounded-lg border-white/5">
                                                <p className="text-sm">No collections created yet</p>
                                            </div>
                                        )}
                                        {collections.map(col => (
                                            <div key={col.id} className="rounded-xl border transition-all shrink-0" style={{ background: 'var(--bg-tertiary)', borderColor: editingCollection === col.id ? 'var(--accent-primary)' : 'var(--border-default)' }}>
                                                <div className="p-4 flex items-center justify-between border-b border-white/5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-lg">📦</div>
                                                        <div>
                                                            <h4 className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{col.name}</h4>
                                                            <span className="text-xs text-muted">{col.ruleIds.length} rule(s)</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => setEditingCollection(editingCollection === col.id ? null : col.id)}
                                                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${editingCollection === col.id ? 'bg-[var(--accent-primary)] text-white' : 'bg-white/5 text-muted hover:text-primary'}`}
                                                        >
                                                            {editingCollection === col.id ? 'Done' : 'Edit'}
                                                        </button>
                                                        <button onClick={() => removeCollection(col.id)} className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-white/5 transition-colors">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                </div>

                                                {editingCollection === col.id ? (
                                                    <div className="p-4 bg-black/10">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {rules.map(rule => (
                                                                <label key={rule.id} className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${col.ruleIds.includes(rule.id) ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30' : 'bg-white/5 border-transparent hover:border-white/10'}`}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={col.ruleIds.includes(rule.id)}
                                                                        onChange={() => toggleRuleInCollection(col.id, rule.id)}
                                                                        className="w-4 h-4 rounded border-gray-600 text-[var(--accent-primary)] focus:ring-offset-0 focus:ring-0 bg-transparent"
                                                                    />
                                                                    <span className={`text-sm ${col.ruleIds.includes(rule.id) ? 'text-[var(--text-primary)]' : 'text-muted'}`}>{rule.name}</span>
                                                                </label>
                                                            ))}
                                                            {rules.length === 0 && <p className="text-xs text-muted col-span-2 italic">Create rules first.</p>}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    col.ruleIds.length > 0 && (
                                                        <div className="px-4 py-3 flex flex-wrap gap-2">
                                                            {col.ruleIds.slice(0, 5).map(id => {
                                                                const rule = rules.find(r => r.id === id);
                                                                if (!rule) return null;
                                                                return (
                                                                    <span key={id} className="text-xs px-2 py-1 rounded bg-white/5 text-muted border border-white/5">
                                                                        {rule.name}
                                                                    </span>
                                                                );
                                                            })}
                                                            {col.ruleIds.length > 5 && <span className="text-xs text-muted py-1">+ {col.ruleIds.length - 5} more</span>}
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* AI Generation Section */}
                        <div className="p-5 rounded-xl border shrink-0" style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(59, 130, 246, 0.08))', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-lg">✨</span>
                                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Generate with AI</h3>
                            </div>
                            <p className="text-xs text-muted mb-3">Describe what you want to detect and the AI will create regex rules and collections for you.</p>
                            <div className="flex gap-2">
                                <input
                                    value={aiPrompt}
                                    onChange={e => setAiPrompt(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleGenerateWithAI()}
                                    placeholder="e.g. Dutch IBAN and passport numbers, EU credit cards..."
                                    disabled={aiGenerating}
                                    className="flex-1 px-4 py-2.5 rounded-lg border text-sm disabled:opacity-50"
                                    style={{ borderColor: 'rgba(139, 92, 246, 0.3)', color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }}
                                />
                                <select
                                    value={aiModelTier}
                                    onChange={e => setAiModelTier(e.target.value)}
                                    disabled={aiGenerating}
                                    className="px-3 py-2.5 rounded-lg border text-sm disabled:opacity-50"
                                    style={{ borderColor: 'rgba(139, 92, 246, 0.3)', color: 'var(--text-primary)', background: 'var(--bg-tertiary)', minWidth: '100px' }}
                                >
                                    <option value="fast">⚡ Fast</option>
                                    <option value="think">🧠 Think</option>
                                    <option value="write">✍️ Write</option>
                                    <option value="deep_thinking">🔬 Deep</option>
                                </select>
                                <button
                                    onClick={handleGenerateWithAI}
                                    disabled={aiGenerating || !aiPrompt.trim()}
                                    className="px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-all hover:opacity-90 flex items-center gap-2 whitespace-nowrap"
                                    style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}
                                >
                                    {aiGenerating ? (
                                        <>
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                            Generating...
                                        </>
                                    ) : (
                                        <>✨ Generate</>
                                    )}
                                </button>
                            </div>
                            {aiMessage && (
                                <div className={`mt-3 px-4 py-3 rounded-lg text-sm ${aiMessage.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                    {aiMessage.type === 'success' ? '✅ ' : '❌ '}{aiMessage.text}
                                </div>
                            )}
                        </div>

                        <div className="p-4 rounded-lg flex gap-3 shrink-0" style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                            <div className="shrink-0">💡</div>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Tip:</strong> After defining your rules and collections here, go to the
                                <span className="font-medium mx-1" style={{ color: 'var(--text-primary)' }}>Agent Designer</span>
                                &gt; <span className="font-medium mx-1" style={{ color: 'var(--text-primary)' }}>Guardrails</span> tab to enable them for specific agents.
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'directchat' && (
                    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
                        <div>
                            <h2 className="text-xl font-bold mb-1 text-primary">Direct Chat Guardrails</h2>
                            <p className="text-sm text-muted">Apply regex rules to the direct chat. This works the same way as agent guardrails.</p>
                        </div>

                        <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                            {/* Enable Toggle */}
                            <div className="flex items-center justify-between p-3 rounded-lg border bg-white/5 border-white/10 mb-6">
                                <span className="text-sm font-medium text-[var(--text-primary)]">Enable Regex Guardrails</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={dcEnabled} onChange={e => setDcEnabled(e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                            </div>

                            {dcEnabled && (
                                <div className="space-y-6 animate-fadeIn">
                                    {/* Collections */}
                                    <div>
                                        <label className="text-xs font-medium text-muted mb-3 block">Rule Collections</label>
                                        <div className="space-y-2 p-3 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                                            {collections.length === 0 ? (
                                                <p className="text-xs text-muted italic">No collections available. Create them in the Regex Rules tab.</p>
                                            ) : collections.map(col => (
                                                <label key={col.id} className="flex items-center gap-3 text-sm text-[var(--text-secondary)] cursor-pointer p-2 rounded hover:bg-white/5 transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={dcCollections.includes(col.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setDcCollections([...dcCollections, col.id]);
                                                            } else {
                                                                setDcCollections(dcCollections.filter(id => id !== col.id));
                                                            }
                                                        }}
                                                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0"
                                                    />
                                                    <div className="flex-1">
                                                        <div className="font-medium text-[var(--text-primary)]">{col.name}</div>
                                                        <div className="text-xs text-muted">{col.ruleIds?.length || 0} rules</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        {/* Scope */}
                                        <div>
                                            <label className="text-xs font-medium text-muted mb-3 block">Monitoring Scope</label>
                                            <div className="space-y-2">
                                                {[
                                                    { key: 'userInput', label: 'User Input' },
                                                    { key: 'agentOutput', label: 'AI Output' },
                                                ].map(s => (
                                                    <label key={s.key} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer hover:text-primary transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={dcScope[s.key]}
                                                            onChange={(e) => setDcScope(prev => ({ ...prev, [s.key]: e.target.checked }))}
                                                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0"
                                                        />
                                                        {s.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Action */}
                                        <div>
                                            <label className="text-xs font-medium text-muted mb-3 block">Violation Action</label>
                                            <div className="flex flex-col gap-3">
                                                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer hover:text-primary transition-colors">
                                                    <input type="radio" name="dcAction" value="delete" checked={dcAction === 'delete'} onChange={e => setDcAction(e.target.value)} className="w-4 h-4 border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0" />
                                                    Delete message
                                                </label>
                                                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer hover:text-primary transition-colors">
                                                    <input type="radio" name="dcAction" value="redact" checked={dcAction === 'redact'} onChange={e => setDcAction(e.target.value)} className="w-4 h-4 border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0" />
                                                    Redact information
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-4 mt-6 border-t border-white/5">
                                {dcMessage && <span className={`text-sm ${dcMessage.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{dcMessage.text}</span>}
                                <button
                                    onClick={handleSaveDcGuardrails}
                                    disabled={dcSaving}
                                    className="px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 shadow-lg transition-all hover:opacity-90"
                                    style={{ background: 'var(--accent-primary)', color: 'white' }}
                                >
                                    {dcSaving ? 'Saving...' : 'Save Configuration'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'orgshield' && (
                    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
                        <div>
                            <h2 className="text-xl font-bold mb-1 text-primary">Organization Privacy Shield</h2>
                            <p className="text-sm text-muted">Set regex guardrails that apply to all agents and direct chat within an organization. Agent-level guardrails are additive on top.</p>
                        </div>

                        {orgList.length === 0 ? (
                            <div className="p-8 rounded-xl border text-center" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                <span className="text-3xl mb-3 block">🏢</span>
                                <p className="text-sm text-muted">No organizations found. Create one in User Management first.</p>
                            </div>
                        ) : (
                            <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                {/* Org Selector */}
                                {orgList.length > 1 && (
                                    <div className="mb-6">
                                        <label className="text-xs font-medium text-muted mb-2 block">Organization</label>
                                        <select
                                            value={selectedOrgId}
                                            onChange={e => handleOrgChange(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-lg border text-sm"
                                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }}
                                        >
                                            {orgList.map(org => (
                                                <option key={org.id} value={org.id}>{org.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {orgShieldLoading ? (
                                    <div className="text-sm text-muted py-4 text-center">Loading shield config...</div>
                                ) : (
                                    <>
                                        {/* Enable Toggle */}
                                        <div className="flex items-center justify-between p-3 rounded-lg border bg-white/5 border-white/10 mb-6">
                                            <div>
                                                <span className="text-sm font-medium text-[var(--text-primary)] block">Enable Privacy Shield</span>
                                                <span className="text-xs text-muted">Applies to all agents and direct chat in this org</span>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" checked={orgShieldEnabled} onChange={e => setOrgShieldEnabled(e.target.checked)} className="sr-only peer" />
                                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                            </label>
                                        </div>

                                        {orgShieldEnabled && (
                                            <div className="space-y-6 animate-fadeIn">
                                                {/* AI Content Moderation Toggle */}
                                                <div className="flex items-center justify-between p-3 rounded-lg border bg-white/5 border-white/10">
                                                    <div>
                                                        <span className="text-sm font-medium text-[var(--text-primary)] block">AI Content Moderation</span>
                                                        <span className="text-xs text-muted">Automatically check all messages for harmful content</span>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={orgShieldModeration} onChange={e => setOrgShieldModeration(e.target.checked)} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                    </label>
                                                </div>

                                                {orgShieldModeration && (
                                                    <div>
                                                        <label className="text-xs font-medium text-muted mb-3 block">Blocked Categories</label>
                                                        <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                                                            {MODERATION_CATEGORIES.map(cat => (
                                                                <label key={cat.id} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer p-2 rounded hover:bg-white/5 transition-colors">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={orgShieldCategories.includes(cat.id)}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                setOrgShieldCategories([...orgShieldCategories, cat.id]);
                                                                            } else {
                                                                                setOrgShieldCategories(orgShieldCategories.filter(id => id !== cat.id));
                                                                            }
                                                                        }}
                                                                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0"
                                                                    />
                                                                    <span>{cat.icon}</span>
                                                                    <span>{cat.label}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* EU-Only Models */}
                                                <div className="flex items-center justify-between p-3 rounded-lg border bg-white/5 border-white/10">
                                                    <div>
                                                        <span className="text-sm font-medium text-[var(--text-primary)] block">🇪🇺 EU-Only Models</span>
                                                        <span className="text-xs text-muted">Use EU-hosted models instead of regular tiers (configure in AI Config → Chat Models)</span>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={euModeEnabled} onChange={e => setEuModeEnabled(e.target.checked)} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                    </label>
                                                </div>

                                                {/* Web Search Guard */}
                                                <div className="flex items-center justify-between p-3 rounded-lg border bg-white/5 border-white/10">
                                                    <div>
                                                        <span className="text-sm font-medium text-[var(--text-primary)] block">🔍 Web Search Guard</span>
                                                        <span className="text-xs text-muted">Block sensitive queries from being sent to external web search</span>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={orgWebSearchGuard} onChange={e => setOrgWebSearchGuard(e.target.checked)} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                    </label>
                                                </div>

                                                {/* Collections */}
                                                <div>
                                                    <label className="text-xs font-medium text-muted mb-3 block">Rule Collections</label>
                                                    <div className="space-y-2 p-3 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                                                        {collections.length === 0 ? (
                                                            <p className="text-xs text-muted italic">No collections available. Create them in the Regex Rules tab.</p>
                                                        ) : collections.map(col => (
                                                            <label key={col.id} className="flex items-center gap-3 text-sm text-[var(--text-secondary)] cursor-pointer p-2 rounded hover:bg-white/5 transition-colors">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={orgShieldCollections.includes(col.id)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            setOrgShieldCollections([...orgShieldCollections, col.id]);
                                                                        } else {
                                                                            setOrgShieldCollections(orgShieldCollections.filter(id => id !== col.id));
                                                                        }
                                                                    }}
                                                                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0"
                                                                />
                                                                <div className="flex-1">
                                                                    <div className="font-medium text-[var(--text-primary)]">{col.name}</div>
                                                                    <div className="text-xs text-muted">{col.ruleIds?.length || 0} rules</div>
                                                                </div>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-6">
                                                    {/* Scope */}
                                                    <div>
                                                        <label className="text-xs font-medium text-muted mb-3 block">Monitoring Scope</label>
                                                        <div className="space-y-2">
                                                            {[
                                                                { key: 'userInput', label: 'User Input' },
                                                                { key: 'agentOutput', label: 'AI Output' },
                                                            ].map(s => (
                                                                <label key={s.key} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer hover:text-primary transition-colors">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={orgShieldScope[s.key]}
                                                                        onChange={(e) => setOrgShieldScope(prev => ({ ...prev, [s.key]: e.target.checked }))}
                                                                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0"
                                                                    />
                                                                    {s.label}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Action */}
                                                    <div>
                                                        <label className="text-xs font-medium text-muted mb-3 block">Violation Action</label>
                                                        <div className="flex flex-col gap-3">
                                                            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer hover:text-primary transition-colors">
                                                                <input type="radio" name="orgAction" value="delete" checked={orgShieldAction === 'delete'} onChange={e => setOrgShieldAction(e.target.value)} className="w-4 h-4 border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0" />
                                                                Delete message
                                                            </label>
                                                            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer hover:text-primary transition-colors">
                                                                <input type="radio" name="orgAction" value="redact" checked={orgShieldAction === 'redact'} onChange={e => setOrgShieldAction(e.target.value)} className="w-4 h-4 border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0" />
                                                                Redact information
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-end gap-3 pt-4 mt-6 border-t border-white/5">
                                            {orgShieldMessage && <span className={`text-sm ${orgShieldMessage.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{orgShieldMessage.text}</span>}
                                            <button
                                                onClick={handleSaveOrgShield}
                                                disabled={orgShieldSaving}
                                                className="px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 shadow-lg transition-all hover:opacity-90"
                                                style={{ background: 'var(--accent-primary)', color: 'white' }}
                                            >
                                                {orgShieldSaving ? 'Saving...' : 'Save Privacy Shield'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <div className="p-4 rounded-lg flex gap-3" style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                            <div className="shrink-0">🛡️</div>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>How it works:</strong> The privacy shield applies <strong>before</strong> agent-level guardrails.
                                Agents can add extra rules on top, but cannot weaken the organisation shield. The strictest action (delete &gt; redact) always wins.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------
// AI Moderation Config Component — Guard Service (Llama Guard)
// ----------------------------------------------------------------------
const AIModerationConfig = () => {
    const [config, setConfig] = useState({ enabled: false, threshold: 0.7 });
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);
    const [guardHealth, setGuardHealth] = useState(null);

    useEffect(() => {
        fetchData();
        checkGuardHealth();
    }, []);

    const fetchData = async () => {
        try {
            const res = await authFetch(`${API_BASE}/ai/config`);
            if (res.ok) {
                const data = await res.json();
                if (data.llamaGuardConfig) {
                    setConfig({
                        enabled: data.llamaGuardConfig.enabled || false,
                        threshold: data.llamaGuardConfig.threshold || 0.7
                    });
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    const checkGuardHealth = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/guard/health`);
            if (res.ok) {
                setGuardHealth(await res.json());
            } else {
                setGuardHealth({ status: 'unavailable' });
            }
        } catch (e) {
            setGuardHealth({ status: 'unavailable' });
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMsg(null);
        try {
            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ llamaGuardConfig: config }),
            });
            if (res.ok) {
                setMsg({ type: 'success', text: 'Saved successfully!' });
            } else {
                setMsg({ type: 'error', text: 'Failed to save.' });
            }
        } catch (e) {
            setMsg({ type: 'error', text: 'Error saving.' });
        } finally {
            setSaving(false);
        }
    };

    const categories = [
        { id: 'S1', label: 'Violent Crimes', icon: '⚔️' },
        { id: 'S2', label: 'Non-Violent Crimes', icon: '⚠️' },
        { id: 'S3', label: 'Sex-Related Crimes', icon: '🚫' },
        { id: 'S4', label: 'Child Sexual Exploitation', icon: '🛑' },
        { id: 'S5', label: 'Defamation', icon: '📢' },
        { id: 'S6', label: 'Specialized Advice', icon: '⚕️' },
        { id: 'S7', label: 'Privacy', icon: '🔒' },
        { id: 'S8', label: 'Intellectual Property', icon: '©️' },
        { id: 'S9', label: 'Indiscriminate Weapons', icon: '💣' },
        { id: 'S10', label: 'Hate', icon: '🚷' },
        { id: 'S11', label: 'Suicide & Self-Harm', icon: '💔' },
        { id: 'S12', label: 'Sexual Content', icon: '🔞' },
        { id: 'S13', label: 'Elections', icon: '🗳️' },
        { id: 'S14', label: 'Code Interpreter Abuse', icon: '💻' },
    ];

    const guardOnline = guardHealth?.status === 'ok';
    const guardFastOk = guardHealth?.guard_fast === 'ok';

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
            <div>
                <h2 className="text-xl font-bold mb-2 text-primary">AI Moderation</h2>
                <p className="text-sm text-muted">Self-hosted AI content moderation using Llama Guard.</p>
            </div>

            <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>🛡️</div>
                    <div className="flex-1">
                        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Guard Service</h3>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            Powered by <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--bg-tertiary)' }}>Llama-Guard-3-1B</code> — self-hosted
                        </p>
                    </div>
                    {guardHealth && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${guardOnline ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                            <span className={`w-2 h-2 rounded-full ${guardOnline ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                            {guardOnline ? (guardFastOk ? 'Online' : 'Degraded') : 'Offline'}
                        </div>
                    )}
                </div>

                <div className="space-y-5">
                    {/* Enabled Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-white/5 border-white/10">
                        <span className="text-sm font-medium text-[var(--text-primary)]">Enable AI Moderation</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>

                    {/* Threshold Slider */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Confidence Threshold</label>
                            <span className="text-sm font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--accent-primary)' }}>{config.threshold}</span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.05"
                            value={config.threshold}
                            onChange={e => setConfig({ ...config, threshold: parseFloat(e.target.value) })}
                            className="w-full accent-[var(--accent-primary)]"
                        />
                        <div className="flex justify-between text-xs text-muted mt-1">
                            <span>Block more (0.1)</span>
                            <span>Block less (1.0)</span>
                        </div>
                    </div>

                    {/* Categories Info */}
                    <div>
                        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Detected Categories</label>
                        <div className="grid grid-cols-3 gap-2">
                            {categories.map(cat => (
                                <div key={cat.id} className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                                    <span className="text-base">{cat.icon}</span>
                                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{cat.label}</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-muted mt-2">All categories are checked automatically. Content with confidence above the threshold will be blocked.</p>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                        {msg && <span className={`text-sm ${msg.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{msg.text}</span>}
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 shadow-lg transition-all hover:opacity-90"
                            style={{ background: 'var(--accent-primary)', color: 'white' }}
                        >
                            {saving ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>

                </div>
            </div>

            <div className="p-4 rounded-lg flex gap-3" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                <div className="shrink-0">✅</div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Self-hosted:</strong> AI Moderation runs on your own infrastructure using <code className="text-xs px-1 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)' }}>Llama Guard</code>. No data leaves your servers and there are no per-token costs.
                </p>
            </div>
        </div>
    );
};

export default GuardrailsPanel;
