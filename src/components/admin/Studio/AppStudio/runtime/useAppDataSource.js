import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { reportAppVersion } from './appVersionSignal';
import { useDataContext } from './DataContext';
import { dataCacheKey } from './resolveBinding';
import { API_BASE, authFetch } from '../../../../../utils/helpers';

// While EDITING, records are fetched in "sample" mode: a small, capped page so
// bound grids/charts/relation inputs show real data without paying for a full
// scan. The published run view fetches live (non-sampled).
export const SAMPLE_LIMIT = 50;

/**
 * App Studio runtime — the record/records/dataset/connector fetch hook.
 *
 * Given a data binding, it fetches from the live backend endpoints:
 *   GET  /api/studio-apps/:appId/data/tables/:tableId/records
 *   POST /api/studio-apps/:appId/data/query
 *   POST /api/studio-apps/:appId/data/connectors/:connectorId/run
 * and mirrors the react-query lifecycle into the shared DataContext so
 * resolveBinding resolves it. Called by AppDataScope's BindingFetcher for
 * every data binding on the active screen. Degrades to an EMPTY result
 * (never crashes):
 *   404              → [] (records/records/connector) or null (record/dataset)
 *   other non-ok     → react-query error state (surfaced, never thrown to UI)
 *   network failure  → react-query error state
 */

const DATA_KINDS = new Set(['record', 'records', 'aggregate', 'dataset', 'connector']);

function qs(params) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v == null || v === '') continue;
        usp.set(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    const s = usp.toString();
    return s ? `?${s}` : '';
}

async function fetchBinding(appId, binding, { sample = false } = {}) {
    const id = encodeURIComponent(appId);
    if (binding.kind === 'connector') {
        // Runs server-side with the owner's (or, for runAs:'viewer' connectors,
        // the viewer's) connection; params are already resolved to literals
        // (resolveBindingParams) by the fetcher layer.
        const connectorId = encodeURIComponent(binding.connectorId ?? '');
        const res = await authFetch(`${API_BASE}/api/studio-apps/${id}/data/connectors/${connectorId}/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ params: (binding.params && typeof binding.params === 'object' && !Array.isArray(binding.params)) ? binding.params : {} }),
        });
        if (res.status === 404) return []; // connector not found / app not live → empty
        let body = null;
        try { body = await res.json(); } catch { body = null; }
        if (!res.ok) {
            // 409 connection_required (runAs:'viewer' + no connection): a
            // human-readable message plus typed code/provider fields so bound
            // components and the pre-flight banner can render "connect first".
            const message = body?.code === 'connection_required'
                ? `Connect ${body?.provider || 'this app'} in Settings → Integrations to load this data`
                : (body?.error || `Could not run connector (${res.status})`);
            const err = new Error(message);
            if (body?.code) err.code = body.code;
            if (body?.provider) err.provider = body.provider;
            throw err;
        }
        return Array.isArray(body?.rows) ? body.rows : [];
    }
    if (binding.kind === 'aggregate') {
        // The /data/query endpoint already accepts an INLINE descriptor, so a
        // count-per-status needs no saved dataset and no new route. Note the key
        // rename: the binding says `filter` (matching records), the route says
        // `filters`.
        const res = await authFetch(`${API_BASE}/api/studio-apps/${id}/data/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tableId: binding.tableId,
                filters: binding.filter ?? undefined,
                groupBy: binding.groupBy ?? undefined,
                aggregates: binding.aggregates ?? undefined,
                sort: binding.sort ?? undefined,
                limit: binding.limit ?? undefined,
            }),
        });
        if (res.status === 404) return [];
        let body = null;
        try { body = await res.json(); } catch { body = null; }
        if (!res.ok) throw new Error(body?.error || `Could not load totals (${res.status})`);
        return Array.isArray(body?.rows) ? body.rows : [];
    }
    if (binding.kind === 'dataset') {
        const res = await authFetch(`${API_BASE}/api/studio-apps/${id}/data/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sample
                ? { datasetId: binding.datasetId, sample: true, limit: SAMPLE_LIMIT }
                : { datasetId: binding.datasetId }),
        });
        if (res.status === 404) return null; // endpoint not live yet → empty
        let body = null;
        try { body = await res.json(); } catch { body = null; }
        if (!res.ok) throw new Error(body?.error || `Could not load dataset (${res.status})`);
        return body && body.result !== undefined ? body.result : body;
    }

    // record / records — while editing, cap the page and flag it as a sample
    // (the server ignores unknown params harmlessly if it isn't live yet).
    const table = encodeURIComponent(binding.tableId ?? '');
    const limit = sample
        ? Math.min(Number.isFinite(binding.limit) ? binding.limit : SAMPLE_LIMIT, SAMPLE_LIMIT)
        : binding.limit;
    const query = qs({
        filter: binding.filter,
        sort: binding.sort,
        limit,
        sample: sample ? 1 : undefined,
    });
    const res = await authFetch(`${API_BASE}/api/studio-apps/${id}/data/tables/${table}/records${query}`);
    if (res.status === 404) return binding.kind === 'record' ? null : [];
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    if (!res.ok) throw new Error(body?.error || `Could not load records (${res.status})`);
    // Which published generation the SERVER is on. Reported, not returned:
    // the run page listens for it and offers a reload when it moves past the
    // version this session loaded. See appVersionSignal.
    reportAppVersion(id, body?.appVersion);
    const rows = Array.isArray(body?.records) ? body.records : Array.isArray(body) ? body : [];
    return binding.kind === 'record' ? (rows[0] ?? null) : rows;
}

/**
 * Never poll faster than this. The data-read endpoint allows 60 requests per
 * minute per user+app (STUDIO_APP_DATA_READ_RPM), which is shared with every
 * click the viewer makes — a screen that spent all of it on background polling
 * would make the app feel broken, not live.
 */
export const MIN_REFRESH_MS = 15_000;

export default function useAppDataSource(binding, { appId: appIdOverride, sample = false, refreshMs = 0 } = {}) {
    const ctx = useDataContext();
    const appId = appIdOverride ?? ctx.appId;
    const key = dataCacheKey(binding);
    const enabled = !!key && !!appId && DATA_KINDS.has(binding?.kind);

    // Editing never polls: the canvas re-renders on every keystroke and sampled
    // data is a preview, not a live view.
    const intervalMs = (!sample && Number.isFinite(refreshMs) && refreshMs >= MIN_REFRESH_MS) ? refreshMs : false;

    const query = useQuery({
        // Sampled and live share nothing: cache them under distinct keys so an
        // edit-mode sample never masquerades as the full published result.
        queryKey: ['studio-app-data', appId, sample ? 'sample' : 'live', key],
        queryFn: () => fetchBinding(appId, binding, { sample }),
        enabled,
        // A polled query must go stale BEFORE its own tick, or refetchInterval
        // fires against fresh cache and does nothing at all.
        staleTime: intervalMs ? Math.min(30_000, intervalMs - 1_000) : 30_000,
        refetchInterval: intervalMs,
        // Pinned explicitly rather than left to the default: this is the rule
        // that stops a forgotten background tab from polling all day.
        refetchIntervalInBackground: false,
        retry: false,
    });

    // Mirror the query lifecycle into the shared store so resolveBinding sees it.
    // Depend on the stable setEntry, NOT the whole ctx: the context value embeds
    // dataState, so a ctx dep would refire this effect after its own write —
    // with the fresh entry object below, an infinite update loop.
    const { setEntry, retainEntry, releaseEntry } = ctx;
    // Read the ids ONCE, defensively. `binding` is null whenever a required
    // filter has nothing to resolve against (nothing selected yet), and a
    // dependency array is evaluated on every render — the `enabled` guard
    // inside the effect body does not protect it. Dereferencing null there
    // crashed the whole app to the error boundary the moment a screen with a
    // selection-scoped component first rendered.
    const tableId = binding?.tableId ?? null;
    const datasetId = binding?.datasetId ?? null;
    const connectorId = binding?.connectorId ?? null;

    useEffect(() => {
        if (!enabled || !key) return;
        const status = query.isError ? 'error' : query.isSuccess ? 'success' : 'loading';
        setEntry(key, {
            status,
            result: query.data,
            error: query.error ? (query.error.message || String(query.error)) : null,
            // Typed error metadata (connector 409s): 'connection_required' +
            // the provider id lets consumers render a "connect first" state.
            errorCode: query.error?.code ?? null,
            errorProvider: query.error?.provider ?? null,
            tableId,
            datasetId,
            connectorId,
        });
    }, [enabled, key, query.data, query.isError, query.isSuccess, query.error, setEntry, tableId, datasetId, connectorId]);

    // An entry outlives its fetcher otherwise: every screen change and every
    // new resolved filter mints a fresh cache key, so the store would grow for
    // the whole session. Kept in its OWN effect — the mirror effect above
    // re-runs on each query tick, and evicting there would blank the entry
    // (isLoading) between two paints.
    //
    // REFCOUNTED, because a cache key is shared: two fetchers with the same
    // binding hold the same entry, and an unconditional evict on one unmount
    // blanked it under the other. The entry goes when the LAST holder does.
    useEffect(() => {
        if (!enabled || !key) return undefined;
        retainEntry(key);
        return () => releaseEntry(key);
    }, [enabled, key, retainEntry, releaseEntry]);

    return { ...query, cacheKey: key };
}
