/**
 * Stream-integrity regressions for the chat reader.
 *
 * All of these reproduce the same user-visible bug, first seen in the Nextcloud
 * embed: the assistant bubble finalises EMPTY, carrying the hover action row and
 * no error anywhere on screen. That state is reachable only from sendMessage's
 * success path (a 2xx whose body yields no usable events), which used to run
 * unconditionally — so a truncated, mis-framed or policy-blocked stream was
 * indistinguishable from a completed answer.
 *
 * The invariant these tests pin: a turn NEVER ends silently. Either real content
 * arrived, or the user is told what happened.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useChatEngine from './useChatEngine';
import { authFetch } from '../utils/helpers';

vi.mock('../utils/helpers', () => ({
    API_BASE: '',
    authFetch: vi.fn(),
    generateMessageId: () => Math.random().toString(36).slice(2),
    getSessionToken: () => null,
    setSessionToken: () => {},
    isNextcloudEmbed: () => false,
}));

// i18n: return the key so assertions can match on it without pinning copy.
vi.mock('./useTranslation', () => ({
    default: () => ({ t: (k, vars) => (vars ? `${k}` : k) }),
    useTranslation: () => ({ t: (k, vars) => (vars ? `${k}` : k) }),
}));

/** A Response whose body streams `chunks` (strings) then ends. */
const streamResponse = (chunks, { status = 200 } = {}) => {
    const encoded = chunks.map((c) => new TextEncoder().encode(c));
    let i = 0;
    return {
        ok: status >= 200 && status < 300,
        status,
        body: {
            getReader: () => ({
                read: () => (i < encoded.length
                    ? Promise.resolve({ done: false, value: encoded[i++] })
                    : Promise.resolve({ done: true, value: undefined })),
                cancel: () => Promise.resolve(),
            }),
        },
    };
};

const directMode = { enabled: true, modelTier: 'fast' };

const setup = (extra = {}) => renderHook(() => useChatEngine({
    selectedAgent: null,
    currentConversation: null,
    directMode,
    ...extra,
}));

const lastAssistant = (result) => {
    const msgs = result.current.messages.filter((m) => m.role === 'assistant');
    return msgs[msgs.length - 1];
};

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
});

describe('useChatEngine — a turn never ends silently', () => {
    it('renders the answer for a well-formed stream', async () => {
        authFetch.mockResolvedValue(streamResponse([
            'event: content\ndata: {"text":"Hallo"}\n\n',
            'event: done\ndata: {}\n\n',
        ]));
        const { result } = setup();
        await act(async () => { await result.current.sendMessage('hi'); });

        const msg = lastAssistant(result);
        expect(msg.content).toBe('Hallo');
        expect(msg.isStreaming).toBe(false);
        expect(msg.isError).toBeFalsy();
    });

    // The exact Nextcloud symptom. The connector frames SSE with
    // `Connection: close` and no Content-Length, so a stream cut at byte 0
    // arrives as a clean, successful, EMPTY 200 — no network error to catch.
    it('surfaces an error when the stream is truncated to nothing (no `done`)', async () => {
        authFetch.mockResolvedValue(streamResponse([]));
        const { result } = setup();
        await act(async () => { await result.current.sendMessage('hi'); });

        const msg = lastAssistant(result);
        expect(msg.isStreaming).toBe(false);
        expect(msg.content).not.toBe('');
        expect(msg.isError).toBe(true);
    });

    it('surfaces an interruption when the stream is cut after partial content', async () => {
        authFetch.mockResolvedValue(streamResponse([
            'event: content\ndata: {"text":"Half an ans"}\n\n',
        ]));
        const { result } = setup();
        await act(async () => { await result.current.sendMessage('hi'); });

        const msg = lastAssistant(result);
        expect(msg.isStreaming).toBe(false);
        // Partial work is kept and flagged, not silently presented as complete.
        expect(msg.content).toContain('Half an ans');
        expect(msg.isInterrupted).toBe(true);
    });

    // A 200 carrying HTML (a misrouted proxy hop) or compressed bytes whose
    // Content-Encoding was stripped both look like this to the reader.
    it('surfaces an error when the body is not SSE at all', async () => {
        authFetch.mockResolvedValue(streamResponse([
            '<!doctype html><html><body>Nextcloud</body></html>',
        ]));
        const { result } = setup();
        await act(async () => { await result.current.sendMessage('hi'); });

        const msg = lastAssistant(result);
        expect(msg.isError).toBe(true);
        expect(msg.isStreaming).toBe(false);
    });

    // The privacy shield ends these turns with `dlp_blocked` + `done` and no
    // content (server/routes/ai/directChat.js). The reason-specific notice is
    // therefore the ONLY thing standing between a policy block and a bubble that
    // looks identical to a broken stream.
    it('tells the user when the privacy shield blocked the message', async () => {
        authFetch.mockResolvedValue(streamResponse([
            'event: dlp_blocked\ndata: {"reason":"pii_unavailable"}\n\n',
            'event: done\ndata: {}\n\n',
        ]));
        const { result } = setup();
        await act(async () => { await result.current.sendMessage('my IBAN is NL00BANK'); });

        const msg = lastAssistant(result);
        expect(msg.isStreaming).toBe(false);
        expect(msg.isError).toBe(true);
        expect(msg.content).toBeTruthy();
        expect(msg.content).toContain('dlp.blocked_pii_unavailable');
    });

    it('distinguishes a too-large message from a transient shield outage', async () => {
        // "Try again in a moment" is actively wrong for an oversized message —
        // the retry scans the same text and fails identically.
        authFetch.mockResolvedValue(streamResponse([
            'event: dlp_blocked\ndata: {"reason":"pii_unavailable","kind":"too_large"}\n\n',
            'event: done\ndata: {}\n\n',
        ]));
        const { result } = setup();
        await act(async () => { await result.current.sendMessage('a very long message'); });

        expect(lastAssistant(result).content).toContain('dlp.blocked_pii_too_large');
    });

    // Per the SSE spec the space after the colon is optional, and a proxy hop
    // may re-frame the stream with CRLF. Matching only 'data: ' + LF meant a
    // spec-legal stream parsed as zero events — another silent blank.
    it('parses spec-legal framing: no space after the colon, and CRLF', async () => {
        authFetch.mockResolvedValue(streamResponse([
            'event:content\r\ndata:{"text":"Hallo"}\r\n\r\n',
            'event:done\r\ndata:{}\r\n\r\n',
        ]));
        const { result } = setup();
        await act(async () => { await result.current.sendMessage('hi'); });

        const msg = lastAssistant(result);
        expect(msg.content).toBe('Hallo');
        expect(msg.isError).toBeFalsy();
    });

    it('still shows the explicit server error event', async () => {
        authFetch.mockResolvedValue(streamResponse([
            'event: error\ndata: {"error":"Model unavailable"}\n\n',
            'event: done\ndata: {}\n\n',
        ]));
        const { result } = setup();
        await act(async () => { await result.current.sendMessage('hi'); });

        const msg = lastAssistant(result);
        expect(msg.content).toContain('Model unavailable');
        expect(msg.isError).toBe(true);
    });

    // The recovery poller was gated on a `reloadConversation` prop that the main
    // chat surface never supplied, so it never ran where it was needed.
    it('recovers the persisted reply after a dropped stream', async () => {
        authFetch.mockResolvedValue(streamResponse([
            'event: content\ndata: {"text":"partial"}\n\n',
        ]));
        const reloadConversation = vi.fn().mockResolvedValue([
            { id: 'u1', role: 'user', content: 'hi' },
            { id: 'a1', role: 'assistant', content: 'The complete saved answer.' },
        ]);
        const { result } = setup({ reloadConversation });

        await act(async () => { await result.current.sendMessage('hi'); });
        expect(lastAssistant(result).isInterrupted).toBe(true);

        await waitFor(
            () => expect(lastAssistant(result).content).toBe('The complete saved answer.'),
            { timeout: 8000 },
        );
        expect(reloadConversation).toHaveBeenCalled();
    }, 15000);
});
