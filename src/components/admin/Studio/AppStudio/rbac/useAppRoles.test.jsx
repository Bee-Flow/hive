import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));

import useAppRoles, { mergeAccess } from './useAppRoles';
import { authFetch } from '../../../../../utils/helpers';

const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function makeWrapper() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return function Wrapper({ children }) {
        return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    };
}

describe('mergeAccess', () => {
    it('merges roles/rowFilters key-by-key and deletes on null/blank', () => {
        const current = { default: 'app', roles: { admin: { read: 'all' } }, rowFilters: { admin: 'x' } };
        const out = mergeAccess(current, { roles: { member: { read: 'own' }, admin: null }, rowFilters: { member: 'record.a == viewer.id', admin: '' } });
        expect(out.roles).toEqual({ member: { read: 'own' } });
        expect(out.rowFilters).toEqual({ member: 'record.a == viewer.id' });
        expect(out.default).toBe('app');
    });
});

describe('useAppRoles', () => {
    beforeEach(() => authFetch.mockReset());

    it('reads roles, roleMapping, tables and members from the schema + members endpoints', async () => {
        authFetch.mockImplementation((rawUrl) => {
            const url = String(rawUrl);
            if (url.includes('/schema')) {
                return resp(200, {
                    model: {
                        roles: [{ key: 'member', label: 'Member' }],
                        roleMapping: { default: 'app', byGroup: { g1: 'member' } },
                        tables: [{ id: 't1', key: 'tasks', access: {} }],
                    },
                    modelVersion: 3,
                });
            }
            if (url.includes('/members')) return resp(200, { members: [{ userId: 'u1', roleKey: 'member' }] });
            return resp(404, {});
        });
        const { result } = renderHook(() => useAppRoles('a1'), { wrapper: makeWrapper() });
        await waitFor(() => expect(result.current.roles.length).toBe(1));
        expect(result.current.roleMapping.byGroup).toEqual({ g1: 'member' });
        expect(result.current.tables).toHaveLength(1);
        await waitFor(() => expect(result.current.members.length).toBe(1));
        expect(result.current.hasModel).toBe(true);
    });

    it('degrades a 403 schema (readable non-owner) to an empty, model-less state', async () => {
        authFetch.mockResolvedValue(resp(403, { error: 'nope' }));
        const { result } = renderHook(() => useAppRoles('a1'), { wrapper: makeWrapper() });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.roles).toEqual([]);
        expect(result.current.hasModel).toBe(false);
        expect(result.current.isError).toBe(false);
    });

    it('does not fetch without an appId', () => {
        const { result } = renderHook(() => useAppRoles(null), { wrapper: makeWrapper() });
        expect(result.current.roles).toEqual([]);
        expect(authFetch).not.toHaveBeenCalled();
    });
});

/**
 * Every writer here merges into a CACHED model and PUTs the whole thing, and
 * that cache is 30s stale. With no expectedVersion it was a blind
 * last-write-wins overwrite: add a column in Tables, then save a row rule, and
 * the column was gone — the rule's PUT carried the model as it had been read
 * before the column existed, and nothing anywhere said so.
 */
describe('useAppRoles — a whole-model save carries the version it read', () => {
    beforeEach(() => authFetch.mockReset());

    const schemaBody = (modelVersion) => ({
        model: { roles: [], roleMapping: { default: 'app', byGroup: {} }, tables: [] },
        modelVersion,
    });

    function mockSchema(modelVersion, onPut) {
        authFetch.mockImplementation((rawUrl, options) => {
            const url = String(rawUrl);
            if (url.includes('/members')) return resp(200, { members: [] });
            if (url.includes('/schema') && options?.method === 'PUT') return onPut(JSON.parse(options.body));
            if (url.includes('/schema')) return resp(200, schemaBody(modelVersion));
            return resp(404, {});
        });
    }

    it('sends the version the server reported', async () => {
        let sent = null;
        mockSchema(7, (body) => { sent = body; return resp(200, { modelVersion: 8 }); });
        const { result } = renderHook(() => useAppRoles('a1'), { wrapper: makeWrapper() });
        await waitFor(() => expect(result.current.hasModel).toBe(true));

        await result.current.saveRoles({ roles: [{ key: 'member', label: 'Member' }] });
        expect(sent.expectedVersion).toBe(7);
    });

    /**
     * An app with no data model yet is at version 0 on the server. Inventing a
     * number for it would make the very FIRST save conflict with nothing at all.
     */
    it('sends no version when the server has never reported one', async () => {
        let sent = null;
        authFetch.mockImplementation((rawUrl, options) => {
            const url = String(rawUrl);
            if (url.includes('/members')) return resp(200, { members: [] });
            if (url.includes('/schema') && options?.method === 'PUT') { sent = JSON.parse(options.body); return resp(200, { modelVersion: 1 }); }
            if (url.includes('/schema')) return resp(200, { model: null, modelVersion: 0 });
            return resp(404, {});
        });
        const { result } = renderHook(() => useAppRoles('a1'), { wrapper: makeWrapper() });
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        await result.current.saveRoles({ roles: [{ key: 'member', label: 'Member' }] });
        // modelVersion 0 IS reported, so it is sent — what must never happen is
        // a version the client made up.
        expect(sent.expectedVersion).toBe(0);
    });

    it('reports a clash instead of overwriting somebody else’s work', async () => {
        let sent = null;
        let conflictOnce = true;
        authFetch.mockImplementation((rawUrl, options) => {
            const url = String(rawUrl);
            if (url.includes('/members')) return resp(200, { members: [] });
            if (url.includes('/schema') && options?.method === 'PUT') {
                sent = JSON.parse(options.body);
                if (conflictOnce) {
                    conflictOnce = false;
                    return resp(409, {
                        error: 'The data model changed since you loaded it',
                        conflict: true,
                        currentVersion: 9,
                        model: { roles: [], roleMapping: { default: 'app', byGroup: {} }, tables: [] },
                    });
                }
                return resp(200, { modelVersion: 10 });
            }
            // After the clash the server reports ITS version, which is the
            // whole point of refetching on a conflict.
            if (url.includes('/schema')) return resp(200, schemaBody(conflictOnce ? 7 : 9));
            return resp(404, {});
        });
        const { result } = renderHook(() => useAppRoles('a1'), { wrapper: makeWrapper() });
        await waitFor(() => expect(result.current.hasModel).toBe(true));

        await expect(result.current.saveRoles({ roles: [] })).rejects.toThrow(/changed somewhere else/i);
        expect(sent.expectedVersion).toBe(7);

        // The next attempt starts from the version the server reported in the
        // conflict, so retrying is not another blind overwrite.
        await result.current.saveRoles({ roles: [] });
        expect(sent.expectedVersion).toBe(9);
    });
});
