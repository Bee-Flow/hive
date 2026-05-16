import React from 'react';
import { Check, ListChecks, Clock } from 'lucide-react';

export default function ActionItemsList({ items = [], onToggle, onSeek }) {
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
                            <li key={item.id} className="px-3 py-2.5 flex items-start gap-3">
                                <button
                                    type="button"
                                    onClick={() => onToggle?.(item.id)}
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
                                    <div className={`text-sm ${item.done ? 'line-through opacity-60' : ''}`} style={{ color: 'var(--text-primary)' }}>
                                        {item.text}
                                    </div>
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
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
