import React from 'react';
import { StickyNote, Check, Loader, X, Trash2, Plus, ListChecks } from 'lucide-react';
import { API_BASE, authFetch } from '../../../utils/helpers';

export default function KeepDraftCard({ msg, keepDraftStatuses, setKeepDraftStatuses }) {
    if (!msg.keepDrafts || msg.keepDrafts.length === 0) return null;

    const handleConfirm = async (draft, index) => {
        setKeepDraftStatuses(prev => ({ ...prev, [index]: 'executing' }));
        try {
            const res = await authFetch(`${API_BASE}/api/integrations/keep/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft),
            });
            if (res.ok) {
                setKeepDraftStatuses(prev => ({ ...prev, [index]: 'done' }));
            } else {
                const err = await res.json();
                setKeepDraftStatuses(prev => ({ ...prev, [index]: `failed: ${err.error}` }));
            }
        } catch (err) {
            setKeepDraftStatuses(prev => ({ ...prev, [index]: `failed: ${err.message}` }));
        }
    };

    const handleDiscard = (index) => {
        setKeepDraftStatuses(prev => ({ ...prev, [index]: 'discarded' }));
    };

    const isDelete = (draft) => draft.action === 'delete';

    return msg.keepDrafts.map((draft, i) => {
        const status = keepDraftStatuses[i] || draft.status || 'pending';
        const isResolved = status === 'done' || status === 'discarded' || status.startsWith('failed');

        const colors = isDelete(draft)
            ? { border: 'border-red-500/30', bg: 'bg-red-500/5', text: 'text-red-500', btn: 'bg-red-600 hover:bg-red-500' }
            : { border: 'border-amber-500/30', bg: 'bg-amber-500/5', text: 'text-amber-500', btn: 'bg-amber-600 hover:bg-amber-500' };

        const ActionIcon = isDelete(draft) ? Trash2 : Plus;
        const actionLabel = isDelete(draft) ? 'Delete Note' : 'New Note';
        const NoteTypeIcon = draft.type === 'list' ? ListChecks : StickyNote;

        return (
            <div key={i} className={`my-3 rounded-xl border overflow-hidden transition-all duration-300 ${
                status === 'done' ? 'border-green-500/40 bg-green-500/5'
                : status === 'discarded' ? 'border-[var(--border-subtle)] bg-[var(--bg-tertiary)] opacity-50'
                : status.startsWith('failed') ? 'border-red-500/40 bg-red-500/5'
                : `${colors.border} ${colors.bg}`
            }`}>
                {/* Header */}
                <div className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider ${
                    status === 'done' ? 'text-green-500'
                    : status === 'discarded' ? 'text-[var(--text-tertiary)]'
                    : status.startsWith('failed') ? 'text-red-500'
                    : colors.text
                }`}>
                    <ActionIcon className="w-3.5 h-3.5" />
                    <span>{
                        status === 'done' ? `${actionLabel} ✓`
                        : status === 'discarded' ? 'Discarded'
                        : status === 'executing' ? 'Saving...'
                        : status.startsWith('failed') ? 'Failed'
                        : `${actionLabel} — Awaiting Approval`
                    }</span>
                </div>

                {/* Note Details */}
                <div className="px-4 pb-3 space-y-2">
                    {/* Title */}
                    <div className="flex items-center gap-2.5">
                        <NoteTypeIcon className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
                        <span className="text-[var(--text-primary)] font-semibold text-sm">{draft.title || '(untitled)'}</span>
                    </div>

                    {/* Text content */}
                    {draft.content && (
                        <div className="text-[var(--text-secondary)] text-xs pl-6 whitespace-pre-wrap leading-relaxed" style={{ maxHeight: '120px', overflow: 'auto' }}>
                            {draft.content}
                        </div>
                    )}

                    {/* List items */}
                    {draft.listItems && draft.listItems.length > 0 && (
                        <div className="pl-6 space-y-1">
                            {draft.listItems.map((item, j) => (
                                <div key={j} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                    <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                                        item.checked ? 'bg-amber-500/20 border-amber-500/50' : 'border-[var(--border-subtle)]'
                                    }`}>
                                        {item.checked && <Check className="w-2.5 h-2.5 text-amber-500" />}
                                    </div>
                                    <span className={item.checked ? 'line-through opacity-60' : ''}>{item.text}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                {!isResolved && (
                    <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                        <button
                            onClick={() => handleConfirm(draft, i)}
                            disabled={status === 'executing'}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold ${colors.btn} text-white transition-colors disabled:opacity-50`}
                        >
                            {status === 'executing' ? (
                                <><Loader className="w-3 h-3 animate-spin" /> Saving...</>
                            ) : (
                                <><Check className="w-3 h-3" /> Confirm</>
                            )}
                        </button>
                        <button
                            onClick={() => handleDiscard(i)}
                            disabled={status === 'executing'}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        >
                            <X className="w-3 h-3" /> Discard
                        </button>
                    </div>
                )}

                {/* Error */}
                {status.startsWith('failed') && (
                    <div className="px-4 py-2 text-xs text-red-400 border-t border-red-500/20">
                        {status.replace('failed: ', 'Error: ')}
                    </div>
                )}
            </div>
        );
    });
}
