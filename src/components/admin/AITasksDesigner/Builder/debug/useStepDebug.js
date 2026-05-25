import { useCallback, useEffect, useState } from 'react';
import scopedStorage from '../../../../../utils/scopedStorage';

/**
 * Per-step ephemeral debug state for the StepInspector. Phase 1 keeps
 * everything client-side:
 *   - pinnedInput: a JSON snapshot the user pinned via the "Pin as
 *     sample" button. Lets them iterate on the step's settings without
 *     re-running the whole automation to regenerate fresh inputs. Stored
 *     in scopedStorage so it survives page reloads but not session
 *     boundaries.
 *
 * Phase 2 will persist this to `step._debug.sampleInput` on the draft so
 * pinned samples follow the automation across users/devices.
 *
 * Returns:
 *   pinnedInput   — the pinned JSON or null
 *   pinInput(v)   — pin a snapshot
 *   clearPinned() — drop the pin
 */
export default function useStepDebug(stepId) {
    const storageKey = stepId ? `stepDebug.pinnedInput.${stepId}` : null;
    const [pinnedInput, setPinnedInput] = useState(() => readPin(storageKey));

    // Re-hydrate when the active step changes so each step shows its own
    // pinned sample (or none).
    useEffect(() => {
         
        setPinnedInput(readPin(storageKey));
    }, [storageKey]);

    const pinInput = useCallback((value) => {
        if (!storageKey) return;
        const snapshot = safeClone(value);
        setPinnedInput(snapshot);
        scopedStorage.setJSON(storageKey, snapshot);
    }, [storageKey]);

    const clearPinned = useCallback(() => {
        if (!storageKey) return;
        setPinnedInput(null);
        scopedStorage.removeItem(storageKey);
    }, [storageKey]);

    return { pinnedInput, pinInput, clearPinned };
}

function readPin(storageKey) {
    if (!storageKey) return null;
    return scopedStorage.getJSON(storageKey, null);
}

function safeClone(v) {
    try {
        return JSON.parse(JSON.stringify(v));
    } catch {
        return null;
    }
}
