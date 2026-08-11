import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Agent Studio — draft autosave with optimistic concurrency.
 *
 * A hand-adapted port of AppStudio's proven `useAppAutosave` engine (the
 * in-flight re-save loop, the version token, the conflict-stops-no-retry rule,
 * flush/markSaved, unmount flush). The one structural difference: agent editor
 * state lives in a *mutable* `stateRef` mutated in place by ~20 handlers, not in
 * a single immutable `definition`. So dirtiness is an explicit `dirtyRef` set by
 * `queueSave()`, and the canonical snapshot is read on demand via `getSnapshot()`.
 *
 * useAgentAutosave({ agentId, getSnapshot, baseVersion, enabled, saveFn, onSaved, onConflict })
 *   → { queueSave, flush, markSaved, status, error, savedAt }
 *
 *   - queueSave(immediate=false): mark dirty + schedule a save. Debounced 700ms
 *     unless `immediate` (discrete actions save at once). Coalesces a burst into
 *     one save of the latest snapshot.
 *   - ok       → onSaved(updated, version, { warnings }); the base version for
 *                the NEXT save is advanced internally so back-to-back saves don't
 *                race the caller's state update.
 *   - conflict → status 'error', keep dirty (so "overwrite" can resend), call
 *                onConflict({ currentVersion, agent }) and STOP — no auto-retry.
 *   - limit    → status 'error' with the server's message, keep dirty.
 *   - flush()  → force any pending save immediately (blur, refine, unmount);
 *                returns the save promise.
 *   - markSaved(agent, version) → adopt a server-confirmed state (conflict
 *                "load latest", version restore, overwrite) without re-saving it.
 *
 * status: 'idle' | 'saving' | 'saved' | 'error'. 'saved' is sticky (the pill
 * shows "Saved · HH:MM" until the next edit) — autosave never disables editing.
 */

const DEBOUNCE_MS = 700;

export default function useAgentAutosave({ agentId, getSnapshot, baseVersion, enabled = true, saveFn, onSaved, onConflict, onLimit, onError }) {
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);
    const [savedAt, setSavedAt] = useState(null);

    // Refs so the stable callbacks never read stale props.
    const agentIdRef = useRef(agentId);
    agentIdRef.current = agentId;
    const getSnapshotRef = useRef(getSnapshot);
    getSnapshotRef.current = getSnapshot;
    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;
    const saveFnRef = useRef(saveFn);
    saveFnRef.current = saveFn;
    const onSavedRef = useRef(onSaved);
    onSavedRef.current = onSaved;
    const onConflictRef = useRef(onConflict);
    onConflictRef.current = onConflict;
    const onLimitRef = useRef(onLimit);
    onLimitRef.current = onLimit;
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    const baseVersionRef = useRef(baseVersion);
    useEffect(() => { baseVersionRef.current = baseVersion; }, [baseVersion]);

    const dirtyRef = useRef(false);
    const timerRef = useRef(null);
    const inFlightRef = useRef(false);
    const queuedRef = useRef(false);
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
        if (nextStatus === 'saved') setSavedAt(new Date());
    }, []);

    const canSave = () => enabledRef.current && !!agentIdRef.current;

    const doSave = useCallback(() => {
        // Already saving: mark that another save is wanted and hand back the
        // running loop's promise so awaiters wait for the LATEST snapshot to land.
        if (inFlightRef.current) {
            queuedRef.current = true;
            return inFlightPromiseRef.current || Promise.resolve();
        }
        if (!canSave() || !dirtyRef.current) return Promise.resolve();

        inFlightRef.current = true;
        const promise = (async () => {
            try {
                // Loop until nothing new is dirty: an edit made while a save was
                // in flight sets dirtyRef/queuedRef and gets saved next turn
                // instead of being dropped.
                do {
                    queuedRef.current = false;
                    if (!canSave() || !dirtyRef.current) break;
                    // Consume the dirty flag for THIS attempt. getSnapshot reads
                    // live state, so an edit landing before the read is already
                    // included; one landing after re-sets dirtyRef → we loop.
                    dirtyRef.current = false;
                    const snap = getSnapshotRef.current();
                    setSafe('saving');
                    let res;
                    try {
                        res = await saveFnRef.current(agentIdRef.current, snap, baseVersionRef.current);
                    } catch (err) {
                        dirtyRef.current = true; // keep for retry on next edit
                        setSafe('error', String(err?.message || err || 'Saving failed.').slice(0, 500));
                        // Surface the raw error (carries .status/.code from
                        // saveAgent) so the editor can react to specific
                        // failures — e.g. flip to read-only on a permission 403
                        // instead of retry-looping (BFSF-271).
                        onErrorRef.current?.(err);
                        break;
                    }
                    if (res.ok) {
                        if (res.version !== undefined) baseVersionRef.current = res.version;
                        setSafe('saved');
                        onSavedRef.current?.(res.updated, res.version, { warnings: res.warnings || [] });
                    } else if (res.conflict) {
                        dirtyRef.current = true; // preserve local edit for "overwrite"
                        setSafe('error', 'This agent was changed somewhere else.');
                        onConflictRef.current?.({ currentVersion: res.currentVersion, agent: res.agent });
                        break; // STOP — the caller decides (load latest vs overwrite).
                    } else if (res.limit) {
                        dirtyRef.current = true;
                        setSafe('error', res.message || 'Limit reached.');
                        onLimitRef.current?.({ message: res.message, resource: res.resource });
                        break;
                    } else {
                        dirtyRef.current = true;
                        setSafe('error', 'Saving failed.');
                        break;
                    }
                } while (queuedRef.current || dirtyRef.current);
            } finally {
                inFlightRef.current = false;
                inFlightPromiseRef.current = null;
            }
        })();
        inFlightPromiseRef.current = promise;
        return promise;
    }, [setSafe]);

    const queueSave = useCallback((immediate = false) => {
        dirtyRef.current = true;
        // Without a persisted agent id (draft) or when disabled there's no save
        // target yet — mark dirty for the unsaved-changes guard and stop.
        if (!canSave()) return;
        setSafe('saving');
        if (inFlightRef.current) { queuedRef.current = true; return; }
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        if (immediate) {
            doSave();
        } else {
            timerRef.current = setTimeout(() => { timerRef.current = null; doSave(); }, DEBOUNCE_MS);
        }
    }, [doSave, setSafe]);

    const flush = useCallback(() => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        return doSave();
    }, [doSave]);

    /** Adopt a server-confirmed agent/version without re-saving it. */
    const markSaved = useCallback((_agent, version) => {
        dirtyRef.current = false;
        queuedRef.current = false;
        if (version !== undefined) baseVersionRef.current = version;
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        setSafe('saved');
    }, [setSafe]);

    // Flush any pending edit on unmount (fire-and-forget). setSafe is aliveRef-
    // guarded so a late resolve won't setState on the unmounted component.
    const flushRef = useRef(flush);
    flushRef.current = flush;
    useEffect(() => () => { flushRef.current?.(); }, []);

    return { queueSave, flush, markSaved, status, error, savedAt };
}
