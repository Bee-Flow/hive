import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';
import { AppEditorProvider, useAppEditor, mockUserForRole } from './AppEditorContext';

const app = {
    definition: {
        schemaVersion: 2,
        homeScreenId: 'scr_a',
        screens: [{ id: 'scr_a', name: 'A', sections: [{ id: 'sec_a', children: [] }] }],
        actions: {},
    },
    definitionVersion: 7,
};

function wrapper({ children }) {
    return <AppEditorProvider app={app}>{children}</AppEditorProvider>;
}

describe('AppEditorContext — previewRole reducer', () => {
    it('defaults previewRole/previewUser to null', () => {
        const { result } = renderHook(() => useAppEditor(), { wrapper });
        expect(result.current.previewRole).toBeNull();
        expect(result.current.previewUser).toBeNull();
    });

    it('keeps the fixed version seed (definitionVersion) so autosave never sends null', () => {
        const { result } = renderHook(() => useAppEditor(), { wrapper });
        expect(result.current.version).toBe(7);
    });

    it('set_preview_role adopts the role and a matching mock viewer', () => {
        const { result } = renderHook(() => useAppEditor(), { wrapper });
        act(() => result.current.dispatch({ type: 'set_preview_role', role: 'member' }));
        expect(result.current.previewRole).toBe('member');
        expect(result.current.previewUser).toMatchObject({ role: 'member', roles: ['member'] });
    });

    it('accepts an explicit preview user override', () => {
        const { result } = renderHook(() => useAppEditor(), { wrapper });
        const user = { id: 'u9', role: 'member', name: 'Real Person' };
        act(() => result.current.dispatch({ type: 'set_preview_role', role: 'member', user }));
        expect(result.current.previewUser).toBe(user);
    });

    it('clears back to owner/full view on a falsy or owner role', () => {
        const { result } = renderHook(() => useAppEditor(), { wrapper });
        act(() => result.current.dispatch({ type: 'set_preview_role', role: 'admin' }));
        expect(result.current.previewRole).toBe('admin');
        act(() => result.current.dispatch({ type: 'set_preview_role', role: 'owner' }));
        expect(result.current.previewRole).toBeNull();
        expect(result.current.previewUser).toBeNull();
        act(() => result.current.dispatch({ type: 'set_preview_role', role: 'admin' }));
        act(() => result.current.dispatch({ type: 'set_preview_role', role: null }));
        expect(result.current.previewRole).toBeNull();
    });
});

describe('AppEditorContext — recently-added pulse', () => {
    it('clear_recent_id drops one id and leaves the others pulsing', () => {
        const { result } = renderHook(() => useAppEditor(), { wrapper });
        act(() => result.current.dispatch({ type: 'set_recent_ids', ids: ['cmp_a', 'cmp_b', 'cmp_c'] }));
        act(() => result.current.dispatch({ type: 'clear_recent_id', nodeId: 'cmp_a' }));
        expect([...result.current.recentlyAddedIds]).toEqual(['cmp_b', 'cmp_c']);
        act(() => result.current.dispatch({ type: 'clear_recent_id', nodeId: 'cmp_b' }));
        // cmp_a must NOT come back — the second clear works off the live set.
        expect([...result.current.recentlyAddedIds]).toEqual(['cmp_c']);
    });

    it('is a no-op (same state) for an id that is not pulsing', () => {
        const { result } = renderHook(() => useAppEditor(), { wrapper });
        act(() => result.current.dispatch({ type: 'set_recent_ids', ids: ['cmp_a'] }));
        const before = result.current.recentlyAddedIds;
        act(() => result.current.dispatch({ type: 'clear_recent_id', nodeId: 'cmp_zz' }));
        expect(result.current.recentlyAddedIds).toBe(before);
    });
});

describe('mockUserForRole', () => {
    it('builds a deterministic mock user for a role', () => {
        expect(mockUserForRole('member')).toMatchObject({ id: 'preview-member', role: 'member', preview: true });
    });
    it('returns null for owner/blank', () => {
        expect(mockUserForRole('owner')).toBeNull();
        expect(mockUserForRole('')).toBeNull();
    });
});
