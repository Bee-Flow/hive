import { useCallback, useEffect, useState } from 'react';
import { FORM_MODES } from './formDensity';
import scopedStorage from '../../../../../../utils/scopedStorage';

const KEY = 'ndvFormMode';

/**
 * The user's persisted Simple / All-options choice for the step editor.
 *
 * Returns `mode: null` until the user has ever touched the toggle — that is
 * load-bearing: formDensity.resolveMode falls back to the gesture (single
 * click = Simple, double click = everything) when mode is null, so behaviour
 * with no stored preference is byte-for-byte the old one.
 *
 * Device-level via scopedStorage, like every other NDV preference
 * (ndvInputOpen, ndvInputWidth, …). There is no per-user settings endpoint to
 * hang this on server-side; see the plan's out-of-scope list.
 *
 * Cold-load: scopedStorage is a no-op until AuthedApp's setCurrentUser effect
 * has run, and child effects fire before parent effects on first hydration —
 * so the lazy initial read can miss a stored value. Re-read once in a mount
 * effect and adopt what turns up (the pattern AgentHub.jsx uses for
 * chatHistoryMode).
 */
export default function useFormModePreference() {
    const [mode, setModeState] = useState(() => {
        const v = scopedStorage.getItem(KEY);
        return FORM_MODES.includes(v) ? v : null;
    });

    useEffect(() => {
        const v = scopedStorage.getItem(KEY);
        if (FORM_MODES.includes(v)) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- adopt-once cold-load sync
            setModeState(v);
        }
    }, []);

    const setMode = useCallback((next) => {
        if (!FORM_MODES.includes(next)) return;
        setModeState(next);
        scopedStorage.setItem(KEY, next);
    }, []);

    const toggleMode = useCallback((current) => {
        setMode(current === 'simple' ? 'advanced' : 'simple');
    }, [setMode]);

    return { mode, setMode, toggleMode };
}
