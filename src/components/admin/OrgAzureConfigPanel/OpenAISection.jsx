import React from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { Input, SectionCard, StatusBadge } from './components';

export default function OpenAISection({ azureEndpoint, setAzureEndpoint, azureApiKey, setAzureApiKey, hasAzureApiKey, azureApiVersion, setAzureApiVersion, azureModels, setAzureModels, handleSave, saving, saved }) {
    const { t } = useTranslation();
    const modelCount = azureModels ? azureModels.split(',').filter(m => m.trim()).length : 0;
    const isConfigured = !!azureEndpoint && hasAzureApiKey;

    return (
        <SectionCard
            title={t('azure.openai_title')}
            description={t('azure.openai_section_desc')}
            onSave={() => handleSave('openai', { azureEndpoint, azureApiKey: azureApiKey || undefined, azureApiVersion, azureModels })}
            saving={saving}
            saved={saved}
        >
            {/* Status overview */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style={{ background: 'linear-gradient(135deg, rgba(0,120,212,0.2), rgba(0,153,255,0.2))' }}>
                    🔷
                </div>
                <div className="flex-1">
                    <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{t('azure.openai_status')}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {isConfigured ? `✅ ${t('azure.openai_fully_configured')}` : t('azure.openai_title')}
                    </p>
                </div>
                <div className="flex gap-1.5">
                    {azureEndpoint && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">{t('azure.endpoint_badge')}</span>}
                    {hasAzureApiKey && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">{t('azure.key_badge')}</span>}
                    {modelCount > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">{modelCount} model{modelCount !== 1 ? 's' : ''}</span>}
                </div>
            </div>

            <Input
                label={t('azure.endpoint_url')}
                value={azureEndpoint}
                onChange={setAzureEndpoint}
                placeholder="https://your-resource.openai.azure.com"
                helpText={t('azure.endpoint_help')}
            />
            <Input
                label={t('azure.api_key')}
                type="password"
                value={azureApiKey}
                onChange={setAzureApiKey}
                placeholder={hasAzureApiKey ? '••••••••••••' : 'Enter Azure OpenAI API key'}
                helpText={hasAzureApiKey ? t('azure.api_key_help_set') : t('azure.api_key_help_empty')}
            />
            <Input
                label={t('azure.api_version')}
                value={azureApiVersion}
                onChange={setAzureApiVersion}
                placeholder="2024-04-01-preview"
                helpText={t('azure.api_version_help')}
            />
            <Input
                label={t('azure.deployed_models')}
                value={azureModels}
                onChange={setAzureModels}
                placeholder="gpt-4.1, gpt-5-mini, gpt-5.4"
                helpText={t('azure.deployed_models_help')}
            />

            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {t('azure.get_from_portal')} <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#0078D4' }}>portal.azure.com</a>
            </p>
        </SectionCard>
    );
}
