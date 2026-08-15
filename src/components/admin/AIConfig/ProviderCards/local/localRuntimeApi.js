// API helpers + shared styles for the self-hosted runtime card.
//
// Kept out of the component so the SSE download reader — the only non-trivial
// piece of logic here — can be read (and tested) on its own.

import { API_BASE, authFetch } from '../../../../../utils/helpers';

export const BTN_PRIMARY =
    'px-3 py-2 rounded-lg text-xs font-medium transition-colors bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50';
export const BTN_GHOST =
    'px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/10 disabled:opacity-50';

export const TIER_LABELS = {
    fast: 'Fast',
    standard: 'Flow',
    thinking: 'Thinking',
    deep_thinking: 'Deep Thinking',
};

const json = (body) => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

export async function fetchRuntimeCatalog() {
    const [rtRes, modelRes] = await Promise.all([
        authFetch(`${API_BASE}/ai/local-runtimes`),
        authFetch(`${API_BASE}/ai/local-runtimes/models`),
    ]);
    return {
        runtimes: rtRes.ok ? (await rtRes.json()).runtimes || [] : [],
        starterModels: modelRes.ok ? (await modelRes.json()).models || [] : [],
    };
}

export async function fetchProviders() {
    const res = await authFetch(`${API_BASE}/ai/providers`);
    return res.ok ? (await res.json()).providers || [] : [];
}

/** Probe one endpoint. Always resolves — a failure is a result, not an throw. */
export async function testRuntime({ type, url, apiKey }) {
    try {
        const res = await authFetch(`${API_BASE}/ai/local-runtimes/test`, json({ type, url, apiKey }));
        const data = await res.json();
        return res.ok ? data : { ok: false, error: data.error, modelCount: 0, models: [] };
    } catch (e) {
        return { ok: false, error: e.message, modelCount: 0, models: [] };
    }
}

export async function detectRuntimes() {
    const res = await authFetch(`${API_BASE}/ai/local-runtimes/detect`, { method: 'POST' });
    return res.ok ? res.json() : { found: [], probed: 0 };
}

// connect/disconnect are driven from click handlers that surface the result as
// a toast, so like pullModel they report failure rather than throwing — an
// escaping rejection from an onClick is invisible to the user.
export async function connectRuntime({ type, name, url, apiKey }) {
    try {
        const res = await authFetch(`${API_BASE}/ai/providers`, json({ type, name, url, apiKey }));
        if (res.ok) return { ok: true };
        return { ok: false, error: (await res.json().catch(() => ({}))).error || 'Failed to connect the runtime' };
    } catch (e) {
        return { ok: false, error: e.message || 'Failed to connect the runtime' };
    }
}

export async function disconnectRuntime(id) {
    try {
        const res = await authFetch(`${API_BASE}/ai/providers/${id}`, { method: 'DELETE' });
        return { ok: res.ok };
    } catch {
        return { ok: false };
    }
}

/**
 * Start an Ollama download and report progress as it streams.
 *
 * The server relays Ollama's native NDJSON as SSE; a multi-GB download is not
 * something to run blind, so this surfaces every progress frame rather than
 * resolving once at the end.
 *
 * @param {string} providerId
 * @param {string} model
 * @param {(p: {status: string, pct: number|null}) => void} onProgress
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function pullModel(providerId, model, onProgress) {
    // Never throws: the caller drives a progress bar off the returned outcome,
    // and an escaping rejection would leave that bar stuck at whatever percent
    // the connection died on, with no error shown. Every failure — the request
    // itself, an error frame, a connection dropped mid-transfer — comes back as
    // { ok: false, error }.
    try {
        const res = await authFetch(`${API_BASE}/ai/local-runtimes/${providerId}/pull`, json({ model }));
        if (!res.ok || !res.body) {
            return { ok: false, error: (await res.json().catch(() => ({}))).error || 'Failed to start the download' };
        }
        return await readPullStream(res.body.getReader(), onProgress);
    } catch (e) {
        return { ok: false, error: e.message || 'The download failed' };
    }
}

/** Drain the SSE stream, reporting progress and returning the final outcome. */
async function readPullStream(reader, onProgress) {
    const decoder = new TextDecoder();
    let buffer = '';
    // A stream that simply stops is a dropped connection, not a finished pull.
    let outcome = { ok: false, error: 'The download ended without finishing' };

    for (;;) {
        const { done, value } = await reader.read();
        if (done) return outcome;
        buffer += decoder.decode(value, { stream: true });
        // SSE frames are separated by a blank line; keep the trailing partial.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';
        for (const frame of frames) {
            const parsed = parseFrame(frame);
            if (!parsed) continue;
            const { event, data } = parsed;
            if (event === 'progress') {
                onProgress({
                    status: data.status || '',
                    pct: data.total ? Math.round((data.completed / data.total) * 100) : null,
                });
            } else if (event === 'done') {
                outcome = { ok: true };
            } else if (event === 'error') {
                outcome = { ok: false, error: data.error };
            }
        }
    }
}

/** Parse one SSE frame; null when it is incomplete or malformed. */
function parseFrame(frame) {
    const event = /^event: (.+)$/m.exec(frame)?.[1];
    const dataLine = /^data: (.+)$/m.exec(frame)?.[1];
    if (!event || !dataLine) return null;
    try {
        return { event, data: JSON.parse(dataLine) };
    } catch {
        return null;   // a malformed frame must not abort the download
    }
}
