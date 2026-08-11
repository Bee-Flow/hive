import React from 'react';
import ProviderApiKeyCard from './ProviderApiKeyCard';
import { PROVIDER_KEY_CONFIGS } from './providerKeyConfig';

const GoogleApiKeyCard = ({ onMessage }) => (
    <ProviderApiKeyCard provider={PROVIDER_KEY_CONFIGS.google} onMessage={onMessage} />
);

export default GoogleApiKeyCard;
