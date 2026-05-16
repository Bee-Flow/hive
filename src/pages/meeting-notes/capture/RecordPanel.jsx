import React, { useEffect } from 'react';
import { Mic, Square, Pause, Play, X } from 'lucide-react';
import CaptureControls from './CaptureControls';
import { useRecorder } from '../hooks/RecorderContext';
import { formatDuration } from '../lib/format';

export default function RecordPanel({ serverDefault, localEnabled, onComplete }) {
    const { recorder, uploading } = useRecorder();
    const { state, elapsed, level, error, start, stop, pause, resume, cancel } = recorder;

    useEffect(() => {
        if (state === 'idle' && uploading) {
            onComplete?.();
        }
    }, [state, uploading, onComplete]);

    const recording = state === 'recording' || state === 'paused';
    const ringScale = 1 + Math.min(0.6, level * 1.2);

    return (
        <div className="flex flex-col items-center gap-6 py-2">
            <CaptureControls serverDefault={serverDefault} localEnabled={localEnabled} />

            <div className="relative flex items-center justify-center" style={{ height: 220 }}>
                {recording && (
                    <span
                        aria-hidden
                        className="absolute rounded-full transition-transform"
                        style={{
                            width: 180,
                            height: 180,
                            background: 'radial-gradient(circle, rgba(255,212,0,0.25) 0%, rgba(255,212,0,0) 70%)',
                            transform: `scale(${ringScale})`,
                        }}
                    />
                )}
                <button
                    type="button"
                    onClick={() => {
                        if (state === 'idle') start();
                        else stop();
                    }}
                    aria-label={state === 'idle' ? 'Start recording' : 'Stop recording'}
                    className="relative w-24 h-24 rounded-full flex items-center justify-center text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
                    style={{
                        background: recording ? '#ef4444' : '#ffd400',
                        color: recording ? '#fff' : '#1a1a1a',
                    }}
                    disabled={state === 'stopping'}
                >
                    {recording ? <Square className="w-10 h-10" fill="currentColor" /> : <Mic className="w-10 h-10" />}
                </button>
            </div>

            <div className="text-center">
                <div className="text-3xl font-mono font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {formatDuration(elapsed)}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {state === 'recording' && 'Recording in progress'}
                    {state === 'paused' && 'Paused'}
                    {state === 'idle' && !uploading && 'Tap the mic to start'}
                    {state === 'stopping' && 'Processing audio…'}
                    {uploading && 'Transcribing your meeting…'}
                </div>
            </div>

            {recording && (
                <div className="flex items-center gap-2">
                    {state === 'recording' ? (
                        <button
                            type="button"
                            onClick={pause}
                            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm border"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        >
                            <Pause className="w-4 h-4" /> Pause
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={resume}
                            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm border"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                        >
                            <Play className="w-4 h-4" /> Resume
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={cancel}
                        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm border"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}
                    >
                        <X className="w-4 h-4" /> Discard
                    </button>
                </div>
            )}

            {error && (
                <div className="text-xs text-rose-500 max-w-sm text-center">
                    {error.name === 'NotAllowedError'
                        ? 'Microphone access denied. Please allow access in your browser settings.'
                        : `Microphone error: ${error.message || 'unknown'}`}
                </div>
            )}
        </div>
    );
}
