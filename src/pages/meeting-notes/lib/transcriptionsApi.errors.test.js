/**
 * What the user is told when an upload is refused.
 *
 * A 413 is normally produced by the reverse proxy, not the API, so the
 * response has no JSON body — the error panel showed "HTTP 413" and nothing
 * else: no cause, no way forward, and a "Retry" button that could only fail
 * the same way.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/helpers', () => ({ API_BASE: '', authFetch: vi.fn(), isDemoMode: () => false }));

import { authFetch } from '../../../utils/helpers';
import { uploadAudio, getTranscription } from './transcriptionsApi';

/** A proxy rejection: HTML body, so `res.json()` throws. */
const proxyRejection = (status) => ({
    ok: false,
    status,
    json: async () => { throw new SyntaxError('Unexpected token < in JSON'); },
});

const apiError = (status, body) => ({ ok: false, status, json: async () => body });

const upload = () => uploadAudio({ file: new File(['x'], 'recording.webm'), language: 'nl', title: 'Meeting' });

describe('upload errors', () => {
    beforeEach(() => vi.clearAllMocks());

    it('explains a bodyless 413 instead of surfacing "HTTP 413"', async () => {
        authFetch.mockResolvedValue(proxyRejection(413));
        const err = await upload().catch((e) => e);
        expect(err.status).toBe(413);
        expect(err.code).toBe('payload_too_large');
        expect(err.message).not.toBe('HTTP 413');
        expect(err.message).toMatch(/too large/i);
        // Both ways out: shorten the recording, or have the limit raised.
        expect(err.message).toMatch(/shorter/i);
        expect(err.message).toMatch(/administrator/i);
    });

    it('prefers the API\'s own 413 message over the generic one', async () => {
        authFetch.mockResolvedValue(apiError(413, { error: 'File too large. Maximum size is 500 MB.', code: 'recording_too_large' }));
        const err = await upload().catch((e) => e);
        expect(err.message).toBe('File too large. Maximum size is 500 MB.');
        expect(err.code).toBe('recording_too_large');
    });

    it('leaves other bodyless failures alone', async () => {
        authFetch.mockResolvedValue(proxyRejection(502));
        const err = await getTranscription('m1').catch((e) => e);
        expect(err.message).toBe('HTTP 502');
        expect(err.code).toBeUndefined();
    });
});
