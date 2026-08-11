import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));

import useGoogleMeetConnected from './useGoogleMeetConnected';
import { authFetch } from '../../../utils/helpers';

const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('useGoogleMeetConnected', () => {
    beforeEach(() => authFetch.mockReset());

    it('reports connected when Google is connected with Meet scopes', async () => {
        authFetch.mockResolvedValue(resp(200, { connection: { googleConnected: true, meetScopesGranted: true } }));
        const { result } = renderHook(() => useGoogleMeetConnected(true));
        await waitFor(() => expect(result.current.connected).toBe(true));
        expect(result.current.needsReconsent).toBe(false);
        expect(result.current.loading).toBe(false);
        expect(authFetch).toHaveBeenCalledWith(expect.stringContaining('/api/gmeet-notes-settings/user/me'));
    });

    it('reports needsReconsent when connected without Meet scopes', async () => {
        authFetch.mockResolvedValue(resp(200, { connection: { googleConnected: true, meetScopesGranted: false } }));
        const { result } = renderHook(() => useGoogleMeetConnected(true));
        await waitFor(() => expect(result.current.needsReconsent).toBe(true));
        expect(result.current.connected).toBe(false);
    });

    it('reports neither when Google is not connected', async () => {
        authFetch.mockResolvedValue(resp(200, { connection: { googleConnected: false, meetScopesGranted: false } }));
        const { result } = renderHook(() => useGoogleMeetConnected(true));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.connected).toBe(false);
        expect(result.current.needsReconsent).toBe(false);
    });

    it('treats an unlicensed account (403) as hidden', async () => {
        authFetch.mockResolvedValue(resp(403, {}));
        const { result } = renderHook(() => useGoogleMeetConnected(true));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.connected).toBe(false);
        expect(result.current.needsReconsent).toBe(false);
    });

    it('tolerates a response without a connection block', async () => {
        authFetch.mockResolvedValue(resp(200, { autoImport: false }));
        const { result } = renderHook(() => useGoogleMeetConnected(true));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.connected).toBe(false);
        expect(result.current.needsReconsent).toBe(false);
    });

    it('swallows a failed/malformed response as hidden (catch path)', async () => {
        // ok response whose body fails to parse → exercises the hook's catch.
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } });
        const { result } = renderHook(() => useGoogleMeetConnected(true));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.connected).toBe(false);
    });

    it('does not probe until enabled', () => {
        const { result } = renderHook(() => useGoogleMeetConnected(false));
        expect(authFetch).not.toHaveBeenCalled();
        expect(result.current.connected).toBe(false);
        expect(result.current.loading).toBe(false);
    });

    it('probes once when enabled flips true, then not again', async () => {
        authFetch.mockResolvedValue(resp(200, { connection: { googleConnected: true, meetScopesGranted: true } }));
        const { result, rerender } = renderHook(({ on }) => useGoogleMeetConnected(on), {
            initialProps: { on: false },
        });
        expect(authFetch).not.toHaveBeenCalled();

        rerender({ on: true });
        await waitFor(() => expect(result.current.connected).toBe(true));
        expect(authFetch).toHaveBeenCalledTimes(1);

        // Toggling off/on again must not re-probe (result is cached).
        rerender({ on: false });
        rerender({ on: true });
        expect(authFetch).toHaveBeenCalledTimes(1);
    });
});
