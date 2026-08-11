import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * App Studio runtime — the data-source state provider.
 *
 * Holds `dataState`, a map keyed by a binding's stable cache-key (see
 * dataCacheKey in resolveBinding.js) of `{ status, result, error, tableId?,
 * datasetId? }` entries — mirroring actionState's status vocabulary so
 * resolveBinding treats action- and data-bindings identically.
 *
 * The provider only STORES entries; the actual fetching is done by
 * useAppDataSource (built on react-query), which writes results back here via
 * setEntry. Keeping the store separate from the fetch keeps the renderer
 * synchronous and lets many components share one query per cache-key.
 *
 * Reading is via useDataState(); resolveBinding is given this map in its bag.
 */

const EMPTY = Object.freeze({});

// Safety net only: entries are evicted when their fetcher unmounts
// (useAppDataSource), so a live screen holds one entry per binding and never
// reaches this. Far above any real screen's binding count, so the oldest-first
// drop below can't evict an entry something on screen is still reading.
const MAX_DATA_ENTRIES = 200;

const DataContext = createContext({
    dataState: EMPTY,
    appId: null,
    draft: false,
    setEntry: () => {},
    removeEntry: () => {},
});

/**
 * `draft` tells components whose server calls resolve against the app
 * DEFINITION (today: ai_chat) which one to ask for — the editor preview runs
 * the unsaved draft, a published run page the frozen published definition. It
 * mirrors the `draft` option Canvas already passes to useActionRunner.
 */
export function DataProvider({ appId = null, draft = false, initialState = null, children }) {
    const [dataState, setDataState] = useState(initialState || EMPTY);

    const setEntry = useCallback((key, entry) => {
        if (!key) return;
        setDataState((prev) => {
            const cur = prev[key];
            // Content bail: writers rebuild the entry object every effect run;
            // an identity check alone would churn state (and can loop effects).
            if (cur === entry) return prev;
            if (cur && entry
                && cur.status === entry.status && cur.result === entry.result
                && cur.error === entry.error && cur.errorCode === entry.errorCode
                && cur.errorProvider === entry.errorProvider
                && cur.tableId === entry.tableId
                && cur.datasetId === entry.datasetId) return prev;
            const next = { ...prev, [key]: entry };
            const keys = Object.keys(next);
            const excess = keys.length - MAX_DATA_ENTRIES;
            // Insertion-ordered: rewriting an existing key keeps its position,
            // so the head of the list is the oldest entry.
            for (let i = 0; i < excess; i++) {
                if (keys[i] !== key) delete next[keys[i]];
            }
            return next;
        });
    }, []);

    const removeEntry = useCallback((key) => {
        setDataState((prev) => {
            if (!key || !Object.prototype.hasOwnProperty.call(prev, key)) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    const value = useMemo(
        () => ({ dataState, appId, draft, setEntry, removeEntry }),
        [dataState, appId, draft, setEntry, removeEntry],
    );

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataContext() {
    return useContext(DataContext);
}

export function useDataState() {
    return useContext(DataContext).dataState;
}

export default DataContext;
