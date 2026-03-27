import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Globe, Type, Upload, Trash2, Loader2,
    AlertCircle, X, Mic, Plus, Search,
    FileText, File, Table2, Link2, Square, Radio
} from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

const LANGUAGES = [
    { code: 'nl', label: '🇳🇱 NL' },
    { code: 'en', label: '🇬🇧 EN' },
    { code: 'de', label: '🇩🇪 DE' },
    { code: 'fr', label: '🇫🇷 FR' },
    { code: 'es', label: '🇪🇸 ES' },
    { code: 'it', label: '🇮🇹 IT' },
    { code: 'pt', label: '🇵🇹 PT' },
];

function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

/* ── Source type metadata ─────────────────────────────────────── */
export const SOURCE_META = {
    pdf:      { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'PDF',     Icon: FileText },
    docx:     { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  label: 'Word',    Icon: FileText },
    xlsx:     { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   label: 'Excel',   Icon: Table2 },
    csv:      { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   label: 'CSV',     Icon: Table2 },
    text:     { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', label: 'Text',    Icon: FileText },
    url:      { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'URL',     Icon: Link2 },
    gdrive:   { color: '#4285f4', bg: 'rgba(66,133,244,0.1)', label: 'Drive',   Icon: File },
    onedrive: { color: '#0078d4', bg: 'rgba(0,120,212,0.1)',  label: 'OneDrive',Icon: File },
    file:     { color: '#6b7280', bg: 'rgba(107,114,128,0.1)','label': 'File',  Icon: File },
    meeting:  { color: '#ec4899', bg: 'rgba(236,72,153,0.1)', label: 'Meeting', Icon: Mic },
};

/* ── Inline styles ─────────────────────────────────────────────── */
const shimmerStyle = {
    background: 'linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.6s infinite',
};

/* ── Button variants for add-source ─────────────────────────────── */
const ADD_BUTTONS = [
    { key: 'file',    label: 'File',    Icon: Upload,  accent: '#6366f1' },
    { key: 'url',     label: 'URL',     Icon: Globe,   accent: '#f59e0b' },
    { key: 'text',    label: 'Text',    Icon: Type,    accent: '#8b5cf6' },
    { key: 'meeting', label: 'Notes',   Icon: Mic,     accent: '#ec4899' },
];

/* ── SourceCard ────────────────────────────────────────────────── */
function SourceCard({ source, onDelete }) {
    const meta  = SOURCE_META[source.type] || SOURCE_META.file;
    const { Icon } = meta;
    const isProcessing = source.status === 'processing';
    const isError      = source.status === 'error';
    const isReady      = source.status === 'ready';

    return (
        <div
            className="group relative flex items-start gap-2.5 p-2.5 rounded-xl border transition-all hover:shadow-sm"
            style={{
                background: 'var(--bg-primary)',
                borderColor: isError ? 'rgba(239,68,68,0.35)' : isProcessing ? 'rgba(251,191,36,0.3)' : 'var(--border-subtle)',
            }}
            title={isError && source.error ? `Error: ${source.error}` : ''}
        >
            {/* Left accent bar */}
            <div
                className="shrink-0 w-0.5 self-stretch rounded-full mt-0.5"
                style={{ background: isError ? '#ef4444' : isProcessing ? '#fbbf24' : meta.color }}
            />

            {/* Icon badge */}
            <div
                className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: meta.bg, color: meta.color }}
            >
                <Icon className="w-3.5 h-3.5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div
                    className="text-[11px] font-semibold truncate leading-tight"
                    style={{ color: 'var(--text-primary)' }}
                    title={source.name}
                >
                    {source.name}
                </div>

                <div className="flex items-center gap-1.5 mt-0.5">
                    {/* Type badge */}
                    <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                        style={{ background: meta.bg, color: meta.color }}
                    >
                        {meta.label}
                    </span>

                    {/* Status */}
                    {isProcessing && (
                        <span className="flex items-center gap-0.5 text-[9px] font-medium" style={{ color: '#92400e' }}>
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            Processing…
                        </span>
                    )}
                    {isReady && source.wordCount > 0 && (
                        <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>
                            {source.wordCount.toLocaleString()} words
                        </span>
                    )}
                    {isError && (
                        <span className="flex items-center gap-0.5 text-[9px] font-medium" style={{ color: '#ef4444' }}>
                            <AlertCircle className="w-2.5 h-2.5" />
                            Failed
                        </span>
                    )}
                </div>

                {/* Error detail */}
                {isError && source.error && (
                    <p className="text-[9px] mt-1 leading-tight truncate" style={{ color: '#ef4444' }} title={source.error}>
                        {source.error}
                    </p>
                )}

                {/* Processing shimmer bar */}
                {isProcessing && (
                    <div className="mt-1.5 h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="h-full w-1/2 rounded-full" style={{ ...shimmerStyle, background: 'linear-gradient(90deg, transparent, #fbbf24, transparent)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                    </div>
                )}
            </div>

            {/* Delete button */}
            <button
                onClick={() => onDelete(source.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/10 transition-all"
                title="Remove source"
            >
                <Trash2 className="w-3 h-3 text-red-400" />
            </button>
        </div>
    );
}

/* ── MeetingItem ─────────────────────────────────────────────── */
function MeetingItem({ meeting, onSelect }) {
    const date = meeting.createdAt ? new Date(meeting.createdAt) : null;
    const dateStr = date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    return (
        <button
            onClick={() => onSelect(meeting.id)}
            className="w-full text-left px-3 py-2 rounded-xl border transition-all hover:shadow-sm hover:border-[var(--accent-primary)] group"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
        >
            <div className="flex items-center gap-2">
                <div className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(236,72,153,0.1)', color: '#ec4899' }}>
                    <Mic className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {meeting.title || 'Untitled Meeting'}
                    </div>
                    {dateStr && (
                        <div className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>{dateStr}</div>
                    )}
                </div>
                <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--accent-primary)' }} />
            </div>
        </button>
    );
}

/* ── Main component ─────────────────────────────────────────────── */
export default function NotebookSources({
    sources, onFileUpload, onAddUrl, onAddText, onAddMeeting, onDeleteSource,
    dragOver, setDragOver, totalWords, readyCount, showMeetingNotes = true
}) {
    const visibleButtons = showMeetingNotes ? ADD_BUTTONS : ADD_BUTTONS.filter(b => b.key !== 'meeting');
    const [activePanel, setActivePanel] = useState(null); // null | 'file' | 'url' | 'text' | 'meeting'
    const [urlInput,    setUrlInput]    = useState('');
    const [textInput,   setTextInput]   = useState('');
    const [textName,    setTextName]    = useState('');
    const [meetingSearch, setMeetingSearch] = useState('');

    const [meetings,        setMeetings]        = useState([]);
    const [loadingMeetings, setLoadingMeetings] = useState(false);
    const fileInputRef = useRef();

    // ── Recording state ──────────────────────────────
    const [recLang,      setRecLang]      = useState('nl');
    const [isRecording,  setIsRecording]  = useState(false);
    const [recTime,      setRecTime]      = useState(0);
    const [recStatus,    setRecStatus]    = useState('idle'); // 'idle' | 'recording' | 'uploading' | 'done' | 'error'
    const [recError,     setRecError]     = useState('');
    const [recStage,     setRecStage]     = useState('');
    const mediaRecorderRef = useRef(null);
    const chunksRef        = useRef([]);
    const timerRef         = useRef(null);
    const streamRef        = useRef(null);

    const TRANSCRIPTION_STAGES = [
        'Uploading audio…',
        'Converting audio…',
        'Transcribing speech…',
        'Identifying speakers…',
        'Generating summary…',
        'Finalizing…',
    ];

    const startRecording = useCallback(async () => {
        setRecError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            chunksRef.current = [];

            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : 'audio/mp4';

            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

            recorder.onstop = async () => {
                const ext  = mimeType.includes('webm') ? 'webm' : 'mp4';
                const blob = new Blob(chunksRef.current, { type: mimeType });
                const file = new File([blob], `recording.${ext}`, { type: mimeType });

                // Upload + transcribe
                setRecStatus('uploading');
                let stageIdx = 0;
                setRecStage(TRANSCRIPTION_STAGES[0]);
                const stageTimer = setInterval(() => {
                    stageIdx = Math.min(stageIdx + 1, TRANSCRIPTION_STAGES.length - 1);
                    setRecStage(TRANSCRIPTION_STAGES[stageIdx]);
                }, 12000);

                const now  = new Date();
                const title = `Meeting ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
                const formData = new FormData();
                formData.append('audio', file);
                formData.append('language', recLang);
                formData.append('title', title);

                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 600000);
                    const res = await authFetch(`${API_BASE}/api/transcriptions`, {
                        method: 'POST',
                        body: formData,
                        signal: controller.signal,
                    });
                    clearTimeout(timeout);
                    clearInterval(stageTimer);

                    if (res.ok) {
                        const result = await res.json();
                        setRecStatus('done');
                        setRecStage('');
                        onAddMeeting?.(result.id);
                        setTimeout(() => { setRecStatus('idle'); setRecTime(0); }, 2500);
                    } else {
                        const err = await res.json();
                        setRecStatus('error');
                        setRecError(err.error || 'Transcription failed');
                        clearInterval(stageTimer);
                    }
                } catch (err) {
                    clearInterval(stageTimer);
                    setRecStatus('error');
                    setRecError(err.name === 'AbortError' ? 'Timed out after 10 min' : err.message);
                }
            };

            recorder.start(1000);
            setIsRecording(true);
            setRecStatus('recording');
            setRecTime(0);
            timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000);
        } catch (err) {
            setRecStatus('error');
            setRecError('Microphone access denied. Allow mic in browser settings.');
        }
    }, [recLang, onAddMeeting]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        clearInterval(timerRef.current);
        setIsRecording(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            clearInterval(timerRef.current);
        };
    }, []);

    useEffect(() => {
        if (activePanel === 'meeting' && meetings.length === 0) {
            setLoadingMeetings(true);
            authFetch(`${API_BASE}/api/transcriptions`)
                .then(r => r.json())
                .then(data => setMeetings(data.transcriptions || []))
                .catch(err => console.error(err))
                .finally(() => setLoadingMeetings(false));
        }
    }, [activePanel]);

    const togglePanel = (key) => {
        if (key === 'file') { fileInputRef.current?.click(); return; }
        setActivePanel(p => (p === key ? null : key));
    };

    const submitUrl = () => {
        if (!urlInput.trim()) return;
        onAddUrl(urlInput.trim());
        setUrlInput('');
        setActivePanel(null);
    };

    const submitText = () => {
        if (!textInput.trim()) return;
        onAddText(textInput.trim(), textName.trim() || undefined);
        setTextInput('');
        setTextName('');
        setActivePanel(null);
    };

    const filteredMeetings = meetings.filter(m =>
        !meetingSearch || (m.title || '').toLowerCase().includes(meetingSearch.toLowerCase())
    );

    const readyPct = sources.length > 0 ? Math.round((readyCount / sources.length) * 100) : 0;

    return (
        <div className="flex flex-col h-full">

            {/* ── Keyframe injection ── */}
            <style>{`
                @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
                @keyframes fadeSlideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
            `}</style>

            {/* ── Header ── */}
            <div className="shrink-0 px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--text-secondary)' }}>
                    Sources
                </span>
                <div className="flex items-center gap-1.5">
                    {sources.length > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                            {readyCount}<span style={{opacity:0.5}}>/{sources.length}</span>
                        </span>
                    )}
                </div>
            </div>

            {/* ── Add source buttons ── */}
            <div className={`shrink-0 px-3 pt-2.5 pb-2 grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${visibleButtons.length}, 1fr)` }}>
                {visibleButtons.map(({ key, label, Icon, accent }) => {
                    const isActive = activePanel === key;
                    return (
                        <button
                            key={key}
                            onClick={() => togglePanel(key)}
                            className="flex flex-col items-center gap-1 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wide border transition-all"
                            style={{
                                borderColor: isActive ? accent : 'var(--border-subtle)',
                                background: isActive ? `${accent}18` : 'var(--bg-secondary)',
                                color: isActive ? accent : 'var(--text-secondary)',
                                boxShadow: isActive ? `0 0 0 1px ${accent}40` : 'none',
                            }}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                        </button>
                    );
                })}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.json"
                    className="hidden"
                    onChange={e => { onFileUpload(e.target.files); e.target.value = ''; }}
                />
            </div>

            {/* ── URL Panel ── */}
            {activePanel === 'url' && (
                <div className="shrink-0 mx-3 mb-2 rounded-xl border p-3 space-y-2" style={{ background: 'var(--bg-secondary)', borderColor: 'rgba(245,158,11,0.3)', animation: 'fadeSlideDown 0.18s ease-out' }}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#f59e0b' }}>Add URL</span>
                        <button onClick={() => setActivePanel(null)} className="p-0.5 rounded hover:bg-black/10 transition-colors">
                            <X className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                        </button>
                    </div>
                    <div className="flex gap-1.5">
                        <input
                            autoFocus
                            value={urlInput}
                            onChange={e => setUrlInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') submitUrl(); if (e.key === 'Escape') setActivePanel(null); }}
                            placeholder="https://..."
                            className="flex-1 px-2.5 py-1.5 rounded-lg text-xs border outline-none"
                            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                        />
                        <button
                            onClick={submitUrl}
                            disabled={!urlInput.trim()}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-opacity disabled:opacity-40"
                            style={{ background: '#f59e0b', color: 'white' }}
                        >
                            Add
                        </button>
                    </div>
                </div>
            )}

            {/* ── Text Panel ── */}
            {activePanel === 'text' && (
                <div className="shrink-0 mx-3 mb-2 rounded-xl border p-3 space-y-2" style={{ background: 'var(--bg-secondary)', borderColor: 'rgba(139,92,246,0.3)', animation: 'fadeSlideDown 0.18s ease-out' }}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#8b5cf6' }}>Paste Text</span>
                        <button onClick={() => setActivePanel(null)} className="p-0.5 rounded hover:bg-black/10 transition-colors">
                            <X className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                        </button>
                    </div>
                    <input
                        value={textName}
                        onChange={e => setTextName(e.target.value)}
                        placeholder="Name (optional)"
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs border outline-none"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                    />
                    <textarea
                        autoFocus
                        value={textInput}
                        onChange={e => setTextInput(e.target.value)}
                        placeholder="Paste your text here…"
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs border outline-none resize-none"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)', height: '80px' }}
                    />
                    <button
                        onClick={submitText}
                        disabled={!textInput.trim()}
                        className="w-full py-1.5 rounded-lg text-[10px] font-bold transition-opacity disabled:opacity-40"
                        style={{ background: '#8b5cf6', color: 'white' }}
                    >
                        Add Text
                    </button>
                </div>
            )}

            {/* ── Meeting Panel ── */}
            {activePanel === 'meeting' && (
                <div className="shrink-0 mx-3 mb-2 rounded-xl border p-3 space-y-2" style={{ background: 'var(--bg-secondary)', borderColor: 'rgba(236,72,153,0.3)', animation: 'fadeSlideDown 0.18s ease-out' }}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#ec4899' }}>Meeting Notes</span>
                        <button onClick={() => setActivePanel(null)} className="p-0.5 rounded hover:bg-black/10 transition-colors">
                            <X className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                        </button>
                    </div>

        {/* ── NEW: Inline Recording Panel ── */}
                    <div className="pb-2">
                        {/* Language + record controls */}
                        <div className="flex items-center gap-1.5 mb-2">
                            <select
                                value={recLang}
                                onChange={e => setRecLang(e.target.value)}
                                disabled={isRecording || recStatus === 'uploading'}
                                className="flex-1 text-[10px] px-2 py-1.5 rounded-lg border outline-none cursor-pointer"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                            >
                                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                            </select>

                            {!isRecording && recStatus !== 'uploading' && (
                                <button
                                    onClick={startRecording}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-[1.03] active:scale-95"
                                    style={{ background: '#ec4899', color: 'white' }}
                                    title="Start recording"
                                >
                                    <Radio className="w-3 h-3" />
                                    Record
                                </button>
                            )}

                            {isRecording && (
                                <button
                                    onClick={stopRecording}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-[1.03] active:scale-95"
                                    style={{ background: '#ef4444', color: 'white' }}
                                    title="Stop and transcribe"
                                >
                                    <Square className="w-3 h-3" />
                                    Stop
                                </button>
                            )}
                        </div>

                        {/* Recording indicator */}
                        {isRecording && (
                            <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl border"
                                style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.25)' }}>
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#ef4444', animation: 'pulse 1s infinite' }} />
                                <span className="text-[11px] font-bold tabular-nums" style={{ color: '#ef4444' }}>{formatTime(recTime)}</span>
                                <span className="text-[10px] ml-auto" style={{ color: 'var(--text-tertiary)' }}>Recording…</span>
                            </div>
                        )}

                        {/* Upload/transcription progress */}
                        {recStatus === 'uploading' && (
                            <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl border"
                                style={{ background: 'rgba(236,72,153,0.06)', borderColor: 'rgba(236,72,153,0.25)' }}>
                                <Loader2 className="w-3 h-3 animate-spin shrink-0" style={{ color: '#ec4899' }} />
                                <span className="text-[10px] font-medium" style={{ color: '#ec4899' }}>{recStage}</span>
                            </div>
                        )}

                        {/* Done */}
                        {recStatus === 'done' && (
                            <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl border"
                                style={{ background: 'rgba(34,197,94,0.07)', borderColor: 'rgba(34,197,94,0.25)' }}>
                                <span className="text-sm">✅</span>
                                <span className="text-[10px] font-medium" style={{ color: '#16a34a' }}>Added to notebook!</span>
                            </div>
                        )}

                        {/* Error */}
                        {recStatus === 'error' && (
                            <div className="space-y-1.5">
                                <div className="flex items-start gap-2 px-2.5 py-2 rounded-xl border"
                                    style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.25)' }}>
                                    <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                                    <span className="text-[10px] leading-tight" style={{ color: '#ef4444' }}>{recError}</span>
                                </div>
                                <button
                                    onClick={() => { setRecStatus('idle'); setRecError(''); }}
                                    className="w-full text-[10px] py-1 rounded-lg border transition-colors"
                                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                                >
                                    Dismiss
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="border-t mb-2" style={{ borderColor: 'var(--border-subtle)' }} />
                    <p className="text-[9px] uppercase font-bold tracking-wide mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Existing notes</p>

                    {loadingMeetings ? (
                        <div className="flex items-center justify-center py-4 gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
                            <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#ec4899' }} />
                            <span className="text-[10px]">Loading meetings…</span>
                        </div>
                    ) : meetings.length === 0 ? (
                        <div className="text-center py-3">
                            <Mic className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--text-tertiary)' }} />
                            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>No meeting notes yet</p>
                        </div>
                    ) : (
                        <>
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                                <input
                                    value={meetingSearch}
                                    onChange={e => setMeetingSearch(e.target.value)}
                                    placeholder="Search meetings…"
                                    className="w-full pl-6 pr-2.5 py-1.5 rounded-lg text-xs border outline-none"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                />
                            </div>
                            <div className="space-y-1 max-h-[160px] overflow-y-auto custom-scrollbar pr-0.5 mt-1">
                                {filteredMeetings.length === 0 ? (
                                    <p className="text-center text-[10px] py-2" style={{ color: 'var(--text-tertiary)' }}>No matches</p>
                                ) : filteredMeetings.map(m => (
                                    <MeetingItem
                                        key={m.id}
                                        meeting={m}
                                        onSelect={(id) => { onAddMeeting?.(id); setActivePanel(null); setMeetingSearch(''); }}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Source list (scrollable, drop zone) ── */}
            <div
                className="flex-1 overflow-y-auto custom-scrollbar px-3 py-1 space-y-1.5 transition-all"
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
                onDrop={e => { e.preventDefault(); setDragOver(false); onFileUpload(e.dataTransfer.files); }}
                style={{
                    borderRadius: '12px',
                    margin: '0 8px 8px',
                    padding: dragOver ? '8px' : '4px 4px',
                    border: dragOver
                        ? '2px dashed var(--accent-primary)'
                        : '2px dashed var(--border-subtle)',
                    background: dragOver ? 'rgba(99,102,241,0.04)' : 'transparent',
                    transition: 'border-color 0.2s, background 0.2s',
                }}
            >
                {sources.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-10 select-none">
                        <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}
                        >
                            <Upload className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                        </div>
                        <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                            No sources yet
                        </p>
                        <p className="text-[10px] text-center leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                            Add files, URLs, or text above,<br/>or drag &amp; drop files here
                        </p>
                    </div>
                ) : (
                    sources.map(source => (
                        <SourceCard
                            key={source.id}
                            source={source}
                            onDelete={onDeleteSource}
                        />
                    ))
                )}
            </div>

            {/* ── Footer stats ── */}
            {sources.length > 0 && (
                <div className="shrink-0 px-3 pb-2.5 space-y-1.5">
                    {/* Progress bar */}
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${readyPct}%`,
                                background: readyPct === 100
                                    ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                                    : 'linear-gradient(90deg, var(--accent-primary), #6366f1)',
                            }}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                            {readyCount === sources.length
                                ? `All ${sources.length} source${sources.length !== 1 ? 's' : ''} ready`
                                : `${readyCount} / ${sources.length} ready`}
                        </span>
                        <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>
                            {totalWords.toLocaleString()} words
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
