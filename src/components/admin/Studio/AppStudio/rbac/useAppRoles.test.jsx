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
