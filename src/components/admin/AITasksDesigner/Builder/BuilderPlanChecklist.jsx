import { CheckCircle2, Circle, Loader2, ListTodo } from 'lucide-react';
import React from 'react';

/**
 * Read-only live checklist of the builder agent's self-managed plan
 * (builder_set_plan → SSE `plan` event → state.todos). While the agent is
 * running, the first not-yet-done item is shown as "in progress".
 *
 * Purely presentational — the user watches, they don't edit it.
 */
export default function BuilderPlanChecklist({ todos, running = false }) {
    if (!Array.isArray(todos) || todos.length === 0) return null;
    const doneCount = todos.filter(t => t?.done).length;
    const activeIdx = running ? todos.findIndex(t => !t?.done) : -1;

    return (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/50 p-2.5 text-xs">
            <div className="flex items-center gap-1.5 mb-1.5 text-[var(--text-secondary)]">
                <ListTodo size={13} />
                <span className="font-medium">Plan</span>
                <span className="text-[10px] text-[var(--text-tertiary)]">{doneCount}/{todos.length}</span>
            </div>
            <div className="flex flex-col gap-1">
                {todos.map((t, i) => {
                    const done = !!t?.done;
                    const active = i === activeIdx;
                    return (
                        <div key={i} className="flex items-start gap-1.5">
                            {done
                                ? <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                                : active
                                    ? <Loader2 size={13} className="text-[var(--accent)] animate-spin flex-shrink-0 mt-0.5" />
                                    : <Circle size={13} className="text-[var(--text-tertiary)] flex-shrink-0 mt-0.5" />}
                            <span className={`flex-1 ${done ? 'line-through text-[var(--text-tertiary)]' : active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                {t?.text || ''}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
