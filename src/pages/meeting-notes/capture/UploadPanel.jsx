import React, { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import CaptureControls from './CaptureControls';
import { useRecorder } from '../hooks/RecorderContext';

export default function UploadPanel({ onComplete }) {
    const { uploadFile, retryWithProvider, canRetry, setSettings, uploading, uploadStage, uploadError, clearError } = useRecorder();
    const inputRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);

    const handleFiles = async (files) => {
        const file = files?.[0];
        if (!file) return;
        clearError();
        const outcome = await uploadFile(file);
        if (outcome?.ok) onComplete?.();
    };

    const handleSwitchEngineRetry = async () => {
        // Switch the default engine to voxtral and re-upload the cached file.
        setSettings((s) => ({ ...s, provider: 'voxtral' }));
        const outcome = await retryWithProvider('voxtral');
        if (outcome?.ok) onComplete?.();
    };

    const errorCode = uploadError?.code || null;
    const isTooLongNoFallback = errorCode === 'local_whisper_too_long_no_fallback';

    return (
        <div className="flex flex-col gap-4">
            <CaptureControls />

            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => inputRef.current?.click()}
                className="relative flex flex-col items-center justify-center gap-3 px-6 py-12 rounded-2xl border-2 border-dashed cursor-pointer transition-colors"
                style={{
                    background: dragOver ? 'color-mix(in srgb, var(--accent-primary) 8%, var(--bg-secondary))' : 'var(--bg-secondary)',
                    borderColor: dragOver ? 'var(--accent-primary)' : 'var(--border-default)',
                }}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="audio/*,video/*"
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                />
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)', color: 'var(--accent-primary)' }}>
                    <Upload className="w-7 h-7" />
                </div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Drop an audio file here, or click to browse
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Supports .mp3, .wav, .m4a, .webm, .mp4 — up to ~2 hours
                </div>
            </div>

            {(uploading || uploadStage) && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{uploadStage || 'Working…'}</span>
                </div>
            )}
            {uploadError && isTooLongNoFallback && (
                <div
                    className="flex flex-col gap-2 px-3 py-3 rounded-xl border text-xs"
                    style={{ background: 'color-mix(in srgb, #f59e0b 8%, var(--bg-secondary))', borderColor: '#f59e0b', color: 'var(--text-primary)' }}
                >
                    <div className="font-semibold">Recording too long for on-device transcription</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{uploadError.message}</div>
                    {canRetry && (
                        <button
                            type="button"
                            onClick={handleSwitchEngineRetry}
                            disabled={uploading}
                            className="self-start px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
                        >
                            Switch engine & retry
                        </button>
                    )}
                </div>
            )}
            {uploadError && !isTooLongNoFallback && (
                <div
                    className="flex flex-col gap-2 px-3 py-3 rounded-xl border text-xs"
                    style={{ background: 'color-mix(in srgb, #ef4444 8%, var(--bg-secondary))', borderColor: '#ef4444', color: 'var(--text-primary)' }}
                >
                    <div className="font-semibold">Upload failed</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{uploadError.message}</div>
                    <div className="flex items-center gap-2">
                        {canRetry && (
                            <button
                                type="button"
                                onClick={async () => { const outcome = await retryWithProvider(); if (outcome?.ok) onComplete?.(); }}
                                disabled={uploading}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                                style={{ background: 'var(--accent-primary)' }}
                            >
                                Retry
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={clearError}
                            disabled={uploading}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
