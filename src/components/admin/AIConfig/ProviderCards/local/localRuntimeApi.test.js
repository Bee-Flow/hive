/**
 * pullModel — the SSE reader behind the model-download progress bar.
 *
 * A multi-GB download is the one long-running thing this card does, so the
 * reader has to be right about the boring parts: SSE frames split across chunk
 * boundaries, an error frame ending the download as a failure rather than a
 * silent success, and a stream that dies mid-transfer NOT reporting "done".
 *
 * Run: cd agent-hub && npx vitest run src/components/admin/AIConfig/ProviderCards/local/localRuntimeApi.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const authFetch = vi.fn();
vi.mock('../../../../../utils/helpers', () => ({
    API_BASE: '/api',
    authFetch: (...args) => authFetch(...args),
}));

const { pullModel } = await import('./localRuntimeApi');

/** Build a Response whose body streams `chunks` verbatim. */
const sseResponse = (chunks) => ({
    ok: true,
    body: {
        getReader() {
            let i = 0;
            return {
                read: async () => (i < chunks.length
                    ? { done: false, value: new TextEncoder().encode(chunks[i++]) }
                    : { done: true, value: undefined }),
            };
        },
    },
});

const frame = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

beforeEach(() => authFetch.mockReset());

describe('pullModel', () => {
    it('reports progress and resolves ok when the server says done', async () => {
        authFetch.mockResolvedValue(sseResponse([
            frame('progress', { status: 'pulling manifest' }),
            frame('progress', { status: 'downloading', completed: 250, total: 1000 }),
            frame('done', { model: 'qwen3:8b' }),
        ]));

        const seen = [];
        const result = await pullModel('ollama-1', 'qwen3:8b', p => seen.push(p));

        expect(result).toEqual({ ok: true });
        expect(seen).toEqual([
            { status: 'pulling manifest', pct: null },
            { status: 'downloading', pct: 25 },
        ]);
    });

    it('reassembles frames split across chunk boundaries', async () => {
        const whole = frame('progress', { status: 'downloading', completed: 5, total: 10 }) + frame('done', {});
        // Split at an arbitrary point inside the first frame's data line.
        authFetch.mockResolvedValue(sseResponse([whole.slice(0, 25), whole.slice(25)]));

        const seen = [];
        const result = await pullModel('ollama-1', 'qwen3:8b', p => seen.push(p));

        expect(result).toEqual({ ok: true });
        expect(seen).toEqual([{ status: 'downloading', pct: 50 }]);
    });

    it('fails on an error frame instead of reporting success', async () => {
        authFetch.mockResolvedValue(sseResponse([
            frame('progress', { status: 'pulling manifest' }),
            frame('error', { error: 'model "nope" not found' }),
        ]));

        const result = await pullModel('ollama-1', 'nope', () => {});
        expect(result).toEqual({ ok: false, error: 'model "nope" not found' });
    });

    it('does not report success when the stream ends without a done frame', async () => {
        // A dropped connection mid-download must not look like a finished pull.
        authFetch.mockResolvedValue(sseResponse([frame('progress', { status: 'downloading', completed: 1, total: 10 })]));

        const result = await pullModel('ollama-1', 'qwen3:8b', () => {});
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(/without finishing/i);
    });

    it('skips a malformed frame rather than aborting the download', async () => {
        authFetch.mockResolvedValue(sseResponse([
            'event: progress\ndata: {not json\n\n',
            frame('done', {}),
        ]));

        const result = await pullModel('ollama-1', 'qwen3:8b', () => {});
        expect(result).toEqual({ ok: true });
    });

    it('surfaces the server error when the request itself is rejected', async () => {
        authFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Provider not found' }) });

        const result = await pullModel('missing', 'qwen3:8b', () => {});
        expect(result).toEqual({ ok: false, error: 'Provider not found' });
    });

    it('returns a failure when the connection drops mid-download', async () => {
        // The progress bar is driven off the return value, so an escaping
        // rejection would leave it stuck at whatever percent the stream died
        // on, with no error shown.
        let reads = 0;
        authFetch.mockResolvedValue({
            ok: true,
            body: {
                getReader: () => ({
                    read: async () => {
                        if (reads++ === 0) {
                            return { done: false, value: new TextEncoder().encode(frame('progress', { status: 'downloading', completed: 3, total: 10 })) };
                        }
                        throw new Error('network error');
                    },
                }),
            },
        });

        const seen = [];
        const result = await pullModel('ollama-1', 'qwen3:8b', p => seen.push(p));

        expect(seen).toEqual([{ status: 'downloading', pct: 30 }]);
        expect(result).toEqual({ ok: false, error: 'network error' });
    });
});
