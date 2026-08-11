// Shared base card for providers that need a single API key — replaces the
// five near-identical card components (ClaudeCard, OpenAICard, GoogleCard,
// MistralCard, ElevenLabsCard) that each open-coded the same fetch-status /
// save-on-Enter / show-hide / two-step-delete flow against /ai/config.
// Per-provider texts and endpoints live in providerKeyConfig.js; extra card
// content can be passed as children (rendered below the footer link).

import React, { useState } from 'react';
import DeleteConfirmButtons from './shared/DeleteConfirmButtons';
import SecretInput from './shared/SecretInput';
import useProviderConfig from '../../../../hooks/useProviderConfig';

const ProviderApiKeyCard = ({ provider, onMessage, children }) => {
    const { name, statusField, bodyField, deleteSlug, icon, iconBackground, description, placeholder, docsUrl, docsLabel } = provider;
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const { config, saving, save, deleteKey, patchConfig } = useProviderConfig({ onMessage });
    const hasKey = !!config?.[statusField];

    const handleSave = async () => {
        if (!apiKey.trim()) return;
        const ok = await save({ [bodyField]: apiKey }, {
            success: `${name} API key saved!`,
            error: 'Failed to save API key'
        });
        if (ok) {
            patchConfig({ [statusField]: true });
            setApiKey('');
            setShowKey(false);
        }
    };

    const handleDelete = async () => {
        const ok = await deleteKey(deleteSlug, {
            success: `${name} API key removed`,
            error: 'Failed to delete API key'
        });
        if (ok) {
            patchConfig({ [statusField]: false });
            setApiKey('');
        }
    };

    return (
        <div className="mb-6 p-5 rounded-xl border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: iconBackground }}>
                    {icon}
                </div>
                <div className="flex-1">
                    <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>{name} API Key</h4>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {hasKey ? '✅ API key configured' : description}
                    </p>
                </div>
                {hasKey && (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">Configured</span>
                )}
            </div>
            <div className="flex gap-2">
                <SecretInput
                    value={apiKey}
                    onChange={setApiKey}
                    placeholder={hasKey ? '••••••••••••••••' : placeholder}
                    onEnter={handleSave}
                    show={showKey}
                    onToggleShow={setShowKey}
                />
                <button
                    onClick={handleSave}
                    disabled={saving || !apiKey.trim()}
                    className="px-5 py-2.5 rounded-lg font-medium text-white text-sm transition-all disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)' }}
                >
                    {saving ? '...' : 'Save'}
                </button>
                {hasKey && <DeleteConfirmButtons onConfirm={handleDelete} title="Delete API key" />}
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Get your API key from <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--accent-primary)]">{docsLabel}</a>
            </p>
            {children}
        </div>
    );
};

export default ProviderApiKeyCard;
