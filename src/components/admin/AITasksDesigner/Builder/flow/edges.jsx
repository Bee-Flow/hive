import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';

/**
 * Custom edge that renders `then` / `else` / loop labels as a small
 * theme-tokened chip near the source instead of letting React Flow
 * draw a flat label tag. Falls back to an unlabelled smooth-step edge
 * for edges without a label.
 */
export function LabelledEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }) {
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 12,
    });
    const kind = data?.kind || null;
    const tone = kind === 'then'
        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
        : kind === 'else'
            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
            : kind === 'default'
                ? 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border-[var(--border-default)] italic'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-default)]';

    return (
        <>
            <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={{ stroke: 'var(--border-default)', strokeWidth: 1.5 }} />
            {kind && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            pointerEvents: 'none',
                        }}
                        className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded-full border ${tone}`}
                    >
                        {kind}
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}

export const edgeTypes = { labelled: LabelledEdge };
