import { Handle, Position } from '@xyflow/react';
import { Layers, SquareArrowOutUpRight, ChevronDown, ChevronRight, Users } from 'lucide-react';
import React from 'react';
import { nodeHelp, nodeTypeLabel } from '../nodeDefs';
import StepNodeBase from './StepNodeBase';
import { CONTAINER_HEADER } from '../inlineFlowlets';
import { useNodeRuntime } from '../NodeRuntimeContext';

/**
 * A "call_layer" node — runs an inline flowlet (sub-flow declared in
 * definition.layers) as a single step.
 *
 * Two shapes:
 *   collapsed — the ordinary 240px card: flowlet label, mapped inputs, an
 *               "Open flowlet" drill-in and a chevron to expand.
 *   expanded  — a container whose contents (the flowlet's own steps, rendered
 *               by DiagramPane as React Flow child nodes) sit inside it, so
 *               the sub-flow is visible and editable in the flow that uses it.
 *               Only the header strip is drawn here; the body is the space the
 *               children occupy.
 */
export default function CallFlowletNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, inlineExpanded: container } = data;
    const { onOpenLayer, layerSummaries, onToggleInline, layerRefCounts } = useNodeRuntime();
    const summary = step.layerKey ? (layerSummaries?.[step.layerKey] || '') : '';
    const canToggle = !!onToggleInline && !!step.layerKey;
    const toggle = (e) => { e.stopPropagation(); onToggleInline(id, step.layerKey); };

    if (container) {
        return <ExpandedFlowlet id={id} step={step} summary={summary} runStep={runStep}
            refCount={layerRefCounts?.[step.layerKey] || 0}
            onOpenLayer={onOpenLayer} onToggle={canToggle ? toggle : null} />;
    }

    const inputs = step.inputs && typeof step.inputs === 'object' ? Object.keys(step.inputs) : [];
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || step.layerKey || 'Flowlet'}</div>
            {summary && (
                <div className="mt-0.5 text-[10px] text-[var(--text-tertiary)] italic line-clamp-2">{summary}</div>
            )}
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] line-clamp-2">
                {inputs.length === 0
                    ? <span className="italic">no inputs mapped</span>
                    : `${inputs.length} input${inputs.length === 1 ? '' : 's'}: ${inputs.slice(0, 4).join(', ')}${inputs.length > 4 ? '…' : ''}`}
            </div>
            <div className="mt-1.5 flex items-center gap-3">
                {canToggle && (
                    <button
                        type="button"
                        onClick={toggle}
                        title="Show this flowlet's steps here"
                        className="inline-flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline"
                    >
                        <ChevronRight size={10} /> Expand
                    </button>
                )}
                {onOpenLayer && step.layerKey && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpenLayer(step.layerKey); }}
                        className="inline-flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline"
                    >
                        <SquareArrowOutUpRight size={10} /> Open flowlet
                    </button>
                )}
            </div>
        </div>
    );
    return (
        <StepNodeBase
            icon={<Layers size={14} />}
            typeLabel={nodeTypeLabel('call_layer')}
            help={nodeHelp('call_layer')}
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}

/**
 * The container. Sized by DiagramPane (node.style), so this fills 100% and
 * only draws chrome: a header strip and the two connection handles, which stay
 * on the header rather than the box's vertical middle — on a tall container the
 * middle is nowhere near where the eye expects the flow to enter and leave.
 *
 * The dashed border and tinted body say "this is not one step, it's a piece of
 * flow borrowed from somewhere else".
 */
function ExpandedFlowlet({ id, step, summary, runStep, refCount, onOpenLayer, onToggle }) {
    const status = runStep?.status;
    const tone = status === 'error' ? 'border-red-500/60'
        : status === 'running' ? 'border-[var(--accent)]/70'
        : status === 'success' ? 'border-emerald-500/50'
        : 'border-[var(--accent)]/35';
    return (
        <div className={`w-full h-full rounded-xl border-2 border-dashed ${tone} bg-[var(--accent)]/[0.04]`}>
            <Handle type="target" position={Position.Left} id="in"
                style={{ top: CONTAINER_HEADER / 2 }}
                className="!w-3 !h-3 !bg-[var(--bg-primary)] !border-2 !border-[var(--text-tertiary)]" />
            <div
                className="flex items-center gap-2 px-3 border-b border-dashed border-[var(--accent)]/25"
                style={{ height: CONTAINER_HEADER }}
            >
                <Layers size={14} className="shrink-0 text-[var(--accent)]" />
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{step.label || step.layerKey || 'Flowlet'}</div>
                    {summary && <div className="text-[10px] text-[var(--text-tertiary)] italic truncate">{summary}</div>}
                </div>
                {refCount > 1 && (
                    <span
                        title={`This flowlet is used in ${refCount} places — changes here apply to all of them.`}
                        className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[10px]"
                    >
                        <Users size={10} /> {refCount}
                    </span>
                )}
                {onOpenLayer && step.layerKey && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpenLayer(step.layerKey); }}
                        title="Open this flowlet on its own canvas"
                        className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--accent)]"
                    >
                        <SquareArrowOutUpRight size={13} />
                    </button>
                )}
                {onToggle && (
                    <button
                        type="button"
                        onClick={onToggle}
                        title="Collapse this flowlet"
                        className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--accent)]"
                    >
                        <ChevronDown size={15} />
                    </button>
                )}
            </div>
            <Handle type="source" position={Position.Right} id="out"
                style={{ top: CONTAINER_HEADER / 2 }}
                className="!w-3 !h-3 !bg-[var(--bg-primary)] !border-2 !border-[var(--text-tertiary)]" />
            {/* `id` is unused visually but keeps the container addressable in
                tests and by the canvas's focusStep helper. */}
            <span className="hidden" data-node-id={id} />
        </div>
    );
}
