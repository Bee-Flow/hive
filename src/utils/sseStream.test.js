import { describe, it, expect } from 'vitest';
import { readEventStream } from './sseStream.js';

function streamFrom(chunks) {
    const enc = new TextEncoder();
    let i = 0;
    return new ReadableStream({
        pull(controller) {
            if (i < chunks.length) controller.enqueue(enc.encode(chunks[i++]));
            else controller.close();
        },
    });
}

describe('readEventStream', () => {
    it('parses event/data frames and dispatches in order', async () => {
        const events = [];
        const body = streamFrom([
            'event: phase\ndata: {"phase":"scanning"}\n\n',
            'event: scan_step\ndata: {"tool":"gmail_search","integration":"gmail","phase":"start"}\n\n',
            'event: done\ndata: {"suggestions":[{"id":"s1"}]}\n\n',
        ]);
        await readEventStream(body, (e, d) => events.push([e, d]));
        expect(events).toEqual([
            ['phase', { phase: 'scanning' }],
            ['scan_step', { tool: 'gmail_search', integration: 'gmail', phase: 'start' }],
            ['done', { suggestions: [{ id: 's1' }] }],
        ]);
    });

    it('reassembles frames split across chunks', async () => {
        const events = [];
        const body = streamFrom(['event: do', 'ne\nda', 'ta: {"ok":', 'true}\n\n']);
        await readEventStream(body, (e, d) => events.push([e, d]));
        expect(events).toEqual([['done', { ok: true }]]);
    });

    it('ignores ping heartbeats (comment frame + ping event)', async () => {
        const events = [];
        const body = streamFrom([': ping\n\nevent: ping\ndata: {}\n\n', 'event: done\ndata: {"x":1}\n\n']);
        await readEventStream(body, (e, d) => events.push([e, d]));
        expect(events).toEqual([['done', { x: 1 }]]);
    });

    it('skips malformed data lines without throwing', async () => {
        const events = [];
        const body = streamFrom(['event: done\ndata: {not json}\n\n', 'event: done\ndata: {"ok":1}\n\n']);
        await readEventStream(body, (e, d) => events.push([e, d]));
        expect(events).toEqual([['done', { ok: 1 }]]);
    });

    it('throws when the response has no readable body', async () => {
        await expect(readEventStream(null, () => {})).rejects.toThrow();
    });
});
