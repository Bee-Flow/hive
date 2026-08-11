import { Handle, Position } from '@xyflow/react';
import { ChevronDown, ChevronRight, Repeat } from 'lucide-react';
import React from 'react';
import { nodeDefaultLabel, nodeHelp, nodeTypeLabel } from '../nodeDefs';
import StepNodeBase, { NodeChip } from './StepNodeBase';
import { humanizeExpression } from '../displayHelpers';
import { CONTAINER_HEADER } from '../inlineFlowlets';
import { useNodeRuntime } from '../NodeRuntimeContext';

export default function LoopNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, stepLabelById, inlineExpanded: container } = data;
    const { onToggleInline } = useNodeRuntime();
    const friendlyOver = humanizeExpression(step.overRef || '', stepLabelById);
    // A loop's body is inline data, not a reference — so unlike a flowlet there
    // is no cycle to guard against and nothing to look up. It can always open.
    // The second argument is the flowlet key the toggle would collapse a rival
    // expansion of; a body is never shared, so there is none.
    const toggle = onToggleInline ? (e) => { e.stopPropagation(); onToggleInline(id, null); } : null;

    if (container) {
        return <ExpandedLoop id={id} step={step} runStep={runStep} friendlyOver={friendlyOver} onToggle={toggle} />;
    }
    return (
        <CollapsedLoop
            id={id} step={step} runStep={runStep} issues={issues}
            onAddAfter={onAddAfter} friendlyOver={friendlyOver} onToggle={toggle}
        />
    );
}

/** The ordinary 240px card: what it walks, what it calls each item, how many
 *  steps are inside — and the way in to see them. */
function CollapsedLoop({ id, step, runStep, issues, onAddAfter, friendlyOver, onToggle }) {
    const overRef = step.overRef || '';
    const itemVar = step.itemVar || 'item';
    const max = step.maxIterations ?? 100;
    const batchSize = step.batchSize ?? 1;
    const bodyLen = Array.isArray(step.body) ? step.body.length : 0;
    const plural = bodyLen === 1 ? '' : 's';

    // Two connectable ports (mirrors condition/switch's multi-port pattern):
    //   - "Done" fires once after every item has run (the continuation edge);
    //   - "On error" routes a loop failure (source-too-large, body crash with
    //     no local recovery) — previously only authorable via JSON/AI, and
    //     its edge even RENDERED as the Done edge (B10). branchFromHandle
    //     maps this port to `label: 'on_error'`.
    // The per-item side is not a port: the body is not wired to the loop, it is
    // held by it. Expanding the node draws it.
    const sourceHandles = [
        { id: 'done', label: 'Done', tone: 'then' },
        { id: 'on_error', label: 'On error', tone: 'error' },
    ];

    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || nodeDefaultLabel('loop')}</div>
            <div className="mt-0.5 text-[var(--text-secondary)]">
                <div className="truncate" title={overRef}>
                    over: <span className="text-[10px]">{friendlyOver || '—'}</span>
                </div>
                <div className="truncate">as: <span className="text-[10px]">loop.{itemVar}</span></div>
            </div>
            {onToggle && (
                <button
                    type="button"
                    onClick={onToggle}
                    title="Show the steps that run per item here on the canvas"
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline"
                >
                    <ChevronRight size={10} /> Expand
                </button>
            )}
        </div>
    );

    const badges = (
        <>
            <NodeChip title="Steps that run per item — expand the node to see them">▸ {bodyLen} step{plural} inside</NodeChip>
            {batchSize > 1 && <NodeChip title="Items per iteration">×{batchSize}</NodeChip>}
            <NodeChip title="Max iterations">≤{max}</NodeChip>
        </>
    );

    return (
        <StepNodeBase
            icon={<Repeat size={14} />}
            typeLabel={nodeTypeLabel('loop')}
            help={nodeHelp('loop')}
            body={body}
            badges={badges}
            hoverDetail={<LoopDetail step={step} runStep={runStep} />}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
            sourceHandles={sourceHandles}
        />
    );
}

/**
 * The full settings summary. Computed by the card and handed to StepNodeBase,
 * which currently ACCEPTS AND IGNORES it — the popover that rendered it covered
 * the neighbouring cards and the buttons above them. Kept because every node
 * type still builds one and the decision is StepNodeBase's to make.
 */
function LoopDetail({ step, runStep }) {
    const bodyLen = Array.isArray(step.body) ? step.body.length : 0;
    const plural = bodyLen === 1 ? '' : 's';
    const batchSize = step.batchSize ?? 1;
    const iterations = runStep?.output?.iterations;
    return (
        <div>
            <div className="font-semibold mb-1">{step.label || nodeDefaultLabel('loop')}</div>
            <div>over: <span className="font-mono">{step.overRef || '—'}</span></div>
            <div>as: <span className="font-mono">loop.{step.itemVar || 'item'}</span>{batchSize > 1 && ' (a batch of items, not a single one)'}</div>
            <div>batch size: {batchSize}</div>
            <div>max iterations: {step.maxIterations ?? 100}</div>
            <div className="mt-1 text-[var(--text-tertiary)]">
                {bodyLen} step{plural} run per item — expand the node to edit them.
                Outgoing edge labelled <span className="font-semibold text-emerald-600 dark:text-emerald-400">Done</span> fires once every item has run.
            </div>
            {iterations !== undefined && (
                <div className="mt-1 text-[var(--text-secondary)]">
                    last run: {iterations} iteration{iterations === 1 ? '' : 's'}
                </div>
            )}
        </div>
    );
}

/**
 * The container: the body drawn inside the loop that runs it.
 *
 * Sized by DiagramPane (node.style), so this fills 100% and draws only chrome —
 * the body is the space its children occupy. Solid border, not the flowlet
 * container's dashed one: a flowlet is a piece of flow borrowed from elsewhere
 * and shared with other call sites, while these steps belong to this loop and
 * nothing else.
 *
 * Both ports sit on the header strip rather than the box's vertical middle: on
 * a tall container the middle is nowhere near where the eye expects the flow to
 * leave, and "Done" leaving from beside the title reads as "after all this".
 */
function ExpandedLoop({ id, step, runStep, friendlyOver, onToggle }) {
    const itemVar = step.itemVar || 'item';
    const batchSize = step.batchSize ?? 1;
    const max = step.maxIterations ?? 100;
    const status = runStep?.status;
    const tone = status === 'error' ? 'border-red-500/70'
        : status === 'running' ? 'border-[var(--accent)]/80'
        : status === 'success' ? 'border-emerald-500/60'
        : 'border-[var(--border-default)]';
    const portClass = '!w-3 !h-3 !bg-[var(--bg-primary)] !border-2 !border-[var(--text-tertiary)]';
    return (
        <div className={`w-full h-full rounded-xl border-2 ${tone} bg-[var(--bg-secondary)]/40`}>
            <Handle type="target" position={Position.Left} id="in"
                style={{ top: CONTAINER_HEADER / 2 }} className={portClass} />
            <div
                className="flex items-center gap-2 px-3 border-b border-[var(--border-default)]"
                style={{ height: CONTAINER_HEADER }}
            >
                <Repeat size={14} className="shrink-0 text-[var(--accent)]" />
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{step.label || nodeDefaultLabel('loop')}</div>
                    <div className="text-[10px] text-[var(--text-tertiary)] truncate">
                        over {friendlyOver || '—'} · as loop.{itemVar}
                        {batchSize > 1 ? ` · ×${batchSize}` : ''} · ≤{max}
                    </div>
                </div>
                {/* Body steps are deliberately not recorded per iteration
                    (execLoop passes recordSteps:false — each pass would collide
                    on the run/step key), so the cards inside never light up.
                    Say so once here rather than leaving the user to wonder. */}
                <span
                    title="Steps inside a loop aren't recorded one by one — the loop itself carries the run status."
                    className="shrink-0 text-[10px] text-[var(--text-tertiary)] hidden sm:inline"
                >
                    per-item steps aren&apos;t recorded
                </span>
                {onToggle && (
                    <button
                        type="button"
                        onClick={onToggle}
                        title="Collapse — back to a single card"
                        className="shrink-0 text-[var(--text-tertiary)] hover:text-[var(--accent)]"
                    >
                        <ChevronDown size={15} />
                    </button>
                )}
            </div>
            {/* Same two ports the collapsed card offers, so an existing Done /
                On error connection keeps its anchor while the node is open. */}
            <Handle type="source" position={Position.Right} id="done"
                style={{ top: CONTAINER_HEADER / 2 - 8 }} className={portClass} />
            <Handle type="source" position={Position.Right} id="on_error"
                style={{ top: CONTAINER_HEADER / 2 + 10 }} className={portClass} />
            <span className="hidden" data-node-id={id} />
        </div>
    );
}
