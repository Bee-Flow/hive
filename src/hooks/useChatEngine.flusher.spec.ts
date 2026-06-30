import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createContentFlusher } from './useChatEngine';

// Controllable requestAnimationFrame: schedule() enqueues a callback; runFrame()
// fires the pending one, mimicking the browser firing the next animation frame.
let frameCbs: Array<{ id: number; cb: (t: number) => void }>;
let nextId: number;
function runFrame() {
    const pending = frameCbs;
    frameCbs = [];
    pending.forEach(({ cb }) => cb(16));
}

beforeEach(() => {
    frameCbs = [];
    nextId = 1;
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
        const id = nextId++;
        frameCbs.push({ id, cb });
        return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
        frameCbs = frameCbs.filter((f) => f.id !== id);
    });
});

afterEach(() => vi.unstubAllGlobals());

function makeFlusher(initialMessages: any[]) {
    let messages = initialMessages;
    const setMessages = vi.fn((updater: any) => {
        messages = typeof updater === 'function' ? updater(messages) : updater;
    });
    const activeIdRef = { current: 'a1' };
    const contentRef = { current: '' };
    const flusher = createContentFlusher(setMessages, activeIdRef, contentRef);
    return { flusher, setMessages, contentRef, getMessages: () => messages };
}

describe('createContentFlusher', () => {
    it('coalesces many schedule() calls into a single frame + one setMessages', () => {
        const { flusher, setMessages, contentRef, getMessages } = makeFlusher([
            { id: 'a1', content: '' },
            { id: 'other', content: 'keep' },
        ]);
        // Simulate a fast token stream within one frame.
        contentRef.current += 'Hel'; flusher.schedule();
        contentRef.current += 'lo '; flusher.schedule();
        contentRef.current += 'world'; flusher.schedule();
        // Nothing committed until the frame fires.
        expect(setMessages).not.toHaveBeenCalled();

        runFrame();
        expect(setMessages).toHaveBeenCalledTimes(1);
        const msgs = getMessages();
        expect(msgs.find((m: any) => m.id === 'a1').content).toBe('Hello world');
        // Unrelated messages are untouched.
        expect(msgs.find((m: any) => m.id === 'other').content).toBe('keep');
    });

    it('carries the last-seen responder name/avatar into the flush', () => {
        const { flusher, contentRef, getMessages } = makeFlusher([
            { id: 'a1', content: '', respondingAgentName: null, respondingAgentAvatar: null },
        ]);
        contentRef.current = 'x'; flusher.schedule('Agent A', '🤖');
        contentRef.current = 'xy'; flusher.schedule('Agent B', '🦊');
        runFrame();
        const m = getMessages()[0];
        expect(m.respondingAgentName).toBe('Agent B');
        expect(m.respondingAgentAvatar).toBe('🦊');
    });

    it('flushNow() commits synchronously without waiting for a frame', () => {
        const { flusher, setMessages, contentRef, getMessages } = makeFlusher([{ id: 'a1', content: '' }]);
        contentRef.current = 'partial'; flusher.schedule();
        flusher.flushNow();
        expect(setMessages).toHaveBeenCalledTimes(1);
        expect(getMessages()[0].content).toBe('partial');
        // The previously-scheduled frame is now a no-op (already flushed).
        runFrame();
        expect(setMessages).toHaveBeenCalledTimes(1);
    });

    it('cancel() drops a pending flush so the frame commits nothing', () => {
        const { flusher, setMessages, contentRef } = makeFlusher([{ id: 'a1', content: '' }]);
        contentRef.current = 'doomed'; flusher.schedule();
        flusher.cancel();
        runFrame();
        expect(setMessages).not.toHaveBeenCalled();
    });

    it('flushNow() after cancel() is a no-op (nothing pending)', () => {
        const { flusher, setMessages, contentRef } = makeFlusher([{ id: 'a1', content: '' }]);
        contentRef.current = 'doomed'; flusher.schedule();
        flusher.cancel();
        flusher.flushNow();
        expect(setMessages).not.toHaveBeenCalled();
    });
});
