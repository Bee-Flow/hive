/**
 * Minimal Server-Sent Events reader for fetch-streamed POST responses.
 *
 * EventSource can't set auth headers, so streamed POSTs (the automation
 * builder, the suggestion scan, …) are read with fetch + ReadableStream. This
 * is the same `event:`/`data:` line-buffer loop used inline in
 * useAutomationBuilderStream.js, extracted so callers don't re-implement it.
 *
 * @param {ReadableStream} body  - response.body from a fetch
 * @param {(event: string, data: any) => void} onEvent - called per parsed event
 * @param {AbortSignal} [signal] - stop reading when aborted
 */
export async function readEventStream(body, onEvent, signal) {
    if (!body || typeof body.getReader !== 'function') {
        throw new Error('readEventStream: response has no readable body');
    }
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let currentEvent = 'message';
    try {
        while (true) {
            if (signal?.aborted) break;
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop(); // keep the trailing partial line for the next chunk
            for (const line of lines) {
                if (line.startsWith('event: ')) {
                    currentEvent = line.slice(7).trim();
                } else if (line.startsWith('data: ')) {
                    let data;
                    try { data = JSON.parse(line.slice(6)); } catch { continue; }
                    if (currentEvent === 'ping') continue; // heartbeat — ignore
                    onEvent(currentEvent, data);
                }
                // a blank line terminates an event; currentEvent is reset by the
                // next `event:` line (the server always frames event before data).
            }
        }
    } finally {
        try { reader.cancel(); } catch { /* already closed */ }
    }
}

export default readEventStream;
