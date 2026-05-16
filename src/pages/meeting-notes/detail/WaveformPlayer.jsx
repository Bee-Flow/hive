import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import useWaveform from '../hooks/useWaveform';
import { formatDuration } from '../lib/format';

/**
 * Canvas-rendered waveform scrubber with audio playback.
 * Exposes `seek(seconds)` to parent via ref-like callback API.
 */
export default function WaveformPlayer({ audioSrc, onReady }) {
    const audioRef = useRef(null);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const { peaks, duration: peakDuration, loading } = useWaveform(audioSrc, 600);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [hoverFrac, setHoverFrac] = useState(null);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !peaks) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth * dpr;
        const h = canvas.clientHeight * dpr;
        canvas.width = w;
        canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        const progress = duration > 0 ? currentTime / duration : 0;
        const barCount = peaks.length;
        const barWidth = w / barCount;
        const gap = Math.max(1, Math.floor(barWidth * 0.35));
        const drawnBar = Math.max(1, Math.floor(barWidth - gap));
        const mid = h / 2;
        const playedColor = getCssVar('--accent-primary') || '#9ca3af';
        const remainColor = 'rgba(148, 163, 184, 0.45)';
        for (let i = 0; i < barCount; i++) {
            const x = i * barWidth;
            const peak = peaks[i] ?? 0;
            const barH = Math.max(2 * dpr, peak * (h - 6 * dpr));
            ctx.fillStyle = (i / barCount) < progress ? playedColor : remainColor;
            ctx.fillRect(x, mid - barH / 2, drawnBar, barH);
        }
        if (hoverFrac != null) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.fillRect(0, 0, hoverFrac * w, h);
        }
        // Playhead
        if (progress > 0) {
            ctx.fillStyle = playedColor;
            ctx.fillRect(progress * w - 1, 0, 2, h);
        }
    }, [peaks, currentTime, duration, hoverFrac]);

    useEffect(() => { draw(); }, [draw]);
    useEffect(() => {
        const ro = new ResizeObserver(draw);
        if (containerRef.current) ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [draw]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return undefined;
        const onTime = () => setCurrentTime(audio.currentTime);
        const onMeta = () => setDuration(audio.duration || peakDuration || 0);
        const onEnd = () => setPlaying(false);
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('loadedmetadata', onMeta);
        audio.addEventListener('ended', onEnd);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        if (audio.duration) onMeta();
        return () => {
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('loadedmetadata', onMeta);
            audio.removeEventListener('ended', onEnd);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
        };
    }, [peakDuration]);

    useEffect(() => {
        if (!onReady) return;
        onReady({
            seek: (sec) => {
                if (!audioRef.current) return;
                audioRef.current.currentTime = Math.max(0, sec);
                audioRef.current.play().catch(() => {});
            },
        });
    }, [onReady]);

    const togglePlay = () => {
        const a = audioRef.current;
        if (!a) return;
        if (a.paused) a.play().catch(() => {});
        else a.pause();
    };

    const seekFromEvent = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
        const frac = Math.max(0, Math.min(1, x / rect.width));
        const audio = audioRef.current;
        if (!audio) return;
        const d = duration || peakDuration || 0;
        if (!d) return;
        audio.currentTime = frac * d;
    };

    const displayDuration = duration || peakDuration || 0;

    return (
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
            <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? 'Pause' : 'Play'}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                style={{ background: 'var(--accent-primary)' }}
            >
                {playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
            </button>
            <div ref={containerRef} className="flex-1 min-w-0">
                <div className="relative h-12">
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
                        </div>
                    )}
                    <canvas
                        ref={canvasRef}
                        className="w-full h-12 cursor-pointer"
                        onClick={seekFromEvent}
                        onMouseMove={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoverFrac(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
                        }}
                        onMouseLeave={() => setHoverFrac(null)}
                        onTouchStart={seekFromEvent}
                    />
                </div>
                <div className="flex items-center justify-between text-[11px] mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
                    <span>{formatDuration(currentTime)}</span>
                    <span>{formatDuration(displayDuration)}</span>
                </div>
            </div>
            <input
                type="range"
                min="0"
                max={Math.floor(displayDuration) || 0}
                value={Math.floor(currentTime)}
                onChange={(e) => { if (audioRef.current) audioRef.current.currentTime = Number(e.target.value); }}
                className="sr-only"
                aria-label="Audio position"
            />
            <audio ref={audioRef} src={audioSrc} preload="metadata" />
        </div>
    );
}

function getCssVar(name) {
    if (typeof window === 'undefined') return null;
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
