// SimpleApiKeyIntegration — a single-secret integration card.
//
// Collapses the trivial "one API key" integrations (Fireflies, Gamma, …) that
// were near-identical copies of IntegrationRow + ApiKeyField + DisconnectButton
// wired to a single POST /ai/user-settings body of { [payloadKey]: value }.
// The save/disconnect/error state lives in useUserSettingSave; this component
// is just the declarative shell (name / icon / description / payloadKey props).
//
// Multi-field integrations (YouTrack, SignRequest, AFAS, NMBRS, Nextcloud, …)
// keep their bespoke JSX and use useUserSettingSave directly.

import React, { useState } from 'react';
import { IntegrationRow, ApiKeyField, DisconnectButton } from './IntegrationsSection';
import useUserSettingSave from '../../hooks/useUserSettingSave';
// IntegrationRow / ApiKeyField / DisconnectButton are the shared primitives
// exported from IntegrationsSection. The import is circular (that file also
// imports this one) but safe: the bindings are only read at render time, by
// which point both modules have finished evaluating.

const SimpleApiKeyIntegration = ({
    icon,
    name,
    connected,
    description,
    connectedDescription,
    payloadKey,
    placeholder,
    hint,
    onSaved,
    last,
}) => {
    const [value, setValue] = useState('');
    const { saving, disconnecting, error, save, disconnect } = useUserSettingSave(onSaved);

    const handleSave = () => {
        if (!value.trim()) return;
        save({ [payloadKey]: value }, { onSuccess: () => setValue('') });
    };
    const handleDisconnect = () => disconnect({ [payloadKey]: '' });

    return (
        <IntegrationRow
            last={last}
            connected={connected}
            name={name}
            description={connected ? connectedDescription : description}
            icon={icon}
        >
            <ApiKeyField
                placeholder={connected ? '••••••••••••••••' : placeholder}
                value={value}
                onChange={e => setValue(e.target.value)}
                onSave={handleSave}
                saving={saving}
                hint={hint}
            />
            {error && <p className="text-[11px]" style={{ color: '#dc2626' }}>{error}</p>}
            {connected && <DisconnectButton onDisconnect={handleDisconnect} disconnecting={disconnecting} />}
        </IntegrationRow>
    );
};

export default SimpleApiKeyIntegration;
