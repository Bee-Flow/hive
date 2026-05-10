import React from 'react';
import { BookOpen, Pencil, Trash2, ChevronRight, FileText } from 'lucide-react';

function stripHtml(html) {
    if (!html) return '';
    if (typeof document === 'undefined') return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}

function NotebookCard({ nb, renamingId, renameValue, setRenameValue, setRenamingId, onRename, onDelete, onSelect, timeAgo, isActive }) {
    const preview = nb.preview || stripHtml(nb.documentContent).slice(0, 140);
    const sourceCount = nb.sourceCount || 0;
    const messageCount = nb.messageCount || 0;

    return (
        <div
            data-notebook-id={nb.id}
            onClick={() => onSelect(nb)}
            className="group relative overflow-hidden cursor-pointer flex flex-col border transition-all"
            style={{
                background: 'var(--surface-2)',
                borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-card)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)'; if (!isActive) e.currentTarget.style.borderColor = 'var(--border-default)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; if (!isActive) e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
        >
            {/* Neutral header strip — Studio-aligned, no per-card colour */}
            <div
                className="relative h-12 flex items-center px-4 border-b"
                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}
            >
                <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--surface-1)', boxShadow: 'var(--shadow-sm)' }}
                >
                    <BookOpen style={{ color: 'var(--brand-primary)', width: 18, height: 18 }} />
                </div>
                <div
                    className="absolute top-1.5 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={e => e.stopPropagation()}
                >
                    <button
                        onClick={() => { setRenamingId(nb.id); setRenameValue(nb.name); }}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ background: 'var(--surface-1)', color: 'var(--text-secondary)' }}
                        title="Rename"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => onDelete(nb.id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ background: 'var(--surface-1)', color: '#f87171' }}
                        title="Delete"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col p-4 gap-2">
                {renamingId === nb.id ? (
                    <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => {
                            e.stopPropagation();
                            if (e.key === 'Enter') onRename(nb.id);
                            if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="text-sm font-semibold px-2 py-1 rounded border focus:outline-none focus:ring-1 w-full"
                        style={{
                            borderColor: 'var(--border-default)',
                            color: 'var(--text-primary)',
                            background: 'var(--surface-1)',
                            '--tw-ring-color': 'var(--brand-primary)',
                        }}
                    />
                ) : (
                    <h3
                        className="text-sm font-semibold leading-snug"
                        style={{
                            color: 'var(--text-primary)',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            minHeight: '2.5em',
                        }}
                        title={nb.name}
                    >
                        {nb.name}
                    </h3>
                )}

                {preview ? (
                    <p
                        className="text-xs leading-relaxed flex-1"
                        style={{
                            color: 'var(--text-muted)',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                        }}
                    >
                        {preview}
                    </p>
                ) : (
                    <p className="text-xs flex-1 italic" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                        Empty notebook
                    </p>
                )}

                {/* Meta row */}
                <div className="flex items-center justify-between pt-2 mt-auto border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        <span className="inline-flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {sourceCount}
                        </span>
                        {messageCount > 0 && (
                            <>
                                <span>·</span>
                                <span>{messageCount} msg</span>
                            </>
                        )}
                        <span>·</span>
                        <span>{timeAgo(nb.updatedAt || nb.createdAt)}</span>
                    </div>
                    <span
                        className="text-[11px] font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--brand-primary)' }}
                    >
                        Open <ChevronRight className="w-3 h-3" />
                    </span>
                </div>
            </div>
        </div>
    );
}

export default NotebookCard;
