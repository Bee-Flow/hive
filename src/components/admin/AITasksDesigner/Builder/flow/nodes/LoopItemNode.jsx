import { Handle, Position } from '@xyflow/react';
import { CornerDownRight } from 'lucide-react';
import React from 'react';
import { nodeHelp, nodeTypeLabel } from '../nodeDefs';

/**
 * "Each item" — where the steps inside an expanded loop begin.
 *
 * Synthetic: it exists only in the flat graph an expanded loop produces
 * (flow/inlineFlowlets.js `loopEntryNode`) and is stripped before anything is
 * saved. Drawn because a chain of body steps starting from nothing would leave
 * the reader guessing what feeds it — and because this is the one place the
 * canvas can name the per-item variable those steps have to bind against.
 *
 * A PILL, not a step card: it is not a step, cannot be run, configured,
 * duplicated or deleted, and making it look like the cards around it would
 * invite all four. It has an output handle only — nothing connects INTO the
 * start of an iteration.
 *
 * Clicking it opens the loop's own editor (DiagramPane maps the click to the
 * container), because "which list, and what do I call each item" is a loop
 * setting — there is nothing else this node could offer.
 */
export default function LoopItemNode({ data }) {
    const { step } = data;
    const batchSize = Math.max(1, Number(step?.batchSize) || 1);
    const itemVar = step?.itemVar || 'item';
    const batched = batchSize > 1;

    return (
        <div
            title={`${nodeTypeLabel('loop_item')} — ${nodeHelp('loop_item')}`}
            className="inline-flex items-center gap-2 rounded-full border border-dashed border-[var(--accent)]/50 bg-[var(--bg-secondary)] px-3 py-2 shadow-sm cursor-pointer"
        >
            <CornerDownRight size={13} className="shrink-0 text-[var(--accent)]" />
            <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                    {batched ? `Each batch of ${batchSize}` : 'Each item'}
                </div>
                {/* The exact name the steps below bind against. `execLoop` binds
                    a SLICE when batchSize > 1, so the wording changes with it —
                    a user writing loop.item.name against a batch gets nothing. */}
                <div className="text-[10px] text-[var(--text-secondary)] font-mono truncate">
                    loop.{itemVar}
                </div>
            </div>
            <Handle
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !rounded-full !border-2 !bg-[var(--bg-primary)] !border-[var(--text-tertiary)]"
                style={{ right: -6 }}
            />
        </div>
    );
}
