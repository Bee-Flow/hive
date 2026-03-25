import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../utils/helpers';

// Guardrails Configuration Panel (Regex Rules)
const GuardrailsPanel = ({ orgShieldOnly = false }) => {
    const { t } = useTranslation();
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
    const [orgDisableSearchOnUpload, setOrgDisableSearchOnUpload] = useState(false);
    const [orgAzurePiiEnabled, setOrgAzurePiiEnabled] = useState(false);
    const [activeModerationProvider, setActiveModerationProvider] = useState('llamaguard');
    const [hasAzureEndpoint, setHasAzureEndpoint] = useState(false);

    // PII Detection State
    const [piiEnabled, setPiiEnabled] = useState(false);
    const [piiCategories, setPiiCategories] = useState([]);
    const [piiThreshold, setPiiThreshold] = useState(0.7);
    const [piiScanInput, setPiiScanInput] = useState(true);
    const [piiScanOutput, setPiiScanOutput] = useState(false);
    const [piiAction, setPiiAction] = useState('block'); // 'block' | 'tokenize'
    const [piiSaving, setPiiSaving] = useState(false);
    const [piiMessage, setPiiMessage] = useState(null);

    const PII_CATEGORIES_LIST = [
        { id: 'Person',                           label: 'Person Name',          group: 'Personal',   icon: '👤' },
        { id: 'PhoneNumber',                      label: 'Phone Number',         group: 'Contact',    icon: '📱' },
        { id: 'Email',                            label: 'Email Address',        group: 'Contact',    icon: '📧' },
        { id: 'Address',                          label: 'Physical Address',     group: 'Contact',    icon: '🏠' },
        { id: 'CreditCardNumber',                 label: 'Credit Card',          group: 'Financial',  icon: '💳' },
        { id: 'BankAccountNumber',                label: 'Bank Account',         group: 'Financial',  icon: '🏦' },
        { id: 'InternationalBankingAccountNumber',label: 'IBAN',                 group: 'Financial',  icon: '🌐' },
        { id: 'USSocialSecurityNumber',           label: 'SSN (US)',             group: 'Identity',   icon: '🆔' },
        { id: 'PassportNumber',                   label: 'Passport Number',      group: 'Identity',   icon: '🛂' },
        { id: 'DriversLicenseNumber',             label: "Driver's License",    group: 'Identity',   icon: '🪪' },
        { id: 'IPAddress',                        label: 'IP Address',           group: 'Digital',    icon: '🌐' },
        { id: 'URL',                              label: 'URL',                  group: 'Digital',    icon: '🔗' },
        { id: 'EUNationalIdentificationNumber',   label: 'EU National ID / BSN', group: 'EU',         icon: '🇪🇺' },
    ];

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

    const AZURE_MODERATION_CATEGORIES = [
        { id: 'Hate', label: 'Hate and Fairness', icon: '🚷' },
        { id: 'Violence', label: 'Violence', icon: '⚔️' },
        { id: 'Sexual', label: 'Sexual', icon: '🔞' },
        { id: 'SelfHarm', label: 'Self-Harm', icon: '💔' },
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
                setActiveModerationProvider(data.moderationProvider || 'llamaguard');
                setHasAzureEndpoint(data.hasAzureContentSafetyEndpoint || false);
                // PII Detection
                setPiiEnabled(data.piiDetectionEnabled || false);
                setPiiCategories(data.piiDetectionCategories?.length > 0
                    ? data.piiDetectionCategories
                    : PII_CATEGORIES_LIST.map(c => c.id));
                setPiiThreshold(data.piiDetectionConfidenceThreshold ?? 0.7);
                setPiiScanInput(data.piiDetectionScope?.userInput !== false);
                setPiiScanOutput(data.piiDetectionScope?.agentOutput === true);
                setPiiAction(data.piiDetectionAction || 'block');
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
                setOrgDisableSearchOnUpload(data.disableSearchOnUpload || false);
                setOrgAzurePiiEnabled(data.azurePiiEnabled || false);
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
                    disableSearchOnUpload: orgDisableSearchOnUpload,
                    azurePiiEnabled: orgAzurePiiEnabled,
                })
            });
            if (res.ok) {
                setOrgShieldMessage({ type: 'success', text: t('admin.guard_saved') });
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
                setRulesMessage({ type: 'success', text: t('admin.guard_saved') });
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

    const handleSavePii = async () => {
        setPiiSaving(true);
        setPiiMessage(null);
        try {
            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    piiDetectionEnabled: piiEnabled,
                    piiDetectionCategories: piiCategories,
                    piiDetectionConfidenceThreshold: piiThreshold,
                    piiDetectionScope: { userInput: piiScanInput, agentOutput: piiScanOutput },
                    piiDetectionAction: piiAction,
                })
            });
            if (res.ok) {
                setPiiMessage({ type: 'success', text: t('admin.guard_saved') });
            } else {
                setPiiMessage({ type: 'error', text: 'Failed to save.' });
            }
        } catch (e) {
            setPiiMessage({ type: 'error', text: 'Error saving.' });
        } finally {
            setPiiSaving(false);
        }
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
                setDcMessage({ type: 'success', text: t('admin.guard_saved') });
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
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{t('admin.guard_title')}</h3>
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
                            {t('admin.guard_tab_mod')}
                        </button>
                        <button
                            onClick={() => setActiveTab('regex')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${activeTab === 'regex'
                                ? 'bg-[var(--accent-primary)] text-white shadow-md'
                                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                                }`}
                        >
                            <span className="text-lg">📝</span>
                            {t('admin.guard_tab_regex')}
                        </button>
                        <button
                            onClick={() => setActiveTab('directchat')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${activeTab === 'directchat'
                                ? 'bg-[var(--accent-primary)] text-white shadow-md'
                                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                                }`}
                        >
                            <span className="text-lg">💬</span>
                            {t('admin.guard_tab_direct')}
                        </button>
                        <button
                            onClick={() => setActiveTab('orgshield')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${activeTab === 'orgshield'
                                ? 'bg-[var(--accent-primary)] text-white shadow-md'
                                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                                }`}
                        >
                            <span className="text-lg">🏢</span>
                            {t('admin.guard_tab_org')}
                        </button>
                        <button
                            onClick={() => setActiveTab('pii')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${activeTab === 'pii'
                                ? 'bg-[var(--accent-primary)] text-white shadow-md'
                                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
                                }`}
                        >
                            <span className="text-lg">🕵️</span>
                            {t('admin.guard_tab_pii')}
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
                                <h2 className="text-xl font-bold mb-1 text-primary">{t('admin.guard_regex_title')}</h2>
                                <p className="text-sm text-muted">{t('admin.guard_regex_desc')}</p>
                            </div>
                            <button
                                onClick={handleSaveRules}
                                disabled={savingRules}
                                className="px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 shadow-lg shadow-purple-500/20 transition-all hover:opacity-90"
                                style={{ background: 'var(--accent-primary)', color: 'white' }}
                            >
                                {savingRules ? t('admin.guard_saving') : t('admin.guard_save_all')}
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
                            <h2 className="text-xl font-bold mb-1 text-primary">{t('admin.guard_direct_title')}</h2>
                            <p className="text-sm text-muted">{t('admin.guard_direct_desc')}</p>
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
                                    {dcSaving ? t('admin.guard_saving') : t('admin.guard_save_all')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'orgshield' && (
                    <div className="max-w-3xl mx-auto space-y-8 animate-fadeIn">
                        <div>
                            <h2 className="text-xl font-bold mb-1 text-primary">{t('admin.guard_org_title')}</h2>
                            <p className="text-sm text-muted">{t('admin.guard_org_desc')}</p>
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
                                        <div className="flex items-center justify-between p-4 rounded-xl border bg-white/5 border-white/10 mb-6">
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
                                            <div className="space-y-8 animate-fadeIn">
                                                {/* AI Content Moderation Toggle */}
                                                <div className="flex items-center justify-between p-4 rounded-xl border bg-white/5 border-white/10">
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
                                                        <label className="text-xs font-medium text-muted mb-3 block">
                                                            Blocked Categories {activeModerationProvider === 'azure' ? '(Azure AI Content Safety)' : '(Llama Guard)'}
                                                        </label>
                                                        <div className="grid grid-cols-2 gap-2 p-4 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                                                            {(activeModerationProvider === 'azure' ? AZURE_MODERATION_CATEGORIES : MODERATION_CATEGORIES).map(cat => (
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

                                                {/* Azure PII Detection — only shown when Azure is configured */}
                                                {hasAzureEndpoint && (
                                                <div className="flex items-center justify-between p-4 rounded-xl border bg-white/5 border-white/10">
                                                    <div>
                                                        <span className="text-sm font-medium text-[var(--text-primary)] block">🔍 Azure PII Detection</span>
                                                        <span className="text-xs text-muted">Use Azure AI Language to detect and block personally identifiable information</span>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={orgAzurePiiEnabled} onChange={e => setOrgAzurePiiEnabled(e.target.checked)} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                    </label>
                                                </div>
                                                )}

                                                {/* EU-Only Models */}
                                                <div className="flex items-center justify-between p-4 rounded-xl border bg-white/5 border-white/10">
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
                                                <div className="flex items-center justify-between p-4 rounded-xl border bg-white/5 border-white/10">
                                                    <div>
                                                        <span className="text-sm font-medium text-[var(--text-primary)] block">🔍 Web Search Guard</span>
                                                        <span className="text-xs text-muted">Block sensitive queries from being sent to external web search</span>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={orgWebSearchGuard} onChange={e => setOrgWebSearchGuard(e.target.checked)} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                    </label>
                                                </div>

                                                {/* Disable Web Search on File Upload */}
                                                <div className="flex items-center justify-between p-4 rounded-xl border bg-white/5 border-white/10">
                                                    <div>
                                                        <span className="text-sm font-medium text-[var(--text-primary)] block">📎 Disable Search on File Upload</span>
                                                        <span className="text-xs text-muted">Prevent web searches when users upload files (protects sensitive document data)</span>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={orgDisableSearchOnUpload} onChange={e => setOrgDisableSearchOnUpload(e.target.checked)} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                    </label>
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
                                                {orgShieldSaving ? t('admin.guard_saving') : t('admin.guard_save_all')}
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

                {activeTab === 'pii' && (
                    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
                        <div>
                            <h2 className="text-xl font-bold mb-1 text-primary">{t('admin.guard_pii_title')}</h2>
                            <p className="text-sm text-muted">{t('admin.guard_pii_desc')}</p>
                        </div>

                        <div className="p-6 rounded-xl border space-y-6" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                            {/* Master enable */}
                            <div className="flex items-center justify-between p-4 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                                <div>
                                    <span className="text-sm font-semibold text-[var(--text-primary)] block">Enable PII Detection</span>
                                    <span className="text-xs text-muted">Scan messages for personal data before sending to the AI</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={piiEnabled} onChange={e => setPiiEnabled(e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                            </div>

                            {piiEnabled && (
                                <div className="space-y-6 animate-fadeIn">

                                    {/* Action selector */}
                                    <div>
                                        <label className="text-xs font-semibold text-muted mb-3 block uppercase tracking-wide">When PII Is Detected</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                {
                                                    key: 'block',
                                                    icon: '🚫',
                                                    label: 'Block Message',
                                                    desc: 'Reject the message and ask user to remove PII before sending',
                                                },
                                                {
                                                    key: 'tokenize',
                                                    icon: '🔒',
                                                    label: 'Tokenize & Redact',
                                                    desc: 'Replace PII with safe tokens, let AI respond, then restore real values for user',
                                                },
                                            ].map(opt => (
                                                <button
                                                    key={opt.key}
                                                    onClick={() => setPiiAction(opt.key)}
                                                    className={`flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all ${
                                                        piiAction === opt.key
                                                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 shadow-sm'
                                                            : 'border-transparent bg-white/5 hover:border-white/10'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">{opt.icon}</span>
                                                        <span className="text-sm font-semibold text-[var(--text-primary)]">{opt.label}</span>
                                                        {piiAction === opt.key && <span className="ml-auto text-[var(--accent-primary)] text-xs font-bold">✓ Active</span>}
                                                    </div>
                                                    <p className="text-xs text-muted leading-relaxed">{opt.desc}</p>
                                                </button>
                                            ))}
                                        </div>
                                        {piiAction === 'tokenize' && (
                                            <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: 'var(--accent-primary)10', borderLeft: '3px solid var(--accent-primary)', paddingLeft: '12px' }}>
                                                <span className="font-semibold" style={{ color: 'var(--accent-primary)' }}>How it works: </span>
                                                <span className="text-muted">"My IBAN is NL38ABNA…" → sent as "My IBAN is [PII:iban:1]" → AI responds with [PII:iban:1] → you see the original IBAN</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Scanning scope */}
                                    <div>
                                        <label className="text-xs font-semibold text-muted mb-3 block uppercase tracking-wide">Scanning Scope</label>
                                        <div className="flex gap-3">
                                            {[
                                                { key: 'input', label: 'User Input', desc: piiAction === 'tokenize' ? 'Tokenize PII in messages' : 'Block messages containing PII', val: piiScanInput, set: setPiiScanInput },
                                                { key: 'output', label: 'AI Output', desc: 'Block AI responses containing PII', val: piiScanOutput, set: setPiiScanOutput },
                                            ].map(s => (
                                                <label key={s.key} className={`flex-1 flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${s.val ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30' : 'bg-white/5 border-transparent hover:border-white/10'}`}>
                                                    <input type="checkbox" checked={s.val} onChange={e => s.set(e.target.checked)} className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0" />
                                                    <div>
                                                        <div className="text-sm font-medium text-[var(--text-primary)]">{s.label}</div>
                                                        <div className="text-xs text-muted">{s.desc}</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Confidence threshold */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-semibold text-muted uppercase tracking-wide">Confidence Threshold</label>
                                            <span className="text-sm font-bold" style={{ color: 'var(--accent-primary)' }}>{piiThreshold.toFixed(2)}</span>
                                        </div>
                                        <input
                                            type="range" min="0.1" max="1.0" step="0.05"
                                            value={piiThreshold}
                                            onChange={e => setPiiThreshold(parseFloat(e.target.value))}
                                            className="w-full h-2 rounded-full appearance-none cursor-pointer"
                                            style={{ accentColor: 'var(--accent-primary)' }}
                                        />
                                        <div className="flex justify-between text-xs text-muted mt-1">
                                            <span>Detect more (0.1)</span>
                                            <span>Detect less (1.0)</span>
                                        </div>
                                    </div>

                                    {/* Category toggles — grouped */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="text-xs font-semibold text-muted uppercase tracking-wide">Detected Categories</label>
                                            <div className="flex gap-2">
                                                <button onClick={() => setPiiCategories(PII_CATEGORIES_LIST.map(c => c.id))} className="text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors font-medium" style={{ color: 'var(--accent-primary)' }}>All</button>
                                                <button onClick={() => setPiiCategories([])} className="text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors text-muted">None</button>
                                            </div>
                                        </div>
                                        {/* Grouped by category */}
                                        {['Personal', 'Contact', 'Financial', 'Identity', 'Digital', 'EU'].map(group => {
                                            const groupCats = PII_CATEGORIES_LIST.filter(c => c.group === group);
                                            if (!groupCats.length) return null;
                                            const allSelected = groupCats.every(c => piiCategories.includes(c.id));
                                            return (
                                                <div key={group} className="mb-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-medium text-muted">{group}</span>
                                                        <button
                                                            onClick={() => {
                                                                const gIds = groupCats.map(c => c.id);
                                                                if (allSelected) setPiiCategories(piiCategories.filter(id => !gIds.includes(id)));
                                                                else setPiiCategories([...new Set([...piiCategories, ...gIds])]);
                                                            }}
                                                            className="text-xs text-muted hover:text-[var(--accent-primary)] transition-colors"
                                                        >
                                                            {allSelected ? 'Deselect all' : 'Select all'}
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {groupCats.map(cat => (
                                                            <label key={cat.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${piiCategories.includes(cat.id) ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30' : 'bg-white/5 border-transparent hover:border-white/10'}`}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={piiCategories.includes(cat.id)}
                                                                    onChange={e => {
                                                                        if (e.target.checked) setPiiCategories([...piiCategories, cat.id]);
                                                                        else setPiiCategories(piiCategories.filter(id => id !== cat.id));
                                                                    }}
                                                                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0"
                                                                />
                                                                <span className="text-sm">{cat.icon}</span>
                                                                <div>
                                                                    <div className="text-sm font-medium text-[var(--text-primary)]">{cat.label}</div>
                                                                </div>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                                {piiMessage && <span className={`text-sm ${piiMessage.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{piiMessage.text}</span>}
                                <button
                                    onClick={handleSavePii}
                                    disabled={piiSaving}
                                    className="px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 shadow-lg transition-all hover:opacity-90"
                                    style={{ background: 'var(--accent-primary)', color: 'white' }}
                                >
                                    {piiSaving ? t('admin.guard_saving') : t('admin.guard_save_all')}
                                </button>
                            </div>
                        </div>

                        <div className="p-4 rounded-lg flex gap-3" style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
                            <div className="shrink-0">🔍</div>
                            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>How it works:</strong> When Azure AI Text Analytics is configured, it uses Microsoft's cloud API. Without Azure credentials, detection falls back automatically to a self-hosted CPU model (<code className="text-xs px-1 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)' }}>betterdataai/PII_DETECTION_MODEL</code>) running in the guard service.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------
// AI Moderation Config Component — Guard Service (Llama Guard) + Azure Content Safety
// ----------------------------------------------------------------------
const AIModerationConfig = () => {
    const { t } = useTranslation();
    const [config, setConfig] = useState({ enabled: false, threshold: 0.7 });
    const [moderationProvider, setModerationProvider] = useState('llamaguard');
    const [azureEndpoint, setAzureEndpoint] = useState('');
    const [azureKey, setAzureKey] = useState('');
    const [hasAzureEndpoint, setHasAzureEndpoint] = useState(false);
    const [hasAzureKey, setHasAzureKey] = useState(false);
    const [severityThreshold, setSeverityThreshold] = useState(2);
    const [azureEnabledCategories, setAzureEnabledCategories] = useState(['Hate', 'Violence', 'Sexual', 'SelfHarm']);
    const [piiEnabled, setPiiEnabled] = useState(false);
    const [piiCategories, setPiiCategories] = useState([]);
    const [piiConfidenceThreshold, setPiiConfidenceThreshold] = useState(0.7);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);
    const [guardHealth, setGuardHealth] = useState(null);

    const PII_CATEGORY_GROUPS = [
        { name: 'Personal', icon: '👤', categories: [
            { id: 'Person', label: 'Person Name' }, { id: 'PersonType', label: 'Person Type' },
            { id: 'Age', label: 'Age' }, { id: 'DateOfBirth', label: 'Date of Birth' },
        ]},
        { name: 'Contact', icon: '📱', categories: [
            { id: 'PhoneNumber', label: 'Phone Number' }, { id: 'Email', label: 'Email Address' },
            { id: 'Address', label: 'Physical Address' },
        ]},
        { name: 'Financial', icon: '💳', categories: [
            { id: 'CreditCardNumber', label: 'Credit Card' }, { id: 'BankAccountNumber', label: 'Bank Account' },
            { id: 'InternationalBankingAccountNumber', label: 'IBAN' }, { id: 'ABARoutingNumber', label: 'ABA Routing' },
            { id: 'SWIFTCode', label: 'SWIFT Code' },
        ]},
        { name: 'Identity', icon: '🆔', categories: [
            { id: 'USSocialSecurityNumber', label: 'SSN (US)' },
            { id: 'PassportNumber', label: 'Passport Number' }, { id: 'DriversLicenseNumber', label: "Driver's License" },
        ]},
        { name: 'Digital / Secrets', icon: '🔑', categories: [
            { id: 'IPAddress', label: 'IP Address' }, { id: 'URL', label: 'URL' },
            { id: 'AzureDocumentDBAuthKey', label: 'Azure CosmosDB Key' }, { id: 'AzureStorageAccountKey', label: 'Azure Storage Key' },
        ]},
        { name: 'Organization', icon: '🏢', categories: [
            { id: 'Organization', label: 'Organization' },
        ]},
        { name: '🇳🇱 Netherlands', icon: '🇳🇱', categories: [
            { id: 'EUNationalIdentificationNumber', label: 'BSN / National ID (EU)' },
        ]},
    ];
    const ALL_PII_IDS = PII_CATEGORY_GROUPS.flatMap(g => g.categories.map(c => c.id));

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
                setModerationProvider(data.moderationProvider || 'llamaguard');
                setHasAzureEndpoint(data.hasAzureContentSafetyEndpoint || false);
                setHasAzureKey(data.hasAzureContentSafetyKey || false);
                setSeverityThreshold(data.azureContentSafetySeverityThreshold ?? 2);
                setAzureEnabledCategories(data.azureContentSafetyCategories || ['Hate', 'Violence', 'Sexual', 'SelfHarm']);
                setPiiEnabled(data.piiDetectionEnabled || false);
                setPiiCategories(data.piiDetectionCategories || ALL_PII_IDS);
                setPiiConfidenceThreshold(data.piiDetectionConfidenceThreshold ?? 0.7);
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
            const body = {
                llamaGuardConfig: config,
                moderationProvider,
                azureContentSafetySeverityThreshold: severityThreshold,
                azureContentSafetyCategories: azureEnabledCategories,
                piiDetectionEnabled: piiEnabled,
                piiDetectionCategories: piiCategories,
                piiDetectionConfidenceThreshold: piiConfidenceThreshold,
            };
            if (azureEndpoint) body.azureContentSafetyEndpoint = azureEndpoint;
            if (azureKey) body.azureContentSafetyKey = azureKey;

            const res = await authFetch(`${API_BASE}/ai/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setMsg({ type: 'success', text: t('admin.guard_saved') });
                if (azureEndpoint) setHasAzureEndpoint(true);
                if (azureKey) setHasAzureKey(true);
                setAzureEndpoint('');
                setAzureKey('');
            } else {
                setMsg({ type: 'error', text: 'Failed to save.' });
            }
        } catch (e) {
            setMsg({ type: 'error', text: 'Error saving.' });
        } finally {
            setSaving(false);
        }
    };

    const llamaCategories = [
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

    const azureCategories = [
        { id: 'Hate', label: 'Hate and Fairness', icon: '🚷', desc: 'Discrimination, slurs, identity attacks' },
        { id: 'Violence', label: 'Violence', icon: '⚔️', desc: 'Physical harm, weapons, extremism' },
        { id: 'Sexual', label: 'Sexual', icon: '🔞', desc: 'Sexual content, nudity, exploitation' },
        { id: 'SelfHarm', label: 'Self-Harm', icon: '💔', desc: 'Self-injury, suicide, eating disorders' },
    ];

    const guardOnline = guardHealth?.status === 'ok';
    const guardFastOk = guardHealth?.guard_fast === 'ok';
    const isAzure = moderationProvider === 'azure';

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
            <div>
                <h2 className="text-xl font-bold mb-2 text-primary">{t('admin.guard_mod_title')}</h2>
                <p className="text-sm text-muted">{t('admin.guard_mod_desc')}</p>
            </div>

            {/* Provider Selector */}
            <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Moderation Provider</label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setModerationProvider('llamaguard')}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${!isAzure
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 shadow-md'
                            : 'border-[var(--border-default)] hover:border-[var(--border-subtle)] bg-white/5'}`}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-xl">🦙</span>
                            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Llama Guard</span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Self-hosted • No data leaves your servers • 14 categories</p>
                    </button>
                    <button
                        onClick={() => setModerationProvider('azure')}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${isAzure
                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 shadow-md'
                            : 'border-[var(--border-default)] hover:border-[var(--border-subtle)] bg-white/5'}`}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-xl">🔷</span>
                            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Azure AI Content Safety</span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Cloud-based • Microsoft Azure • 4 categories with severity levels</p>
                    </button>
                </div>
            </div>

            {/* Provider-Specific Config */}
            <div className="p-6 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>

                {/* Header — different per provider */}
                {!isAzure ? (
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
                ) : (
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: 'rgba(59, 130, 246, 0.15)' }}>🔷</div>
                        <div className="flex-1">
                            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Azure AI Content Safety</h3>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                Cloud-based content moderation via <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--bg-tertiary)' }}>@azure-rest/ai-content-safety</code>
                            </p>
                        </div>
                        {hasAzureEndpoint && hasAzureKey && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                Configured
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-5">
                    {/* Enabled Toggle (shared) */}
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-white/5 border-white/10">
                        <span className="text-sm font-medium text-[var(--text-primary)]">Enable AI Moderation</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>

                    {/* Azure-specific: Endpoint + API Key */}
                    {isAzure && (
                        <div className="space-y-4 animate-fadeIn">
                            <div>
                                <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-primary)' }}>Content Safety Endpoint</label>
                                <input
                                    type="text"
                                    value={azureEndpoint}
                                    onChange={e => setAzureEndpoint(e.target.value)}
                                    placeholder={hasAzureEndpoint ? '••• endpoint configured •••' : 'https://your-resource.cognitiveservices.azure.com/'}
                                    className="w-full px-4 py-2.5 rounded-lg border text-sm"
                                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }}
                                />
                                <p className="text-xs text-muted mt-1">The endpoint of your Azure AI Content Safety resource.</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-primary)' }}>API Key</label>
                                <input
                                    type="password"
                                    value={azureKey}
                                    onChange={e => setAzureKey(e.target.value)}
                                    placeholder={hasAzureKey ? '••• key configured •••' : 'Enter API key'}
                                    className="w-full px-4 py-2.5 rounded-lg border text-sm"
                                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', background: 'var(--bg-tertiary)' }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Threshold: different per provider */}
                    {isAzure ? (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Severity Threshold</label>
                                <span className="text-sm font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--accent-primary)' }}>≥ {severityThreshold}</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="7"
                                step="1"
                                value={severityThreshold}
                                onChange={e => setSeverityThreshold(parseInt(e.target.value))}
                                className="w-full accent-[var(--accent-primary)]"
                            />
                            <div className="flex justify-between text-xs text-muted mt-1">
                                <span>Block more (0)</span>
                                <span>Block less (7)</span>
                            </div>
                            <p className="text-xs text-muted mt-1">Content with severity at or above this value will be blocked. Scale: 0 (safe) to 7 (most severe).</p>
                        </div>
                    ) : (
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
                    )}

                    {/* Categories */}
                    <div>
                        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                            {isAzure ? 'Enforced Categories' : 'Detected Categories'}
                        </label>
                        {isAzure ? (
                            <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                                {azureCategories.map(cat => (
                                    <label key={cat.id} className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={azureEnabledCategories.includes(cat.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setAzureEnabledCategories([...azureEnabledCategories, cat.id]);
                                                } else {
                                                    setAzureEnabledCategories(azureEnabledCategories.filter(id => id !== cat.id));
                                                }
                                            }}
                                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0"
                                        />
                                        <span className="text-base">{cat.icon}</span>
                                        <div>
                                            <span className="text-sm block" style={{ color: 'var(--text-secondary)' }}>{cat.label}</span>
                                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{cat.desc}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {llamaCategories.map(cat => (
                                    <div key={cat.id} className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
                                        <span className="text-base">{cat.icon}</span>
                                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{cat.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-muted mt-2">
                            {isAzure
                                ? 'Only checked categories will be analyzed. Unchecked categories are ignored by Azure.'
                                : 'All categories are checked automatically. Content with confidence above the threshold will be blocked.'}
                        </p>
                    </div>

                    {/* PII Detection (only shown for Azure — shared endpoint) */}
                    {isAzure && (
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: 'rgba(139, 92, 246, 0.15)' }}>🔒</div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>PII Detection</h3>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Detect personal data like credit cards, SSNs, emails, phone numbers</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={piiEnabled} onChange={e => setPiiEnabled(e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-500"></div>
                                </label>
                            </div>

                            {piiEnabled && (
                                <div className="space-y-4 animate-fadeIn">
                                    {/* PII Confidence Threshold */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>PII Confidence Threshold</label>
                                            <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                                ≥ {piiConfidenceThreshold.toFixed(2)}
                                            </span>
                                        </div>
                                        <input
                                            type="range" min="0.1" max="1.0" step="0.05"
                                            value={piiConfidenceThreshold}
                                            onChange={e => setPiiConfidenceThreshold(parseFloat(e.target.value))}
                                            className="w-full accent-violet-500"
                                        />
                                        <div className="flex justify-between text-xs text-muted mt-1">
                                            <span>Detect more (0.1)</span><span>Detect less (1.0)</span>
                                        </div>
                                    </div>

                                    {/* PII Categories by Group */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Enforced PII Categories</label>
                                        <div className="space-y-2">
                                            {PII_CATEGORY_GROUPS.map(group => {
                                                const gIds = group.categories.map(c => c.id);
                                                const selCount = gIds.filter(id => piiCategories.includes(id)).length;
                                                const allSel = selCount === gIds.length;
                                                return (
                                                    <div key={group.name} className="rounded-lg border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                                                        <div
                                                            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5 rounded-t-lg transition-colors"
                                                            onClick={() => {
                                                                if (allSel) setPiiCategories(prev => prev.filter(id => !gIds.includes(id)));
                                                                else setPiiCategories(prev => [...new Set([...prev, ...gIds])]);
                                                            }}
                                                        >
                                                            <input type="checkbox" checked={allSel} readOnly className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-violet-500 focus:ring-0" />
                                                            <span className="text-sm">{group.icon}</span>
                                                            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{group.name}</span>
                                                            <span className="text-xs text-muted ml-auto">{selCount}/{gIds.length}</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-0.5 px-3 pb-2">
                                                            {group.categories.map(cat => (
                                                                <label key={cat.id} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer p-1.5 rounded hover:bg-white/5 transition-colors">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={piiCategories.includes(cat.id)}
                                                                        onChange={() => setPiiCategories(prev => prev.includes(cat.id) ? prev.filter(c => c !== cat.id) : [...prev, cat.id])}
                                                                        className="w-3 h-3 rounded border-gray-600 bg-gray-700 text-violet-500 focus:ring-0"
                                                                    />
                                                                    {cat.label}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <p className="text-xs text-muted mt-2">Only checked PII categories will be scanned. Uses the same Azure endpoint as Content Safety.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                        {msg && <span className={`text-sm ${msg.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{msg.text}</span>}
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50 shadow-lg transition-all hover:opacity-90"
                            style={{ background: 'var(--accent-primary)', color: 'white' }}
                        >
                            {saving ? t('admin.guard_saving') : t('admin.guard_save_all')}
                        </button>
                    </div>

                </div>
            </div>

            <div className="p-4 rounded-lg flex gap-3" style={{ background: isAzure ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)', border: `1px solid ${isAzure ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)'}` }}>
                <div className="shrink-0">{isAzure ? '🔷' : '✅'}</div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {isAzure ? (
                        <>
                            <strong style={{ color: 'var(--text-primary)' }}>Cloud-based:</strong> Azure AI Content Safety analyzes content using Microsoft's AI models. Data is sent to Azure for analysis. Works at global, organization, and agent level.
                        </>
                    ) : (
                        <>
                            <strong style={{ color: 'var(--text-primary)' }}>Self-hosted:</strong> AI Moderation runs on your own infrastructure using <code className="text-xs px-1 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)' }}>Llama Guard</code>. No data leaves your servers and there are no per-token costs.
                        </>
                    )}
                </p>
            </div>
        </div>
    );
};

export default GuardrailsPanel;
