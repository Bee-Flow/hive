import React, { useState, useRef, useEffect } from 'react';

/** Premium inline audio player with optional album art */
export default function AudioPlayerInline({ src, albumArt, title, subtitle }) {
    const audioRef = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [muted, setMuted] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const fmt = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const togglePlay = () => {
        const a = audioRef.current;
        if (!a) return;
        if (playing) { a.pause(); } else { a.play(); }
        setPlaying(!playing);
    };

    const seek = (e) => {
        const a = audioRef.current;
        if (!a || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        a.currentTime = pct * duration;
    };

    const changeVolume = (e) => {
        const v = parseFloat(e.target.value);
        setVolume(v);
        if (audioRef.current) audioRef.current.volume = v;
        if (v > 0 && muted) setMuted(false);
    };

    const toggleMute = () => {
        if (audioRef.current) audioRef.current.muted = !muted;
        setMuted(!muted);
    };

    // Pulsing animation for album art
    const [pulse, setPulse] = useState(false);
    useEffect(() => {
        if (!playing) { setPulse(false); return; }
        const iv = setInterval(() => setPulse(p => !p), 800);
        return () => clearInterval(iv);
    }, [playing]);

    const hasArt = !!albumArt;

    return (
        <div className="rounded-2xl overflow-hidden max-w-md shadow-xl"
            style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                border: '1px solid rgba(255,255,255,0.08)',
            }}>
            <audio
                ref={audioRef}
                src={src}
                onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                onLoadedMetadata={() => { setDuration(audioRef.current?.duration || 0); setLoaded(true); }}
                onEnded={() => setPlaying(false)}
                preload="metadata"
            />

            <div className="flex gap-3 p-4 pb-2">
                {/* Album Art or Emoji Fallback */}
                <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center"
                        style={{
                            background: hasArt ? 'transparent' : 'linear-gradient(135deg, #e94560, #c23616)',
                            boxShadow: playing
                                ? `0 4px 20px rgba(233,69,96,${pulse ? 0.5 : 0.25})`
                                : '0 4px 15px rgba(233,69,96,0.2)',
                            transition: 'box-shadow 0.8s ease',
                        }}>
                        {hasArt ? (
                            <img src={albumArt} alt="Album art" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-2xl">🎵</span>
                        )}
                    </div>
                    {playing && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ background: '#e94560', boxShadow: '0 0 8px rgba(233,69,96,0.5)' }}>
                            <div className="flex items-end gap-[1px] h-2">
                                {[1,2,3].map(i => (
                                    <div key={i} className="w-[2px] rounded-full bg-white"
                                        style={{
                                            animation: `eqBar 0.${3+i}s ease-in-out infinite alternate`,
                                            height: `${40 + i * 20}%`,
                                        }} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Title + Controls */}
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                        {title || 'AI Generated Audio'}
                    </div>
                    <div className="text-[10px] text-gray-400 mb-2">
                        {subtitle || 'ElevenLabs'}
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-gray-400 w-8 text-right">{fmt(currentTime)}</span>
                        <div className="flex-1 h-1.5 rounded-full cursor-pointer group relative"
                            style={{ background: 'rgba(255,255,255,0.08)' }}
                            onClick={seek}>
                            <div className="h-full rounded-full transition-all duration-100"
                                style={{
                                    width: duration ? `${(currentTime / duration) * 100}%` : '0%',
                                    background: 'linear-gradient(90deg, #e94560, #ff6b6b)',
                                    boxShadow: '0 0 8px rgba(233,69,96,0.4)',
                                }}
                            />
                            <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{
                                    left: duration ? `calc(${(currentTime / duration) * 100}% - 6px)` : '-6px',
                                    background: '#fff',
                                    boxShadow: '0 0 6px rgba(233,69,96,0.5)',
                                }}
                            />
                        </div>
                        <span className="text-[10px] font-mono text-gray-500 w-8">{fmt(duration)}</span>
                    </div>
                </div>
            </div>

            {/* Bottom controls */}
            <div className="flex items-center justify-between px-4 pb-3 pt-1">
                <div className="flex items-center gap-2">
                    {/* Play/Pause */}
                    <button onClick={togglePlay}
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
                        style={{
                            background: 'linear-gradient(135deg, #e94560, #c23616)',
                            boxShadow: playing ? '0 0 20px rgba(233,69,96,0.4)' : '0 2px 8px rgba(233,69,96,0.3)',
                        }}>
                        {playing ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                        ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><polygon points="7,3 21,12 7,21" /></svg>
                        )}
                    </button>

                    {/* Volume */}
                    <button onClick={toggleMute} className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
                        {muted || volume === 0 ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19" /><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" /></svg>
                        )}
                    </button>
                    <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
                        onChange={changeVolume}
                        className="w-14 h-1 rounded-full appearance-none cursor-pointer flex-shrink-0"
                        style={{
                            background: `linear-gradient(to right, #e94560 ${(muted ? 0 : volume) * 100}%, rgba(255,255,255,0.1) ${(muted ? 0 : volume) * 100}%)`,
                            accentColor: '#e94560',
                        }}
                    />
                </div>

                {/* Download */}
                <a href={src} download={`ai-audio-${Date.now()}.mp3`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200"
                    style={{ color: '#e94560', background: 'rgba(233,69,96,0.1)', border: '1px solid rgba(233,69,96,0.2)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(233,69,96,0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(233,69,96,0.1)'; }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                    Download
                </a>
            </div>

            {/* Equalizer animation keyframes */}
            <style>{`
                @keyframes eqBar {
                    0% { height: 20%; }
                    100% { height: 100%; }
                }
            `}</style>
        </div>
    );
}
