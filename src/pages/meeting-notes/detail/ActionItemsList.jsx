import React, { useEffect, useRef, useState } from 'react';
import { Check, ListChecks, Clock, Pencil } from 'lucide-react';

export default function ActionItemsList({ items = [], onToggle, onEdit, onSeek }) {
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState('');

    const startEdit = (item) => {
        if (!onEdit) return;
        setEditingId(item.id);
        setDraft(item.text || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setDraft('');
    };

    const commitEdit = (item) => {
        const trimmed = draft.trim();
        if (trimmed && trimmed !== item.text) {
            onEdit?.(item.id, trimmed);
        }
        cancelEdit();
    };

    return (
        <div className="flex flex-col gap-3 h-full">
            <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <ListChecks className="w-4 h-4" />
                Action items
                <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                    {items.filter((i) => !i.done).length}
                </span>
            </h2>
            <div className="flex-1 overflow-auto rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                {items.length === 0 ? (
                    <div className="text-sm text-center py-10 px-4" style={{ color: 'var(--text-muted)' }}>
                        No action items detected.
                    </div>
                ) : (
                    <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                        {items.map((item) => (
                            <ActionItemRow
                                key={item.id}
                                item={item}
                                editing={editingId === item.id}
                                draft={draft}
                                onDraftChange={setDraft}
                                onToggle={() => onToggle?.(item.id)}
                                onStartEdit={() => startEdit(item)}
                                onCommit={() => commitEdit(item)}
                                onCancel={cancelEdit}
                                onSeek={onSeek}
                                canEdit={!!onEdit}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function ActionItemRow({ item, editing, draft, onDraftChange, onToggle, onStartEdit, onCommit, onCancel, onSeek, canEdit }) {
    const inputRef = useRef(null);
    useEffect(() => {
        if (editing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editing]);

    return (
        <li className="px-3 py-2.5 flex items-start gap-3 group">
            <button
                type="button"
                onClick={onToggle}
                aria-label={item.done ? 'Mark not done' : 'Mark done'}
                className="mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
                style={{
                    background: item.done ? 'var(--accent-primary)' : 'transparent',
                    borderColor: item.done ? 'var(--accent-primary)' : 'var(--border-default)',
                }}
            >
                {item.done && <Check className="w-3 h-3 text-white" />}
            </button>
            <div className="flex-1 min-w-0">
                {editing ? (
                    <input
                        ref={inputRef}
                        value={draft}
                        onChange={(e) => onDraftChange(e.target.value)}
                        onBlur={onCommit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); onCommit(); }
                            if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
                        }}
                        className="w-full px-2 py-1 rounded text-sm border outline-none"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                    />
                ) : (
                    <button
                        type="button"
                        onClick={canEdit ? onStartEdit : undefined}
                        disabled={!canEdit}
                        className={`text-left text-sm w-full ${item.done ? 'line-through opacity-60' : ''} ${canEdit ? 'cursor-text hover:bg-[var(--bg-tertiary)] rounded px-1 -mx-1 transition-colors' : ''}`}
                        style={{ color: 'var(--text-primary)' }}
                        title={canEdit ? 'Click to edit' : undefined}
                    >
                        {item.text}
                        {canEdit && <Pencil className="inline w-3 h-3 ml-1.5 opacity-0 group-hover:opacity-50 transition-opacity align-baseline" />}
                    </button>
                )}
                <div className="flex items-center gap-2 mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {item.assignee && (
                        <span className="inline-flex items-center gap-1">
                            <span className="w-4 h-4 rounded-full text-[9px] font-semibold flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                {(item.assignee[0] || '?').toUpperCase()}
                            </span>
                            {item.assignee}
                        </span>
                    )}
                    {item.timestamp && onSeek && (
                        <button
                            type="button"
                            onClick={() => onSeek(item.timestamp)}
                            className="inline-flex items-center gap-1 hover:text-[var(--accent-primary)] transition-colors"
                        >
                            <Clock className="w-3 h-3" />
                            {item.timestamp}
                        </button>
                    )}
                </div>
            </div>
        </li>
    );
}
