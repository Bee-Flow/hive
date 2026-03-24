import React, { useState, useRef, useEffect } from 'react';
import {
    Plus, Globe, Type, Upload, Trash2, Loader2,
    AlertCircle, CheckCircle2, X, ChevronRight, FileText, Mic
} from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

/* ── Source type metadata ─────────────────────────────────────── */
const SOURCE_META = {
    pdf:      { icon: '📄', color: '#ef4444', label: 'PDF' },
    docx:     { icon: '📝', color: '#3b82f6', label: 'Word' },
    xlsx:     { icon: '📊', color: '#22c55e', label: 'Excel' },
    csv:      { icon: '📊', color: '#22c55e', label: 'CSV' },
    text:     { icon: '📋', color: '#8b5cf6', label: 'Text' },
    url:      { icon: '🌐', color: '#f59e0b', label: 'URL' },
    gdrive:   { icon: '🔵', color: '#4285f4', label: 'Drive' },
    onedrive: { icon: '☁️', color: '#0078d4', label: 'OneDrive' },
    file:     { icon: '📁', color: '#6b7280', label: 'File' },
    meeting:  { icon: '🎙️', color: '#ec4899', label: 'Meeting' },
};

const STATUS_CONFIG = {
    processing: { bg: 'linear-gradient(135deg, #fef3c7, #fde68a)', text: '#92400e', icon: Loader2, anim: 'animate-spin', label: 'Processing' },
    ready:      { bg: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', text: '#065f46', icon: CheckCircle2, anim: '', label: 'Ready' },
    error:      { bg: 'linear-gradient(135deg, #fecaca, #fca5a5)', text: '#991b1b', icon: AlertCircle, anim: '', label: 'Error' },
};

export default function NotebookSources({
    sources, onFileUpload, onAddUrl, onAddText, onAddMeeting, onDeleteSource,
    dragOver, setDragOver, totalWords, readyCount
}) {
    const [showUpload, setShowUpload] = useState(null); // null | 'file' | 'url' | 'text' | 'meeting'
    const [urlInput, setUrlInput] = useState('');
    const [textInput, setTextInput] = useState('');
    const [textName, setTextName] = useState('');
    const fileInputRef = useRef();

    const [meetings, setMeetings] = useState([]);
    const [loadingMeetings, setLoadingMeetings] = useState(false);

    useEffect(() => {
        if (showUpload === 'meeting' && meetings.length === 0) {
            setLoadingMeetings(true);
            authFetch(`${API_BASE}/api/transcriptions`)
                .then(r => r.json())
                .then(data => setMeetings(data.transcriptions || []))
                .catch(err => console.error(err))
                .finally(() => setLoadingMeetings(false));
        }
    }, [showUpload, meetings.length]);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="shrink-0 px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>📚 Sources</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                    {readyCount}/{sources.length}
                </span>
            </div>

            {/* Add source buttons */}
            <div className="shrink-0 px-3 py-2 flex gap-1.5">
                <button onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-all hover:shadow-sm"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                    <Upload className="w-3 h-3" /> File
                </button>
                <button onClick={() => setShowUpload(showUpload === 'url' ? null : 'url')}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-all hover:shadow-sm"
                    style={{ borderColor: 'var(--border-subtle)', background: showUpload === 'url' ? 'var(--accent-primary)' : 'var(--bg-secondary)', color: showUpload === 'url' ? 'white' : 'var(--text-secondary)' }}>
                    <Globe className="w-3 h-3" /> URL
                </button>
                <button onClick={() => setShowUpload(showUpload === 'text' ? null : 'text')}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-all hover:shadow-sm"
                    style={{ borderColor: 'var(--border-subtle)', background: showUpload === 'text' ? 'var(--accent-primary)' : 'var(--bg-secondary)', color: showUpload === 'text' ? 'white' : 'var(--text-secondary)' }}>
                    <Type className="w-3 h-3" /> Text
                </button>
                <button onClick={() => setShowUpload(showUpload === 'meeting' ? null : 'meeting')}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-all hover:shadow-sm"
                    style={{ borderColor: 'var(--border-subtle)', background: showUpload === 'meeting' ? 'var(--accent-primary)' : 'var(--bg-secondary)', color: showUpload === 'meeting' ? 'white' : 'var(--text-secondary)' }}>
                    <Mic className="w-3 h-3" /> Notes
                </button>
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.json"
                    className="hidden" onChange={e => { onFileUpload(e.target.files); e.target.value = ''; }} />
            </div>

            {/* URL input */}
            {showUpload === 'url' && (
                <div className="px-3 pb-2 animate-in slide-in-from-top duration-200">
                    <div className="flex gap-1.5">
                        <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { onAddUrl(urlInput); setUrlInput(''); setShowUpload(null); } }}
                            placeholder="https://..."
                            className="flex-1 px-2 py-1.5 rounded-lg text-xs border outline-none"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                        <button onClick={() => { onAddUrl(urlInput); setUrlInput(''); setShowUpload(null); }}
                            className="px-2 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: 'var(--accent-primary)', color: 'white' }}>
                            Add
                        </button>
                    </div>
                </div>
            )}

            {/* Text input */}
            {showUpload === 'text' && (
                <div className="px-3 pb-2 space-y-1.5 animate-in slide-in-from-top duration-200">
                    <input value={textName} onChange={e => setTextName(e.target.value)}
                        placeholder="Name (optional)"
                        className="w-full px-2 py-1.5 rounded-lg text-xs border outline-none"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                    <textarea value={textInput} onChange={e => setTextInput(e.target.value)}
                        placeholder="Paste text..."
                        className="w-full px-2 py-1.5 rounded-lg text-xs border outline-none resize-none h-20"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                    <button onClick={() => { onAddText(textInput, textName); setTextInput(''); setTextName(''); setShowUpload(null); }}
                        className="w-full px-2 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: 'var(--accent-primary)', color: 'white' }}>
                        Add Text
                    </button>
                </div>
            )}

            {/* Meeting selector */}
            {showUpload === 'meeting' && (
                <div className="px-3 pb-2 animate-in slide-in-from-top duration-200">
                    <div className="flex flex-col gap-1">
                        {loadingMeetings ? (
                            <div className="flex items-center justify-center p-4">
                                <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
                            </div>
                        ) : meetings.length === 0 ? (
                            <div className="text-center p-2 text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] rounded border" style={{ borderColor: 'var(--border-subtle)' }}>
                                No meeting notes found.
                            </div>
                        ) : (
                            <div className="max-h-[120px] overflow-y-auto custom-scrollbar border rounded-lg bg-[var(--bg-secondary)] p-1 space-y-1" style={{ borderColor: 'var(--border-subtle)' }}>
                                {meetings.map(m => (
                                    <button key={m.id} onClick={() => { onAddMeeting?.(m.id); setShowUpload(null); }}
                                        className="w-full text-left px-2 py-1.5 rounded text-[11px] font-medium whitespace-nowrap overflow-hidden text-ellipsis hover:bg-[var(--bg-tertiary)] transition-colors"
                                        style={{ color: 'var(--text-primary)' }}>
                                        {m.title || `Meeting ${new Date(m.createdAt).toLocaleDateString()}`}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Source list */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-1 space-y-1"
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); onFileUpload(e.dataTransfer.files); }}
                style={dragOver ? { background: 'rgba(var(--accent-primary-rgb, 99,102,241), 0.05)', border: '2px dashed var(--accent-primary)' } : {}}
            >
                {sources.length === 0 && (
                    <div className="text-center py-8">
                        <div className="text-2xl mb-2">📂</div>
                        <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                            No sources yet
                        </p>
                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                            Add files, URLs, or text to get started
                        </p>
                    </div>
                )}
                {sources.map(source => {
                    const meta = SOURCE_META[source.type] || SOURCE_META.file;
                    const status = STATUS_CONFIG[source.status] || STATUS_CONFIG.processing;
                    const StatusIcon = status.icon;
                    return (
                        <div key={source.id} data-source-id={source.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg group transition-colors hover:bg-[var(--bg-tertiary)]">
                            <span className="text-sm">{meta.icon}</span>
                            <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                    {source.name}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <StatusIcon className={`w-2.5 h-2.5 ${status.anim}`} style={{ color: status.text }} />
                                    <span className="text-[9px]" style={{ color: status.text }}>{status.label}</span>
                                    {source.wordCount > 0 && (
                                        <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>
                                            · {source.wordCount.toLocaleString()} words
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => onDeleteSource(source.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 transition-all"
                                title="Remove source">
                                <Trash2 className="w-3 h-3 text-red-400" />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Footer stats */}
            {sources.length > 0 && (
                <div className="shrink-0 px-3 py-2 border-t text-[10px]" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                    {totalWords.toLocaleString()} words across {sources.length} source{sources.length !== 1 ? 's' : ''}
                </div>
            )}
        </div>
    );
}
