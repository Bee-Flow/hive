import { useEffect, useState } from 'react';
import { authFetch } from '../../../utils/helpers';

/**
 * Full-audio blobs are heavy (a 100-min recording is tens of MB); keep only
 * the last few meetings so browsing a library doesn't accumulate them all.
 */
const MAX_CACHE_ENTRIES = 4;
const cache = new Map(); // url → { peaks, duration, blob }
const pending = new Map(); // url → in-flight promise (dedupes StrictMode double-mount)

function decodePeaks(url, bins = 512) {
    if (cache.has(url)) return Promise.resolve(cache.get(url));
    if (pending.has(url)) return pending.get(url);
    const p = fetchAndDecode(url, bins).finally(() => pending.delete(url));
    pending.set(url, p);
    return p;
}

async function fetchAndDecode(url, bins) {
    const res = await authFetch(url);
    if (!res.ok) throw new Error(`audio fetch ${res.status}`);
    const buf = await res.arrayBuffer();
    // The same authenticated bytes also back the <audio> element (via a blob
    // URL) — one download instead of two, and playback keeps working in the
    // storage-partitioned iframe embed, where a bare <audio src> cannot send
    // the X-Session-Token header authFetch adds.
    // No `|| 'audio/mpeg'` fallback: a browser recording is WebM/Opus, and
    // labelling it MP3 made the <audio> element refuse to decode it. When the
    // server tells us nothing, omit the type entirely and let the browser sniff
    // — an explicit 'application/octet-stream' is worse than none, because
    // Safari treats it as "definitely not playable".
    const reportedType = res.headers.get('content-type');
    const blob = reportedType && reportedType !== 'application/octet-stream'
        ? new Blob([buf], { type: reportedType })
        : new Blob([buf]);
    const ctx = window.AudioContext ? new (window.AudioContext || window.webkitAudioContext)() : null;
    if (!ctx) throw new Error('Web Audio not supported');
    let audioBuffer;
    let peaks;
    try {
        audioBuffer = await ctx.decodeAudioData(buf.slice(0));
        const channel = audioBuffer.getChannelData(0);
        const blockSize = Math.max(1, Math.floor(channel.length / bins));
        peaks = new Float32Array(bins);
        for (let i = 0; i < bins; i++) {
            let max = 0;
            const start = i * blockSize;
            const end = Math.min(start + blockSize, channel.length);
            for (let j = start; j < end; j++) {
                const v = Math.abs(channel[j]);
                if (v > max) max = v;
            }
            peaks[i] = max;
        }
    } finally {
        // Closed on the FAILURE path too. An undecodable recording used to
        // abandon its AudioContext, and browsers cap how many a page may hold.
        try { ctx.close(); } catch { /* ignore */ }
    }
    const result = { peaks, duration: audioBuffer.duration, blob };
    cache.set(url, result);
    while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
    return result;
}

export default function useWaveform(url, bins = 512) {
    const [peaks, setPeaks] = useState(null);
    const [duration, setDuration] = useState(0);
    // Keyed by url so a stale (revoked) blob URL is never handed out for a
    // different meeting while the new one is still decoding.
    const [blobState, setBlobState] = useState({ url: null, objectUrl: null });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // `cancelled` is per effect RUN, not a shared ref. A ref set back to
        // false at the top of the next run un-cancelled the previous one, so
        // switching meetings quickly let the old decode resolve afterwards and
        // paint meeting A's waveform under meeting B — and because its cleanup
        // had already run with `createdUrl` still null, A's multi-megabyte blob
        // URL was never revoked. One leak per switch.
        let cancelled = false;
        let createdUrl = null;
        setPeaks(null);
        setDuration(0);
        setError(null);
        if (!url) { setLoading(false); return undefined; }
        setLoading(true);
        decodePeaks(url, bins)
            .then((r) => {
                if (cancelled) return;
                setPeaks(r.peaks);
                setDuration(r.duration);
                createdUrl = URL.createObjectURL(r.blob);
                setBlobState({ url, objectUrl: createdUrl });
            })
            .catch((err) => { if (!cancelled) setError(err); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [url, bins]);

    return { peaks, duration, objectUrl: blobState.url === url ? blobState.objectUrl : null, loading, error };
}
