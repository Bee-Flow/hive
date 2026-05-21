import React, { useEffect, useRef, useState } from 'react';
import {
    ArrowLeft, MoreHorizontal, Pencil, Trash2, RefreshCw, Download, Copy, MessageSquare,
    Tag, X, Check, Loader2, Clock, Users, Languages, UsersRound,
} from 'lucide-react';
import IconButton from '../../../components/shared/IconButton';
import { formatDuration, formatRelativeDate } from '../lib/format';

export default function MeetingHeader({
    meeting,
    onBack,
    onRename,
    onDelete,
    onReprocess,
    onExport,
    onCopyTranscript,
    onEditSpeakers,
    onToggleChat,
    chatVisible,
    onAddTag,
    onRemoveTag,
    busy,
    publishMenuSlot = null,
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(meeting.title || '');
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const [tagDraft, setTagDraft] = useState('');
    const [showTagInput, setShowTagInput] = useState(false);

    useEffect(() => { setDraft(meeting.title || ''); }, [meeting.id, meeting.title]);

    useEffect(() => {
        if (!menuOpen) return undefined;
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    const commitRename = () => {
        if (draft.trim() && draft.trim() !== meeting.title) onRename?.(draft.trim());
        setEditing(false);
    };

    return (
        <div className="flex flex-col gap-3 px-4 sm:px-6 pt-4 pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-start gap-3">
                {onBack && (
                    <IconButton ariaLabel="Back to library" onClick={onBack} size="md">
                        <ArrowLeft />
                    </IconButton>
                )}
                <div className="flex-1 min-w-0">
                    {editing ? (
                        <div className="flex items-center gap-1.5">
                            <input
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitRename();
                                    if (e.key === 'Escape') { setEditing(false); setDraft(meeting.title || ''); }
                                }}
                                autoFocus
                                className="flex-1 px-2 py-1 rounded-lg text-lg font-semibold border outline-none"
                                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                            />
                            <IconButton ariaLabel="Save" onClick={commitRename} size="md"><Check /></IconButton>
                            <IconButton ariaLabel="Cancel" onClick={() => { setEditing(false); setDraft(meeting.title || ''); }} size="md"><X /></IconButton>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => meeting.isOwner !== false && setEditing(true)}
                            className="text-left group flex items-center gap-1.5"
                            style={{ color: 'var(--text-primary)' }}
                        >
                            <h1 className="text-lg sm:text-xl font-bold truncate">{meeting.title || 'Untitled meeting'}</h1>
                            {meeting.isOwner !== false && (
                                <Pencil className="w-3.5 h-3.5 opacity-0 group-hover:opacity-70 transition-opacity" />
                            )}
                        </button>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        <span>{formatRelativeDate(meeting.createdAt)}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(meeting.durationSeconds)}</span>
                        {meeting.speakerCount > 0 && (
                            <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{meeting.speakerCount} speaker{meeting.speakerCount > 1 ? 's' : ''}</span>
                        )}
                        {meeting.language && (
                            <span className="inline-flex items-center gap-1"><Languages className="w-3 h-3" />{String(meeting.language).toUpperCase()}</span>
                        )}
                        {meeting.provider && (
                            <span className="px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)' }}>{meeting.provider}</span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {publishMenuSlot}
                    <button
                        type="button"
                        onClick={onToggleChat}
                        className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${chatVisible ? '' : 'hover:bg-[var(--bg-tertiary)]'}`}
                        style={{
                            background: chatVisible ? 'color-mix(in srgb, var(--accent-primary) 14%, transparent)' : 'transparent',
                            borderColor: chatVisible ? 'var(--accent-primary)' : 'var(--border-default)',
                            color: chatVisible ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        }}
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Ask AI
                    </button>
                    <div className="relative" ref={menuRef}>
                        <IconButton ariaLabel="More actions" onClick={() => setMenuOpen((o) => !o)} size="md">
                            <MoreHorizontal />
                        </IconButton>
                        {menuOpen && (
                            <div className="absolute right-0 top-full mt-1 z-20 rounded-xl border shadow-lg overflow-hidden min-w-[180px]" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                                <MenuItem icon={Copy} label="Copy transcript" onClick={() => { setMenuOpen(false); onCopyTranscript?.(); }} />
                                {onEditSpeakers && (
                                    <MenuItem icon={UsersRound} label="Edit speakers" onClick={() => { setMenuOpen(false); onEditSpeakers(); }} />
                                )}
                                <MenuItem icon={Download} label="Export as Markdown" onClick={() => { setMenuOpen(false); onExport?.('md'); }} />
                                <MenuItem icon={Download} label="Export as Text" onClick={() => { setMenuOpen(false); onExport?.('txt'); }} />
                                <MenuItem icon={RefreshCw} label="Re-transcribe" onClick={() => { setMenuOpen(false); onReprocess?.(); }} disabled={busy} />
                                {meeting.isOwner !== false && (
                                    <MenuItem icon={Trash2} label="Delete" danger onClick={() => { setMenuOpen(false); onDelete?.(); }} />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                {(meeting.tags || []).map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                        <Tag className="w-3 h-3" />
                        {tag}
                        {meeting.isOwner !== false && (
                            <button type="button" onClick={() => onRemoveTag?.(tag)} aria-label={`Remove tag ${tag}`} className="opacity-60 hover:opacity-100">
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </span>
                ))}
                {showTagInput ? (
                    <input
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        onBlur={() => { setShowTagInput(false); setTagDraft(''); }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && tagDraft.trim()) { onAddTag?.(tagDraft.trim()); setTagDraft(''); setShowTagInput(false); }
                            if (e.key === 'Escape') { setShowTagInput(false); setTagDraft(''); }
                        }}
                        autoFocus
                        placeholder="Add tag…"
                        className="text-[11px] px-2 py-0.5 rounded-full border outline-none"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />
                ) : (
                    meeting.isOwner !== false && (
                        <button
                            type="button"
                            onClick={() => setShowTagInput(true)}
                            className="text-[11px] px-2 py-0.5 rounded-full border border-dashed inline-flex items-center gap-1 hover:bg-[var(--bg-tertiary)] transition-colors"
                            style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}
                        >
                            <Tag className="w-3 h-3" />
                            Add tag
                        </button>
                    )
                )}
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" style={{ color: 'var(--text-muted)' }} />}
            </div>
        </div>
    );
}

function MenuItem({ icon: Icon, label, onClick, danger, disabled }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors disabled:opacity-50"
            style={{
                color: danger ? '#ef4444' : 'var(--text-primary)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
        </button>
    );
}
