import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { API_BASE, authFetch } from '../../utils/helpers';
import { guardrailCatalogIdFor } from '../../utils/guardrailCategories';
import AppEmoji from '../AppEmoji';
import { ToastHost, showToast } from './guardrails/Toast';
import { piiCategoriesLocalized } from '../../config/piiCategories';
import { useLicenseContext } from '../LicenseContext';

// Guardrails Configuration Panel (Regex Rules)
const GuardrailsPanel = ({ orgShieldOnly = false }) => {
    const { t } = useTranslation();
    // Licence gates: 'pii_tokenize' unlocks the Tokenize & round-trip PII
    // action; 'web_search_guard' unlocks the Web Search Guard block. Both
    // are Enterprise-only — community installs see read-only upgrade
    // hints + the backend clamps the values regardless.
    const { hasFeature: hasLicenseFeature, upgradeUrl } = useLicenseContext();
    const canTokenizePii = hasLicenseFeature('pii_tokenize');
    const canUseWebSearchGuard = hasLicenseFeature('web_search_guard');
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
    // Note: scope is hardcoded to scan both user input and AI output, action
    // is hardcoded to 'delete'. The per-rule UI used to expose these — it was
    // removed; admins manage detection actions via the PII "Action on
    // Detection" picker (block / tokenize) instead.
    const [dcSaving, setDcSaving] = useState(false);
    const [dcMessage, setDcMessage] = useState(null);

    // Org Privacy Shield State
    const [orgList, setOrgList] = useState([]);
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [orgShieldEnabled, setOrgShieldEnabled] = useState(false);
    const [orgShieldCollections, setOrgShieldCollections] = useState([]);
    // Org-shield scope/action UI was removed (always scan input+output, action='delete').
    const [orgShieldSaving, setOrgShieldSaving] = useState(false);
    const [orgShieldMessage, setOrgShieldMessage] = useState(null);
    const [orgShieldLoading, setOrgShieldLoading] = useState(false);
    const [euModeEnabled, setEuModeEnabled] = useState(false);
    const [orgWebSearchGuard, setOrgWebSearchGuard] = useState(false);
    const [orgDisableSearchOnUpload, setOrgDisableSearchOnUpload] = useState(false);
    const [orgMonitorIntegrations, setOrgMonitorIntegrations] = useState(false);
    const [webSearchGuardPiiCategories, setWebSearchGuardPiiCategories] = useState([]);
    const [hasEuModelsConfigured, setHasEuModelsConfigured] = useState(false);
    const [hasWebSearchEnabled, setHasWebSearchEnabled] = useState(false);
    // Org-level PII settings
    const [orgPiiCategories, setOrgPiiCategories] = useState([]);
    const [orgPiiConfidenceThreshold, setOrgPiiConfidenceThreshold] = useState(0.7);
    const [orgPiiAction, setOrgPiiAction] = useState('block');
    const [orgShowRawPayload, setOrgShowRawPayload] = useState(false);

    // DLP (Data Loss Prevention) state
    // DLP (pre-flight outbound scanning) was removed. The PII detector
    // already scans messages before they reach external providers; the
    // separate DLP gate added confusion and a parallel set of knobs without
    // measurable additional value. Server-side defaults apply.

    // PII Detection State
    const [piiEnabled, setPiiEnabled] = useState(false);
    const [piiCategories, setPiiCategories] = useState([]);
    const [piiThreshold, setPiiThreshold] = useState(0.7);
    const [piiScanInput, setPiiScanInput] = useState(true);
    const [piiScanOutput, setPiiScanOutput] = useState(false);
    const [piiAction, setPiiAction] = useState('block'); // 'block' | 'tokenize'
    const [piiSaving, setPiiSaving] = useState(false);
    const [piiMessage, setPiiMessage] = useState(null);

    // Single canonical list — see agent-hub/src/config/piiCategories.ts.
    // Detector coverage varies (in-process Transformers.js covers 8;
    // GLiNER guard-service covers 16) but the picker always shows the
    // full 20: the server filters unsupported categories silently, so
    // checking one the active detector doesn't emit is a no-op.
    const PII_CATEGORIES_LIST = useMemo(() => piiCategoriesLocalized(t), [t]);

    // Navigation State — Org Privacy Shield is the entry point for both
    // the embedded (orgShieldOnly) and full admin views now that the
    // dedicated AI Moderation tab is gone.
    const [activeTab, setActiveTab] = useState('orgshield');
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
                }
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
                setEuModeEnabled(data.euModeEnabled || false);
                setOrgWebSearchGuard(data.webSearchGuardEnabled || false);
                setOrgDisableSearchOnUpload(data.disableSearchOnUpload || false);
                setOrgMonitorIntegrations(data.monitorIntegrations || false);
                setWebSearchGuardPiiCategories(data.webSearchGuardPiiCategories || []);
                const validIds = new Set(PII_CATEGORIES_LIST.map(c => c.id));
                const loaded = (data.piiDetectionCategories || []).filter(id => validIds.has(id));
                setOrgPiiCategories(loaded);
                setOrgPiiConfidenceThreshold(data.piiDetectionConfidenceThreshold ?? 0.7);
                setOrgPiiAction(data.piiDetectionAction || 'block');
                setOrgShowRawPayload(!!data.showRawPayload);
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
                    // Scope and action are no longer admin-tunable — the
                    // detector always scans both directions and takes the
                    // action selected under "Action on Detection" (PII).
                    scope: { userInput: true, agentOutput: true },
                    action: 'delete',
                    euModeEnabled: euModeEnabled,
                    webSearchGuardEnabled: orgWebSearchGuard,
                    disableSearchOnUpload: orgDisableSearchOnUpload,
                    monitorIntegrations: orgMonitorIntegrations,
                    webSearchGuardPiiCategories: webSearchGuardPiiCategories,
                    piiDetectionCategories: orgPiiCategories,
                    piiDetectionConfidenceThreshold: orgPiiConfidenceThreshold,
                    piiDetectionAction: orgPiiAction,
                    showRawPayload: orgShowRawPayload,
                    // DLP (pre-flight) was removed from the UI; force-disabled.
                    dlpEnabled: false,
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
                        // Scope/action UI was removed — defaults: scan both,
                        // action 'delete'. Detection action is controlled in
                        // the PII section's "Action on Detection".
                        scope: { userInput: true, agentOutput: true },
                        action: 'delete',
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
                                                {/* PII detection — the "Enable Privacy Shield" master switch
                                                    above is the only PII enable. Configuration
                                                    (confidence, action, categories) renders unconditionally
                                                    inside the enabled-shield section. Detection routes
                                                    automatically between the in-process Transformers.js
                                                    detector and the optional GLiNER guard service. */}
                                                <div className="flex items-start gap-3 p-4 rounded-xl border bg-white/5 border-white/10">
                                                    <span className="text-base shrink-0">🛡️</span>
                                                    <div>
                                                        <span className="text-sm font-medium text-[var(--text-primary)] block">{t('admin.shield_pii_master_title', 'PII detection')}</span>
                                                        <span className="text-xs text-muted block mt-0.5 leading-relaxed">
                                                            {t('admin.shield_pii_master_desc', 'Scan messages for personal data — names, emails, phone numbers, addresses, dates of birth, bank accounts, IBANs, BSN / national IDs, tax IDs, medical conditions, medications, and more — and replace each with a placeholder before it reaches the AI. Runs locally on your own server via the PII Guard service (install required, see card above). No chat content leaves your infrastructure.')}
                                                        </span>
                                                    </div>
                                                </div>

                                                {(
                                                    <div className="space-y-4 animate-fadeIn">
                                                        {/* PII Confidence Threshold + Action + Categories.
                                                            All three fields apply to the single PII Guard
                                                            detector. */}
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
                                                            {/* Guidance — too-high threshold is the #1 reason PII silently stops
                                                                firing. The PII Guard returns 0.60–0.85 confidence on short
                                                                prompts, so anything above ~0.85 will miss most fuzzy spans
                                                                (names, organisations) while the regex tier remains 0.99. */}
                                                            {orgPiiConfidenceThreshold >= 0.85 && (
                                                                <div className="mt-3 flex items-start gap-2 text-[11px] px-3 py-2 rounded-lg" style={{ background: 'rgba(234, 179, 8, 0.10)', color: '#92400e', border: '1px solid rgba(234, 179, 8, 0.30)' }}>
                                                                    <span>⚠️</span>
                                                                    <span className="leading-relaxed">
                                                                        {t('admin.shield_pii_confidence_too_high', 'At this threshold most NER detections will be filtered out. The PII Guard typically returns 0.60–0.85 confidence on short messages, so names, organisations and addresses may silently slip through. Recommended: 0.70.')}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {orgPiiConfidenceThreshold < 0.5 && (
                                                                <div className="mt-3 flex items-start gap-2 text-[11px] px-3 py-2 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.10)', color: '#1e40af', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                                                                    <span>ℹ️</span>
                                                                    <span className="leading-relaxed">
                                                                        {t('admin.shield_pii_confidence_too_low', 'Low threshold will flag more content but increases false positives (e.g. flagging ordinary names as PII). If that is intentional, ignore this hint.')}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* PII Action — Tokenize is gated on `pii_tokenize` (Enterprise+);
                                                           option hidden on community + backend clamps stored value to
                                                           'block' (see server/routes/orgPrivacyShield.js). */}
                                                        <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                                                            <label className="text-xs font-medium text-muted block mb-2">{t('admin.pii_action_on_detection', 'Action when PII is detected')}</label>
                                                            <div className="flex gap-2 flex-wrap">
                                                                {[
                                                                    canTokenizePii && {
                                                                        id: 'tokenize',
                                                                        label: t('dlp.action_tokenize_label', 'Tokenize & round-trip'),
                                                                        desc: t('dlp.action_tokenize_help', 'Replace sensitive values with placeholders like [email_1] before the AI sees them. The real values are never sent to the model; BeeFlow swaps them back in the response. User sees a small \uD83D\uDD12 badge under their message.'),
                                                                        icon: '🔄',
                                                                    },
                                                                    {
                                                                        id: 'block',
                                                                        label: t('dlp.action_block_label', 'Block the message'),
                                                                        desc: t('dlp.action_block_help', 'Reject the message before it leaves the organisation. The user is asked to rephrase without sensitive data.'),
                                                                        icon: '🚫',
                                                                    },
                                                                ].filter(Boolean).map(opt => (
                                                                    <button
                                                                        key={opt.id}
                                                                        onClick={() => setOrgPiiAction(opt.id)}
                                                                        className="flex-1 min-w-[180px] px-3 py-2.5 rounded-lg text-left transition-all"
                                                                        style={{
                                                                            background: orgPiiAction === opt.id ? 'rgba(16,185,129,0.1)' : 'var(--bg-primary)',
                                                                            border: `1.5px solid ${orgPiiAction === opt.id ? '#10B981' : 'var(--border-subtle)'}`,
                                                                        }}
                                                                    >
                                                                        <p className="text-xs font-medium" style={{ color: orgPiiAction === opt.id ? '#10B981' : 'var(--text-primary)' }}>{opt.icon} {opt.label}</p>
                                                                        <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                                                {t('dlp.action_footnote', 'Admins who want the user to choose per-message can enable the separate DLP gate (Ask mode) below.')}
                                                            </p>
                                                            {!canTokenizePii && (
                                                                <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                                                    🔒 {t('dlp.action_tokenize_locked', 'Tokenize & round-trip is an Enterprise feature.')}{' '}
                                                                    <a href={upgradeUrl || 'https://beeflow.ai/pricing'} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>
                                                                        {t('license.upgrade_at_beeflow', 'Upgrade at beeflow.ai')}
                                                                    </a>
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Transparency toggle — show original / tokenised / raw / mapping in chat */}
                                                        {orgPiiAction === 'tokenize' && (
                                                            <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                                                                <label className="flex items-start gap-3 cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={orgShowRawPayload}
                                                                        onChange={(e) => setOrgShowRawPayload(e.target.checked)}
                                                                        className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-700 text-[var(--accent-primary)] focus:ring-0"
                                                                    />
                                                                    <span className="flex-1">
                                                                        <span className="text-xs font-medium block" style={{ color: 'var(--text-primary)' }}>
                                                                            🔍 Show raw payload &amp; token mapping
                                                                        </span>
                                                                        <span className="text-[10px] block mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                                                            Adds a transparency section to the &ldquo;How I got this answer&rdquo; panel showing the user&apos;s original message, the tokenised text sent to the AI, the AI&apos;s raw (still-tokenised) reply, and an explicit <code className="px-1 rounded" style={{ background: 'var(--bg-primary)' }}>[name_1] → Gerard</code> mapping. Real values are revealed only on click. Visible to anyone who can open the conversation.
                                                                        </span>
                                                                    </span>
                                                                </label>
                                                            </div>
                                                        )}

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
                                                                        <AppEmoji id={guardrailCatalogIdFor(cat.id)} default={cat.icon} />
                                                                        <span>{cat.label}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
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

                                                {/* Web Search Guard — Enterprise-only feature (`web_search_guard`).
                                                   On community we show a locked card with an upgrade CTA instead
                                                   of the live toggle. The backend also force-disables this on
                                                   community (defence-in-depth — see orgPrivacyShield.js). */}
                                                {hasWebSearchEnabled && !canUseWebSearchGuard && (
                                                <div className="p-4 rounded-xl border" style={{ background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.25)' }}>
                                                    <div className="flex items-start gap-3">
                                                        <span className="text-base">🔒</span>
                                                        <div className="flex-1">
                                                            <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>🔍 {t('admin.shield_web_guard')}</span>
                                                            <span className="text-xs text-muted block mt-0.5">{t('admin.shield_web_guard_desc')}</span>
                                                            <p className="text-[11px] mt-2" style={{ color: 'var(--text-secondary)' }}>
                                                                {t('admin.shield_web_guard_locked', 'Web Search Guard is an Enterprise feature.')}{' '}
                                                                <a href={upgradeUrl || 'https://beeflow.ai/pricing'} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>
                                                                    {t('license.upgrade_at_beeflow', 'Upgrade at beeflow.ai')}
                                                                </a>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                )}
                                                {/* Web Search Guard — only shown when web search is enabled AND licence allows */}
                                                {hasWebSearchEnabled && canUseWebSearchGuard && (
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
                                                {/* Web Search Guard PII Filter — shown when guard is ON (licence-gated) */}
                                                {hasWebSearchEnabled && canUseWebSearchGuard && orgWebSearchGuard && (
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
                                                                <span><AppEmoji id={guardrailCatalogIdFor(cat.id)} default={cat.icon} /> {cat.label}</span>
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
                                <strong style={{ color: 'var(--text-primary)' }}>{t('admin.shield_how_it_works')}</strong> {t('admin.shield_how_it_works_desc')}
                            </p>
                        </div>
                    </div>
                )}


            </div>
        </div>
    );
};


export default GuardrailsPanel;
