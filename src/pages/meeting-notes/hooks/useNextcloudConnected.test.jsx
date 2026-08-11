import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));

import useNextcloudConnected from './useNextcloudConnected';
import { authFetch } from '../../../utils/helpers';

const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('useNextcloudConnected', () => {
    beforeEach(() => authFetch.mockReset());

    it('reports connected when the endpoint says so', async () => {
        authFetch.mockResolvedValue(resp(200, { nextcloudConnected: true }));
        const { result } = renderHook(() => useNextcloudConnected(true));
        await waitFor(() => expect(result.current.connected).toBe(true));
        expect(result.current.loading).toBe(false);
        expect(authFetch).toHaveBeenCalledWith(expect.stringContaining('/api/talk-notes-settings/user/me'));
    });

    it('reports NOT connected when the endpoint says so', async () => {
        authFetch.mockResolvedValue(resp(200, { nextcloudConnected: false }));
        const { result } = renderHook(() => useNextcloudConnected(true));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.connected).toBe(false);
    });

    it('treats an unlicensed account (403) as not connected', async () => {
        authFetch.mockResolvedValue(resp(403, {}));
        const { result } = renderHook(() => useNextcloudConnected(true));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.connected).toBe(false);
    });

    it('swallows a failed/malformed response as not connected (catch path)', async () => {
        // ok response whose body fails to parse → exercises the hook's catch.
        authFetch.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } });
        const { result } = renderHook(() => useNextcloudConnected(true));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.connected).toBe(false);
    });

    it('does not probe until enabled', () => {
        const { result } = renderHook(() => useNextcloudConnected(false));
        expect(authFetch).not.toHaveBeenCalled();
        expect(result.current.connected).toBe(false);
        expect(result.current.loading).toBe(false);
    });

    it('probes once when enabled flips true, then not again', async () => {
        authFetch.mockResolvedValue(resp(200, { nextcloudConnected: true }));
        const { result, rerender } = renderHook(({ on }) => useNextcloudConnected(on), {
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
