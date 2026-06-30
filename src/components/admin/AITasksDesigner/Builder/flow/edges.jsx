import React, { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';
import { Plus, X } from 'lucide-react';

/**
 * Custom edge that renders `then` / `else` / loop labels as a small
 * theme-tokened chip near the source instead of letting React Flow
 * draw a flat label tag. Falls back to an unlabelled smooth-step edge
 * for edges without a label.
 *
 * In editable mode it also exposes, on hover, two midpoint controls:
 *   • a "+" button that inserts a step BETWEEN the two nodes (splices
 *     the edge), via `data.onInsert({ source, target })`
 *   • a "×" button that removes the connection, via
 *     `data.onDelete({ source, target })`
 * The callbacks + the `editable` flag are threaded in through `data`
 * by DiagramPane (the edge component can't reach the parent directly).
 */
export function LabelledEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd }) {
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 12,
    });
    const [hovered, setHovered] = useState(false);
    const kind = data?.kind || null;
    const editable = !!data?.editable;
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
            {/* Invisible fat hit-area so the thin edge is easy to hover and
                the midpoint controls have a forgiving target. */}
            {editable && (
                <path
                    d={edgePath}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={24}
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                />
            )}
            {kind && !(editable && hovered) && (
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
            {editable && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            pointerEvents: 'all',
                            opacity: hovered ? 1 : 0,
                            transition: 'opacity 120ms ease',
                        }}
                        className="flex items-center gap-1 nodrag nopan"
                        onMouseEnter={() => setHovered(true)}
                        onMouseLeave={() => setHovered(false)}
                    >
                        <button
                            type="button"
                            title="Insert a step here"
                            onClick={(e) => { e.stopPropagation(); data?.onInsert?.({ source, target }); }}
                            className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--accent)] text-white shadow-sm hover:opacity-90"
                        >
                            <Plus size={12} strokeWidth={2.5} />
                        </button>
                        <button
                            type="button"
                            title="Remove this connection"
                            onClick={(e) => { e.stopPropagation(); data?.onDelete?.({ source, target }); }}
                            className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--text-secondary)] shadow-sm hover:text-red-500 hover:border-red-400"
                        >
                            <X size={12} strokeWidth={2.5} />
                        </button>
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}

export const edgeTypes = { labelled: LabelledEdge };
