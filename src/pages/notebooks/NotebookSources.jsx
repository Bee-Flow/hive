import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Globe, Type, Upload, Trash2, Loader2,
    AlertCircle, X, Mic,
    FileText, File, Table2, Link2,
    RotateCw, XCircle, ChevronDown, ChevronUp,
    GripVertical, Eye, Check, Copy, Pencil, CheckSquare,
} from 'lucide-react';
import MeetingPicker from '../../components/meeting-picker/MeetingPicker';
import { useCapture } from '../meeting-notes/capture/CaptureContext';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import useTranslation from '../../hooks/useTranslation';

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

// Ingest stage → label. Built per-render from `t` (the panel ships in Dutch too).
const stageLabel = (t, stage) => ({
    queued: t('notebooks.stage_queued', 'Queued…'),
    extracting: t('notebooks.stage_extracting', 'Reading…'),
    fetching: t('notebooks.stage_fetching', 'Fetching…'),
    embedding: t('notebooks.stage_embedding', 'Indexing…'),
}[stage] || t('notebooks.stage_processing', 'Processing…'));

const shimmerStyle = {
    background: 'linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.6s infinite',
};

const addButtons = (t) => [
    { key: 'file',    label: t('notebooks.src_file', 'File'),  Icon: Upload, accent: '#3b82f6', desc: t('notebooks.src_file_desc', 'PDF, Word, Excel, CSV…') },
    { key: 'url',     label: t('notebooks.src_url', 'URL'),    Icon: Globe,  accent: '#f59e0b', desc: t('notebooks.src_url_desc', 'Fetch a web page') },
    { key: 'text',    label: t('notebooks.src_text', 'Text'),  Icon: Type,   accent: '#10b981', desc: t('notebooks.src_text_desc', 'Paste any text') },
    { key: 'meeting', label: t('notebooks.src_notes', 'Notes'), Icon: Mic,   accent: '#ec4899', desc: t('notebooks.src_notes_desc', 'From a meeting note') },
];

// Max characters for a pasted-text source (server still re-validates on ingest).
const PASTE_MAX_CHARS = 500000;

/* ── SourceCard ────────────────────────────────────────────────── */
function SourceCard({
    source, onDelete, onRetry, onCancel, onPreview, onRename,
    selectable, selected, onToggleSelect,
    onDragStart, onDragOver, onDrop, dragging, t,
}) {
    const meta  = SOURCE_META[source.type] || SOURCE_META.file;
    const { Icon } = meta;
    const isProcessing = source.status === 'processing';
    const isError      = source.status === 'error';
    const isReady      = source.status === 'ready';
    const isDuplicate  = isReady && source.metadata?.duplicate;
    const [showDetails, setShowDetails] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(source.name);
    const inputRef = useRef(null);
    useEffect(() => { setDraft(source.name); }, [source.name]);
    useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

    // File + url sources retry from stored bytes/URL; text/meeting now retry from
    // stored extracted text (hasContent).
    const canRetry = isError && (source.type === 'url' || !!source.storageKey || source.hasContent);
    const canPreview = !!source.hasContent;

    const commitRename = () => {
        setEditing(false);
        const v = draft.trim();
        if (v && v !== source.name) onRename?.(source.id, v);
        else setDraft(source.name);
    };

    return (
        <div
            draggable={!editing}
            onDragStart={(e) => onDragStart?.(e, source.id)}
            onDragOver={(e) => onDragOver?.(e, source.id)}
            onDrop={(e) => onDrop?.(e, source.id)}
            className="group relative flex items-start gap-2 p-2.5 rounded-xl border transition-all hover:shadow-sm"
            style={{
                background: selected ? 'var(--accent-primary)0d' : 'var(--bg-primary)',
                borderColor: selected ? 'var(--accent-primary)' : isError ? 'rgba(239,68,68,0.35)' : isProcessing ? 'rgba(251,191,36,0.3)' : 'var(--border-subtle)',
                opacity: dragging ? 0.4 : 1,
            }}
        >
            {/* drag handle / select checkbox */}
            <div className="shrink-0 flex flex-col items-center pt-0.5">
                {selectable ? (
                    <button onClick={(e) => { e.stopPropagation(); onToggleSelect?.(source.id); }}
                        className="w-4 h-4 rounded border flex items-center justify-center transition-colors"
                        style={selected ? { background: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' } : { borderColor: 'var(--border-default)' }}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                    </button>
                ) : (
                    <span className="cursor-grab opacity-0 group-hover:opacity-60 transition-opacity" title="Drag to reorder">
                        <GripVertical className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                    </span>
                )}
            </div>

            {/* Icon badge */}
            <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: meta.bg, color: meta.color }}>
                <Icon className="w-3.5 h-3.5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {editing ? (
                    <input
                        ref={inputRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setDraft(source.name); setEditing(false); } }}
                        className="w-full text-[11px] font-semibold px-1 py-0.5 rounded border outline-none"
                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--accent-primary)', color: 'var(--text-primary)' }}
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => canPreview && onPreview?.(source)}
                        onDoubleClick={() => setEditing(true)}
                        className={`block w-full text-left text-[11px] font-semibold truncate leading-tight ${canPreview ? 'hover:underline' : ''}`}
                        style={{ color: 'var(--text-primary)', cursor: canPreview ? 'pointer' : 'default' }}
                        title={canPreview ? source.name : source.name}
                    >
                        {source.name}
                    </button>
                )}

                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                    {isProcessing && (
                        <span className="flex items-center gap-0.5 text-[9px] font-medium" style={{ color: 'var(--warning, #d97706)' }}>
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            {stageLabel(t, source.stage)}
                        </span>
                    )}
                    {isReady && source.wordCount > 0 && (
                        <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>{t('notebooks.n_words', { count: source.wordCount.toLocaleString() })}</span>
                    )}
                    {isDuplicate && (
                        <span className="flex items-center gap-0.5 text-[9px] font-medium px-1 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }} title={t('notebooks.duplicate_title', 'Duplicate of an existing source')}>
                            <Copy className="w-2.5 h-2.5" /> {t('notebooks.duplicate', 'Duplicate')}
                        </span>
                    )}
                    {isError && (
                        <span className="flex items-center gap-0.5 text-[9px] font-medium" style={{ color: 'var(--error, #ef4444)' }}>
                            <AlertCircle className="w-2.5 h-2.5" /> {t('notebooks.failed', 'Failed')}
                        </span>
                    )}
                </div>

                {isError && source.error && (
                    <div className="mt-1">
                        <button onClick={() => setShowDetails(v => !v)} className="flex items-center gap-0.5 text-[9px] font-medium hover:underline" style={{ color: 'var(--error, #ef4444)' }}>
                            {showDetails ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                            {showDetails ? t('notebooks.hide_details', 'Hide details') : t('notebooks.show_details', 'Show details')}
                        </button>
                        {showDetails && (
                            <pre className="mt-1 text-[9px] leading-snug whitespace-pre-wrap break-words p-1.5 rounded" style={{ color: 'var(--error, #ef4444)', background: 'rgba(239,68,68,0.08)', maxHeight: '120px', overflow: 'auto' }}>{source.error}</pre>
                        )}
                    </div>
                )}

                {(isError || isProcessing) && (
                    <div className="flex items-center gap-1 mt-1.5">
                        {canRetry && (
                            <button onClick={() => onRetry?.(source.id)} className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(59,130,246,0.1)', color: '#2563eb' }} title={t('notebooks.retry_ingestion', 'Retry ingestion')}>
                                <RotateCw className="w-2.5 h-2.5" /> {t('notebooks.retry', 'Retry')}
                            </button>
                        )}
                        {isProcessing && onCancel && (
                            <button onClick={() => onCancel(source.id)} className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }} title={t('notebooks.cancel_ingestion', 'Cancel ingestion')}>
                                <XCircle className="w-2.5 h-2.5" /> {t('common.cancel', 'Cancel')}
                            </button>
                        )}
                    </div>
                )}

                {isProcessing && (
                    <div className="mt-1.5 h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="h-full w-1/2 rounded-full" style={{ ...shimmerStyle, background: 'linear-gradient(90deg, transparent, #fbbf24, transparent)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                    </div>
                )}
            </div>

            {/* hover actions */}
            {/* focus-within keeps these reachable by keyboard: opacity-0 alone
                made every per-source action mouse-only. */}
            {!selectable && (
                <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all">
                    {canPreview && (
                        <button onClick={() => onPreview?.(source)} className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)]" title={t('notebooks.preview', 'Preview')} aria-label={t('notebooks.preview', 'Preview')}>
                            <Eye className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                        </button>
                    )}
                    <button onClick={() => setEditing(true)} className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)]" title={t('notebooks.rename', 'Rename')} aria-label={t('notebooks.rename', 'Rename')}>
                        <Pencil className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                    </button>
                    <button onClick={() => onDelete(source.id)} className="p-1 rounded-lg hover:bg-red-500/10" title={t('notebooks.remove_source', 'Remove source')} aria-label={t('notebooks.remove_source', 'Remove source')}>
                        <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                </div>
            )}
        </div>
    );
}

/* ── Preview modal ─────────────────────────────────────────────── */
function SourcePreviewModal({ preview, onClose, t }) {
    useEffect(() => {
        const h = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, [onClose]);
    return createPortal(
        <div className="fixed inset-0 z-[10060] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onMouseDown={onClose}>
            <div className="w-full max-w-[640px] max-h-[80vh] flex flex-col rounded-2xl border shadow-2xl" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }} onMouseDown={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                    <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{preview.name}</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-secondary)' }}><X className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {preview.loading ? (
                        <div className="flex items-center justify-center py-10" style={{ color: 'var(--text-muted)' }}><Loader2 className="w-5 h-5 animate-spin" /></div>
                    ) : preview.content ? (
                        <pre className="text-[12px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: 'var(--text-secondary)', fontFamily: 'inherit' }}>{preview.content}</pre>
                    ) : (
                        <p className="text-[12px] text-center py-10" style={{ color: 'var(--text-muted)' }}>{t('notebooks.no_preview', 'No preview available for this source.')}</p>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}

/* ── MeetingSourcePanel ────────────────────────────────────────── */
function MeetingSourcePanel({ meetingMode, onChangeMode, onAddMeeting, onClose, t }) {
    const { openCapture } = useCapture();
    return (
        <div className="shrink-0 mx-3 mb-2 rounded-xl border p-3 space-y-3"
             style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', animation: 'fadeSlideDown 0.18s ease-out' }}>
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--accent-primary)' }}>{t('notebooks.meeting_notes', 'Meeting Notes')}</span>
                <button onClick={onClose} className="p-0.5 rounded hover:bg-black/10 transition-colors" aria-label={t('notebooks.close', 'Close')}>
                    <X className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                </button>
            </div>
            <div>
                <p className="text-[9px] uppercase font-bold tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>{t('notebooks.include_as_source', 'Include as source')}</p>
                <div className="grid grid-cols-2 gap-0.5 p-0.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                    {[{ key: 'full', label: t('notebooks.full_transcript', 'Full transcript') }, { key: 'summary', label: t('notebooks.summary_only', 'Summary only') }].map((opt) => {
                        const active = meetingMode === opt.key;
                        return (
                            <button key={opt.key} onClick={() => onChangeMode(opt.key)} className="px-2 py-1 rounded-md text-[10px] font-semibold transition-all"
                                style={{ background: active ? 'var(--bg-primary)' : 'transparent', color: active ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            <MeetingPicker
                mode="single"
                onSelect={(m) => onAddMeeting(m.id)}
                placeholder={t('notebooks.search_meeting_notes', 'Search meeting notes…')}
                emptyAction={(
                    <button type="button" onClick={() => openCapture()} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold border" style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
                        <Mic className="w-3 h-3" /> {t('notebooks.capture_one_now', 'Capture one now')}
                    </button>
                )}
            />
        </div>
    );
}

/* ── Main component ─────────────────────────────────────────────── */
export default function NotebookSources({
    sources, onFileUpload, onAddUrl, onAddText, onAddMeeting, onDeleteSource,
    onRetrySource, onCancelSource, onRenameSource, onReorderSources, onBulkDelete, onPreviewSource,
    dragOver, setDragOver, totalWords, readyCount, showMeetingNotes = true
}) {
    const { t } = useTranslation();
    const visibleButtons = React.useMemo(() => {
        const all = addButtons(t);
        return showMeetingNotes ? all : all.filter(b => b.key !== 'meeting');
    }, [t, showMeetingNotes]);
    const [activePanel, setActivePanel] = useState(null);
    const [urlInput, setUrlInput] = useState('');
    const [textInput, setTextInput] = useState('');
    const [textName, setTextName] = useState('');
    const fileInputRef = useRef();

    // selection (bulk delete)
    const [selectMode, setSelectMode] = useState(false);
    const [selected, setSelected] = useState(() => new Set());
    const [confirmBulk, setConfirmBulk] = useState(false);
    // drag-reorder
    const [dragId, setDragId] = useState(null);
    // preview
    const [preview, setPreview] = useState(null);

    const [meetingMode, setMeetingMode] = useState(() => {
        try { return localStorage.getItem('nb_meeting_mode') === 'summary' ? 'summary' : 'full'; } catch { return 'full'; }
    });
    const updateMeetingMode = useCallback((m) => { setMeetingMode(m); try { localStorage.setItem('nb_meeting_mode', m); } catch { /* noop */ } }, []);

    const pasteOverLimit = textInput.length > PASTE_MAX_CHARS;

    const togglePanel = (key) => {
        if (key === 'file') { fileInputRef.current?.click(); return; }
        setActivePanel(prev => (prev === key ? null : key));
    };
    const submitUrl = () => { const u = urlInput.trim(); if (!u) return; onAddUrl?.(u); setUrlInput(''); setActivePanel(null); };
    const submitText = () => { const t = textInput.trim(); if (!t || pasteOverLimit) return; onAddText?.(t, textName.trim() || undefined); setTextInput(''); setTextName(''); setActivePanel(null); };

    const toggleSelect = (id) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const clearSelection = () => { setSelected(new Set()); setSelectMode(false); };
    const doBulkDelete = () => { onBulkDelete?.([...selected]); clearSelection(); setConfirmBulk(false); };

    const openPreview = useCallback(async (source) => {
        setPreview({ name: source.name, loading: true, content: '' });
        try { const data = await onPreviewSource?.(source.id); setPreview({ name: data?.name || source.name, loading: false, content: data?.content || '' }); }
        catch (e) { setPreview({ name: source.name, loading: false, content: '' }); }
    }, [onPreviewSource]);

    // drag reorder handlers
    const onCardDragStart = (e, id) => { setDragId(id); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', id); } catch (err) { /* noop */ } };
    const onCardDragOver = (e) => { if (dragId) e.preventDefault(); };
    const onCardDrop = (e, targetId) => {
        if (!dragId || dragId === targetId) { setDragId(null); return; }
        e.preventDefault(); e.stopPropagation();
        const arr = sources.slice();
        const from = arr.findIndex(s => s.id === dragId);
        const to = arr.findIndex(s => s.id === targetId);
        if (from < 0 || to < 0) { setDragId(null); return; }
        const [moved] = arr.splice(from, 1);
        arr.splice(to, 0, moved);
        onReorderSources?.(arr);
        setDragId(null);
    };

    const readyPct = sources.length > 0 ? Math.round((readyCount / sources.length) * 100) : 0;

    return (
        <div className="flex flex-col h-full">
            <style>{`
                @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
                @keyframes fadeSlideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
            `}</style>

            {/* Header */}
            <div className="shrink-0 px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--text-secondary)' }}>{t('notebooks.sources', 'Sources')}</span>
                <div className="flex items-center gap-1.5">
                    {sources.length > 0 && (
                        <>
                            <button onClick={() => { setSelectMode(v => !v); setSelected(new Set()); }} className="p-1 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors" title={t('notebooks.select_multiple', 'Select multiple')} aria-label={t('notebooks.select_multiple', 'Select multiple')}
                                style={{ color: selectMode ? 'var(--accent-primary)' : 'var(--text-tertiary)' }}>
                                <CheckSquare className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                                {readyCount}<span style={{ opacity: 0.5 }}>/{sources.length}</span>
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Add source buttons */}
            <div className="shrink-0 px-3 pt-2.5 pb-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${visibleButtons.length}, 1fr)` }}>
                {visibleButtons.map(({ key, label, Icon, accent }) => {
                    const isActive = activePanel === key;
                    return (
                        <button key={key} onClick={() => togglePanel(key)}
                            className="flex flex-col items-center gap-1 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wide border transition-all"
                            style={{ borderColor: isActive ? accent : 'var(--border-subtle)', background: isActive ? `${accent}18` : 'var(--bg-secondary)', color: isActive ? accent : 'var(--text-secondary)', boxShadow: isActive ? `0 0 0 1px ${accent}40` : 'none' }}>
                            <Icon className="w-3.5 h-3.5" /> {label}
                        </button>
                    );
                })}
                <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.json" className="hidden" onChange={e => { onFileUpload(e.target.files); e.target.value = ''; }} />
            </div>

            {/* URL Panel */}
            {activePanel === 'url' && (
                <div className="shrink-0 mx-3 mb-2 rounded-xl border p-3 space-y-2" style={{ background: 'var(--bg-secondary)', borderColor: 'rgba(245,158,11,0.3)', animation: 'fadeSlideDown 0.18s ease-out' }}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#f59e0b' }}>{t('notebooks.add_url', 'Add URL')}</span>
                        <button onClick={() => setActivePanel(null)} className="p-0.5 rounded hover:bg-black/10" aria-label={t('notebooks.close', 'Close')}><X className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} /></button>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <input autoFocus value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitUrl(); if (e.key === 'Escape') setActivePanel(null); }} placeholder="https://..." aria-label={t('notebooks.add_url', 'Add URL')} className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs border outline-none" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                        <button onClick={submitUrl} disabled={!urlInput.trim()} className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-40" style={{ background: '#f59e0b', color: 'white' }}>{t('notebooks.add', 'Add')}</button>
                    </div>
                </div>
            )}

            {/* Text Panel */}
            {activePanel === 'text' && (
                <div className="shrink-0 mx-3 mb-2 rounded-xl border p-3 space-y-2" style={{ background: 'var(--bg-secondary)', borderColor: 'rgba(16,185,129,0.3)', animation: 'fadeSlideDown 0.18s ease-out' }}>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#10b981' }}>{t('notebooks.paste_text', 'Paste Text')}</span>
                        <button onClick={() => setActivePanel(null)} className="p-0.5 rounded hover:bg-black/10" aria-label={t('notebooks.close', 'Close')}><X className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} /></button>
                    </div>
                    <input value={textName} onChange={e => setTextName(e.target.value)} placeholder={t('notebooks.name_optional', 'Name (optional)')} className="w-full px-2.5 py-1.5 rounded-lg text-xs border outline-none" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                    <textarea autoFocus value={textInput} onChange={e => setTextInput(e.target.value)} placeholder={t('notebooks.paste_placeholder', 'Paste your text here…')} maxLength={PASTE_MAX_CHARS} className="w-full px-2.5 py-1.5 rounded-lg text-xs border outline-none resize-none" style={{ background: 'var(--bg-primary)', borderColor: pasteOverLimit ? 'var(--error, #ef4444)' : 'var(--border-subtle)', color: 'var(--text-primary)', height: '80px' }} />
                    {pasteOverLimit && <p className="text-[9px] font-medium" style={{ color: 'var(--error, #ef4444)' }}>{t('notebooks.paste_too_long', { max: PASTE_MAX_CHARS.toLocaleString() })}</p>}
                    <button onClick={submitText} disabled={!textInput.trim() || pasteOverLimit} className="w-full py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-40" style={{ background: '#10b981', color: 'white' }}>{t('notebooks.add_text', 'Add Text')}</button>
                </div>
            )}

            {/* Meeting Panel */}
            {activePanel === 'meeting' && (
                <MeetingSourcePanel t={t} meetingMode={meetingMode} onChangeMode={updateMeetingMode} onAddMeeting={(id) => { onAddMeeting?.(id, { mode: meetingMode }); setActivePanel(null); }} onClose={() => setActivePanel(null)} />
            )}

            {/* Bulk action bar */}
            {selectMode && selected.size > 0 && (
                <div className="shrink-0 mx-3 mb-2 flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: 'var(--accent-primary)', color: 'white' }}>
                    <span className="text-[11px] font-semibold">{t('notebooks.n_selected', { count: selected.size })}</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setConfirmBulk(true)} className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md bg-white/15 hover:bg-white/25 transition-colors">
                            <Trash2 className="w-3 h-3" /> {t('notebooks.delete', 'Delete')}
                        </button>
                        <button onClick={clearSelection} className="text-[11px] font-medium px-2 py-1 rounded-md hover:bg-white/15 transition-colors">{t('common.cancel', 'Cancel')}</button>
                    </div>
                </div>
            )}

            {/* Source list (scrollable, drop zone) */}
            <div
                className="flex-1 overflow-y-auto custom-scrollbar px-3 py-1 space-y-1.5 transition-all"
                onDragOver={e => { if (!dragId) { e.preventDefault(); setDragOver(true); } }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
                onDrop={e => { if (e.dataTransfer.files?.length) { e.preventDefault(); setDragOver(false); onFileUpload(e.dataTransfer.files); } }}
                style={{
                    borderRadius: '12px', margin: '0 8px 8px', padding: dragOver ? '8px' : '4px 4px',
                    border: dragOver ? '2px dashed var(--brand-primary)' : '2px dashed var(--border-subtle)',
                    background: dragOver ? 'var(--brand-gradient-soft)' : 'transparent',
                    transition: 'border-color 0.2s, background 0.2s',
                }}
            >
                {sources.length === 0 ? (
                    <div className="flex flex-col items-center h-full py-7 px-2 select-none">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'var(--brand-gradient-soft)', border: '1px solid var(--border-subtle)' }}>
                            <Upload className="w-6 h-6" style={{ color: 'var(--brand-primary)' }} />
                        </div>
                        <p className="text-[13px] font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{t('notebooks.add_first_source', 'Add your first source')}</p>
                        <p className="text-[10px] text-center leading-relaxed mb-4" style={{ color: 'var(--text-tertiary)' }}>
                            {t('notebooks.sources_empty_hint', 'Sources power the AI chat & citations. Drag & drop a file, or pick a type:')}
                        </p>
                        <div className="w-full space-y-1.5">
                            {visibleButtons.map(({ key, label, Icon, accent, desc }) => (
                                <button key={key} onClick={() => togglePanel(key)}
                                    className="group/opt flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl border text-left transition-all hover:shadow-sm"
                                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                                    <span className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}18`, color: accent }}>
                                        <Icon className="w-3.5 h-3.5" />
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
                                        <span className="block text-[9px]" style={{ color: 'var(--text-tertiary)' }}>{desc}</span>
                                    </span>
                                    <ChevronDown className="w-3.5 h-3.5 -rotate-90 opacity-0 group-hover/opt:opacity-50 transition-opacity" style={{ color: 'var(--text-tertiary)' }} />
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
                            onPreview={openPreview}
                            onRename={onRenameSource}
                            selectable={selectMode}
                            selected={selected.has(source.id)}
                            onToggleSelect={toggleSelect}
                            onDragStart={onCardDragStart}
                            onDragOver={onCardDragOver}
                            onDrop={onCardDrop}
                            dragging={dragId === source.id}
                            t={t}
                        />
                    ))
                )}
            </div>

            {/* Footer stats */}
            {sources.length > 0 && (
                <div className="shrink-0 px-3 pb-2.5 space-y-1.5">
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${readyPct}%`, background: readyPct === 100 ? 'linear-gradient(90deg, #22c55e, #16a34a)' : 'var(--brand-gradient)' }} />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                            {readyCount === sources.length
                                ? t('notebooks.all_n_sources_ready', { count: sources.length })
                                : t('notebooks.n_of_m_ready', { ready: readyCount, total: sources.length })}
                        </span>
                        <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>{t('notebooks.n_words', { count: totalWords.toLocaleString() })}</span>
                    </div>
                </div>
            )}

            {preview && <SourcePreviewModal preview={preview} onClose={() => setPreview(null)} t={t} />}
            <ConfirmDialog
                open={confirmBulk}
                title={t('notebooks.confirm_bulk_delete_title', 'Delete sources?')}
                description={t('notebooks.confirm_bulk_delete_body', { count: selected.size })}
                confirmLabel={t('notebooks.delete', 'Delete')}
                cancelLabel={t('common.cancel', 'Cancel')}
                destructive
                onConfirm={doBulkDelete}
                onCancel={() => setConfirmBulk(false)}
            />
        </div>
    );
}
