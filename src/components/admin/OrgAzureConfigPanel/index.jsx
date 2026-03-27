import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, ChevronRight, Loader2 } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import { useTranslation } from '../../../hooks/useTranslation';
import { StatusBadge } from './components';
import { SUB_SECTIONS, TIERS, PII_CATEGORIES, SAFETY_CATEGORIES } from './constants';
import OpenAISection from './OpenAISection';
import ChatModelsSection from './ChatModelsSection';
import SSOSection from './SSOSection';
import ContentSafetySection from './ContentSafetySection';
import DocProcessingSection from './DocProcessingSection';


export default function OrgAzureConfigPanel({ user }) {
    const { t } = useTranslation();
    const [activeSection, setActiveSection] = useState('openai');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState(null);

    // ── Microsoft SSO ──
    const [ssoClientId, setSsoClientId] = useState('');
    const [ssoClientSecret, setSsoClientSecret] = useState('');
    const [hasSsoClientSecret, setHasSsoClientSecret] = useState(false);
    const [ssoTenantId, setSsoTenantId] = useState('common');
    const [autoApproveSSO, setAutoApproveSSO] = useState(false);

    // ── Azure OpenAI ──
    const [azureEndpoint, setAzureEndpoint] = useState('');
    const [azureApiKey, setAzureApiKey] = useState('');
    const [hasAzureApiKey, setHasAzureApiKey] = useState(false);
    const [azureApiVersion, setAzureApiVersion] = useState('2024-04-01-preview');
    const [azureModels, setAzureModels] = useState('');

    // ── Chat Model Tiers ──
    const [chatModelTiers, setChatModelTiers] = useState({
        fast: { modelId: '', label: 'Fast' },
        thinking: { modelId: '', label: 'Thinking' },
        writer: { modelId: '', label: 'Writer' },
        pro: { modelId: '', label: 'Deep Thinking' }
    });
    const [allModels, setAllModels] = useState([]);

    // ── Content Safety ──
    const [contentSafetyEndpoint, setContentSafetyEndpoint] = useState('');
    const [contentSafetyKey, setContentSafetyKey] = useState('');
    const [hasContentSafetyKey, setHasContentSafetyKey] = useState(false);
    const [contentSafetySeverityThreshold, setContentSafetySeverityThreshold] = useState(2);
    const [contentSafetyCategories, setContentSafetyCategories] = useState(SAFETY_CATEGORIES.map(c => c.id));
    const [moderationProvider, setModerationProvider] = useState('llamaguard');

    // ── PII Detection ──
    const [piiDetectionEnabled, setPiiDetectionEnabled] = useState(false);
    const [piiDetectionCategories, setPiiDetectionCategories] = useState(PII_CATEGORIES.map(c => c.id));
    const [piiDetectionConfidenceThreshold, setPiiDetectionConfidenceThreshold] = useState(0.7);
    const [piiDetectionScope, setPiiDetectionScope] = useState({ userInput: true, agentOutput: false });
    const [piiDetectionAction, setPiiDetectionAction] = useState('block');

    // ── Azure Document Processing ──
    const [useAzureDocProcessing, setUseAzureDocProcessing] = useState(false);
    const [azureDocEndpoint, setAzureDocEndpoint] = useState('');
    const [azureDocKey, setAzureDocKey] = useState('');
    const [hasAzureDocEndpoint, setHasAzureDocEndpoint] = useState(false);
    const [hasAzureDocKey, setHasAzureDocKey] = useState(false);
    const [azureEmbedEndpoint, setAzureEmbedEndpoint] = useState('');
    const [azureEmbedKey, setAzureEmbedKey] = useState('');
    const [hasAzureEmbedEndpoint, setHasAzureEmbedEndpoint] = useState(false);
    const [hasAzureEmbedKey, setHasAzureEmbedKey] = useState(false);
    const [azureEmbedModel, setAzureEmbedModel] = useState('text-embedding-3-small');

    const orgId = user?.organizationId || '';

    const fetchConfig = useCallback(async () => {
        if (!orgId) return;
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/api/org-azure-config/${orgId}`);
            if (res.ok) {
                const d = await res.json();
                setAzureEndpoint(d.azureEndpoint || '');
                setHasAzureApiKey(d.hasAzureApiKey || false);
                setAzureApiVersion(d.azureApiVersion || '2024-04-01-preview');
                setAzureModels(d.azureModels || '');
                if (d.chatModelTiers) setChatModelTiers(d.chatModelTiers);
                setContentSafetyEndpoint(d.contentSafetyEndpoint || '');
                setHasContentSafetyKey(d.hasContentSafetyKey || false);
                setContentSafetySeverityThreshold(d.contentSafetySeverityThreshold ?? 2);
                if (d.contentSafetyCategories) setContentSafetyCategories(d.contentSafetyCategories);
                setModerationProvider(d.moderationProvider || 'llamaguard');
                setPiiDetectionEnabled(d.piiDetectionEnabled || false);
                if (d.piiDetectionCategories) setPiiDetectionCategories(d.piiDetectionCategories);
                setPiiDetectionConfidenceThreshold(d.piiDetectionConfidenceThreshold ?? 0.7);
                if (d.piiDetectionScope) setPiiDetectionScope(d.piiDetectionScope);
                setPiiDetectionAction(d.piiDetectionAction || 'block');
                setSsoClientId(d.ssoClientId || '');
                setHasSsoClientSecret(d.hasSsoClientSecret || false);
                setSsoTenantId(d.ssoTenantId || 'common');
                setAutoApproveSSO(d.autoApproveSSO || false);
                // Doc Processing
                setUseAzureDocProcessing(d.useAzureDocProcessing || false);
                setAzureDocEndpoint(d.azureDocEndpoint || '');
                setHasAzureDocEndpoint(d.hasAzureDocEndpoint || false);
                setHasAzureDocKey(d.hasAzureDocKey || false);
                setAzureEmbedEndpoint(d.azureEmbedEndpoint || '');
                setHasAzureEmbedEndpoint(d.hasAzureEmbedEndpoint || false);
                setHasAzureEmbedKey(d.hasAzureEmbedKey || false);
                setAzureEmbedModel(d.azureEmbedModel || 'text-embedding-3-small');
            }
        } catch (err) {
            setError(err.message);
        }
        try {
            const modelsRes = await authFetch(`${API_BASE}/ai/models`);
            if (modelsRes.ok) {
                const modelsData = await modelsRes.json();
                setAllModels(modelsData.models || modelsData || []);
            }
        } catch (_) { }
        setLoading(false);
    }, [orgId]);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    const handleSave = async (section, body) => {
        if (!orgId) return;
        setSaving(true);
        setSaved(false);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/api/org-azure-config/${orgId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ section, ...body }),
            });
            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
                fetchConfig();
            } else {
                const d = await res.json();
                setError(d.error || 'Failed to save');
            }
        } catch (err) {
            setError(err.message);
        }
        setSaving(false);
    };

    const ssoConfigured = !!(ssoClientId && hasSsoClientSecret);

    // ── Loading ──
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
        );
    }

    // ── No org ──
    if (!orgId) {
        return (
            <div className="rounded-xl px-5 py-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    {t('azure.no_org_message')}
                </p>
            </div>
        );
    }

    const sharedSaveProps = { saving, saved, handleSave };

    const sectionComponents = {
        openai: (
            <OpenAISection
                azureEndpoint={azureEndpoint} setAzureEndpoint={setAzureEndpoint}
                azureApiKey={azureApiKey} setAzureApiKey={setAzureApiKey}
                hasAzureApiKey={hasAzureApiKey}
                azureApiVersion={azureApiVersion} setAzureApiVersion={setAzureApiVersion}
                azureModels={azureModels} setAzureModels={setAzureModels}
                {...sharedSaveProps}
            />
        ),
        chatModels: (
            <ChatModelsSection
                chatModelTiers={chatModelTiers} setChatModelTiers={setChatModelTiers}
                allModels={allModels}
                azureModels={azureModels}
                {...sharedSaveProps}
            />
        ),
        sso: (
            <SSOSection
                ssoClientId={ssoClientId} setSsoClientId={setSsoClientId}
                ssoClientSecret={ssoClientSecret} setSsoClientSecret={setSsoClientSecret}
                hasSsoClientSecret={hasSsoClientSecret}
                ssoTenantId={ssoTenantId} setSsoTenantId={setSsoTenantId}
                autoApproveSSO={autoApproveSSO} setAutoApproveSSO={setAutoApproveSSO}
                {...sharedSaveProps}
            />
        ),
        contentSafety: (
            <ContentSafetySection
                contentSafetyEndpoint={contentSafetyEndpoint} setContentSafetyEndpoint={setContentSafetyEndpoint}
                contentSafetyKey={contentSafetyKey} setContentSafetyKey={setContentSafetyKey}
                hasContentSafetyKey={hasContentSafetyKey}
                contentSafetySeverityThreshold={contentSafetySeverityThreshold} setContentSafetySeverityThreshold={setContentSafetySeverityThreshold}
                contentSafetyCategories={contentSafetyCategories} setContentSafetyCategories={setContentSafetyCategories}
                moderationProvider={moderationProvider} setModerationProvider={setModerationProvider}
                {...sharedSaveProps}
            />
        ),
        docProcessing: (
            <DocProcessingSection
                useAzureDocProcessing={useAzureDocProcessing} setUseAzureDocProcessing={setUseAzureDocProcessing}
                azureDocEndpoint={azureDocEndpoint} setAzureDocEndpoint={setAzureDocEndpoint}
                azureDocKey={azureDocKey} setAzureDocKey={setAzureDocKey}
                hasAzureDocEndpoint={hasAzureDocEndpoint} hasAzureDocKey={hasAzureDocKey}
                azureEmbedEndpoint={azureEmbedEndpoint} setAzureEmbedEndpoint={setAzureEmbedEndpoint}
                azureEmbedKey={azureEmbedKey} setAzureEmbedKey={setAzureEmbedKey}
                hasAzureEmbedEndpoint={hasAzureEmbedEndpoint} hasAzureEmbedKey={hasAzureEmbedKey}
                azureEmbedModel={azureEmbedModel} setAzureEmbedModel={setAzureEmbedModel}
                {...sharedSaveProps}
            />
        ),
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                    {t('azure.panel_header')}
                </p>
                <p className="text-[12px] mb-4" style={{ color: 'var(--text-muted)' }}>
                    {t('azure.panel_subheader')}
                </p>
            </div>

            {/* Error banner */}
            {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-[12px]" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <AlertTriangle size={14} />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto text-[11px] underline">{t('azure.dismiss')}</button>
                </div>
            )}

            {/* Sub-section tabs */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                {SUB_SECTIONS.map((section, i) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    const isLast = i === SUB_SECTIONS.length - 1;
                    return (
                        <button
                            key={section.id}
                            onClick={() => setActiveSection(section.id)}
                            className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                            style={{
                                background: isActive ? 'rgba(0,120,212,0.06)' : 'var(--bg-secondary)',
                                borderBottom: !isLast ? '1px solid var(--border-subtle)' : 'none',
                                borderLeft: isActive ? '3px solid #0078D4' : '3px solid transparent',
                            }}
                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                        >
                            <Icon style={{ width: '16px', height: '16px', color: isActive ? section.color : 'var(--text-muted)', flexShrink: 0 }} />
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{t(section.labelKey)}</p>
                                <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{t(section.descKey)}</p>
                            </div>
                            {/* Status indicators */}
                            {section.id === 'openai' && (azureEndpoint || hasAzureApiKey) && (
                                <StatusBadge configured={!!azureEndpoint && hasAzureApiKey} label={!!azureEndpoint && hasAzureApiKey ? t('azure.configured') : t('azure.partial')} />
                            )}
                            {section.id === 'chatModels' && (() => {
                                const configured = TIERS.filter(t => chatModelTiers[t.key]?.modelId).length;
                                return configured > 0 ? <StatusBadge configured={true} label={`${configured}/${TIERS.length} ${t('azure.tiers')}`} /> : null;
                            })()}
                            {section.id === 'sso' && <StatusBadge configured={ssoConfigured} />}
                            {section.id === 'contentSafety' && hasContentSafetyKey && <StatusBadge configured={true} />}
                            {section.id === 'docProcessing' && (hasAzureDocEndpoint && hasAzureDocKey) && <StatusBadge configured={true} />}
                            <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, transform: isActive ? 'rotate(90deg)' : 'none', transition: 'transform 150ms' }} />
                        </button>
                    );
                })}
            </div>

            {/* Active section content */}
            <div className="rounded-xl px-6 py-5" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                {sectionComponents[activeSection]}
            </div>
        </div>
    );
}
