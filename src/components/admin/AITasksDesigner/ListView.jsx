// §WS5 — task list + card, extracted verbatim from AITasksDesigner/index.jsx.
// TaskCard is internal to ListView.
import React from 'react';
import { Bot, Plus, Play, Pause, Pencil, Trash2, Clock, Repeat } from 'lucide-react';
import { tierLabel } from '../../tierMeta';
import { tokenFor } from '../../shared/statusTokens';
import { repeatLabel, timeAgo, formatNextRun } from './taskFormatters';

export default function ListView({ loading, activeTasks, inactiveTasks, modelTiers, onEdit, onToggle, onRequestDelete, onRunNow, onOpenResult, onCreate, canCreate }) {
    if (loading && activeTasks.length === 0 && inactiveTasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] text-[13px]">
                <div style={{
                    width: 32, height: 32,
                    border: '2px solid var(--border-default)',
                    borderTopColor: 'var(--text-primary)',
                    borderRadius: '50%',
                    animation: 'aiTaskSpin 0.8s linear infinite',
                    marginBottom: 12,
                }} />
                Loading AI tasks...
            </div>
        );
    }

    if (activeTasks.length === 0 && inactiveTasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
                <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center" style={{ background: 'var(--bg-secondary)' }}>
                    <Bot className="w-8 h-8" style={{ color: 'var(--text-primary)', opacity: 0.5 }} />
                </div>
                <h2 className="text-[17px] font-bold text-[var(--text-primary)] mb-2">No routines yet</h2>
                <p className="text-[13px] text-[var(--text-muted)] max-w-md mb-6 leading-relaxed">
                    Schedule recurring AI workflows — like a weekly news digest or daily lead report.
                    Results land in your notifications when they're ready.
                </p>
                <button
                    onClick={onCreate}
                    disabled={!canCreate}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold text-white transition-all disabled:opacity-50"
                    style={{ background: 'var(--text-primary)', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}
                >
                    <Plus className="w-4 h-4" />
                    Create your first task
                </button>
            </div>
        );
    }

    return (
        <div className="px-6 py-5 max-w-4xl mx-auto w-full">
            {activeTasks.length > 0 && (
                <>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-primary)' }}>
                        Active
                    </div>
                    <div className="space-y-2 mb-6">
                        {activeTasks.map((t, i) => (
                            <TaskCard key={t.id} task={t} index={i} modelTiers={modelTiers}
                                onEdit={onEdit} onToggle={onToggle} onRequestDelete={onRequestDelete}
                                onRunNow={onRunNow} onOpenResult={onOpenResult} />
                        ))}
                    </div>
                </>
            )}
            {inactiveTasks.length > 0 && (
                <>
                    <div className="text-[10px] font-bold uppercase tracking-widest mb-2 text-[var(--text-muted)]">
                        Paused
                    </div>
                    <div className="space-y-2">
                        {inactiveTasks.map((t, i) => (
                            <TaskCard key={t.id} task={t} index={i} modelTiers={modelTiers}
                                onEdit={onEdit} onToggle={onToggle} onRequestDelete={onRequestDelete}
                                onRunNow={onRunNow} onOpenResult={onOpenResult} />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function TaskCard({ task, index, modelTiers, onEdit, onToggle, onRequestDelete, onRunNow, onOpenResult }) {
    const t = task;
    const status = tokenFor(t.lastStatus);
    const StatusIcon = status.icon;
    const tierShort = tierLabel(t.modelTier, modelTiers);

    return (
        <div
            className="group rounded-xl border bg-[var(--bg-card)] hover:bg-[var(--bg-tertiary)] transition-all"
            style={{
                borderColor: 'var(--border-subtle, rgba(0,0,0,0.06))',
                animation: `aiTaskFadeIn 0.2s ease ${index * 0.03}s both`,
                opacity: t.isActive ? 1 : 0.65,
            }}
        >
            <div className="flex items-start gap-3 p-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                        background: t.isActive ? 'var(--bg-secondary)' : 'rgba(0,0,0,0.04)',
                        border: `1px solid ${t.isActive ? 'var(--border-default)' : 'rgba(0,0,0,0.06)'}`,
                    }}
                >
                    <Bot className="w-[18px] h-[18px]" style={{ color: t.isActive ? 'var(--text-primary)' : '#94a3b8' }} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-[var(--text-primary)] leading-snug mb-1">
                        {t.title}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold inline-flex items-center gap-1 ${status.badge}`}>
                            <StatusIcon className={`w-3 h-3 ${status.spin ? 'animate-spin' : ''}`} />
                            {status.label}
                        </span>
                        {t.repeatInterval && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold inline-flex items-center gap-1" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                                <Repeat className="w-2.5 h-2.5" />
                                {repeatLabel(t.repeatInterval)}
                            </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold text-[var(--text-muted)]" style={{ background: 'rgba(0,0,0,0.04)' }}>
                            {tierShort}
                        </span>
                    </div>
                    {t.nextRunAt && t.isActive && (
                        <div className="text-[11px] text-[var(--text-muted)] inline-flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3" />
                            Next: {formatNextRun(t.nextRunAt)}
                        </div>
                    )}
                    {t.runCount > 0 && (
                        <div className="text-[11px] text-[var(--text-muted)] mt-1">
                            Ran {t.runCount} time{t.runCount !== 1 ? 's' : ''}{t.lastRunAt && ` • last ${timeAgo(t.lastRunAt)}`}
                        </div>
                    )}
                    <div className="text-[12px] text-[var(--text-secondary)] mt-2 line-clamp-2 whitespace-pre-wrap break-words">
                        {t.prompt}
                    </div>

                    <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                        <button
                            onClick={() => onRunNow(t.id)}
                            disabled={t.lastStatus === 'running'}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold disabled:opacity-50"
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                        >
                            <Play className="w-3 h-3" />
                            Run Now
                        </button>
                        <button
                            onClick={() => onEdit(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold"
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                        >
                            <Pencil className="w-3 h-3" />
                            Edit
                        </button>
                        <button
                            onClick={() => onToggle(t.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold"
                            style={{
                                background: t.isActive ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
                                color: t.isActive ? '#f59e0b' : '#22c55e',
                            }}
                        >
                            {t.isActive ? <><Pause className="w-3 h-3" />Pause</> : <><Play className="w-3 h-3" />Resume</>}
                        </button>
                        {t.lastResult && (
                            <button
                                onClick={() => onOpenResult({ title: t.title, content: t.lastResult })}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold"
                                style={{ background: 'rgba(34,197,94,0.08)', color: '#22c55e' }}
                            >
                                View result ↗
                            </button>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => onRequestDelete(t)}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1.5 rounded-md text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50"
                    title="Delete task"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
