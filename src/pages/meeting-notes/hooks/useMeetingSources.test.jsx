import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn() }));

import useMeetingSources from './useMeetingSources';
import { authFetch } from '../../../utils/helpers';

const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/**
 * Route the two probed endpoints to separate responses. Unknown URLs get a
 * benign 404 instead of a rejection: a rejected promise from a stray call
 * (e.g. leftovers from a previous file on a reused worker) would surface as
 * an unhandled rejection attributed to whatever test is running.
 */
function mockEndpoints({ talk, gmeet }) {
    authFetch.mockImplementation((url) => {
        if (String(url).includes('/api/talk-notes-settings/user/me')) return Promise.resolve(talk);
        if (String(url).includes('/api/gmeet-notes-settings/user/me')) return Promise.resolve(gmeet);
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    });
}

describe('useMeetingSources', () => {
    beforeEach(() => authFetch.mockReset());

    it('reports both sources when Talk is connected and Google is connected', async () => {
        mockEndpoints({
            talk: resp(200, { nextcloudConnected: true }),
            gmeet: resp(200, { connection: { googleConnected: true }, autoImport: true }),
        });
        const { result } = renderHook(() => useMeetingSources());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.talk).toBe(true);
        expect(result.current.gmeet).toBe(true);
    });

    it('the Outlook/Teams org: neither source available', async () => {
        mockEndpoints({
            talk: resp(200, { nextcloudConnected: false }),
            gmeet: resp(200, { connection: { googleConnected: false } }),
        });
        const { result } = renderHook(() => useMeetingSources());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.talk).toBe(false);
        expect(result.current.gmeet).toBe(false);
    });

    it('unlicensed (403) and errored endpoints count as unavailable', async () => {
        mockEndpoints({
            talk: resp(403, {}),
            gmeet: { ok: true, status: 200, json: async () => { throw new Error('bad json'); } },
        });
        const { result } = renderHook(() => useMeetingSources());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.talk).toBe(false);
        expect(result.current.gmeet).toBe(false);
    });

    it('one available source is enough to report it', async () => {
        mockEndpoints({
            talk: resp(200, { nextcloudConnected: false }),
            gmeet: resp(200, { connection: { googleConnected: true, meetScopesGranted: false } }),
        });
        const { result } = renderHook(() => useMeetingSources());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.talk).toBe(false);
        expect(result.current.gmeet).toBe(true);
    });
});
