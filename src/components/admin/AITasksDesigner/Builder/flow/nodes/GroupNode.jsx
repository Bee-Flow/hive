import { Grip } from 'lucide-react';
import React from 'react';

/**
 * Group container node (§5b scaffolding).
 *
 * Wraps a multi-select selection so users can collapse a chunk of the
 * graph behind a single label. Mirrors the visual pattern of LoopNode
 * (an outline framing the contained steps); the runner treats the
 * group as a transparent passthrough and walks the inner edges as
 * usual.
 *
 * Phase 2 wiring: DiagramPane registers this in nodeTypes, the
 * multi-select clipboard hook surfaces "Group selection" as an action,
 * and the layout/dagre pass collapses grouped children when the user
 * folds the group.
 */

export default function GroupNode({ data }) {
    const label = data?.step?.label || 'Group';
    return (
        <div className="rounded-lg border-2 border-dashed border-[var(--border-default)] bg-[var(--bg-secondary)]/30 px-3 py-2 text-[11px] text-[var(--text-secondary)] min-w-[180px] min-h-[80px]">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide">
                <Grip size={11} /> {label}
            </div>
        </div>
    );
}
