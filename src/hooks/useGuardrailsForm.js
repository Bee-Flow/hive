/**
 * useGuardrailsForm — shared dirty-state + reducer for the Privacy Shield admin
 * page. Each "card" (Regex, Moderation, Privacy/DLP, Output, Additional) owns
 * a slice of the state but dirty-tracking + beforeunload + atomic save belong
 * at the page level.
 *
 * The server stores the shield as a single JSON blob, so we keep a single
 * canonical object in state, snapshot it after every successful fetch/save,
 * and compare on every edit to compute per-card dirty flags.
 *
 * Intentionally light on abstraction: each card receives `(value, setValue)`
 * for its own slice and the hook derives the dirty flag from deep-equal vs
 * the snapshot.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const CARDS = ['regex', 'moderation', 'privacy', 'output', 'additional'];

function deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
    return true;
}

/**
 * @param {object} initialShield  The shield object fetched from the server.
 * @param {object} cardSelectors  { cardKey: (shield) => slice } — extracts the
 *                                subset of `shield` that belongs to a card so
 *                                dirty-tracking is per-card.
 */
export default function useGuardrailsForm(initialShield, cardSelectors) {
    const [shield, setShield] = useState(initialShield || {});
    const snapshotRef = useRef(initialShield || {});

    // If the caller refetches (e.g. org changed), reset both state + snapshot.
    const reset = useCallback((next) => {
        snapshotRef.current = next || {};
        setShield(next || {});
    }, []);

    // After a successful save, adopt the saved object as the new snapshot.
    const markSaved = useCallback((saved) => {
        const next = saved || shield;
        snapshotRef.current = next;
        setShield(next);
    }, [shield]);

    const updateField = useCallback((path, value) => {
        setShield(prev => {
            if (!path) return { ...prev, ...value };
            const parts = Array.isArray(path) ? path : String(path).split('.');
            const next = Array.isArray(prev) ? [...prev] : { ...prev };
            let cursor = next;
            for (let i = 0; i < parts.length - 1; i++) {
                const k = parts[i];
                cursor[k] = cursor[k] != null && typeof cursor[k] === 'object' ? (Array.isArray(cursor[k]) ? [...cursor[k]] : { ...cursor[k] }) : {};
                cursor = cursor[k];
            }
            cursor[parts[parts.length - 1]] = value;
            return next;
        });
    }, []);

    const dirtyByCard = useMemo(() => {
        const out = {};
        for (const key of CARDS) {
            const selector = cardSelectors?.[key];
            if (!selector) { out[key] = false; continue; }
            out[key] = !deepEqual(selector(shield), selector(snapshotRef.current));
        }
        return out;
    }, [shield, cardSelectors]);

    const isDirty = useMemo(() => Object.values(dirtyByCard).some(Boolean), [dirtyByCard]);

    // Warn on tab close / refresh when there are unsaved changes.
    useEffect(() => {
        if (!isDirty) return;
        const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDirty]);

    return { shield, setShield, updateField, reset, markSaved, dirtyByCard, isDirty };
}

export const GUARDRAILS_CARDS = CARDS;
