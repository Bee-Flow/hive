import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import useAppDataSource, { MIN_REFRESH_MS } from './useAppDataSource';
import { DataProvider } from './DataContext';

/**
 * Auto-refresh is the difference between "an inbox" and "a report you reload by
 * hand". These tests pin the three rules that make it safe rather than a
 * self-inflicted denial of service.
 */

vi.mock('../../../../../utils/helpers', () => ({
    API_BASE: '',
    authFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ records: [] }) })),
}));

// Capture what useQuery was actually configured with — the interesting part is
// the options, not the network.
const observed = [];
vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual('@tanstack/react-query');
    return {
        ...actual,
        useQuery: (opts) => {
            observed.push(opts);
            return { data: undefined, isError: false, isSuccess: false, error: null };
        },
    };
});

function wrapper({ children }) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return (
        <QueryClientProvider client={client}>
            <DataProvider appId="app_1">{children}</DataProvider>
        </QueryClientProvider>
    );
}

const BINDING = { kind: 'records', tableId: 'tbl_msgs' };

function optionsFor(hookProps) {
    observed.length = 0;
    renderHook(() => useAppDataSource(BINDING, hookProps), { wrapper });
    return observed[observed.length - 1];
}

describe('useAppDataSource — background refresh', () => {
    beforeEach(() => { observed.length = 0; });

    it('does not poll by default', () => {
        expect(optionsFor({}).refetchInterval).toBe(false);
    });

    it('polls at the requested interval', () => {
        const opts = optionsFor({ refreshMs: 30_000 });
        expect(opts.refetchInterval).toBe(30_000);
    });

    it('refuses an interval below the floor', () => {
        // Below MIN_REFRESH_MS a screen would spend the whole 60/min read budget
        // on polling and throttle the viewer's own clicks.
        expect(optionsFor({ refreshMs: MIN_REFRESH_MS - 1 }).refetchInterval).toBe(false);
        expect(optionsFor({ refreshMs: MIN_REFRESH_MS }).refetchInterval).toBe(MIN_REFRESH_MS);
    });

    it('never polls in the editor', () => {
        expect(optionsFor({ sample: true, refreshMs: 30_000 }).refetchInterval).toBe(false);
    });

    it('keeps staleTime under the interval', () => {
        // Otherwise the tick fires against still-fresh cache and refetchInterval
        // is silently a no-op — the failure mode that looks like "polling is on
        // but nothing updates".
        const opts = optionsFor({ refreshMs: 15_000 });
        expect(opts.staleTime).toBeLessThan(15_000);
    });

    it('leaves staleTime alone when polling is off', () => {
        expect(optionsFor({}).staleTime).toBe(30_000);
    });

    it('pauses while the tab is hidden', () => {
        expect(optionsFor({ refreshMs: 30_000 }).refetchIntervalInBackground).toBe(false);
    });
});
