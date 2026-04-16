import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../utils/helpers';
import { LLAMA_GUARD_CATEGORIES, AZURE_CONTENT_SAFETY_CATEGORIES } from '../../utils/guardrailCategories';
import { ToastHost, showToast } from './guardrails/Toast';

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
    const [orgMonitorIntegrations, setOrgMonitorIntegrations] = useState(false);
    const [webSearchGuardPiiCategories, setWebSearchGuardPiiCategories] = useState([]);
    const [orgAzurePiiEnabled, setOrgAzurePiiEnabled] = useState(false);
    const [activeModerationProvider, setActiveModerationProvider] = useState('llamaguard');
    const [hasAzureEndpoint, setHasAzureEndpoint] = useState(false);
    const [hasEuModelsConfigured, setHasEuModelsConfigured] = useState(false);
    const [hasWebSearchEnabled, setHasWebSearchEnabled] = useState(false);
    // Org-level Content Safety + PII settings
    const [orgSeverityThreshold, setOrgSeverityThreshold] = useState(2);
    const [orgAzureCategories, setOrgAzureCategories] = useState(['Hate', 'Violence', 'Sexual', 'SelfHarm']);
    const [orgPiiCategories, setOrgPiiCategories] = useState([]);
    const [orgPiiConfidenceThreshold, setOrgPiiConfidenceThreshold] = useState(0.7);
    const [orgPiiAction, setOrgPiiAction] = useState('block');

    // DLP (Data Loss Prevention) state
    const [dlpEnabled, setDlpEnabled] = useState(false);
    const [dlpScope, setDlpScope] = useState('external');
    const [dlpMode, setDlpMode] = useState('ask');
    const [dlpFailureMode, setDlpFailureMode] = useState('fail_closed');
    const [dlpAllowlistedHosts, setDlpAllowlistedHosts] = useState([]);
    const [customSensitiveTerms, setCustomSensitiveTerms] = useState([]);
    const [newTermLabel, setNewTermLabel] = useState('');
    const [newTermPattern, setNewTermPattern] = useState('');
    const [newTermType, setNewTermType] = useState('literal');
    const [newTermCaseSensitive, setNewTermCaseSensitive] = useState(false);

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
        // Personal
        { id: 'Person',                           label: t('pii.person_name'),      group: 'Personal',   icon: '👤' },
        { id: 'PersonType',                       label: t('pii.person_type'),      group: 'Personal',   icon: '👥' },
        { id: 'Age',                              label: t('pii.age'),             group: 'Personal',   icon: '🎂' },
        { id: 'DateOfBirth',                      label: t('pii.date_of_birth'),   group: 'Personal',   icon: '📅' },
        // Contact
        { id: 'PhoneNumber',                      label: t('pii.phone_number'),     group: 'Contact',    icon: '📱' },
        { id: 'Email',                            label: t('pii.email_address'),    group: 'Contact',    icon: '📧' },
        { id: 'Address',                          label: t('pii.physical_address'), group: 'Contact',    icon: '🏠' },
        // Financial
        { id: 'CreditCardNumber',                 label: t('pii.credit_card'),      group: 'Financial',  icon: '💳' },
        { id: 'BankAccountNumber',                label: t('pii.bank_account'),     group: 'Financial',  icon: '🏦' },
        { id: 'InternationalBankingAccountNumber',label: t('pii.iban'),             group: 'Financial',  icon: '🌐' },
        { id: 'ABARoutingNumber',                 label: t('pii.aba_routing'),     group: 'Financial',  icon: '🔢' },
        { id: 'SWIFTCode',                        label: t('pii.swift_code'),      group: 'Financial',  icon: '🏧' },
        // Identity / Government
        { id: 'USSocialSecurityNumber',           label: t('pii.ssn'),             group: 'Identity',   icon: '🆔' },
        { id: 'PassportNumber',                   label: t('pii.passport'),        group: 'Identity',   icon: '🛂' },
        { id: 'DriversLicenseNumber',             label: t('pii.drivers_license'), group: 'Identity',   icon: '🪪' },
        // Digital / Secrets
        { id: 'IPAddress',                        label: t('pii.ip_address'),      group: 'Digital',    icon: '🌐' },
        { id: 'URL',                              label: t('pii.url'),             group: 'Digital',    icon: '🔗' },
        { id: 'AzureDocumentDBAuthKey',           label: t('pii.azure_cosmosdb_key'), group: 'Digital', icon: '☁️' },
        { id: 'AzureStorageAccountKey',           label: t('pii.azure_storage_key'), group: 'Digital',  icon: '☁️' },
        // Organization
        { id: 'Organization',                     label: t('pii.organization'),    group: 'Organization', icon: '🏢' },
        // EU / Netherlands
        { id: 'EUNationalIdentificationNumber',   label: t('pii.eu_national_id'),  group: 'EU',         icon: '🇪🇺' },
    ];

    // Moved to a shared util so the admin UI and the end-user violation toast
    // use the same human-friendly labels. See agent-hub/src/utils/guardrailCategories.js.
    const MODERATION_CATEGORIES = LLAMA_GUARD_CATEGORIES;

    // Azure Content Safety's four categories. Labels come from the shared util
    // so the admin UI and violation toast read the same strings. Overridden
    // here when a translation key exists.
    const AZURE_TRANSLATION_KEYS = { Hate: 'safety.hate', Violence: 'safety.violence', Sexual: 'safety.sexual', SelfHarm: 'safety.self_harm' };
    const AZURE_MODERATION_CATEGORIES = AZURE_CONTENT_SAFETY_CATEGORIES.map(c => {
        const key = AZURE_TRANSLATION_KEYS[c.id];
        const translated = key ? t(key) : '';
        return { ...c, label: (translated && translated !== key) ? translated : c.label };
    });

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
                setHasWebSearchEnabled(data.searchProvider && data.searchProvider !== 'disabled');
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

            // Fetch EU Models to check configuration
            const euRes = await authFetch(`${API_BASE}/ai/config/chat-models-eu`);
            if (euRes.ok) {
                const euModels = await euRes.json();
                const isEuConfigured = Object.values(euModels).some(tier => tier && tier.modelId && tier.modelId.trim() !== '');
                setHasEuModelsConfigured(isEuConfigured);
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
                setOrgMonitorIntegrations(data.monitorIntegrations || false);
                setWebSearchGuardPiiCategories(data.webSearchGuardPiiCategories || []);
                setOrgAzurePiiEnabled(data.azurePiiEnabled || false);
                setOrgSeverityThreshold(data.azureSeverityThreshold ?? 2);
                setOrgAzureCategories(data.azureEnabledCategories?.length > 0 ? data.azureEnabledCategories : ['Hate', 'Violence', 'Sexual', 'SelfHarm']);
                const validIds = new Set(PII_CATEGORIES_LIST.map(c => c.id));
                const loaded = (data.piiDetectionCategories || []).filter(id => validIds.has(id));
                setOrgPiiCategories(loaded);
                setOrgPiiConfidenceThreshold(data.piiDetectionConfidenceThreshold ?? 0.7);
                setOrgPiiAction(data.piiDetectionAction || 'block');
                // DLP
                setDlpEnabled(!!data.dlpEnabled);
                setDlpScope(data.dlpScope === 'all' ? 'all' : 'external');
                setDlpMode(['ask', 'auto_redact', 'block'].includes(data.dlpMode) ? data.dlpMode : 'ask');
                setDlpFailureMode(data.dlpFailureMode === 'fail_open' ? 'fail_open' : 'fail_closed');
                setDlpAllowlistedHosts(Array.isArray(data.dlpAllowlistedHosts) ? data.dlpAllowlistedHosts : []);
                setCustomSensitiveTerms(Array.isArray(data.customSensitiveTerms) ? data.customSensitiveTerms : []);
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
                    monitorIntegrations: orgMonitorIntegrations,
                    webSearchGuardPiiCategories: webSearchGuardPiiCategories,
                    azurePiiEnabled: orgAzurePiiEnabled,
                    azureSeverityThreshold: orgSeverityThreshold,
                    azureEnabledCategories: orgAzureCategories,
                    piiDetectionCategories: orgPiiCategories,
                    piiDetectionConfidenceThreshold: orgPiiConfidenceThreshold,
                    piiDetectionAction: orgPiiAction,
                    // DLP
                    dlpEnabled,
                    dlpScope,
                    dlpMode,
                    dlpFailureMode,
                    dlpAllowlistedHosts,
                    customSensitiveTerms,
                })
            });
            if (res.ok) {
                showToast('success', t('admin.guard_saved'));
                setOrgShieldMessage(null);
            } else {
                const data = await res.json().catch(() => ({}));
                showToast('error', data.error || 'Failed to save.');
                setOrgShieldMessage({ type: 'error', text: data.error || 'Failed to save.' });
            }
        } catch (e) {
            showToast('error', 'Error saving.');
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
            {/* Auto-dismissing toasts for save / error feedback — shared across every sub-section. */}
            <ToastHost />
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
                                        <label className="text-xs font-medium text-muted mb-2 block">{t('admin.shield_org_label')}</label>
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
                                    <div className="text-sm text-muted py-4 text-center">{t('admin.shield_loading')}</div>
                                ) : (
                                    <>
                                        {/* Enable Toggle */}
                                        <div className="flex items-center justify-between p-4 rounded-xl border bg-white/5 border-white/10 mb-6">
                                            <div>
                                                <span className="text-sm font-medium text-[var(--text-primary)] block">{t('admin.shield_enable')}</span>
                                                <span className="text-xs text-muted">{t('admin.shield_enable_desc')}</span>
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
                                                        <span className="text-sm font-medium text-[var(--text-primary)] block">{t('admin.shield_moderation')}</span>
                                                        <span className="text-xs text-muted">{t('admin.shield_moderation_desc')}</span>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={orgShieldModeration} onChange={e => setOrgShieldModeration(e.target.checked)} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                    </label>
                                                </div>

                                                {orgShieldModeration && (
                                                    <div className="space-y-4 animate-fadeIn">
                                                        {/* Severity Threshold */}
                                                        {activeModerationProvider === 'azure' && (
                                                        <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <label className="text-xs font-medium text-muted">{t('admin.shield_severity')}</label>
                                                                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-primary)', color: 'var(--accent-primary)' }}>≥ {orgSeverityThreshold}</span>
                                                            </div>
                                                            <input
                                                                type="range" min="0" max="6" step="1"
                                                                value={orgSeverityThreshold}
                                                                onChange={e => setOrgSeverityThreshold(parseInt(e.target.value))}
                                                                className="w-full accent-[var(--accent-primary)]"
                                                            />
                                                            <div className="flex justify-between text-xs text-muted mt-1">
                                                                <span>{t('admin.shield_severity_min')}</span>
                                                                <span>{t('admin.shield_severity_max')}</span>
                                                            </div>
                                                            <p className="text-xs text-muted mt-1">{t('admin.shield_severity_help')}</p>
                                                        </div>
                                                        )}

                                                        {/* Enabled Categories */}
                                                        <div>
                                                            <label className="text-xs font-medium text-muted mb-3 block">
                                                                {activeModerationProvider === 'azure' ? t('admin.shield_categories_azure') : t('admin.shield_categories_llama')}
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
                                                    </div>
                                                )}

                                                {/* Azure PII Detection — only shown when Azure is configured */}
                                                {hasAzureEndpoint && (
                                                <>
                                                <div className="flex items-center justify-between p-4 rounded-xl border bg-white/5 border-white/10">
                                                    <div>
                                                        <span className="text-sm font-medium text-[var(--text-primary)] block">🔍 {t('admin.shield_pii_title')}</span>
                                                        <span className="text-xs text-muted">{t('admin.shield_pii_desc')}</span>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={orgAzurePiiEnabled} onChange={e => setOrgAzurePiiEnabled(e.target.checked)} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                    </label>
                                                </div>

                                                {orgAzurePiiEnabled && (
                                                    <div className="space-y-4 animate-fadeIn">
                                                        {/* PII Confidence Threshold */}
                                                        <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <label className="text-xs font-medium text-muted">{t('admin.shield_pii_confidence')}</label>
                                                                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--bg-primary)', color: 'var(--accent-primary)' }}>{Math.round(orgPiiConfidenceThreshold * 100)}%</span>
                                                            </div>
                                                            <input
                                                                type="range" min="0.1" max="1.0" step="0.05"
                                                                value={orgPiiConfidenceThreshold}
                                                                onChange={e => setOrgPiiConfidenceThreshold(parseFloat(e.target.value))}
                                                                className="w-full accent-[var(--accent-primary)]"
                                                            />
                                                            <div className="flex justify-between text-xs text-muted mt-1">
                                                                <span>{t('admin.shield_pii_detect_more')}</span>
                                                                <span>{t('admin.shield_pii_detect_less')}</span>
                                                            </div>
                                                        </div>

                                                        {/* PII Action */}
                                                        <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                                                            <label className="text-xs font-medium text-muted block mb-2">{t('azure.pii_action_on_detection')}</label>
                                                            <div className="flex gap-2">
                                                                {[{ id: 'block', label: t('azure.pii_action_block'), desc: t('azure.pii_action_block_desc'), icon: '🚫' }, { id: 'tokenize', label: t('azure.pii_action_redact'), desc: t('azure.pii_action_redact_desc'), icon: '🔒' }].map(opt => (
                                                                    <button
                                                                        key={opt.id}
                                                                        onClick={() => setOrgPiiAction(opt.id)}
                                                                        className="flex-1 px-3 py-2.5 rounded-lg text-left transition-all"
                                                                        style={{
                                                                            background: orgPiiAction === opt.id ? 'rgba(16,185,129,0.1)' : 'var(--bg-primary)',
                                                                            border: `1.5px solid ${orgPiiAction === opt.id ? '#10B981' : 'var(--border-subtle)'}`,
                                                                        }}
                                                                    >
                                                                        <p className="text-xs font-medium" style={{ color: orgPiiAction === opt.id ? '#10B981' : 'var(--text-primary)' }}>{opt.icon} {opt.label}</p>
                                                                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* PII Categories */}
                                                        <div>
                                                            <div className="flex items-center justify-between mb-3">
                                                                <label className="text-xs font-medium text-muted">
                                                                    {t('admin.shield_pii_categories')} ({orgPiiCategories.length}/{PII_CATEGORIES_LIST.length})
                                                                </label>
                                                                <div className="flex gap-2">
                                                                    <button onClick={() => setOrgPiiCategories(PII_CATEGORIES_LIST.map(c => c.id))} className="text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors font-medium" style={{ color: 'var(--accent-primary)' }}>{t('common.all')}</button>
                                                                    <button onClick={() => setOrgPiiCategories([])} className="text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors text-muted">{t('common.none')}</button>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2 p-4 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                                                                {PII_CATEGORIES_LIST.map(cat => (
                                                                    <label key={cat.id} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer p-2 rounded hover:bg-white/5 transition-colors">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={orgPiiCategories.includes(cat.id)}
                                                                            onChange={(e) => {
                                                                                if (e.target.checked) {
                                                                                    setOrgPiiCategories([...orgPiiCategories, cat.id]);
                                                                                } else {
                                                                                    setOrgPiiCategories(orgPiiCategories.filter(id => id !== cat.id));
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
                                                    </div>
                                                )}
                                                </>
                                                )}

                                                {/* EU-Only Models */}
                                                {hasEuModelsConfigured && (
                                                <div className="flex items-center justify-between p-4 rounded-xl border bg-white/5 border-white/10">
                                                    <div>
                                                        <span className="text-sm font-medium text-[var(--text-primary)] block">🇪🇺 {t('admin.shield_eu_models')}</span>
                                                        <span className="text-xs text-muted">{t('admin.shield_eu_desc')}</span>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={euModeEnabled} onChange={e => setEuModeEnabled(e.target.checked)} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                    </label>
                                                </div>
                                                )}

                                                {/* Web Search Guard — only shown when web search is enabled */}
                                                {hasWebSearchEnabled && (
                                                <div className="flex items-center justify-between p-4 rounded-xl border bg-white/5 border-white/10">
                                                    <div>
                                                        <span className="text-sm font-medium text-[var(--text-primary)] block">🔍 {t('admin.shield_web_guard')}</span>
                                                        <span className="text-xs text-muted">{t('admin.shield_web_guard_desc')}</span>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={orgWebSearchGuard} onChange={e => setOrgWebSearchGuard(e.target.checked)} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                    </label>
                                                </div>
                                                )}
                                                {/* Web Search Guard PII Filter — shown when guard is ON */}
                                                {hasWebSearchEnabled && orgWebSearchGuard && (
                                                <div className="ml-6 p-4 rounded-xl border bg-white/3 border-white/8">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-xs font-medium text-muted">🛡️ {t('admin.shield_web_pii_filter') || 'Web Search PII Filter'}</span>
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setWebSearchGuardPiiCategories(PII_CATEGORIES_LIST.map(c => c.id))}
                                                                className="text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[var(--text-secondary)] transition-colors"
                                                            >{t('admin.all') || 'All'}</button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setWebSearchGuardPiiCategories([])}
                                                                className="text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[var(--text-secondary)] transition-colors"
                                                            >{t('admin.none') || 'None'}</button>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-muted mb-3">{t('admin.shield_web_pii_desc') || 'Block search queries that contain selected PII types from being sent to external search engines.'}</p>
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        {PII_CATEGORIES_LIST.map(cat => (
                                                            <label key={cat.id} className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer hover:text-primary transition-colors py-1 px-2 rounded hover:bg-white/5">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={webSearchGuardPiiCategories.includes(cat.id)}
                                                                    onChange={e => {
                                                                        if (e.target.checked) {
                                                                            setWebSearchGuardPiiCategories(prev => [...prev, cat.id]);
                                                                        } else {
                                                                            setWebSearchGuardPiiCategories(prev => prev.filter(id => id !== cat.id));
                                                                        }
                                                                    }}
                                                                    className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0"
                                                                />
                                                                <span>{cat.icon} {cat.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                    {webSearchGuardPiiCategories.length > 0 && (
                                                        <p className="text-xs text-emerald-400/80 mt-2">✓ {webSearchGuardPiiCategories.length}/{PII_CATEGORIES_LIST.length} {t('admin.categories_selected') || 'categories selected'}</p>
                                                    )}
                                                </div>
                                                )}

                                                {/* Disable Web Search on File Upload — only shown when web search is enabled */}
                                                {hasWebSearchEnabled && (
                                                <div className="flex items-center justify-between p-4 rounded-xl border bg-white/5 border-white/10">
                                                    <div>
                                                        <span className="text-sm font-medium text-[var(--text-primary)] block">📎 {t('admin.shield_search_upload')}</span>
                                                        <span className="text-xs text-muted">{t('admin.shield_search_upload_desc')}</span>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={orgDisableSearchOnUpload} onChange={e => setOrgDisableSearchOnUpload(e.target.checked)} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                    </label>
                                                </div>
                                                )}

                                                {/* Monitor Integrations */}
                                                <div className="flex items-center justify-between p-4 rounded-xl border bg-white/5 border-white/10">
                                                    <div>
                                                        <span className="text-sm font-medium text-[var(--text-primary)] block">🌐 {t('admin.shield_integ_monitor')}</span>
                                                        <span className="text-xs text-muted">{t('admin.shield_integ_monitor_desc')}</span>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={orgMonitorIntegrations} onChange={e => setOrgMonitorIntegrations(e.target.checked)} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                                    </label>
                                                </div>
                                                <div className="grid grid-cols-2 gap-6">
                                                    {/* Scope */}
                                                    <div>
                                                        <label className="text-xs font-medium text-muted mb-3 block">{t('admin.shield_scope')}</label>
                                                        <div className="space-y-2">
                                                            {[
                                                                { key: 'userInput', label: t('admin.shield_scope_user') },
                                                                { key: 'agentOutput', label: t('admin.shield_scope_ai') },
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
                                                        <label className="text-xs font-medium text-muted mb-3 block">{t('admin.shield_action')}</label>
                                                        <div className="flex flex-col gap-3">
                                                            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer hover:text-primary transition-colors">
                                                                <input type="radio" name="orgAction" value="delete" checked={orgShieldAction === 'delete'} onChange={e => setOrgShieldAction(e.target.value)} className="w-4 h-4 border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0" />
                                                                {t('admin.shield_action_delete')}
                                                            </label>
                                                            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer hover:text-primary transition-colors">
                                                                <input type="radio" name="orgAction" value="redact" checked={orgShieldAction === 'redact'} onChange={e => setOrgShieldAction(e.target.value)} className="w-4 h-4 border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0" />
                                                                {t('admin.shield_action_redact')}
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* ═══ Data Loss Prevention (pre-flight DLP) ═══ */}
                                        <div className="p-4 rounded-lg border mt-4" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                        {t('admin.dlp_title', 'Data Loss Prevention (pre-flight)')}
                                                    </div>
                                                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                        {t('admin.dlp_desc', 'Scan outbound prompts for PII + custom terms before they reach an external LLM.')}
                                                    </div>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" checked={dlpEnabled} onChange={e => setDlpEnabled(e.target.checked)} className="sr-only peer" />
                                                    <div className="w-11 h-6 bg-gray-600 rounded-full peer-checked:bg-[var(--accent-primary)] transition-colors" />
                                                    <div className="absolute left-[2px] top-[2px] bg-white w-5 h-5 rounded-full transition-transform peer-checked:translate-x-5" />
                                                </label>
                                            </div>

                                            {dlpEnabled && (
                                                <div className="space-y-3">
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                        <div>
                                                            <label className="block text-[11px] font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('admin.dlp_mode_label', 'Default action')}</label>
                                                            <select value={dlpMode} onChange={e => setDlpMode(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border text-xs bg-[var(--bg-primary)] text-[var(--text-primary)]" style={{ borderColor: 'var(--border-subtle)' }}>
                                                                <option value="ask">{t('admin.dlp_mode_ask', 'Ask user (Redact / Block / Allow)')}</option>
                                                                <option value="auto_redact">{t('admin.dlp_mode_auto', 'Auto-redact (no prompt)')}</option>
                                                                <option value="block">{t('admin.dlp_mode_block', 'Block on any finding')}</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('admin.dlp_scope_label', 'Scope')}</label>
                                                            <select value={dlpScope} onChange={e => setDlpScope(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border text-xs bg-[var(--bg-primary)] text-[var(--text-primary)]" style={{ borderColor: 'var(--border-subtle)' }}>
                                                                <option value="external">{t('admin.dlp_scope_external', 'External providers only')}</option>
                                                                <option value="all">{t('admin.dlp_scope_all', 'Every provider (including self-hosted)')}</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('admin.dlp_failmode_label', 'If scan fails')}</label>
                                                            <select value={dlpFailureMode} onChange={e => setDlpFailureMode(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border text-xs bg-[var(--bg-primary)] text-[var(--text-primary)]" style={{ borderColor: 'var(--border-subtle)' }}>
                                                                <option value="fail_closed">{t('admin.dlp_failmode_closed', 'Block (fail-closed)')}</option>
                                                                <option value="fail_open">{t('admin.dlp_failmode_open', 'Allow (fail-open)')}</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Custom sensitive terms */}
                                                    <div>
                                                        <div className="text-[11px] font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                                            {t('admin.dlp_terms_title', 'Custom sensitive terms')} ({customSensitiveTerms.length})
                                                        </div>
                                                        {customSensitiveTerms.length > 0 && (
                                                            <div className="space-y-1.5 mb-2 max-h-48 overflow-auto">
                                                                {customSensitiveTerms.map((term, idx) => (
                                                                    <div key={term.id || idx} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded" style={{ background: 'var(--bg-primary)' }}>
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded uppercase" style={{ background: term.type === 'regex' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(59, 130, 246, 0.12)', color: term.type === 'regex' ? '#8b5cf6' : '#3b82f6' }}>{term.type || 'literal'}</span>
                                                                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{term.label}</span>
                                                                        <code className="text-[11px] flex-1 min-w-0 truncate" style={{ color: 'var(--text-muted)' }}>{term.pattern}</code>
                                                                        {term.caseSensitive && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>case</span>}
                                                                        <button onClick={() => setCustomSensitiveTerms(prev => prev.filter((_, i) => i !== idx))} className="text-[11px] px-1.5 py-0.5 rounded hover:bg-red-500/10 hover:text-red-500" style={{ color: 'var(--text-muted)' }}>×</button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <input
                                                                type="text"
                                                                value={newTermLabel}
                                                                onChange={e => setNewTermLabel(e.target.value)}
                                                                placeholder={t('admin.dlp_term_label_ph', 'Label (e.g. "Project Falcon")')}
                                                                className="flex-1 min-w-[140px] px-2 py-1.5 rounded-lg border text-xs bg-[var(--bg-primary)] text-[var(--text-primary)]"
                                                                style={{ borderColor: 'var(--border-subtle)' }}
                                                            />
                                                            <input
                                                                type="text"
                                                                value={newTermPattern}
                                                                onChange={e => setNewTermPattern(e.target.value)}
                                                                placeholder={t('admin.dlp_term_pattern_ph', 'Pattern or regex')}
                                                                className="flex-[2] min-w-[180px] px-2 py-1.5 rounded-lg border text-xs bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono"
                                                                style={{ borderColor: 'var(--border-subtle)' }}
                                                            />
                                                            <select value={newTermType} onChange={e => setNewTermType(e.target.value)} className="px-2 py-1.5 rounded-lg border text-xs bg-[var(--bg-primary)] text-[var(--text-primary)]" style={{ borderColor: 'var(--border-subtle)' }}>
                                                                <option value="literal">{t('admin.dlp_term_literal', 'Literal')}</option>
                                                                <option value="regex">{t('admin.dlp_term_regex', 'Regex')}</option>
                                                            </select>
                                                            <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                                <input type="checkbox" checked={newTermCaseSensitive} onChange={e => setNewTermCaseSensitive(e.target.checked)} />
                                                                {t('admin.dlp_term_case', 'Case')}
                                                            </label>
                                                            <button
                                                                onClick={() => {
                                                                    const label = newTermLabel.trim();
                                                                    const pattern = newTermPattern.trim();
                                                                    if (!label || !pattern) return;
                                                                    if (newTermType === 'regex') {
                                                                        try { new RegExp(pattern, newTermCaseSensitive ? '' : 'i'); }
                                                                        catch (err) { alert(`Invalid regex: ${err.message}`); return; }
                                                                    }
                                                                    setCustomSensitiveTerms(prev => [...prev, {
                                                                        id: `term-${Date.now()}`,
                                                                        label, pattern,
                                                                        type: newTermType,
                                                                        caseSensitive: newTermCaseSensitive,
                                                                    }]);
                                                                    setNewTermLabel('');
                                                                    setNewTermPattern('');
                                                                }}
                                                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                                                                style={{ background: 'var(--accent-primary)' }}
                                                            >
                                                                {t('admin.dlp_term_add', 'Add')}
                                                            </button>
                                                        </div>
                                                        <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                                                            {t('admin.dlp_term_hint', 'Examples: project codenames ("Project Falcon"), contract-number regex (e.g. C-\\d{6}), internal product names.')}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

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
                                <strong style={{ color: 'var(--text-primary)' }}>{t('admin.shield_how_it_works')}</strong> {t('admin.shield_how_it_works_desc')}
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

    // Shared category metadata — one source of truth per util.
    const llamaCategories = LLAMA_GUARD_CATEGORIES;
    // Azure categories here include extra `desc` copy shown under each row.
    const AZURE_DESCRIPTIONS = {
        Hate: 'Discrimination, slurs, identity attacks',
        Violence: 'Physical harm, weapons, extremism',
        Sexual: 'Sexual content, nudity, exploitation',
        SelfHarm: 'Self-injury, suicide, eating disorders',
    };
    const azureCategories = AZURE_CONTENT_SAFETY_CATEGORIES.map(c => ({ ...c, desc: AZURE_DESCRIPTIONS[c.id] || '' }));

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
