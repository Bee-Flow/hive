import React, { useEffect, useState } from 'react';
import { MessageSquare, Loader2, FileAudio, Video, RefreshCw, Download } from 'lucide-react';
import CaptureControls from './CaptureControls';
import { useRecorder } from '../hooks/RecorderContext';
import { listNextcloudTalkRecordings } from '../lib/transcriptionsApi';

const NC_BLUE = '#0082C9';

function fmtSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(s) {
    if (!s) return '';
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : d.toLocaleString();
}

export default function TalkImportPanel({ onComplete }) {
    const { uploadFromNextcloud, uploading, uploadStage, uploadError, clearError } = useRecorder();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [busyPath, setBusyPath] = useState(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listNextcloudTalkRecordings();
            setRooms(Array.isArray(data?.rooms) ? data.rooms : []);
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

    const handleImport = async (rec) => {
        clearError();
        setBusyPath(rec.path);
        try {
            const outcome = await uploadFromNextcloud(rec);
            if (outcome?.ok) onComplete?.();
        } finally {
            setBusyPath(null);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <CaptureControls />

            <div className="flex items-center justify-between">
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Pick a call recording — Bee Flow transcribes it with your configured engine.
                </div>
                <button
                    type="button"
                    onClick={load}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {loading && (
                <div className="flex items-center gap-3 px-4 py-6 rounded-xl border justify-center" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: NC_BLUE }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading Talk recordings…</span>
                </div>
            )}

            {!loading && error && (
                <div className="flex flex-col gap-2 px-3 py-3 rounded-xl border text-xs" style={{ background: 'color-mix(in srgb, #ef4444 8%, var(--bg-secondary))', borderColor: '#ef4444', color: 'var(--text-primary)' }}>
                    <div className="font-semibold">Couldn't load recordings</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{error.message}</div>
                </div>
            )}

            {!loading && !error && rooms.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-4 py-10 rounded-xl border text-center" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `color-mix(in srgb, ${NC_BLUE} 12%, transparent)`, color: NC_BLUE }}>
                        <MessageSquare className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No Talk recordings found</div>
                    <div className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>
                        Record a call in Nextcloud Talk (the moderator can record audio-only or video). Finished recordings appear here automatically.
                    </div>
                </div>
            )}

            {!loading && !error && rooms.length > 0 && (
                <div className="flex flex-col gap-4 max-h-[48vh] overflow-y-auto pr-1">
                    {rooms.map((room) => (
                        <div key={room.token} className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 px-1">
                                <MessageSquare className="w-3.5 h-3.5" style={{ color: NC_BLUE }} />
                                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                    Conversation {room.token}
                                </span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {room.recordings.map((rec) => {
                                    const busy = uploading && busyPath === rec.path;
                                    const KindIcon = rec.kind === 'video' ? Video : FileAudio;
                                    return (
                                        <div
                                            key={rec.path}
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                                        >
                                            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${NC_BLUE} 12%, transparent)`, color: NC_BLUE }}>
                                                <KindIcon className="w-4.5 h-4.5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{rec.name}</div>
                                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                    {[rec.kind === 'video' ? 'Video' : 'Audio', fmtSize(rec.size), fmtDate(rec.lastModified)].filter(Boolean).join(' · ')}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleImport(rec)}
                                                disabled={uploading}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 flex-shrink-0"
                                                style={{ background: NC_BLUE }}
                                            >
                                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                                {busy ? 'Transcribing…' : 'Transcribe'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {(uploading || uploadStage) && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: NC_BLUE }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{uploadStage || 'Working…'}</span>
                </div>
            )}

            {uploadError && (
                <div className="flex flex-col gap-2 px-3 py-3 rounded-xl border text-xs" style={{ background: 'color-mix(in srgb, #ef4444 8%, var(--bg-secondary))', borderColor: '#ef4444', color: 'var(--text-primary)' }}>
                    <div className="font-semibold">Import failed</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{uploadError.message}</div>
                    <button
                        type="button"
                        onClick={clearError}
                        className="self-start px-3 py-1.5 rounded-lg text-xs font-medium border"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                    >
                        Dismiss
                    </button>
                </div>
            )}
        </div>
    );
}
