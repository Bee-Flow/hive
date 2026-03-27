import React from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { Input, SectionCard, StatusBadge, Toggle } from './components';

export default function DocProcessingSection({
    useAzureDocProcessing, setUseAzureDocProcessing,
    azureDocEndpoint, setAzureDocEndpoint,
    azureDocKey, setAzureDocKey,
    hasAzureDocEndpoint, hasAzureDocKey,
    azureEmbedEndpoint, setAzureEmbedEndpoint,
    azureEmbedKey, setAzureEmbedKey,
    hasAzureEmbedEndpoint, hasAzureEmbedKey,
    azureEmbedModel, setAzureEmbedModel,
    handleSave, saving, saved,
}) {
    const { t } = useTranslation();

    return (
        <SectionCard
            title={t('azure.doc_processing_title')}
            description={t('azure.doc_processing_section_desc')}
            onSave={() => handleSave('docProcessing', {
                useAzureDocProcessing,
                azureDocIntelligenceEndpoint: azureDocEndpoint || undefined,
                azureDocIntelligenceKey: azureDocKey || undefined,
                azureOpenaiEmbeddingEndpoint: azureEmbedEndpoint || undefined,
                azureOpenaiEmbeddingKey: azureEmbedKey || undefined,
                azureOpenaiEmbeddingModel: azureEmbedModel,
            })}
            saving={saving}
            saved={saved}
        >
            <Toggle
                checked={useAzureDocProcessing}
                onChange={setUseAzureDocProcessing}
                label={t('azure.doc_processing_toggle')}
                description={t('azure.doc_processing_toggle_desc')}
            />

            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '16px 0' }} />

            {/* Document Intelligence */}
            <div className="space-y-1">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        {t('azure.doc_intelligence_label')}
                    </span>
                    {hasAzureDocEndpoint && hasAzureDocKey && (
                        <StatusBadge configured={true} label={t('azure.connected')} />
                    )}
                </div>
            </div>
            <Input
                label={t('azure.doc_intelligence_endpoint')}
                value={azureDocEndpoint}
                onChange={setAzureDocEndpoint}
                placeholder={hasAzureDocEndpoint ? '••••••••••••' : 'https://your-resource.cognitiveservices.azure.com'}
                helpText={t('azure.doc_intelligence_endpoint_help')}
            />
            <Input
                label={t('azure.doc_intelligence_key')}
                type="password"
                value={azureDocKey}
                onChange={setAzureDocKey}
                placeholder={hasAzureDocKey ? '••••••••••••' : 'Enter API key'}
                helpText={hasAzureDocKey ? t('azure.key_configured') : t('azure.doc_intelligence_key_help')}
            />

            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '16px 0' }} />

            {/* Azure OpenAI Embeddings */}
            <div className="space-y-1">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        {t('azure.embed_label')}
                    </span>
                    {hasAzureEmbedEndpoint && hasAzureEmbedKey && (
                        <StatusBadge configured={true} label={t('azure.connected')} />
                    )}
                </div>
            </div>
            <Input
                label={t('azure.embed_endpoint')}
                value={azureEmbedEndpoint}
                onChange={setAzureEmbedEndpoint}
                placeholder={hasAzureEmbedEndpoint ? '••••••••••••' : 'https://your-resource.openai.azure.com'}
                helpText={t('azure.embed_endpoint_help')}
            />
            <Input
                label={t('azure.embed_key')}
                type="password"
                value={azureEmbedKey}
                onChange={setAzureEmbedKey}
                placeholder={hasAzureEmbedKey ? '••••••••••••' : 'Enter API key'}
                helpText={hasAzureEmbedKey ? t('azure.key_configured') : t('azure.embed_key_help')}
            />

            {/* Embedding Model Selector */}
            <div className="space-y-1.5">
                <label className="block text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {t('azure.embed_model')}
                </label>
                <select
                    value={azureEmbedModel}
                    onChange={e => setAzureEmbedModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border outline-none text-[13px] transition-colors focus:ring-2 focus:ring-blue-500/20"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                >
                    <option value="text-embedding-3-small">text-embedding-3-small (1536 dims)</option>
                    <option value="text-embedding-3-large">text-embedding-3-large (3072 dims)</option>
                    <option value="text-embedding-ada-002">text-embedding-ada-002 (1536 dims)</option>
                </select>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {t('azure.embed_model_help')}
                </p>
            </div>
        </SectionCard>
    );
}
