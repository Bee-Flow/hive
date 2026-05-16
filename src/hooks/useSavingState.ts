// Tiny state machine for the recurring save UX:
//   idle  → saving (while a save is in flight)
//         → saved (transient success flash)
//         → idle  (auto, after `flashMs`)
//   idle  → saving → error (with error captured; persists until reset)
//
// Replaces the per-Studio savingState reducers in RoutinesStudio,
// SkillsStudio, and KBsStudio (and inline copies in admin panels).
//
// Usage:
//   const saving = useSavingState();
//   const onSave = async () => {
//     try { saving.setSaving(); await api.save(); saving.setSaved(); }
//     catch (e) { saving.setError(e); }
//   };
//   {saving.state === 'saving' && <Spinner />}
//   {saving.state === 'saved'  && <span>✓ Saved</span>}
//   {saving.state === 'error'  && <span>Save failed</span>}

import { useCallback, useEffect, useRef, useState } from 'react';

export type SavingStateKind = 'idle' | 'saving' | 'saved' | 'error';

export interface UseSavingStateOptions {
    /** ms to show the 'saved' state before auto-resetting to 'idle'. */
    flashMs?: number;
}

export interface UseSavingStateReturn {
    state: SavingStateKind;
    error: unknown;
    setSaving: () => void;
    setSaved: () => void;
    setError: (err: unknown) => void;
    reset: () => void;
}

export default function useSavingState(
    { flashMs = 1500 }: UseSavingStateOptions = {},
): UseSavingStateReturn {
    const [state, setState] = useState<SavingStateKind>('idle');
    const [error, setErrorState] = useState<unknown>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = () => {
        if (timerRef.current != null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    useEffect(() => () => clearTimer(), []);

    const setSaving = useCallback(() => {
        clearTimer();
        setErrorState(null);
        setState('saving');
    }, []);

    const setSaved = useCallback(() => {
        clearTimer();
        setErrorState(null);
        setState('saved');
        timerRef.current = setTimeout(() => setState('idle'), flashMs);
    }, [flashMs]);

    const setError = useCallback((err: unknown) => {
        clearTimer();
        setErrorState(err);
        setState('error');
    }, []);

    const reset = useCallback(() => {
        clearTimer();
        setErrorState(null);
        setState('idle');
    }, []);

    return { state, error, setSaving, setSaved, setError, reset };
}
