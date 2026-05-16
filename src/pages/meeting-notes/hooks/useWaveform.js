import { useEffect, useRef, useState } from 'react';
import { authFetch } from '../../../utils/helpers';

const cache = new Map();

async function decodePeaks(url, bins = 512) {
    if (cache.has(url)) return cache.get(url);
    const res = await authFetch(url);
    if (!res.ok) throw new Error(`audio fetch ${res.status}`);
    const buf = await res.arrayBuffer();
    const ctx = window.AudioContext ? new (window.AudioContext || window.webkitAudioContext)() : null;
    if (!ctx) throw new Error('Web Audio not supported');
    const audioBuffer = await ctx.decodeAudioData(buf.slice(0));
    const channel = audioBuffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channel.length / bins));
    const peaks = new Float32Array(bins);
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
    try { ctx.close(); } catch (_) { /* ignore */ }
    const result = { peaks, duration: audioBuffer.duration };
    cache.set(url, result);
    return result;
}

export default function useWaveform(url, bins = 512) {
    const [peaks, setPeaks] = useState(null);
    const [duration, setDuration] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const cancelledRef = useRef(false);

    useEffect(() => {
        cancelledRef.current = false;
        if (!url) { setPeaks(null); setDuration(0); return undefined; }
        setLoading(true);
        setError(null);
        decodePeaks(url, bins)
            .then((r) => {
                if (cancelledRef.current) return;
                setPeaks(r.peaks);
                setDuration(r.duration);
            })
            .catch((err) => { if (!cancelledRef.current) setError(err); })
            .finally(() => { if (!cancelledRef.current) setLoading(false); });
        return () => { cancelledRef.current = true; };
    }, [url, bins]);

    return { peaks, duration, loading, error };
}
