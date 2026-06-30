import React from 'react';
import { Layers, SquareArrowOutUpRight } from 'lucide-react';
import StepNodeBase from './StepNodeBase';
import { useNodeRuntime } from '../NodeRuntimeContext';

/**
 * A "call_layer" node — runs an inline flowlet (sub-flow declared in
 * definition.layers) as a single step. Shows the flowlet label + mapped
 * inputs and an "Open flowlet" affordance (drill-in) when the editor
 * provides onOpenLayer via NodeRuntimeContext.
 */
export default function CallFlowletNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    const { onOpenLayer, layerSummaries } = useNodeRuntime();
    const inputs = step.inputs && typeof step.inputs === 'object' ? Object.keys(step.inputs) : [];
    // Optional AI/human one-liner describing what the flowlet does (set from
    // the Flowlets drawer). Shown as a muted subtitle when present.
    const summary = step.layerKey ? (layerSummaries?.[step.layerKey] || '') : '';
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
            {onOpenLayer && step.layerKey && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpenLayer(step.layerKey); }}
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline"
                >
                    <SquareArrowOutUpRight size={10} /> Open flowlet
                </button>
            )}
        </div>
    );
    return (
        <StepNodeBase
            icon={<Layers size={14} />}
            typeLabel="Flowlet"
            body={body}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}
