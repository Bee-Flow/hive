import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/helpers', () => ({ authFetch: vi.fn() }));

import useWaveform from './useWaveform';
import { authFetch } from '../../../utils/helpers';

/**
 * Regression: the recording used to be downloaded TWICE (authFetch for peaks +
 * the bare <audio src>), and in the storage-partitioned iframe embed the bare
 * element 401'd because it cannot send the X-Session-Token header. The hook now
 * exposes the fetched bytes as a blob object URL for the <audio> element, and
 * revokes it on unmount.
 */

function fakeAudioContext() {
    const channel = new Float32Array(4800).map((_, i) => Math.sin(i / 10));
    return class FakeAudioContext {
        async decodeAudioData() {
            return { duration: 123.4, getChannelData: () => channel };
        }
        close() {}
    };
}

describe('useWaveform', () => {
    beforeEach(() => {
        vi.stubGlobal('AudioContext', fakeAudioContext());
        let n = 0;
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL: vi.fn(() => `blob:fake-${n++}`),
            revokeObjectURL: vi.fn(),
        });
        authFetch.mockReset().mockResolvedValue({
            ok: true,
            headers: { get: () => 'audio/webm' },
            arrayBuffer: async () => new ArrayBuffer(96),
        });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('exposes peaks, duration and a blob object URL from ONE download', async () => {
        const url = `/api/audio-${Date.now()}-a`;
        const { result } = renderHook(() => useWaveform(url, 32));

        await waitFor(() => expect(result.current.objectUrl).toMatch(/^blob:fake-/));
        expect(result.current.peaks).toHaveLength(32);
        expect(result.current.duration).toBe(123.4);
        expect(result.current.loading).toBe(false);
        expect(authFetch).toHaveBeenCalledTimes(1);
        const blobArg = URL.createObjectURL.mock.calls[0][0];
        expect(blobArg.type).toBe('audio/webm');
    });

    it('revokes the object URL on unmount', async () => {
        const url = `/api/audio-${Date.now()}-b`;
        const { result, unmount } = renderHook(() => useWaveform(url, 32));
        await waitFor(() => expect(result.current.objectUrl).toBeTruthy());
        const created = result.current.objectUrl;

        unmount();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith(created);
    });

    it('surfaces fetch failures as error without an object URL', async () => {
        authFetch.mockResolvedValue({ ok: false, status: 401 });
        const url = `/api/audio-${Date.now()}-c`;
        const { result } = renderHook(() => useWaveform(url, 32));

        await waitFor(() => expect(result.current.error).toBeTruthy());
        expect(String(result.current.error)).toMatch(/401/);
        expect(result.current.objectUrl).toBeNull();
    });
});
