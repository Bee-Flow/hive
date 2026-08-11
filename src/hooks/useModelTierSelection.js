import { useEffect, useState } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';
import scopedStorage from '../utils/scopedStorage';

/**
 * Model-tier list + persisted selection for AI-builder composers.
 *
 * Encapsulates the tier plumbing both builders (automations BuilderShell,
 * App Studio BuilderChatPane) need around <ModelTierSelector/>:
 *   - fetch the permission- and task-aware tier list from
 *     /ai/config/tiers-for-user (custom tiers appear only when the user's
 *     groups grant access AND the tier is allowed for the task type),
 *   - persist the selected tier per user under `storageKey` (scopedStorage),
 *   - stale-tier fallback: when storage held a tier the server no longer
 *     returns (beta revoked, custom tier deleted), snap back to 'auto' so
 *     the picker doesn't show an undefined slot.
 *
 * NOTE: distinct from pages/notebooks/hooks/useModelTiers.js, which fetches
 * the unfiltered /ai/config/chat-models list and keeps no selection state.
 */
export default function useModelTierSelection({ storageKey, taskType = 'direct_chat' }) {
    const [modelTiers, setModelTiers] = useState({});
    const [selectedTier, setSelectedTier] = useState(() => scopedStorage.getItem(storageKey) || 'auto');

    useEffect(() => {
        scopedStorage.setItem(storageKey, selectedTier);
    }, [storageKey, selectedTier]);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const r = await authFetch(`${API_BASE}/ai/config/tiers-for-user?taskType=${encodeURIComponent(taskType)}`);
                if (r.ok && alive) setModelTiers(await r.json());
            } catch (_) { /* silent */ }
        })();
        return () => { alive = false; };
    }, [taskType]);

    useEffect(() => {
        const keys = Object.keys(modelTiers || {});
        if (keys.length === 0) return;
        if (!keys.includes(selectedTier)) {
            setSelectedTier(keys.includes('auto') ? 'auto' : keys[0]);
        }
    }, [modelTiers, selectedTier]);

    return { modelTiers, selectedTier, setSelectedTier };
}
