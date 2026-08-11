import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ListChecks, Clock, Pencil } from 'lucide-react';
// The strict parser (null for junk), NOT parseTimestampToSeconds (junk → 0):
// an unreadable model timestamp must lose its chip, not seek to 0:00.
import { toSeconds } from '../lib/timelineMarkers';

export default function ActionItemsList({ items = [], onToggle, onEdit, onSeek }) {
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState('');

    // When any item carries a spoken deadline, dated items float up in due
    // order; undated ones keep their original (discussion) order below.
    // Stable sort, so toggling done never reshuffles rows.
    const sorted = useMemo(() => {
        if (!items.some((i) => i && i.due)) return items;
        return [...items].sort((a, b) => (a.due && b.due
            ? a.due.localeCompare(b.due)
            : a.due ? -1 : b.due ? 1 : 0));
    }, [items]);

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
                        {sorted.map((item) => (
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
                    {onSeek && toSeconds(item.timestamp) !== null && (
                        <button
                            type="button"
                            onClick={() => onSeek(toSeconds(item.timestamp))}
                            className="inline-flex items-center gap-1 hover:text-[var(--accent-primary)] transition-colors"
                        >
                            <Clock className="w-3 h-3" />
                            {item.timestamp}
                        </button>
                    )}
                    {item.due && <DueChip due={item.due} done={item.done} />}
                </div>
            </div>
        </li>
    );
}

/** Spoken deadline ("YYYY-MM-DD"); red once it's past and the item isn't done. */
function DueChip({ due, done }) {
    // Compare against the viewer's LOCAL date. toISOString() is UTC, which in
    // CEST turns an item due today into "overdue" for the first two hours
    // after midnight.
    const overdue = !done && due < localToday();
    return (
        <span
            className="inline-flex items-center gap-1 tabular-nums"
            style={{ color: overdue ? '#ef4444' : 'var(--text-muted)' }}
            title={overdue ? 'Overdue' : 'Due date'}
        >
            <CalendarDays className="w-3 h-3" />
            {due}
            {overdue && <span className="font-semibold">· overdue</span>}
        </span>
    );
}

/** Today as "YYYY-MM-DD" in the viewer's timezone. */
function localToday() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
