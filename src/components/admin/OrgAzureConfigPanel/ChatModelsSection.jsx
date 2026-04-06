import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { SectionCard, SearchableModelSelect } from './components';
import { TIERS, TIER_DEFAULTS, isReasoningCapable, isClaudeReasoning } from './constants';

export default function ChatModelsSection({ chatModelTiers, setChatModelTiers, allModels, azureModels, handleSave, saving, saved }) {
    const { t } = useTranslation();
    const [expandedTier, setExpandedTier] = useState(null);

    const modelList = allModels.length > 0
        ? allModels
        : (azureModels ? azureModels.split(',').map(m => m.trim()).filter(Boolean).map(m => ({ id: m, name: m })) : []);

    const updateTier = (tierKey, field, value) => {
        setChatModelTiers(prev => ({
            ...prev,
            [tierKey]: { ...prev[tierKey], [field]: value }
        }));
    };

    const renderTierCard = (tier) => {
        const tierConfig = chatModelTiers[tier.key] || {};
        const defaults = TIER_DEFAULTS[tier.key];
        const isExpanded = expandedTier === tier.key;
        const selectedModel = modelList.find(m => (m.id || m) === tierConfig.modelId);
        const selectedLabel = selectedModel
            ? (selectedModel.name || selectedModel.id || selectedModel)
            : (tierConfig.modelId || t('azure.not_configured_option'));

        return (
            <div key={tier.key} className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}>
                <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-xl">{tier.icon}</span>
                        <div className="flex-1">
                            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t(tier.labelKey)}</span>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t(tier.descKey)}</p>
                        </div>
                        <button
                            onClick={() => setExpandedTier(isExpanded ? null : tier.key)}
                            className="text-xs px-2 py-1 rounded-lg transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            {isExpanded ? t('azure.settings_collapse') : t('azure.settings_expand')}
                        </button>
                    </div>
                    <SearchableModelSelect
                        value={tierConfig.modelId || ''}
                        label={selectedLabel}
                        models={modelList}
                        onChange={val => updateTier(tier.key, 'modelId', val)}
                    />
                </div>
                {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t flex flex-wrap gap-4" style={{ borderColor: 'var(--border-default)' }}>
                        {/* Max Tokens */}
                        <div className="flex-1" style={{ minWidth: '140px' }}>
                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('azure.max_tokens')}</label>
                            <input
                                type="number"
                                value={tierConfig.maxTokens !== undefined ? tierConfig.maxTokens : defaults.maxTokens}
                                onChange={e => updateTier(tier.key, 'maxTokens', parseInt(e.target.value) || defaults.maxTokens)}
                                min={256} max={131072} step={256}
                                className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            />
                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                Default: {defaults.maxTokens.toLocaleString()}
                            </p>
                        </div>
                        {/* Temperature */}
                        <div className="flex-1" style={{ minWidth: '140px' }}>
                            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('azure.temperature')}</label>
                            <input
                                type="number"
                                value={tierConfig.temperature !== undefined ? tierConfig.temperature : defaults.temperature}
                                onChange={e => updateTier(tier.key, 'temperature', parseFloat(e.target.value) || defaults.temperature)}
                                min={0} max={2} step={0.1}
                                className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            />
                            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                {t('azure.temperature_help').replace('{value}', defaults.temperature)}
                            </p>
                        </div>
                        {/* Reasoning options */}
                        {isReasoningCapable(tierConfig.modelId) && (
                            <>
                                <div className="flex-1" style={{ minWidth: '140px' }}>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>🧠 {isClaudeReasoning(tierConfig.modelId) ? t('azure.thinking_budget') : t('azure.reasoning_effort')}</label>
                                    <select
                                        value={tierConfig.reasoningEffort || (isClaudeReasoning(tierConfig.modelId) ? 'medium' : 'none')}
                                        onChange={e => updateTier(tier.key, 'reasoningEffort', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="none">{t('azure.reasoning_none')}</option>
                                        <option value="low">{t('azure.reasoning_low')}</option>
                                        <option value="medium">{t('azure.reasoning_medium')}</option>
                                        <option value="high">{t('azure.reasoning_high')}</option>
                                        <option value="xhigh">{t('azure.reasoning_xhigh')}</option>
                                    </select>
                                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                        {isClaudeReasoning(tierConfig.modelId)
                                            ? 'Adaptive thinking — Claude decides how deep to reason. Default: Medium.'
                                            : t('azure.reasoning_effort_help')}
                                    </p>
                                </div>
                                {!isClaudeReasoning(tierConfig.modelId) && (
                                    <div className="flex-1" style={{ minWidth: '140px' }}>
                                        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-primary)' }}>📝 {t('azure.reasoning_summary')}</label>
                                        <div
                                            className="flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer"
                                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                                            onClick={() => updateTier(tier.key, 'reasoningSummary', !tierConfig.reasoningSummary)}
                                        >
                                            <div className={`w-9 h-5 rounded-full relative transition-colors ${tierConfig.reasoningSummary ? 'bg-green-500' : 'bg-gray-600'}`}>
                                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${tierConfig.reasoningSummary ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                            </div>
                                            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                                                {tierConfig.reasoningSummary ? t('azure.enabled') : t('azure.disabled')}
                                            </span>
                                        </div>
                                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{t('azure.reasoning_summary_help')}</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <SectionCard
            title={t('azure.chat_tiers_title')}
            description={t('azure.chat_tiers_section_desc')}
            onSave={() => handleSave('chatModels', { chatModelTiers })}
            saving={saving}
            saved={saved}
        >
            {modelList.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px]" style={{ background: 'rgba(245,158,11,0.08)', color: '#b45309', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <AlertTriangle size={14} />
                    {t('azure.no_models_warning')}
                </div>
            ) : (
                <div className="space-y-4">
                    {TIERS.map(tier => renderTierCard(tier))}
                </div>
            )}
        </SectionCard>
    );
}
