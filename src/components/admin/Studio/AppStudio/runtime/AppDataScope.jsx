import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useMemo } from 'react';
import { DataProvider, useDataState } from './DataContext';
import { dataCacheKey, resolveBindingFilters, resolveBindingParams } from './resolveBinding';
import useAppDataSource from './useAppDataSource';

/**
 * App Studio runtime — the live-data scope.
 *
 * Wraps a subtree in a DataProvider, discovers every record/records/dataset
 * binding used on the current screen, fetches each one (via useAppDataSource —
 * react-query cached, 404/empty degrade), and hands the resolved `dataState`
 * to a render-prop child so the renderer can bind real records.
 *
 *   <AppDataScope appId={id} definition={def} screenId={sid} sample={editing}
 *                 scope={liveScope}>
 *     {(dataState, { refresh }) => <AppRenderer dataState={dataState} … />}
 *   </AppDataScope>
 *
 * `scope` (optional) is the live buildScope-shaped expression scope
 * ({ currentUser, vars, forms, screen, now, today }) that DYNAMIC filter
 * values ({ kind:'formula', expr } entries in a record/records binding's
 * filter) resolve against — client-side, before the fetch, so the request
 * only carries literals (resolveBindingFilters). The query key hashes the
 * RESOLVED filter, so a vars/currentUser change refetches automatically.
 * Without a scope, formulas resolve to undefined and their entries are
 * omitted (RLS remains the server-side boundary either way).
 *
 * The render prop's second argument carries `refresh()` — react-query
 * invalidation of every data query for this app (the ['studio-app-data',
 * appId, …] key family from useAppDataSource), so a `refresh` action step
 * refetches after a record write instead of being a no-op.
 *
 * `sample` fetches a small capped page (edit mode); false fetches live (the
 * published run view). With no data bindings on the screen NOTHING is fetched —
 * the component tree stays inert, so a definition without data (fixtures, the
 * kitchen-sink) never touches the network.
 */

const DATA_BINDING_KINDS = new Set(['record', 'records', 'aggregate', 'dataset', 'connector']);

/** The screen the renderer would show — same fallback chain as AppRenderer. */
function resolveScreen(definition, screenId) {
    const screens = definition?.screens || [];
    return screens.find((s) => s.id === screenId)
        || screens.find((s) => s.id === definition?.homeScreenId)
        || screens[0]
        || null;
}

/**
 * The fetch-layer scope must describe the SAME screen the renderer's scope
 * does, or a filter formula reading screen.name resolves one way here and
 * another way at read time — two cache keys, and the bound component waits
 * forever on an entry nobody fetched. The caller owns screen.params (its
 * navigation state); id/name come from the definition on both sides.
 */
function useFetchScope(scope, definition, screenId) {
    return useMemo(() => {
        const screen = resolveScreen(definition, screenId);
        if (!screen) return scope;
        return { ...(scope || {}), screen: { ...(scope?.screen || {}), id: screen.id, name: screen.name } };
    }, [scope, definition, screenId]);
}

/**
 * Deep-scan a screen for the data bindings its components read (props.source,
 * a stat's value/trend, node.repeat/forEach, computed bindings — anywhere a
 * { kind:'record'|'records'|'dataset'|'connector' } object appears). Deduped by
 * cache key. Pure — safe to unit-test.
 */
export function collectDataBindings(definition, screenId) {
    const screen = resolveScreen(definition, screenId);
    if (!screen) return [];

    const out = [];
    const seen = new Set();
    const visit = (value) => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) {
            for (const v of value) visit(v);
            return;
        }
        if (typeof value.kind === 'string' && DATA_BINDING_KINDS.has(value.kind)) {
            const key = dataCacheKey(value);
            if (key && !seen.has(key)) {
                seen.add(key);
                out.push({ cacheKey: key, binding: value });
            }
            return; // a binding's own fields never hold nested data bindings we fetch
        }
        for (const v of Object.values(value)) visit(v);
    };
    for (const section of screen.sections || []) visit(section);
    return out;
}

/**
 * One hidden fetcher per binding — mirrors its react-query lifecycle into the
 * store. Dynamic filter values resolve against the live scope HERE (the
 * fetcher layer), so collectDataBindings stays static and useAppDataSource
 * stays scope-free: it only ever sees a literal-valued binding. A resolved
 * value change produces a new cache key → a fresh query (refetch).
 */
function BindingFetcher({ binding, sample, scope, refreshMs }) {
    const resolved = useMemo(
        () => (binding.kind === 'connector'
            ? resolveBindingParams(binding, scope)
            : resolveBindingFilters(binding, scope)),
        [binding, scope],
    );
    useAppDataSource(resolved, { sample, refreshMs });
    return null;
}

/**
 * Spread the polling fleet out.
 *
 * A screen's interval applies to EVERY binding on it, so a 15s interval over 8
 * bindings is 32 requests a minute against a 60/min budget that the viewer's own
 * clicks also draw from. Scaling the interval with the binding count keeps a
 * busy screen inside its budget instead of throttling the user's next click.
 */
const MIN_SPACING_MS = 2_500;

function BindingLoaders({ definition, screenId, sample, scope, refreshMs }) {
    const bindings = useMemo(
        () => collectDataBindings(definition, screenId),
        [definition, screenId],
    );
    const fetchScope = useFetchScope(scope, definition, screenId);
    const effectiveMs = refreshMs ? Math.max(refreshMs, bindings.length * MIN_SPACING_MS) : 0;
    return bindings.map((b) => (
        <BindingFetcher key={b.cacheKey} binding={b.binding} sample={sample} scope={fetchScope} refreshMs={effectiveMs} />
    ));
}

// AppDataScope must render in provider-less environments too (unit tests,
// storybook-style previews) — refresh degrades to a no-op there. The hook call
// itself stays unconditional; only the missing-provider throw is absorbed.
function useOptionalQueryClient() {
    try {
        return useQueryClient();
    } catch {
        return null;
    }
}

function DataConsumer({ appId, children }) {
    const dataState = useDataState();
    const queryClient = useOptionalQueryClient();
    /**
     * refresh(scope?) — reload data.
     *
     * With a { tableId } or { datasetId } it invalidates only the queries that
     * read that source; with nothing it invalidates the whole app, which is the
     * pre-existing behaviour and what a v2.0 `refresh` step still gets. The
     * narrowing matters on a polling screen: reloading eight bindings because
     * one record changed is what makes an app feel like it flickers.
     */
    const refresh = useCallback((scopeArg) => {
        if (!queryClient) return Promise.resolve();
        const s = (scopeArg && typeof scopeArg === 'object') ? scopeArg : null;
        const tableId = s?.tableId || null;
        const datasetId = s?.datasetId || null;
        if (!tableId && !datasetId) {
            return queryClient.invalidateQueries({ queryKey: ['studio-app-data', appId] });
        }
        return queryClient.invalidateQueries({
            queryKey: ['studio-app-data', appId],
            // dataCacheKey puts the source id at the head of the key
            // ('records:<tableId>:<hash>', 'dataset:<id>', …) and neither a
            // table id nor a dataset id can contain ':', so a prefix match is
            // exact rather than merely likely.
            predicate: (q) => {
                const k = q.queryKey[3];
                if (typeof k !== 'string') return false;
                if (datasetId) return k === `dataset:${datasetId}`;
                return k.startsWith(`record:${tableId}:`)
                    || k.startsWith(`records:${tableId}:`)
                    || k.startsWith(`aggregate:${tableId}:`);
            },
        });
    }, [queryClient, appId]);
    const controls = useMemo(() => ({ refresh }), [refresh]);
    return typeof children === 'function' ? children(dataState, controls) : children;
}

export default function AppDataScope({ appId, definition, screenId, sample = false, draft = false, scope, refreshMs = 0, children }) {
    return (
        <DataProvider appId={appId} draft={draft}>
            <BindingLoaders definition={definition} screenId={screenId} sample={sample} scope={scope} refreshMs={refreshMs} />
            <DataConsumer appId={appId}>{children}</DataConsumer>
        </DataProvider>
    );
}
