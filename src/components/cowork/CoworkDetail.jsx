/**
 * The right-hand pane: one cowork item in full — what it does, when it runs
 * next, and how every run went.
 *
 * This used to be reachable only through Studio → Cowork while the thing that
 * created it lived under a different name in the sidebar. It is now the detail
 * half of the Cowork page itself.
 */
import { Clock, Pause, Pencil, Play, Power, Repeat, Trash2 } from 'lucide-react';
import React from 'react';
import CoworkEditForm from './CoworkEditForm';
import CoworkRunHistory from './CoworkRunHistory';
import { describeMoment, repeatLabel } from './coworkSchedule';
import { coworkStatus } from './coworkStatus';

export default function CoworkDetail({
    item, agents, onRunNow, onToggle, onDelete, onSave, busy, reloadKey,
    editing, onEdit, onCancelEdit, saveError,
}) {
    const status = coworkStatus(item);

    if (editing) {
        return (
            <div className="h-full overflow-y-auto custom-scrollbar p-5" data-testid="cowork-detail">
                <h2 className="text-[17px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                    Edit cowork
                </h2>
                <CoworkEditForm
                    item={item}
                    agents={agents}
                    onSave={onSave}
                    onCancel={onCancelEdit}
                    saving={busy}
                    error={saveError}
                />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-5" data-testid="cowork-detail">
            <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                    <h2 className="text-[17px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {item.title || 'Untitled cowork'}
                    </h2>
                    <div
                        className="mt-1.5 flex items-center gap-2.5 text-[12px] flex-wrap"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium ${status.badge}`}>
                            {status.label}
                        </span>
                        {item.repeatInterval
                            ? <span className="inline-flex items-center gap-1"><Repeat className="w-3.5 h-3.5" />{repeatLabel(item.repeatInterval)}</span>
                            : <span>Runs once</span>}
                        {item.isActive && item.nextRunAt && (
                            <span className="inline-flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />next {describeMoment(item.nextRunAt)}
                            </span>
                        )}
                        <span>{item.runCount || 0} run{item.runCount === 1 ? '' : 's'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={onEdit}
                        disabled={busy}
                        data-testid="cowork-edit"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium disabled:opacity-50"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                    >
                        <Pencil className="w-3.5 h-3.5" />Edit
                    </button>
                    <button
                        type="button"
                        onClick={() => onRunNow(item.id)}
                        disabled={busy || item.lastStatus === 'running'}
                        data-testid="cowork-run-now"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium disabled:opacity-50"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                    >
                        <Play className="w-3.5 h-3.5" />Run now
                    </button>
                    <button
                        type="button"
                        onClick={() => onToggle(item.id)}
                        disabled={busy}
                        data-testid="cowork-toggle"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] font-medium disabled:opacity-50"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
                    >
                        {item.isActive ? <Pause className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                        {item.isActive ? 'Pause' : 'Resume'}
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(item)}
                        disabled={busy}
                        data-testid="cowork-delete"
                        aria-label="Delete this cowork"
                        className="p-1.5 rounded-lg border text-red-600 dark:text-red-400 disabled:opacity-50"
                        style={{ borderColor: 'var(--border-subtle)' }}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div
                className="mt-4 rounded-xl border p-3 text-[13px] whitespace-pre-wrap break-words"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
                {item.prompt}
            </div>

            <h3
                className="mt-6 mb-2 text-[12px] font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-tertiary)' }}
            >
                History
            </h3>
            <CoworkRunHistory coworkId={item.id} reloadKey={reloadKey} />
        </div>
    );
}
