import React from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { Toggle, SectionCard } from './components';
import { PII_CATEGORIES } from './constants';

export default function PIISection({ piiDetectionEnabled, setPiiDetectionEnabled, piiDetectionCategories, setPiiDetectionCategories, piiDetectionConfidenceThreshold, setPiiDetectionConfidenceThreshold, piiDetectionScope, setPiiDetectionScope, piiDetectionAction, setPiiDetectionAction, handleSave, saving, saved }) {
    const { t } = useTranslation();

    const PII_ACTIONS = [
        { id: 'block', labelKey: 'azure.pii_action_block', descKey: 'azure.pii_action_block_desc' },
        { id: 'redact', labelKey: 'azure.pii_action_redact', descKey: 'azure.pii_action_redact_desc' },
        { id: 'warn', labelKey: 'azure.pii_action_warn', descKey: 'azure.pii_action_warn_desc' },
    ];

    return (
        <SectionCard
            title={t('azure.pii_title')}
            description={t('azure.pii_section_desc')}
            onSave={() => handleSave('piiDetection', { piiDetectionEnabled, piiDetectionCategories, piiDetectionConfidenceThreshold, piiDetectionScope, piiDetectionAction })}
            saving={saving}
            saved={saved}
        >
            <Toggle
                checked={piiDetectionEnabled}
                onChange={setPiiDetectionEnabled}
                label={t('azure.pii_enable')}
                description={t('azure.pii_enable_desc')}
            />

            {piiDetectionEnabled && (
                <div className="space-y-4 pt-2" style={{ animation: 'fadeIn 200ms ease' }}>
                    {/* Action */}
                    <div className="space-y-2">
                        <label className="block text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{t('azure.pii_action_on_detection')}</label>
                        <div className="flex gap-2">
                            {PII_ACTIONS.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setPiiDetectionAction(opt.id)}
                                    className="flex-1 px-3 py-2.5 rounded-lg text-left transition-all"
                                    style={{
                                        background: piiDetectionAction === opt.id ? 'rgba(0,120,212,0.08)' : 'var(--bg-primary)',
                                        border: `1.5px solid ${piiDetectionAction === opt.id ? '#0078D4' : 'var(--border-subtle)'}`,
                                    }}
                                >
                                    <p className="text-[12px] font-medium" style={{ color: piiDetectionAction === opt.id ? '#0078D4' : 'var(--text-primary)' }}>{t(opt.labelKey)}</p>
                                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t(opt.descKey)}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Scope */}
                    <div className="space-y-2">
                        <label className="block text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{t('azure.pii_detection_scope')}</label>
                        <div className="flex gap-3">
                            <Toggle
                                checked={piiDetectionScope.userInput}
                                onChange={v => setPiiDetectionScope(prev => ({ ...prev, userInput: v }))}
                                label={t('azure.pii_scope_user_input')}
                                description={t('azure.pii_scope_user_input_desc')}
                            />
                            <Toggle
                                checked={piiDetectionScope.agentOutput}
                                onChange={v => setPiiDetectionScope(prev => ({ ...prev, agentOutput: v }))}
                                label={t('azure.pii_scope_agent_output')}
                                description={t('azure.pii_scope_agent_output_desc')}
                            />
                        </div>
                    </div>

                    {/* Confidence Threshold */}
                    <div className="space-y-2">
                        <label className="block text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {t('azure.pii_confidence_threshold')} ({Math.round(piiDetectionConfidenceThreshold * 100)}%)
                        </label>
                        <input
                            type="range"
                            min={0.1}
                            max={1.0}
                            step={0.05}
                            value={piiDetectionConfidenceThreshold}
                            onChange={e => setPiiDetectionConfidenceThreshold(Number(e.target.value))}
                            className="w-full accent-blue-500"
                        />
                        <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            <span>{t('azure.pii_confidence_min')}</span>
                            <span>{t('azure.pii_confidence_max')}</span>
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="block text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                                {t('azure.pii_categories')} ({piiDetectionCategories.length}/{PII_CATEGORIES.length})
                            </label>
                            <button
                                onClick={() => {
                                    if (piiDetectionCategories.length === PII_CATEGORIES.length) {
                                        setPiiDetectionCategories([]);
                                    } else {
                                        setPiiDetectionCategories(PII_CATEGORIES.map(c => c.id));
                                    }
                                }}
                                className="text-[11px] font-medium"
                                style={{ color: '#0078D4' }}
                            >
                                {piiDetectionCategories.length === PII_CATEGORIES.length ? t('azure.pii_deselect_all') : t('azure.pii_select_all')}
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                            {PII_CATEGORIES.map(cat => {
                                const enabled = piiDetectionCategories.includes(cat.id);
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => {
                                            setPiiDetectionCategories(prev =>
                                                enabled ? prev.filter(c => c !== cat.id) : [...prev, cat.id]
                                            );
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-all text-left"
                                        style={{
                                            background: enabled ? 'rgba(0,120,212,0.06)' : 'var(--bg-primary)',
                                            border: `1px solid ${enabled ? '#0078D440' : 'var(--border-subtle)'}`,
                                            color: enabled ? 'var(--text-primary)' : 'var(--text-muted)',
                                        }}
                                    >
                                        <span
                                            className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0"
                                            style={{
                                                background: enabled ? '#0078D4' : 'transparent',
                                                border: `1.5px solid ${enabled ? '#0078D4' : 'var(--border-default)'}`,
                                            }}
                                        >
                                            {enabled && <Check size={10} color="white" />}
                                        </span>
                                        {t(cat.labelKey)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </SectionCard>
    );
}
