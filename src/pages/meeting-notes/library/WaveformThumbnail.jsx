import React, { useEffect, useRef } from 'react';

/**
 * Deterministic pseudo-waveform thumbnail derived from the meeting id. Cheap,
 * never re-fetches audio for the library view (we'd rather render instantly
 * than block the grid on hundreds of audio decodes).
 */
export default function WaveformThumbnail({ id = '', bars = 40, height = 40, color = 'var(--accent-primary)' }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const c = canvasRef.current;
        if (!c) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        const w = c.clientWidth * dpr;
        const h = c.clientHeight * dpr;
        c.width = w;
        c.height = h;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = getComputedStyle(c).color || '#9ca3af';
        const seed = hashSeed(id);
        const gap = 2 * dpr;
        const barW = Math.max(1, Math.floor((w - gap * (bars - 1)) / bars));
        for (let i = 0; i < bars; i++) {
            const r = pseudoRand(seed + i);
            const bh = Math.max(2 * dpr, r * (h - 4 * dpr));
            const y = (h - bh) / 2;
            const x = i * (barW + gap);
            ctx.fillRect(x, y, barW, bh);
        }
    }, [id, bars]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full"
            style={{ height, color }}
            aria-hidden="true"
        />
    );
}

function hashSeed(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h) || 1;
}

function pseudoRand(n) {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return Math.abs(x - Math.floor(x));
}
