import React from 'react';
import SuggestedAutomations from './SuggestedAutomations';

export default function FindRepeatingWorkTab({ onBuildSuggestion, onAskSuggestion }) {
    if (!onBuildSuggestion && !onAskSuggestion) return null;
    return <SuggestedAutomations onBuildSuggestion={onBuildSuggestion} onAskSuggestion={onAskSuggestion} />;
}
