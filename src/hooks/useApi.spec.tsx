import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useApi from './useApi';

vi.mock('../api/client', () => ({
    apiClient: {
        get: vi.fn(async (path: string, opts?: any) => {
            // Echo the path + params so tests can assert against them.
            return { path, query: opts?.query ?? null };
        }),
    },
}));

import { apiClient } from '../api/client';

function withClient(children: React.ReactNode) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function Probe({ path, params, onResolved }: any) {
    const q = useApi<any>(path, { params });
    React.useEffect(() => {
        if (q.data) onResolved(q.data);
    }, [q.data, onResolved]);
    return null;
}

describe('useApi', () => {
    beforeEach(() => {
        (apiClient.get as any).mockClear();
    });

    it('fetches the path via apiClient.get and exposes the result', async () => {
        let data: any;
        render(withClient(<Probe path="/api/x" onResolved={(d: any) => { data = d; }} />));
        await waitFor(() => expect(data).toBeDefined());
        expect(data.path).toBe('/api/x');
        expect(apiClient.get).toHaveBeenCalledWith('/api/x', expect.objectContaining({ query: undefined }));
    });

    it('passes params as the query option and skips undefined/null entries in the cache key', async () => {
        let data: any;
        render(
            withClient(
                <Probe
                    path="/api/x"
                    params={{ a: 1, b: 'hi', c: undefined, d: null }}
                    onResolved={(d: any) => { data = d; }}
                />,
            ),
        );
        await waitFor(() => expect(data).toBeDefined());
        expect(apiClient.get).toHaveBeenCalledWith(
            '/api/x',
            expect.objectContaining({ query: { a: 1, b: 'hi', c: undefined, d: null } }),
        );
    });
});
