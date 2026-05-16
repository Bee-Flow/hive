import React, { useEffect, useRef, useState } from 'react';
import { Upload, FileAudio, FolderOpen, Cloud, Loader2 } from 'lucide-react';
import CaptureControls from './CaptureControls';
import { useRecorder } from '../hooks/RecorderContext';
import * as api from '../lib/transcriptionsApi';

export default function UploadPanel({ serverDefault, localEnabled, onComplete }) {
    const { uploadFile, uploadFromNextcloud, uploading, uploadStage, uploadError, clearError } = useRecorder();
    const inputRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);
    const [source, setSource] = useState('file'); // 'file' | 'nextcloud'

    // Nextcloud state
    const [ncFiles, setNcFiles] = useState([]);
    const [ncLoading, setNcLoading] = useState(false);
    const [ncError, setNcError] = useState(null);

    useEffect(() => {
        if (source !== 'nextcloud') return;
        setNcLoading(true);
        setNcError(null);
        api.listNextcloudAudioFiles('/Recordings')
            .then(setNcFiles)
            .catch((e) => setNcError(e.message))
            .finally(() => setNcLoading(false));
    }, [source]);

    const handleFiles = async (files) => {
        const file = files?.[0];
        if (!file) return;
        clearError();
        await uploadFile(file);
        onComplete?.();
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-2 self-center">
                {[
                    ['file', 'My computer', FolderOpen],
                    ['nextcloud', 'Nextcloud', Cloud],
                ].map(([id, label, Icon]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setSource(id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
                        style={{
                            background: source === id ? 'color-mix(in srgb, var(--accent-primary) 14%, transparent)' : 'transparent',
                            borderColor: source === id ? 'var(--accent-primary)' : 'var(--border-default)',
                            color: source === id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        }}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                    </button>
                ))}
            </div>

            <CaptureControls serverDefault={serverDefault} localEnabled={localEnabled} />

            {source === 'file' && (
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
            )}

            {source === 'nextcloud' && (
                <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="px-4 py-2 border-b text-xs font-semibold flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                        <span>Nextcloud /Recordings</span>
                        {ncLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    </div>
                    <div className="max-h-64 overflow-auto">
                        {ncError && <div className="px-4 py-6 text-xs text-rose-500">{ncError}</div>}
                        {!ncError && !ncLoading && ncFiles.length === 0 && (
                            <div className="px-4 py-6 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                                No audio files found in /Recordings
                            </div>
                        )}
                        {ncFiles.map((file) => (
                            <button
                                key={file.path}
                                type="button"
                                onClick={async () => { await uploadFromNextcloud(file); onComplete?.(); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--bg-tertiary)] transition-colors"
                                disabled={uploading}
                            >
                                <FileAudio className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                                <span className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</span>
                                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                    {file.size ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : ''}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {(uploading || uploadStage) && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{uploadStage || 'Working…'}</span>
                </div>
            )}
            {uploadError && (
                <div className="text-xs text-rose-500">Upload failed: {uploadError.message}</div>
            )}
        </div>
    );
}
