import {
    BookOpen, Clock, FileText, FolderOpen, MessageSquare, MoreVertical,
    Pencil, Pin, PinOff, Trash2, Type,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import stripHtml from './stripHtml';
import AnchoredMenu from '../../../components/shared/AnchoredMenu';
import IconButton from '../../../components/shared/IconButton';
import { tokenFor } from '../../../components/shared/statusTokens';
import useRelativeTime from '../../../hooks/useRelativeTime';
import useTranslation from '../../../hooks/useTranslation';

/**
 * NotebookCard — one tile in the overview grid (AppList card recipe: accent
 * tile + name + preview + meta, kebab on hover). The whole card is a single
 * click target that opens the editor; the preview lives on the card face so
 * there is no separate preview pane anymore.
 */

const CARD_STYLE = { borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' };

const PREVIEW_CHARS = 300;

function MenuItem({ icon, label, onClick, danger = false }) {
    const Icon = icon;
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            className={
                'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors ' +
                (danger ? 'text-rose-500 hover:bg-rose-500/10' : 'hover:bg-white/5')
            }
            style={danger ? undefined : { color: 'var(--text-primary)' }}
        >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {label}
        </button>
    );
}

export default function NotebookCard({ nb, onOpen, onOpenChat, onTogglePin, onRename, onDelete, onDropFiles }) {
    const { t, locale } = useTranslation();
    const rel = useRelativeTime();
    const [menuOpen, setMenuOpen] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [dropping, setDropping] = useState(false);
    const kebabRef = useRef(null);

    // Server-side `preview` is the real thing; the client strip only covers
    // stale/demo rows that still carry raw documentContent.
    const preview = nb.preview || stripHtml(nb.documentContent).slice(0, PREVIEW_CHARS);
    const sourceCount = nb.sourceCount || 0;
    const messageCount = nb.messageCount || 0;
    const words = (nb.docWordCount || 0) + (nb.sourceWordCount || 0);
    const processing = nb.processingCount || 0;
    const failed = nb.failedCount || 0;

    const commitRename = () => {
        setRenaming(false);
        const clean = renameValue.trim();
        if (clean && clean !== nb.name) onRename?.(nb.id, clean);
    };

    const menuAction = (fn) => (e) => {
        e.stopPropagation();
        setMenuOpen(false);
        fn();
    };

    // The page-level dropzone sits behind every card; stopPropagation keeps a
    // drop meant for THIS notebook from also creating a new one.
    const onDragOver = (e) => {
        if (!e.dataTransfer?.types?.includes?.('Files')) return;
        e.preventDefault();
        e.stopPropagation();
        setDropping(true);
    };
    const onDragLeave = (e) => { e.stopPropagation(); setDropping(false); };
    const onDrop = (e) => {
        const files = Array.from(e.dataTransfer?.files || []);
        if (!files.length) return;
        e.preventDefault();
        e.stopPropagation();
        setDropping(false);
        onDropFiles?.(nb, files);
    };

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => { if (!renaming) onOpen?.(nb); }}
            onKeyDown={(e) => {
                if (renaming) return;
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(nb); }
            }}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className="group relative rounded-xl border p-3.5 transition-all hover:shadow-md text-left cursor-pointer"
            style={dropping ? { ...CARD_STYLE, borderColor: 'var(--accent-primary)' } : CARD_STYLE}
        >
            {dropping && (
                <div
                    className="absolute inset-0 z-10 rounded-xl flex items-center justify-center text-xs font-semibold pointer-events-none"
                    style={{ background: 'var(--bg-card)', color: 'var(--accent-primary)', opacity: 0.95 }}
                >
                    {t('notebooks.drop_to_add', 'Drop to add to this notebook')}
                </div>
            )}

            <div className="flex items-start gap-2.5 mb-2">
                <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg shrink-0 border-[1.5px]"
                    style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}
                >
                    <BookOpen className="w-4.5 h-4.5" style={{ color: 'var(--brand-primary)' }} />
                </span>
                <div className="flex-1 min-w-0 pt-0.5 pr-6">
                    {renaming ? (
                        <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') commitRename();
                                if (e.key === 'Escape') setRenaming(false);
                            }}
                            onBlur={commitRename}
                            maxLength={120}
                            aria-label={t('notebooks.rename', 'Rename')}
                            className="w-full text-sm font-semibold px-1.5 py-0.5 rounded border outline-none focus:ring-1"
                            style={{
                                borderColor: 'var(--border-default)',
                                background: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                '--tw-ring-color': 'var(--accent-primary)',
                            }}
                        />
                    ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                            {nb.pinned && (
                                <Pin
                                    className="w-3 h-3 shrink-0"
                                    fill="currentColor"
                                    style={{ color: 'var(--accent-primary)' }}
                                    aria-label={t('notebooks.filter_pinned', 'Pinned')}
                                />
                            )}
                            <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }} title={nb.name}>
                                {nb.name}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {preview ? (
                <p className="text-xs leading-relaxed line-clamp-3 mb-2" style={{ color: 'var(--text-secondary)' }}>
                    {preview}
                </p>
            ) : (
                <p className="text-xs italic mb-2" style={{ color: 'var(--text-tertiary)' }}>
                    {t('notebooks.notebook_empty', 'This notebook is empty. Open it to add sources and start writing.')}
                </p>
            )}

            <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                {processing > 0 ? (
                    <span
                        data-testid="status-dot-processing"
                        title={t('notebooks.processing_sources', '{count} sources processing', { count: processing })}
                        className={`inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse shrink-0 ${tokenFor('running').solid}`}
                    />
                ) : failed > 0 ? (
                    <span
                        data-testid="status-dot-failed"
                        title={t('notebooks.failed_sources', '{count} sources failed', { count: failed })}
                        className={`inline-block w-1.5 h-1.5 rounded-full bg-current shrink-0 ${tokenFor('failed').solid}`}
                    />
                ) : null}
                <span className="inline-flex items-center gap-1" title={t('notebooks.sources', 'Sources')}>
                    <FileText className="w-3 h-3" /> {sourceCount}
                </span>
                <span className="inline-flex items-center gap-1" title={t('notebooks.messages', 'Messages')}>
                    <MessageSquare className="w-3 h-3" /> {messageCount}
                </span>
                <span className="inline-flex items-center gap-1" title={t('notebooks.words', 'Words')}>
                    <Type className="w-3 h-3" /> {words.toLocaleString(locale)}
                </span>
                <span className="inline-flex items-center gap-1 ml-auto" title={t('notebooks.updated', 'Updated')}>
                    <Clock className="w-3 h-3" /> {rel(nb.lastActivityAt || nb.updatedAt)}
                </span>
            </div>

            {/* Kebab — stopPropagation wrapper so menu interaction never opens the card. */}
            <div
                className="absolute top-2 right-2"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
            >
                <span ref={kebabRef}>
                    <IconButton
                        ariaLabel={t('notebooks.card_menu', 'Notebook actions')}
                        size="sm"
                        onClick={() => setMenuOpen((v) => !v)}
                        className={menuOpen ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity'}
                    >
                        <MoreVertical />
                    </IconButton>
                </span>
                <AnchoredMenu
                    open={menuOpen}
                    onClose={() => setMenuOpen(false)}
                    anchorRef={kebabRef}
                    align="right"
                    minWidth={160}
                    role="menu"
                    className="py-1"
                >
                    <MenuItem icon={FolderOpen} label={t('notebooks.open_notebook', 'Open notebook')} onClick={menuAction(() => onOpen?.(nb))} />
                    <MenuItem icon={MessageSquare} label={t('notebooks.open_chat', 'Open chat')} onClick={menuAction(() => onOpenChat?.(nb))} />
                    <MenuItem
                        icon={nb.pinned ? PinOff : Pin}
                        label={nb.pinned ? t('notebooks.unpin', 'Unpin') : t('notebooks.pin', 'Pin')}
                        onClick={menuAction(() => onTogglePin?.(nb.id))}
                    />
                    <MenuItem
                        icon={Pencil}
                        label={t('notebooks.rename', 'Rename')}
                        onClick={menuAction(() => { setRenameValue(nb.name || ''); setRenaming(true); })}
                    />
                    <MenuItem icon={Trash2} label={t('notebooks.delete', 'Delete')} onClick={menuAction(() => onDelete?.(nb))} danger />
                </AnchoredMenu>
            </div>
        </div>
    );
}
