import { StickyNote } from 'lucide-react';
import React from 'react';

/**
 * Non-executing note attached to the canvas (§5b scaffolding).
 *
 * Persisted in the draft as a step with `type: 'note'`. The runner
 * skips notes; they exist purely as annotations the team can attach
 * to a flow to explain WHY a branch exists.
 *
 * Phase 2: register this node type with ReactFlow's nodeTypes map in
 * DiagramPane so notes render with sticky-note chrome instead of the
 * default StepNodeBase frame.
 */

export default function NoteNode({ data }) {
    const text = data?.step?.text || data?.step?.label || '';
    return (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 max-w-[260px] text-[12px] text-[var(--text-primary)]">
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 text-[10px] uppercase tracking-wide mb-1">
                <StickyNote size={11} /> Note
            </div>
            <div className="whitespace-pre-wrap break-words">{text || '(empty note)'}</div>
        </div>
    );
}
