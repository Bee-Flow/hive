import React, { useState, useRef, useCallback } from 'react';
import {
    Globe, Type, Upload, Trash2, Loader2,
    AlertCircle, X, Mic,
    FileText, File, Table2, Link2,
    RotateCw, XCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import MeetingPicker from '../../components/meeting-picker/MeetingPicker';
import { useCapture } from '../meeting-notes/capture/CaptureContext';

/* ── Source type metadata ─────────────────────────────────────── */
export const SOURCE_META = {
    pdf:      { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'PDF',     Icon: FileText },
    docx:     { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  label: 'Word',    Icon: FileText },
    xlsx:     { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   label: 'Excel',   Icon: Table2 },
    csv:      { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   label: 'CSV',     Icon: Table2 },
    text:     { color: '#10b981', bg: 'rgba(16,185,129,0.1)', label: 'Text',    Icon: FileText },
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
    { key: 'file',    label: 'File',    Icon: Upload,  accent: '#3b82f6' },
    { key: 'url',     label: 'URL',     Icon: Globe,   accent: '#f59e0b' },
    { key: 'text',    label: 'Text',    Icon: Type,    accent: '#10b981' },
    { key: 'meeting', label: 'Notes',   Icon: Mic,     accent: '#ec4899' },
];

// Max characters for a pasted-text source (server still re-validates on ingest).
const PASTE_MAX_CHARS = 500000;

/* ── SourceCard ────────────────────────────────────────────────── */
function SourceCard({ source, onDelete, onRetry, onCancel }) {
    const meta  = SOURCE_META[source.type] || SOURCE_META.file;
    const { Icon } = meta;
    const isProcessing = source.status === 'processing';
    const isError      = source.status === 'error';
    const isReady      = source.status === 'ready';
    const [showDetails, setShowDetails] = useState(false);
    // File + url sources can be retried server-side (we still have the bytes or
    // the URL). Pasted text / drive-imported content isn't retained, so retry
    // is hidden for those types.
    const canRetry = isError && (source.type === 'url' || !!source.storageKey);

    return (
        <div
            className="group relative flex items-start gap-2.5 p-2.5 rounded-xl border transition-all hover:shadow-sm"
            style={{
                background: 'var(--bg-primary)',
                borderColor: isError ? 'rgba(239,68,68,0.35)' : isProcessing ? 'rgba(251,191,36,0.3)' : 'var(--border-subtle)',
            }}
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
                        <span className="flex items-center gap-0.5 text-[9px] font-medium" style={{ color: 'var(--warning)' }}>
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
                        <span className="flex items-center gap-0.5 text-[9px] font-medium" style={{ color: 'var(--error)' }}>
                            <AlertCircle className="w-2.5 h-2.5" />
                            Failed
                        </span>
                    )}
                </div>

                {/* Error detail — collapsible so long messages don't blow out the card.
                    The full error text reveals on click (previously only a tooltip). */}
                {isError && source.error && (
                    <div className="mt-1">
                        <button
                            onClick={() => setShowDetails(v => !v)}
                            className="flex items-center gap-0.5 text-[9px] font-medium hover:underline"
                            style={{ color: 'var(--error)' }}
                        >
                            {showDetails ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                            {showDetails ? 'Hide details' : 'Show details'}
                        </button>
                        {showDetails && (
                            <pre
                                className="mt-1 text-[9px] leading-snug whitespace-pre-wrap break-words p-1.5 rounded"
                                style={{ color: 'var(--error)', background: 'rgba(239,68,68,0.08)', maxHeight: '120px', overflow: 'auto' }}
                            >
                                {source.error}
                            </pre>
                        )}
                    </div>
                )}

                {/* Action row — retry / cancel / delete as icon pills. Previously the
                    user could only delete a failed source, which lost the uploaded bytes. */}
                {(isError || isProcessing) && (
                    <div className="flex items-center gap-1 mt-1.5">
                        {canRetry && (
                            <button
                                onClick={() => onRetry?.(source.id)}
                                className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-md transition-colors"
                                style={{ background: 'rgba(59,130,246,0.1)', color: '#2563eb' }}
                                title="Retry ingestion"
                            >
                                <RotateCw className="w-2.5 h-2.5" />
                                Retry
                            </button>
                        )}
                        {isProcessing && onCancel && (
                            <button
                                onClick={() => onCancel(source.id)}
                                className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-md transition-colors"
                                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                                title="Cancel ingestion"
                            >
                                <XCircle className="w-2.5 h-2.5" />
                                Cancel
                            </button>
                        )}
                    </div>
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

/* ── MeetingSourcePanel — replaces the old inline picker + recording UI ───
 * Uses the shared MeetingPicker. Recording is no longer inline — users start
 * one from the global Record FAB or the Meeting Notes page; the recording
 * finishes, the picker auto-refreshes, and they pick it from the list. */
function MeetingSourcePanel({ meetingMode, onChangeMode, onAddMeeting, onClose }) {
    const { openCapture } = useCapture();
    return (
        <div className="shrink-0 mx-3 mb-2 rounded-xl border p-3 space-y-3"
             style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', animation: 'fadeSlideDown 0.18s ease-out' }}>
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--accent-primary)' }}>Meeting Notes</span>
                <button onClick={onClose} className="p-0.5 rounded hover:bg-black/10 transition-colors">
                    <X className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                </button>
            </div>

            <div>
                <p className="text-[9px] uppercase font-bold tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>
                    Include as source
                </p>
                <div className="grid grid-cols-2 gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                    {[
                        { key: 'full', label: 'Full transcript' },
                        { key: 'summary', label: 'Summary only' },
                    ].map((opt) => {
                        const active = meetingMode === opt.key;
                        return (
                            <button
                                key={opt.key}
                                onClick={() => onChangeMode(opt.key)}
                                className="px-2 py-1 rounded-md text-[10px] font-semibold transition-all"
                                style={{
                                    background: active ? 'var(--bg-primary)' : 'transparent',
                                    color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                }}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <MeetingPicker
                mode="single"
                onSelect={(m) => onAddMeeting(m.id)}
                placeholder="Search meeting notes…"
                emptyAction={(
                    <button
                        type="button"
                        onClick={() => openCapture()}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold border"
                        style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    >
                        <Mic className="w-3 h-3" />
                        Capture one now
                    </button>
                )}
            />
        </div>
    );
}

/* ── Main component ─────────────────────────────────────────────── */
export default function NotebookSources({
    sources, onFileUpload, onAddUrl, onAddText, onAddMeeting, onDeleteSource,
    onRetrySource, onCancelSource,
    dragOver, setDragOver, totalWords, readyCount, showMeetingNotes = true
}) {
    const visibleButtons = showMeetingNotes ? ADD_BUTTONS : ADD_BUTTONS.filter(b => b.key !== 'meeting');
    const [activePanel, setActivePanel] = useState(null); // null | 'file' | 'url' | 'text' | 'meeting'
    const [urlInput,    setUrlInput]    = useState('');
    const [textInput,   setTextInput]   = useState('');
    const [textName,    setTextName]    = useState('');
    const fileInputRef = useRef();

    // ── Meeting ingestion mode: 'full' transcript or 'summary' only ──
    const [meetingMode, setMeetingMode] = useState(() => {
        try { return localStorage.getItem('nb_meeting_mode') === 'summary' ? 'summary' : 'full'; }
        catch { return 'full'; }
    });
    const updateMeetingMode = useCallback((m) => {
        setMeetingMode(m);
        try { localStorage.setItem('nb_meeting_mode', m); } catch {}
    }, []);

    const pasteOverLimit = textInput.length > PASTE_MAX_CHARS;

    // Add-source button behaviour. 'file' opens the OS picker (there's no inline
    // file panel); the other keys toggle their inline panel open/closed.
    const togglePanel = (key) => {
        if (key === 'file') { fileInputRef.current?.click(); return; }
        setActivePanel(prev => (prev === key ? null : key));
    };

    const submitUrl = () => {
        const u = urlInput.trim();
        if (!u) return;
        onAddUrl?.(u);
        setUrlInput('');
        setActivePanel(null);
    };

    const submitText = () => {
        const t = textInput.trim();
        if (!t || pasteOverLimit) return;
        onAddText?.(t, textName.trim() || undefined);
        setTextInput('');
        setTextName('');
        setActivePanel(null);
    };

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
                <div className="shrink-0 mx-3 mb-2 rounded-xl border p-3 space-y-2" style={{ background: 'var(--bg-secondary)', borderColor: 'rgba(16,185,129,0.3)', animation: 'fadeSlideDown 0.18s ease-out' }}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#10b981' }}>Paste Text</span>
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
                        maxLength={PASTE_MAX_CHARS}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs border outline-none resize-none"
                        style={{ background: 'var(--bg-primary)', borderColor: pasteOverLimit ? 'var(--error)' : 'var(--border-subtle)', color: 'var(--text-primary)', height: '80px' }}
                    />
                    {pasteOverLimit && (
                        <p className="text-[9px] font-medium" style={{ color: 'var(--error)' }}>
                            Too long — max {PASTE_MAX_CHARS.toLocaleString()} characters.
                        </p>
                    )}
                    <button
                        onClick={submitText}
                        disabled={!textInput.trim() || pasteOverLimit}
                        className="w-full py-1.5 rounded-lg text-[10px] font-bold transition-opacity disabled:opacity-40"
                        style={{ background: '#10b981', color: 'white' }}
                    >
                        Add Text
                    </button>
                </div>
            )}

            {/* ── Meeting Panel — uses shared MeetingPicker ── */}
            {activePanel === 'meeting' && (
                <MeetingSourcePanel
                    meetingMode={meetingMode}
                    onChangeMode={updateMeetingMode}
                    onAddMeeting={(id) => { onAddMeeting?.(id, { mode: meetingMode }); setActivePanel(null); }}
                    onClose={() => setActivePanel(null)}
                />
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
                        ? '2px dashed var(--brand-primary)'
                        : '2px dashed var(--border-subtle)',
                    background: dragOver ? 'var(--brand-gradient-soft)' : 'transparent',
                    transition: 'border-color 0.2s, background 0.2s',
                }}
            >
                {sources.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 px-2 select-none">
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                            style={{ background: 'var(--brand-gradient-soft)', border: '1px solid var(--border-subtle)' }}
                        >
                            <Upload className="w-6 h-6" style={{ color: 'var(--brand-primary)' }} />
                        </div>
                        <p className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                            Add your first source
                        </p>
                        <p className="text-[10px] text-center leading-relaxed mb-3" style={{ color: 'var(--text-tertiary)' }}>
                            PDFs, docs, URLs, or pasted text.<br/>Drop files here to upload.
                        </p>
                        <div className="grid grid-cols-2 gap-1.5 w-full">
                            {ADD_BUTTONS.map(({ key, label, Icon, accent }) => (
                                <button
                                    key={key}
                                    onClick={() => togglePanel(key)}
                                    className="flex flex-col items-center gap-1 py-2 rounded-lg border transition-all hover:shadow-sm"
                                    style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                                >
                                    <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
                                    <span className="text-[10px] font-medium">{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    sources.map(source => (
                        <SourceCard
                            key={source.id}
                            source={source}
                            onDelete={onDeleteSource}
                            onRetry={onRetrySource}
                            onCancel={onCancelSource}
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
                                    : 'var(--brand-gradient)',
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
