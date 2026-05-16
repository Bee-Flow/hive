// Centralised API client. Wraps `authFetch` with:
//   - method helpers (get/post/patch/delete)
//   - automatic JSON serialisation / parsing
//   - URLSearchParams build-out for `query`
//   - propagation of an `AbortSignal` (React Query provides one per query)
//   - exponential-backoff retry for network/5xx (callers can override)
//   - a single throw site (`ApiError`) carrying status + parsed body
//
// Domain hooks (see /api/queries/) should consume `apiClient` rather than
// reaching for `authFetch` directly. The old direct-fetch call sites can
// migrate file-by-file.

import { API_BASE, authFetch } from '../utils/helpers';

export interface ApiErrorInit {
    status?: number;
    body?: unknown;
}

export class ApiError extends Error {
    status?: number;
    body?: unknown;
    constructor(message: string, { status, body }: ApiErrorInit = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.body = body;
    }
}

export interface RetryOptions {
    attempts: number;
    base: number;
}

export type QueryParams =
    | URLSearchParams
    | Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
    signal?: AbortSignal;
    /** URL search params, accepts plain object or URLSearchParams. */
    query?: QueryParams;
    /** Additional headers; Content-Type is set automatically when body is JSON. */
    headers?: Record<string, string>;
    /**
     * Retry behaviour. `false` disables retries. Partial objects merge into
     * the default { attempts: 2, base: 250 }.
     */
    retry?: false | Partial<RetryOptions>;
}

const DEFAULT_RETRY: RetryOptions = {
    attempts: 2,
    base: 250,
};

function buildUrl(path: string, query?: QueryParams): string {
    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
    if (!query) return url;
    const entries: Array<[string, string]> = [];
    if (query instanceof URLSearchParams) {
        query.forEach((v, k) => entries.push([k, v]));
    } else {
        for (const [k, v] of Object.entries(query)) {
            if (v === undefined || v === null) continue;
            entries.push([k, String(v)]);
        }
    }
    if (entries.length === 0) return url;
    const qs = new URLSearchParams(entries).toString();
    return `${url}${url.includes('?') ? '&' : '?'}${qs}`;
}

interface AttemptOptions extends RequestOptions {
    body?: unknown;
}

async function attempt<T>(method: string, path: string, opts: AttemptOptions = {}): Promise<T | null> {
    const { signal, body, query, headers } = opts;
    const url = buildUrl(path, query);
    const init: RequestInit = { method, signal };
    if (body !== undefined && body !== null) {
        init.headers = { 'Content-Type': 'application/json', ...(headers || {}) };
        init.body = JSON.stringify(body);
    } else if (headers) {
        init.headers = headers;
    }
    const res: Response = await authFetch(url, init);
    if (!res.ok) {
        let parsed: any = null;
        try { parsed = await res.json(); } catch { /* not JSON */ }
        throw new ApiError(parsed?.error || `HTTP ${res.status}`, { status: res.status, body: parsed });
    }
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json() as Promise<T>;
    return (await res.text()) as unknown as T;
}

async function request<T>(method: string, path: string, opts: AttemptOptions = {}): Promise<T | null> {
    const retry: RetryOptions | null =
        opts.retry === false ? null : { ...DEFAULT_RETRY, ...(opts.retry || {}) };
    let lastErr: unknown;
    for (let i = 0; i <= (retry ? retry.attempts : 0); i++) {
        try {
            return await attempt<T>(method, path, opts);
        } catch (e) {
            // Don't retry user-cancelled or 4xx (except 408/429).
            if ((e as Error)?.name === 'AbortError') throw e;
            if (e instanceof ApiError && e.status && e.status < 500 && e.status !== 408 && e.status !== 429) throw e;
            lastErr = e;
            if (!retry || i === retry.attempts) break;
            const delay = retry.base * 2 ** i;
            await new Promise((r) => setTimeout(r, delay));
        }
    }
    throw lastErr;
}

export interface ApiClient {
    get<T = unknown>(path: string, opts?: RequestOptions): Promise<T | null>;
    post<T = unknown>(path: string, body?: unknown, opts?: RequestOptions): Promise<T | null>;
    patch<T = unknown>(path: string, body?: unknown, opts?: RequestOptions): Promise<T | null>;
    put<T = unknown>(path: string, body?: unknown, opts?: RequestOptions): Promise<T | null>;
    delete<T = unknown>(path: string, opts?: RequestOptions): Promise<T | null>;
}

export const apiClient: ApiClient = {
    get: (path, opts) => request(`GET`, path, opts),
    post: (path, body, opts = {}) => request('POST', path, { ...opts, body }),
    patch: (path, body, opts = {}) => request('PATCH', path, { ...opts, body }),
    put: (path, body, opts = {}) => request('PUT', path, { ...opts, body }),
    delete: (path, opts) => request('DELETE', path, opts),
};

export default apiClient;
