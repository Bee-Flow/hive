import { useCallback, useEffect, useRef, useState } from 'react';
import { studioAppsApi } from '../studioAppsApi';

/**
 * App Studio — draft autosave over studioAppsApi.saveDefinition.
 *
 * useAppAutosave({ appId, definition, version, enabled, onSaved, onConflict, onInvalid })
 *   → { flush, status, error, markSaved }
 *
 * Behaviour:
 *   - 900ms debounce after `definition` changes; the initial mount and
 *     identical references never save (dirtiness is reference-based — the
 *     definition only changes through immutable ops).
 *   - ok        → onSaved(newVersion, { warnings, repairs }); the base
 *                 version for the NEXT save is tracked internally too, so
 *                 back-to-back saves don't race the caller's set_version.
 *   - conflict  → onConflict({ currentVersion, definition }) and STOP — no
 *                 auto-retry; the caller decides (load latest vs overwrite).
 *   - invalid   → status 'error' with the first validation message, plus
 *                 onInvalid({ errors, warnings }) with the FULL server reply —
 *                 the pill can only show one line, the rest is not noise.
 *   - flush()   → force any pending save immediately (unmount, Cmd+S, Close);
 *                 resolves to { ok, error? } — it never REJECTS, so a caller
 *                 that must not discard unsaved work (Close) has to read the
 *                 result instead of relying on the promise settling.
 *   - markSaved(definition, version) → adopt a server-confirmed state
 *                 (conflict "load latest", version restore, manual overwrite)
 *                 without triggering a save of it.
 *   - a beforeunload warning while dirty or saving.
 *
 * status: 'idle' | 'saving' | 'saved' | 'error' — 'saved' relaxes back to
 * 'idle' after a moment so the header pill can fade out. Autosave never
 * disables any editing UI.
 */

const DEBOUNCE_MS = 900;
const SAVED_RESET_MS = 1800;

// "Nothing left to persist" — the resolution of every save path that did not
// leave unsaved work behind (already saved, disabled, or a clean round-trip).
const OK = { ok: true };

export default function useAppAutosave({ appId, definition, version, enabled = true, onSaved, onConflict, onInvalid }) {
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);

    // Refs so the stable flush/doSave callbacks never read stale props.
    const definitionRef = useRef(definition);
    definitionRef.current = definition;
    const appIdRef = useRef(appId);
    appIdRef.current = appId;
    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;
    const onSavedRef = useRef(onSaved);
    onSavedRef.current = onSaved;
    const onConflictRef = useRef(onConflict);
    onConflictRef.current = onConflict;
    const onInvalidRef = useRef(onInvalid);
    onInvalidRef.current = onInvalid;

    const baseVersionRef = useRef(version);
    useEffect(() => { baseVersionRef.current = version; }, [version]);

    const lastSavedRef = useRef(definition); // initial definition counts as saved
    const timerRef = useRef(null);
    const savedTimerRef = useRef(null);
    const inFlightRef = useRef(false);
    const queuedRef = useRef(false);
    // The promise of the currently-running save loop, so flush() (and any
    // doSave call that lands while a save is in flight) can AWAIT the whole
    // chain — including a re-save triggered by edits that arrived mid-flight.
    const inFlightPromiseRef = useRef(null);
    const aliveRef = useRef(true);
    useEffect(() => {
        aliveRef.current = true;
        return () => { aliveRef.current = false; };
    }, []);

    // setState guarded against the fire-and-forget save on unmount.
    const setSafe = useCallback((nextStatus, nextError = null) => {
        if (!aliveRef.current) return;
        setStatus(nextStatus);
        setError(nextError);
        clearTimeout(savedTimerRef.current);
        if (nextStatus === 'saved') {
            savedTimerRef.current = setTimeout(() => {
                if (aliveRef.current) setStatus((s) => (s === 'saved' ? 'idle' : s));
            }, SAVED_RESET_MS);
        }
    }, []);

    const doSave = useCallback(() => {
        // Already saving: mark that another save is wanted and hand back the
        // running loop's promise so awaiters wait for the LATEST definition to
        // land (the loop re-saves before it resolves — see below).
        if (inFlightRef.current) {
            queuedRef.current = true;
            return inFlightPromiseRef.current || Promise.resolve(OK);
        }
        if (!enabledRef.current || !appIdRef.current) return Promise.resolve(OK);
        const def0 = definitionRef.current;
        if (!def0 || def0 === lastSavedRef.current) return Promise.resolve(OK);

        inFlightRef.current = true;
        const promise = (async () => {
            let outcome = OK;
            try {
                // Loop until the live definition matches what we last persisted:
                // an edit made while a save was in flight sets queuedRef, and we
                // save it in the next turn instead of dropping it.
                do {
                    queuedRef.current = false;
                    const def = definitionRef.current;
                    if (!enabledRef.current || !def || def === lastSavedRef.current) break;
                    setSafe('saving');
                    const res = await studioAppsApi.saveDefinition(appIdRef.current, def, baseVersionRef.current);
                    if (res.ok) {
                        lastSavedRef.current = def;
                        baseVersionRef.current = res.version;
                        setSafe('saved');
                        onSavedRef.current?.(res.version, {
                            warnings: res.warnings || [],
                            repairs: res.repairs || [],
                        });
                    } else if (res.conflict) {
                        outcome = { ok: false, error: 'This app was changed somewhere else.' };
                        setSafe('error', outcome.error);
                        onConflictRef.current?.({ currentVersion: res.currentVersion, definition: res.definition });
                        break; // STOP — the caller decides (load latest vs overwrite).
                    } else if (res.invalid) {
                        const errors = Array.isArray(res.errors) ? res.errors : [];
                        const first = errors.length ? errors[0] : null;
                        outcome = { ok: false, error: (typeof first === 'string' ? first : first?.message) || 'The app definition is invalid.' };
                        setSafe('error', outcome.error);
                        onInvalidRef.current?.({ errors, warnings: res.warnings || [] });
                        break;
                    } else {
                        outcome = { ok: false, error: 'Saving failed.' };
                        setSafe('error', outcome.error);
                        break;
                    }
                } while (queuedRef.current && definitionRef.current !== lastSavedRef.current);
            } catch (err) {
                outcome = { ok: false, error: err?.message || 'Saving failed.' };
                setSafe('error', outcome.error);
            } finally {
                inFlightRef.current = false;
                inFlightPromiseRef.current = null;
            }
            return outcome;
        })();
        inFlightPromiseRef.current = promise;
        return promise;
    }, [setSafe]);

    // Debounced save on definition changes (skips mount + identical refs).
    useEffect(() => {
        if (!enabled || !definition || definition === lastSavedRef.current) return undefined;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            doSave();
        }, DEBOUNCE_MS);
        return () => clearTimeout(timerRef.current);
    }, [definition, enabled, doSave]);

    const flush = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        return doSave();
    }, [doSave]);

    /** Adopt a server-confirmed definition/version without re-saving it. */
    const markSaved = useCallback((def, ver) => {
        lastSavedRef.current = def;
        if (ver !== undefined) baseVersionRef.current = ver;
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        setSafe('idle');
    }, [setSafe]);

    // Flush any pending edit on unmount (fire-and-forget).
    const flushRef = useRef(flush);
    flushRef.current = flush;
    useEffect(() => () => {
        clearTimeout(savedTimerRef.current);
        flushRef.current?.();
    }, []);

    // Warn before closing the tab while dirty.
    useEffect(() => {
        const onBeforeUnload = (e) => {
            if (!enabledRef.current) return;
            const dirty = definitionRef.current !== lastSavedRef.current
                || inFlightRef.current || timerRef.current != null;
            if (!dirty) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, []);

    return { flush, status, error, markSaved };
}
