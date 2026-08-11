import React from 'react';
import ProviderApiKeyCard from './ProviderApiKeyCard';
import { PROVIDER_KEY_CONFIGS } from './providerKeyConfig';

const MistralApiKeyCard = ({ onMessage }) => (
    <ProviderApiKeyCard provider={PROVIDER_KEY_CONFIGS.mistral} onMessage={onMessage} />
);

export default MistralApiKeyCard;
