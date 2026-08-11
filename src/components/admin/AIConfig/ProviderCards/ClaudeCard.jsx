import React from 'react';
import ProviderApiKeyCard from './ProviderApiKeyCard';
import { PROVIDER_KEY_CONFIGS } from './providerKeyConfig';

const ClaudeApiKeyCard = ({ onMessage }) => (
    <ProviderApiKeyCard provider={PROVIDER_KEY_CONFIGS.claude} onMessage={onMessage} />
);

export default ClaudeApiKeyCard;
