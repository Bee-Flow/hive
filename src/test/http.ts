// Shared test HTTP response builders.
//
// `ok(body)` was re-declared verbatim across the SupportStudio tab tests and
// KBsStudio (and elsewhere). Import it from here instead of re-inlining it:
//
//   import { ok } from '@/test/http';
//   authFetch.mockImplementation(() => ok({ tags: [] }));

/** A resolved 2xx fetch-like response whose `.json()` yields `body`. */
export function ok<T>(body: T): Promise<{ ok: true; status: number; json: () => Promise<T> }> {
    return Promise.resolve({ ok: true, status: 200, json: async () => body });
}

/** A resolved non-2xx fetch-like response (defaults to 500). */
export function fail<T>(
    status = 500,
    body?: T,
): Promise<{ ok: false; status: number; json: () => Promise<T | undefined> }> {
    return Promise.resolve({ ok: false, status, json: async () => body });
}
