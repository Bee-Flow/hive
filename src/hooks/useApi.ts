// Thin React-Query wrapper for the recurring inline pattern:
//
//   const [data, setData] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   useEffect(() => {
//     let alive = true;
//     setLoading(true);
//     authFetch(API_BASE + '/some/path')
//       .then(r => r.json()).then(d => { if (alive) setData(d); })
//       .catch(e => { if (alive) setError(e); })
//       .finally(() => { if (alive) setLoading(false); });
//     return () => { alive = false; };
//   }, []);
//
// Use this for one-off GETs that aren't worth a dedicated query module yet.
// Bigger domains (agents, billing, usage, ...) should still get a typed
// hook under `api/queries/` so other components can share the cache.
//
// Usage:
//   const { data, isLoading, error, refetch } = useApi<MyShape>('/api/something');
//   const { data } = useApi<MyShape>('/api/things', {
//     params: { id: 42 },
//     enabled: Boolean(id),
//   });

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface UseApiOptions<TData> {
    /** URL search params, merged into the path. */
    params?: Record<string, string | number | boolean | undefined | null>;
    /** When false, the query stays disabled (parity with useQuery.enabled). */
    enabled?: boolean;
    /** Override the default 30s staleTime; pass 0 to refetch on every mount. */
    staleTime?: number;
    /** Optional select fn. */
    select?: (raw: unknown) => TData;
    /** Optional initialData for instant render. */
    initialData?: TData;
}

function pathKey(path: string, params?: UseApiOptions<unknown>['params']) {
    if (!params) return [path] as const;
    const stable: Record<string, unknown> = {};
    Object.keys(params)
        .sort()
        .forEach((k) => {
            const v = params[k];
            if (v !== undefined && v !== null) stable[k] = v;
        });
    return [path, stable] as const;
}

export default function useApi<TData = unknown>(
    path: string,
    opts: UseApiOptions<TData> = {},
) {
    const queryKey = pathKey(path, opts.params);
    const query: UseQueryOptions<unknown, Error, TData> = {
        queryKey,
        queryFn: ({ signal }) =>
            apiClient.get(path, {
                signal,
                query: opts.params as Record<string, string | number | boolean> | undefined,
            }),
        enabled: opts.enabled,
        staleTime: opts.staleTime,
        select: opts.select,
        initialData: opts.initialData,
    };
    return useQuery<unknown, Error, TData>(query);
}
