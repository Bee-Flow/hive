import React from 'react';
import { Box, SquareArrowOutUpRight } from 'lucide-react';
import { nodeHelp, nodeTypeLabel } from '../nodeDefs';
import StepNodeBase from './StepNodeBase';
import { useNodeRuntime } from '../NodeRuntimeContext';
import { STEP_NODE_DEFAULT } from '../stepMeta';

/**
 * A "call_block" node — runs a reusable Step (a standalone kind='block' row)
 * as a single step in this automation. Shows the Step label + mapped inputs
 * and an "Open Step" affordance (deep-link to the Step builder) when the
 * editor provides onOpenBlock via NodeRuntimeContext.
 */
export default function CallStepNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    const { onOpenBlock, blockSummaries } = useNodeRuntime();
    const inputs = step.inputs && typeof step.inputs === 'object' ? Object.keys(step.inputs) : [];
    const summary = step.blockId ? (blockSummaries?.[step.blockId] || '') : '';
    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || STEP_NODE_DEFAULT}</div>
            {summary && (
                <div className="mt-0.5 text-[10px] text-[var(--text-tertiary)] italic line-clamp-2">{summary}</div>
            )}
            <div className="mt-0.5 text-[10px] text-[var(--text-secondary)] line-clamp-2">
                {inputs.length === 0
                    ? <span className="italic">no inputs mapped</span>
                    : `${inputs.length} input${inputs.length === 1 ? '' : 's'}: ${inputs.slice(0, 4).join(', ')}${inputs.length > 4 ? '…' : ''}`}
            </div>
            {onOpenBlock && step.blockId && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpenBlock(step.blockId); }}
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline"
                >
                    <SquareArrowOutUpRight size={10} /> Open Step
                </button>
            )}
        </div>
    );
    return (
        <StepNodeBase
            icon={<Box size={14} />}
            typeLabel={nodeTypeLabel('call_block')}
            help={nodeHelp('call_block')}
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
