import React from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import { Input, SectionCard, StatusBadge, Toggle } from './components';

export default function ContentSafetySection({ contentSafetyEndpoint, setContentSafetyEndpoint, contentSafetyKey, setContentSafetyKey, hasContentSafetyKey, contentSafetySeverityThreshold, setContentSafetySeverityThreshold, contentSafetyCategories, setContentSafetyCategories, moderationProvider, setModerationProvider, handleSave, saving, saved }) {
    const { t } = useTranslation();

    return (
        <SectionCard
            title={t('azure.content_safety_title')}
            description={t('azure.content_safety_section_desc')}
            onSave={() => handleSave('contentSafety', { contentSafetyEndpoint, contentSafetyKey: contentSafetyKey || undefined, contentSafetySeverityThreshold, contentSafetyCategories, moderationProvider })}
            saving={saving}
            saved={saved}
        >
            <Toggle
                checked={moderationProvider === 'azure'}
                onChange={v => setModerationProvider(v ? 'azure' : 'llamaguard')}
                label={t('azure.moderation_provider') || 'Enable Azure Content Safety'}
                description={t('azure.moderation_provider_desc') || 'Use Azure for real-time input and output moderation instead of self-hosted Llama Guard. Requires endpoint and key below.'}
            />
            
            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '16px 0' }} />

            <Input
                label={t('azure.content_safety_endpoint')}
                value={contentSafetyEndpoint}
                onChange={setContentSafetyEndpoint}
                placeholder="https://your-content-safety.cognitiveservices.azure.com"
                helpText={t('azure.content_safety_endpoint_help')}
            />
            <Input
                label={t('azure.content_safety_key')}
                type="password"
                value={contentSafetyKey}
                onChange={setContentSafetyKey}
                placeholder={hasContentSafetyKey ? '••••••••••••' : 'Enter Content Safety API key'}
                helpText={hasContentSafetyKey ? t('azure.content_safety_key_help_set') : t('azure.content_safety_key_help_empty')}
            />
            {hasContentSafetyKey && (
                <StatusBadge configured={true} label={t('azure.api_key_configured')} />
            )}

        </SectionCard>
    );
}
