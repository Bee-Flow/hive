import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';

// Only the network call is stubbed; keep API_BASE etc.
vi.mock('@/utils/helpers', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, authFetch: vi.fn() };
});

import { authFetch } from '@/utils/helpers';
import AppDataScope, { collectDataBindings } from './AppDataScope';
import { dataCacheKey } from './resolveBinding';

// A screen with a records grid, a second records binding on the SAME table (must
// dedupe), and a dataset — nested inside a container.
const DEF = {
    screens: [{
        id: 's1',
        sections: [{
            id: 'sec1',
            children: [
                { id: 'g1', type: 'data_grid', props: { source: { kind: 'records', tableId: 'tbl_a' } } },
                {
                    id: 'card1', type: 'card', children: [
                        { id: 'c1', type: 'chart', props: { source: { kind: 'records', tableId: 'tbl_a' } } },
                        { id: 's2', type: 'stat', props: { value: { kind: 'dataset', datasetId: 'ds1' } } },
                    ],
                },
            ],
        }],
    }],
};

function makeClient() {
    return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('collectDataBindings', () => {
    it('deep-scans the screen and dedupes by cache key', () => {
        const found = collectDataBindings(DEF, 's1');
        const keys = found.map((b) => b.cacheKey).sort();
        expect(keys).toEqual([dataCacheKey({ kind: 'dataset', datasetId: 'ds1' }), dataCacheKey({ kind: 'records', tableId: 'tbl_a' })].sort());
        // The two tbl_a bindings collapsed to one fetch.
        expect(found.filter((b) => b.cacheKey.startsWith('records:tbl_a')).length).toBe(1);
    });

    it('returns [] for a definition with no data bindings', () => {
        expect(collectDataBindings({ screens: [{ id: 's', sections: [{ id: 'x', children: [{ id: 'h', type: 'heading', props: { text: 'Hi' } }] }] }] }, 's')).toEqual([]);
    });
});

describe('AppDataScope — sampled fetching', () => {
    it('fetches records in sample mode and resolves dataState', async () => {
        authFetch.mockImplementation((url) => {
            if (String(url).includes('/data/query')) {
                return Promise.resolve({ ok: true, status: 200, json: async () => ({ result: [{ id: 'd1' }] }) });
            }
            return Promise.resolve({ ok: true, status: 200, json: async () => ({ records: [{ id: 'r1' }] }) });
        });

        let latest = null;
        render(
            <QueryClientProvider client={makeClient()}>
                <AppDataScope appId="app-1" definition={DEF} screenId="s1" sample>
                    {(dataState) => { latest = dataState; return null; }}
                </AppDataScope>
            </QueryClientProvider>,
        );

        const recordsKey = dataCacheKey({ kind: 'records', tableId: 'tbl_a' });
        await waitFor(() => {
            expect(latest[recordsKey]?.status).toBe('success');
        });
        expect(latest[recordsKey].result).toEqual([{ id: 'r1' }]);

        // The records fetch was a capped SAMPLE (edit mode).
        const recordsCall = authFetch.mock.calls.find(([u]) => String(u).includes('/data/tables/tbl_a/records'));
        expect(recordsCall).toBeTruthy();
        expect(String(recordsCall[0])).toContain('sample=1');
        expect(String(recordsCall[0])).toContain('limit=50');
    });

    it('fetches LIVE (no sample flag) when sample is false', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ records: [] }) });
        render(
            <QueryClientProvider client={makeClient()}>
                <AppDataScope appId="app-1" definition={DEF} screenId="s1" sample={false}>
                    {() => null}
                </AppDataScope>
            </QueryClientProvider>,
        );
        await waitFor(() => {
            expect(authFetch.mock.calls.some(([u]) => String(u).includes('/data/tables/tbl_a/records'))).toBe(true);
        });
        const recordsCall = authFetch.mock.calls.find(([u]) => String(u).includes('/data/tables/tbl_a/records'));
        expect(String(recordsCall[0])).not.toContain('sample=1');
    });

    it('render-prop second arg exposes refresh() — invalidates the app-scoped data query keys', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ records: [{ id: 'r1' }] }) });
        const client = makeClient();
        const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
        let controls = null;
        render(
            <QueryClientProvider client={client}>
                <AppDataScope appId="app-1" definition={DEF} screenId="s1" sample={false}>
                    {(dataState, c) => { controls = c; return null; }}
                </AppDataScope>
            </QueryClientProvider>,
        );
        await waitFor(() => expect(authFetch).toHaveBeenCalled());
        expect(typeof controls.refresh).toBe('function');

        await act(async () => { await controls.refresh(); });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['studio-app-data', 'app-1'] });
    });

    it('refresh({tableId}) narrows to just that table', async () => {
        // Reloading every binding because one record changed is what makes a
        // polling screen flicker.
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ records: [] }) });
        const client = makeClient();
        const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
        let controls = null;
        render(
            <QueryClientProvider client={client}>
                <AppDataScope appId="app-1" definition={DEF} screenId="s1" sample={false}>
                    {(dataState, c) => { controls = c; return null; }}
                </AppDataScope>
            </QueryClientProvider>,
        );
        await waitFor(() => expect(authFetch).toHaveBeenCalled());

        await act(async () => { await controls.refresh({ tableId: 'tbl_a' }); });
        const call = invalidate.mock.calls.at(-1)[0];
        expect(call.queryKey).toEqual(['studio-app-data', 'app-1']);
        expect(typeof call.predicate).toBe('function');

        const matches = (key) => call.predicate({ queryKey: ['studio-app-data', 'app-1', 'live', key] });
        expect(matches('records:tbl_a:abc')).toBe(true);
        expect(matches('record:tbl_a:abc')).toBe(true);
        expect(matches('records:tbl_b:abc')).toBe(false);
        expect(matches('dataset:ds_1')).toBe(false);
        expect(matches(undefined)).toBe(false);
    });

    it('refresh({datasetId}) matches the dataset key exactly', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ records: [] }) });
        const client = makeClient();
        const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
        let controls = null;
        render(
            <QueryClientProvider client={client}>
                <AppDataScope appId="app-1" definition={DEF} screenId="s1" sample={false}>
                    {(dataState, c) => { controls = c; return null; }}
                </AppDataScope>
            </QueryClientProvider>,
        );
        await waitFor(() => expect(authFetch).toHaveBeenCalled());

        await act(async () => { await controls.refresh({ datasetId: 'ds_1' }); });
        const { predicate } = invalidate.mock.calls.at(-1)[0];
        expect(predicate({ queryKey: ['studio-app-data', 'app-1', 'live', 'dataset:ds_1'] })).toBe(true);
        expect(predicate({ queryKey: ['studio-app-data', 'app-1', 'live', 'dataset:ds_2'] })).toBe(false);
        expect(predicate({ queryKey: ['studio-app-data', 'app-1', 'live', 'records:tbl_a:x'] })).toBe(false);
    });

    it('does not fetch when the screen has no data bindings', async () => {
        render(
            <QueryClientProvider client={makeClient()}>
                <AppDataScope appId="app-1" definition={{ screens: [{ id: 's', sections: [{ id: 'x', children: [] }] }] }} screenId="s" sample>
                    {() => null}
                </AppDataScope>
            </QueryClientProvider>,
        );
        await Promise.resolve();
        expect(authFetch).not.toHaveBeenCalled();
    });
});

describe('AppDataScope — the store follows the mounted bindings', () => {
    // s1 has the DEF bindings; s2 has none, so leaving s1 unmounts its fetchers.
    const TWO_SCREENS = { screens: [DEF.screens[0], { id: 's2', sections: [{ id: 'sec2', children: [] }] }] };

    it('evicts a binding entry when its fetcher unmounts (no unbounded growth)', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ records: [{ id: 'r1' }] }) });
        let latest = null;
        const tree = (screenId) => (
            <QueryClientProvider client={client}>
                <AppDataScope appId="app-1" definition={TWO_SCREENS} screenId={screenId} sample={false}>
                    {(dataState) => { latest = dataState; return null; }}
                </AppDataScope>
            </QueryClientProvider>
        );
        const client = makeClient();
        const recordsKey = dataCacheKey({ kind: 'records', tableId: 'tbl_a' });
        const { rerender } = render(tree('s1'));
        await waitFor(() => expect(latest[recordsKey]?.status).toBe('success'));

        rerender(tree('s2'));
        await waitFor(() => expect(Object.keys(latest)).toEqual([]));
    });
});

describe('AppDataScope — the fetch scope describes the same screen the renderer does', () => {
    const NAMED_DEF = {
        homeScreenId: 'scr_tick',
        screens: [{
            id: 'scr_tick',
            name: 'Tickets',
            sections: [{
                id: 'sec1',
                children: [{
                    id: 'g1',
                    type: 'data_grid',
                    props: {
                        source: {
                            kind: 'records',
                            tableId: 'tbl_t',
                            filter: [{ field: 'board', op: 'eq', value: { kind: 'formula', expr: 'screen.name' } }],
                        },
                    },
                }],
            }],
        }],
    };

    it('resolves a screen.name filter even though the caller scope carries only the id', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ records: [] }) });
        render(
            <QueryClientProvider client={makeClient()}>
                <AppDataScope
                    appId="app-1"
                    definition={NAMED_DEF}
                    screenId="scr_tick"
                    sample={false}
                    scope={{ screen: { id: 'scr_tick', params: {} } }}
                >
                    {() => null}
                </AppDataScope>
            </QueryClientProvider>,
        );
        await waitFor(() => expect(authFetch).toHaveBeenCalled());
        const url = decodeURIComponent(String(authFetch.mock.calls[0][0]));
        expect(url).toContain('"value":"Tickets"');
        expect(url).not.toContain('formula');
    });
});

describe('AppDataScope — dynamic binding filters (scope prop)', () => {
    // A grid filtered by the viewer (formula) AND a literal status.
    const DYN_DEF = {
        screens: [{
            id: 's1',
            sections: [{
                id: 'sec1',
                children: [{
                    id: 'g1',
                    type: 'data_grid',
                    props: {
                        source: {
                            kind: 'records',
                            tableId: 'tbl_t',
                            filter: [
                                { field: 'owner_id', op: 'eq', value: { kind: 'formula', expr: 'currentUser.id' } },
                                { field: 'status', op: 'eq', value: 'open' },
                            ],
                        },
                    },
                }],
            }],
        }],
    };

    const recordsUrl = () => authFetch.mock.calls
        .map(([u]) => String(u))
        .filter((u) => u.includes('/data/tables/tbl_t/records'));

    it('resolves formula filter values against the scope — the request carries only literals', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ records: [] }) });
        render(
            <QueryClientProvider client={makeClient()}>
                <AppDataScope
                    appId="app-1"
                    definition={DYN_DEF}
                    screenId="s1"
                    sample={false}
                    scope={{ currentUser: { id: 'u-1' } }}
                >
                    {() => null}
                </AppDataScope>
            </QueryClientProvider>,
        );
        await waitFor(() => expect(recordsUrl().length).toBe(1));
        const url = decodeURIComponent(recordsUrl()[0]);
        expect(url).toContain('"field":"owner_id"');
        expect(url).toContain('"value":"u-1"');
        expect(url).toContain('"value":"open"');
        expect(url).not.toContain('formula');
    });

    it('REFETCHES when the scope changes the resolved value (new cache key)', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ records: [] }) });
        const client = makeClient();
        const scopeFor = (id) => ({ currentUser: { id } });
        const tree = (scope) => (
            <QueryClientProvider client={client}>
                <AppDataScope appId="app-1" definition={DYN_DEF} screenId="s1" sample={false} scope={scope}>
                    {() => null}
                </AppDataScope>
            </QueryClientProvider>
        );
        const { rerender } = render(tree(scopeFor('u-1')));
        await waitFor(() => expect(recordsUrl().length).toBe(1));

        rerender(tree(scopeFor('u-2')));
        await waitFor(() => expect(recordsUrl().length).toBe(2));
        expect(decodeURIComponent(recordsUrl()[1])).toContain('"value":"u-2"');
    });

    it('omits a filter entry whose formula resolves to undefined (no scope value)', async () => {
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ records: [] }) });
        render(
            <QueryClientProvider client={makeClient()}>
                <AppDataScope appId="app-1" definition={DYN_DEF} screenId="s1" sample={false} scope={{}}>
                    {() => null}
                </AppDataScope>
            </QueryClientProvider>,
        );
        await waitFor(() => expect(recordsUrl().length).toBe(1));
        const url = decodeURIComponent(recordsUrl()[0]);
        expect(url).not.toContain('owner_id');
        expect(url).toContain('"value":"open"');
    });
});
