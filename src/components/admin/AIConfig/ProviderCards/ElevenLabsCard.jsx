import React from 'react';
import ProviderApiKeyCard from './ProviderApiKeyCard';
import { PROVIDER_KEY_CONFIGS } from './providerKeyConfig';

const ElevenLabsApiKeyCard = ({ onMessage }) => (
    <ProviderApiKeyCard provider={PROVIDER_KEY_CONFIGS.elevenlabs} onMessage={onMessage} />
);

export default ElevenLabsApiKeyCard;
