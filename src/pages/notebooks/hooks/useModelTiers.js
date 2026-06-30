/**
 * useModelTiers — loads the chat model-tier config and owns the selected tier.
 *
 * Shared by NotebooksPage + LegalStudioPage (both copied the same fetch + the
 * `selectedTier` state). The tier feeds the chat stream, AI-Fill and Studio
 * generation requests.
 */
import { useState, useEffect } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';

export default function useModelTiers() {
    const [modelTiers, setModelTiers] = useState({});
    const [selectedTier, setSelectedTier] = useState('auto');

    useEffect(() => {
        authFetch(`${API_BASE}/ai/config/chat-models`)
            .then(r => (r.ok ? r.json() : {}))
            .then(setModelTiers)
            .catch(e => console.warn('[notebooks] load model tiers failed', e));
    }, []);

    return { modelTiers, selectedTier, setSelectedTier };
}
