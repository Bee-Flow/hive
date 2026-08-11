// Presentational shell for the in-chat integration draft cards
// (CalendarDraftCard, ContactsDraftCard, KeepDraftCard). Replaces the
// wrapper markup that was copy-pasted per card: status-styled
// border/background (pending / executing / done / discarded / failed),
// header row (action icon + status label), Confirm/Discard footer and
// the failure strip. The integration-specific details (event, contact,
// note) are passed as children and rendered in the card body. Usage:
//
//   <DraftCardShell
//       status={status}                       // from useDraftAction.getStatus
//       colors={{ border, bg, text, btn }}    // pending accent classes
//       icon={ActionIcon}
//       actionLabel="New Event"
//       executingLabel="Executing..."
//       titleIcon={Calendar}
//       title={draft.title}
//       onConfirm={() => confirm(draft, i)}
//       onDiscard={() => discard(i)}
//   >
//       …card body rows…
//   </DraftCardShell>

import { Check, Loader, X } from 'lucide-react';
import React from 'react';

export default function DraftCardShell({
    status,
    colors,
    icon: Icon,
    actionLabel,
    executingLabel = 'Saving...',
    confirmLabel = 'Confirm',
    titleIcon: TitleIcon,
    title,
    onConfirm,
    onDiscard,
    children,
}) {
    const isResolved = status === 'done' || status === 'discarded' || status.startsWith('failed');

    return (
        <div className={`my-3 rounded-xl border overflow-hidden transition-all duration-300 ${
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
                <Icon className="w-3.5 h-3.5" />
                <span>{
                    status === 'done' ? `${actionLabel} ✓`
                    : status === 'discarded' ? 'Discarded'
                    : status === 'executing' ? executingLabel
                    : status.startsWith('failed') ? 'Failed'
                    : `${actionLabel} — Awaiting Approval`
                }</span>
            </div>

            {/* Card body */}
            <div className="px-4 pb-3 space-y-2">
                {title && (
                    <div className="flex items-center gap-2.5">
                        <TitleIcon className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
                        <span className="text-[var(--text-primary)] font-semibold text-sm">{title}</span>
                    </div>
                )}
                {children}
            </div>

            {/* Action Buttons */}
            {!isResolved && (
                <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                    <button
                        onClick={onConfirm}
                        disabled={status === 'executing'}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold ${colors.btn} text-white transition-colors disabled:opacity-50`}
                    >
                        {status === 'executing' ? (
                            <><Loader className="w-3 h-3 animate-spin" /> {executingLabel}</>
                        ) : (
                            <><Check className="w-3 h-3" /> {confirmLabel}</>
                        )}
                    </button>
                    <button
                        onClick={onDiscard}
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
}
