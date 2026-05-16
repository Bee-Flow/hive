// Shared React Query client.
//
// All API consumers should pull their queries through this client so we get
// one cache, one set of devtools, and one place to tune retry/staleness.
// Configuration:
//
//   staleTime: 30s         — most domain reads change rarely; this prevents
//                            the "every panel refetches on mount" pattern
//                            that the pre-React-Query code suffered from.
//   gcTime: 5min           — unmounted queries linger in the cache so that
//                            navigating back doesn't refetch.
//   retry: 2 (exp backoff) — handles transient 5xx / network blips.
//   refetchOnWindowFocus: false  — chat UI shouldn't refetch every alt-tab.

import { QueryClient } from '@tanstack/react-query';
import { MS_PER_MINUTE, MS_PER_SECOND } from '../constants/units';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30 * MS_PER_SECOND,
            gcTime: 5 * MS_PER_MINUTE,
            retry: 2,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
            refetchOnWindowFocus: false,
            refetchOnReconnect: 'always',
        },
        mutations: {
            // Mutations don't retry automatically — callers decide whether
            // the action is idempotent.
            retry: false,
        },
    },
});
