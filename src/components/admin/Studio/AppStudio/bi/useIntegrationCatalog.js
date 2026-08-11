import { useEffect, useMemo, useRef, useState } from 'react';
import useAutomationApi from '../../../../../hooks/useAutomationApi';

/**
 * The app catalog, once per editor session.
 *
 * Reads GET /api/automation/catalog — the same catalog the automations builder
 * uses: every platform app with its actions, each action's inputSchema (what it
 * needs), outputSample (what it gives back) and the strict per-user `available`
 * flag (org grant ∩ group grant ∩ personal toggle ∩ credentials).
 *
 * Cached at module level with a short TTL because the connector editor mounts
 * several consumers (the picker, the parameter form, the chain editor) that all
 * need the same answer, and remounts on every connector selection. The TTL is
 * short — and `refresh()` drops the cache outright — because the one thing a
 * user does between two looks at this list is step out to CONNECT an app, and
 * coming back to a stale "not connected" would read as a bug.
 */

let catalogPromise = null;
let catalogFetchedAt = 0;
const CATALOG_TTL_MS = 30_000;

export function clearCatalogCache() { catalogPromise = null; catalogFetchedAt = 0; }

export default function useIntegrationCatalog() {
    const api = useAutomationApi();
    const apiRef = useRef(api);
    apiRef.current = api;

    const [catalog, setCatalog] = useState(null);
    const [failed, setFailed] = useState(false);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let alive = true;
        if (!catalogPromise || Date.now() - catalogFetchedAt > CATALOG_TTL_MS) {
            catalogPromise = apiRef.current.getCatalog();
            catalogFetchedAt = Date.now();
        }
        catalogPromise.then(
            (c) => { if (alive) setCatalog(c); },
            () => { clearCatalogCache(); if (alive) setFailed(true); },
        );
        return () => { alive = false; };
    }, [reload]);

    // Every app that owns at least one action; connectable ones first so the
    // list opens on something usable.
    const apps = useMemo(() => {
        const list = Array.isArray(catalog?.apps) ? catalog.apps.filter((a) => (a.actions || []).length > 0) : [];
        return [...list].sort((a, b) => Number(b.available === true) - Number(a.available === true)
            || String(a.label || a.id).localeCompare(String(b.label || b.id)));
    }, [catalog]);

    const byToolName = useMemo(() => {
        const m = new Map();
        for (const app of apps) {
            for (const action of app.actions || []) m.set(action.name, { app, action });
        }
        return m;
    }, [apps]);

    const refresh = () => { clearCatalogCache(); setCatalog(null); setFailed(false); setReload((n) => n + 1); };

    return {
        catalog,
        apps,
        byToolName,
        loading: !catalog && !failed,
        failed,
        refresh,
        /** The catalog entry for a tool name, or null when it isn't in the catalog. */
        lookup: (toolName) => byToolName.get(toolName) || null,
        /** Sibling actions of the app owning `toolName` (the chain candidates). */
        siblingsOf: (toolName) => {
            const hit = byToolName.get(toolName);
            if (!hit) return [];
            return (hit.app.actions || []).filter((a) => a.name !== toolName);
        },
    };
}
