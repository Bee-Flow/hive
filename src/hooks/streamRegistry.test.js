/**
 * Keeping an in-flight answer alive across navigation.
 *
 * The bug: useChatEngine aborted its AbortController on unmount, and every
 * navigation in AgentHub unmounts the chat. Because the server tears down its
 * SSE generation on `res.on('close')`, that abort did not merely stop
 * listening — it KILLED the answer, and nothing was persisted, so returning to
 * the thread showed a question with no reply.
 *
 * Tolerable for one person with one chat. Not tolerable across several project
 * threads, and actively wrong in a shared one, where the other members watching
 * would see the stream die because somebody else clicked away.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    registerStream, releaseStream, detachStream, reattachStream,
    isStreaming, activeStreamKeys, abortAllStreams,
} from './streamRegistry';

function fakeController() {
    return { abort: vi.fn(), signal: { aborted: false } };
}

beforeEach(() => {
    abortAllStreams();
    vi.useFakeTimers();
});
afterEach(() => {
    vi.useRealTimers();
});

describe('streamRegistry', () => {
    it('tracks a registered stream', () => {
        const c = fakeController();
        registerStream('conv1', c);

        expect(isStreaming('conv1')).toBe(true);
        expect(activeStreamKeys()).toEqual(['conv1']);
    });

    it('detaching a persisted conversation keeps the fetch alive', () => {
        const c = fakeController();
        registerStream('conv1', c);

        const kept = detachStream('conv1', { canDetach: true });

        expect(kept).toBe(true);
        expect(c.abort).not.toHaveBeenCalled();
        expect(isStreaming('conv1')).toBe(true);
    });

    it('detaching an EPHEMERAL stream aborts it — nothing would persist the output', () => {
        const c = fakeController();
        registerStream('pending:abc', c);

        const kept = detachStream('pending:abc', { canDetach: false });

        expect(kept).toBe(false);
        expect(c.abort).toHaveBeenCalledOnce();
        expect(isStreaming('pending:abc')).toBe(false);
    });

    it('a detached stream is aborted once its timeout expires', () => {
        const c = fakeController();
        registerStream('conv1', c);
        detachStream('conv1');

        expect(c.abort).not.toHaveBeenCalled();

        // A detached fetch must not be able to hold a socket for the life of
        // the tab if the server never closes it.
        vi.advanceTimersByTime(5 * 60_000 + 1);

        expect(c.abort).toHaveBeenCalledOnce();
        expect(isStreaming('conv1')).toBe(false);
    });

    it('reattaching cancels the timeout, so returning to a thread does not kill it', () => {
        const c = fakeController();
        registerStream('conv1', c);
        detachStream('conv1');

        const reattached = reattachStream('conv1');
        expect(reattached).toBe(c);

        vi.advanceTimersByTime(10 * 60_000);
        expect(c.abort).not.toHaveBeenCalled();
        expect(isStreaming('conv1')).toBe(true);
    });

    it('a new stream on the same conversation supersedes the old one', () => {
        const first = fakeController();
        const second = fakeController();
        registerStream('conv1', first);
        registerStream('conv1', second);

        // Two live generations writing into one thread is never what was asked
        // for — least of all a shared thread, where both would be visible.
        expect(first.abort).toHaveBeenCalledOnce();
        expect(second.abort).not.toHaveBeenCalled();
        expect(activeStreamKeys()).toEqual(['conv1']);
    });

    it('re-registering the SAME controller does not abort it', () => {
        const c = fakeController();
        registerStream('conv1', c);
        registerStream('conv1', c);

        expect(c.abort).not.toHaveBeenCalled();
    });

    it('releasing clears the entry and its pending timeout', () => {
        const c = fakeController();
        registerStream('conv1', c);
        detachStream('conv1');
        releaseStream('conv1');

        expect(isStreaming('conv1')).toBe(false);
        vi.advanceTimersByTime(10 * 60_000);
        expect(c.abort).not.toHaveBeenCalled();
    });

    it('streams are independent, so several threads can run at once', () => {
        const a = fakeController();
        const b = fakeController();
        registerStream('conv1', a);
        registerStream('conv2', b);

        detachStream('conv1');
        releaseStream('conv2');

        expect(isStreaming('conv1')).toBe(true);
        expect(isStreaming('conv2')).toBe(false);
        expect(a.abort).not.toHaveBeenCalled();
    });

    it('abortAllStreams stops everything — page unload or sign-out', () => {
        const a = fakeController();
        const b = fakeController();
        registerStream('conv1', a);
        registerStream('conv2', b);

        abortAllStreams();

        expect(a.abort).toHaveBeenCalledOnce();
        expect(b.abort).toHaveBeenCalledOnce();
        expect(activeStreamKeys()).toEqual([]);
    });

    it('operations on an unknown key are safe no-ops', () => {
        expect(detachStream('nope')).toBe(false);
        expect(reattachStream('nope')).toBeNull();
        expect(isStreaming('nope')).toBe(false);
        expect(() => releaseStream('nope')).not.toThrow();
    });

    it('ignores a registration with no key or no controller', () => {
        registerStream(null, fakeController());
        registerStream('conv1', null);

        expect(activeStreamKeys()).toEqual([]);
    });

    it('an aborting controller does not break the registry', () => {
        const bad = { abort: vi.fn(() => { throw new Error('already gone'); }) };
        registerStream('conv1', bad);

        // A controller whose abort throws must not strand every other stream.
        expect(() => abortAllStreams()).not.toThrow();
        expect(activeStreamKeys()).toEqual([]);
    });
});
