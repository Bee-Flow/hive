import React from 'react';
import { Box, Plus, Trash2, Globe, Lock, Users, MessageSquare, FolderOpen, History } from 'lucide-react';
import { StepIcon } from '../../AITasksDesigner/Builder/flow/stepIcons';

/**
 * "Steps" tab of the Routines start screen. A Step is a reusable building
 * block (one input contract + a defined output) built in the same visual
 * builder, then added to any automation as a step — or exposed in chat.
 *
 * Presentational only: the parent (AITasksDesigner) owns the list + callbacks
 * so the list stays fresh after create/delete/back. `onCreateStep()` opens a
 * fresh Step builder; `onOpenStep(id)` edits one; `onDeleteStep(step)` removes.
 */
export default function StepsTab({ steps = [], loading = false, onCreateStep, onOpenStep, onOpenStepRuns, onDeleteStep }) {
    return (
        <div>
            <div className="flex flex-col items-center text-center">
                <div className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                    Build a reusable Step
                </div>
                <div className="text-sm text-[var(--text-tertiary)] mb-5 max-w-md leading-relaxed">
                    A Step takes an input, does some work, and returns an output. Build it
                    once, then drop it into any automation — or let agents call it in chat.
                </div>
                <button
                    onClick={onCreateStep}
                    className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-white"
                    style={{ background: 'var(--accent-primary, var(--text-primary))' }}
                >
                    <Plus size={15} /> New Step
                </button>
            </div>

            <div className="mt-8">
                <div className="text-[11px] uppercase tracking-wide font-semibold text-[var(--text-tertiary)] mb-3">
                    Your Steps
                </div>
                {loading ? (
                    <div className="text-sm text-[var(--text-tertiary)] py-6 text-center">Loading…</div>
                ) : steps.length === 0 ? (
                    <div className="text-sm text-[var(--text-tertiary)] py-6 text-center rounded-xl border border-dashed border-[var(--border-default)]">
                        No Steps yet. Create one to reuse it across your automations.
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {steps.map((s) => (
                            <StepRow key={s.id} step={s} onOpen={onOpenStep} onOpenRuns={onOpenStepRuns} onDelete={onDeleteStep} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function StepRow({ step, onOpen, onOpenRuns, onDelete }) {
    const published = step.publishedVersion != null;
    const shared = step.isPublished;
    const groupRestricted = shared && Array.isArray(step.sharedGroups) && step.sharedGroups.length > 0;
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onOpen?.(step.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') onOpen?.(step.id); }}
            className="group flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--text-tertiary)] transition p-3 cursor-pointer text-left"
        >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-tertiary)] flex-shrink-0 text-[var(--text-secondary)]">
                <StepIcon name={step.icon} size={16} fallback={<Box size={16} />} />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {step.title || 'Untitled Step'}
                </div>
                {step.description ? (
                    <div className="text-[11px] text-[var(--text-tertiary)] truncate">{step.description}</div>
                ) : null}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {step.category ? <Badge tone="muted"><FolderOpen size={11} /> {step.category}</Badge> : null}
                <Badge tone={published ? 'ok' : 'muted'}>{published ? 'Published' : 'Draft'}</Badge>
                {groupRestricted ? (
                    <Badge tone="muted"><Users size={11} /> Groups</Badge>
                ) : shared ? (
                    <Badge tone="muted"><Globe size={11} /> Org</Badge>
                ) : (
                    <Badge tone="muted"><Lock size={11} /> Personal</Badge>
                )}
                {step.exposeAsTool ? <Badge tone="muted"><MessageSquare size={11} /> Chat</Badge> : null}
                {onOpenRuns && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenRuns(step.id); }}
                        className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] opacity-0 group-hover:opacity-100 transition"
                        title="View executions"
                    >
                        <History size={14} />
                    </button>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete?.(step); }}
                    className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--danger,#dc2626)] hover:bg-[var(--bg-primary)] opacity-0 group-hover:opacity-100 transition"
                    title="Delete Step"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
}

function Badge({ tone = 'muted', children }) {
    const cls = tone === 'ok'
        ? 'text-[var(--text-primary)] border-[var(--accent-primary,var(--accent))]'
        : 'text-[var(--text-tertiary)] border-[var(--border-default)]';
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${cls}`}>
            {children}
        </span>
    );
}
